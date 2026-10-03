// Sends classroom invites over SMTP: any provider works (Gmail or Google Workspace with an app
// password, Outlook, Brevo, …). Email is optional: without the SMTP_* settings the faculty page
// prepares the invite for the teacher to send from their own email app instead.

import nodemailer from 'nodemailer'

// Providers cap recipients per message (Gmail: 100), so large lists go out in several messages.
const BATCH = 50

export const mailEnabled = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

let transport = null

function transporter() {
  const port = Number(process.env.SMTP_PORT || 587)
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  return transport
}

// Everyone goes in Bcc so students never see each other's addresses; replies go to the teacher.
export async function sendToMany({ senderName, replyTo, recipients, subject, text, html }) {
  const from = { name: senderName, address: process.env.MAIL_FROM || process.env.SMTP_USER }
  for (let i = 0; i < recipients.length; i += BATCH) {
    await transporter().sendMail({ from, to: from, replyTo, bcc: recipients.slice(i, i + BATCH), subject, text, html })
  }
}
