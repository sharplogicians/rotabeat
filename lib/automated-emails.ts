import fs from "fs"
import path from "path"
import { prisma } from "@/lib/prisma"
import { sendEmailNotification } from "@/lib/email-service"
import {
  getTodayIso,
  addDays,
  formatDateLong,
  formatWeekRange,
  weekDays,
} from "@/lib/date-utils"
import { scheduledMinutes } from "@/lib/calc"

export interface BrandEmailAssets {
  attachments: Array<{
    filename: string
    path?: string
    cid?: string
    contentType?: string
  }>
  logoSrc: string
  iconSrc: string
  appBase: string
}

export function getBrandEmailAssets(): BrandEmailAssets {
  const logoPath = path.join(process.cwd(), "public", "brand", "rotabeat-logo-trimmed.png")
  const iconPath = path.join(process.cwd(), "public", "brand", "rotabeat-icon-trimmed.png")

  const attachments: Array<{
    filename: string
    path?: string
    cid?: string
    contentType?: string
  }> = []

  let logoDataUri = ""
  let iconDataUri = ""

  if (fs.existsSync(logoPath)) {
    const logoBuf = fs.readFileSync(logoPath)
    logoDataUri = `data:image/png;base64,${logoBuf.toString("base64")}`
    attachments.push({
      filename: "rotabeat-logo.png",
      path: logoPath,
      cid: "rotabeat-logo",
      contentType: "image/png",
    })
  }

  if (fs.existsSync(iconPath)) {
    const iconBuf = fs.readFileSync(iconPath)
    iconDataUri = `data:image/png;base64,${iconBuf.toString("base64")}`
    attachments.push({
      filename: "rotabeat-icon.png",
      path: iconPath,
      cid: "rotabeat-icon",
      contentType: "image/png",
    })
  }

  const appBase = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000"
  const logoSrc = attachments.some((a) => a.cid === "rotabeat-logo")
    ? "cid:rotabeat-logo"
    : logoDataUri || `${appBase}/brand/rotabeat-logo-trimmed.png`
  const iconSrc = attachments.some((a) => a.cid === "rotabeat-icon")
    ? "cid:rotabeat-icon"
    : iconDataUri || `${appBase}/brand/rotabeat-icon-trimmed.png`

  return { attachments, logoSrc, iconSrc, appBase }
}

/**
 * Common HTML wrapper with official RotaBeat branding
 */
export function buildBrandedEmailHtml(params: {
  title: string
  subtitleIcon?: string
  badgeText?: string
  badgeColor?: string
  badgeBg?: string
  bodyHtml: string
}): string {
  const { attachments, logoSrc, iconSrc } = getBrandEmailAssets()

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${params.title} — RotaBeat</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 16px;">
        <tr>
          <td align="center">
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
              
              <!-- Brand Top Accent Bar -->
              <tr>
                <td style="height: 5px; background: linear-gradient(90deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%);"></td>
              </tr>

              <!-- Header with Official RotaBeat Logo -->
              <tr>
                <td style="background-color: #ffffff; padding: 26px 24px 18px 24px; text-align: center; border-bottom: 1px solid #f1f5f9;">
                  <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                    <tr>
                      <td align="center">
                        <img src="${logoSrc}" alt="RotaBeat Logo" width="176" style="display: block; width: 176px; height: auto; border: 0; outline: none; margin: 0 auto;" />
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 8px 0 0 0; color: #64748b; font-size: 13px; font-weight: 500; letter-spacing: 0.2px;">
                    Workforce &amp; Attendance Platform
                  </p>
                </td>
              </tr>

              <!-- Content Area -->
              <tr>
                <td style="padding: 30px 28px;">
                  <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                    <tr>
                      <td style="vertical-align: middle; padding-right: 12px;">
                        <img src="${iconSrc}" alt="RotaBeat Icon" width="32" style="display: block; width: 32px; height: auto; border: 0;" />
                      </td>
                      <td style="vertical-align: middle;">
                        <h2 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 700; line-height: 1.3;">
                          ${params.title}
                        </h2>
                      </td>
                    </tr>
                  </table>

                  ${params.bodyHtml}

                  <p style="margin: 28px 0 16px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                    If you have any questions or need assistance, please contact your manager or system administrator.
                  </p>

                  <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.6;">
                    Best regards,<br /><br />
                    <strong style="color: #0f172a;">The RotaBeat Team</strong>
                  </p>
                </td>
              </tr>

              <!-- Footer with Brand Icon -->
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 24px; border-top: 1px solid #e2e8f0; text-align: center;">
                  <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 8px auto;">
                    <tr>
                      <td style="vertical-align: middle; padding-right: 6px;">
                        <img src="${iconSrc}" alt="RotaBeat" width="18" style="display: block; width: 18px; height: auto; opacity: 0.85; border: 0;" />
                      </td>
                      <td style="vertical-align: middle;">
                        <span style="color: #475569; font-size: 12px; font-weight: 700; letter-spacing: 0.3px;">RotaBeat Platform</span>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                    Fast &middot; Accurate &middot; Compliant Workforce Scheduling &middot; &copy; ${new Date().getFullYear()} RotaBeat
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

// ============================================================================
// FEATURE 1: Upcoming Shift Reminder (Evening Before)
// ============================================================================
export async function sendUpcomingShiftReminders(): Promise<{ sentCount: number }> {
  let sentCount = 0
  try {
    const today = getTodayIso()
    const tomorrow = addDays(today, 1)

    // Find all active shifts tomorrow
    const shiftsTomorrow = await prisma.shift.findMany({
      where: {
        date: tomorrow,
      },
      include: {
        employee: true,
        site: true,
      },
      orderBy: { startTime: "asc" },
    })

    const { attachments } = getBrandEmailAssets()

    for (const shift of shiftsTomorrow) {
      if (!shift.employee || shift.employee.status !== "active") continue
      if (!shift.employee.email || !shift.employee.email.includes("@")) continue

      // Deduplication: Check if reminder was already sent for this shift
      const alreadySent = await prisma.notificationAuditLog.findFirst({
        where: {
          type: "upcoming_shift_reminder",
          recipient: shift.employee.email,
          reason: { contains: shift.id },
        },
      })

      if (alreadySent) continue

      const siteLabel = `${shift.site?.name || "Location"}${shift.site?.town ? ` (${shift.site.town})` : ""}`
      const formattedDate = formatDateLong(shift.date)
      const empFirstName = shift.employee.firstName

      const bodyHtml = `
        <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.6;">
          Hello <strong>${empFirstName}</strong>,
        </p>
        <p style="margin: 0 0 20px 0; color: #475569; font-size: 14px; line-height: 1.6;">
          This is a friendly reminder of your upcoming scheduled shift tomorrow at <strong>${siteLabel}</strong>.
        </p>

        <!-- Shift Details Card -->
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin: 20px 0; overflow: hidden;">
          <tr>
            <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; width: 35%; color: #64748b; font-size: 13px; font-weight: 600;">
              Date :
            </td>
            <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 700;">
              ${formattedDate}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px; font-weight: 600;">
              Shift Time :
            </td>
            <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0;">
              <span style="display: inline-block; background-color: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 14px;">
                ${shift.startTime} – ${shift.endTime}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px; font-weight: 600;">
              Role :
            </td>
            <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">
              ${shift.role || shift.employee.jobTitle || "Team Member"}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px; font-weight: 600;">
              Location :
            </td>
            <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 500;">
              ${siteLabel}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 18px; color: #64748b; font-size: 13px; font-weight: 600;">
              Break :
            </td>
            <td style="padding: 12px 18px; color: #0f172a; font-size: 14px; font-weight: 500;">
              ${shift.unpaidBreakMinutes ? `${shift.unpaidBreakMinutes} mins unpaid break` : "No break"}
            </td>
          </tr>
        </table>

        <!-- Friendly Reminder Notice -->
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; margin: 16px 0;">
          <tr>
            <td style="padding: 14px 16px; color: #1e40af; font-size: 13px; line-height: 1.5;">
              <strong>Clock-In Reminder:</strong> Please aim to arrive 5–10 minutes before your shift starts and clock in at the tablet kiosk using your 4-digit PIN or Face Match.
            </td>
          </tr>
        </table>
      `

      const html = buildBrandedEmailHtml({
        title: "Upcoming Shift Reminder",
        bodyHtml,
      })

      const sendResult = await sendEmailNotification({
        to: shift.employee.email,
        subject: `Upcoming Shift Reminder: Tomorrow (${shift.startTime} – ${shift.endTime}) — RotaBeat`,
        html,
        attachments,
      })

      if (sendResult.success) {
        sentCount++
      }

      await prisma.notificationAuditLog
        .create({
          data: {
            type: "upcoming_shift_reminder",
            recipient: shift.employee.email,
            siteId: shift.siteId,
            status: sendResult.success ? "SENT" : "SIMULATED",
            reason: `Upcoming shift reminder for ${shift.date} (${shift.startTime}-${shift.endTime}). Shift ID: ${shift.id}`,
          },
        })
        .catch(() => {})
    }
  } catch (err: any) {
    console.error("sendUpcomingShiftReminders error:", err)
  }
  return { sentCount }
}

// ============================================================================
// FEATURE 2: Missed Clock-In / No-Show Alert (To Site Manager & Owner)
// ============================================================================
export async function sendMissedClockInAlert(params: {
  shiftId: string
  employeeId: string
  employeeName: string
  siteId: string
  siteName: string
  scheduledStartTime: string
  role?: string
  lateMinutes: number
}): Promise<{ sentCount: number }> {
  let sentCount = 0
  const { shiftId, employeeName, siteId, siteName, scheduledStartTime, role, lateMinutes } = params

  try {
    // 1. Deduplication: Check if alert was already dispatched for this shift
    const existingLog = await prisma.notificationAuditLog.findFirst({
      where: {
        type: "missed_clock_in_alert",
        siteId,
        reason: { contains: shiftId },
      },
    })

    if (existingLog) {
      return { sentCount: 0 }
    }

    // 2. Collect recipients: Site Manager + Business Owners
    const recipients = new Set<string>()

    // Site Manager from Location managerId -> User
    const location = await prisma.location.findUnique({
      where: { id: siteId },
    })

    if (location?.managerId) {
      const managerUser = await prisma.user.findUnique({
        where: { id: location.managerId },
      })
      if (managerUser?.email && managerUser.email.includes("@")) {
        recipients.add(managerUser.email)
      }
    }

    // Site Manager from Employee table where jobTitle is "Site Manager"
    const managerEmployees = await prisma.employee.findMany({
      where: {
        primarySiteId: siteId,
        jobTitle: "Site Manager",
        status: "active",
      },
    })
    for (const m of managerEmployees) {
      if (m.email && m.email.includes("@")) {
        recipients.add(m.email)
      }
    }

    // Business Owners & Head Office
    const owners = await prisma.user.findMany({
      where: {
        role: { in: ["business_owner", "head_office"] },
        status: "active",
      },
    })
    for (const o of owners) {
      if (o.email && o.email.includes("@")) {
        recipients.add(o.email)
      }
    }

    if (recipients.size === 0) {
      return { sentCount: 0 }
    }

    const { attachments, appBase } = getBrandEmailAssets()

    const bodyHtml = `
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin: 0 0 20px 0;">
        <tr>
          <td style="padding: 14px 16px; color: #991b1b; font-size: 13px; font-weight: 600; line-height: 1.5;">
            ⚠️ URGENT ATTENDANCE ALERT: Employee is 5+ minutes overdue without clocking in.
          </td>
        </tr>
      </table>

      <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.6;">
        <strong>${employeeName}</strong> was scheduled to begin their shift at <strong>${scheduledStartTime}</strong> at <strong>${siteName}</strong>, but has not clocked in on the attendance kiosk.
      </p>

      <!-- Incident Details Card -->
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin: 20px 0; overflow: hidden;">
        <tr>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; width: 35%; color: #64748b; font-size: 13px; font-weight: 600;">
            Employee :
          </td>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 700;">
            ${employeeName}
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px; font-weight: 600;">
            Scheduled Start :
          </td>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">
            ${scheduledStartTime}
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px; font-weight: 600;">
            Time Overdue :
          </td>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0;">
            <span style="display: inline-block; background-color: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 13px;">
              ${lateMinutes} minutes late (No punch recorded)
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px; font-weight: 600;">
            Location :
          </td>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 500;">
            ${siteName}
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 18px; color: #64748b; font-size: 13px; font-weight: 600;">
            Role :
          </td>
          <td style="padding: 12px 18px; color: #0f172a; font-size: 14px; font-weight: 500;">
            ${role || "Scheduled Staff"}
          </td>
        </tr>
      </table>

      <!-- Action Button -->
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 24px 0 10px 0;">
        <tr>
          <td align="center">
            <a href="${appBase}/attendance" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px;">
              View Live Attendance &amp; Arrange Cover &rarr;
            </a>
          </td>
        </tr>
      </table>
    `

    const html = buildBrandedEmailHtml({
      title: "Missed Clock-In / No-Show Alert",
      bodyHtml,
    })

    for (const recipientEmail of recipients) {
      const sendResult = await sendEmailNotification({
        to: recipientEmail,
        subject: `⚠️ Urgent: Missed Clock-In — ${employeeName} at ${siteName} (${lateMinutes}m overdue)`,
        html,
        attachments,
      })

      if (sendResult.success) {
        sentCount++
      }

      await prisma.notificationAuditLog
        .create({
          data: {
            type: "missed_clock_in_alert",
            recipient: recipientEmail,
            siteId,
            status: sendResult.success ? "SENT" : "SIMULATED",
            reason: `Missed clock-in alert for ${employeeName} (${scheduledStartTime}). ${lateMinutes} mins late. Shift ID: ${shiftId}`,
          },
        })
        .catch(() => {})
    }
  } catch (err: any) {
    console.error("sendMissedClockInAlert error:", err)
  }

  return { sentCount }
}

// ============================================================================
// FEATURE 3: Weekly Approval Due Reminder (To Site Manager)
// ============================================================================
export async function sendWeeklyApprovalDueReminder(params: {
  siteId: string
  weekStart: string
}): Promise<{ sentCount: number }> {
  let sentCount = 0
  const { siteId, weekStart } = params

  try {
    // 1. Check org notification settings
    const orgSettings = await prisma.orgSettings.findFirst()
    if (orgSettings && !orgSettings.weeklyApprovalEmailReminder) {
      return { sentCount: 0 }
    }

    // 2. Deduplication: Check if reminder was already sent for (siteId, weekStart)
    const existingLog = await prisma.notificationAuditLog.findFirst({
      where: {
        siteId,
        weekStart,
        type: "weekly_approval_reminder",
      },
    })

    if (existingLog) {
      return { sentCount: 0 }
    }

    // 3. Fetch location
    const location = await prisma.location.findUnique({
      where: { id: siteId },
    })

    if (!location) return { sentCount: 0 }
    const siteName = `${location.name}${location.town ? ` (${location.town})` : ""}`
    const weekLabel = formatWeekRange(weekStart)

    // 4. Calculate total shifts and scheduled/worked hours for this week
    const days = weekDays(weekStart)
    const startDate = days[0]
    const endDate = days[6]

    const shifts = await prisma.shift.findMany({
      where: {
        siteId,
        date: { gte: startDate, lte: endDate },
      },
    })

    const uniqueEmployees = new Set(shifts.map((s) => s.employeeId))
    const employeeCount = uniqueEmployees.size

    let totalMins = 0
    for (const s of shifts) {
      totalMins += scheduledMinutes(s)
    }
    const totalHours = (totalMins / 60).toFixed(1)

    // 5. Find Site Manager recipient(s)
    const recipients = new Set<string>()

    if (location.managerId) {
      const managerUser = await prisma.user.findUnique({
        where: { id: location.managerId },
      })
      if (managerUser?.email && managerUser.email.includes("@")) {
        recipients.add(managerUser.email)
      }
    }

    const managerEmployees = await prisma.employee.findMany({
      where: {
        primarySiteId: siteId,
        jobTitle: "Site Manager",
        status: "active",
      },
    })
    for (const m of managerEmployees) {
      if (m.email && m.email.includes("@")) {
        recipients.add(m.email)
      }
    }

    // Fallback: If no Site Manager assigned, notify Business Owner
    if (recipients.size === 0) {
      const owners = await prisma.user.findMany({
        where: {
          role: { in: ["business_owner", "head_office"] },
          status: "active",
        },
      })
      for (const o of owners) {
        if (o.email && o.email.includes("@")) {
          recipients.add(o.email)
        }
      }
    }

    if (recipients.size === 0) return { sentCount: 0 }

    const { attachments, appBase } = getBrandEmailAssets()

    const bodyHtml = `
      <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.6;">
        This is a notification that weekly staff timesheets for <strong>${siteName}</strong> are ready for review and sign-off.
      </p>

      <!-- Timesheet Summary Card -->
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin: 20px 0; overflow: hidden;">
        <tr>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; width: 35%; color: #64748b; font-size: 13px; font-weight: 600;">
            Location :
          </td>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 700;">
            ${siteName}
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px; font-weight: 600;">
            Week Period :
          </td>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600;">
            ${weekLabel}
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px; font-weight: 600;">
            Staff on Shift :
          </td>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #4338ca; font-size: 14px; font-weight: 700;">
            ${employeeCount} employee(s)
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 18px; color: #64748b; font-size: 13px; font-weight: 600;">
            Scheduled Hours :
          </td>
          <td style="padding: 12px 18px; color: #0f172a; font-size: 14px; font-weight: 600;">
            ${totalHours} hrs
          </td>
        </tr>
      </table>

      <!-- Callout -->
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; margin: 16px 0;">
        <tr>
          <td style="padding: 14px 16px; color: #166534; font-size: 13px; line-height: 1.5;">
            <strong>Deadline Action:</strong> Please verify worked hours, resolve any attendance exceptions, and approve the timesheet before the payroll processing cutoff.
          </td>
        </tr>
      </table>

      <!-- Action Button -->
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 24px 0 10px 0;">
        <tr>
          <td align="center">
            <a href="${appBase}/approval" style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px;">
              Review &amp; Approve Weekly Timesheet &rarr;
            </a>
          </td>
        </tr>
      </table>
    `

    const html = buildBrandedEmailHtml({
      title: "Weekly Timesheet Approval Due",
      bodyHtml,
    })

    for (const recipientEmail of recipients) {
      const sendResult = await sendEmailNotification({
        to: recipientEmail,
        subject: `Weekly Timesheet Approval Due: ${siteName} (${weekLabel}) — RotaBeat`,
        html,
        attachments,
      })

      if (sendResult.success) {
        sentCount++
      }

      await prisma.notificationAuditLog
        .create({
          data: {
            type: "weekly_approval_reminder",
            recipient: recipientEmail,
            siteId,
            weekStart,
            status: sendResult.success ? "SENT" : "SIMULATED",
            reason: `Weekly approval reminder for ${siteName}, week of ${weekLabel}. ${employeeCount} employees, ${totalHours} hrs.`,
          },
        })
        .catch(() => {})
    }
  } catch (err: any) {
    console.error("sendWeeklyApprovalDueReminder error:", err)
  }

  return { sentCount }
}

