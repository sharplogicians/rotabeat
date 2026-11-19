"use client"

import * as React from "react"
import { apiUrl } from '@/lib/api';
import { AdminShell } from "@/components/shell/admin-shell"
import { CorrectionDrawer } from "@/components/attendance/correction-drawer"
import { AddAttendanceDialog } from "@/components/attendance/add-attendance-dialog"
import { AttendanceDetailsDialog } from "@/components/attendance/attendance-details-dialog"
import { AuditHistoryDialog } from "@/components/attendance/audit-history-dialog"
import { LateReviewDialog } from "@/components/attendance/late-review-dialog"
import { useAppStore, useCurrentSite, useCurrentUser } from "@/lib/store"
import { TODAY_ISO, formatDayMonth, formatTime12, formatTimestamp12, weekDays, addDays } from "@/lib/date-utils"
import { computeWorkedTotals, EXCEPTION_LABELS, attendanceStatusLabel } from "@/lib/calc"
import type { AttendanceRecord, Employee, Shift, ExceptionType } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import Link from "next/link"
import { ClipboardCheck, Pencil, Clock, History, Plus, Eye, Filter, Camera } from "lucide-react"

interface Row {
  key: string
  employee: Employee
  date: string
  shift?: Shift
  record?: AttendanceRecord
}

export default function AttendancePage() {
  const { state, dispatch } = useAppStore()
  const site = useCurrentSite()
  const actor = useCurrentUser()

  const [tabFilter, setTabFilter] = React.useState<"all" | "today" | "exceptions">("all")
  const [employeeFilter, setEmployeeFilter] = React.useState<string>("all")
  const [exceptionFilter, setExceptionFilter] = React.useState<string>("all")

  const [drawerRow, setDrawerRow] = React.useState<Row | null>(null)
  const [detailsRow, setDetailsRow] = React.useState<Row | null>(null)
  const [historyRow, setHistoryRow] = React.useState<Row | null>(null)
  const [lateReviewRecord, setLateReviewRecord] = React.useState<any>(null)
  const [addDialogOpen, setAddDialogOpen] = React.useState(false)

  const activeSiteId = site?.id || ""

  // Sync DB employees, shifts, and attendance records
  const loadDbData = React.useCallback(async () => {
    try {
      const empRes = await fetch(apiUrl("/api/employees"))
      if (empRes.ok) {
        const empData = await empRes.json()
        if (empData.success && Array.isArray(empData.employees) && empData.employees.length > 0) {
          dispatch({ type: "SET_EMPLOYEES", employees: empData.employees })
        }
      }

      const weekEnd = addDays(state.currentWeekStart, 6)
      const shiftRes = await fetch(apiUrl(`/api/shifts?siteId=${activeSiteId}&weekStart=${state.currentWeekStart}&endDate=${weekEnd}`))
      if (shiftRes.ok) {
        const shiftData = await shiftRes.json()
        if (shiftData.success && Array.isArray(shiftData.shifts)) {
          shiftData.shifts.forEach((s: any) => {
            dispatch({ type: "ADD_SHIFT", shift: s })
          })
        }
      }

      const attRes = await fetch(apiUrl(`/api/attendance?siteId=${activeSiteId}`))
      if (attRes.ok) {
        const attData = await attRes.json()
        if (attData.success && Array.isArray(attData.records)) {
          // Update attendance in state
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
              status: rec.status,
              reason: rec.correctionReason || "",
              actorName: rec.correctedBy || "System",
            })
          })
        }
      }
    } catch (err) {
      console.error("Failed to load attendance/employee/shift data from DB:", err)
    }
  }, [dispatch, activeSiteId, state.currentWeekStart])

  React.useEffect(() => {
    if (activeSiteId) {
      loadDbData()
    }
  }, [activeSiteId, loadDbData])

  // Include all days of the current week (Monday through Sunday)
  const days = weekDays(state.currentWeekStart)

  const rows: Row[] = React.useMemo(() => {
    if (!activeSiteId) return []
    const out: Row[] = []

    for (const date of days) {
      const processedEmpIds = new Set<string>()

      // 1. Scheduled shifts for this date & site
      const shiftsForDay = state.shifts.filter((s) => s.siteId === activeSiteId && s.date === date)
      for (const shift of shiftsForDay) {
        const employee = state.employees.find((e) => e.id === shift.employeeId)
        if (!employee) continue
        processedEmpIds.add(employee.id)
        const record = state.attendance.find((a) => a.shiftId === shift.id || (a.employeeId === employee.id && a.date === date))
        out.push({ key: `shift-${shift.id}-${date}`, employee, date, shift, record })
      }

      // 2. Unplanned or manual attendance records for this date & site (for employees without a shift)
      const unplanned = state.attendance.filter(
        (a) => a.siteId === activeSiteId && a.date === date && !processedEmpIds.has(a.employeeId)
      )
      for (const record of unplanned) {
        const employee = state.employees.find((e) => e.id === record.employeeId)
        if (!employee) continue
        processedEmpIds.add(employee.id)
        out.push({ key: `record-${record.id}-${date}`, employee, date, record })
      }
    }

    // 3. Ensure any attendance record belonging to the current week is never missed
    const weekDatesSet = new Set(days)
    const extraAttendance = state.attendance.filter(
      (a) => a.siteId === activeSiteId && weekDatesSet.has(a.date) && !out.some((r) => r.record?.id === a.id)
    )
    for (const record of extraAttendance) {
      const employee = state.employees.find((e) => e.id === record.employeeId)
      if (!employee) continue
      out.push({ key: `record-extra-${record.id}`, employee, date: record.date, record })
    }

    return out.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return a.employee.firstName.localeCompare(b.employee.firstName)
    })
  }, [state.shifts, state.attendance, state.employees, activeSiteId, days])

  const isRowLate = React.useCallback((r: Row): { isLate: boolean; minsLate: number } => {
    const events = r.record?.events || []
    const clockInEv = events.find((e) => e.type === "clock_in")
    const matchedShift = r.shift || state.shifts.find((s) => s.employeeId === r.employee.id && s.date === r.date)
    const shiftStartRaw = matchedShift?.startTime || r.record?.scheduledStartTime
    if (shiftStartRaw && clockInEv) {
      const [sH, sM] = shiftStartRaw.split(":").map(Number)
      const shiftMins = (sH || 0) * 60 + (sM || 0)
      const inD = new Date(clockInEv.timestamp)
      const inMins = inD.getHours() * 60 + inD.getMinutes()
      if (inMins > shiftMins + 5) {
        return { isLate: true, minsLate: Math.max(0, inMins - shiftMins) }
      }
    }
    return { isLate: false, minsLate: 0 }
  }, [state.shifts])

  const getRowExceptions = React.useCallback((r: Row): string[] => {
    const list = new Set<string>(r.record?.exceptions || [])
    if (isRowLate(r).isLate) {
      list.add("late_arrival")
    }
    return Array.from(list)
  }, [isRowLate])

  const exceptionCount = rows.filter((r) => r.record?.status === "exception" || getRowExceptions(r).length > 0).length
  const todayCount = rows.filter((r) => r.date === TODAY_ISO).length

  // Multi-tier filtering
  const visibleRows = React.useMemo(() => {
    let result = rows

    if (tabFilter === "today") result = result.filter((r) => r.date === TODAY_ISO)
    if (tabFilter === "exceptions") result = result.filter((r) => r.record?.status === "exception" || getRowExceptions(r).length > 0)

    if (employeeFilter !== "all") {
      result = result.filter((r) => r.employee.id === employeeFilter)
    }

    if (exceptionFilter !== "all") {
      result = result.filter((r) => getRowExceptions(r).includes(exceptionFilter))
    }

    return result
}, [rows, tabFilter, employeeFilter, exceptionFilter, getRowExceptions])

const siteEmployees = React.useMemo(() => {
  const empsFromState = state.employees.filter((e) => e.primarySiteId === activeSiteId)
  const empsFromRows = rows.map((r) => r.employee).filter(Boolean)
  const combined = [...empsFromState, ...empsFromRows]
  const seen = new Set<string>()
  const unique: Employee[] = []
  for (const e of combined) {
    if (!seen.has(e.id)) {
      seen.add(e.id)
      unique.push(e)
    }
  }
  return unique.sort((a, b) => a.firstName.localeCompare(b.firstName))
}, [state.employees, activeSiteId, rows])

const employeeSelectItems = React.useMemo(() => {
  return [
    { value: "all", label: "All Employees" },
    ...siteEmployees.map((e) => ({
      value: e.id,
      label: `${e.firstName} ${e.lastName}`,
    })),
  ]
}, [siteEmployees])

const selectedEmployeeLabel = React.useMemo(() => {
  if (employeeFilter === "all") return "All Employees"
  const emp = siteEmployees.find((e) => e.id === employeeFilter) || state.employees.find((e) => e.id === employeeFilter)
  return emp ? `${emp.firstName} ${emp.lastName}` : "All Employees"
}, [employeeFilter, siteEmployees, state.employees])

const EXCEPTION_LABELS: Record<string, string> = {
  all: "All Exceptions",
  late_arrival: "Late Arrival",
  early_departure: "Early Departure",
  missing_clock_out: "Missing Clock-Out",
  missing_break_end: "Missing Break End",
}

const EXCEPTION_SELECT_ITEMS = [
  { value: "all", label: "All Exceptions" },
  { value: "late_arrival", label: "Late Arrival" },
  { value: "early_departure", label: "Early Departure" },
  { value: "missing_clock_out", label: "Missing Clock-Out" },
  { value: "missing_break_end", label: "Missing Break End" },
]

if (state.sites.length === 0) {
  return (
    <AdminShell crumbs={[{ label: "Attendance" }]}>
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Clock className="text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>Location Required</EmptyTitle>
          <EmptyDescription>
            No locations have been added yet. Please add a business location first before recording or reviewing attendance.
          </EmptyDescription>
          {(state.role === "business_owner" || state.role === "head_office") && (
            <div className="pt-2">
              <Button render={<Link href="/sites" />}>
                Add a Location
              </Button>
            </div>
          )}
        </EmptyHeader>
      </Empty>
    </AdminShell>
  )
}

return (
  <AdminShell crumbs={[{ label: "Attendance" }]}>
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold font-heading tracking-tight text-balance">Attendance &amp; timesheets</h1>
          <p className="text-sm text-muted-foreground">
            {site?.name} — Convert clock events into daily attendance records with schedule comparison, worked calculations, and audit trail.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setAddDialogOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Attendance
          </Button>
          <Link href="/attendance/clock">
            <Button variant="outline" className="font-semibold shadow-sm">
              <Clock className="w-4 h-4 mr-1.5 text-emerald-600" />
              Clock View
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-3 rounded-lg border shadow-xs">
        <Tabs value={tabFilter} onValueChange={(v) => v && setTabFilter(v as "all" | "today" | "exceptions")}>
          <TabsList variant="line">
            <TabsTrigger value="all">All Records ({rows.length})</TabsTrigger>
            <TabsTrigger value="today">Today ({todayCount})</TabsTrigger>
            <TabsTrigger value="exceptions">Exceptions ({exceptionCount})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground hidden sm:block" />

          {/* Employee Filter */}
          <Select
            items={employeeSelectItems}
            value={employeeFilter}
            onValueChange={(val) => val && setEmployeeFilter(val)}
          >
            <SelectTrigger className="w-[170px] h-8 text-xs">
              <SelectValue placeholder="All Employees">
                {selectedEmployeeLabel}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {siteEmployees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Exception Type Filter */}
          <Select
            items={EXCEPTION_SELECT_ITEMS}
            value={exceptionFilter}
            onValueChange={(val) => val && setExceptionFilter(val)}
          >
            <SelectTrigger className="w-[170px] h-8 text-xs">
              <SelectValue placeholder="All Exceptions">
                {EXCEPTION_LABELS[exceptionFilter] || "All Exceptions"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Exceptions</SelectItem>
              <SelectItem value="late_arrival">Late Arrival</SelectItem>
              <SelectItem value="early_departure">Early Departure</SelectItem>
              <SelectItem value="missing_clock_out">Missing Clock-Out</SelectItem>
              <SelectItem value="missing_break_end">Missing Break End</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-x-auto min-w-0 max-w-full shadow-inner">
          {visibleRows.length === 0 ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClipboardCheck />
                </EmptyMedia>
                <EmptyTitle>
                  {tabFilter === "exceptions"
                    ? "No open exceptions"
                    : tabFilter === "today"
                      ? "No attendance for today"
                      : "No attendance records match criteria"}
                </EmptyTitle>
                <EmptyDescription>
                  {tabFilter === "exceptions"
                    ? "All employee clock events for this period match the schedule cleanly."
                    : "Attendance records for this location will appear here as employees clock in or managers manually enter records."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift Start</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Break Period</TableHead>
                  <TableHead>Allowed Break</TableHead>
                  <TableHead>Break Taken</TableHead>
                  <TableHead>Shift End</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Worked</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => {
                  const events = row.record?.events || []
                  const totals = row.record ? computeWorkedTotals(events) : undefined

                  const matchedShift = row.shift || state.shifts.find((s) => s.employeeId === row.employee.id && s.date === row.date)
                  const shiftStart = matchedShift ? formatTime12(matchedShift.startTime) : (row.record?.scheduledStartTime ? formatTime12(row.record.scheduledStartTime) : "—")
                  const shiftEnd = matchedShift ? formatTime12(matchedShift.endTime) : (row.record?.scheduledEndTime ? formatTime12(row.record.scheduledEndTime) : "—")
                  const allowedBreak = matchedShift ? `${matchedShift.unpaidBreakMinutes}m` : "—"

                  const clockIn = totals?.clockInAt ? formatTimestamp12(totals.clockInAt) : "—"
                  const clockOut = totals?.clockOutAt ? formatTimestamp12(totals.clockOutAt) : "—"

                  const clockInEv = events.find((e) => e.type === "clock_in")
                  const clockOutEv = events.slice().reverse().find((e) => e.type === "clock_out")

                  const breakStartEv = events.find((e) => e.type === "break_start")
                  const breakEndEv = events.find((e) => e.type === "break_end")
                  const breakPeriod = breakStartEv
                    ? `${formatTimestamp12(breakStartEv.timestamp)}–${breakEndEv ? formatTimestamp12(breakEndEv.timestamp) : "..."}`
                    : "—"

                  const breakTakenMins = totals ? totals.breakMinutes : 0
                  const breakTakenStr = breakTakenMins > 0 ? `${breakTakenMins}m` : "0m"

                  const hours = totals ? (totals.payableMinutes / 60).toFixed(2) : "0.00"

                  return (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium">
                        <div>
                          <span className="font-semibold text-foreground">
                            {row.employee.firstName} {row.employee.lastName}
                          </span>
                          <span className="block text-xs text-muted-foreground">{row.employee.jobTitle}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-medium whitespace-nowrap">
                        {row.date === TODAY_ISO ? (
                          <Badge variant="secondary" className="font-semibold text-xs">
                            Today
                          </Badge>
                        ) : (
                          formatDayMonth(row.date)
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-medium">
                        {shiftStart}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-medium">
                        <div className="flex items-center gap-1.5">
                          <span>{clockIn}</span>
                          {clockInEv?.photo && (
                            <button
                              type="button"
                              onClick={() => setDetailsRow(row)}
                              className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 p-0.5 rounded transition-colors"
                              title="Live photo recorded at Clock In. Click Details to view."
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-mono whitespace-nowrap">
                        {breakPeriod}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-mono">
                        {allowedBreak}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-mono">
                        {breakTakenStr}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-medium">
                        {shiftEnd}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-medium">
                        <div className="flex items-center gap-1.5">
                          <span>{clockOut}</span>
                          {clockOutEv?.photo && (
                            <button
                              type="button"
                              onClick={() => setDetailsRow(row)}
                              className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 p-0.5 rounded transition-colors"
                              title="Live photo recorded at Clock Out. Click Details to view."
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-semibold whitespace-nowrap">
                        {hours} hrs
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant={
                              row.record?.status === "exception"
                                ? "destructive"
                                : row.record?.status === "corrected" || row.record?.status === "reviewed"
                                  ? "secondary"
                                  : row.record
                                    ? "default"
                                    : "outline"
                            }
                            className="w-fit whitespace-nowrap"
                          >
                            {row.record ? attendanceStatusLabel(row.record.status) : "Not started"}
                          </Badge>
                            {
                              row.record && getRowExceptions(row).length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {
                                      getRowExceptions(row).map((ex) => (
                                        <Badge
                                          key={ex}
                                          variant="outline"
                                          className={`text-xs whitespace-nowrap ${ex === "late_arrival"
                                              ? "cursor-pointer hover:bg-amber-500/15 border-amber-400 text-amber-700 dark:text-amber-400 font-semibold"
                                              : ""
                                            }`}
                                          onClick={() => {
                                            if (ex === "late_arrival") {
                                              const firstClockIn = events.find((e) => e.type === "clock_in")
                                              const shiftStartRaw = matchedShift?.startTime || row.record?.scheduledStartTime
                                              const lateInfo = isRowLate(row)
                                              const clockInTimeStr = clockInEv ? formatTimestamp12(clockInEv.timestamp) : clockIn
                                              setLateReviewRecord({
                                                id: row.record!.id,
                                                employeeId: row.employee.id,
                                                employeeName: `${row.employee.firstName} ${row.employee.lastName}`,
                                                date: row.date,
                                                scheduledStartTime: shiftStartRaw,
                                                scheduledEndTime: matchedShift?.endTime || row.record?.scheduledEndTime,
                                                actualClockInTime: clockInTimeStr !== "—" ? clockInTimeStr : "Late",
                                                lateMinutes: lateInfo.minsLate || 1,
                                                hourlyRate: row.employee.hourlyRate || 10,
                                                siteId: activeSiteId || row.employee.primarySiteId,
                                                siteName: site?.name || "Site",
                                              })
                                            }
                                          }}
                                        >
                                          {EXCEPTION_LABELS[ex] || ex}
                                          {ex === "late_arrival" && " ↗"}
                                        </Badge>
                                      ))
                                    }
                              </div>
                              )
                            }
                          </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDetailsRow(row)}
                            className="h-8 text-xs px-2"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                            Details
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDrawerRow(row)}
                            className="h-8 text-xs px-2"
                            title="Edit / Correct Attendance"
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setHistoryRow(row)}
                            className="h-8 text-xs px-2 text-muted-foreground"
                            title="View Audit History"
                          >
                            <History className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            History
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>

    {/* Manual Entry Dialog */}
    <AddAttendanceDialog
      open={addDialogOpen}
      onOpenChange={setAddDialogOpen}
      siteId={activeSiteId}
      onSuccess={loadDbData}
      onOpenCorrection={(rec, emp, d, s) => {
        setDrawerRow({
          key: `correction-${rec.id}`,
          employee: emp,
          date: d,
          shift: s,
          record: rec,
        })
      }}
    />

    {/* Correction Drawer */}
    <CorrectionDrawer
      open={Boolean(drawerRow)}
      onOpenChange={(o) => !o && setDrawerRow(null)}
      employee={drawerRow?.employee ?? null}
      siteId={activeSiteId}
      date={drawerRow?.date ?? TODAY_ISO}
      shift={drawerRow?.shift}
      record={drawerRow?.record}
    />

    {/* Attendance Details Dialog */}
    <AttendanceDetailsDialog
      open={Boolean(detailsRow)}
      onOpenChange={(o) => !o && setDetailsRow(null)}
      employee={detailsRow?.employee ?? null}
      siteName={site?.name || "Location"}
      date={detailsRow?.date ?? TODAY_ISO}
      shift={detailsRow?.shift}
      record={detailsRow?.record}
      onOpenHistory={() => {
        setHistoryRow(detailsRow)
        setDetailsRow(null)
      }}
      onOpenCorrection={() => {
        setDrawerRow(detailsRow)
        setDetailsRow(null)
      }}
    />

    {/* Audit History Dialog */}
    <AuditHistoryDialog
      open={Boolean(historyRow)}
      onOpenChange={(o) => !o && setHistoryRow(null)}
      employeeName={historyRow ? `${historyRow.employee.firstName} ${historyRow.employee.lastName}` : ""}
      date={historyRow?.date ?? TODAY_ISO}
      audits={historyRow?.record?.audits}
    />

    {/* Late Arrival Review & Deduction Dialog */}
    <LateReviewDialog
      open={Boolean(lateReviewRecord)}
      onOpenChange={(o) => !o && setLateReviewRecord(null)}
      record={lateReviewRecord}
      onSuccess={loadDbData}
    />
  </AdminShell>
)
}

