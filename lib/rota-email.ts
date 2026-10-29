import fs from "fs"
import path from "path"
import { prisma } from "@/lib/prisma"
import { sendEmailNotification } from "@/lib/email-service"
import { weekDays, formatDayMonth, formatWeekRange } from "@/lib/date-utils"
import { scheduledMinutes } from "@/lib/calc"

export interface SendRotaPublishedResult {
  totalEmployees: number
  sentCount: number
  details: Array<{ employeeId: string; email: string; success: boolean }>
}

/**
 * Dispatches individual, personalized rota schedule emails to each active employee
 * when a site's rota is published. Each employee receives ONLY their shifts and OFF days.
 */
export async function sendRotaPublishedEmails(
  siteId: string,
  weekStart: string
): Promise<SendRotaPublishedResult> {
  const result: SendRotaPublishedResult = {
    totalEmployees: 0,
    sentCount: 0,
    details: [],
  }

  try {
    // 1. Fetch site information
    const site = await prisma.location.findUnique({
      where: { id: siteId },
    })

    if (!site) {
      console.warn(`[sendRotaPublishedEmails] Site not found: ${siteId}`)
      return result
    }

    // 2. Determine the 7 calendar dates for this week (Mon - Sun)
    const days = weekDays(weekStart)
    if (!days || days.length !== 7) {
      console.warn(`[sendRotaPublishedEmails] Invalid weekStart: ${weekStart}`)
      return result
    }

    const startDate = days[0]
    const endDate = days[6]

    // 3. Fetch all shifts for this site in the week
    const shifts = await prisma.shift.findMany({
      where: {
        siteId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        employee: true,
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    })

    // 4. Fetch all active employees assigned to this site
    const siteEmployees = await prisma.employee.findMany({
      where: {
        primarySiteId: siteId,
        status: "active",
      },
    })

    // 5. Build unique map of active employees to notify
    const employeeMap = new Map<
      string,
      {
        id: string
        firstName: string
        lastName: string
        email: string
        jobTitle: string
      }
    >()

    for (const emp of siteEmployees) {
      if (emp.email && emp.email.includes("@")) {
        employeeMap.set(emp.id, emp)
      }
    }

    // Include any employees with shifts scheduled at this site even if primary site differs
    for (const s of shifts) {
      if (
        s.employee &&
        s.employee.status === "active" &&
        s.employee.email &&
        s.employee.email.includes("@")
      ) {
        if (!employeeMap.has(s.employeeId)) {
          employeeMap.set(s.employeeId, s.employee)
        }
      }
    }

    result.totalEmployees = employeeMap.size
    if (result.totalEmployees === 0) {
      return result
    }

    // 6. Prepare email brand assets (Logo & Icon with CID attachments)
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

    const locationLabel = `${site.name}${site.town ? ` (${site.town})` : ""}`
    const weekLabel = formatWeekRange(weekStart)

    // 7. Dispatch personalized emails to each employee
    for (const emp of employeeMap.values()) {
      try {
        const empShifts = shifts.filter((s) => s.employeeId === emp.id)

        let totalScheduledMinutes = 0
        for (const s of empShifts) {
          totalScheduledMinutes += scheduledMinutes(s)
        }
        const totalHours = (totalScheduledMinutes / 60).toFixed(1)
        const shiftCount = empShifts.length
        let offDaysCount = 0

        // Build 7-day schedule rows
        const rowsHtml = days
          .map((dayIso) => {
            const dayLabel = formatDayMonth(dayIso)
            const dayShifts = empShifts.filter((s) => s.date === dayIso)

            if (dayShifts.length > 0) {
              return dayShifts
                .map(
                  (s) => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px 14px; font-weight: 600; color: #0f172a; font-size: 13px; white-space: nowrap;">
                    ${dayLabel}
                  </td>
                  <td style="padding: 12px 14px; white-space: nowrap;">
                    <span style="display: inline-block; background-color: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 13px;">
                      ${s.startTime} – ${s.endTime}
                    </span>
                  </td>
                  <td style="padding: 12px 14px; color: #334155; font-size: 13px; font-weight: 500;">
                    ${s.role || emp.jobTitle || "Team Member"}
                  </td>
                  <td style="padding: 12px 14px; color: #64748b; font-size: 12px;">
                    ${s.unpaidBreakMinutes ? `${s.unpaidBreakMinutes}m break` : "No break"}
                  </td>
                </tr>
              `
                )
                .join("")
            } else {
              offDaysCount++
              return `
                <tr style="border-bottom: 1px solid #e2e8f0; background-color: #f8fafc;">
                  <td style="padding: 12px 14px; font-weight: 500; color: #64748b; font-size: 13px; white-space: nowrap;">
                    ${dayLabel}
                  </td>
                  <td style="padding: 12px 14px; white-space: nowrap;">
                    <span style="display: inline-block; background-color: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 12px; letter-spacing: 0.5px;">
                      OFF
                    </span>
                  </td>
                  <td style="padding: 12px 14px; color: #94a3b8; font-size: 13px;">
                    —
                  </td>
                  <td style="padding: 12px 14px; color: #94a3b8; font-size: 12px; font-style: italic;">
                    Rest Day
                  </td>
                </tr>
              `
            }
          })
          .join("")

        const scheduleEmailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Schedule — RotaBeat</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 16px;">
              <tr>
                <td align="center">
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
                    
                    <!-- Brand Top Accent Bar -->
                    <tr>
                      <td style="height: 5px; background: linear-gradient(90deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%);"></td>
                    </tr>

                    <!-- Header with Official RotaBeat Logo -->
                    <tr>
                      <td style="background-color: #ffffff; padding: 28px 24px 20px 24px; text-align: center; border-bottom: 1px solid #f1f5f9;">
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
                      <td style="padding: 32px 30px;">
                        <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                          <tr>
                            <td style="vertical-align: middle; padding-right: 12px;">
                              <img src="${iconSrc}" alt="RotaBeat Icon" width="34" style="display: block; width: 34px; height: auto; border: 0;" />
                            </td>
                            <td style="vertical-align: middle;">
                              <h2 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 700;">
                                Your Weekly Work Schedule
                              </h2>
                            </td>
                          </tr>
                        </table>

                        <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                          Hello <strong>${emp.firstName}</strong>,
                        </p>
                        <p style="margin: 0 0 20px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                          The rota for <strong>${locationLabel}</strong> for the week of <strong>${weekLabel}</strong> has been published. Below are your scheduled shifts and off days:
                        </p>

                        <!-- Summary Cards -->
                        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
                          <tr>
                            <td style="width: 32%; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                              <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Shifts</div>
                              <div style="font-size: 18px; font-weight: 700; color: #4F46E5; margin-top: 4px;">${shiftCount}</div>
                            </td>
                            <td style="width: 2%;"></td>
                            <td style="width: 32%; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                              <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Off Days</div>
                              <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px;">${offDaysCount}</div>
                            </td>
                            <td style="width: 2%;"></td>
                            <td style="width: 32%; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                              <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Total Hours</div>
                              <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px;">${totalHours} hrs</div>
                            </td>
                          </tr>
                        </table>

                        <!-- Schedule Table -->
                        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; border-collapse: separate; border-spacing: 0;">
                          <thead>
                            <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                              <th align="left" style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Day &amp; Date</th>
                              <th align="left" style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Shift</th>
                              <th align="left" style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Role</th>
                              <th align="left" style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Break</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${rowsHtml}
                          </tbody>
                        </table>

                        <p style="margin: 28px 0 16px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                          If you have any questions or need to request a shift swap, please contact your manager or system administrator.
                        </p>

                        <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.6;">
                          Best regards,<br /><br />
                          <strong style="color: #0f172a;">The RotaBeat Team</strong>
                        </p>
                      </td>
                    </tr>

                    <!-- Footer with Brand Icon -->
                    <tr>
                      <td style="background-color: #f8fafc; padding: 22px 24px; border-top: 1px solid #e2e8f0; text-align: center;">
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

        const sendResult = await sendEmailNotification({
          to: emp.email,
          subject: `Your Work Schedule: Week of ${weekLabel} — RotaBeat`,
          html: scheduleEmailHtml,
          attachments,
        })

        if (sendResult.success) {
          result.sentCount++
        }

        result.details.push({
          employeeId: emp.id,
          email: emp.email,
          success: sendResult.success,
        })

        // Audit Log entry
        await prisma.notificationAuditLog
          .create({
            data: {
              type: "rota_published",
              recipient: emp.email,
              siteId,
              weekStart,
              status: sendResult.success ? "SENT" : "SIMULATED",
              reason: `Rota published for week ${weekLabel}. ${shiftCount} shift(s), ${offDaysCount} off day(s), ${totalHours} hrs scheduled.`,
            },
          })
          .catch(() => {})
      } catch (empErr) {
        console.error(`Failed to send rota email to ${emp.email}:`, empErr)
        result.details.push({
          employeeId: emp.id,
          email: emp.email,
          success: false,
        })
      }
    }
  } catch (err: any) {
    console.error("sendRotaPublishedEmails error:", err)
  }

  return result
}

