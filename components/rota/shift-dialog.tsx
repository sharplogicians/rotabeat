"use client"

import { apiUrl } from "@/lib/api"

import * as React from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Copy, Trash2, Clock, AlertTriangle, CalendarX } from "lucide-react"
import { useAppStore } from "@/lib/store"
import type { Employee, Shift } from "@/lib/types"
import { formatDateLong, weekDays, dayOfWeekShort } from "@/lib/date-utils"
import { shiftSpanMinutes, minutesToHours } from "@/lib/calc"

const SHIFT_ROLES = [
  "Barista",
  "Shift Supervisor",
  "Kitchen Assistant",
  "Front of House",
  "Duty Manager",
  "Stock & Deliveries",
  "Bakery Assistant",
  "Baker",
  "Chef",
  "Server",
]

interface ShiftDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: Employee | null
  date: string | null
  shift?: Shift
  siteId: string
  onShiftSaved?: () => void
}

export function ShiftDialog({
  open,
  onOpenChange,
  employee,
  date,
  shift,
  siteId,
  onShiftSaved,
}: ShiftDialogProps) {
  const { state, dispatch } = useAppStore()
  const isEdit = Boolean(shift)

  const [role, setRole] = React.useState(
    shift?.role ?? employee?.jobTitle ?? SHIFT_ROLES[0]
  )
  const [startTime, setStartTime] = React.useState(
    shift?.startTime ?? "09:00"
  )
  const [endTime, setEndTime] = React.useState(
    shift?.endTime ?? "17:00"
  )
  const [breakMinutes, setBreakMinutes] = React.useState(
    String(shift?.unpaidBreakMinutes ?? 30)
  )
  const [notes, setNotes] = React.useState(shift?.notes ?? "")
  const [submitting, setSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // Copy to another day states
  const [showCopySection, setShowCopySection] = React.useState(false)
  const [copyTargetDate, setCopyTargetDate] = React.useState<string>("")

  const weekDateList = React.useMemo(() => {
    return weekDays(state.currentWeekStart)
  }, [state.currentWeekStart])

  // Check if attendance has already been added for this employee & date
  const existingAttendance = React.useMemo(() => {
    if (!employee || !date) return null
    return (
      state.attendance.find(
        (a) => a.employeeId === employee.id && a.date === date
      ) || null
    )
  }, [state.attendance, employee, date])

  React.useEffect(() => {
    if (open) {
      setRole(shift?.role ?? employee?.jobTitle ?? SHIFT_ROLES[0])
      setStartTime(shift?.startTime ?? "09:00")
      setEndTime(shift?.endTime ?? "17:00")
      setBreakMinutes(String(shift?.unpaidBreakMinutes ?? 30))
      setNotes(shift?.notes ?? "")
      setShowCopySection(false)
      setCopyTargetDate(
        weekDateList.find((d) => d !== date) || weekDateList[0] || ""
      )
      setErrors({})
    }
  }, [open, shift, employee, date, weekDateList])

  // Calculated hours
  const calculatedHours = React.useMemo(() => {
    if (!startTime || !endTime) {
      return {
        hours: 0,
        spanMins: 0,
        netMins: 0,
      }
    }

    const spanMins = shiftSpanMinutes(startTime, endTime)
    const bMins = Number(breakMinutes) || 0
    const netMins = Math.max(0, spanMins - bMins)

    return {
      hours: minutesToHours(netMins),
      spanMins,
      netMins,
    }
  }, [startTime, endTime, breakMinutes])

  function validate(): boolean {
    const next: Record<string, string> = {}
    const bMins = Number(breakMinutes) || 0

    if (!role.trim()) {
      next.role = "Role is required."
    }

    if (!startTime) {
      next.startTime = "Start time is required."
    }

    if (!endTime) {
      next.endTime = "End time is required."
    }

    if (bMins < 0) {
      next.breakMinutes = "Unpaid break duration cannot be negative."
    } else if (bMins > calculatedHours.spanMins) {
      next.breakMinutes = `Unpaid break (${bMins}m) cannot exceed shift duration (${calculatedHours.spanMins}m).`
    }

    if (employee && employee.status !== "active") {
      next.employee = `${employee.firstName} ${employee.lastName} is ${employee.status} and cannot be assigned to shifts.`
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  // Quick Day Off handler
  async function handleMarkOff() {
    if (!employee || !date) return

    if (existingAttendance) {
      if (
        !confirm(
          `Attendance has already been recorded for ${employee.firstName} on ${formatDateLong(date)}. Marking them as off will remove the scheduled shift and leave this as an unplanned attendance record. Do you want to continue?`
        )
      ) {
        return
      }
    }

    setSubmitting(true)

    try {
      if (shift) {
        const res = await fetch(apiUrl(`/api/shifts?id=${shift.id}`), {
          method: "DELETE",
        })

        const data = await res.json()

        if (data.success) {
          dispatch({
            type: "DELETE_SHIFT",
            shiftId: shift.id,
          })
        }
      }

      toast.success(
        `Marked ${employee.firstName} as Off on ${formatDateLong(date)}`
      )

      if (onShiftSaved) {
        onShiftSaved()
      }

      onOpenChange(false)
    } catch {
      toast.error("Failed to set day off.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!employee || !date || !validate()) {
      return
    }

    setSubmitting(true)

    const payload = {
      id: shift?.id,
      employeeId: employee.id,
      siteId,
      date,
      startTime,
      endTime,
      unpaidBreakMinutes: Number(breakMinutes) || 0,
      role: role.trim(),
      notes: notes.trim() || undefined,
    }

    try {
      const res = await fetch(apiUrl("/api/shifts"), {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to save shift.")
        setSubmitting(false)
        return
      }

      const savedShift: Shift = {
        id: data.shift.id,
        employeeId: data.shift.employeeId,
        siteId: data.shift.siteId,
        date: data.shift.date,
        startTime: data.shift.startTime,
        endTime: data.shift.endTime,
        unpaidBreakMinutes: data.shift.unpaidBreakMinutes,
        role: data.shift.role,
        notes: data.shift.notes ?? undefined,
      }

      if (isEdit) {
        dispatch({
          type: "UPDATE_SHIFT",
          shift: savedShift,
        })

        toast.success(`Updated ${employee.firstName}'s shift`)
      } else {
        dispatch({
          type: "ADD_SHIFT",
          shift: savedShift,
        })

        toast.success(
          `Added shift for ${employee.firstName} ${employee.lastName}`
        )
      }

      if (onShiftSaved) {
        onShiftSaved()
      }

      onOpenChange(false)
    } catch {
      toast.error("Network error while saving shift.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!shift) return

    if (!confirm("Are you sure you want to delete this shift?")) {
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch(apiUrl(`/api/shifts?id=${shift.id}`), {
        method: "DELETE",
      })

      const data = await res.json()

      if (data.success) {
        dispatch({
          type: "DELETE_SHIFT",
          shiftId: shift.id,
        })

        toast.success("Shift removed")

        if (onShiftSaved) {
          onShiftSaved()
        }

        onOpenChange(false)
      } else {
        toast.error(data.message || "Failed to delete shift.")
      }
    } catch {
      toast.error("Failed to delete shift.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopyShiftToDay() {
    if (!shift || !copyTargetDate) {
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch(apiUrl("/api/shifts/copy"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shiftId: shift.id,
          targetDate: copyTargetDate,
        }),
      })

      const data = await res.json()

      if (data.success) {
        dispatch({
          type: "ADD_SHIFT",
          shift: data.shift,
        })

        toast.success(
          `Shift copied to ${formatDateLong(copyTargetDate)}`
        )

        if (onShiftSaved) {
          onShiftSaved()
        }

        onOpenChange(false)
      } else {
        toast.error(data.message || "Failed to copy shift.")
      }
    } catch {
      toast.error("Failed to copy shift.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle>
              {isEdit ? "Edit shift" : "Add shift"}
            </DialogTitle>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-slate-700 border-slate-300 hover:bg-slate-100 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800"
              onClick={handleMarkOff}
              disabled={submitting}
            >
              <CalendarX data-icon="inline-start" />
              Mark as Off
            </Button>
          </div>

          <DialogDescription>
            {employee
              ? `${employee.firstName} ${employee.lastName}`
              : ""}
            {date ? ` — ${formatDateLong(date)}` : ""}
          </DialogDescription>
        </DialogHeader>

        {errors.employee && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{errors.employee}</span>
          </div>
        )}

        {existingAttendance && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="size-4 shrink-0 text-amber-500 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold">Attendance Already Added</span>
              <span>
                Attendance has already been recorded for this date ({minutesToHours(existingAttendance.workedMinutes || 0).toFixed(1)}h worked).
                Modifying scheduled times will alter attendance variances on timesheets.
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field data-invalid={Boolean(errors.role)}>
              <FieldLabel htmlFor="shiftRole">Role</FieldLabel>

              <Input
                id="shiftRole"
                list="shift-roles"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                aria-invalid={Boolean(errors.role)}
              />

              <datalist id="shift-roles">
                {SHIFT_ROLES.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>

              {errors.role && (
                <FieldDescription>{errors.role}</FieldDescription>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={Boolean(errors.startTime)}>
                <FieldLabel htmlFor="startTime">
                  Start time
                </FieldLabel>

                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  aria-invalid={Boolean(errors.startTime)}
                />

                {errors.startTime && (
                  <FieldDescription>
                    {errors.startTime}
                  </FieldDescription>
                )}
              </Field>

              <Field data-invalid={Boolean(errors.endTime)}>
                <FieldLabel htmlFor="endTime">
                  End time
                </FieldLabel>

                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  aria-invalid={Boolean(errors.endTime)}
                />

                {errors.endTime && (
                  <FieldDescription>
                    {errors.endTime}
                  </FieldDescription>
                )}
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.breakMinutes)}>
              <FieldLabel htmlFor="breakMinutes">
                Unpaid break (minutes)
              </FieldLabel>

              <Input
                id="breakMinutes"
                type="number"
                min="0"
                step="5"
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
                aria-invalid={Boolean(errors.breakMinutes)}
              />

              {errors.breakMinutes && (
                <FieldDescription>
                  {errors.breakMinutes}
                </FieldDescription>
              )}
            </Field>

            {/* Calculated Hours Display */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
              <div className="flex items-center gap-1.5 font-medium">
                <Clock className="size-3.5 text-primary" />
                <span>Scheduled Hours:</span>
              </div>

              <span className="font-semibold text-primary">
                {calculatedHours.hours.toFixed(1)}h (
                {calculatedHours.netMins} mins)
              </span>
            </div>

            <Field>
              <FieldLabel htmlFor="shiftNotes">
                Notes (optional)
              </FieldLabel>

              <Textarea
                id="shiftNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </Field>

            {/* Copy Shift to another day */}
            {isEdit && (
              <div className="rounded-lg border border-border bg-card p-3">
                <button
                  type="button"
                  onClick={() =>
                    setShowCopySection(!showCopySection)
                  }
                  className="flex items-center gap-2 text-xs font-medium text-primary hover:underline"
                >
                  <Copy className="size-3.5" />

                  {showCopySection
                    ? "Hide copy to day"
                    : "Copy shift to another day"}
                </button>

                {showCopySection && (
                  <div className="mt-3 flex items-center gap-2">
                    <select
                      value={copyTargetDate}
                      onChange={(e) =>
                        setCopyTargetDate(e.target.value)
                      }
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm"
                    >
                      {weekDateList.map((d) => (
                        <option key={d} value={d}>
                          {dayOfWeekShort(d)} —{" "}
                          {formatDateLong(d)}{" "}
                          {d === date ? "(Current)" : ""}
                        </option>
                      ))}
                    </select>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleCopyShiftToDay}
                      disabled={
                        submitting ||
                        !copyTargetDate ||
                        copyTargetDate === date
                      }
                    >
                      Copy
                    </Button>
                  </div>
                )}
              </div>
            )}
          </FieldGroup>

          <DialogFooter className="flex-row items-center sm:justify-between">
            {isEdit ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={handleDelete}
                disabled={submitting}
              >
                <Trash2 data-icon="inline-start" />
                Remove
              </Button>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <DialogClose
                render={
                  <Button type="button" variant="outline" />
                }
              >
                Cancel
              </DialogClose>

              <Button type="submit" disabled={submitting}>
                {submitting
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : "Add shift"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}