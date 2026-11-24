import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { Badge, Progress, fmtDate } from './ui'

const STEP_STATUSES = ['Not Started', 'In Progress', 'Blocked', 'Done', 'Skipped']
const PROJECT_STATUSES = ['Active', 'On Hold', 'Completed', 'Cancelled']
const NAV = [
  { key: 'dashboard', label: 'ภาพรวม', icon: '▦' },
  { key: 'projects', label: 'โครงการ', icon: '▤' },
  { key: 'templates', label: 'แม่แบบกระบวนการ', icon: '⚙' },
  { key: 'tasks', label: 'งานของฉัน', icon: '✓' },
  { key: 'notifications', label: 'การแจ้งเตือน', icon: '🔔' }
]

const today = () => new Date().toISOString().slice(0, 10)
const isOverdue = (s) => s && !['Done', 'Skipped'].includes(s.status) && s.due_date && s.due_date < today()

function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/dashboard')
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || '#/dashboard')
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  return { page: parts[0] || 'dashboard', id: parts[1] }
}

const go = (path) => { window.location.hash = '#/' + path }

export default function App() {
  const { page, id } = useRoute()
  const [users, setUsers] = useState([])
  const [currentUserId, setCurrentUserId] = useState(() => Number(localStorage.getItem('pcs-user') || 2))
  const [notifications, setNotifications] = useState([])
  const [toasts, setToasts] = useState([])
  const [revision, setRevision] = useState(0)

  const toast = useCallback((title, body, kind = 'ok') => {
    const item = { id: Date.now() + Math.random(), title, body, kind }
    setToasts((prev) => [...prev, item])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== item.id)), 4500)
  }, [])

  const refreshNotifications = useCallback(async () => {
    try { setNotifications(await api.notifications(currentUserId)) } catch { /* silent */ }
  }, [currentUserId])

  const refreshAll = useCallback(() => setRevision((r) => r + 1), [])

  useEffect(() => { api.users().then(setUsers).catch((e) => toast('โหลดผู้ใช้ไม่สำเร็จ', e.message, 'err')) }, [])
  useEffect(() => {
    localStorage.setItem('pcs-user', String(currentUserId))
    refreshNotifications()
    const timer = setInterval(refreshNotifications, 15000)
    return () => clearInterval(timer)
  }, [currentUserId, refreshNotifications])
  useEffect(() => { refreshNotifications() }, [revision, refreshNotifications])

  const unread = notifications.filter((n) => !n.is_read).length
  const currentUser = users.find((u) => u.id === currentUserId)
  const shared = { users, currentUserId, toast, refreshAll, revision, refreshNotifications }

  const runScan = async () => {
    try {
      const r = await api.runScan()
      toast('สแกนกำหนดเวลาแล้ว', `ตรวจสอบ ${r.scanned} ขั้นตอน`, 'ok')
      refreshAll(); refreshNotifications()
    } catch (e) { toast('สแกนไม่สำเร็จ', e.message, 'err') }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>📋 Project Checklist</h1>
        {NAV.map((n) => (
          <a key={n.key} href={`#/${n.key}`} className={page === n.key ? 'active' : ''}>
            <span>{n.icon} {n.label}</span>
            {n.key === 'notifications' && unread > 0 && <span className="navcount">{unread}</span>}
          </a>
        ))}
        <div className="userbox">
          <div>ใช้งานในนาม</div>
          <select value={currentUserId} onChange={(e) => setCurrentUserId(Number(e.target.value))}>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
        </div>
        <button className="btn ghost small scan-btn" onClick={runScan}>รันสแกนกำหนดเวลา (demo)</button>
      </aside>

      <main className="main">
        {page === 'dashboard' && <Dashboard {...shared} />}
        {page === 'projects' && !id && <Projects {...shared} />}
        {page === 'projects' && id && <ProjectDetail {...shared} projectId={Number(id)} />}
        {page === 'templates' && <Templates {...shared} />}
        {page === 'tasks' && <MyTasks {...shared} />}
        {page === 'notifications' && (
          <NotificationCenter {...shared} notifications={notifications} currentUser={currentUser}
            setUsers={setUsers} />
        )}
      </main>

      <div className="toasts">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}><b>{t.title}</b>{t.body}</div>)}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Dashboard
function Dashboard({ users, currentUserId, revision, toast }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    api.dashboard().then(setData).catch((e) => toast('โหลดภาพรวมไม่สำเร็จ', e.message, 'err'))
  }, [revision, toast])
  if (!data) return <p className="empty">กำลังโหลด...</p>
  const { summary, upcoming } = data

  return (
    <>
      <h1 className="page-title">ภาพรวมโครงการ</h1>
      <p className="page-sub">สถานะล่าสุดของทุกโครงการและกำหนดส่งที่ใกล้เข้ามา</p>
      <div className="hint">ต้นแบบ: ใช้เมนู “รันสแกนกำหนดเวลา” เพื่อจำลองการทำงานของ scheduler (ทุกวัน 08:00 น.)</div>
      <div className="stats">
        <Stat num={summary.projects_active} label="โครงการที่รันอยู่" tone="blue" />
        <Stat num={summary.steps_done} label={`ขั้นตอนเสร็จแล้ว / ${summary.steps_total}`} tone="green" />
        <Stat num={summary.overdue} label="เลยกำหนด" tone="red" />
        <Stat num={summary.due_soon} label="ใกล้ถึงกำหนด (3 วัน)" tone="amber" />
      </div>
      <div className="card">
        <h2>กำหนดส่งที่จะถึงเร็วๆ นี้</h2>
        {upcoming.length === 0 ? <div className="empty">ไม่มีงานที่รอดำเนินการ</div> : (
          <table>
            <thead><tr><th>ขั้นตอน</th><th>โครงการ</th><th>ผู้รับผิดชอบ</th><th>กำหนดส่ง</th><th>สถานะ</th></tr></thead>
            <tbody>{upcoming.map((s) => (
              <tr key={s.id} className="clickable" onClick={() => go(`projects/${s.project_id}`)}>
                <td>{s.name}</td><td>{s.project_name}</td>
                <td>{users.find((u) => u.id === s.assignee_id)?.name || '-'}</td>
                <td style={{ color: isOverdue(s) ? 'var(--red)' : undefined }}>{fmtDate(s.due_date)}</td>
                <td><Badge status={s.status} /></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  )
}

function Stat({ num, label, tone }) {
  return <div className={`stat ${tone || ''}`}><div className="num">{num}</div><div className="label">{label}</div></div>
}

// ---------------------------------------------------------------- Projects
function Projects({ users, revision, toast, refreshAll }) {
  const [projects, setProjects] = useState([])
  const [templates, setTemplates] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', template_id: '', manager_id: '', start_date: today(), budget: '' })

  const load = useCallback(() => {
    api.projects().then(setProjects).catch((e) => toast('โหลดโครงการไม่สำเร็จ', e.message, 'err'))
    api.templates().then(setTemplates).catch(() => {})
  }, [toast])
  useEffect(() => { load() }, [load, revision])

  const create = async (e) => {
    e.preventDefault()
    try {
      const p = await api.createProject({
        name: form.name, code: form.code || undefined,
        template_id: Number(form.template_id), manager_id: form.manager_id ? Number(form.manager_id) : null,
        start_date: form.start_date, budget: form.budget ? Number(form.budget) : null
      })
      toast('สร้างโครงการแล้ว', 'ระบบสร้างขั้นตอนจากแม่แบบให้อัตโนมัติ')
      setShowForm(false)
      refreshAll(); load()
      go(`projects/${p.id}`)
    } catch (err) { toast('สร้างโครงการไม่สำเร็จ', err.message, 'err') }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">โครงการ</h1>
          <p className="page-sub">สร้างโครงการจากแม่แบบ กำหนดผู้รับผิดชอบ และติดตามความคืบหน้า</p>
        </div>
        <button className="btn" onClick={() => setShowForm((v) => !v)}>+ สร้างโครงการ</button>
      </div>

      {showForm && (
        <form className="card" onSubmit={create}>
          <h2>สร้างโครงการใหม่จากแม่แบบ</h2>
          <div className="form-row">
            <div><label className="field">ชื่อโครงการ</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="field">รหัสโครงการ</label><input placeholder="PRJ-2569-003" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div><label className="field">แม่แบบกระบวนการ</label>
              <select required value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })}>
                <option value="">-- เลือกแม่แบบ --</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}
              </select>
            </div>
            <div><label className="field">ผู้จัดการโครงการ</label>
              <select value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
                <option value="">-- ไม่ระบุ --</option>
                {users.filter((u) => ['Project Manager', 'Admin'].includes(u.role)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div><label className="field">วันเริ่ม</label><input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><label className="field">งบประมาณ</label><input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
          </div>
          <button className="btn" type="submit">สร้างโครงการ</button>
        </form>
      )}

      <div className="card">
        <table>
          <thead><tr><th>รหัส</th><th>ชื่อโครงการ</th><th>แม่แบบ</th><th>ผู้จัดการ</th><th>ความคืบหน้า</th><th>สถานะ</th><th>เป้าหมาย</th></tr></thead>
          <tbody>{projects.map((p) => (
            <tr key={p.id} className="clickable" onClick={() => go(`projects/${p.id}`)}>
              <td>{p.code}</td><td><b>{p.name}</b></td><td>{p.template_name || '-'}</td>
              <td>{p.manager_name || '-'}</td><td><Progress value={p.progress} green={p.progress === 100} /></td>
              <td><Badge status={p.status} /></td><td>{fmtDate(p.target_end_date)}</td>
            </tr>
          ))}</tbody>
        </table>
        {projects.length === 0 && <div className="empty">ยังไม่มีโครงการ</div>}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- Project detail
function ProjectDetail({ projectId, users, currentUserId, revision, toast, refreshAll }) {
  const [project, setProject] = useState(null)
  const [activity, setActivity] = useState([])
  const [tab, setTab] = useState('checklist')

  const load = useCallback(() => {
    api.project(projectId).then(setProject).catch((e) => toast('โหลดโครงการไม่สำเร็จ', e.message, 'err'))
    api.activity(projectId).then(setActivity).catch(() => {})
  }, [projectId, toast])
  useEffect(() => { load() }, [load, revision])

  if (!project) return <p className="empty">กำลังโหลด...</p>

  const stepById = Object.fromEntries(project.steps.map((s) => [s.id, s]))
  const setStepStatus = async (step, status) => {
    try {
      await api.updateStep(step.id, { status, actor_id: currentUserId })
      toast('อัปเดตสถานะแล้ว', `${step.name} → ${status}`)
      refreshAll(); load()
    } catch (e) { toast('อัปเดตไม่สำเร็จ', e.message, 'err') }
  }
  const changeProjectStatus = async (status) => {
    try {
      await api.updateProject(projectId, { status })
      toast('อัปเดตโครงการแล้ว', status); refreshAll(); load()
    } catch (e) { toast('อัปเดตไม่สำเร็จ', e.message, 'err') }
  }

  const groups = {
    checklist: project.steps,
    'kanban': project.steps,
    'activity': project.steps
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="crumb"><a href="#/projects">โครงการ</a> / {project.code}</p>
          <h1 className="page-title">{project.name}</h1>
          <p className="page-sub">แม่แบบ: {project.template_name || '-'} · ผู้จัดการ: {project.manager_name || '-'} · เริ่ม {fmtDate(project.start_date)}</p>
        </div>
        <div className="head-actions">
          <label className="field">สถานะโครงการ</label>
          <select value={project.status} onChange={(e) => changeProjectStatus(e.target.value)}>
            {PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="card project-progress">
        <div className="progress big"><div style={{ width: project.progress + '%' }} /></div>
        <div><b>{project.progress}%</b> เสร็จแล้ว ({project.steps.filter((s) => ['Done', 'Skipped'].includes(s.status)).length}/{project.steps.length} ขั้นตอน)</div>
      </div>

      <div className="tabs">
        {[['checklist', 'Checklist'], ['kanban', 'Kanban'], ['activity', 'ประวัติการดำเนินงาน']].map(([k, label]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'checklist' && (
        <div>
          {groups.checklist.map((s) => {
            const dep = s.depends_on_id ? stepById[s.depends_on_id] : null
            const blocked = dep && !['Done', 'Skipped'].includes(dep.status)
            return (
              <StepCard key={s.id} step={s} dep={dep} blocked={blocked} users={users}
                currentUserId={currentUserId} onStatus={setStepStatus} toast={toast}
                refreshAll={refreshAll} />
            )
          })}
        </div>
      )}

      {tab === 'kanban' && (
        <div className="kanban">
          {['Not Started', 'In Progress', 'Blocked', 'Done'].map((col) => (
            <div key={col} className="kanban-col">
              <div className="kanban-col-head"><Badge status={col} /> <span className="chip">{groups.kanban.filter((s) => s.status === col || (col === 'Blocked' && !!s.depends_on_id && !['Done', 'Skipped'].includes(stepById[s.depends_on_id]?.status))).length}</span></div>
              {groups.kanban.filter((s) => s.status === col).map((s) => (
                <div key={s.id} className="kanban-card" onClick={() => go(`projects/${projectId}`)}>
                  <b>{s.order_index}. {s.name}</b>
                  <div className="step-meta"><span>👤 {users.find((u) => u.id === s.assignee_id)?.name || 'ยังไม่กำหนด'}</span><span>📅 {fmtDate(s.due_date)}</span></div>
                  <div className="kanban-move">
                    {STEP_STATUSES.filter((x) => x !== s.status).map((x) => (
                      <button key={x} className="btn ghost small" onClick={(e) => { e.stopPropagation(); setStepStatus(s, x) }}>{x}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === 'activity' && (
        <div className="card">
          <h2>ประวัติการเปลี่ยนแปลง (Audit trail)</h2>
          {activity.length === 0 && <div className="empty">ยังไม่มีประวัติ</div>}
          {activity.map((a) => (
            <div key={a.id} className="activity-row">
              <span className="chip">{fmtDate(a.created_at)}</span>
              <b>{a.actor_name || 'ระบบ'}</b> {a.action}
              {a.from_value && <> <span className="muted">({a.from_value} → {a.to_value})</span></>}
              {!a.from_value && a.to_value && <> <span className="muted">({a.to_value})</span></>}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function StepCard({ step, dep, blocked, users, currentUserId, onStatus, toast, refreshAll }) {
  const [detail, setDetail] = useState(null)
  const [newItem, setNewItem] = useState('')
  const [assignee, setAssignee] = useState(step.assignee_id || '')
  const [due, setDue] = useState(step.due_date || '')

  const loadDetail = () => api.step(step.id).then(setDetail).catch((e) => toast('โหลดขั้นตอนไม่สำเร็จ', e.message, 'err'))
  useEffect(() => { setAssignee(step.assignee_id || ''); setDue(step.due_date || '') }, [step.assignee_id, step.due_date])

  const saveAssignment = async () => {
    try {
      await api.updateStep(step.id, {
        assignee_id: assignee ? Number(assignee) : null,
        due_date: due || null,
        actor_id: currentUserId
      })
      toast('บันทึกผู้รับผิดชอบ/กำหนดส่งแล้ว', step.name)
      refreshAll()
    } catch (e) { toast('บันทึกไม่สำเร็จ', e.message, 'err') }
  }

  const addItem = async (e) => {
    e.preventDefault()
    if (!newItem.trim()) return
    try {
      await api.addChecklist(step.id, { label: newItem.trim() })
      setNewItem(''); loadDetail()
    } catch (err) { toast('เพิ่มรายการไม่สำเร็จ', err.message, 'err') }
  }
  const toggleItem = async (item) => {
    try {
      await api.toggleChecklist(item.id, { is_done: !item.is_done })
      loadDetail()
    } catch (err) { toast('อัปเดตรายการไม่สำเร็จ', err.message, 'err') }
  }

  return (
    <div className={`step ${blocked ? 'blocked' : ''}`}>
      <div className="step-head">
        <div>
          <h3>{step.order_index}. {step.name} <Badge status={step.status} />{isOverdue(step) && <Badge status="Overdue" />}</h3>
          {step.description && <div className="muted small">{step.description}</div>}
          <div className="step-meta">
            <span>👤 {users.find((u) => u.id === step.assignee_id)?.name || 'ยังไม่กำหนด'}</span>
            <span>📅 {fmtDate(step.due_date)}</span>
            {step.requires_attachment ? <span>📎 ต้องแนบหลักฐาน</span> : <span>ไม่บังคับหลักฐาน</span>}
            {dep && <span>🔗 ขึ้นกับ: {dep.name}</span>}
          </div>
        </div>
        <div className="step-actions">
          <button className="btn ghost small" onClick={() => detail ? setDetail(null) : loadDetail()}>
            {detail ? 'ซ่อนรายการย่อย' : 'รายการย่อย'}
          </button>
          <select value={step.status} disabled={!!blocked} onChange={(e) => onStatus(step, e.target.value)}>
            {STEP_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {blocked && <div className="blocked-note">⛔ รอขั้นตอนก่อนหน้าให้เสร็จก่อน: <b>{dep.name}</b></div>}
      <div className="form-row assign-row">
        <div>
          <label className="field">ผู้รับผิดชอบ</label>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">-- ยังไม่กำหนด --</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}
          </select>
        </div>
        <div><label className="field">กำหนดส่ง</label><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        <div className="save-cell"><button className="btn secondary small" onClick={saveAssignment}>บันทึก</button></div>
      </div>
      {detail && (
        <div className="subchecklist">
          <div className="muted small">รายการย่อยในขั้นตอน</div>
          {detail.checklist?.length === 0 && <div className="empty">ยังไม่มีรายการย่อย</div>}
          {detail.checklist?.map((item) => (
            <label key={item.id} className="checklist-item">
              <input type="checkbox" checked={!!item.is_done} onChange={() => toggleItem(item)} />
              <span style={{ textDecoration: item.is_done ? 'line-through' : undefined }}>{item.label}</span>
            </label>
          ))}
          <form className="inline-form" onSubmit={addItem}>
            <input placeholder="เพิ่มรายการย่อย..." value={newItem} onChange={(e) => setNewItem(e.target.value)} />
            <button className="btn small" type="submit">เพิ่ม</button>
          </form>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Templates
function Templates({ revision, toast, refreshAll }) {
  const [templates, setTemplates] = useState([])
  const [open, setOpen] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', category: '', description: '', steps: [{ name: '', days: 1, role: '', attachment: true, depends_on_order: '' }] })

  const load = useCallback(() => {
    api.templates().then(setTemplates).catch((e) => toast('โหลดแม่แบบไม่สำเร็จ', e.message, 'err'))
  }, [toast])
  useEffect(() => { load() }, [load, revision])

  const updateStep = (i, key, value) => {
    const steps = [...form.steps]; steps[i] = { ...steps[i], [key]: value }; setForm({ ...form, steps })
  }
  const create = async (e) => {
    e.preventDefault()
    try {
      await api.createTemplate({
        name: form.name, category: form.category, description: form.description,
        steps: form.steps.filter((s) => s.name.trim()).map((s) => ({
          name: s.name.trim(), default_duration_days: Number(s.days) || 1,
          default_role: s.role || null, requires_attachment: !!s.attachment,
          depends_on_order: s.depends_on_order ? Number(s.depends_on_order) : null
        }))
      })
      toast('สร้างแม่แบบแล้ว', 'สามารถนำไปใช้สร้างโครงการได้ทันที')
      setShowForm(false); setForm({ name: '', category: '', description: '', steps: [{ name: '', days: 1, role: '', attachment: true, depends_on_order: '' }] })
      refreshAll(); load()
    } catch (err) { toast('สร้างแม่แบบไม่สำเร็จ', err.message, 'err') }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">แม่แบบกระบวนการ</h1>
          <p className="page-sub">กำหนดขั้นตอนมาตรฐาน ระยะเวลา ผู้รับผิดชอบ และการพึ่งพาขั้นตอน</p>
        </div>
        <button className="btn" onClick={() => setShowForm((v) => !v)}>+ สร้างแม่แบบ</button>
      </div>

      {showForm && (
        <form className="card" onSubmit={create}>
          <h2>แม่แบบใหม่</h2>
          <div className="form-row">
            <div><label className="field">ชื่อแม่แบบ</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="field">ประเภท</label><input placeholder="IT / Construction / Procurement" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
          </div>
          <div><label className="field">คำอธิบาย</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <h2 className="section-title">ขั้นตอน</h2>
          <table className="step-table">
            <thead><tr><th>#</th><th>ชื่อขั้นตอน</th><th>วัน</th><th>บทบาท</th><th>แนบหลักฐาน</th><th>ขึ้นกับขั้นตอนที่</th><th></th></tr></thead>
            <tbody>{form.steps.map((s, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><input required value={s.name} onChange={(e) => updateStep(i, 'name', e.target.value)} /></td>
                <td><input type="number" min="1" style={{ width: 70 }} value={s.days} onChange={(e) => updateStep(i, 'days', e.target.value)} /></td>
                <td><input placeholder="PM / Engineering" value={s.role} onChange={(e) => updateStep(i, 'role', e.target.value)} /></td>
                <td><input type="checkbox" checked={s.attachment} onChange={(e) => updateStep(i, 'attachment', e.target.checked)} /></td>
                <td><input type="number" min="1" style={{ width: 70 }} value={s.depends_on_order} onChange={(e) => updateStep(i, 'depends_on_order', e.target.value)} /></td>
                <td><button type="button" className="btn ghost small" onClick={() => setForm({ ...form, steps: form.steps.filter((_, j) => j !== i) })}>ลบ</button></td>
              </tr>
            ))}</tbody>
          </table>
          <button type="button" className="btn secondary small" onClick={() => setForm({ ...form, steps: [...form.steps, { name: '', days: 1, role: '', attachment: true, depends_on_order: '' }] })}>+ เพิ่มขั้นตอน</button>
          <div className="form-actions"><button className="btn" type="submit">บันทึกแม่แบบ</button></div>
        </form>
      )}

      {templates.map((t) => (
        <div key={t.id} className="card">
          <div className="page-head">
            <div><h2>{t.name} <span className="chip">v{t.version}</span> <span className="chip">{t.category || 'ทั่วไป'}</span></h2><div className="muted small">{t.description}</div></div>
            <button className="btn ghost small" onClick={() => setOpen(open === t.id ? null : t.id)}>{open === t.id ? 'ซ่อนขั้นตอน' : 'ดูขั้นตอน'}</button>
          </div>
          {open === t.id && (
            <table className="step-table">
              <thead><tr><th>#</th><th>ขั้นตอน</th><th>ระยะเวลา</th><th>บทบาท</th><th>หลักฐาน</th><th>ขึ้นกับ</th></tr></thead>
              <tbody>{t.steps.map((s) => (
                <tr key={s.id}><td>{s.order_index}</td><td>{s.name}</td><td>{s.default_duration_days} วัน</td><td>{s.default_role || '-'}</td>
                  <td>{s.requires_attachment ? 'บังคับ' : 'ไม่บังคับ'}</td><td>{s.depends_on_order ? `ขั้นตอนที่ ${s.depends_on_order}` : '-'}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      ))}
    </>
  )
}

// ---------------------------------------------------------------- My tasks
function MyTasks({ users, currentUserId, revision, toast, refreshAll }) {
  const [tasks, setTasks] = useState([])
  const [filter, setFilter] = useState('all')
  const load = useCallback(() => {
    api.tasks(currentUserId).then(setTasks).catch((e) => toast('โหลดงานไม่สำเร็จ', e.message, 'err'))
  }, [currentUserId, toast])
  useEffect(() => { load() }, [load, revision])
  const me = users.find((u) => u.id === currentUserId)
  const visible = tasks.filter((t) => filter === 'all' || (filter === 'overdue' && isOverdue(t)) ||
    (filter === 'soon' && t.due_date >= today() && t.due_date <= new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) && !['Done', 'Skipped'].includes(t.status)))

  const quickDone = async (task) => {
    try {
      await api.updateStep(task.id, { status: 'Done', actor_id: currentUserId })
      toast('ทำขั้นตอนเสร็จแล้ว', task.name); refreshAll(); load()
    } catch (e) { toast('อัปเดตไม่สำเร็จ', e.message, 'err') }
  }

  return (
    <>
      <h1 className="page-title">งานของฉัน</h1>
      <p className="page-sub">งานที่มอบหมายให้ {me?.name || 'คุณ'} จากทุกโครงการ</p>
      <div className="tabs">
        {[['all', 'ทั้งหมด'], ['soon', 'ใกล้กำหนด 3 วัน'], ['overdue', 'เลยกำหนด']].map(([k, l]) => (
          <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      <div className="card">
        {visible.length === 0 && <div className="empty">ไม่มีงานในกลุ่มนี้</div>}
        {visible.map((t) => (
          <div key={t.id} className="task-row">
            <div>
              <b className="clickable" onClick={() => go(`projects/${t.project_id}`)}>{t.name}</b>
              <div className="step-meta"><span>📁 {t.project_name}</span><span className={isOverdue(t) ? 'danger' : ''}>📅 {fmtDate(t.due_date)}</span></div>
            </div>
            <div className="step-actions">
              <Badge status={t.status} />
              {t.status !== 'Done' && <button className="btn small" onClick={() => quickDone(t)}>ทำเสร็จ</button>}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- Notifications
function NotificationCenter({ notifications, currentUser, setUsers, toast, refreshNotifications }) {
  const markRead = async (id) => {
    try { await api.readNotification(id); refreshNotifications() }
    catch (e) { toast('อัปเดตไม่สำเร็จ', e.message, 'err') }
  }
  const markAll = async () => {
    if (!currentUser) return
    try { await api.readAll(currentUser.id); refreshNotifications(); toast('อ่านทั้งหมดแล้ว', '') }
    catch (e) { toast('อัปเดตไม่สำเร็จ', e.message, 'err') }
  }
  const togglePref = async (key, value) => {
    try {
      const updated = await api.updateUser(currentUser.id, { [key]: value ? 1 : 0 })
      setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u))
    } catch (e) { toast('บันทึกการตั้งค่าไม่สำเร็จ', e.message, 'err') }
  }

  return (
    <>
      <div className="page-head">
        <div><h1 className="page-title">การแจ้งเตือน</h1><p className="page-sub">แจ้งเตือนในแอปแบบ real-time และอีเมล (ต้นแบบใช้ dry-run)</p></div>
        <button className="btn secondary" onClick={markAll}>อ่านทั้งหมด</button>
      </div>
      {currentUser && (
        <div className="card prefs">
          <h2>การตั้งค่าการรับการแจ้งเตือนของ {currentUser.name}</h2>
          <label className="checklist-item"><input type="checkbox" checked={!!currentUser.notify_inapp} onChange={(e) => togglePref('notify_inapp', e.target.checked)} /> แจ้งเตือนในแอป</label>
          <label className="checklist-item"><input type="checkbox" checked={!!currentUser.notify_email} onChange={(e) => togglePref('notify_email', e.target.checked)} /> ส่งอีเมล</label>
        </div>
      )}
      <div className="card">
        {notifications.length === 0 && <div className="empty">ยังไม่มีการแจ้งเตือน</div>}
        {notifications.map((n) => (
          <div key={n.id} className={`notif ${n.is_read ? 'read' : 'unread'}`}>
            <span className="dot" />
            <div style={{ flex: 1 }}>
              <div><b>{n.title}</b> <span className="chip">{n.type}</span></div>
              {n.body && <div className="body">{n.body}</div>}
              <div className="time">{fmtDate(n.created_at)} · ช่องทาง: {n.channel}{n.email_sent ? ' + email' : ''}</div>
            </div>
            {!n.is_read && <button className="btn ghost small" onClick={() => markRead(n.id)}>ทำเครื่องหมายอ่าน</button>}
          </div>
        ))}
      </div>
    </>
  )
}
