import { db, initSchema } from './db.js'

initSchema()

// wipe (prototype convenience)
db.exec(`
  DELETE FROM notifications;
  DELETE FROM activity_log;
  DELETE FROM checklist_items;
  DELETE FROM project_steps;
  DELETE FROM projects;
  DELETE FROM template_steps;
  DELETE FROM templates;
  DELETE FROM users;
`)

const users = [
  { name: 'สมชาย (Admin)', email: 'admin@example.com', role: 'Admin', department: 'HR' },
  { name: 'มาลี (HR Manager)', email: 'pm@example.com', role: 'Project Manager', department: 'HRD' },
  { name: 'ธนา (Training Officer)', email: 'engineer@example.com', role: 'Member', department: 'HRD' },
  { name: 'จินดา (Line Manager)', email: 'procurement@example.com', role: 'Member', department: 'Operations' },
  { name: 'ผู้บริหาร (Viewer)', email: 'viewer@example.com', role: 'Viewer', department: 'Exec' }
]
const insUser = db.prepare('INSERT INTO users (name, email, role, department) VALUES (?, ?, ?, ?)')
const userIds = users.map((u) => insUser.run(u.name, u.email, u.role, u.department).lastInsertRowid)
const [adminId, pmId, engId, procId] = userIds

// ---------- Template 1: การพัฒนาบุคลากร ----------
const t1 = db.prepare('INSERT INTO templates (name, description, category, created_by) VALUES (?, ?, ?, ?)')
  .run('กระบวนการพัฒนาบุคลากรประจำปี', 'ขั้นตอนมาตรฐานตั้งแต่สำรวจความต้องการจนถึงประเมินผลการฝึกอบรม', 'HR Development', adminId).lastInsertRowid

const insTStep = db.prepare(`INSERT INTO template_steps
  (template_id, order_index, name, description, default_duration_days, default_role, requires_attachment, depends_on_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)

const t1steps = [
  ['สำรวจความต้องการฝึกอบรม', 'เก็บแบบสอบถามและสัมภาษณ์หัวหน้างาน', 7, 'HR', 1, null],
  ['วิเคราะห์ช่องว่างทักษะ', 'วิเคราะห์ผลสำรวจและจัดลำดับความสำคัญ', 5, 'HR', 1, 1],
  ['จัดทำแผนพัฒนาบุคลากร', 'จัดทำแผนฝึกอบรมและพัฒนารายบุคคล', 10, 'HR Manager', 1, 2],
  ['ขออนุมัติแผนและงบประมาณ', 'เสนอแผนและงบประมาณต่อผู้บริหาร', 5, 'HR Manager', 1, 3],
  ['คัดเลือกวิทยากร/ผู้ฝึกสอน', 'ติดต่อและคัดเลือกวิทยากร', 10, 'HR', 0, 4],
  ['ดำเนินการฝึกอบรม', 'จัดฝึกอบรมตามแผน', 14, 'HR', 1, 5],
  ['ประเมินผลหลังฝึกอบรม', 'ทดสอบความรู้และประเมินการนำไปใช้', 5, 'HR Manager', 1, 6],
  ['สรุปรายงานและข้อเสนอพัฒนา', 'สรุปผลและเสนอแนวทางพัฒนาต่อ', 7, 'HR Manager', 1, 7]
]
t1steps.forEach((s, i) => insTStep.run(t1, i + 1, s[0], s[1], s[2], s[3], s[4], s[5]))

// ---------- Template 2: Onboarding ----------
const t2 = db.prepare('INSERT INTO templates (name, description, category, created_by) VALUES (?, ?, ?, ?)')
  .run('กระบวนการ Onboarding พนักงานใหม่', 'ปฐมนิเทศ ติดตามผล และประเมินทดลองงานพนักงานใหม่', 'Onboarding', adminId).lastInsertRowid
const t2steps = [
  ['เตรียมเอกสารและอุปกรณ์', 'เตรียมสัญญา อุปกรณ์ และบัญชีผู้ใช้', 3, 'HR', 1, null],
  ['ปฐมนิเทศองค์กร', 'แนะนำวัฒนธรรมและนโยบายองค์กร', 2, 'HR', 1, 1],
  ['แนะนำทีมและระบบงาน', 'แนะนำเพื่อนร่วมงานและเครื่องมือที่ใช้', 3, 'Line Manager', 0, 2],
  ['ฝึกทักษะเฉพาะตำแหน่ง', 'อบรมและฝึกงานกับพี่เลี้ยง', 10, 'Line Manager', 1, 3],
  ['ติดตามผล 30 วัน', 'ติดตามการปรับตัวและให้ feedback', 5, 'HR', 1, 4],
  ['ประเมินและสรุปผลทดลองงาน', 'ประเมินผลทดลองงานและสรุปการแต่งตั้ง', 3, 'HR Manager', 1, 5]
]
t2steps.forEach((s, i) => insTStep.run(t2, i + 1, s[0], s[1], s[2], s[3], s[4], s[5]))

// ---------- helper to create project from template ----------
const todayISO = () => new Date().toISOString().slice(0, 10)
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10) }
const insProject = db.prepare(`INSERT INTO projects (code, name, template_id, template_version, manager_id, start_date, target_end_date, budget)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
const insPStep = db.prepare(`INSERT INTO project_steps (project_id, template_step_id, order_index, name, description, assignee_id, due_date, requires_attachment, status, depends_on_id, completed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

function createProject({ code, name, templateId, managerId, startDate, assignees, statuses = [], budget }) {
  const tsteps = db.prepare('SELECT * FROM template_steps WHERE template_id = ? ORDER BY order_index').all(templateId)
  const tpl = db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId)
  const pid = insProject.run(code, name, templateId, tpl.version, managerId, startDate, null, budget ?? null).lastInsertRowid
  const orderToId = {}
  let cursor = startDate
  const ids = []
  tsteps.forEach((ts, i) => {
    const due = addDays(cursor, ts.default_duration_days)
    const status = statuses[i] ?? 'Not Started'
    const completedAt = status === 'Done' ? new Date().toISOString() : null
    const sid = insPStep.run(pid, ts.id, ts.order_index, ts.name, ts.description, assignees[i] ?? null, due, ts.requires_attachment, status, null, completedAt).lastInsertRowid
    orderToId[ts.order_index] = sid
    ids.push(sid)
    cursor = due
  })
  const upd = db.prepare('UPDATE project_steps SET depends_on_id = ? WHERE id = ?')
  tsteps.forEach((ts) => { if (ts.depends_on_order && orderToId[ts.depends_on_order]) upd.run(orderToId[ts.depends_on_order], orderToId[ts.order_index]) })
  return { pid, ids }
}

// Project A: พัฒนาทักษะดิจิทัลพนักงาน (กำลังดำเนินการ + มีงานเลยกำหนด)
const startA = addDays(todayISO(), -40)
const A = createProject({
  code: 'HR-2569-001', name: 'โครงการพัฒนาทักษะดิจิทัลพนักงาน ปี 2569', templateId: t1, managerId: pmId,
  startDate: startA, budget: 1800000,
  assignees: [engId, engId, engId, pmId, engId, engId, pmId, pmId],
  statuses: ['Done', 'Done', 'In Progress', 'Not Started', 'Not Started', 'Not Started', 'Not Started', 'Not Started']
})
// make a step overdue for demo
const overdueStepId = A.ids[2]
db.prepare('UPDATE project_steps SET due_date = ? WHERE id = ?').run(addDays(todayISO(), -2), overdueStepId)
// keep later steps in the future so the demo shows realistic workload
;[3, 8, 14, 20, 26].forEach((d, i) => {
  db.prepare('UPDATE project_steps SET due_date = ? WHERE id = ?').run(addDays(todayISO(), d), A.ids[i + 3])
})
// checklist inside a step
const insChk = db.prepare('INSERT INTO checklist_items (project_step_id, label, is_done, order_index) VALUES (?, ?, ?, ?)')
insChk.run(A.ids[2], 'รวมผลสำรวจจากทุกแผนก', 1, 1)
insChk.run(A.ids[2], 'วิเคราะห์ช่องว่างทักษะ', 1, 2)
insChk.run(A.ids[2], 'จัดทำร่างแผนเสนอผู้บริหาร', 0, 3)

// Project B: ปรับปรุงกระบวนการ Onboarding (เพิ่งเริ่ม)
const B = createProject({
  code: 'HR-2569-002', name: 'ปรับปรุงกระบวนการ Onboarding พนักงานใหม่', templateId: t2, managerId: pmId,
  startDate: addDays(todayISO(), -5), budget: 450000,
  assignees: [engId, engId, procId, procId, engId, pmId],
  statuses: ['Done', 'In Progress', 'Not Started', 'Not Started', 'Not Started', 'Not Started']
})

// activity + notifications seed
const insAct = db.prepare('INSERT INTO activity_log (project_id, project_step_id, actor_id, action, from_value, to_value) VALUES (?, ?, ?, ?, ?, ?)')
insAct.run(A.pid, A.ids[0], engId, 'Status Change', 'In Progress', 'Done')
insAct.run(A.pid, A.ids[1], engId, 'Status Change', 'In Progress', 'Done')
insAct.run(A.pid, A.ids[2], engId, 'Status Change', 'Not Started', 'In Progress')

const insNotif = db.prepare('INSERT INTO notifications (user_id, type, title, body, link, is_read, email_sent) VALUES (?, ?, ?, ?, ?, ?, ?)')
insNotif.run(engId, 'Assigned', 'คุณได้รับมอบหมาย: จัดทำแผนพัฒนาบุคลากร', 'คุณได้รับมอบหมายขั้นตอน "จัดทำแผนพัฒนาบุคลากร" ในโครงการพัฒนาทักษะดิจิทัลพนักงาน', '/projects/' + A.pid, 0, 1)
insNotif.run(engId, 'Overdue', 'เลยกำหนด: จัดทำแผนพัฒนาบุคลากร', 'ขั้นตอน "จัดทำแผนพัฒนาบุคลากร" เลยกำหนดแล้ว', '/projects/' + A.pid, 0, 1)
insNotif.run(pmId, 'Status Changed', 'เตรียมเอกสารและอุปกรณ์ -> Done', 'ขั้นตอน "เตรียมเอกสารและอุปกรณ์" ในโครงการ Onboarding เสร็จสิ้น', '/projects/' + B.pid, 1, 1)

console.log('Seeded:')
console.log('  users:', userIds.length)
console.log('  templates: 2')
console.log('  projects: 2 (HR-2569-001, HR-2569-002)')
console.log('\nDemo login ids: admin=1, HR Manager=2, Training Officer=3, Line Manager=4, viewer=5')
