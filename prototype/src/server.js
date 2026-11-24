import express from 'express'
import cors from 'cors'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { db, initSchema } from './db.js'
import { notify, setIO } from './notify.js'
import { startScheduler, runDeadlineScan } from './scheduler.js'

const PORT = process.env.PORT || 4000
const app = express()
app.use(cors())
app.use(express.json())

initSchema()

const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: '*' } })
setIO(io)

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId
  if (userId) socket.join(`user:${userId}`)
  socket.on('disconnect', () => {})
})

// ---------- helpers ----------
const progressOf = (projectId) => {
  const rows = db.prepare('SELECT status FROM project_steps WHERE project_id = ?').all(projectId)
  if (!rows.length) return 0
  const done = rows.filter((r) => r.status === 'Done' || r.status === 'Skipped').length
  return Math.round((done / rows.length) * 100)
}

const todayISO = () => new Date().toISOString().slice(0, 10)
const addDays = (dateStr, days) => {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const logActivity = (row) => {
  db.prepare(
    `INSERT INTO activity_log (project_id, project_step_id, actor_id, action, from_value, to_value)
     VALUES (@project_id, @project_step_id, @actor_id, @action, @from_value, @to_value)`
  ).run({
    project_id: row.project_id ?? null,
    project_step_id: row.project_step_id ?? null,
    actor_id: row.actor_id ?? null,
    action: row.action,
    from_value: row.from_value ?? null,
    to_value: row.to_value ?? null
  })
}

// ---------- users ----------
app.get('/api/users', (req, res) => {
  res.json(db.prepare('SELECT id, name, email, role, department, notify_inapp, notify_email FROM users').all())
})

app.patch('/api/users/:id', (req, res) => {
  const { notify_inapp, notify_email } = req.body
  db.prepare('UPDATE users SET notify_inapp = COALESCE(?, notify_inapp), notify_email = COALESCE(?, notify_email) WHERE id = ?')
    .run(notify_inapp ?? null, notify_email ?? null, req.params.id)
  res.json(db.prepare('SELECT id, name, email, role, department, notify_inapp, notify_email FROM users WHERE id = ?').get(req.params.id))
})

// ---------- templates ----------
app.get('/api/templates', (req, res) => {
  const templates = db.prepare('SELECT * FROM templates ORDER BY id DESC').all()
  for (const t of templates) {
    t.steps = db.prepare('SELECT * FROM template_steps WHERE template_id = ? ORDER BY order_index').all(t.id)
  }
  res.json(templates)
})

app.get('/api/templates/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id)
  if (!t) return res.status(404).json({ error: 'not found' })
  t.steps = db.prepare('SELECT * FROM template_steps WHERE template_id = ? ORDER BY order_index').all(t.id)
  res.json(t)
})

app.post('/api/templates', (req, res) => {
  const { name, description, category, created_by, steps = [] } = req.body
  const info = db.prepare('INSERT INTO templates (name, description, category, created_by) VALUES (?, ?, ?, ?)')
    .run(name, description ?? null, category ?? null, created_by ?? null)
  const templateId = info.lastInsertRowid
  const insert = db.prepare(
    `INSERT INTO template_steps (template_id, order_index, name, description, default_duration_days, default_role, requires_attachment, depends_on_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
  steps.forEach((s, i) => insert.run(templateId, i + 1, s.name, s.description ?? null, s.default_duration_days ?? 1, s.default_role ?? null, s.requires_attachment ? 1 : 0, s.depends_on_order ?? null))
  res.status(201).json(db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId))
})

// ---------- projects ----------
app.get('/api/projects', (req, res) => {
  const projects = db.prepare(`
    SELECT p.*, u.name AS manager_name, t.name AS template_name
    FROM projects p
    LEFT JOIN users u ON u.id = p.manager_id
    LEFT JOIN templates t ON t.id = p.template_id
    ORDER BY p.id DESC`).all()
  for (const p of projects) p.progress = progressOf(p.id)
  res.json(projects)
})

app.get('/api/projects/:id', (req, res) => {
  const p = db.prepare(`
    SELECT p.*, u.name AS manager_name, t.name AS template_name
    FROM projects p
    LEFT JOIN users u ON u.id = p.manager_id
    LEFT JOIN templates t ON t.id = p.template_id
    WHERE p.id = ?`).get(req.params.id)
  if (!p) return res.status(404).json({ error: 'not found' })
  p.steps = db.prepare(`
    SELECT s.*, u.name AS assignee_name
    FROM project_steps s
    LEFT JOIN users u ON u.id = s.assignee_id
    WHERE s.project_id = ? ORDER BY s.order_index`).all(p.id)
  p.progress = progressOf(p.id)
  res.json(p)
})

// Create project from template -> auto generate steps
app.post('/api/projects', async (req, res) => {
  const { name, code, template_id, manager_id, start_date, target_end_date, budget } = req.body
  if (!template_id) return res.status(400).json({ error: 'template_id required' })
  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(template_id)
  if (!template) return res.status(404).json({ error: 'template not found' })

  const info = db.prepare(`
    INSERT INTO projects (code, name, template_id, template_version, manager_id, start_date, target_end_date, budget)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(code ?? `HR-${Date.now()}`, name, template_id, template.version, manager_id ?? null, start_date ?? todayISO(), target_end_date ?? null, budget ?? null)
  const projectId = info.lastInsertRowid

  const tsteps = db.prepare('SELECT * FROM template_steps WHERE template_id = ? ORDER BY order_index').all(template_id)
  const orderToId = {}
  const insertStep = db.prepare(`
    INSERT INTO project_steps (project_id, template_step_id, order_index, name, description, assignee_id, due_date, requires_attachment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
  let cursor = start_date ?? todayISO()
  for (const ts of tsteps) {
    const due = addDays(cursor, ts.default_duration_days)
    const si = insertStep.run(projectId, ts.id, ts.order_index, ts.name, ts.description ?? null, null, due, ts.requires_attachment)
    orderToId[ts.order_index] = si.lastInsertRowid
    cursor = due
  }
  // resolve dependencies by order
  const upd = db.prepare('UPDATE project_steps SET depends_on_id = ? WHERE id = ?')
  for (const ts of tsteps) {
    if (ts.depends_on_order && orderToId[ts.depends_on_order]) {
      upd.run(orderToId[ts.depends_on_order], orderToId[ts.order_index])
    }
  }

  logActivity({ project_id: projectId, actor_id: manager_id, action: 'Project Created', to_value: name })
  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId))
})

app.patch('/api/projects/:id', (req, res) => {
  const { status, target_end_date, budget } = req.body
  db.prepare('UPDATE projects SET status = COALESCE(?, status), target_end_date = COALESCE(?, target_end_date), budget = COALESCE(?, budget) WHERE id = ?')
    .run(status ?? null, target_end_date ?? null, budget ?? null, req.params.id)
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id))
})

// ---------- steps ----------
app.get('/api/steps/:id', (req, res) => {
  const s = db.prepare(`
    SELECT s.*, u.name AS assignee_name
    FROM project_steps s LEFT JOIN users u ON u.id = s.assignee_id
    WHERE s.id = ?`).get(req.params.id)
  if (!s) return res.status(404).json({ error: 'not found' })
  s.checklist = db.prepare('SELECT * FROM checklist_items WHERE project_step_id = ? ORDER BY order_index').all(s.id)
  res.json(s)
})

app.patch('/api/steps/:id', async (req, res) => {
  const step = db.prepare('SELECT * FROM project_steps WHERE id = ?').get(req.params.id)
  if (!step) return res.status(404).json({ error: 'not found' })
  const actorId = req.body.actor_id ?? null
  const { status, assignee_id, due_date } = req.body

  // rule: cannot start if dependency not done
  if (status && status !== 'Not Started' && step.depends_on_id) {
    const dep = db.prepare('SELECT status, name FROM project_steps WHERE id = ?').get(step.depends_on_id)
    if (dep && !['Done', 'Skipped'].includes(dep.status)) {
      return res.status(409).json({ error: `Blocked by dependency: ${dep.name}` })
    }
  }

  const completedAt = status === 'Done' ? new Date().toISOString() : step.completed_at
  // ใช้ค่าที่ส่งมาเท่านั้น จึงสามารถ "ล้าง" ผู้รับผิดชอบ/กำหนดส่งได้ด้วยค่า null
  const has = (key) => Object.prototype.hasOwnProperty.call(req.body, key)
  db.prepare(`UPDATE project_steps
    SET status = ?,
        assignee_id = ?,
        due_date = ?,
        completed_at = ?
    WHERE id = ?`).run(
      has('status') ? status : step.status,
      has('assignee_id') ? assignee_id : step.assignee_id,
      has('due_date') ? due_date : step.due_date,
      completedAt,
      step.id
    )

  const updated = db.prepare('SELECT * FROM project_steps WHERE id = ?').get(step.id)

  if (status && status !== step.status) {
    logActivity({ project_id: step.project_id, project_step_id: step.id, actor_id: actorId, action: 'Status Change', from_value: step.status, to_value: status })
  }
  if (assignee_id && assignee_id !== step.assignee_id) {
    logActivity({ project_id: step.project_id, project_step_id: step.id, actor_id: actorId, action: 'Reassigned', from_value: String(step.assignee_id ?? ''), to_value: String(assignee_id) })
    await notify({
      userId: assignee_id,
      type: 'Assigned',
      title: `คุณได้รับมอบหมาย: ${step.name}`,
      body: `คุณได้รับมอบหมายขั้นตอน "${step.name}" กำหนดส่ง ${updated.due_date}`,
      link: `/projects/${step.project_id}`
    })
  }

  // Notify the project manager on status change
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(step.project_id)
  if (status && status !== step.status && project?.manager_id && project.manager_id !== actorId) {
    await notify({
      userId: project.manager_id,
      type: 'Status Changed',
      title: `${step.name} -> ${status}`,
      body: `ขั้นตอน "${step.name}" ในโครงการ ${project.name} เปลี่ยนสถานะเป็น ${status}`,
      link: `/projects/${step.project_id}`
    })
  }

  // Auto-complete project when all steps done
  const remaining = db.prepare(`SELECT COUNT(*) c FROM project_steps WHERE project_id = ? AND status NOT IN ('Done','Skipped')`).get(step.project_id).c
  if (remaining === 0 && project && project.status !== 'Completed') {
    db.prepare(`UPDATE projects SET status = 'Completed' WHERE id = ?`).run(step.project_id)
    if (project.manager_id) {
      await notify({ userId: project.manager_id, type: 'Milestone', title: `โครงการเสร็จสมบูรณ์: ${project.name}`, body: `ทุกขั้นตอนของโครงการ ${project.name} เสร็จสิ้นแล้ว`, link: `/projects/${step.project_id}` })
    }
  }

  res.json(updated)
})

app.post('/api/steps/:id/checklist', (req, res) => {
  const { label } = req.body
  const count = db.prepare('SELECT COUNT(*) c FROM checklist_items WHERE project_step_id = ?').get(req.params.id).c
  const info = db.prepare('INSERT INTO checklist_items (project_step_id, label, order_index) VALUES (?, ?, ?)').run(req.params.id, label, count + 1)
  res.status(201).json(db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(info.lastInsertRowid))
})

app.patch('/api/checklist/:id', (req, res) => {
  const { is_done } = req.body
  db.prepare('UPDATE checklist_items SET is_done = ? WHERE id = ?').run(is_done ? 1 : 0, req.params.id)
  res.json(db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(req.params.id))
})

// ---------- notifications ----------
app.get('/api/notifications', (req, res) => {
  const userId = req.query.user_id
  if (!userId) return res.json([])
  res.json(db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(userId))
})

app.post('/api/notifications/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

app.post('/api/notifications/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.body.user_id)
  res.json({ ok: true })
})

// ---------- dashboard & my tasks ----------
app.get('/api/dashboard', (req, res) => {
  const projects = db.prepare('SELECT id, name, status, target_end_date FROM projects').all()
  const steps = db.prepare('SELECT * FROM project_steps').all()
  const summary = {
    projects_active: projects.filter((p) => p.status === 'Active').length,
    projects_total: projects.length,
    steps_total: steps.length,
    steps_done: steps.filter((s) => s.status === 'Done').length,
    overdue: steps.filter((s) => s.status === 'Overdue').length,
    due_soon: steps.filter((s) => s.status !== 'Done' && s.status !== 'Skipped' && s.due_date && s.due_date <= addDays(todayISO(), 3)).length
  }
  const upcoming = db.prepare(`
    SELECT s.*, p.name AS project_name
    FROM project_steps s JOIN projects p ON p.id = s.project_id
    WHERE s.status NOT IN ('Done','Skipped') AND s.due_date IS NOT NULL
    ORDER BY s.due_date LIMIT 10`).all()
  res.json({ summary, upcoming })
})

app.get('/api/tasks', (req, res) => {
  const userId = req.query.user_id
  if (!userId) return res.json([])
  res.json(db.prepare(`
    SELECT s.*, p.name AS project_name
    FROM project_steps s JOIN projects p ON p.id = s.project_id
    WHERE s.assignee_id = ? ORDER BY s.due_date`).all(userId))
})

// ---------- activity ----------
app.get('/api/projects/:id/activity', (req, res) => {
  res.json(db.prepare(`
    SELECT a.*, u.name AS actor_name
    FROM activity_log a LEFT JOIN users u ON u.id = a.actor_id
    WHERE a.project_id = ? ORDER BY a.id DESC LIMIT 50`).all(req.params.id))
})

// manual trigger for demo
app.post('/api/admin/run-deadline-scan', async (req, res) => {
  const count = await runDeadlineScan()
  res.json({ scanned: count })
})

httpServer.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`)
  startScheduler()
})
