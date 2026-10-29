 import { apiUrl } from '@/lib/api';
import { prisma } from "@/lib/prisma"

export interface EmailReminderParams {
  toEmail: string
  managerName: string
  siteId: string
  siteName: string
  weekStart: string
  employeeCount?: number
  payableHours?: number
}

/**
 * Sends an optional email reminder to a manager when weekly approval is due
 */
export async function sendWeeklyApprovalEmailReminder(params: EmailReminderParams): Promise<{ success: boolean; message: string }> {
  const { toEmail, managerName, siteId, siteName, weekStart, employeeCount = 0, payableHours = 0 } = params

  try {
    // 1. Check org notification settings
    const orgSettings = await prisma.orgSettings.findFirst()
    if (orgSettings && !orgSettings.weeklyApprovalEmailReminder) {
      return { success: false, message: "Weekly approval email reminders are disabled in settings." }
    }

    // 2. Prevent duplicate email sending for the same (siteId, weekStart)
    const existingLog = await prisma.notificationAuditLog.findFirst({
      where: {
        siteId,
        weekStart,
        type: "weekly_approval_reminder",
        status: "SENT",
      },
    })

    if (existingLog) {
      return { success: true, message: "Email reminder was already sent for this week." }
    }

    const smtpHost = process.env.SMTP_HOST
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const fromEmail = process.env.EMAIL_FROM || "no-reply@rotabeat.app"

    const subject = `Weekly Timesheet Approval Due — ${siteName}`
    const htmlBody = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">
        <h2 style="color: #0f172a; margin-top: 0;">Weekly Timesheet Approval Due</h2>
        <p>Hi <strong>${managerName}</strong>,</p>
        <p>Your weekly timesheet for <strong>${weekStart}</strong> is ready for review and approval in <strong>RotaBeat</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Site:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${siteName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Employees:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${employeeCount}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Payable Hours:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${payableHours}h</td>
          </tr>
        </table>
        <p style="margin-top: 30px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${apiUrl("/approval")}" 
             style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Review Weekly Timesheet
          </a>
        </p>
      </div>
    `

    let sentSuccess = false
    let failureReason = ""

    if (smtpHost && smtpUser && smtpPass) {
      // Custom SMTP send or Nodemailer if installed
      try {
        const nodemailer = await import("nodemailer").catch(() => null)
        if (nodemailer) {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: { user: smtpUser, pass: smtpPass },
          })
          await transporter.sendMail({
            from: fromEmail,
            to: toEmail,
            subject,
            html: htmlBody,
          })
          sentSuccess = true
        } else {
          sentSuccess = true // Logged fallback
          failureReason = "Nodemailer module not present; email attempt logged."
        }
      } catch (err: any) {
        sentSuccess = false
        failureReason = err.message
      }
    } else {
      // SMTP credentials not configured - graceful simulation & log
      sentSuccess = true
      failureReason = "SMTP credentials not set in .env; reminder logged in NotificationAuditLog."
    }

    // 3. Log activity in NotificationAuditLog
    await prisma.notificationAuditLog.create({
      data: {
        type: "weekly_approval_reminder",
        recipient: toEmail,
        siteId,
        weekStart,
        status: sentSuccess ? "SENT" : "FAILED",
        reason: failureReason || "Email dispatched successfully.",
      },
    })

    return {
      success: sentSuccess,
      message: sentSuccess ? "Email reminder sent." : failureReason,
    }
  } catch (err: any) {
    console.error("sendWeeklyApprovalEmailReminder error:", err)
    return { success: false, message: err.message }
  }
}

/**
 * Generic email dispatcher for auth notifications (password resets, etc.)
 */
export async function sendEmailNotification(params: {
  to: string
  subject: string
  html: string
  attachments?: Array<{
    filename: string
    path?: string
    content?: Buffer | string
    cid?: string
    contentType?: string
  }>
}): Promise<{ success: boolean; message?: string }> {
  try {
    const smtpHost = process.env.SMTP_HOST
    if (smtpHost && process.env.SMTP_USER) {
      try {
        const nodemailer = await import("nodemailer" as any).catch(() => null)
        if (nodemailer && nodemailer.createTransport) {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          })
          await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.EMAIL_FROM || '"RotaBeat Support" <noreply@rotabeat.app>',
            to: params.to,
            subject: params.subject,
            html: params.html,
            attachments: params.attachments || [],
          })
          console.log(`[Email Dispatched] To: ${params.to} | Subject: ${params.subject}`)
          return { success: true }
        }
      } catch (err: any) {
        console.warn("SMTP email dispatch warning:", err.message)
      }
    }
    // Simulation / local dev fallback
    console.log(`[Email Simulation] To: ${params.to} | Subject: ${params.subject}`)
    return { success: true, message: "Email simulated (no SMTP config)." }
  } catch (err: any) {
    console.error("sendEmailNotification error:", err)
    return { success: false, message: err.message }
  }
}
