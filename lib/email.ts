import nodemailer from 'nodemailer'

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const from = process.env.SMTP_FROM ?? 'no-reply@fastlane.local'
  const transporter = getTransporter()

  await transporter.sendMail({
    from,
    to,
    subject: 'Reset your Fastlane Management password',
    text: `You requested a password reset.\n\nClick the link below to set a new password. This link expires in 1 hour and can only be used once.\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `
      <p>You requested a password reset.</p>
      <p>Click the link below to set a new password. This link expires in <strong>1 hour</strong> and can only be used once.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  })
}
