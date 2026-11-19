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
      clientTime,
      clientDate,
    } = body

    const effectiveDateIso = (clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)) ? clientDate : dateIso

    const eventSource = (source || clientType || "web").toLowerCase()
    const isAppRequest =
      eventSource === "app" ||
      eventSource === "mobile" ||
      clientType === "app" ||
      clientType === "mobile" ||
      Boolean(request.headers.get("x-client-type")?.includes("app"))

    const incomingMatchScore = body.matchScore ?? body.faceMatchScore ?? body.biometric?.matchScore ?? null
    const incomingDistance = body.distance ?? body.biometric?.distance ?? null
    const incomingSimilarity = body.similarity ?? body.biometric?.similarity ?? null

    console.log("==================================================")
    console.log("[ATTENDANCE ACTION API] Incoming Request:")
    console.log("  URL: /api/attendance/action")
    console.log("  Action:", action)
    console.log("  Identifier:", employeeId || username || employeeNumber)
    console.log("  Source / ClientType:", eventSource)
    console.log("  Values from mobile / client:")
    console.log("  matchScore:", incomingMatchScore)
    console.log("  distance:", incomingDistance)
    console.log("  similarity:", incomingSimilarity)
    console.log("==================================================")

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
      } catch { }
    }

    // Parse live embedding from mobile app request
    let liveVector: number[] | null = null
    if (liveEmbedding) {
      try {
        liveVector =
          typeof liveEmbedding === "string" ? JSON.parse(liveEmbedding) : liveEmbedding
      } catch { }
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

      console.log("==================================================")
      console.log("[BIOMETRIC VERIFICATION RESULT]")
      console.log("  Employee:", `${employee.firstName} ${employee.lastName} (${employee.employeeNumber})`)
      console.log("  matchScore:", finalFaceMatchScore)
      console.log("  distance:", finalFaceDistance)
      console.log("  similarity:", finalFaceSimilarity)
      console.log("  matched:", finalFaceVerified)
      console.log("  verifiedBy:", biometricVerifiedBy)
      console.log("==================================================")

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
        date: effectiveDateIso,
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

    // Late Arrival Detection on Clock-In (5-min grace period marks as Late, NEVER blocks clock-in or marks absent)
    let isLateArrival = false
    let lateMinutes = 0
    let scheduledShift: any = null

    if (actionType === "clock_in") {
      scheduledShift = await prisma.shift.findFirst({
        where: {
          employeeId: employee.id,
          date: effectiveDateIso,
        },
      })

      if (scheduledShift && scheduledShift.startTime) {
        const [sH, sM] = scheduledShift.startTime.split(":").map(Number)
        const shiftStartMins = (sH || 0) * 60 + (sM || 0)
        let nowMins = serverDateObj.getHours() * 60 + serverDateObj.getMinutes()
        if (clientTime && typeof clientTime === "string" && clientTime.includes(":")) {
          const [cH, cM] = clientTime.split(":").map(Number)
          if (!isNaN(cH) && !isNaN(cM)) {
            nowMins = cH * 60 + cM
          }
        }

        // Fetch org settings for late threshold (default 5 mins)
        const orgSettings = await prisma.orgSettings.findFirst({
          where: { id: "default" },
        })
        const lateThreshold = orgSettings?.lateThresholdMinutes ?? 5

        if (nowMins > shiftStartMins + lateThreshold) {
          isLateArrival = true
          lateMinutes = Math.max(0, nowMins - shiftStartMins)
        }
      }

      // If an attendance record had previously been marked absent or auto_absent, clear it so employee can work normally!
      if (attendanceRecord && (attendanceRecord.source === "auto_absent" || attendanceRecord.exceptionsJson?.includes("absent"))) {
        let exceptions: string[] = []
        try {
          exceptions = JSON.parse(attendanceRecord.exceptionsJson || "[]")
        } catch {
          exceptions = []
        }
        exceptions = exceptions.filter((e: string) => e !== "absent")
        if (isLateArrival && !exceptions.includes("late_arrival")) {
          exceptions.push("late_arrival")
        }

        attendanceRecord = await prisma.attendanceRecord.update({
          where: { id: attendanceRecord.id },
          data: {
            source: "clock_event",
            status: isLateArrival ? "exception" : "normal",
            exceptionsJson: JSON.stringify(exceptions),
            correctionReason: null,
          },
          include: { events: true },
        })
      }
    }

    // Upsert / Create record & clock event
    let createdEvent: any
    if (!attendanceRecord) {
      if (!scheduledShift) {
        scheduledShift = await prisma.shift.findFirst({
          where: {
            employeeId: employee.id,
            date: effectiveDateIso,
          },
        })
      }

      const initialExceptions = isLateArrival ? ["late_arrival"] : []

      attendanceRecord = await prisma.attendanceRecord.create({
        data: {
          employeeId: employee.id,
          siteId: targetSiteId,
          date: effectiveDateIso,
          shiftId: scheduledShift?.id || null,
          scheduledStartTime: scheduledShift?.startTime || null,
          scheduledEndTime: scheduledShift?.endTime || null,
          status: isLateArrival ? "exception" : "normal",
          exceptionsJson: JSON.stringify(initialExceptions),
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

      if (isLateArrival) {
        let exceptions: string[] = []
        try {
          exceptions = JSON.parse(attendanceRecord.exceptionsJson || "[]")
        } catch {
          exceptions = []
        }
        if (!exceptions.includes("late_arrival")) {
          exceptions.push("late_arrival")
          await prisma.attendanceRecord.update({
            where: { id: attendanceRecord.id },
            data: {
              status: "exception",
              exceptionsJson: JSON.stringify(exceptions),
            },
          })
        }
      }
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
        let clockTotalMins = serverDateObj.getHours() * 60 + serverDateObj.getMinutes()
        if (clientTime && typeof clientTime === "string" && clientTime.includes(":")) {
          const [cH, cM] = clientTime.split(":").map(Number)
          if (!isNaN(cH) && !isNaN(cM)) {
            clockTotalMins = cH * 60 + cM
          }
        }
        const schedTotalMins = schedHours * 60 + schedMins
        const lateMins = clockTotalMins - schedTotalMins

        if (lateMins > lateThresholdMinutes) {
          const lateHours = Math.floor(lateMins / 60)
          const remainingMins = lateMins % 60
          const lateDurationFormatted =
            lateHours > 0
              ? remainingMins > 0
                ? `${lateHours} hr ${remainingMins} mins`
                : `${lateHours} hr`
              : `${lateMins} mins`

          notifications.push({
            id: `noti-${Date.now()}-3`,
            recipientRole: "manager",
            recipientUserId: location?.managerId || null,
            employeeId: employee.id,
            employeeName,
            siteId: targetSiteId,
            siteName,
            type: "late_arrival",
            title: `Late Arrival: ${employeeName} (${lateDurationFormatted} late)`,
            message: `${employeeName} clocked in late at ${siteName}. Scheduled Start: ${shift.startTime} | Actual Clock-In: ${formattedTime} | Total Late: ${lateDurationFormatted}.`,
            timestamp: serverTimestamp,
            read: false,
            isWarning: true,
            meta: {
              employeeId: employee.id,
              employeeName,
              shiftId: shift.id,
              scheduledStartTime: shift.startTime,
              scheduledTime: shift.startTime,
              actualClockInTime: formattedTime,
              clockTime: formattedTime,
              lateMinutes: lateMins,
              minsLate: lateMins,
              lateDuration: lateDurationFormatted,
              totalLateDuration: lateDurationFormatted,
              attendanceRecordId: attendanceRecord.id,
              siteId: targetSiteId,
              siteName,
              date: dateIso,
              actionText: "Review Late Arrival",
              openLateReview: true,
              link: `/attendance?reviewRecordId=${attendanceRecord.id}&employeeId=${employee.id}&date=${dateIso}`,
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

      // Accurate Shift Worked Totals & Proposed Late Payroll Deduction Calculation
      try {
        const allEvents = [...existingEvents, createdEvent].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
        const firstClockIn = allEvents.find((e) => e.type === "clock_in")
        const lastClockOut = createdEvent

        if (firstClockIn && lastClockOut) {
          const inMs = new Date(firstClockIn.timestamp).getTime()
          const outMs = new Date(lastClockOut.timestamp).getTime()
          const grossMins = Math.max(0, Math.round((outMs - inMs) / 60000))

          let totalBreakMins = 0
          let currentBreakStart: number | null = null
          for (const ev of allEvents) {
            if (ev.type === "break_start") {
              currentBreakStart = new Date(ev.timestamp).getTime()
            } else if (ev.type === "break_end" && currentBreakStart !== null) {
              const breakEndMs = new Date(ev.timestamp).getTime()
              totalBreakMins += Math.max(0, Math.round((breakEndMs - currentBreakStart) / 60000))
              currentBreakStart = null
            }
          }

          const workedMins = Math.max(0, grossMins - totalBreakMins)

          await prisma.attendanceRecord.update({
            where: { id: attendanceRecord.id },
            data: {
              grossMinutes: grossMins,
              totalBreakMinutes: totalBreakMins,
              workedMinutes: workedMins,
            },
          })

          // Calculate proposed payroll adjustment for unworked late time
          const orgSettings = await prisma.orgSettings.findFirst({
            where: { id: "default" },
          })
          const isLateDeductionEnabled = orgSettings?.lateDeductionEnabled ?? true
          const lateGraceMins = orgSettings?.lateGracePeriodMinutes ?? 5

          const shiftForCalc =
            shift ||
            (await prisma.shift.findFirst({
              where: {
                employeeId: employee.id,
                date: dateIso,
              },
            }))

          if (isLateDeductionEnabled && shiftForCalc && shiftForCalc.startTime && shiftForCalc.endTime) {
            const [sH, sM] = shiftForCalc.startTime.split(":").map(Number)
            const [eH, eM] = shiftForCalc.endTime.split(":").map(Number)
            const schedStartMins = (sH || 0) * 60 + (sM || 0)
            const schedEndMins = (eH || 0) * 60 + (eM || 0)
            const schedGrossMins = Math.max(0, schedEndMins - schedStartMins)
            const schedBreakMins = shiftForCalc.unpaidBreakMinutes || 0
            const scheduledShiftMins = Math.max(0, schedGrossMins - schedBreakMins)

            const clockInTime = new Date(firstClockIn.timestamp)
            const clockInMins = clockInTime.getHours() * 60 + clockInTime.getMinutes()
            const lateArrivalMinutes = Math.max(0, clockInMins - schedStartMins)

            // Deduct ONLY applicable unpaid time when employee arrived late and worked less than scheduled
            if (lateArrivalMinutes > lateGraceMins && workedMins < scheduledShiftMins) {
              const unpaidLateMinutes = Math.min(
                lateArrivalMinutes,
                Math.max(0, scheduledShiftMins - workedMins)
              )

              const hourlyRate =
                employee.payType === "hourly"
                  ? Number(employee.hourlyRate) || 0
                  : (Number(employee.salaryAnnual) || 0) / (52 * 40)

              if (hourlyRate > 0 && unpaidLateMinutes > 0) {
                const deductionAmount = Number(
                  ((unpaidLateMinutes / 60) * hourlyRate).toFixed(2)
                )
                const scheduledHours = Number((scheduledShiftMins / 60).toFixed(2))
                const workedHours = Number((workedMins / 60).toFixed(2))

                // Upsert proposed PayrollAdjustment
                const existingAdj = await prisma.payrollAdjustment.findFirst({
                  where: {
                    attendanceRecordId: attendanceRecord.id,
                  },
                })

                if (!existingAdj) {
                  await prisma.payrollAdjustment.create({
                    data: {
                      attendanceRecordId: attendanceRecord.id,
                      shiftId: shiftForCalc.id,
                      employeeId: employee.id,
                      siteId: targetSiteId,
                      date: dateIso,
                      payType: employee.payType || "hourly",
                      hourlyRate,
                      scheduledHours,
                      workedHours,
                      lateMinutes: unpaidLateMinutes,
                      deductionAmount,
                      status: "proposed",
                    },
                  })
                } else if (existingAdj.status === "proposed") {
                  await prisma.payrollAdjustment.update({
                    where: { id: existingAdj.id },
                    data: {
                      hourlyRate,
                      scheduledHours,
                      workedHours,
                      lateMinutes: unpaidLateMinutes,
                      deductionAmount,
                    },
                  })
                }

                // Notify manager of proposed deduction ready for review
                notifications.push({
                  id: `noti-${Date.now()}-deduct`,
                  recipientRole: "manager",
                  recipientUserId: location?.managerId || null,
                  employeeId: employee.id,
                  employeeName,
                  siteId: targetSiteId,
                  siteName,
                  type: "payroll_deduction_approved",
                  title: `Proposed Payroll Deduction: ${employeeName} (-£${deductionAmount})`,
                  message: `${employeeName} worked ${workedHours} hrs vs scheduled ${scheduledHours} hrs (${unpaidLateMinutes} mins unpaid late time). Proposed deduction: £${deductionAmount} at £${hourlyRate.toFixed(2)}/hr.`,
                  timestamp: serverTimestamp,
                  read: false,
                  isWarning: true,
                  meta: {
                    attendanceRecordId: attendanceRecord.id,
                    employeeId: employee.id,
                    employeeName,
                    unpaidLateMinutes,
                    deductionAmount,
                    scheduledHours,
                    workedHours,
                    hourlyRate,
                    actionText: "Review Deduction",
                    link: `/payroll`,
                  },
                })
              }
            }
          }
        }
      } catch (calcErr) {
        console.error("Failed to calculate shift worked totals or proposed deduction:", calcErr)
      }
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
