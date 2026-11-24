import { db } from './db.js'
import { sendEmail } from './mailer.js'

let io = null
export function setIO(socketServer) {
  io = socketServer
}

/**
 * Create a notification for a user and push it in real-time (in-app)
 * plus send an email if the user opted in.
 */
export async function notify({ userId, type, title, body, link }) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  if (!user) return null

  const info = db
    .prepare(
      `INSERT INTO notifications (user_id, type, title, body, link, channel)
       VALUES (?, ?, ?, ?, ?, 'in-app')`
    )
    .run(userId, type, title, body ?? null, link ?? null)

  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(info.lastInsertRowid)

  // realtime in-app push
  if (io && user.notify_inapp) {
    io.to(`user:${userId}`).emit('notification', notification)
  }

  // email
  if (user.notify_email) {
    try {
      await sendEmail({ to: user.email, subject: title, text: body || title })
      db.prepare('UPDATE notifications SET email_sent = 1 WHERE id = ?').run(notification.id)
    } catch (err) {
      console.error('[notify] email failed', err.message)
    }
  }

  return notification
}
