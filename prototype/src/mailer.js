import nodemailer from 'nodemailer'

// In the prototype we do NOT send real email by default.
// Set EMAIL_DRY_RUN=false and provide SMTP_* env vars to send for real.
const DRY_RUN = process.env.EMAIL_DRY_RUN !== 'false'

export const mailer = DRY_RUN
  ? null
  : nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined
    })

export async function sendEmail({ to, subject, text }) {
  if (DRY_RUN) {
    console.log(`[EMAIL dry-run] to=${to} subject="${subject}" `)
    return { dryRun: true }
  }
  await mailer.sendMail({ from: process.env.SMTP_FROM || 'no-reply@example.com', to, subject, text })
  return { dryRun: false }
}
