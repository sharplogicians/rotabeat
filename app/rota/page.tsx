"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { apiUrl } from '@/lib/api';
import { toast } from "sonner"
import { AdminShell } from "@/components/shell/admin-shell"
import { ShiftDialog } from "@/components/rota/shift-dialog"
import { useAppStore, useCurrentSite } from "@/lib/store"
import {
  addDays,
  dayOfWeekShort,
  formatDateLong,
  formatTime12,
  formatWeekRange,
  weekDays,
  CURRENT_WEEK_START,
} from "@/lib/date-utils"
import { minutesToHours, scheduledMinutes, detectShiftConflicts, type ShiftConflict } from "@/lib/calc"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  Lock,
  LockOpen,
  Plus,
  Send,
  AlertTriangle,
  Clock,
  Calendar,
} from "lucide-react"
import type { Employee, Shift } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function RotaPage() {
  const router = useRouter()
  const { state, dispatch } = useAppStore()
  const site = useCurrentSite()
  const weekStart = state.currentWeekStart
  const days = React.useMemo(() => weekDays(weekStart), [weekStart])
  const weekEnd = React.useMemo(() => addDays(weekStart, 6), [weekStart])

  const [rotaStatus, setRotaStatus] = React.useState<"draft" | "published" | "locked">("draft")
  const [shifts, setShifts] = React.useState<Shift[]>([])
  const [loading, setLoading] = React.useState(true)

  const [dialogState, setDialogState] = React.useState<{ employee: Employee; date: string; shift?: Shift } | null>(
    null,
  )
  const [attendanceRecords, setAttendanceRecords] = React.useState<any[]>([])
  const [attendancePopupState, setAttendancePopupState] = React.useState<{
    employee: Employee
    date: string
    shift?: Shift
    record: any
  } | null>(null)
  const [copyConfirmOpen, setCopyConfirmOpen] = React.useState(false)
  const [publishModalOpen, setPublishModalOpen] = React.useState(false)
  const [activeConflicts, setActiveConflicts] = React.useState<ShiftConflict[]>([])

  // Load employees for current site
  const employees = React.useMemo(() => {
    return state.employees
      .filter((e) => e.primarySiteId === site?.id)
      .sort((a, b) => a.firstName.localeCompare(b.firstName))
  }, [state.employees, site?.id])

  // Load shifts & rota status from API/store
  const fetchRotaData = React.useCallback(async () => {
    if (!site?.id || !weekStart) return
    setLoading(true)
    try {
      // 1. Fetch Rota Status
      const rotaRes = await fetch(apiUrl(`/api/rota?siteId=${site.id}&weekStart=${weekStart}`))
      const rotaData = await rotaRes.json()
      if (rotaData.success && rotaData.rota) {
        setRotaStatus(rotaData.rota.status as any)
      } else {
        setRotaStatus("draft")
      }

      // 2. Fetch Shifts for week
      const shiftRes = await fetch(apiUrl(`/api/shifts?siteId=${site.id}&weekStart=${weekStart}&endDate=${weekEnd}`))
      const shiftData = await shiftRes.json()
      if (shiftData.success && Array.isArray(shiftData.shifts)) {
        setShifts(shiftData.shifts)
      } else {
        setShifts(state.shifts.filter((s) => s.siteId === site.id && s.date >= weekStart && s.date <= weekEnd))
      }

      // 3. Fetch attendance records for this site
      const attRes = await fetch(apiUrl(`/api/attendance?siteId=${site.id}`))
      const attData = await attRes.json()
      if (attData.success && Array.isArray(attData.records)) {
        setAttendanceRecords(attData.records)
        attData.records.forEach((rec: any) => {
          dispatch({
            type: "CORRECT_ATTENDANCE",
            attendanceId: rec.id,
            employeeId: rec.employeeId,
            siteId: rec.siteId,
            date: rec.date,
            shiftId: rec.shiftId,
            events: rec.events,
            exceptions: rec.exceptions,
            reason: rec.correctionReason || "",
            actorName: rec.correctedBy || "System",
          })
        })
      }
    } catch (e) {
      console.error("Failed to load rota data:", e)
      setShifts(state.shifts.filter((s) => s.siteId === site?.id && s.date >= weekStart && s.date <= weekEnd))
    } finally {
      setLoading(false)
    }
  }, [site?.id, weekStart, weekEnd, state.shifts, dispatch])

  React.useEffect(() => {
    fetchRotaData()
  }, [fetchRotaData])

  // Conflict calculations
  const conflicts = React.useMemo(() => {
    return detectShiftConflicts(shifts, employees)
  }, [shifts, employees])

  const conflictShiftIds = React.useMemo(() => {
    return new Set(conflicts.map((c) => c.shiftId))
  }, [conflicts])

  // Shift lookup map
  const shiftsByEmployeeAndDate = React.useMemo(() => {
    const map = new Map<string, Shift>()
    for (const shift of shifts) {
      map.set(`${shift.employeeId}|${shift.date}`, shift)
    }
    return map
  }, [shifts])

  // Attendance lookup map
  const attendanceByEmployeeAndDate = React.useMemo(() => {
    const map = new Map<string, any>()
    for (const rec of state.attendance) {
      if (rec.siteId === site?.id || !rec.siteId) {
        map.set(`${rec.employeeId}|${rec.date}`, rec)
      }
    }
    for (const rec of attendanceRecords) {
      map.set(`${rec.employeeId}|${rec.date}`, rec)
    }
    return map
  }, [state.attendance, attendanceRecords, site?.id])

  function handleCellClick(emp: Employee, d: string, shift?: Shift) {
    if (!canEdit) return

    const existingAtt = attendanceByEmployeeAndDate.get(`${emp.id}|${d}`)
    if (existingAtt) {
      setAttendancePopupState({
        employee: emp,
        date: d,
        shift,
        record: existingAtt,
      })
      return
    }

    setDialogState({ employee: emp, date: d, shift })
  }

  // Weekly Total Scheduled Hours
  const weekTotalHours = React.useMemo(() => {
    return employees.reduce((sum, emp) => {
      const empMinutes = days.reduce((s, d) => {
        const shift = shiftsByEmployeeAndDate.get(`${emp.id}|${d}`)
        return s + (shift ? scheduledMinutes(shift) : 0)
      }, 0)
      return sum + empMinutes
    }, 0)
  }, [employees, days, shiftsByEmployeeAndDate])

  const isLocked = rotaStatus === "locked"
  const isOwnerOrAdmin = state.role === "business_owner" || state.role === "head_office"
  const canEdit = !isLocked

  // Week navigation controls
  function handlePrevWeek() {
    const prevDate = addDays(weekStart, -7)
    dispatch({ type: "SET_WEEK", weekStart: prevDate })
  }

  function handleNextWeek() {
    const nextDate = addDays(weekStart, 7)
    dispatch({ type: "SET_WEEK", weekStart: nextDate })
  }

  function handleCurrentWeek() {
    dispatch({ type: "SET_WEEK", weekStart: CURRENT_WEEK_START })
  }

  // Pre-publish validation & publishing
  function handleRequestPublish() {
    if (!site) return
    if (conflicts.length > 0) {
      setActiveConflicts(conflicts)
      setPublishModalOpen(true)
    } else {
      executePublish()
    }
  }

  async function executePublish() {
    if (!site) return
    try {
      const res = await fetch(apiUrl("/api/rota"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: site.id,
          weekStart,
          status: "published",
        }),
      })
      const data = await res.json()
      if (data.success) {
        setRotaStatus("published")
        dispatch({ type: "SET_ROTA_STATUS", siteId: site.id, weekStart, status: "published" })
        toast.success(`Published rota for ${formatWeekRange(weekStart)}`)
      } else {
        toast.error(data.message || "Failed to publish rota.")
      }
    } catch {
      toast.error("Failed to publish rota.")
    } finally {
      setPublishModalOpen(false)
    }
  }

  async function handleToggleLock() {
    if (!site) return
    const nextStatus = isLocked ? "published" : "locked"
    try {
      const res = await fetch(apiUrl("/api/rota"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: site.id,
          weekStart,
          status: nextStatus,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setRotaStatus(nextStatus)
        dispatch({ type: "SET_ROTA_STATUS", siteId: site.id, weekStart, status: nextStatus })
        toast.success(nextStatus === "locked" ? "🔒 Rota locked for editing" : "🔓 Rota unlocked")
      } else {
        toast.error(data.message || "Failed to change lock status.")
      }
    } catch {
      toast.error("Failed to update lock status.")
    }
  }

  async function handleCopyPrevious() {
    if (!site) return
    const prevStart = addDays(weekStart, -7)
    try {
      const res = await fetch(apiUrl("/api/rota/copy-previous"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: site.id,
          fromWeekStart: prevStart,
          toWeekStart: weekStart,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message || "Copied previous week's shifts as a new Draft")
        fetchRotaData()
      } else {
        toast.error(data.message || "No shifts found in previous week to copy.")
      }
    } catch {
      toast.error("Failed to copy previous week's rota.")
    } finally {
      setCopyConfirmOpen(false)
    }
  }

  return (
    <AdminShell crumbs={[{ label: "Weekly Rota" }]}>
      <div className="flex flex-col gap-6 min-w-0 max-w-full">
        {/* Header section */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold font-heading tracking-tight text-balance">Weekly Rota</h1>
              <Badge variant={rotaStatus === "published" ? "default" : rotaStatus === "locked" ? "secondary" : "outline"}>
                {rotaStatus === "published" ? "Published" : rotaStatus === "locked" ? "Locked" : "Draft"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {site?.name} — {site?.town} · {formatWeekRange(weekStart)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCopyConfirmOpen(true)} disabled={!canEdit}>
              <CopyPlus data-icon="inline-start" />
              Copy previous week
            </Button>
            {isOwnerOrAdmin && (
              <Button variant="outline" size="sm" onClick={handleToggleLock}>
                {isLocked ? <LockOpen data-icon="inline-start" /> : <Lock data-icon="inline-start" />}
                {isLocked ? "Unlock week" : "Lock week"}
              </Button>
            )}
            <Button size="sm" onClick={handleRequestPublish} disabled={!canEdit || rotaStatus === "published"}>
              <Send data-icon="inline-start" />
              Publish rota
            </Button>
          </div>
        </div>

        {/* Navigation & Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevWeek}>
              <ChevronLeft data-icon="inline-start" />
              Prev Week
            </Button>
            <Button variant="secondary" size="sm" onClick={handleCurrentWeek}>
              Current Week
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextWeek}>
              Next Week
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Week starting:</span>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => e.target.value && dispatch({ type: "SET_WEEK", weekStart: e.target.value })}
              className="flex h-8 rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm"
            />
          </div>
        </div>

        {/* Lock Banner */}
        {isLocked && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm font-medium text-muted-foreground">
            <Lock className="size-4 text-amber-500" />
            <span>🔒 Rota Locked. Shifts cannot be added, edited, or removed until the week is unlocked.</span>
          </div>
        )}

        {/* Conflicts Warning Banner */}
        {conflicts.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              <strong>{conflicts.length} scheduling {conflicts.length === 1 ? "warning" : "warnings"} detected:</strong>{" "}
              {conflicts[0]?.message} {conflicts.length > 1 ? `(+${conflicts.length - 1} more)` : ""}
            </span>
          </div>
        )}

        {/* Main Grid Table Card */}
        <Card className="overflow-hidden min-w-0 max-w-full">
          <CardHeader className="border-b border-border flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm">
                {employees.length} {employees.length === 1 ? "employee" : "employees"} listed
              </CardTitle>
              <CardDescription>
                {minutesToHours(weekTotalHours).toFixed(1)} total scheduled hours this week
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Clock className="size-3.5" />
              <span>{minutesToHours(weekTotalHours).toFixed(1)}h Total</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading rota schedule…</div>
            ) : employees.length === 0 ? (
              <Empty className="py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CalendarDays />
                  </EmptyMedia>
                  <EmptyTitle>No employees at this location</EmptyTitle>
                  <EmptyDescription>Add active employees to the directory to start scheduling shifts.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="overflow-x-auto min-w-0 max-w-full">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="sticky left-0 z-10 bg-muted px-4 py-2.5 text-left font-medium text-muted-foreground shadow-[1px_0_0_0_var(--color-border)]">
                        Employee
                      </th>
                      {days.map((d) => (
                        <th key={d} className="min-w-36 px-2 py-2.5 text-left font-medium text-muted-foreground">
                          <div className="flex flex-col">
                            <span>{dayOfWeekShort(d)}</span>
                            <span className="text-xs font-normal">{formatDateLong(d).split(" ").slice(0, 2).join(" ")}</span>
                          </div>
                        </th>
                      ))}
                      <th className="min-w-24 px-4 py-2.5 text-right font-medium text-muted-foreground">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => {
                      const empMinutes = days.reduce((s, d) => {
                        const shift = shiftsByEmployeeAndDate.get(`${emp.id}|${d}`)
                        return s + (shift ? scheduledMinutes(shift) : 0)
                      }, 0)

                      return (
                        <tr key={emp.id} className="border-b border-border last:border-0">
                          <td className="sticky left-0 z-10 bg-card px-4 py-2.5 shadow-[1px_0_0_0_var(--color-border)]">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="size-7">
                                <AvatarFallback className="text-xs">
                                  {emp.firstName[0]}
                                  {emp.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex min-w-0 flex-col">
                                <span className="truncate text-sm font-medium">
                                  {emp.firstName} {emp.lastName}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">{emp.jobTitle}</span>
                              </div>
                            </div>
                          </td>
                          {days.map((d) => {
                            const shift = shiftsByEmployeeAndDate.get(`${emp.id}|${d}`)
                            const hasConflict = shift && conflictShiftIds.has(shift.id)
                            const attendance = attendanceByEmployeeAndDate.get(`${emp.id}|${d}`)

                            return (
                              <td key={d} className="px-2 py-2.5 align-top">
                                {shift ? (
                                  <button
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() => handleCellClick(emp, d, shift)}
                                    className={cn(
                                      "flex w-full flex-col items-start gap-0.5 rounded-md border px-2 py-1.5 text-left transition-colors",
                                      hasConflict
                                        ? "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                                        : attendance
                                        ? "border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15"
                                        : "border-primary/20 bg-primary/10 hover:bg-primary/15",
                                      !canEdit && "cursor-not-allowed opacity-70 hover:bg-primary/10"
                                    )}
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span className="text-xs font-semibold text-primary">
                                        {formatTime12(shift.startTime)}–{formatTime12(shift.endTime)}
                                      </span>
                                      {hasConflict && <AlertTriangle className="size-3 text-amber-500" />}
                                    </div>
                                    <span className="truncate text-xs text-muted-foreground">{shift.role}</span>
                                    {attendance && (
                                      <div className="mt-0.5 flex items-center gap-1 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1 py-0.5 text-[9px] font-semibold">
                                        <Clock className="size-2.5" />
                                        <span>Attendance Added</span>
                                      </div>
                                    )}
                                    <div className="mt-0.5 flex items-center justify-between w-full text-[10px] text-muted-foreground border-t border-border/40 pt-0.5">
                                      <span>{shift.unpaidBreakMinutes}m break</span>
                                      <span className="font-semibold text-foreground">
                                        {minutesToHours(scheduledMinutes(shift)).toFixed(1)}h
                                      </span>
                                    </div>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() => handleCellClick(emp, d)}
                                    className={cn(
                                      "group flex w-full flex-col items-start justify-between rounded-md border border-dashed px-2 py-2 text-xs transition-colors",
                                      attendance
                                        ? "border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/15"
                                        : "border-border/80 hover:border-primary/40 hover:bg-muted/30",
                                      !canEdit && "cursor-not-allowed opacity-40 hover:border-border"
                                    )}
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span className={cn("font-medium", attendance ? "text-amber-700 dark:text-amber-400 font-semibold" : "text-muted-foreground/70 group-hover:text-primary")}>
                                        {attendance ? "Off (Clocked)" : "Off"}
                                      </span>
                                      {attendance ? (
                                        <AlertTriangle className="size-3 text-amber-500" />
                                      ) : (
                                        <Plus className="size-3 text-muted-foreground/40 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                      )}
                                    </div>
                                    {attendance && (
                                      <span className="text-[9px] text-amber-600 dark:text-amber-300 font-medium mt-0.5">
                                        Attendance Added
                                      </span>
                                    )}
                                  </button>
                                )}
                              </td>
                            )
                          })}
                          <td className="px-4 py-2.5 text-right text-sm font-semibold">
                            {minutesToHours(empMinutes).toFixed(1)}h
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit Shift Dialog */}
      {site && (
        <ShiftDialog
          open={Boolean(dialogState)}
          onOpenChange={(o) => !o && setDialogState(null)}
          employee={dialogState?.employee ?? null}
          date={dialogState?.date ?? null}
          shift={dialogState?.shift}
          siteId={site.id}
          onShiftSaved={fetchRotaData}
        />
      )}

      {/* Confirm Copy Previous Week Modal */}
      <AlertDialog open={copyConfirmOpen} onOpenChange={setCopyConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copy previous week&apos;s rota?</AlertDialogTitle>
            <AlertDialogDescription>
              This will copy all shifts from the previous week into {formatWeekRange(weekStart)} as a new <strong>Draft</strong> rota.
              Existing shifts for this week will be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCopyPrevious}>Copy shifts</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pre-Publish Conflict Warnings Modal (PRD Section 19) */}
      <AlertDialog open={publishModalOpen} onOpenChange={setPublishModalOpen}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-5" />
              Publish Rota with Warnings?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This rota contains <strong>{activeConflicts.length} {activeConflicts.length === 1 ? "warning" : "warnings"}</strong> that should be reviewed:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 text-xs space-y-2">
            {activeConflicts.map((c, idx) => (
              <div key={idx} className="flex items-start gap-2 text-foreground">
                <span className="font-semibold text-amber-600">•</span>
                <span>{c.message}</span>
              </div>
            ))}
          </div>

          <AlertDialogFooter className="gap-2 sm:justify-end">
            <AlertDialogCancel>Review Warnings</AlertDialogCancel>
            <AlertDialogAction onClick={executePublish} className="bg-primary">
              Publish Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Attendance Already Added Warning Popup for Rota */}
      <AlertDialog
        open={Boolean(attendancePopupState)}
        onOpenChange={(open) => !open && setAttendancePopupState(null)}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg font-bold">
                  {attendancePopupState?.shift ? "Attendance Already Added" : "Off (Clocked) · Unplanned Shift"}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground">
                  {attendancePopupState?.shift
                    ? "Actual attendance recorded on this date"
                    : "Employee worked on an unscheduled day off"}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          {attendancePopupState && (
            <div className="flex flex-col gap-3 py-2 text-sm">
              {!attendancePopupState.shift ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="size-4 shrink-0 text-amber-500 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-sm">
                      &quot;Off (Clocked)&quot; — Unplanned Shift
                    </span>
                    <span className="leading-relaxed">
                      <strong>&quot;Off (Clocked)&quot;</strong> means that the employee worked on their day off (also known as an <strong>Unplanned Shift</strong>).
                    </span>
                    <span className="text-muted-foreground leading-relaxed">
                      {attendancePopupState.employee.firstName} {attendancePopupState.employee.lastName} was marked as <strong>Off</strong> on the rota, but an attendance record was recorded for {formatDateLong(attendancePopupState.date)}.
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Attendance has already been recorded for{" "}
                  <strong className="text-foreground">
                    {attendancePopupState.employee.firstName} {attendancePopupState.employee.lastName}
                  </strong>{" "}
                  on <strong className="text-foreground">{formatDateLong(attendancePopupState.date)}</strong>.
                </p>
              )}

              <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-xs flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Rota Schedule:</span>
                  <span className="font-semibold text-foreground">
                    {attendancePopupState.shift
                      ? `${formatTime12(attendancePopupState.shift.startTime)} – ${formatTime12(attendancePopupState.shift.endTime)} (${attendancePopupState.shift.role})`
                      : "Off (No shift scheduled)"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Attendance Status:</span>
                  <span className="font-semibold capitalize text-foreground">
                    {attendancePopupState.record?.status || "Recorded"}
                  </span>
                </div>
                {attendancePopupState.record?.workedMinutes !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Recorded Worked Time:</span>
                    <span className="font-semibold text-foreground">
                      {minutesToHours(attendancePopupState.record.workedMinutes).toFixed(1)} hours
                    </span>
                  </div>
                )}
                {attendancePopupState.record?.events?.length > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Clock Events:</span>
                    <span className="font-medium text-foreground">
                      {attendancePopupState.record.events.length} event(s) recorded
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                {attendancePopupState.shift
                  ? "Modifying this rota shift after attendance has already been recorded will alter scheduled vs actual variance calculations on the timesheet and payroll export."
                  : "You can view their clocked attendance record, or click below to assign a formal shift to the rota for this day."}
              </p>
            </div>
          )}

          <AlertDialogFooter className="flex-row items-center justify-end gap-2 pt-2">
            <AlertDialogCancel
              onClick={() => setAttendancePopupState(null)}
              className="text-xs"
            >
              Cancel
            </AlertDialogCancel>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const empId = attendancePopupState?.employee.id
                setAttendancePopupState(null)
                router.push(`/attendance${empId ? `?employeeId=${empId}` : ""}`)
              }}
              className="text-xs"
            >
              View Attendance
            </Button>

            <AlertDialogAction
              onClick={() => {
                if (attendancePopupState) {
                  const { employee, date, shift } = attendancePopupState
                  setAttendancePopupState(null)
                  setDialogState({ employee, date, shift })
                }
              }}
              className="bg-primary text-primary-foreground text-xs"
            >
              {attendancePopupState?.shift ? "Edit Shift Anyway" : "Add Shift to Rota"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  )
}

