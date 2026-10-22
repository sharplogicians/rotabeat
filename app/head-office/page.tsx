"use client"

import * as React from "react"
 import { apiUrl } from '@/lib/api';
import Link from "next/link"
import { AdminShell } from "@/components/shell/admin-shell"
import { useAppStore } from "@/lib/store"
import { CURRENT_WEEK_START, TODAY_ISO, formatDateLong, formatDayMonth, formatWeekRange, addDays } from "@/lib/date-utils"
import { computeWorkedTotals, classifyLiveAttendanceStatus, scheduledMinutes, minutesToHours } from "@/lib/calc"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowRight, Building2, CalendarDays, CheckCircle2, ClipboardCheck, Clock, Filter, History, Lock, ShieldAlert, TriangleAlert, Users } from "lucide-react"
import { formatAuditAction, formatAuditDetails } from "@/lib/audit-format"

export default function HeadOfficeDashboardPage() {
  const { state, dispatch } = useAppStore()

  // Local Filter States
  const [weekStart, setWeekStart] = React.useState(CURRENT_WEEK_START)
  const [selectedSiteFilter, setSelectedSiteFilter] = React.useState<string>("all")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")

  const weekEnd = React.useMemo(() => addDays(weekStart, 6), [weekStart])

  // Sync DB Data for all sites on mount/week change
  React.useEffect(() => {
    async function loadAllSitesData() {
      try {
        // 1. Fetch all employees across all sites
        const empRes = await fetch(apiUrl("/api/employees?siteId=all"))
        if (empRes.ok) {
          const empData = await empRes.json()
          if (empData.success && Array.isArray(empData.employees) && empData.employees.length > 0) {
            dispatch({ type: "SET_EMPLOYEES", employees: empData.employees })
          }
        }

        // 2. Fetch all attendance records across all locations
        const attRes = await fetch(apiUrl("/api/attendance?siteId=all"))
        if (attRes.ok) {
          const attData = await attRes.json()
          if (attData.success && Array.isArray(attData.records)) {
            attData.records.forEach((rec: any) => {
              dispatch({
                type: "CORRECT_ATTENDANCE",
                attendanceId: rec.id,
                employeeId: rec.employeeId,
                siteId: rec.siteId,
                date: rec.date,
                shiftId: rec.shiftId,
                events: rec.events || [],
                exceptions: Array.isArray(rec.exceptions) ? rec.exceptions : (rec.exceptionsJson ? JSON.parse(rec.exceptionsJson) : []),
                reason: rec.correctionReason || "",
                actorName: rec.correctedBy || "System",
              })
            })
          }
        }

        // 3. Sync shifts for all active sites
        for (const s of state.sites) {
          const shiftRes = await fetch(apiUrl(`/api/shifts?siteId=${s.id}&weekStart=${weekStart}&endDate=${weekEnd}`))
          if (shiftRes.ok) {
            const shiftData = await shiftRes.json()
            if (shiftData.success && Array.isArray(shiftData.shifts)) {
              shiftData.shifts.forEach((shift: any) => {
                dispatch({ type: "ADD_SHIFT", shift })
              })
            }
          }
        }
      } catch (err) {
        console.error("Failed to sync head office data:", err)
      }
    }
    loadAllSitesData()
  }, [weekStart, weekEnd, dispatch, state.sites.length])

  const activeSites = state.sites.filter((s) => s.status === "active")
  const activeEmployees = state.employees.filter((e) => e.status === "active")
  const openExceptions = state.attendance.filter((a) => a.status === "exception")
  const pendingApprovals = state.approvals.filter(
    (a) => a.weekStart === weekStart && (a.status === "open" || a.status === "under_review")
  )

  const weekOptions = React.useMemo(() => {
    return [
      addDays(CURRENT_WEEK_START, -14),
      addDays(CURRENT_WEEK_START, -7),
      CURRENT_WEEK_START,
      addDays(CURRENT_WEEK_START, 7),
    ]
  }, [])

  // Build rows for all active sites
  const allSiteRows = activeSites.map((site) => {
    const siteEmployees = state.employees.filter(
      (e) => (e.primarySiteId === site.id || state.shifts.some((s) => s.employeeId === e.id && s.siteId === site.id)) && e.status === "active"
    )

    const siteShiftsToday = state.shifts.filter((s) => s.siteId === site.id && s.date === TODAY_ISO)
    const siteAttendanceToday = state.attendance.filter((a) => a.siteId === site.id && a.date === TODAY_ISO)

    // Accurate Clocked In / On Shift count today
    const clockedInEmpIds = new Set<string>()

    // Check attendance records with active clock-in (clockInAt present and clockOutAt absent)
    siteAttendanceToday.forEach((rec) => {
      const totals = computeWorkedTotals(rec.events || [])
      if (totals.clockInAt && !totals.clockOutAt) {
        clockedInEmpIds.add(rec.employeeId)
      }
    })

    // Also check through shifts matching live status classification
    siteShiftsToday.forEach((shift) => {
      const record = siteAttendanceToday.find(
        (a) => a.shiftId === shift.id || (a.employeeId === shift.employeeId && a.date === TODAY_ISO)
      )
      if (record) {
        const live = classifyLiveAttendanceStatus(shift, record)
        if (live.status === "clocked_in" || live.status === "late") {
          const totals = computeWorkedTotals(record.events || [])
          if (totals.clockInAt && !totals.clockOutAt) {
            clockedInEmpIds.add(shift.employeeId)
          }
        }
      }
    })

    const clockedInCount = clockedInEmpIds.size

    const siteExceptions = openExceptions.filter((a) => a.siteId === site.id)
    const approval = state.approvals.find((a) => a.siteId === site.id && a.weekStart === weekStart)

    const weekShifts = state.shifts.filter(
      (s) => s.siteId === site.id && s.date >= weekStart && s.date <= weekEnd
    )
    const weekAttendance = state.attendance.filter(
      (a) => a.siteId === site.id && a.date >= weekStart && a.date <= weekEnd
    )

    const scheduledMins = weekShifts.reduce((sum, s) => sum + scheduledMinutes(s), 0)
    const actualMins = weekAttendance.reduce(
      (sum, a) => sum + computeWorkedTotals(a.events).payableMinutes,
      0
    )

    return {
      site,
      employeeCount: siteEmployees.length,
      clockedInCount,
      scheduledHours: minutesToHours(scheduledMins),
      actualHours: minutesToHours(actualMins),
      exceptionCount: siteExceptions.length,
      approvalStatus: approval?.status ?? "open",
      managerApprovedBy: approval?.managerApprovedBy,
      approvedBy: approval?.approvedBy,
    }
  })

  // Apply Cross-Site Filters
  const filteredSiteRows = allSiteRows.filter((row) => {
    if (selectedSiteFilter !== "all" && row.site.id !== selectedSiteFilter) return false
    if (statusFilter === "open" && row.approvalStatus !== "open") return false
    if (statusFilter === "under_review" && row.approvalStatus !== "under_review") return false
    if (statusFilter === "approved" && row.approvalStatus !== "approved") return false
    if (statusFilter === "exported" && row.approvalStatus !== "exported") return false
    return true
  })

  const totalOrgScheduledHours = filteredSiteRows.reduce((sum, r) => sum + r.scheduledHours, 0)
  const totalOrgWorkedHours = filteredSiteRows.reduce((sum, r) => sum + r.actualHours, 0)
  const totalOrgExceptions = filteredSiteRows.reduce((sum, r) => sum + r.exceptionCount, 0)

  function handleSelectSite(siteId: string) {
    dispatch({ type: "SET_SITE", siteId })
  }

  return (
    <AdminShell crumbs={[{ label: "Head office" }]}>
      <div className="flex flex-col gap-6">
        {/* Top Banner */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-card p-4 border border-border shadow-xs">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold font-heading tracking-tight text-balance">Organisation Multi-Site Overview</h1>
              <Badge variant="default" className="font-medium bg-primary">
                Head Office Admin
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDateLong(TODAY_ISO)} · Viewing metrics across {activeSites.length} active locations
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" render={<Link href="/sites" />}>
              <Building2 className="w-4 h-4 mr-1.5 text-primary" />
              Manage Locations
            </Button>
            <Button size="sm" variant="secondary" render={<Link href="/payroll" />}>
              <ClipboardCheck className="w-4 h-4 mr-1.5 text-emerald-600" />
              Payroll Exports
            </Button>
          </div>
        </div>

        {/* Cross-Site Filter Control Bar */}
        <Card className="bg-muted/30 border-muted">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Global Filters</span>
              </div>

              {/* Site Selector Filter */}
              <Select value={selectedSiteFilter} onValueChange={(v) => v && setSelectedSiteFilter(v)}>
                <SelectTrigger className="w-[190px] h-9 text-xs bg-background">
                  <SelectValue placeholder="All Sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Locations ({activeSites.length})</SelectItem>
                  {activeSites.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.name} ({s.town})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Pay Period / Week Filter */}
              <Select value={weekStart} onValueChange={(v) => v && setWeekStart(v)}>
                <SelectTrigger className="w-[200px] h-9 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weekOptions.map((w) => (
                    <SelectItem key={w} value={w} className="text-xs">
                      {formatWeekRange(w)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Approval Status Filter */}
              <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
                <SelectTrigger className="w-[170px] h-9 text-xs bg-background">
                  <SelectValue placeholder="Approval Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                  <SelectItem value="open" className="text-xs">Open / In Progress</SelectItem>
                  <SelectItem value="under_review" className="text-xs">Under Review</SelectItem>
                  <SelectItem value="approved" className="text-xs">Approved</SelectItem>
                  <SelectItem value="exported" className="text-xs">Exported</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Pay Period: <strong className="text-foreground">{formatWeekRange(weekStart)}</strong></span>
            </div>
          </CardContent>
        </Card>

        {/* Organisation Multi-Site Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active locations" value={String(filteredSiteRows.length)} hint="operational sites" icon={Building2} />
          <StatCard label="Total team size" value={String(activeEmployees.length)} hint="employees across sites" icon={Users} />
          <StatCard
            label="Worked hours (WTD)"
            value={`${totalOrgWorkedHours.toFixed(1)} hrs`}
            hint={`Scheduled: ${totalOrgScheduledHours.toFixed(1)} hrs`}
            icon={Clock}
            tone="success"
          />
          <StatCard
            label="Open exceptions"
            value={String(totalOrgExceptions)}
            hint="unresolved clock events"
            icon={TriangleAlert}
            tone={totalOrgExceptions > 0 ? "destructive" : "default"}
          />
        </div>

        {/* Multi-Site Overview Table */}
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Multi-Site Performance &amp; Approval Status</CardTitle>
              <CardDescription>Live clock-ins, weekly hours, exceptions, and approval state across locations</CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {filteredSiteRows.length} Locations Listed
            </Badge>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 overflow-x-auto min-w-0 max-w-full shadow-inner">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location / Site</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Clocked In Now</TableHead>
                  <TableHead>Scheduled Hours</TableHead>
                  <TableHead>Actual Worked Hours</TableHead>
                  <TableHead>Exceptions</TableHead>
                  <TableHead>Weekly Approval Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSiteRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      No locations match your selected filter criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSiteRows.map((row) => (
                    <TableRow key={row.site.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm text-foreground">{row.site.name}</span>
                          <span className="text-xs text-muted-foreground">{row.site.town} · {row.site.address}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{row.employeeCount}</TableCell>
                      <TableCell>
                        <Badge variant={row.clockedInCount > 0 ? "default" : "outline"} className={row.clockedInCount > 0 ? "bg-emerald-600 text-white" : ""}>
                          {row.clockedInCount} on shift
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{row.scheduledHours.toFixed(1)} hrs</TableCell>
                      <TableCell className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {row.actualHours.toFixed(1)} hrs
                      </TableCell>
                      <TableCell>
                        {row.exceptionCount > 0 ? (
                          <Badge variant="destructive">{row.exceptionCount} open</Badge>
                        ) : (
                          <Badge variant="secondary" className="font-normal text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                            ✓ Clean
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <ApprovalStatusBadge status={row.approvalStatus} managerApproved={Boolean(row.managerApprovedBy)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectSite(row.site.id)}
                          render={<Link href="/approval" />}
                        >
                          Review &amp; Approve
                          <ArrowRight className="ml-1 size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Audit Activity across Organisation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="size-4 text-primary" />
              Organisation Audit Activity Log
            </CardTitle>
            <CardDescription>Recent manager and owner actions across all sites</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {state.auditLog.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No audit log entries recorded yet.</p>
            ) : (
              state.auditLog.slice(0, 8).map((event) => (
                <div key={event.id} className="flex flex-col gap-1 border-b border-border/50 pb-2.5 last:border-0 last:pb-0 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{formatAuditAction(event.action)}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">{formatAuditDetails(event.newValue, state.employees, event.action, event.userName, event.previousValue)}</p>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 pt-0.5">
                    <span>By: <strong>{event.userName}</strong> ({event.role})</span>
                    <span>Source: {event.source}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  )
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string
  value: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
  tone?: "default" | "success" | "warning" | "destructive"
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 pt-6">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span
            className={
              tone === "destructive"
                ? "text-2xl font-semibold font-heading text-destructive"
                : tone === "warning"
                ? "text-2xl font-semibold font-heading text-amber-600 dark:text-amber-400"
                : tone === "success"
                ? "text-2xl font-semibold font-heading text-emerald-600 dark:text-emerald-400"
                : "text-2xl font-semibold font-heading"
            }
          >
            {value}
          </span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  )
}

function ApprovalStatusBadge({ status, managerApproved }: { status: string; managerApproved?: boolean }) {
  if (status === "exported") {
    return <Badge variant="default" className="bg-purple-600 text-white font-medium">✓ Exported</Badge>
  }
  if (status === "approved") {
    return <Badge variant="default" className="bg-emerald-600 text-white font-medium">✓ Approved</Badge>
  }
  if (managerApproved || status === "under_review") {
    return <Badge variant="outline" className="border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-950/20 font-medium">In Review</Badge>
  }
  return <Badge variant="secondary" className="font-normal">Not Started</Badge>
}

