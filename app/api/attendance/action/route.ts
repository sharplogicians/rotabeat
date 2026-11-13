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
import { verifyFaceMatch } from "@/lib/face-recognition"
import { logger } from "@/lib/logger"

export async function POST(request: Request) {
  const serverDateObj = new Date()
  const serverTimestamp = serverDateObj.toISOString()
  const dateIso = serverDateObj.toLocaleDateString("en-CA") // YYYY-MM-DD in local system time

  try {
    const body = await request.json()
    const {
      employeeId,
      username,
      employeeNumber,
      action,
      siteId,
      photo,
      source,
      clientType,
      faceMatchScore,
      faceVerified,
    } = body

    const eventSource = (source || clientType || "web").toLowerCase()
    const isAppRequest =
      eventSource === "app" ||
      eventSource === "mobile" ||
      clientType === "app" ||
      clientType === "mobile" ||
      Boolean(request.headers.get("x-client-type")?.includes("app"))

    // Accept employeeId, username, or employeeNumber
    const rawIdentifier = (employeeId || username || employeeNumber || "").trim()

    if (!rawIdentifier) {
      return NextResponse.json(
        {
          success: false,
          timestamp: serverTimestamp,
          error: {
            code: "VALIDATION_ERROR",
            message: "Employee ID or username is required.",
          },
          message: "Employee ID is required.",
        },
        { status: 400 }
      )
    }

    if (!action || !["clock_in", "break_start", "break_end", "clock_out"].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          timestamp: serverTimestamp,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid attendance action provided. Must be clock_in, break_start, break_end, or clock_out.",
          },
          message: "Invalid attendance action provided.",
        },
        { status: 400 }
      )
    }

    const actionType = action as AttendanceActionType

    // Fetch employee from database by id, employeeNumber, or email
    const cleanId = rawIdentifier.toLowerCase()
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { id: rawIdentifier },
          { employeeNumber: rawIdentifier },
          { employeeNumber: rawIdentifier.toUpperCase() },
          { email: cleanId },
        ],
      },
      include: { primarySite: true },
    })

    if (!employee) {
      return NextResponse.json(
        {
          success: false,
          timestamp: serverTimestamp,
          error: {
            code: "EMPLOYEE_NOT_FOUND",
            message: "Employee not found.",
          },
          message: "Employee not found.",
        },
        { status: 404 }
      )
    }

    if (employee.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          timestamp: serverTimestamp,
          error: {
            code: "ACCOUNT_INACTIVE",
            message: `Employee status is ${employee.status}. Only active employees can record attendance.`,
          },
          message: `Employee status is ${employee.status}. Only active employees can record attendance.`,
        },
        { status: 400 }
      )
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // BIOMETRIC FACE VERIFICATION (Enforced for ALL 4 actions: clock_in, break_start, break_end, clock_out)
    // ─────────────────────────────────────────────────────────────────────────────
    const liveEmbedding =
      body.liveEmbedding || body.liveFaceEmbedding || body.faceEmbedding || null

    let finalFaceVerified = Boolean(faceVerified)
    let finalFaceMatchScore: number | null =
      typeof faceMatchScore === "number" ? faceMatchScore : null
    let finalFaceDistance: number | null = null
    let finalFaceSimilarity: number | null = null
    let biometricVerifiedBy = "none"

    // Parse registered embedding from database
    let registeredVector: number[] | null = null
    if (employee.faceEmbedding) {
      try {
        registeredVector =
          typeof employee.faceEmbedding === "string"
            ? JSON.parse(employee.faceEmbedding)
            : employee.faceEmbedding
      } catch {}
    }

    // Parse live embedding from mobile app request
    let liveVector: number[] | null = null
    if (liveEmbedding) {
      try {
        liveVector =
          typeof liveEmbedding === "string" ? JSON.parse(liveEmbedding) : liveEmbedding
      } catch {}
    }

    // 1. If live vector is provided by Mobile App -> Compare on Server
    if (Array.isArray(liveVector) && liveVector.length > 0) {
      if (!registeredVector || !Array.isArray(registeredVector) || registeredVector.length === 0) {
        return NextResponse.json(
          {
            success: false,
            timestamp: serverTimestamp,
            error: {
              code: "NO_REGISTERED_FACE",
              message:
                "No registered face embedding found in database. Please ask your manager to register your photo before performing attendance actions.",
            },
            message: "No registered face profile found.",
          },
          { status: 400 }
        )
      }

      // Perform Euclidean Distance & Cosine Similarity matching
      const matchResult = verifyFaceMatch(liveVector, registeredVector)
      finalFaceDistance = Number(matchResult.distance.toFixed(4))
      finalFaceSimilarity = Number(matchResult.similarity.toFixed(4))
      finalFaceMatchScore = matchResult.score
      finalFaceVerified = matchResult.matched
      biometricVerifiedBy = "server_vector_comparison"

      if (!matchResult.matched) {
        return NextResponse.json(
          {
            success: false,
            timestamp: serverTimestamp,
            error: {
              code: "BIOMETRIC_MISMATCH",
              message: `Biometric face verification failed. Match confidence was ${matchResult.score}% (minimum 70% required). Live camera face does not match registered employee.`,
            },
            biometric: {
              verified: false,
              matchScore: matchResult.score,
              distance: finalFaceDistance,
              similarity: finalFaceSimilarity,
              threshold: 0.48,
            },
            message: `Face verification failed (${matchResult.score}% match confidence).`,
          },
          { status: 400 }
        )
      }
    } else {
      // 2. Strict Check for all actions without live embedding vector
      if (!employee.profileImage && !employee.faceEmbedding) {
        return NextResponse.json(
          {
            success: false,
            timestamp: serverTimestamp,
            error: {
              code: "NO_REGISTERED_FACE",
              message:
                "No registered photo found. Please have your manager upload a profile photo before performing attendance actions.",
            },
            message:
              "No registered photo found. Please have your manager upload a profile photo before performing attendance actions.",
          },
          { status: 400 }
        )
      }

      if (isAppRequest) {
        return NextResponse.json(
          {
            success: false,
            timestamp: serverTimestamp,
            error: {
              code: "BIOMETRIC_REQUIRED",
              message: `Live camera face embedding is required for ${getAttendanceActionLabel(actionType).toLowerCase()}.`,
            },
            message: `Live camera face embedding is required for ${getAttendanceActionLabel(actionType).toLowerCase()}.`,
          },
          { status: 400 }
        )
      }

      if (eventSource === "web" && (actionType === "clock_in" || actionType === "clock_out")) {
        if (!faceVerified || (typeof faceMatchScore === "number" && faceMatchScore < 65)) {
          return NextResponse.json(
            {
              success: false,
              timestamp: serverTimestamp,
              error: {
                code: "BIOMETRIC_MISMATCH",
                message:
                  "Biometric face verification failed. The live camera face does not match the employee's registered photo. Clocking in on another person's behalf is strictly prohibited.",
              },
              message:
                "Biometric face verification failed. The live camera face does not match the employee's registered photo. Clocking in on another person's behalf is strictly prohibited.",
            },
            { status: 400 }
          )
        }
        biometricVerifiedBy = "client_biometrics"
      }
    }

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

    // Backend Validation Matrix check (enforces 1 break limit & valid transition sequence)
    const validation = validateAttendanceAction(currentStatus, actionType, existingEvents)
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          timestamp: serverTimestamp,
          error: {
            code: "INVALID_ACTION_SEQUENCE",
            message: validation.error || "Action not allowed.",
          },
          message: validation.error || "Action not allowed.",
        },
        { status: 400 }
      )
    }

    // Automatic Absent check: If employee is 5+ minutes late from scheduled shift start time
    if (actionType === "clock_in") {
      const shift = await prisma.shift.findFirst({
        where: {
          employeeId: employee.id,
          date: dateIso,
        },
      })

      if (shift && shift.startTime) {
        const [sH, sM] = shift.startTime.split(":").map(Number)
        const shiftStartMins = (sH || 0) * 60 + (sM || 0)
        const nowMins = serverDateObj.getHours() * 60 + serverDateObj.getMinutes()

        const isMarkedAbsent =
          attendanceRecord &&
          (attendanceRecord.exceptionsJson?.includes("absent") ||
            attendanceRecord.source === "auto_absent")

        if (isMarkedAbsent || nowMins > shiftStartMins + 5) {
          if (!attendanceRecord) {
            attendanceRecord = await prisma.attendanceRecord.create({
              data: {
                employeeId: employee.id,
                siteId: targetSiteId,
                date: dateIso,
                shiftId: shift.id,
                scheduledStartTime: shift.startTime,
                scheduledEndTime: shift.endTime,
                status: "exception",
                exceptionsJson: JSON.stringify(["absent"]),
                source: "auto_absent",
                correctionReason: `Automatically marked absent: 5+ minutes late for shift (${shift.startTime}) without clocking in.`,
                workedMinutes: 0,
                grossMinutes: 0,
                totalBreakMinutes: 0,
              },
              include: { events: true },
            })
          }

          const existingNoti = await prisma.appNotification.findFirst({
            where: {
              employeeId: employee.id,
              siteId: targetSiteId,
              type: "absent",
              metaJson: { contains: shift.id },
            },
          })

          if (!existingNoti) {
            await prisma.appNotification.create({
              data: {
                recipientRole: "management",
                employeeId: employee.id,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                siteId: targetSiteId,
                siteName: employee.primarySite?.name || "Site",
                type: "absent",
                title: "Employee Automatically Marked Absent",
                message: `${employee.firstName} ${employee.lastName} was automatically marked absent at ${employee.primarySite?.name || "Site"}. Scheduled start was ${shift.startTime} (5+ minutes late without clocking in).`,
                timestamp: serverTimestamp,
                isWarning: true,
                read: false,
                resolved: false,
                metaJson: JSON.stringify({
                  shiftId: shift.id,
                  attendanceRecordId: attendanceRecord.id,
                  date: dateIso,
                  link: "/attendance",
                  actionText: "Review Attendance",
                }),
              },
            })
          }

          return NextResponse.json(
            {
              success: false,
              isAbsent: true,
              timestamp: serverTimestamp,
              error: {
                code: "MARKED_ABSENT",
                message: `You have been automatically marked absent because you are more than 5 minutes late for your scheduled shift (${shift.startTime}). Please contact your site manager.`,
              },
              message: `You have been automatically marked absent because you are more than 5 minutes late for your scheduled shift (${shift.startTime}). Please contact your site manager.`,
            },
            { status: 400 }
          )
        }
      }
    }

    // Upsert / Create record & clock event
    let createdEvent: any
    if (!attendanceRecord) {
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
              source: eventSource,
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
          source: eventSource,
        },
      })
    }

    // Safely save photo and biometric verification details to database
    if (createdEvent?.id) {
      try {
        await prisma.$executeRawUnsafe(
          "UPDATE `ClockEvent` SET `photo` = COALESCE(?, `photo`), `faceMatchScore` = ?, `faceVerified` = ? WHERE `id` = ?",
          photo || null,
          typeof finalFaceMatchScore === "number" ? finalFaceMatchScore : null,
          finalFaceVerified ? 1 : 0,
          createdEvent.id
        )
        if (photo) createdEvent.photo = photo
        if (typeof finalFaceMatchScore === "number")
          createdEvent.faceMatchScore = finalFaceMatchScore
        createdEvent.faceVerified = Boolean(finalFaceVerified)
      } catch (photoErr) {
        logger.error("Failed to update photo/biometrics on ClockEvent", photoErr)
      }
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

    const biometricPayload = {
      verified: Boolean(finalFaceVerified),
      matchScore: finalFaceMatchScore,
      distance: finalFaceDistance,
      similarity: finalFaceSimilarity,
      verifiedBy: biometricVerifiedBy,
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MOBILE APP RESPONSE: Return exactly what the mobile client requires
    // ─────────────────────────────────────────────────────────────────────────────
    if (isAppRequest) {
      return NextResponse.json({
        success: true,
        timestamp: serverTimestamp,
        message: `${getSuccessConfirmationTitle(actionType)} Successfully!`,
        biometric: biometricPayload,
      })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // WEB KIOSK / DASHBOARD RESPONSE: Full payload with data and notifications
    // ─────────────────────────────────────────────────────────────────────────────
    const updatedRecord = await prisma.attendanceRecord.findUnique({
      where: { id: attendanceRecord.id },
      include: {
        events: {
          orderBy: { timestamp: "asc" },
        },
      },
    })
    const allEvents = updatedRecord?.events || []

    function formatEventTime(isoString: string): string {
      try {
        const d = new Date(isoString)
        return d.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      } catch {
        return isoString
      }
    }

    const clockInEvt = allEvents.find((e) => e.type === "clock_in")
    const breakStartEvt = allEvents
      .slice()
      .reverse()
      .find((e) => e.type === "break_start")
    const breakEndEvt = allEvents
      .slice()
      .reverse()
      .find((e) => e.type === "break_end")
    const clockOutEvt = allEvents.find((e) => e.type === "clock_out")

    const history = {
      clock_in: clockInEvt ? formatEventTime(clockInEvt.timestamp) : null,
      break_start: breakStartEvt ? formatEventTime(breakStartEvt.timestamp) : null,
      break_end: breakEndEvt ? formatEventTime(breakEndEvt.timestamp) : null,
      clock_out: clockOutEvt ? formatEventTime(clockOutEvt.timestamp) : null,
      events: allEvents.map((e) => ({
        id: e.id,
        type: e.type,
        time: formatEventTime(e.timestamp),
        timestamp: e.timestamp,
        photo: e.photo || null,
      })),
    }

    let shiftStatus = "NOT_CHECKED_IN"
    let allowedActions: string[] = ["clock_in"]

    switch (nextStatus) {
      case "working":
        shiftStatus = "CLOCKED_IN"
        allowedActions = ["break_start", "clock_out"]
        break
      case "on_break":
        shiftStatus = "ON_BREAK"
        allowedActions = ["break_end"]
        break
      case "clocked_out":
        shiftStatus = "CLOCKED_OUT"
        allowedActions = []
        break
      default:
        shiftStatus = "NOT_CHECKED_IN"
        allowedActions = ["clock_in"]
    }

    return NextResponse.json({
      success: true,
      timestamp: serverTimestamp,
      message: `${getSuccessConfirmationTitle(actionType)} Successfully!`,
      biometric: biometricPayload,
      notifications,
      data: {
        employee: {
          employeeId: employee.id,
          employeeNumber: employee.employeeNumber,
          name: employeeName,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          role: "employee",
          jobTitle: employee.jobTitle,
          locationId: targetSiteId,
          profileImage: employee.profileImage || null,
        },
        todayShift: shift
          ? {
              id: shift.id,
              date: shift.date,
              startTime: shift.startTime,
              endTime: shift.endTime,
              unpaidBreakMinutes: shift.unpaidBreakMinutes ?? 0,
              role: shift.role || employee.jobTitle || "Staff",
              status: shiftStatus,
              allowed_actions: allowedActions,
              late_allowed_minutes: 5,
            }
          : null,
        biometric: biometricPayload,
        history,
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
        photo: createdEvent.photo || photo || null,
      },
    })
  } catch (error: any) {
    logger.error("POST /api/attendance/action", error)
    return NextResponse.json(
      {
        success: false,
        timestamp: serverTimestamp,
        error: {
          code: "SERVER_ERROR",
          message: error?.message || "We couldn't process your request. Please try again.",
        },
        message: "We couldn't process your request. Please try again.",
      },
      { status: 500 }
    )
  }
}
