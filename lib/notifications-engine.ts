 import { apiUrl } from '@/lib/api';
import { prisma } from "@/lib/prisma"

interface TimeRange {
  start: number // minutes from midnight
  end: number // minutes from midnight
  shiftId: string
}

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0
  const [h, m] = timeStr.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * 1. Missing Punch Detector
 *
 * Only flags "Clock Out Missing" when the employee's shift end time has
 * actually passed (with a 30-minute grace buffer). If no shift is found,
 * falls back to requiring at least 8 hours since the clock-in event.
 */
export async function detectMissingPunches() {
  try {
    const activeLocations = await prisma.location.findMany({
      where: { status: "active" },
      select: { id: true, name: true },
    })
    const locationMap = new Map(activeLocations.map((l) => [l.id, l.name]))

    const now = new Date()
    const GRACE_MINUTES = 30 // buffer after shift end before flagging
    const FALLBACK_HOURS = 8 // if no shift found, wait 8h after clock-in

    // Find attendance records marked as exception or missing clock out
    const exceptionRecords = await prisma.attendanceRecord.findMany({
      where: {
        status: { in: ["exception", "normal"] },
        OR: [
          { exceptionsJson: { contains: "missing_clock_out" } },
          { exceptionsJson: { contains: "missing_break_end" } },
          { workedMinutes: 0 },
        ],
      },
      include: {
        employee: true,
        events: true,
      },
      take: 100,
    })

    for (const rec of exceptionRecords) {
      if (!rec.employee) continue
      const siteName = locationMap.get(rec.siteId) || "Location"
      const empName = `${rec.employee.firstName} ${rec.employee.lastName}`

      // Check if employee has a clock-in without a clock-out
      const hasClockIn = rec.events.some((e) => e.type === "clock_in")
      const hasClockOut = rec.events.some((e) => e.type === "clock_out")

      if (hasClockIn && !hasClockOut) {
        // --- KEY FIX: Only flag if the shift has actually ended ---

        // Look up the employee's shift for this date
        const shift = await prisma.shift.findFirst({
          where: {
            employeeId: rec.employeeId,
            siteId: rec.siteId,
            date: rec.date,
          },
        })

        let shiftEndPassed = false

        if (shift) {
          // Parse shift end time (e.g. "17:00") and compare with current time
          const shiftEndMins = parseTimeToMinutes(shift.endTime)
          const nowMins = now.getHours() * 60 + now.getMinutes()

          // Also check if the record date is a past date (always flag past days)
          const todayStr = now.toISOString().split("T")[0]
          const isPastDate = rec.date < todayStr

          if (isPastDate) {
            // Past date — shift definitely ended
            shiftEndPassed = true
          } else if (rec.date === todayStr) {
            // Today — only flag if current time is past shift end + grace
            shiftEndPassed = nowMins > shiftEndMins + GRACE_MINUTES
          }
          // Future date — never flag (shiftEndPassed stays false)
        } else {
          // No shift found — fallback: check if 8 hours have passed since clock-in
          const clockInEvent = rec.events.find((e) => e.type === "clock_in")
          if (clockInEvent) {
            const clockInTime = new Date(clockInEvent.timestamp)
            const hoursSinceClockIn = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60)
            shiftEndPassed = hoursSinceClockIn >= FALLBACK_HOURS
          }
        }

        // Skip if the shift hasn't ended yet — employee is still working
        if (!shiftEndPassed) {
          // Auto-resolve any stale missing_punch notifications for this employee
          // (they may have been wrongly created before this fix)
          await prisma.appNotification.updateMany({
            where: {
              employeeId: rec.employeeId,
              siteId: rec.siteId,
              type: "missing_punch",
              resolved: false,
              metaJson: { contains: rec.id },
            },
            data: {
              resolved: true,
              resolvedAt: new Date(),
            },
          })
          continue
        }

        // Deduplicate: check if active notification already exists
        const existing = await prisma.appNotification.findFirst({
          where: {
            employeeId: rec.employeeId,
            siteId: rec.siteId,
            type: "missing_punch",
            resolved: false,
            metaJson: { contains: rec.id },
          },
        })

        if (!existing) {
          await prisma.appNotification.create({
            data: {
              recipientRole: "manager",
              employeeId: rec.employeeId,
              employeeName: empName,
              siteId: rec.siteId,
              siteName: siteName,
              type: "missing_punch",
              title: "Missing Punch",
              message: `${empName} has a missing clock-out for ${rec.date} at ${siteName}.`,
              timestamp: new Date().toISOString(),
              isWarning: true,
              read: false,
              resolved: false,
              metaJson: JSON.stringify({
                attendanceRecordId: rec.id,
                date: rec.date,
                link: "/attendance",
                actionText: "Review Attendance",
              }),
            },
          })
        }
      }
    }
  } catch (err) {
    console.error("detectMissingPunches error:", err)
  }
}

/**
 * 2. Shift Conflict Detector
 */
export async function detectShiftConflicts() {
  try {
    const activeLocations = await prisma.location.findMany({
      where: { status: "active" },
      select: { id: true, name: true },
    })
    const locationMap = new Map(activeLocations.map((l) => [l.id, l.name]))

    // Fetch all shifts
    const allShifts = await prisma.shift.findMany({
      include: {
        employee: true,
      },
    })

    // Group by employeeId + date
    const grouped = new Map<string, typeof allShifts>()
    for (const shift of allShifts) {
      const key = `${shift.employeeId}_${shift.date}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(shift)
    }

    // Identify conflicts
    for (const [key, shifts] of grouped.entries()) {
      if (shifts.length < 2) continue

      const ranges: TimeRange[] = shifts.map((s) => ({
        start: parseTimeToMinutes(s.startTime),
        end: parseTimeToMinutes(s.endTime),
        shiftId: s.id,
      }))

      let hasOverlap = false
      let s1Obj = shifts[0]
      let s2Obj = shifts[1]

      for (let i = 0; i < ranges.length; i++) {
        for (let j = i + 1; j < ranges.length; j++) {
          const r1 = ranges[i]
          const r2 = ranges[j]
          // Strict overlap check
          if (r1.start < r2.end && r2.start < r1.end) {
            hasOverlap = true
            s1Obj = shifts[i]
            s2Obj = shifts[j]
            break
          }
        }
        if (hasOverlap) break
      }

      const emp = s1Obj.employee
      if (!emp) continue

      const empName = `${emp.firstName} ${emp.lastName}`
      const siteName = locationMap.get(s1Obj.siteId) || "Location"
      const dateStr = s1Obj.date

      if (hasOverlap) {
        // Create conflict notification if not existing
        const existing = await prisma.appNotification.findFirst({
          where: {
            employeeId: s1Obj.employeeId,
            type: "shift_conflict",
            resolved: false,
            metaJson: { contains: dateStr },
          },
        })

        if (!existing) {
          await prisma.appNotification.create({
            data: {
              recipientRole: "manager",
              employeeId: s1Obj.employeeId,
              employeeName: empName,
              siteId: s1Obj.siteId,
              siteName: siteName,
              type: "shift_conflict",
              title: "Shift Conflict",
              message: `${empName} has overlapping shifts on ${dateStr} (${s1Obj.startTime}-${s1Obj.endTime} and ${s2Obj.startTime}-${s2Obj.endTime}).`,
              timestamp: new Date().toISOString(),
              isWarning: true,
              read: false,
              resolved: false,
              metaJson: JSON.stringify({
                shift1Id: s1Obj.id,
                shift2Id: s2Obj.id,
                date: dateStr,
                link: "/rota",
                actionText: "View Schedule",
              }),
            },
          })
        }
      } else {
        // Auto-resolve conflict notification if resolved
        await prisma.appNotification.updateMany({
          where: {
            employeeId: s1Obj.employeeId,
            type: "shift_conflict",
            resolved: false,
            metaJson: { contains: dateStr },
          },
          data: {
            resolved: true,
            resolvedAt: new Date(),
          },
        })
      }
    }
  } catch (err) {
    console.error("detectShiftConflicts error:", err)
  }
}

/**
 * 3. Weekly Approval & Overdue Detector
 */
export async function detectWeeklyApprovals() {
  try {
    const activeLocations = await prisma.location.findMany({
      where: { status: "active" },
      select: { id: true, name: true },
    })

    const approvals = await prisma.weeklyApproval.findMany({
      where: {
        status: { in: ["open", "under_review"] },
      },
    })

    const todayStr = new Date().toISOString().split("T")[0]

    for (const app of approvals) {
      const site = activeLocations.find((l) => l.id === app.siteId)
      const siteName = site?.name || "Site"
      const isOverdue = todayStr > app.weekStart // Simple deadline check

      const notiType = isOverdue ? "weekly_approval_overdue" : "weekly_approval_due"
      const title = isOverdue ? "Weekly Approval Overdue" : "Weekly Approval Required"
      const message = isOverdue
        ? `Site ${siteName}'s weekly timesheet for ${app.weekStart} is overdue.`
        : `Site ${siteName}'s weekly hours for ${app.weekStart} are awaiting approval.`

      const existing = await prisma.appNotification.findFirst({
        where: {
          siteId: app.siteId,
          type: { in: ["weekly_approval_due", "weekly_approval_overdue"] },
          resolved: false,
          metaJson: { contains: app.weekStart },
        },
      })

      if (!existing) {
        await prisma.appNotification.create({
          data: {
            recipientRole: "manager",
            employeeName: "System",
            siteId: app.siteId,
            siteName: siteName,
            type: notiType,
            title: title,
            message: message,
            timestamp: new Date().toISOString(),
            isWarning: true,
            read: false,
            resolved: false,
            metaJson: JSON.stringify({
              siteId: app.siteId,
              weekStart: app.weekStart,
              isOverdue,
              link: "/approval",
              actionText: "Review Week",
            }),
          },
        })
      }
    }
  } catch (err) {
    console.error("detectWeeklyApprovals error:", err)
  }
}

/**
 * 4. Auto-resolve engine when issues are fixed
 */
export async function autoResolveNotifications(params: {
  attendanceRecordId?: string
  siteId?: string
  weekStart?: string
  employeeId?: string
  date?: string
}) {
  try {
    const { attendanceRecordId, siteId, weekStart, employeeId, date } = params

    if (attendanceRecordId) {
      await prisma.appNotification.updateMany({
        where: {
          type: "missing_punch",
          resolved: false,
          metaJson: { contains: attendanceRecordId },
        },
        data: {
          resolved: true,
          resolvedAt: new Date(),
        },
      })
    }

    if (siteId && weekStart) {
      await prisma.appNotification.updateMany({
        where: {
          siteId,
          type: { in: ["weekly_approval_due", "weekly_approval_overdue"] },
          resolved: false,
          metaJson: { contains: weekStart },
        },
        data: {
          resolved: true,
          resolvedAt: new Date(),
        },
      })
    }
  } catch (err) {
    console.error("autoResolveNotifications error:", err)
  }
}

/**
 * Combined Detector Runner
 */
export async function runAllNotificationDetectors() {
  await Promise.all([
    detectMissingPunches(),
    detectShiftConflicts(),
    detectWeeklyApprovals(),
  ])
}
