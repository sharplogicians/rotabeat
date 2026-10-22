 import { apiUrl } from '@/lib/api';
import type { AttendanceRecord, ClockEvent, Shift } from "./types"
import { timeToMinutes, isoToLocalTime } from "./date-utils"

export const ROUNDING_MINUTES = 5 // demo assumption
export const LATE_THRESHOLD_MINUTES = 5
export const EARLY_CLOCK_IN_ALLOWANCE_MINUTES = 15
export const WEEKLY_OVERTIME_THRESHOLD = 40

function roundToNearest(minutesSinceMidnight: number, step: number): number {
  return Math.round(minutesSinceMidnight / step) * step
}

/** Minutes between two ISO timestamps, always >= 0. */
function minutesBetween(startIso: string, endIso: string): number {
  return Math.max(0, (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)
}

export interface WorkedTotals {
  clockInAt?: string
  clockOutAt?: string
  breakMinutes: number
  grossMinutes: number // clock-in to clock-out, before break deduction
  payableMinutes: number // rounded, after break deduction
  hasOpenBreak: boolean
  missingClockIn: boolean
  missingClockOut: boolean
}

export function computeWorkedTotals(events: ClockEvent[]): WorkedTotals {
  const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const clockIn = sorted.find((e) => e.type === "clock_in")
  const clockOut = [...sorted].reverse().find((e) => e.type === "clock_out")

  let breakMinutes = 0
  let hasOpenBreak = false
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].type === "break_start") {
      const end = sorted.slice(i + 1).find((e) => e.type === "break_end")
      if (end) {
        breakMinutes += minutesBetween(sorted[i].timestamp, end.timestamp)
      } else {
        hasOpenBreak = true
      }
    }
  }

  const grossMinutes = clockIn && clockOut ? minutesBetween(clockIn.timestamp, clockOut.timestamp) : 0
  const payableRaw = Math.max(0, grossMinutes - breakMinutes)
  const payableMinutes = clockIn && clockOut ? roundToNearest(payableRaw, ROUNDING_MINUTES) : 0

  return {
    clockInAt: clockIn?.timestamp,
    clockOutAt: clockOut?.timestamp,
    breakMinutes,
    grossMinutes,
    payableMinutes,
    hasOpenBreak,
    missingClockIn: !clockIn,
    missingClockOut: !clockOut,
  }
}

export function shiftSpanMinutes(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  return end > start ? end - start : end + 1440 - start
}

export function scheduledMinutes(shift: { startTime: string; endTime: string; unpaidBreakMinutes: number }): number {
  const span = shiftSpanMinutes(shift.startTime, shift.endTime)
  return Math.max(0, span - (shift.unpaidBreakMinutes || 0))
}

export function minutesToHours(mins: number): number {
  return Math.round((mins / 60) * 100) / 100
}

export interface ShiftConflict {
  shiftId: string
  employeeId: string
  type: "overlap" | "inactive" | "invalid_time" | "excessive_break"
  message: string
}

export function detectShiftConflicts(shifts: Shift[], employees: { id: string; firstName: string; lastName: string; status: string }[]): ShiftConflict[] {
  const conflicts: ShiftConflict[] = []
  const empMap = new Map(employees.map((e) => [e.id, e]))

  // Group shifts by employee and date
  const grouped = new Map<string, Shift[]>()
  for (const s of shifts) {
    const key = `${s.employeeId}|${s.date}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(s)
  }

  for (const s of shifts) {
    const emp = empMap.get(s.employeeId)
    if (emp && emp.status !== "active") {
      conflicts.push({
        shiftId: s.id,
        employeeId: s.employeeId,
        type: "inactive",
        message: `${emp.firstName} ${emp.lastName} is ${emp.status}`,
      })
    }

    const span = shiftSpanMinutes(s.startTime, s.endTime)
    if (s.unpaidBreakMinutes > span) {
      conflicts.push({
        shiftId: s.id,
        employeeId: s.employeeId,
        type: "excessive_break",
        message: `Break (${s.unpaidBreakMinutes}m) exceeds shift duration (${span}m)`,
      })
    }
  }

  // Check overlaps
  for (const [, dayShifts] of grouped.entries()) {
    if (dayShifts.length <= 1) continue
    for (let i = 0; i < dayShifts.length; i++) {
      for (let j = i + 1; j < dayShifts.length; j++) {
        const a = dayShifts[i]
        const b = dayShifts[j]
        const aStart = timeToMinutes(a.startTime)
        let aEnd = timeToMinutes(a.endTime)
        if (aEnd <= aStart) aEnd += 1440

        const bStart = timeToMinutes(b.startTime)
        let bEnd = timeToMinutes(b.endTime)
        if (bEnd <= bStart) bEnd += 1440

        if (aStart < bEnd && aEnd > bStart) {
          const emp = empMap.get(a.employeeId)
          const name = emp ? `${emp.firstName} ${emp.lastName}` : "Employee"
          conflicts.push({
            shiftId: a.id,
            employeeId: a.employeeId,
            type: "overlap",
            message: `${name} has overlapping shifts on ${a.date}`,
          })
          conflicts.push({
            shiftId: b.id,
            employeeId: b.employeeId,
            type: "overlap",
            message: `${name} has overlapping shifts on ${b.date}`,
          })
        }
      }
    }
  }

  return conflicts
}

/** Split a week's total payable minutes into regular + overtime hours. */
export function splitOvertime(totalPayableMinutes: number, thresholdHours = WEEKLY_OVERTIME_THRESHOLD) {
  const totalHours = minutesToHours(totalPayableMinutes)
  const regular = Math.min(totalHours, thresholdHours)
  const overtime = Math.max(0, totalHours - thresholdHours)
  return { regular, overtime }
}

export function attendanceStatusLabel(status: AttendanceRecord["status"]): string {
  switch (status) {
    case "normal":
      return "Normal"
    case "exception":
      return "Needs review"
    case "corrected":
      return "Corrected"
    case "reviewed":
      return "Reviewed"
  }
}

export const EXCEPTION_LABELS: Record<string, string> = {
  late_arrival: "Late arrival",
  early_departure: "Early departure",
  missing_clock_in: "Missing clock-in",
  missing_clock_out: "Missing clock-out",
  missing_break_end: "Missing break end",
  absent: "Absent",
  unplanned_attendance: "Unplanned attendance",
  invalid_event_sequence: "Invalid event sequence",
  overtime: "Overtime",
  other: "Other exception",
}

export const EXCEPTION_SEVERITY: Record<string, "high" | "medium" | "low"> = {
  absent: "high",
  missing_clock_in: "high",
  missing_clock_out: "high",
  invalid_event_sequence: "high",
  missing_break_end: "medium",
  late_arrival: "medium",
  early_departure: "medium",
  unplanned_attendance: "low",
  overtime: "low",
  other: "low",
}

/**
 * Validates time inputs for attendance manual creation / correction.
 */
export function validateCorrectionTimes(
  clockIn?: string,
  breakStart?: string,
  breakEnd?: string,
  clockOut?: string,
  reason?: string
): { valid: boolean; error?: string } {
  if (!reason || !reason.trim()) {
    return { valid: false, error: "Reason is required. Please provide a reason for this attendance change." }
  }

  if (clockIn && clockOut) {
    const inMins = timeToMinutes(clockIn)
    const outMins = timeToMinutes(clockOut)
    if (outMins < inMins) {
      return { valid: false, error: "Clock Out time cannot be before Clock In time." }
    }
  }

  if (breakStart && clockIn) {
    if (timeToMinutes(breakStart) < timeToMinutes(clockIn)) {
      return { valid: false, error: "Break Start cannot be before Clock In." }
    }
  }

  if (breakEnd && breakStart) {
    if (timeToMinutes(breakEnd) < timeToMinutes(breakStart)) {
      return { valid: false, error: "Break End cannot be before Break Start." }
    }
  }

  if (breakEnd && clockOut) {
    if (timeToMinutes(breakEnd) > timeToMinutes(clockOut)) {
      return { valid: false, error: "Break End cannot be after Clock Out." }
    }
  }

  return { valid: true }
}

/**
 * Evaluates clock events and scheduled shift to produce structured attendance exceptions.
 */
export function detectAttendanceExceptions(
  events: ClockEvent[],
  shift?: { startTime: string; endTime: string } | null
): import("./types").ExceptionType[] {
  const exceptions: import("./types").ExceptionType[] = []
  if (!events || events.length === 0) return exceptions

  const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const clockIn = sorted.find((e) => e.type === "clock_in")
  const clockOut = [...sorted].reverse().find((e) => e.type === "clock_out")

  // Check invalid event sequence
  let invalidSeq = false
  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i]
    if (ev.type === "break_start" && !clockIn) invalidSeq = true
    if (ev.type === "break_end" && !sorted.slice(0, i).some((x) => x.type === "break_start")) invalidSeq = true
    if (ev.type === "clock_out" && !clockIn) invalidSeq = true
  }
  if (invalidSeq) exceptions.push("invalid_event_sequence")

  // Missing clock in / out
  if (!clockIn) exceptions.push("missing_clock_in")
  if (clockIn && !clockOut) exceptions.push("missing_clock_out")

  // Missing break end
  const breakStarts = sorted.filter((e) => e.type === "break_start")
  const breakEnds = sorted.filter((e) => e.type === "break_end")
  if (breakStarts.length > breakEnds.length) {
    exceptions.push("missing_break_end")
  }

  // Unplanned attendance
  if (!shift && clockIn) {
    exceptions.push("unplanned_attendance")
  }

  // Shift schedule comparisons
  if (shift) {
    if (clockIn) {
      const actualInTime = isoToLocalTime(clockIn.timestamp)
      if (actualInTime && timeToMinutes(actualInTime) > timeToMinutes(shift.startTime)) {
        exceptions.push("late_arrival")
      }
    }
    if (clockOut) {
      const actualOutTime = isoToLocalTime(clockOut.timestamp)
      if (actualOutTime && timeToMinutes(shift.endTime) - timeToMinutes(actualOutTime) > LATE_THRESHOLD_MINUTES) {
        exceptions.push("early_departure")
      }
    }
  }

  return exceptions
}

export type LiveAttendanceStatus = "clocked_in" | "late" | "absent" | "missing_clock_out" | "not_started" | "finished"

export interface LiveStatusResult {
  status: LiveAttendanceStatus
  label: string
  color: "success" | "warning" | "destructive" | "secondary" | "outline"
}

export function classifyLiveAttendanceStatus(
  shift?: Shift | null,
  record?: AttendanceRecord | null,
  nowIso?: string
): LiveStatusResult {
  // Robust Absent Check
  let isAbsent = false
  if (record) {
    if (Array.isArray(record.exceptions) && record.exceptions.includes("absent")) {
      isAbsent = true
    }
    if ((record.status as any) === "absent" || (record as any).source === "manager_absent") {
      isAbsent = true
    }
    if (typeof (record as any).exceptionsJson === "string" && (record as any).exceptionsJson.includes("absent")) {
      isAbsent = true
    }
    if (record.correctionReason && record.correctionReason.toLowerCase().includes("absent")) {
      isAbsent = true
    }
    if ((!record.events || record.events.length === 0) && (record.source === "manager_manual" || record.source === "manager_correction")) {
      isAbsent = true
    }
  }

  if (isAbsent) {
    return { status: "absent", label: "Absent", color: "destructive" }
  }

  const totals = computeWorkedTotals(record?.events || [])

  // Currently Clocked In
  if (totals.clockInAt && !totals.clockOutAt) {
    if (shift) {
      const now = nowIso ? new Date(nowIso) : new Date()
      const nowMins = now.getHours() * 60 + now.getMinutes()
      const endMins = timeToMinutes(shift.endTime)
      if (nowMins > endMins + 15) {
        return { status: "missing_clock_out", label: "Missing Clock-out", color: "destructive" }
      }

      const actualInTime = isoToLocalTime(totals.clockInAt)
      if (actualInTime && timeToMinutes(actualInTime) > timeToMinutes(shift.startTime)) {
        return { status: "late", label: "Late (Clocked In)", color: "warning" }
      }
    }
    return { status: "clocked_in", label: "Clocked In", color: "success" }
  }

  // Finished Shift
  if (totals.clockInAt && totals.clockOutAt) {
    if (shift) {
      const actualInTime = isoToLocalTime(totals.clockInAt)
      if (actualInTime && timeToMinutes(actualInTime) > timeToMinutes(shift.startTime)) {
        return { status: "late", label: "Late (Finished)", color: "warning" }
      }
    }
    return { status: "finished", label: "Finished", color: "secondary" }
  }

  // Not Clocked In Yet
  if (shift) {
    const now = nowIso ? new Date(nowIso) : new Date()
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const startMins = timeToMinutes(shift.startTime)
    const endMins = timeToMinutes(shift.endTime)

    if (nowMins > endMins) {
      return { status: "absent", label: "Absent", color: "destructive" }
    }
    if (nowMins > startMins) {
      return { status: "late", label: "Late (Not Clocked In)", color: "warning" }
    }
  }

  return { status: "not_started", label: "Not Started", color: "outline" }
}
