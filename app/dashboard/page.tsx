"use client"

import * as React from "react"
import { apiUrl } from '@/lib/api';
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AdminShell } from "@/components/shell/admin-shell"
import { useAppStore, useCurrentSite, useCurrentUser, useAccessibleSites, useRotaStatus } from "@/lib/store"
import { CURRENT_WEEK_START, TODAY_ISO, formatDateLong, formatDayMonth, formatTime12, formatTimestamp12, formatWeekRange, addDays } from "@/lib/date-utils"
import { computeWorkedTotals, classifyLiveAttendanceStatus, scheduledMinutes, minutesToHours, EXCEPTION_LABELS, type LiveAttendanceStatus } from "@/lib/calc"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InactiveLocationBanner } from "@/components/dashboard/inactive-location-banner"


import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Coffee,

  History,
  Lock,

  ShieldAlert,
  TriangleAlert,
  UserCheck,
  UserCog,
  UserX,
  Users,
} from "lucide-react"



export default function ManagerDashboardPage() {
  const router = useRouter()
  const { state, dispatch } = useAppStore()
  const site = useCurrentSite()
  const user = useCurrentUser()
  const accessibleSites = useAccessibleSites()
  const rotaStatus = useRotaStatus(site?.id ?? "", CURRENT_WEEK_START)

  const activeSiteId = site?.id || ""
  const isOwner = state.role === "business_owner" || state.role === "head_office"

  // Local Filter States
  const [weekStart, setWeekStart] = React.useState(CURRENT_WEEK_START)
  const [selectedSiteId, setSelectedSiteId] = React.useState<string>(activeSiteId)
  const [liveStatusTab, setLiveStatusTab] = React.useState<string>("all")

  const weekEnd = React.useMemo(() => addDays(weekStart, 6), [weekStart])

  // Sync selected site with store current site
  React.useEffect(() => {
    if (activeSiteId) {
      setSelectedSiteId(activeSiteId)
    }
  }, [activeSiteId])

  // Fetch live shifts, employees, and attendance from DB on mount or site/week change
  React.useEffect(() => {
    async function loadDashboardData() {
      const targetSite = selectedSiteId || activeSiteId
      if (!targetSite) return
      try {
        // Load DB Employees
        const empRes = await fetch(apiUrl("/api/employees"))
        if (empRes.ok) {
          const empData = await empRes.json()
          if (empData.success && Array.isArray(empData.employees) && empData.employees.length > 0) {
            dispatch({ type: "SET_EMPLOYEES", employees: empData.employees })
          }
        }

        // Load DB Shifts for selected week
        const shiftRes = await fetch(apiUrl(`/api/shifts?siteId=${targetSite}&weekStart=${weekStart}&endDate=${weekEnd}`))
        if (shiftRes.ok) {
          const shiftData = await shiftRes.json()
          if (shiftData.success && Array.isArray(shiftData.shifts)) {
            shiftData.shifts.forEach((s: any) => {
              dispatch({ type: "ADD_SHIFT", shift: s })
            })
          }
        }

        // Load DB Attendance
        const attRes = await fetch(apiUrl(`/api/attendance?siteId=${targetSite}`))
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
                events: rec.events,
                exceptions: Array.isArray(rec.exceptions) ? rec.exceptions : (rec.exceptionsJson ? JSON.parse(rec.exceptionsJson) : []),
                reason: rec.correctionReason || "",
                actorName: rec.correctedBy || "System",
              })
            })
          }
        }

        // Load DB Notifications
        const notiRes = await fetch(apiUrl(`/api/notifications?siteId=${targetSite}&role=${state.role}&userId=${user.id}`))
        if (notiRes.ok) {
          const notiData = await notiRes.json()
          if (notiData.success && Array.isArray(notiData.notifications)) {
            dispatch({ type: "SET_NOTIFICATIONS", notifications: notiData.notifications })
          }
        }
      } catch (err) {
        console.error("Failed to load dashboard data from API:", err)
      }
    }
    loadDashboardData()
  }, [selectedSiteId, activeSiteId, weekStart, weekEnd, dispatch, state.role, user.id])

  const effectiveSiteId = selectedSiteId || activeSiteId
  const currentSiteObj = state.sites.find((s) => s.id === effectiveSiteId) || site || state.sites[0]

  const siteEmployees = state.employees.filter(
    (e) => (e.primarySiteId === effectiveSiteId || state.shifts.some((s) => s.employeeId === e.id && s.siteId === effectiveSiteId)) && e.status === "active"
  )

  const todayShifts = state.shifts.filter((s) => s.siteId === effectiveSiteId && s.date === TODAY_ISO)
  const todayAttendance = state.attendance.filter((a) => a.siteId === effectiveSiteId && a.date === TODAY_ISO)
  const openExceptions = state.attendance.filter((a) => a.siteId === effectiveSiteId && a.status === "exception")
  const approvalRecord = state.approvals.find((a) => a.siteId === effectiveSiteId && a.weekStart === weekStart)

  // Live Attendance Status Categorization for Today
  const liveStatusList = todayShifts.map((shift) => {
    const emp = state.employees.find((e) => e.id === shift.employeeId)
    const record = todayAttendance.find((a) => a.shiftId === shift.id || (a.employeeId === shift.employeeId && a.date === TODAY_ISO))
    const live = classifyLiveAttendanceStatus(shift, record)
    const totals = record ? computeWorkedTotals(record.events) : undefined
    return {
      shift,
      employee: emp,
      record,
      totals,
      statusInfo: live,
    }
  })

  // Live Status Counts
  const clockedInCount = liveStatusList.filter((item) => item.statusInfo.status === "clocked_in").length
  const lateCount = liveStatusList.filter((item) => item.statusInfo.status === "late").length
  const absentCount = liveStatusList.filter((item) => item.statusInfo.status === "absent").length
  const missingClockOutCount = liveStatusList.filter((item) => item.statusInfo.status === "missing_clock_out").length
  const finishedCount = liveStatusList.filter((item) => item.statusInfo.status === "finished").length

  const filteredLiveRows = liveStatusList.filter((item) => {

    if (liveStatusTab === "clocked_in") return item.statusInfo.status === "clocked_in"
    if (liveStatusTab === "late") return item.statusInfo.status === "late"
    if (liveStatusTab === "absent") return item.statusInfo.status === "absent"
    if (liveStatusTab === "missing_clock_out") return item.statusInfo.status === "missing_clock_out"
    return true
  })

  // Weekly Totals Calculations
  const weekShifts = state.shifts.filter(
    (s) => s.siteId === effectiveSiteId && s.date >= weekStart && s.date <= weekEnd
  )
  const weekAttendance = state.attendance.filter(
    (a) => a.siteId === effectiveSiteId && a.date >= weekStart && a.date <= weekEnd
  )

  const weeklyScheduledMinutes = weekShifts.reduce((sum, s) => sum + scheduledMinutes(s), 0)
  const weeklyActualWorkedMinutes = weekAttendance.reduce(
    (sum, a) => sum + computeWorkedTotals(a.events).payableMinutes,
    0
  )
  const isWeekApproved = approvalRecord?.status === "approved" || approvalRecord?.status === "exported"
  const weeklyApprovedHours = isWeekApproved ? minutesToHours(weeklyActualWorkedMinutes) : 0

  const activeSites = state.sites.filter((s) => s.status === "active")

  const dashboardNotis = React.useMemo(() => {
    if (!state.notifications) return []
    return state.notifications.filter(
      (n) => (!n.siteId || n.siteId === effectiveSiteId || isOwner) && n.recipientRole !== "employee"
    )
  }, [state.notifications, effectiveSiteId, isOwner])

  return (
    <AdminShell crumbs={[{ label: "Dashboard" }]}>
      <div className="flex flex-col gap-6">
        {/* Top Header Banner */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-card p-4 border border-border shadow-xs">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold font-heading tracking-tight text-balance">
                Good afternoon, {user.name.split(" ")[0]}
              </h1>
              <Badge variant="default" className="font-medium bg-primary">
                {isOwner ? "Business Owner" : state.role === "employee" ? "Employee" : "Site Manager"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
              <span>Location:</span>
              <strong className="text-foreground">{currentSiteObj?.name ?? "Location"}</strong>
              {currentSiteObj?.town ? ` (${currentSiteObj.town})` : ""}
              {currentSiteObj?.status === "inactive" && (
                <span className="rounded bg-amber-500/15 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                  Inactive
                </span>
              )}
              <span>· {formatDateLong(TODAY_ISO)}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isOwner && (
              <Button size="sm" variant="outline" render={<Link href="/head-office" />}>
                <Building2 className="w-4 h-4 mr-1.5 text-primary" />
                Head Office Multi-Site View
              </Button>
            )}
            <Button size="sm" variant="secondary" render={<Link href="/approval" />}>
              <ClipboardCheck className="w-4 h-4 mr-1.5 text-emerald-600" />
              Weekly Approval
            </Button>
          </div>
        </div>

        {/* Deactivated Location Warning Banner */}
        {currentSiteObj?.status === "inactive" && (
          <InactiveLocationBanner
            siteName={currentSiteObj.name}
            isInactive={true}
          />
        )}




        {/* Live Attendance Summary Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Clocked in now"
            value={String(clockedInCount)}
            hint={`of ${todayShifts.length} scheduled today`}
            icon={Users}
            tone={clockedInCount > 0 ? "success" : "default"}
          />
          <StatCard
            label="Late arrivals"
            value={String(lateCount)}
            hint="exceeded 5m threshold"
            icon={Clock}
            tone={lateCount > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Absent / Missing clock-out"
            value={String(absentCount + missingClockOutCount)}
            hint={`${absentCount} absent · ${missingClockOutCount} missing clock-out`}
            icon={UserX}
            tone={absentCount + missingClockOutCount > 0 ? "destructive" : "default"}
          />
          <StatCard
            label="Open exceptions"
            value={String(openExceptions.length)}
            hint="unresolved clock events"
            icon={TriangleAlert}
            tone={openExceptions.length > 0 ? "destructive" : "default"}
          />
        </div>

        {/* Weekly Totals Summary Grid */}
        <Card className="border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Weekly Hours &amp; Totals Summary</CardTitle>
              <CardDescription className="text-xs">
                Pay period: {formatWeekRange(weekStart)} · Site: {currentSiteObj?.name}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {isWeekApproved ? "Week Locked & Approved" : "Live Hours Counter"}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-muted/20 p-3.5 space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Scheduled Hours</span>
                <p className="text-2xl font-bold font-heading">{minutesToHours(weeklyScheduledMinutes).toFixed(1)} hrs</p>
                <p className="text-[11px] text-muted-foreground">{weekShifts.length} shifts scheduled</p>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3.5 space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Actual Worked Hours</span>
                <p className="text-2xl font-bold font-heading text-emerald-600 dark:text-emerald-400">
                  {minutesToHours(weeklyActualWorkedMinutes).toFixed(1)} hrs
                </p>
                <p className="text-[11px] text-muted-foreground">{weekAttendance.length} clock records</p>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3.5 space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Approved Payable Hours</span>
                <p className="text-2xl font-bold font-heading text-blue-600 dark:text-blue-400">
                  {weeklyApprovedHours.toFixed(1)} hrs
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isWeekApproved ? "Finalized for payroll" : "Pending owner approval"}
                </p>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3.5 space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Weekly Exceptions</span>
                <p className={openExceptions.length > 0 ? "text-2xl font-bold font-heading text-amber-600 dark:text-amber-400" : "text-2xl font-bold font-heading"}>
                  {openExceptions.length}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {openExceptions.length === 0 ? "All records clean" : "Requires manager resolution"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Attendance Status Monitor Widget */}
        <Card className="border shadow-xs">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                Live Attendance Status Monitor
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time clock status for today ({formatDateLong(TODAY_ISO)})
              </CardDescription>
            </div>

            {/* Filter Tabs for Live Status */}
            <div className="flex flex-wrap items-center gap-1.5 bg-muted/40 p-1 rounded-lg border">
              <Button
                variant={liveStatusTab === "all" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setLiveStatusTab("all")}
              >
                All ({todayShifts.length})
              </Button>
              <Button
                variant={liveStatusTab === "clocked_in" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5 text-emerald-600 dark:text-emerald-400 font-medium"
                onClick={() => setLiveStatusTab("clocked_in")}
              >
                Clocked In ({clockedInCount})
              </Button>
              <Button
                variant={liveStatusTab === "late" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5 text-amber-600 dark:text-amber-400 font-medium"
                onClick={() => setLiveStatusTab("late")}
              >
                Late ({lateCount})
              </Button>
              <Button
                variant={liveStatusTab === "absent" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5 text-red-600 dark:text-red-400 font-medium"
                onClick={() => setLiveStatusTab("absent")}
              >
                Absent ({absentCount})
              </Button>
              <Button
                variant={liveStatusTab === "missing_clock_out" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5 text-red-600 dark:text-red-400 font-medium"
                onClick={() => setLiveStatusTab("missing_clock_out")}
              >
                Missing Clock-out ({missingClockOutCount})
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {filteredLiveRows.length === 0 ? (
              <Empty className="py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <UserCheck />
                  </EmptyMedia>
                  <EmptyTitle>No matching employees found</EmptyTitle>
                  <EmptyDescription>No shifts match your selected filter criteria for today.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filteredLiveRows.map((row) => {
                  const empName = row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : "Employee"
                  const clockInStr = row.totals?.clockInAt ? formatTimestamp12(row.totals.clockInAt) : "—"
                  const clockOutStr = row.totals?.clockOutAt ? formatTimestamp12(row.totals.clockOutAt) : "—"

                  return (
                    <div
                      key={row.shift.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3 bg-card hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                          {row.employee ? `${row.employee.firstName[0]}${row.employee.lastName[0]}` : "EMP"}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm text-foreground">{empName}</span>
                          <span className="text-xs text-muted-foreground">
                            {row.shift.role} · Scheduled: {formatTime12(row.shift.startTime)}–{formatTime12(row.shift.endTime)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 text-xs">
                        <div className="flex items-center gap-3 text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-md border">
                          <span>In: <strong className="text-foreground">{clockInStr}</strong></span>
                          <span>Out: <strong className="text-foreground">{clockOutStr}</strong></span>
                        </div>

                        <StatusPill statusInfo={row.statusInfo} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Activity & Exception Grid */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Notifications Feed */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="size-4 text-primary" />
                  Live Activity &amp; Notifications
                </CardTitle>
                <CardDescription>Real-time shift starts, late clock-ins &amp; break warnings</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {dashboardNotis && dashboardNotis.length > 0 ? (
                <div className="flex flex-col gap-2.5 max-h-[320px] overflow-y-auto">
                  {dashboardNotis.slice(0, 8).map((n) => {
                    const timeStr = new Date(n.timestamp).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })

                    const notiSite = state.sites.find((s) => s.id === n.siteId)
                    const notiSiteName = notiSite?.name || n.siteName || ""
                    const isDifferentSite = Boolean(n.siteId && n.siteId !== effectiveSiteId)
                    const notiType = (n as any).type
                    const isApprovalNoti =
                      notiType === "timesheet_approved" ||
                      notiType === "weekly_approval_due" ||
                      notiType === "weekly_approval_overdue" ||
                      n.title?.toLowerCase().includes("approval") ||
                      n.title?.toLowerCase().includes("timesheet")

                    const weekStartFromMeta = (n.meta as any)?.weekStart
                    const weekStartFromMsg = n.message?.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1]
                    const notiWeekStart = weekStartFromMeta || weekStartFromMsg

                    const linkUrl = isApprovalNoti
                      ? "/approval"
                      : (n.meta as any)?.link ||
                        (notiType === "shift_conflict" ? "/rota" : "/attendance")

                    return (
                      <div
                        key={n.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (n.siteId && n.siteId !== state.currentSiteId) {
                            dispatch({ type: "SET_SITE", siteId: n.siteId })
                            toast.info(`Switched location to ${notiSiteName || "Location"}`)
                          }
                          if (notiWeekStart && notiWeekStart !== state.currentWeekStart) {
                            dispatch({ type: "SET_WEEK", weekStart: notiWeekStart })
                          }
                          router.push(linkUrl)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            if (n.siteId && n.siteId !== state.currentSiteId) {
                              dispatch({ type: "SET_SITE", siteId: n.siteId })
                              toast.info(`Switched location to ${notiSiteName || "Location"}`)
                            }
                            if (notiWeekStart && notiWeekStart !== state.currentWeekStart) {
                              dispatch({ type: "SET_WEEK", weekStart: notiWeekStart })
                            }
                            router.push(linkUrl)
                          }
                        }}
                        className={`flex items-start gap-3 rounded-lg border p-3 text-xs transition-colors cursor-pointer hover:bg-muted/70 ${
                          n.isWarning
                            ? "border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10"
                            : "border-border bg-card"
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${
                            n.isWarning
                              ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                              : n.type === "clock_in"
                              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                              : "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {n.isWarning ? (
                            <TriangleAlert className="size-4" />
                          ) : n.type === "break_start" || n.type === "break_end" ? (
                            <Coffee className="size-4" />
                          ) : (
                            <Clock className="size-4" />
                          )}
                        </div>
                        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-foreground truncate">{n.title}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">{timeStr}</span>
                          </div>
                          <p className="text-muted-foreground leading-relaxed text-[11px]">{n.message}</p>
                          {notiSiteName && (
                            <div className="mt-1 flex items-center justify-between gap-1">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  isDifferentSite
                                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                <Building2 className="size-3" />
                                {notiSiteName}
                              </span>
                              <span className="text-[10px] text-primary font-semibold hover:underline">
                                View →
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Bell className="size-5" />
                    </EmptyMedia>
                    <EmptyTitle>No recent notifications</EmptyTitle>
                    <EmptyDescription>Shift starts, late arrivals, and break activity will appear here live.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>

          {/* Attendance Exceptions */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Attendance exceptions</CardTitle>
                <CardDescription>Flagged clock events that need a decision</CardDescription>
              </div>
              <Button variant="outline" size="sm" render={<Link href="/attendance" />}>
                Timesheets
                <ArrowRight data-icon="inline-end" />
              </Button>
            </CardHeader>
            <CardContent>
              {openExceptions.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ClipboardCheck />
                    </EmptyMedia>
                    <EmptyTitle>No open exceptions</EmptyTitle>
                    <EmptyDescription>Every clock event at {currentSiteObj?.name} looks clean.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="flex flex-col gap-2">
                  {openExceptions.slice(0, 6).map((a) => {
                    const emp = state.employees.find((e) => e.id === a.employeeId)
                    return (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">
                            {emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatDayMonth(a.date)}</span>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1">
                          {a.exceptions.map((ex) => (
                            <Badge key={ex} variant="destructive" className="whitespace-nowrap">
                              {EXCEPTION_LABELS[ex] || ex}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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

function StatusPill({ statusInfo }: { statusInfo: ReturnType<typeof classifyLiveAttendanceStatus> }) {
  const map = {
    clocked_in: { variant: "default" as const, className: "bg-emerald-600 text-white font-medium" },
    late: { variant: "outline" as const, className: "border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950/20 font-medium" },
    absent: { variant: "destructive" as const, className: "font-medium" },
    missing_clock_out: { variant: "destructive" as const, className: "bg-red-600 text-white font-medium" },
    not_started: { variant: "outline" as const, className: "text-muted-foreground" },
    finished: { variant: "secondary" as const, className: "font-normal" },
  }

  const style = map[statusInfo.status] || map.not_started
  return (
    <Badge variant={style.variant} className={style.className}>
      {statusInfo.label}
    </Badge>
  )
}

