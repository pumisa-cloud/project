import cron from 'node-cron'
import { db } from './db.js'
import { notify } from './notify.js'

function daysUntil(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return Math.round((d - today) / 86400000)
}

/**
 * Scan all open steps and send alerts for due-soon (<=1 day) or overdue.
 * Mirrors the business rules in design-document.md section 8.
 */
export async function runDeadlineScan() {
  const steps = db
    .prepare(
      `SELECT s.*, p.name AS project_name, p.manager_id, p.id AS project_id
       FROM project_steps s
       JOIN projects p ON p.id = s.project_id
       WHERE s.status NOT IN ('Done', 'Skipped') AND s.due_date IS NOT NULL`
    )
    .all()

  for (const step of steps) {
    const diff = daysUntil(step.due_date)

    if (diff < 0) {
      // Overdue -> mark and alert assignee + manager
      if (step.status !== 'Overdue') {
        db.prepare(`UPDATE project_steps SET status = 'Overdue' WHERE id = ?`).run(step.id)
        db.prepare(
          `INSERT INTO activity_log (project_id, project_step_id, action, to_value)
           VALUES (?, ?, 'Auto Overdue', 'Overdue')`
        ).run(step.project_id, step.id)
      }
      if (step.assignee_id) {
        await notify({
          userId: step.assignee_id,
          type: 'Overdue',
          title: `เลยกำหนด: ${step.name}`,
          body: `ขั้นตอน "${step.name}" ในโครงการ ${step.project_name} เลยกำหนดเมื่อ ${step.due_date}`,
          link: `/projects/${step.project_id}`
        })
      }
      if (step.manager_id && step.manager_id !== step.assignee_id) {
        await notify({
          userId: step.manager_id,
          type: 'Overdue',
          title: `[PM] เลยกำหนด: ${step.name}`,
          body: `ขั้นตอน "${step.name}" ในโครงการ ${step.project_name} เลยกำหนด`,
          link: `/projects/${step.project_id}`
        })
      }
    } else if (diff <= 1) {
      if (step.assignee_id) {
        await notify({
          userId: step.assignee_id,
          type: 'Due Soon',
          title: `ใกล้ถึงกำหนด: ${step.name}`,
          body: `ขั้นตอน "${step.name}" ในโครงการ ${step.project_name} ครบกำหนดใน ${diff} วัน (${step.due_date})`,
          link: `/projects/${step.project_id}`
        })
      }
    }
  }
  return steps.length
}

export function startScheduler() {
  // every day at 08:00
  cron.schedule('0 8 * * *', () => {
    console.log('[scheduler] running deadline scan')
    runDeadlineScan().catch((e) => console.error(e))
  })
  console.log('[scheduler] started (daily 08:00 deadline scan)')
}
