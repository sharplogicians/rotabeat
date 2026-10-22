import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { computeWorkedTotals, detectAttendanceExceptions, validateCorrectionTimes } from "@/lib/calc"
import { isoToLocalTime } from "@/lib/date-utils"
import type { ClockEvent } from "@/lib/types"

/**
 * GET /api/attendance/[id]
 * Fetch detailed attendance record by ID including employee, location, shift, clock events, calculations, exceptions, and audit history.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const record = await prisma.attendanceRecord.findUnique({
      where: { id },
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
            town: true,
          },
        },
        events: {
          orderBy: { timestamp: "asc" },
        },
        audits: {
          orderBy: { changedAt: "desc" },
        },
      },
    })

    if (!record) {
      return NextResponse.json({ success: false, message: "Attendance record not found." }, { status: 404 })
    }

    const events: ClockEvent[] = record.events.map((e) => ({
      id: e.id,
      type: e.type as any,
      timestamp: e.timestamp,
      source: e.source as any,
      deviceId: e.deviceId || undefined,
    }))

    const totals = computeWorkedTotals(events)

    return NextResponse.json({
      success: true,
      data: {
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
        exceptions: JSON.parse(record.exceptionsJson || "[]"),
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
      },
    })
  } catch (error: any) {
    console.error("GET /api/attendance/[id] error:", error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}

/**
 * PUT /api/attendance/[id]
 * Manager correction to existing attendance record.
 * Requires: reason (mandatory non-empty), clockIn, breakStart, breakEnd, clockOut, or markAbsent.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { clockIn, breakStart, breakEnd, clockOut, markAbsent, reason, actorName, scheduledStartTime, scheduledEndTime } = body

    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: { id },
      include: { events: true },
    })

    if (!existingRecord) {
      return NextResponse.json({ success: false, message: "Attendance record not found." }, { status: 404 })
    }

    // Validate mandatory non-empty reason and sequence rules
    const val = validateCorrectionTimes(clockIn, breakStart, breakEnd, clockOut, reason)
    if (!val.valid) {
      return NextResponse.json({ success: false, message: val.error }, { status: 400 })
    }

    const managerName = actorName || "Site Manager"
    const date = existingRecord.date

    // Determine shift for schedule comparison
    const shift = await prisma.shift.findFirst({
      where: { employeeId: existingRecord.employeeId, date },
    })

    let newEvents: { type: string; timestamp: string; source: string }[] = []
    let detectedExceptions: string[] = []

    if (markAbsent) {
      detectedExceptions = ["absent"]
    } else {
      if (clockIn) newEvents.push({ type: "clock_in", timestamp: `${date}T${clockIn}:00`, source: "manager_correction" })
      if (breakStart) newEvents.push({ type: "break_start", timestamp: `${date}T${breakStart}:00`, source: "manager_correction" })
      if (breakEnd) newEvents.push({ type: "break_end", timestamp: `${date}T${breakEnd}:00`, source: "manager_correction" })
      if (clockOut) newEvents.push({ type: "clock_out", timestamp: `${date}T${clockOut}:00`, source: "manager_correction" })

      const calcEvents: ClockEvent[] = newEvents.map((e, idx) => ({
        id: `tmp-${idx}`,
        type: e.type as any,
        timestamp: e.timestamp,
        source: "manager_correction",
      }))

      detectedExceptions = detectAttendanceExceptions(calcEvents, shift)
    }

    const clockEventsForCalc: ClockEvent[] = newEvents.map((e, idx) => ({
      id: `tmp-${idx}`,
      type: e.type as any,
      timestamp: e.timestamp,
      source: "manager_correction",
    }))

    const totals = computeWorkedTotals(clockEventsForCalc)

    // Build diff changes for Audit Trail
    const getEvtTime = (type: string) => {
      const ts = existingRecord.events.find((e) => e.type === type)?.timestamp
      return ts ? isoToLocalTime(ts) : "None"
    }
    const oldClockIn = getEvtTime("clock_in")
    const oldClockOut = existingRecord.events.filter((e) => e.type === "clock_out").pop()?.timestamp ? isoToLocalTime(existingRecord.events.filter((e) => e.type === "clock_out").pop()?.timestamp) : "None"
    const oldBreakStart = getEvtTime("break_start")
    const oldBreakEnd = getEvtTime("break_end")
    const oldSchedStart = existingRecord.scheduledStartTime || shift?.startTime || "None"
    const oldSchedEnd = existingRecord.scheduledEndTime || shift?.endTime || "None"

    const changes: { field: string; previousValue: string; newValue: string }[] = []

    if (scheduledStartTime && oldSchedStart !== scheduledStartTime) {
      changes.push({ field: "Shift Start", previousValue: oldSchedStart, newValue: scheduledStartTime })
    }
    if (scheduledEndTime && oldSchedEnd !== scheduledEndTime) {
      changes.push({ field: "Shift End", previousValue: oldSchedEnd, newValue: scheduledEndTime })
    }
    if (oldClockIn !== (clockIn || "None")) {
      changes.push({ field: "Clock In", previousValue: oldClockIn, newValue: clockIn || "None" })
    }
    if (oldBreakStart !== (breakStart || "None")) {
      changes.push({ field: "Break Start", previousValue: oldBreakStart, newValue: breakStart || "None" })
    }
    if (oldBreakEnd !== (breakEnd || "None")) {
      changes.push({ field: "Break End", previousValue: oldBreakEnd, newValue: breakEnd || "None" })
    }
    if (oldClockOut !== (clockOut || "None")) {
      changes.push({ field: "Clock Out", previousValue: oldClockOut, newValue: clockOut || "None" })
    }
    if (existingRecord.workedMinutes !== totals.payableMinutes) {
      changes.push({
        field: "Worked Minutes",
        previousValue: `${existingRecord.workedMinutes}`,
        newValue: `${totals.payableMinutes}`,
      })
    }
    if (changes.length === 0 && markAbsent) {
      changes.push({ field: "Status", previousValue: existingRecord.status, newValue: "absent" })
    }

    const finalStatus = detectedExceptions.length > 0 ? "exception" : "corrected"

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update matching Shift in Rota if scheduledStartTime/scheduledEndTime provided
      if (shift && (scheduledStartTime || scheduledEndTime)) {
        await tx.shift.update({
          where: { id: shift.id },
          data: {
            ...(scheduledStartTime ? { startTime: scheduledStartTime } : {}),
            ...(scheduledEndTime ? { endTime: scheduledEndTime } : {}),
          },
        })
      }

      // 2. Delete old clock events & create new ones
      await tx.clockEvent.deleteMany({
        where: { attendanceRecordId: id },
      })

      const record = await tx.attendanceRecord.update({
        where: { id },
        data: {
          scheduledStartTime: scheduledStartTime || existingRecord.scheduledStartTime || shift?.startTime || null,
          scheduledEndTime: scheduledEndTime || existingRecord.scheduledEndTime || shift?.endTime || null,
          source: "manager_correction",
          grossMinutes: totals.grossMinutes,
          totalBreakMinutes: totals.breakMinutes,
          workedMinutes: totals.payableMinutes,
          exceptionsJson: JSON.stringify(detectedExceptions),
          status: finalStatus,
          correctionReason: reason.trim(),
          correctedBy: managerName,
          correctedAt: new Date().toISOString(),
          events: {
            create: newEvents,
          },
        },
        include: {
          events: true,
          audits: true,
        },
      })

      // Create Immutable Attendance Audit entry
      await tx.attendanceAudit.create({
        data: {
          attendanceRecordId: id,
          employeeId: record.employeeId,
          changedBy: managerName,
          action: "UPDATE",
          changesJson: JSON.stringify(changes),
          reason: reason.trim(),
        },
      })

      // Record system AuditEvent
      await tx.auditEvent.create({
        data: {
          timestamp: new Date().toISOString(),
          userName: managerName,
          role: "manager",
          siteId: record.siteId,
          entity: "AttendanceRecord",
          action: "CORRECT_ATTENDANCE",
          previousValue: JSON.stringify({ clockIn: oldClockIn, clockOut: oldClockOut, schedStart: oldSchedStart, schedEnd: oldSchedEnd }),
          newValue: JSON.stringify({ clockIn: clockIn || "None", clockOut: clockOut || "None", schedStart: scheduledStartTime || oldSchedStart, schedEnd: scheduledEndTime || oldSchedEnd }),
          reason: reason.trim(),
          source: "web",
        },
      })

      return record
    })

    return NextResponse.json({
      success: true,
      record: updated,
    })
  } catch (error: any) {
    console.error("PUT /api/attendance/[id] error:", error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
