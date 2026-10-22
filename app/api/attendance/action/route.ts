import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  deriveCurrentAttendanceStatus,
  validateAttendanceAction,
  getSuccessConfirmationTitle,
  getAttendanceActionLabel,
  getAttendanceStateLabel,
  getNextStateForAction,
  type AttendanceActionType,
} from "@/lib/attendance"
import { logger } from "@/lib/logger"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { employeeId, action, siteId } = body

    if (!employeeId) {
      return NextResponse.json(
        { success: false, message: "Employee ID is required." },
        { status: 400 }
      )
    }

    if (!action || !["clock_in", "break_start", "break_end", "clock_out"].includes(action)) {
      return NextResponse.json(
        { success: false, message: "Invalid attendance action provided." },
        { status: 400 }
      )
    }

    const actionType = action as AttendanceActionType

    // Fetch employee from database
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { primarySite: true },
    })

    if (!employee) {
      return NextResponse.json(
        { success: false, message: "Employee not found." },
        { status: 404 }
      )
    }

    if (employee.status !== "active") {
      return NextResponse.json(
        { success: false, message: `Employee status is ${employee.status}. Only active employees can record attendance.` },
        { status: 400 }
      )
    }

    // Official server timestamp - do not trust client device time
    const serverDateObj = new Date()
    const serverTimestamp = serverDateObj.toISOString()
    const dateIso = serverTimestamp.slice(0, 10)

    const targetSiteId = siteId || employee.primarySiteId

    // Find existing attendance record for today
    let attendanceRecord = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId: employee.id,
        date: dateIso,
      },
      include: {
        events: true,
      },
    })

    const existingEvents = attendanceRecord?.events || []
    const currentStatus = deriveCurrentAttendanceStatus(existingEvents)

    // Backend Validation Matrix check
    const validation = validateAttendanceAction(currentStatus, actionType)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, message: validation.error || "Action not allowed." },
        { status: 400 }
      )
    }

    // Upsert / Create record & clock event
    let createdEvent
    if (!attendanceRecord) {
      // Find shift for today if scheduled
      const shift = await prisma.shift.findFirst({
        where: {
          employeeId: employee.id,
          date: dateIso,
        },
      })

      attendanceRecord = await prisma.attendanceRecord.create({
        data: {
          employeeId: employee.id,
          siteId: targetSiteId,
          date: dateIso,
          shiftId: shift?.id || null,
          scheduledStartTime: shift?.startTime || null,
          scheduledEndTime: shift?.endTime || null,
          status: "normal",
          events: {
            create: {
              type: actionType,
              timestamp: serverTimestamp,
              source: "web",
            },
          },
        },
        include: {
          events: true,
        },
      })
      createdEvent = attendanceRecord.events[0]
    } else {
      createdEvent = await prisma.clockEvent.create({
        data: {
          attendanceRecordId: attendanceRecord.id,
          type: actionType,
          timestamp: serverTimestamp,
          source: "web",
        },
      })
    }

    const nextStatus = getNextStateForAction(actionType)

    // Format server time (e.g., 09:02 AM)
    const formattedTime = serverDateObj.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })

    const employeeName = `${employee.firstName} ${employee.lastName}`

    // Fetch location details for notification message
    const location = await prisma.location.findUnique({
      where: { id: targetSiteId },
    })
    const siteName = location ? `${location.name} (${location.town})` : "Site"

    // Fetch shift for today if scheduled
    const shift = await prisma.shift.findFirst({
      where: {
        employeeId: employee.id,
        date: dateIso,
      },
    })

    // Fetch OrgSettings to get late threshold
    const orgSettings = await prisma.orgSettings.findFirst({
      where: { id: "default" },
    })
    const lateThresholdMinutes = orgSettings?.lateThresholdMinutes ?? 5

    // Generate notifications
    const notifications: any[] = []

    if (actionType === "clock_in") {
      // 1. Notification to Business Owner and Site Manager with location and exact detail
      notifications.push({
        id: `noti-${Date.now()}-1`,
        recipientRole: "management",
        employeeId: employee.id,
        employeeName,
        siteId: targetSiteId,
        siteName,
        type: "clock_in",
        title: "Employee Clocked In",
        message: `${employeeName} clocked in at ${siteName} at ${formattedTime}`,
        timestamp: serverTimestamp,
        read: false,
        isWarning: false,
      })

      // 2. Notification to Employee on starting shift
      notifications.push({
        id: `noti-${Date.now()}-2`,
        recipientRole: "employee",
        recipientUserId: employee.id,
        employeeId: employee.id,
        employeeName,
        siteId: targetSiteId,
        siteName,
        type: "clock_in",
        title: "Shift Started",
        message: `You clocked in at ${siteName} at ${formattedTime}`,
        timestamp: serverTimestamp,
        read: false,
        isWarning: false,
      })

      // 3. Check if late joined for shift (Notification to Owner & Manager)
      if (shift && shift.startTime) {
        const [schedHours, schedMins] = shift.startTime.split(":").map(Number)
        const clockHours = serverDateObj.getHours()
        const clockMins = serverDateObj.getMinutes()
        const schedTotalMins = schedHours * 60 + schedMins
        const clockTotalMins = clockHours * 60 + clockMins
        const lateMins = clockTotalMins - schedTotalMins

        if (lateMins > lateThresholdMinutes) {
          notifications.push({
            id: `noti-${Date.now()}-3`,
            recipientRole: "management",
            employeeId: employee.id,
            employeeName,
            siteId: targetSiteId,
            siteName,
            type: "late_clock_in",
            title: "Late Shift Arrival Warning",
            message: `${employeeName} joined late for shift at ${siteName} (Scheduled: ${shift.startTime}, Clocked In: ${formattedTime} - ${lateMins} mins late)`,
            timestamp: serverTimestamp,
            read: false,
            isWarning: true,
            meta: {
              scheduledTime: shift.startTime,
              clockTime: formattedTime,
              minsLate: lateMins,
            },
          })
        }
      }
    } else if (actionType === "break_start") {
      // Notification to Owner & Manager when started break
      notifications.push({
        id: `noti-${Date.now()}-1`,
        recipientRole: "management",
        employeeId: employee.id,
        employeeName,
        siteId: targetSiteId,
        siteName,
        type: "break_start",
        title: "Break Started",
        message: `${employeeName} started break at ${siteName} at ${formattedTime}`,
        timestamp: serverTimestamp,
        read: false,
        isWarning: false,
      })
    } else if (actionType === "break_end") {
      // Notification to Owner & Manager when ended break
      notifications.push({
        id: `noti-${Date.now()}-1`,
        recipientRole: "management",
        employeeId: employee.id,
        employeeName,
        siteId: targetSiteId,
        siteName,
        type: "break_end",
        title: "Break Ended",
        message: `${employeeName} ended break at ${siteName} at ${formattedTime}`,
        timestamp: serverTimestamp,
        read: false,
        isWarning: false,
      })

      // Check if employee has taken extra time of break (Notification to Owner & Manager)
      const breakStartEvent = existingEvents
        .slice()
        .reverse()
        .find((e) => e.type === "break_start")

      if (breakStartEvent) {
        const breakStartMs = new Date(breakStartEvent.timestamp).getTime()
        const breakEndMs = serverDateObj.getTime()
        const actualBreakMins = Math.max(1, Math.round((breakEndMs - breakStartMs) / 60000))
        const allowedBreakMins = shift?.unpaidBreakMinutes || 30

        if (actualBreakMins > allowedBreakMins) {
          const extraMins = actualBreakMins - allowedBreakMins
          notifications.push({
            id: `noti-${Date.now()}-2`,
            recipientRole: "management",
            employeeId: employee.id,
            employeeName,
            siteId: targetSiteId,
            siteName,
            type: "extra_break",
            title: "Extra Break Duration Warning",
            message: `${employeeName} took extra break time at ${siteName} (Took ${actualBreakMins} mins vs allowed ${allowedBreakMins} mins - ${extraMins} mins extra)`,
            timestamp: serverTimestamp,
            read: false,
            isWarning: true,
            meta: {
              breakMinutesTaken: actualBreakMins,
              breakMinutesAllowed: allowedBreakMins,
              extraBreakMinutes: extraMins,
            },
          })
        }
      }
    } else if (actionType === "clock_out") {
      notifications.push({
        id: `noti-${Date.now()}-1`,
        recipientRole: "management",
        employeeId: employee.id,
        employeeName,
        siteId: targetSiteId,
        siteName,
        type: "clock_out",
        title: "Employee Clocked Out",
        message: `${employeeName} clocked out at ${siteName} at ${formattedTime}`,
        timestamp: serverTimestamp,
        read: false,
        isWarning: false,
      })
    }

    // Save notifications to DB so all connected Business Owners & Site Managers receive them
    if (notifications.length > 0) {
      try {
        await prisma.appNotification.createMany({
          data: notifications.map((n) => ({
            recipientRole: n.recipientRole,
            recipientUserId: n.recipientUserId || null,
            employeeId: n.employeeId || null,
            employeeName: n.employeeName,
            siteId: n.siteId,
            siteName: n.siteName,
            type: n.type,
            title: n.title,
            message: n.message,
            timestamp: n.timestamp,
            read: false,
            isWarning: Boolean(n.isWarning),
            metaJson: n.meta ? JSON.stringify(n.meta) : null,
          })),
        })
      } catch (err) {
        console.error("Failed to save app notifications to DB:", err)
      }
    }

    return NextResponse.json({
      success: true,
      message: getSuccessConfirmationTitle(actionType),
      notifications,
      data: {
        eventId: createdEvent.id,
        employeeId: employee.id,
        employeeName,
        action: actionType,
        actionLabel: getAttendanceActionLabel(actionType),
        status: nextStatus,
        statusLabel: getAttendanceStateLabel(nextStatus),
        timestamp: serverTimestamp,
        formattedTime,
        date: dateIso,
      },
    })
  } catch (error: any) {
    logger.error("POST /api/attendance/action", error)
    return NextResponse.json(
      { success: false, message: "We couldn't process your request. Please try again." },
      { status: 500 }
    )
  }
}
