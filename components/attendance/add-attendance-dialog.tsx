"use client"

import { apiUrl } from "@/lib/api"
import * as React from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAppStore, useCurrentUser } from "@/lib/store"
import { TODAY_ISO, formatDateLong, formatTime12 } from "@/lib/date-utils"
import { validateCorrectionTimes } from "@/lib/calc"
import { AlertTriangle, Calendar, Clock, AlertCircle } from "lucide-react"
import type { AttendanceRecord, Employee, Shift } from "@/lib/types"

interface AddAttendanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  siteId: string
  onOpenCorrection?: (
    record: AttendanceRecord,
    employee: Employee,
    date: string,
    shift?: Shift
  ) => void
}

export function AddAttendanceDialog({
  open,
  onOpenChange,
  siteId,
  onOpenCorrection,
}: AddAttendanceDialogProps) {
  const { state, dispatch } = useAppStore()
  const actor = useCurrentUser()

  const [employeeId, setEmployeeId] = React.useState("")
  const [date, setDate] = React.useState(TODAY_ISO)
  const [clockIn, setClockIn] = React.useState("09:00")
  const [breakStart, setBreakStart] = React.useState("13:00")
  const [breakEnd, setBreakEnd] = React.useState("14:00")
  const [clockOut, setClockOut] = React.useState("17:00")
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [duplicateModalOpen, setDuplicateModalOpen] = React.useState(false)

  const activeEmployees = React.useMemo(() => {
    return state.employees.filter(
      (e) =>
        (e.primarySiteId === siteId || !e.primarySiteId) &&
        e.status === "active"
    )
  }, [state.employees, siteId])

  const selectedEmployee = React.useMemo(() => {
    return activeEmployees.find((e) => e.id === employeeId) || null
  }, [activeEmployees, employeeId])

  // Check if attendance record already exists for this employee and date
  const existingAttendance = React.useMemo(() => {
    if (!employeeId || !date) return null
    return (
      state.attendance.find(
        (a) => a.employeeId === employeeId && a.date === date
      ) || null
    )
  }, [state.attendance, employeeId, date])

  // Check if a Rota shift exists for this employee and date
  const rotaShift = React.useMemo(() => {
    if (!employeeId || !date) return null
    return (
      state.shifts.find(
        (s) => s.employeeId === employeeId && s.date === date
      ) || null
    )
  }, [state.shifts, employeeId, date])

  React.useEffect(() => {
    if (open) {
      if (activeEmployees.length > 0 && !employeeId) {
        setEmployeeId(activeEmployees[0].id)
      }

      setDate(TODAY_ISO)
      setClockIn("09:00")
      setBreakStart("13:00")
      setBreakEnd("14:00")
      setClockOut("17:00")
      setReason("")
      setError("")
      setDuplicateModalOpen(false)
    }
  }, [open, activeEmployees, employeeId])

  // Automatically update suggested times if rota shift is found for date
  React.useEffect(() => {
    if (rotaShift && open) {
      if (rotaShift.startTime) setClockIn(rotaShift.startTime)
      if (rotaShift.endTime) setClockOut(rotaShift.endTime)
    }
  }, [rotaShift, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!employeeId) {
      setError("Please select an employee.")
      return
    }

    // Guard: If attendance is already added for this date, trigger duplicate popup!
    if (existingAttendance) {
      setDuplicateModalOpen(true)
      return
    }

    const validation = validateCorrectionTimes(
      clockIn,
      breakStart,
      breakEnd,
      clockOut,
      reason
    )

    if (!validation.valid) {
      setError(validation.error || "Validation failed.")
      return
    }

    setSubmitting(true)
    setError("")

    try {
      // Call API
      const res = await fetch(apiUrl("/api/attendance"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId,
          siteId,
          date,
          clockIn,
          breakStart,
          breakEnd,
          clockOut,
          reason: reason.trim(),
          actorName: actor.name,
        }),
      })

      const data = await res.json()

      // If backend reports attendance already exists
      if (res.status === 409 || data.code === "ATTENDANCE_ALREADY_EXISTS") {
        setDuplicateModalOpen(true)
        setError(data.message || "Attendance has already been added for this date.")
        setSubmitting(false)
        return
      }

      if (!res.ok || !data.success) {
        throw new Error(
          data.message || "Failed to create manual attendance record."
        )
      }

      // Sync state store
      dispatch({
        type: "CORRECT_ATTENDANCE",
        attendanceId: data.record?.id,
        employeeId,
        siteId,
        date,
        events: [
          ...(clockIn
            ? [
                {
                  id: `evt-${Date.now()}-1`,
                  type: "clock_in" as const,
                  timestamp: `${date}T${clockIn}:00`,
                  source: "manager_manual" as const,
                },
              ]
            : []),

          ...(breakStart
            ? [
                {
                  id: `evt-${Date.now()}-2`,
                  type: "break_start" as const,
                  timestamp: `${date}T${breakStart}:00`,
                  source: "manager_manual" as const,
                },
              ]
            : []),

          ...(breakEnd
            ? [
                {
                  id: `evt-${Date.now()}-3`,
                  type: "break_end" as const,
                  timestamp: `${date}T${breakEnd}:00`,
                  source: "manager_manual" as const,
                },
              ]
            : []),

          ...(clockOut
            ? [
                {
                  id: `evt-${Date.now()}-4`,
                  type: "clock_out" as const,
                  timestamp: `${date}T${clockOut}:00`,
                  source: "manager_manual" as const,
                },
              ]
            : []),
        ],
        exceptions: data.record?.exceptions || [],
        reason: reason.trim(),
        actorName: actor.name,
      })

      toast.success(
        `Manually added attendance record for ${
          selectedEmployee ? selectedEmployee.firstName : "Employee"
        }`
      )

      onOpenChange(false)
    } catch (err: any) {
      setError(err.message || "Failed to create manual attendance.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Add Manual Attendance
            </DialogTitle>

            <DialogDescription>
              Manually enter a missing attendance record for an employee.
              A mandatory reason is required.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="employee">Employee</FieldLabel>

                <Select
                  value={employeeId}
                  onValueChange={(val) => {
                    setEmployeeId(val || "")
                    setError("")
                  }}
                >
                  <SelectTrigger id="employee">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>

                  <SelectContent>
                    {activeEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.jobTitle})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="date">Date</FieldLabel>

                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value)
                    setError("")
                  }}
                  required
                />
              </Field>

              {/* Rota shift info pill */}
              {rotaShift ? (
                <div className="flex items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-foreground">
                  <Calendar className="size-4 text-primary shrink-0" />
                  <span>
                    <strong>Rota Shift:</strong> {formatTime12(rotaShift.startTime)} – {formatTime12(rotaShift.endTime)} ({rotaShift.role})
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5 shrink-0" />
                  <span>No shift scheduled on Rota for this date (unplanned).</span>
                </div>
              )}

              {/* Duplicate Attendance Warning Banner */}
              {existingAttendance && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="size-4 shrink-0 text-amber-500 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold">Attendance Already Added</span>
                    <span>
                      An attendance record has already been saved for {selectedEmployee?.firstName || "this employee"} on {formatDateLong(date)}.
                      Duplicate records cannot be added for the same date.
                    </span>
                    <button
                      type="button"
                      onClick={() => setDuplicateModalOpen(true)}
                      className="mt-1 text-left font-semibold text-primary underline underline-offset-2 hover:opacity-80"
                    >
                      View details popup &rarr;
                    </button>
                  </div>
                </div>
              )}

              <FieldSet>
                <FieldLegend variant="label">Clock events</FieldLegend>

                <div className="grid grid-cols-2 gap-3 mt-1">
                  <Field>
                    <FieldLabel htmlFor="clockIn">Clock In</FieldLabel>

                    <Input
                      id="clockIn"
                      type="time"
                      value={clockIn}
                      onChange={(e) => setClockIn(e.target.value)}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="clockOut">Clock Out</FieldLabel>

                    <Input
                      id="clockOut"
                      type="time"
                      value={clockOut}
                      onChange={(e) => setClockOut(e.target.value)}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <Field>
                    <FieldLabel htmlFor="breakStart">Break Start</FieldLabel>

                    <Input
                      id="breakStart"
                      type="time"
                      value={breakStart}
                      onChange={(e) => setBreakStart(e.target.value)}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="breakEnd">Break End</FieldLabel>

                    <Input
                      id="breakEnd"
                      type="time"
                      value={breakEnd}
                      onChange={(e) => setBreakEnd(e.target.value)}
                    />
                  </Field>
                </div>
              </FieldSet>

              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="reason">
                  Reason for Manual Entry{" "}
                  <span className="text-red-500">*</span>
                </FieldLabel>

                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value)
                    setError("")
                  }}
                  placeholder="e.g. Employee forgot to clock in at the start of shift, verified with shift leader."
                  rows={3}
                  required
                />

                <FieldDescription>
                  Mandatory explanation for audit trail logging.
                </FieldDescription>
              </Field>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-md font-medium flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </FieldGroup>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={submitting}
                className={
                  existingAttendance
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }
              >
                {submitting
                  ? "Saving..."
                  : existingAttendance
                  ? "Attendance Already Added"
                  : "Create Attendance Record"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Duplicate Attendance Modal Popup */}
      <AlertDialog
        open={duplicateModalOpen}
        onOpenChange={setDuplicateModalOpen}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg font-bold">
                  Attendance Already Added
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground">
                  Duplicate attendance entry detected
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="flex flex-col gap-3 py-2 text-sm">
            <p className="text-muted-foreground">
              Attendance has already been added for{" "}
              <strong className="text-foreground">
                {selectedEmployee
                  ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`
                  : "this employee"}
              </strong>{" "}
              on <strong className="text-foreground">{formatDateLong(date)}</strong>.
            </p>

            <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-xs flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-semibold capitalize text-foreground">
                  {existingAttendance?.status || "Recorded"}
                </span>
              </div>
              {rotaShift && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Rota Schedule:</span>
                  <span className="font-medium text-foreground">
                    {formatTime12(rotaShift.startTime)} – {formatTime12(rotaShift.endTime)} ({rotaShift.role})
                  </span>
                </div>
              )}
              {existingAttendance?.events && existingAttendance.events.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Clock Events:</span>
                  <span className="font-medium text-foreground">
                    {existingAttendance.events.length} event(s) recorded
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              To update existing times, please open the record from the attendance table or use the correction drawer rather than creating a duplicate.
            </p>
          </div>

          <AlertDialogFooter className="flex-row items-center justify-end gap-2 pt-2">
            <AlertDialogCancel
              onClick={() => setDuplicateModalOpen(false)}
              className="text-xs"
            >
              Close
            </AlertDialogCancel>

            {onOpenCorrection && existingAttendance && selectedEmployee && (
              <AlertDialogAction
                onClick={() => {
                  setDuplicateModalOpen(false)
                  onOpenChange(false)
                  onOpenCorrection(
                    existingAttendance,
                    selectedEmployee,
                    date,
                    rotaShift || undefined
                  )
                }}
                className="bg-primary text-primary-foreground text-xs"
              >
                View / Correct Record
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}