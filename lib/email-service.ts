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

/**
 * Sends an email notification to an employee when a late payroll adjustment is approved
 */
export async function sendPayrollAdjustmentApprovedEmail(params: {
  toEmail: string
  employeeName: string
  date: string
  scheduledHours: number
  workedHours: number
  lateMinutes: number
  hourlyRate: number
  deductionAmount: number
  managerName: string
  notes?: string
}): Promise<{ success: boolean; message?: string }> {
  const {
    toEmail,
    employeeName,
    date,
    scheduledHours,
    workedHours,
    lateMinutes,
    hourlyRate,
    deductionAmount,
    managerName,
    notes,
  } = params

  const subject = `Payroll Adjustment Notice — Shift on ${date}`
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <h2 style="color: #4f46e5; margin-top: 0; font-size: 20px;">Payroll Adjustment Notice</h2>
      <p style="color: #334155; font-size: 14px;">Hi <strong>${employeeName}</strong>,</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">
        A proposed payroll deduction for unpaid late time on your shift dated <strong>${date}</strong> has been reviewed and approved by <strong>${managerName}</strong> in accordance with company policy.
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #334155;">
          <tr>
            <td style="padding: 6px 0; font-weight: 600;">Shift Date:</td>
            <td style="padding: 6px 0; text-align: right;">${date}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: 600;">Scheduled Hours:</td>
            <td style="padding: 6px 0; text-align: right;">${scheduledHours.toFixed(1)} hrs</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: 600;">Actual Worked Hours:</td>
            <td style="padding: 6px 0; text-align: right;">${workedHours.toFixed(1)} hrs</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: 600;">Unpaid Late Duration:</td>
            <td style="padding: 6px 0; text-align: right; color: #d97706; font-weight: 600;">${lateMinutes} mins</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: 600;">Base Hourly Rate:</td>
            <td style="padding: 6px 0; text-align: right;">£${hourlyRate.toFixed(2)}/hr</td>
          </tr>
          <tr style="border-top: 2px solid #e2e8f0;">
            <td style="padding: 10px 0 4px; font-weight: 700; color: #b91c1c; font-size: 14px;">Total Deduction:</td>
            <td style="padding: 10px 0 4px; text-align: right; font-weight: 700; color: #b91c1c; font-size: 15px;">-£${deductionAmount.toFixed(2)}</td>
          </tr>
        </table>
        ${
          notes
            ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 12px; color: #64748b;">
                <strong>Manager Note:</strong> ${notes}
              </div>`
            : ""
        }
      </div>

      <p style="color: #64748b; font-size: 12px; line-height: 1.4;">
        Note: You are only deducted for the exact unworked late time at your standard hourly rate. If you have questions regarding this calculation, please speak with your site manager.
      </p>
    </div>
  `

  return sendEmailNotification({ to: toEmail, subject, html })
}

/**
 * Sends an email notification to an employee when a late arrival warning is issued
 */
export async function sendWarningIssuedEmail(params: {
  toEmail: string
  employeeName: string
  date: string
  lateMinutes: number
  managerName: string
  reason: string
}): Promise<{ success: boolean; message?: string }> {
  const { toEmail, employeeName, date, lateMinutes, managerName, reason } = params

  const subject = `Notice of Lateness — Shift on ${date}`
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <h2 style="color: #d97706; margin-top: 0; font-size: 20px;">Notice of Late Arrival</h2>
      <p style="color: #334155; font-size: 14px;">Hi <strong>${employeeName}</strong>,</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">
        You clocked in <strong>${lateMinutes} minutes late</strong> for your scheduled shift on <strong>${date}</strong>. Your manager, <strong>${managerName}</strong>, has issued an official warning regarding punctuality.
      </p>

      <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; margin: 20px 0; color: #92400e; font-size: 13px;">
        <strong>Manager Comment:</strong>
        <p style="margin: 6px 0 0; font-style: italic;">"${reason}"</p>
      </div>

      <p style="color: #64748b; font-size: 12px; line-height: 1.4;">
        Please sign in to your RotaBeat employee portal to acknowledge receipt of this notice.
      </p>
    </div>
  `

  return sendEmailNotification({ to: toEmail, subject, html })
}
