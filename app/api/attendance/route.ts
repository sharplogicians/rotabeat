import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { computeWorkedTotals, detectAttendanceExceptions, validateCorrectionTimes } from "@/lib/calc"
import type { ClockEvent } from "@/lib/types"
import { getApiUser, enforceSiteAccess } from "@/lib/auth-guard"
import { logAuditEvent } from "@/lib/audit"
import { logger } from "@/lib/logger"

/**
 * GET /api/attendance
 * Retrieves daily attendance records with optional filtering by employeeId, siteId/locationId, date, status, exception.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get("employeeId")
    const rawSiteId = searchParams.get("siteId") || searchParams.get("locationId")
    const date = searchParams.get("date")
    const status = searchParams.get("status")
    const exception = searchParams.get("exception")

    const user = getApiUser(request)
    let effectiveSiteId = rawSiteId

    if (user) {
      try {
        effectiveSiteId = enforceSiteAccess(user, rawSiteId === "all" ? undefined : rawSiteId) || null
      } catch (err: any) {
        if (err instanceof Response || (err && err.status)) return err
      }
    }

    const where: any = {}
    if (employeeId) where.employeeId = employeeId
    if (effectiveSiteId && effectiveSiteId !== "all") where.siteId = effectiveSiteId
    if (date) where.date = date
    if (status && status !== "all") where.status = status

    const records = await prisma.attendanceRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            employeeNumber: true,
            primarySiteId: true,
          },
        },
        site: {
          select: {
            id: true,
            name: true,
          },
        },
        events: {
          orderBy: { timestamp: "asc" },
        },
        audits: {
          orderBy: { changedAt: "desc" },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    })

    // Map records with calculated values and filter by exception if specified
    const formatted = records.map((record) => {
      const parsedExceptions: string[] = JSON.parse(record.exceptionsJson || "[]")
      const events: ClockEvent[] = record.events.map((e) => ({
        id: e.id,
        type: e.type as any,
        timestamp: e.timestamp,
        source: e.source as any,
        deviceId: e.deviceId || undefined,
      }))

      const totals = computeWorkedTotals(events)

      return {
        id: record.id,
        employeeId: record.employeeId,
        employee: record.employee,
        siteId: record.siteId,
        siteName: record.site.name,
        date: record.date,
        shiftId: record.shiftId,
        scheduledStartTime: record.scheduledStartTime,
        scheduledEndTime: record.scheduledEndTime,
        source: record.source,
        grossMinutes: record.grossMinutes || totals.grossMinutes,
        totalBreakMinutes: record.totalBreakMinutes || totals.breakMinutes,
        workedMinutes: record.workedMinutes || totals.payableMinutes,
        status: record.status,
        exceptions: parsedExceptions,
        correctionReason: record.correctionReason,
        correctedBy: record.correctedBy,
        correctedAt: record.correctedAt,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        events,
        audits: record.audits.map((a) => ({
          id: a.id,
          attendanceRecordId: a.attendanceRecordId,
          employeeId: a.employeeId,
          changedBy: a.changedBy,
          changedAt: a.changedAt.toISOString(),
          action: a.action,
          changes: JSON.parse(a.changesJson || "[]"),
          reason: a.reason,
        })),
      }
    })

    let filtered = formatted
    if (exception && exception !== "all") {
      filtered = formatted.filter((r) => r.exceptions.includes(exception))
    }

    return NextResponse.json({
      success: true,
      records: filtered,
    })
  } catch (error: any) {
    logger.error("GET /api/attendance", error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}

/**
 * POST /api/attendance
 * Manager manual entry of missing attendance record.
 * Requires: employeeId, date, reason, clockIn, breakStart, breakEnd, clockOut
 */
export async function POST(request: Request) {
  try {
    const user = getApiUser(request)
    const body = await request.json()
    const { employeeId, siteId, date, clockIn, breakStart, breakEnd, clockOut, markAbsent, reason, actorName, scheduledStartTime, scheduledEndTime } = body

    if (!employeeId || !date) {
      return NextResponse.json(
        { success: false, message: "Employee ID and date are required." },
        { status: 400 }
      )
    }

    // Validate mandatory reason and time ordering
    const val = validateCorrectionTimes(
      markAbsent ? undefined : clockIn,
      markAbsent ? undefined : breakStart,
      markAbsent ? undefined : breakEnd,
      markAbsent ? undefined : clockOut,
      reason
    )
    if (!val.valid) {
      return NextResponse.json({ success: false, message: val.error }, { status: 400 })
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { primarySite: true },
    })

    if (!employee) {
      return NextResponse.json({ success: false, message: "Employee not found." }, { status: 404 })
    }

    const targetSiteId = siteId || employee.primarySiteId

    // Site permission check
    if (user) {
      try {
        enforceSiteAccess(user, targetSiteId)
      } catch (err: any) {
        if (err instanceof Response || (err && err.status)) return err
      }
    }

    // Find shift for scheduled comparison
    const shift = await prisma.shift.findFirst({
      where: { employeeId, date },
    })

    // Construct events
    const eventObjects: { type: string; timestamp: string; source: string }[] = []
    let detectedExceptions: string[] = []

    if (markAbsent) {
      detectedExceptions = ["absent"]
    } else {
      if (clockIn) eventObjects.push({ type: "clock_in", timestamp: `${date}T${clockIn}:00`, source: "manager_manual" })
      if (breakStart) eventObjects.push({ type: "break_start", timestamp: `${date}T${breakStart}:00`, source: "manager_manual" })
      if (breakEnd) eventObjects.push({ type: "break_end", timestamp: `${date}T${breakEnd}:00`, source: "manager_manual" })
      if (clockOut) eventObjects.push({ type: "clock_out", timestamp: `${date}T${clockOut}:00`, source: "manager_manual" })

      const clockEventsForCalc: ClockEvent[] = eventObjects.map((e, idx) => ({
        id: `tmp-${idx}`,
        type: e.type as any,
        timestamp: e.timestamp,
        source: "manager_manual",
      }))
      detectedExceptions = detectAttendanceExceptions(clockEventsForCalc, shift)
    }

    // Compute totals
    const clockEventsForCalc: ClockEvent[] = eventObjects.map((e, idx) => ({
      id: `tmp-${idx}`,
      type: e.type as any,
      timestamp: e.timestamp,
      source: "manager_manual",
    }))
    const totals = computeWorkedTotals(clockEventsForCalc)

    const finalStatus = detectedExceptions.length > 0 ? "exception" : "corrected"
    const managerName = user?.userName || actorName || "Manager"

    // Check if an attendance record already exists for this employee and date in DB
    const existingRecord = await prisma.attendanceRecord.findFirst({
      where: { employeeId: employee.id, date },
    })

    if (existingRecord && !body.allowUpdate) {
      return NextResponse.json(
        {
          success: false,
          code: "ATTENDANCE_ALREADY_EXISTS",
          message: `Attendance has already been added for ${employee.firstName} ${employee.lastName} on ${date}.`,
          recordId: existingRecord.id,
        },
        { status: 409 }
      )
    }

    // Create or update record, events, and audit entry in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update matching shift on Rota if shift start/end times provided
      if (shift && (scheduledStartTime || scheduledEndTime)) {
        await tx.shift.update({
          where: { id: shift.id },
          data: {
            ...(scheduledStartTime ? { startTime: scheduledStartTime } : {}),
            ...(scheduledEndTime ? { endTime: scheduledEndTime } : {}),
          },
        })
      }

      let record

      if (existingRecord) {
        // Delete old clock events
        await tx.clockEvent.deleteMany({
          where: { attendanceRecordId: existingRecord.id },
        })

        record = await tx.attendanceRecord.update({
          where: { id: existingRecord.id },
          data: {
            scheduledStartTime: scheduledStartTime || existingRecord.scheduledStartTime || shift?.startTime || null,
            scheduledEndTime: scheduledEndTime || existingRecord.scheduledEndTime || shift?.endTime || null,
            source: "manager_manual",
            grossMinutes: totals.grossMinutes,
            totalBreakMinutes: totals.breakMinutes,
            workedMinutes: totals.payableMinutes,
            exceptionsJson: JSON.stringify(detectedExceptions),
            status: finalStatus,
            correctionReason: reason.trim(),
            correctedBy: managerName,
            correctedAt: new Date().toISOString(),
            events: {
              create: eventObjects,
            },
          },
          include: {
            events: true,
          },
        })
      } else {
        record = await tx.attendanceRecord.create({
          data: {
            employeeId: employee.id,
            siteId: targetSiteId,
            date,
            shiftId: shift?.id || null,
            scheduledStartTime: scheduledStartTime || shift?.startTime || null,
            scheduledEndTime: scheduledEndTime || shift?.endTime || null,
            source: "manager_manual",
            grossMinutes: totals.grossMinutes,
            totalBreakMinutes: totals.breakMinutes,
            workedMinutes: totals.payableMinutes,
            exceptionsJson: JSON.stringify(detectedExceptions),
            status: finalStatus,
            correctionReason: reason.trim(),
            correctedBy: managerName,
            correctedAt: new Date().toISOString(),
            events: {
              create: eventObjects,
            },
          },
          include: {
            events: true,
          },
        })
      }

      // Create Audit Log
      const auditChanges = [
        { field: "Source", previousValue: "None", newValue: "manager_manual" },
        { field: "Clock In", previousValue: "None", newValue: clockIn || "None" },
        { field: "Break Start", previousValue: "None", newValue: breakStart || "None" },
        { field: "Break End", previousValue: "None", newValue: breakEnd || "None" },
        { field: "Clock Out", previousValue: "None", newValue: clockOut || "None" },
        { field: "Worked Minutes", previousValue: "0", newValue: `${totals.payableMinutes}` },
      ]

      await tx.attendanceAudit.create({
        data: {
          attendanceRecordId: record.id,
          employeeId: employee.id,
          changedBy: managerName,
          action: existingRecord ? "UPDATE" : "CREATE",
          changesJson: JSON.stringify(auditChanges),
          reason: reason.trim(),
        },
      })

      // Record system AuditEvent
      await tx.auditEvent.create({
        data: {
          timestamp: new Date().toISOString(),
          userName: managerName,
          role: user?.role === "manager" ? "manager" : "business_owner",
          siteId: targetSiteId,
          entity: "AttendanceRecord",
          action: existingRecord ? "CORRECT_ATTENDANCE" : "CREATE_MANUAL_ATTENDANCE",
          previousValue: null,
          newValue: JSON.stringify({ date, clockIn, clockOut, workedMinutes: totals.payableMinutes }),
          reason: reason.trim(),
          source: "web",
        },
      })

      return record
    })

    return NextResponse.json({
      success: true,
      record: result,
    })
  } catch (error: any) {
    logger.error("POST /api/attendance", error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
