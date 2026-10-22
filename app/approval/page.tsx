"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { apiUrl } from "@/lib/api"
import { AdminShell } from "@/components/shell/admin-shell"
import { useAppStore, useCurrentSite, useCurrentUser } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { CorrectionDrawer } from "@/components/attendance/correction-drawer"
import Link from "next/link"
import { formatWeekRange, addDays, weekDays, dayOfWeekShort, formatDayMonth, formatDateLong, formatTimestamp12, CURRENT_WEEK_START, TODAY_ISO } from "@/lib/date-utils"
import { computeWorkedTotals, minutesToHours, EXCEPTION_LABELS } from "@/lib/calc"
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  RotateCcw,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Eye,
  History,
  Clock,
  Edit3,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  FileSpreadsheet,
} from "lucide-react"
import { toast } from "sonner"
import type { AttendanceRecord, Employee, Shift } from "@/lib/types"

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  let minutes = eh * 60 + em - (sh * 60 + sm)
  if (minutes < 0) minutes += 24 * 60
  return minutes
}

import { formatAuditAction, formatAuditDetails, getAuditIconAndColor } from "@/lib/audit-format"

export default function ApprovalPage() {
  const { state, dispatch } = useAppStore()
  const site = useCurrentSite()
  const actor = useCurrentUser()
  const weekStart = state.currentWeekStart
  const activeSiteId = site?.id || ""
  const weekEnd = addDays(weekStart, 6)

  // Local UI state
  const [reopenOpen, setReopenOpen] = React.useState(false)
  const [reopenReason, setReopenReason] = React.useState("")
  const [approveConfirmOpen, setApproveConfirmOpen] = React.useState(false)
  const [auditDrawerOpen, setAuditDrawerOpen] = React.useState(false)
  const [dbAuditLogs, setDbAuditLogs] = React.useState<any[]>([])
  const [isTogglingAll, setIsTogglingAll] = React.useState(false)

  // Employee breakdown drawer state
  const [selectedEmployee, setSelectedEmployee] = React.useState<Employee | null>(null)
  const [breakdownOpen, setBreakdownOpen] = React.useState(false)

  // Correction drawer state (triggered from breakdown drawer)
  const [correctionOpen, setCorrectionOpen] = React.useState(false)
  const [correctionTarget, setCorrectionTarget] = React.useState<{
    employee: Employee | null
    date: string
    shift?: Shift
    record?: AttendanceRecord
  }>({ employee: null, date: "" })

  const isHeadOffice = state.role === "head_office" || state.role === "business_owner"

  // Sync DB shifts, attendance & approval record on mount or week change
  React.useEffect(() => {
    async function loadApprovalData() {
      if (!activeSiteId) return
      try {
        // Fetch employees from DB API
        const empRes = await fetch(apiUrl("/api/employees"))
        if (empRes.ok) {
          const empData = await empRes.json()
          if (empData.success && Array.isArray(empData.employees)) {
            dispatch({ type: "SET_EMPLOYEES", employees: empData.employees })
          }
        }

        // Fetch approval status and audit logs from DB API
        const appRes = await fetch(apiUrl(`/api/approval?siteId=${activeSiteId}&weekStart=${weekStart}`))
        if (appRes.ok) {
          const appData = await appRes.json()
          if (appData.success && appData.approval) {
            dispatch({
              type: "SET_WEEKLY_APPROVAL",
              approval: {
                id: appData.approval.id,
                siteId: appData.approval.siteId,
                weekStart: appData.approval.weekStart,
                status: appData.approval.status,
                reviewedEmployeeIds: appData.approval.reviewedEmployeeIds || [],
                ownerReviewedEmployeeIds: appData.approval.ownerReviewedEmployeeIds || [],
                managerApprovedBy: appData.approval.managerApprovedBy,
                managerApprovedAt: appData.approval.managerApprovedAt,
                ownerReviewStarted: Boolean(appData.approval.ownerReviewStarted),
                ownerReviewStartedAt: appData.approval.ownerReviewStartedAt,
                approvedBy: appData.approval.approvedBy,
                approvedAt: appData.approval.approvedAt,
                reopenedReason: appData.approval.reopenedReason,
                reopenedBy: appData.approval.reopenedBy,
                reopenedAt: appData.approval.reopenedAt,
                lastUpdatedBy: appData.approval.lastUpdatedBy,
                lastUpdatedAt: appData.approval.lastUpdatedAt,
              },
            })
          }
          if (appData.success && Array.isArray(appData.auditLogs)) {
            setDbAuditLogs(appData.auditLogs)
          }
        }

        // Sync shifts for current week
        const shiftRes = await fetch(apiUrl(`/api/shifts?siteId=${activeSiteId}&weekStart=${weekStart}&endDate=${weekEnd}`))
        if (shiftRes.ok) {
          const shiftData = await shiftRes.json()
          if (shiftData.success && Array.isArray(shiftData.shifts)) {
            shiftData.shifts.forEach((s: any) => {
              dispatch({ type: "ADD_SHIFT", shift: s })
            })
          }
        }

        // Sync attendance records
        const attRes = await fetch(apiUrl(`/api/attendance?siteId=${activeSiteId}`))
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
                exceptions: rec.exceptions,
                reason: rec.correctionReason || "",
                actorName: rec.correctedBy || "System",
              })
            })
          }
        }
      } catch (err) {
        console.error("Failed to sync approval data:", err)
      }
    }
    loadApprovalData()
  }, [activeSiteId, weekStart, weekEnd, dispatch])

  if (!site) {
    return (
      <AdminShell crumbs={[{ label: "Weekly approval" }]}>
        <p className="py-24 text-center text-sm text-muted-foreground">No site selected.</p>
      </AdminShell>
    )
  }

  const approval = state.approvals.find((a) => a.siteId === site.id && a.weekStart === weekStart)
  const status = approval?.status ?? "open"
  const isManagerApproved = Boolean(approval?.managerApprovedBy)
  const isManagerLocked = !isHeadOffice && isManagerApproved
  const isLocked = status === "approved" || status === "exported" || isManagerLocked

  const managerReviewedIds = approval?.reviewedEmployeeIds ?? []
  const ownerReviewedIds = approval?.ownerReviewedEmployeeIds ?? []
  const currentRoleReviewedIds = isHeadOffice ? ownerReviewedIds : managerReviewedIds

  // Review activation tracking:
  // For Site Manager: review is started if status is under_review or managerApproved or manager has reviewed any employee
  const isManagerReviewStarted =
    status === "under_review" ||
    isManagerApproved ||
    managerReviewedIds.length > 0

  // For Business Owner: review is started if ownerReviewStarted is true, or owner has reviewed any employee
  const isOwnerReviewStarted =
    Boolean(approval?.ownerReviewStarted) ||
    ownerReviewedIds.length > 0

  const isCurrentRoleReviewStarted = isHeadOffice ? isOwnerReviewStarted : isManagerReviewStarted

  const siteEmployees = state.employees
    .filter((e) => (e.primarySiteId === site.id || state.shifts.some((s) => s.employeeId === e.id && s.siteId === site.id)) && e.status !== "left")
    .sort((a, b) => a.firstName.localeCompare(b.firstName))

  // Build rows for employees with shifts or attendance in the selected week
  const allRows = siteEmployees.map((employee) => {
    const shifts = state.shifts.filter(
      (s) => s.employeeId === employee.id && s.siteId === site.id && s.date >= weekStart && s.date <= weekEnd,
    )
    const scheduledMinutes = shifts.reduce(
      (sum, s) => sum + minutesBetween(s.startTime, s.endTime) - (s.unpaidBreakMinutes ?? 0),
      0,
    )
    const records = state.attendance.filter(
      (a) => a.employeeId === employee.id && a.siteId === site.id && a.date >= weekStart && a.date <= weekEnd
    )
    const workedMinutes = records.reduce((sum, r) => sum + computeWorkedTotals(r.events).payableMinutes, 0)
    const isEmpReviewed = currentRoleReviewedIds.includes(employee.id)

    // Unresolved punch errors that block payroll calculation (e.g. missing clock-out).
    // Acknowledged manager-marked absences and reviewed records do not block approval.
    const openExceptions = records.flatMap((r) => {
      if (r.status === "reviewed" || isEmpReviewed) return []
      // If the record was manually created/marked by manager as absent, it is acknowledged
      const isManagerAbsence =
        r.exceptions.includes("absent") &&
        (r.source === "manager_manual" ||
          r.source === "manager_correction" ||
          (r as any).source === "manager_absent" ||
          Boolean(r.correctionReason))
      if (isManagerAbsence) {
        return r.exceptions.filter((e) => e !== "absent")
      }
      return r.exceptions
    })

    const displayExceptions = records.flatMap((r) => r.exceptions)
    const correctedCount = records.filter(
      (r) =>
        r.events.some((e) => e.source === "manager_correction") ||
        r.source === "manager_correction" ||
        r.source === "manager_manual"
    ).length

    return {
      employee,
      hasShiftsOrAttendance: shifts.length > 0 || records.length > 0,
      scheduledHours: minutesToHours(scheduledMinutes),
      workedHours: minutesToHours(workedMinutes),
      exceptionCount: displayExceptions.length,
      displayExceptions,
      openExceptions,
      correctedCount,
      reviewed: isEmpReviewed,
      shifts,
      records,
    }
  })

  // Display all site employees so week table is never empty when site employees exist
  const rows = allRows

  const totalScheduled = rows.reduce((sum, r) => sum + r.scheduledHours, 0)
  const totalWorked = rows.reduce((sum, r) => sum + r.workedHours, 0)
  const totalOpenExceptions = rows.reduce((sum, r) => sum + r.openExceptions.length, 0)
  const totalCorrectedCount = rows.reduce((sum, r) => sum + r.correctedCount, 0)
  const allReviewed = rows.length > 0 && rows.every((r) => r.reviewed)

  // Week Switcher Handlers
  function handlePrevWeek() {
    const prev = addDays(weekStart, -7)
    dispatch({ type: "SET_WEEK", weekStart: prev })
  }

  function handleNextWeek() {
    const next = addDays(weekStart, 7)
    dispatch({ type: "SET_WEEK", weekStart: next })
  }

  function handleTodayWeek() {
    dispatch({ type: "SET_WEEK", weekStart: CURRENT_WEEK_START })
  }

  // Action Handlers
  async function handleStartReview() {
    if (!site) return
    try {
      const res = await fetch(apiUrl("/api/approval"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: site.id,
          weekStart,
          action: "start_review",
          actorName: actor.name,
          actorRole: state.role,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        dispatch({ type: "START_WEEKLY_REVIEW", siteId: site.id, weekStart, actorName: actor.name })
        if (data.approval) {
          dispatch({
            type: "SET_WEEKLY_APPROVAL",
            approval: {
              id: data.approval.id,
              siteId: data.approval.siteId,
              weekStart: data.approval.weekStart,
              status: data.approval.status,
              reviewedEmployeeIds: data.approval.reviewedEmployeeIds || [],
              ownerReviewedEmployeeIds: data.approval.ownerReviewedEmployeeIds || [],
              managerApprovedBy: data.approval.managerApprovedBy,
              managerApprovedAt: data.approval.managerApprovedAt,
              ownerReviewStarted: Boolean(data.approval.ownerReviewStarted),
              ownerReviewStartedAt: data.approval.ownerReviewStartedAt,
              approvedBy: data.approval.approvedBy,
              approvedAt: data.approval.approvedAt,
              reopenedReason: data.approval.reopenedReason,
              reopenedBy: data.approval.reopenedBy,
              reopenedAt: data.approval.reopenedAt,
              lastUpdatedBy: data.approval.lastUpdatedBy,
              lastUpdatedAt: data.approval.lastUpdatedAt,
            },
          })
        }
        toast.success(`Weekly review started by ${isHeadOffice ? "Business Owner" : "Site Manager"}. You can now review and check employee timesheets.`)
      } else {
        toast.error(data.message || "Failed to start review.")
      }
    } catch (err) {
      console.error("Start review failed:", err)
      toast.error("Failed to start review.")
    }
  }

  async function handleToggleReviewed(employeeId: string) {
    if (!site || isLocked) return
    if (!isCurrentRoleReviewStarted) {
      toast.info("Please click 'Start review' first before reviewing employee timesheets.")
      return
    }
    try {
      const res = await fetch(apiUrl("/api/approval"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: site.id,
          weekStart,
          action: "toggle_reviewed",
          employeeId,
          actorName: actor.name,
          actorRole: state.role,
        }),
      })
      const data = await res.json()
      if (data.success && data.approval) {
        dispatch({
          type: "SET_WEEKLY_APPROVAL",
          approval: {
            id: data.approval.id,
            siteId: data.approval.siteId,
            weekStart: data.approval.weekStart,
            status: data.approval.status,
            reviewedEmployeeIds: data.approval.reviewedEmployeeIds || [],
            ownerReviewedEmployeeIds: data.approval.ownerReviewedEmployeeIds || [],
            managerApprovedBy: data.approval.managerApprovedBy,
            managerApprovedAt: data.approval.managerApprovedAt,
            ownerReviewStarted: Boolean(data.approval.ownerReviewStarted),
            ownerReviewStartedAt: data.approval.ownerReviewStartedAt,
            approvedBy: data.approval.approvedBy,
            approvedAt: data.approval.approvedAt,
            reopenedReason: data.approval.reopenedReason,
            reopenedBy: data.approval.reopenedBy,
            reopenedAt: data.approval.reopenedAt,
            lastUpdatedBy: data.approval.lastUpdatedBy,
            lastUpdatedAt: data.approval.lastUpdatedAt,
          },
        })
      }
    } catch (err) {
      console.error("Toggle review failed:", err)
    }
  }

  async function handleToggleReviewAll() {
    if (!site || isLocked || isTogglingAll) return
    if (!isCurrentRoleReviewStarted) {
      toast.info("Please click 'Start review' first before reviewing employee timesheets.")
      return
    }
    const targetReviewed = !allReviewed
    setIsTogglingAll(true)
    try {
      const employeeIds = rows.map((r) => r.employee.id)
      const res = await fetch(apiUrl("/api/approval"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: site.id,
          weekStart,
          action: "review_all",
          employeeIds,
          reviewed: targetReviewed,
          actorName: actor.name,
          actorRole: state.role,
        }),
      })
      const data = await res.json()
      if (data.success && data.approval) {
        dispatch({
          type: "SET_WEEKLY_APPROVAL",
          approval: {
            id: data.approval.id,
            siteId: data.approval.siteId,
            weekStart: data.approval.weekStart,
            status: data.approval.status,
            reviewedEmployeeIds: data.approval.reviewedEmployeeIds || [],
            ownerReviewedEmployeeIds: data.approval.ownerReviewedEmployeeIds || [],
            managerApprovedBy: data.approval.managerApprovedBy,
            managerApprovedAt: data.approval.managerApprovedAt,
            ownerReviewStarted: Boolean(data.approval.ownerReviewStarted),
            ownerReviewStartedAt: data.approval.ownerReviewStartedAt,
            approvedBy: data.approval.approvedBy,
            approvedAt: data.approval.approvedAt,
            reopenedReason: data.approval.reopenedReason,
            reopenedBy: data.approval.reopenedBy,
            reopenedAt: data.approval.reopenedAt,
            lastUpdatedBy: data.approval.lastUpdatedBy,
            lastUpdatedAt: data.approval.lastUpdatedAt,
          },
        })
        toast.success(targetReviewed ? "All employees marked as reviewed." : "All employee reviews cleared.")
      } else {
        toast.error(data.message || "Failed to update review status.")
      }
    } catch (err) {
      console.error("Toggle all failed:", err)
      toast.error("Failed to update employee reviews.")
    } finally {
      setIsTogglingAll(false)
    }
  }

  async function handleApprove() {
    if (!site) return
    if (!isCurrentRoleReviewStarted) {
      toast.info("Please click 'Start review' and review timesheets first.")
      return
    }
    if (totalOpenExceptions > 0) {
      toast.error("Cannot approve week with open unresolved exceptions.")
      return
    }
    try {
      const res = await fetch(apiUrl("/api/approval"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: site.id,
          weekStart,
          action: "approve",
          actorName: actor.name,
          actorRole: state.role,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        if (isHeadOffice) {
          dispatch({ type: "APPROVE_WEEK", siteId: site.id, weekStart, actorName: actor.name })
          toast.success(`Final approval granted & week locked for ${site.name}`)
        } else {
          // Immediately dispatch notification to store so notification bell icon updates
          dispatch({
            type: "ADD_NOTIFICATION",
            notification: {
              id: `noti-${Date.now()}`,
              recipientRole: "business_owner",
              siteId: site.id,
              siteName: site.name,
              type: "timesheet_approved",
              title: "Ready for Owner Approval",
              message: `${actor.name} (Site Manager) has reviewed and approved the weekly timesheet for ${site.name} (Week of ${weekStart}). Ready for final approval.`,
              timestamp: new Date().toISOString(),
              read: false,
              employeeName: actor.name,
              meta: {
                siteId: site.id,
                weekStart,
                link: "/approval",
                actionText: "Review Approval",
              },
            },
          })
          toast.success(`Weekly timesheet approved & submitted to Business Owner! Notification sent: Ready for owner approval.`)
        }
        setApproveConfirmOpen(false)
        // Refresh page data
        const appRes = await fetch(apiUrl(`/api/approval?siteId=${activeSiteId}&weekStart=${weekStart}`))
        if (appRes.ok) {
          const appData = await appRes.json()
          if (appData.success && appData.approval) {
            dispatch({
              type: "SET_WEEKLY_APPROVAL",
              approval: {
                id: appData.approval.id,
                siteId: appData.approval.siteId,
                weekStart: appData.approval.weekStart,
                status: appData.approval.status,
                reviewedEmployeeIds: appData.approval.reviewedEmployeeIds || [],
                ownerReviewedEmployeeIds: appData.approval.ownerReviewedEmployeeIds || [],
                managerApprovedBy: appData.approval.managerApprovedBy,
                managerApprovedAt: appData.approval.managerApprovedAt,
                ownerReviewStarted: Boolean(appData.approval.ownerReviewStarted),
                ownerReviewStartedAt: appData.approval.ownerReviewStartedAt,
                approvedBy: appData.approval.approvedBy,
                approvedAt: appData.approval.approvedAt,
                reopenedReason: appData.approval.reopenedReason,
                reopenedBy: appData.approval.reopenedBy,
                reopenedAt: appData.approval.reopenedAt,
                lastUpdatedBy: appData.approval.lastUpdatedBy,
                lastUpdatedAt: appData.approval.lastUpdatedAt,
              },
            })
          }
        }
      }
    } catch (err) {
      console.error("Approve failed:", err)
      toast.error("Failed to approve week.")
    }
  }

  async function handleReopen() {
    if (!site) return
    if (!reopenReason.trim()) {
      toast.error("Mandatory audit reason is required to reopen week.")
      return
    }
    try {
      const res = await fetch(apiUrl("/api/approval"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: site.id,
          weekStart,
          action: "reopen",
          reason: reopenReason.trim(),
          actorName: actor.name,
          actorRole: state.role,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        dispatch({ type: "REOPEN_WEEK", siteId: site.id, weekStart, actorName: actor.name, reason: reopenReason.trim() })
        toast.success("Week reopened for edits (Status: Under Review)")
        setReopenOpen(false)
        setReopenReason("")
      } else {
        toast.error(data.message || "Failed to reopen week.")
      }
    } catch (err) {
      console.error("Reopen failed:", err)
      toast.error("Failed to reopen week.")
    }
  }

  function openEmployeeBreakdown(employee: Employee) {
    setSelectedEmployee(employee)
    setBreakdownOpen(true)
  }

  function handleOpenCorrection(emp: Employee, date: string, shift?: Shift, record?: AttendanceRecord) {
    setCorrectionTarget({ employee: emp, date, shift, record })
    setCorrectionOpen(true)
  }

  return (
    <AdminShell crumbs={[{ label: "Weekly approval" }]}>
      <div className="flex flex-col gap-6">
        {/* Header & Controls Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-2xl font-semibold tracking-tight">Weekly approval</h1>
              <StatusBadge status={status} managerApproved={isManagerApproved} ownerReviewStarted={isOwnerReviewStarted} isOwner={isHeadOffice} />
            </div>
            <p className="text-sm text-muted-foreground">
              Review timesheets, resolve exceptions, and finalize weekly payable hours for {site.name}.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAuditDrawerOpen(true)}>
              <History className="mr-1.5 size-4" />
              Audit history
            </Button>

            {!isCurrentRoleReviewStarted && status !== "approved" && status !== "exported" && !(isManagerApproved && !isHeadOffice) && (
              <Button size="sm" variant="secondary" onClick={handleStartReview} className="bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 font-medium">
                <Eye className="mr-1.5 size-4" />
                Start review
              </Button>
            )}

            {(status === "approved" || status === "exported") ? (
              <div className="flex items-center gap-2">
                {isHeadOffice && (
                  <Button size="sm" variant="outline" className="border-amber-500 text-amber-700 hover:bg-amber-50" onClick={() => setReopenOpen(true)}>
                    <RotateCcw className="mr-1.5 size-4" />
                    Reopen week
                  </Button>
                )}
                <Button size="sm" render={<Link href="/payroll" />} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                  <FileSpreadsheet className="mr-1.5 size-4" />
                  {status === "exported" ? "View in Exports" : "Generate Payroll Export"}
                </Button>
              </div>
            ) : isManagerApproved && !isHeadOffice ? (
              <Button size="sm" variant="outline" disabled className="border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300 opacity-90 cursor-not-allowed">
                <CheckCircle2 className="mr-1.5 size-4 text-emerald-600" />
                Submitted to Owner
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setApproveConfirmOpen(true)}
                disabled={rows.length === 0 || totalOpenExceptions > 0 || !isCurrentRoleReviewStarted}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="mr-1.5 size-4" />
                {isHeadOffice ? "Approve week" : "Approve & Submit to Owner"}
              </Button>
            )}
          </div>
        </div>

        {/* Inline Week Switcher */}
        <Card className="bg-muted/30 border-muted">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevWeek} title="Previous week">
                <ChevronLeft className="size-4" />
              </Button>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-md border font-medium text-sm sm:text-base">
                <Calendar className="size-4 text-muted-foreground" />
                <span>{formatWeekRange(weekStart)}</span>
              </div>
              <Button variant="outline" size="icon" onClick={handleNextWeek} title="Next week">
                <ChevronRight className="size-4" />
              </Button>
              {weekStart !== CURRENT_WEEK_START && (
                <Button variant="ghost" size="sm" onClick={handleTodayWeek} className="text-xs">
                  Today&apos;s week
                </Button>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Site: <strong className="text-foreground font-medium">{site.name}</strong></span>
              <span>•</span>
              <span>Employees active: <strong className="text-foreground font-medium">{rows.length}</strong></span>
            </div>
          </CardContent>
        </Card>

        {/* Manager Approved Info Banner */}
        {approval?.managerApprovedBy && status !== "approved" && status !== "exported" && (
          <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-50 dark:bg-blue-950/20 p-4 text-sm text-blue-900 dark:text-blue-300">
            <CheckCircle2 className="size-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="flex-1">
              <p className="font-semibold">
                ✓ Reviewed &amp; Approved by Site Manager ({approval.managerApprovedBy})
              </p>
              <p className="text-xs opacity-90">
                Site Manager {approval.managerApprovedAt ? formatDateLong(approval.managerApprovedAt.slice(0, 10)) : "recently"} submitted this weekly timesheet. {isHeadOffice ? "Review employee hours and click 'Approve week' to grant final approval." : "Submitted to Business Owner. Timesheet modifications are now locked for Site Manager."}
              </p>
            </div>
          </div>
        )}

        {/* Locked Info Banner */}
        {isLocked && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 p-4 text-sm text-emerald-900 dark:text-emerald-300">
            <div className="flex items-center gap-3">
              <Lock className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="flex-1">
                <p className="font-semibold">
                  This week is {status === "exported" ? "Exported & Locked" : "Approved & Ready for Payroll"}
                </p>
                <p className="text-xs opacity-90">
                  {approval?.approvedBy ? `Approved by ${approval.approvedBy} on ${formatDateLong(approval.approvedAt || "")}. ` : ""}
                  {status === "exported"
                    ? "Timesheet is finalized and exported to payroll."
                    : "Timesheet has been approved by the Business Owner. You can now generate the payroll CSV export."}
                </p>
              </div>
            </div>
            {status === "approved" && (
              <Button size="sm" render={<Link href="/payroll" />} className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm">
                <FileSpreadsheet className="mr-1.5 size-4" />
                Generate Payroll Export
              </Button>
            )}
            {status === "exported" && (
              <Button size="sm" variant="outline" render={<Link href="/payroll" />} className="shrink-0 border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-300">
                <FileSpreadsheet className="mr-1.5 size-4" />
                View in Exports History
              </Button>
            )}
          </div>
        )}

        {/* Summary Metrics Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <SummaryCard label="Total Employees" value={String(rows.length)} icon={UserCheck} />
          <SummaryCard label="Scheduled Hours" value={`${totalScheduled.toFixed(2)} hrs`} icon={Clock} />
          <SummaryCard label="Payable Hours" value={`${totalWorked.toFixed(2)} hrs`} icon={CheckCircle2} tone="success" />
          <SummaryCard
            label="Open Exceptions"
            value={String(totalOpenExceptions)}
            tone={totalOpenExceptions > 0 ? "warning" : "default"}
            icon={ShieldAlert}
          />
          <SummaryCard label="Corrected Records" value={String(totalCorrectedCount)} icon={Edit3} />
        </div>

        {/* Employee Timesheet Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Employee Timesheets</CardTitle>
              <CardDescription>
                Review employee hours, exceptions, and daily breakdowns before approving the week.
              </CardDescription>
            </div>
            {!isLocked && rows.length > 0 && (
              <div className="flex items-center gap-2">
                {!isCurrentRoleReviewStarted ? (
                  <Badge variant="outline" className="text-xs font-normal border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                    Click &ldquo;Start review&rdquo; to enable checkboxes
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs font-normal">
                    {allReviewed
                      ? "✓ All employees reviewed"
                      : `${rows.filter((r) => r.reviewed).length} / ${rows.length} reviewed`}
                  </Badge>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0 sm:p-6 overflow-x-auto min-w-0 max-w-full shadow-inner">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Payable</TableHead>
                  <TableHead>Exceptions</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Reviewed</span>
                      {rows.length > 0 && !isLocked && isCurrentRoleReviewStarted && (
                        <button
                          type="button"
                          disabled={isTogglingAll}
                          onClick={handleToggleReviewAll}
                          className="text-[11px] font-normal text-primary hover:underline ml-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isTogglingAll ? "(Updating...)" : allReviewed ? "(Uncheck all)" : "(Check all)"}
                        </button>
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ClipboardCheck className="w-8 h-8 text-muted-foreground/50" />
                        <span className="font-medium">No shifts or attendance records found for this week</span>
                        <span className="text-xs">Select another week using the week switcher above or assign shifts in Weekly Rota.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const initials = `${row.employee.firstName[0] ?? ""}${row.employee.lastName[0] ?? ""}`.toUpperCase()
                    return (
                      <TableRow key={row.employee.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell>
                          <Avatar className="size-8">
                            <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">
                              {row.employee.firstName} {row.employee.lastName}
                            </span>
                            <span className="text-xs text-muted-foreground">{row.employee.jobTitle}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{row.scheduledHours.toFixed(2)} hrs</TableCell>
                        <TableCell className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          {row.workedHours.toFixed(2)} hrs
                        </TableCell>
                        <TableCell>
                          {row.displayExceptions.length === 0 ? (
                            <Badge variant="secondary" className="font-normal text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                              ✓ Clean
                            </Badge>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {row.displayExceptions.map((ex, i) => {
                                const isBlocking = row.openExceptions.includes(ex)
                                if (ex === "absent") {
                                  return (
                                    <Badge
                                      key={i}
                                      variant="outline"
                                      className="font-normal text-xs border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300"
                                    >
                                      Absent
                                    </Badge>
                                  )
                                }
                                return (
                                  <Badge
                                    key={i}
                                    variant={isBlocking ? "destructive" : "secondary"}
                                    className="font-normal text-xs"
                                  >
                                    {EXCEPTION_LABELS[ex] || ex}
                                  </Badge>
                                )
                              })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div
                            className={`flex items-center justify-center gap-2 ${!isCurrentRoleReviewStarted && !isLocked ? "cursor-not-allowed opacity-60" : ""}`}
                            onClick={(e) => {
                              if (!isCurrentRoleReviewStarted && !isLocked) {
                                e.preventDefault()
                                toast.info("Please click 'Start review' first before reviewing employee timesheets.")
                              }
                            }}
                          >
                            <Checkbox
                              id={`reviewed-${row.employee.id}`}
                              checked={row.reviewed}
                              disabled={isLocked || !isCurrentRoleReviewStarted}
                              onCheckedChange={() => {
                                if (isCurrentRoleReviewStarted) {
                                  handleToggleReviewed(row.employee.id)
                                }
                              }}
                            />
                            <Label
                              htmlFor={`reviewed-${row.employee.id}`}
                              className={`text-xs text-muted-foreground ${!isCurrentRoleReviewStarted || isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}
                            >
                              {row.reviewed ? "Reviewed" : "Pending"}
                            </Label>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEmployeeBreakdown(row.employee)}>
                            <Eye className="mr-1 size-3.5" />
                            Daily breakdown
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Employee Daily Detail Drawer (Sheet) */}
      <Sheet open={breakdownOpen} onOpenChange={setBreakdownOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col h-full p-0 gap-0 overflow-hidden">
          {(() => {
            const selectedRow = selectedEmployee ? rows.find((r) => r.employee.id === selectedEmployee.id) : null
            return (
              <>
                {/* Fixed Top Header & Metrics Strip */}
                <div className="shrink-0 border-b border-border/70 bg-card p-4 sm:p-5 pr-12 flex flex-col gap-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="size-11 border border-border/80 shadow-xs ring-2 ring-primary/10 shrink-0">
                      <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                        {selectedEmployee ? `${selectedEmployee.firstName[0]}${selectedEmployee.lastName[0]}` : ""}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SheetTitle className="text-base font-bold tracking-tight text-foreground truncate">
                          {selectedEmployee?.firstName} {selectedEmployee?.lastName}
                        </SheetTitle>
                        {selectedEmployee?.employeeNumber && (
                          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-4 border-border/80 text-muted-foreground shrink-0">
                            #{selectedEmployee.employeeNumber}
                          </Badge>
                        )}
                      </div>
                      <SheetDescription className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="font-medium text-foreground/80">{selectedEmployee?.jobTitle}</span>
                        <span>•</span>
                        <span>£{(selectedEmployee?.hourlyRate ?? 0).toFixed(2)}/hr</span>
                        <span>•</span>
                        <span className="truncate">{site?.name}</span>
                      </SheetDescription>
                    </div>
                  </div>

                  {/* Weekly Totals Summary Strip - bounded with 2-decimal digits */}
                  {selectedRow && (
                    <div className="grid grid-cols-3 gap-2 sm:gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/60 overflow-hidden">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-medium text-muted-foreground truncate">Scheduled</span>
                        <span className="text-sm sm:text-base font-bold text-foreground mt-0.5 truncate tabular-nums">
                          {selectedRow.scheduledHours.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">hrs</span>
                        </span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-medium text-muted-foreground truncate">Payable</span>
                        <span className={cn(
                          "text-sm sm:text-base font-bold mt-0.5 truncate tabular-nums",
                          selectedRow.workedHours > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                        )}>
                          {selectedRow.workedHours.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">hrs</span>
                        </span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-medium text-muted-foreground truncate">Est. Pay</span>
                        <span
                          className="text-sm sm:text-base font-bold text-foreground mt-0.5 truncate tabular-nums"
                          title={`£${(selectedRow.workedHours * (selectedEmployee?.hourlyRate ?? 0)).toFixed(2)}`}
                        >
                          £{(selectedRow.workedHours * (selectedEmployee?.hourlyRate ?? 0)).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Scrollable 7-Day Daily Breakdown Content */}
                {selectedEmployee && (
                  <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-3.5 min-h-0">
                    {/* Section Header */}
                    <div className="flex items-center justify-between pb-1 border-b border-border/50">
                      <div>
                        <h4 className="font-semibold text-sm tracking-tight text-foreground">7-Day Daily Breakdown</h4>
                        <p className="text-xs text-muted-foreground">{formatWeekRange(weekStart)}</p>
                      </div>
                      {selectedRow && selectedRow.displayExceptions.length > 0 && (
                        <Badge variant="destructive" className="text-[10px] font-normal px-2 py-0.5">
                          {selectedRow.displayExceptions.length} {selectedRow.displayExceptions.length === 1 ? "Exception" : "Exceptions"}
                        </Badge>
                      )}
                    </div>

                    {/* 7 Days List */}
                    <div className="flex flex-col gap-2.5 pb-2">
                      {weekDays(weekStart).map((dateStr) => {
                        const shift = state.shifts.find((s) => s.employeeId === selectedEmployee.id && s.siteId === site?.id && s.date === dateStr)
                        const record = state.attendance.find((a) => a.employeeId === selectedEmployee.id && a.siteId === site?.id && a.date === dateStr)
                        const events = record?.events || []
                        const totals = computeWorkedTotals(events)

                        const clockInEvt = events.find((e) => e.type === "clock_in")
                        const breakStartEvt = events.find((e) => e.type === "break_start")
                        const breakEndEvt = events.find((e) => e.type === "break_end")
                        const clockOutEvt = events.find((e) => e.type === "clock_out")

                        const hasCorrection = events.some((e) => e.source === "manager_correction") || record?.source === "manager_correction"
                        const hasEvents = events.length > 0
                        const hasExceptions = Boolean(record && record.exceptions.length > 0)
                        const isToday = dateStr === TODAY_ISO
                        const isRestDay = !shift && !hasEvents

                        const dateObj = new Date(dateStr + "T00:00:00")
                        const dayName = dayOfWeekShort(dateStr)
                        const dayDateStr = `${dateObj.getDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][dateObj.getMonth()]}`

                        return (
                          <div
                            key={dateStr}
                            className={cn(
                              "rounded-xl border transition-all text-sm p-3.5 flex flex-col gap-2.5",
                              isToday
                                ? "border-primary/40 bg-primary/[0.02] ring-1 ring-primary/20"
                                : isRestDay
                                ? "border-border/40 bg-muted/20 opacity-80"
                                : "border-border/70 bg-card shadow-2xs"
                            )}
                          >
                            {/* Top row: Day Date, Badges & Hours Status (Clean, no Correct button) */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground">{dayName}</span>
                                <span className="text-xs text-muted-foreground">{dayDateStr}</span>
                                {isToday && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium bg-primary/10 text-primary border-primary/20">
                                    Today
                                  </Badge>
                                )}
                                {hasCorrection && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                    Corrected
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                {totals.payableMinutes > 0 ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[11px] font-semibold px-2 py-0.5 tabular-nums">
                                    {minutesToHours(totals.payableMinutes).toFixed(2)} hrs payable
                                  </Badge>
                                ) : shift ? (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground tabular-nums">
                                    0.00 hrs
                                  </Badge>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground/60 italic font-medium">Rest Day</span>
                                )}
                              </div>
                            </div>

                            {/* Scheduled Shift Line */}
                            {shift ? (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="size-3 text-muted-foreground/70" />
                                <span>
                                  Scheduled: <strong className="font-semibold text-foreground">{shift.startTime} – {shift.endTime}</strong>
                                  {" "}({shift.unpaidBreakMinutes ?? 0}m break)
                                </span>
                              </div>
                            ) : null}

                            {/* Punch Records */}
                            {hasEvents ? (
                              <>
                                <div className="grid grid-cols-4 gap-2 text-xs bg-muted/40 p-2.5 rounded-lg border border-border/50">
                                  <div>
                                    <span className="text-muted-foreground block text-[10px] font-medium uppercase tracking-wider">Clock In</span>
                                    <span className={cn("font-medium", clockInEvt ? "text-foreground font-semibold" : "text-muted-foreground/40")}>
                                      {clockInEvt ? formatTimestamp12(clockInEvt.timestamp) : "—"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block text-[10px] font-medium uppercase tracking-wider">Break Start</span>
                                    <span className={cn("font-medium", breakStartEvt ? "text-foreground font-semibold" : "text-muted-foreground/40")}>
                                      {breakStartEvt ? formatTimestamp12(breakStartEvt.timestamp) : "—"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block text-[10px] font-medium uppercase tracking-wider">Break End</span>
                                    <span className={cn("font-medium", breakEndEvt ? "text-foreground font-semibold" : "text-muted-foreground/40")}>
                                      {breakEndEvt ? formatTimestamp12(breakEndEvt.timestamp) : "—"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block text-[10px] font-medium uppercase tracking-wider">Clock Out</span>
                                    <span className={cn("font-medium", clockOutEvt ? "text-foreground font-semibold" : "text-muted-foreground/40")}>
                                      {clockOutEvt ? formatTimestamp12(clockOutEvt.timestamp) : "—"}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
                                  <span>Gross: {minutesToHours(totals.grossMinutes).toFixed(2)}h · Break: {totals.breakMinutes}m</span>
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                    Payable: {minutesToHours(totals.payableMinutes).toFixed(2)} hrs
                                  </span>
                                </div>
                              </>
                            ) : shift ? (
                              <div className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-muted/30 border border-dashed border-border/60 text-muted-foreground">
                                <span className="text-[11px]">No clock punches recorded for this shift</span>
                                <span className="text-[11px] font-medium text-muted-foreground/70 tabular-nums">0.00 payable hrs</span>
                              </div>
                            ) : (
                              <div className="text-[11px] text-muted-foreground/60 italic">
                                No scheduled shift or clock records
                              </div>
                            )}

                            {/* Exceptions */}
                            {hasExceptions && (
                              <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/50">
                                {record?.exceptions.map((ex) => (
                                  <Badge key={ex} variant="destructive" className="text-[10px] py-0 px-2 font-normal flex items-center gap-1">
                                    <AlertTriangle className="size-2.5" />
                                    {EXCEPTION_LABELS[ex] || ex}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Fixed Bottom Footer */}
                <div className="shrink-0 border-t border-border/70 p-3.5 bg-card">
                  <SheetClose render={<Button variant="outline" className="w-full h-9 text-xs font-medium" />}>
                    Close
                  </SheetClose>
                </div>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>

      {/* Correction Drawer Integration */}
      <CorrectionDrawer
        open={correctionOpen}
        onOpenChange={setCorrectionOpen}
        employee={correctionTarget.employee}
        siteId={site?.id || ""}
        date={correctionTarget.date}
        shift={correctionTarget.shift}
        record={correctionTarget.record}
      />

      {/* Audit History Drawer */}
      <Sheet open={auditDrawerOpen} onOpenChange={setAuditDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-6">
          <SheetHeader className="pb-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2.5 text-lg font-semibold">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <History className="size-5" />
                </div>
                <span>Weekly Audit Log</span>
              </SheetTitle>
              {dbAuditLogs.length > 0 && (
                <Badge variant="outline" className="font-mono text-xs font-normal">
                  {dbAuditLogs.length} events
                </Badge>
              )}
            </div>
            <SheetDescription className="text-xs text-muted-foreground mt-1">
              Complete chronological audit trail of timesheet submissions, owner approvals, reopening events, and employee reviews for <strong className="text-foreground">{site.name}</strong>.
            </SheetDescription>
          </SheetHeader>

          <div className="py-6">
            {dbAuditLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground border border-dashed rounded-xl p-8 bg-muted/20">
                <History className="size-10 opacity-40 mb-3" />
                <p className="font-medium text-sm text-foreground">No audit logs recorded yet</p>
                <p className="text-xs text-muted-foreground max-w-xs mt-1">
                  Actions taken on this week&apos;s timesheet will appear here automatically with full timestamps and actor details.
                </p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/80">
                {dbAuditLogs.map((log: any) => {
                  const style = getAuditIconAndColor(log.action || "")
                  const IconNode = style.icon
                  const formattedDetails = formatAuditDetails(
                    log.newValue || "",
                    state.employees,
                    log.action,
                    log.userName,
                    log.previousValue
                  )
                  const displayDate = log.timestamp
                    ? new Date(log.timestamp).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Recently"

                  return (
                    <div key={log.id} className="relative group">
                      {/* Timeline Node Icon */}
                      <div className={`absolute -left-6 top-1.5 flex items-center justify-center size-6 rounded-full border shadow-xs ring-4 ring-background ${style.nodeColor}`}>
                        <IconNode className="size-3.5" />
                      </div>

                      {/* Card Content */}
                      <Card className="border shadow-2xs hover:shadow-xs transition-all duration-200 bg-card/60 backdrop-blur-xs">
                        <CardContent className="p-4 flex flex-col gap-2.5">
                          {/* Header */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                            <span className="font-semibold text-sm tracking-tight text-foreground">
                              {formatAuditAction(log.action)}
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full border border-border/40">
                              <Clock className="size-3 text-muted-foreground/70" />
                              <span>{displayDate}</span>
                            </div>
                          </div>

                          {/* Details */}
                          {formattedDetails && (
                            <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                              {formattedDetails}
                            </p>
                          )}

                          {/* Mandatory Audit Reason */}
                          {log.reason && (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/20 p-3 text-xs text-amber-950 dark:text-amber-200 space-y-1">
                              <div className="font-semibold text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                <ShieldAlert className="size-3.5" /> Mandatory Audit Reason
                              </div>
                              <div className="italic text-xs font-normal opacity-95 pl-3 border-l-2 border-amber-400 dark:border-amber-600">
                                &ldquo;{log.reason}&rdquo;
                              </div>
                            </div>
                          )}

                          {/* Footer Metadata */}
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground pt-1.5 border-t border-border/40">
                            <div className="flex items-center gap-1.5">
                              <Badge variant="secondary" className="font-normal text-[11px] py-0 px-2 bg-muted/60">
                                By: <strong className="text-foreground ml-1 font-medium">{log.userName}</strong> ({log.role})
                              </Badge>
                            </div>
                            {log.source && (
                              <span className="text-[10px] text-muted-foreground/80 font-mono">
                                Source: {log.source}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <SheetFooter className="pt-4 border-t">
            <SheetClose render={<Button variant="outline" className="w-full" />}>
              Close Audit Log
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Explicit Approval Confirmation Dialog */}
      <AlertDialog open={approveConfirmOpen} onOpenChange={setApproveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="size-5" />
              Approve Weekly Timesheet?
            </AlertDialogTitle>
            <AlertDialogDescription render={<div />} className="space-y-3 pt-2 text-sm text-foreground">
              <div>
                You are approving the timesheet for <strong>{site.name}</strong> for the week of{" "}
                <strong>{formatWeekRange(weekStart)}</strong>.
              </div>
              <div className="bg-muted p-3 rounded-lg border space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Total Payable Hours:</span>
                  <strong className="font-semibold text-emerald-600">{totalWorked.toFixed(1)} hrs</strong>
                </div>
                <div className="flex justify-between">
                  <span>Active Employees:</span>
                  <strong>{rows.length} employees</strong>
                </div>
                <div className="flex justify-between">
                  <span>Open Exceptions:</span>
                  <strong className={totalOpenExceptions > 0 ? "text-red-500" : "text-emerald-600"}>
                    {totalOpenExceptions}
                  </strong>
                </div>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Lock className="size-3.5 shrink-0 text-amber-500" />
                Approving will lock all records against further manager edits. Only Head Office Admin can reopen an approved week.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Lock className="mr-1.5 size-4" />
              Approve & Lock Week
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Head Office Reopen Dialog (Requires Mandatory Audit Reason) */}
      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <RotateCcw className="size-5" />
              Reopen Approved Week
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Reopening will unlock {site.name}&apos;s timesheet for {formatWeekRange(weekStart)} and set its status back to <strong>Under Review</strong>. A mandatory audit reason is required.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <Label htmlFor="reopen-reason" className="text-xs font-medium">
              Reason for Reopening <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reopen-reason"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="e.g. Payroll query raised by manager; employee forgot to log overtime on Friday."
              rows={3}
              className="text-sm"
              required
            />
            {!reopenReason.trim() && (
              <p className="text-[11px] text-amber-600 font-medium">
                * You must provide a reason before reopening an approved week.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleReopen} disabled={!reopenReason.trim()} className="bg-amber-600 hover:bg-amber-700 text-white">
              Reopen Week
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  )
}

function StatusBadge({
  status,
  managerApproved,
  ownerReviewStarted,
  isOwner,
}: {
  status: "open" | "under_review" | "approved" | "exported"
  managerApproved?: boolean
  ownerReviewStarted?: boolean
  isOwner?: boolean
}) {
  if (managerApproved && status === "under_review") {
    if (ownerReviewStarted) {
      return (
        <Badge variant="outline" className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950/20">
          <Eye className="size-3.5 text-amber-600" />
          <span>Owner Reviewing</span>
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-950/20">
        <CheckCircle2 className="size-3.5 text-blue-600" />
        <span>Submitted to Owner</span>
      </Badge>
    )
  }
  const map: Record<typeof status, { label: string; variant: "secondary" | "default" | "outline"; icon: React.ComponentType<any>; color: string }> = {
    open: { label: "Not Started", variant: "secondary", icon: Clock, color: "text-muted-foreground" },
    under_review: { label: "Under Review", variant: "outline", icon: Eye, color: "border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950/20" },
    approved: { label: "Approved & Locked", variant: "default", icon: Lock, color: "bg-emerald-600 text-white" },
    exported: { label: "Exported & Locked", variant: "default", icon: Lock, color: "bg-purple-600 text-white" },
  }
  const info = map[status]
  const Icon = info.icon
  return (
    <Badge variant={info.variant} className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold ${info.color}`}>
      <Icon className="size-3.5" />
      <span>{info.label}</span>
    </Badge>
  )
}

function SummaryCard({
  label,
  value,
  tone = "default",
  icon: Icon,
}: {
  label: string
  value: string
  tone?: "default" | "warning" | "success"
  icon: React.ComponentType<any>
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">{label}</span>
          <Icon className="size-4 opacity-70" />
        </div>
        <span
          className={
            tone === "warning" && value !== "0"
              ? "text-2xl font-bold text-amber-600 dark:text-amber-400"
              : tone === "success"
              ? "text-2xl font-bold text-emerald-600 dark:text-emerald-400"
              : "text-2xl font-bold"
          }
        >
          {value}
        </span>
      </CardContent>
    </Card>
  )
}

