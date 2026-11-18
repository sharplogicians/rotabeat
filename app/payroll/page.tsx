"use client"

import * as React from "react"
 import { apiUrl } from '@/lib/api';
import { AdminShell } from "@/components/shell/admin-shell"
import { useAppStore, useAccessibleSites, useCurrentUser } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { addDays, formatDateTime, formatWeekRange, CURRENT_WEEK_START } from "@/lib/date-utils"
import { computeWorkedTotals, minutesToHours } from "@/lib/calc"
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Lock, DollarSign, Check, X, Clock, ShieldAlert } from "lucide-react"
import { toast } from "sonner"

export default function PayrollExportsPage() {
  const { state, dispatch } = useAppStore()
  const accessibleSites = useAccessibleSites()
  const actor = useCurrentUser()
  const isOwner = state.role === "business_owner" || state.role === "head_office"

  const [weekStart, setWeekStart] = React.useState(CURRENT_WEEK_START)
  const [selectedSiteIds, setSelectedSiteIds] = React.useState<string[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [adjustments, setAdjustments] = React.useState<any[]>([])
  const [adjustmentsLoading, setAdjustmentsLoading] = React.useState(false)

  const fetchAdjustments = React.useCallback(async () => {
    try {
      setAdjustmentsLoading(true)
      const res = await fetch(apiUrl("/api/payroll/adjustments"))
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.adjustments)) {
          setAdjustments(data.adjustments)
        }
      }
    } catch (err) {
      console.error("Failed to load payroll adjustments:", err)
    } finally {
      setAdjustmentsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchAdjustments()
  }, [fetchAdjustments])

  async function handleReviewAdjustment(adjId: string, action: "approve" | "reject") {
    try {
      const res = await fetch(apiUrl("/api/payroll/adjustments"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adjustmentId: adjId,
          action,
          reviewedBy: actor.name,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(action === "approve" ? "Adjustment approved." : "Adjustment waived.")
        fetchAdjustments()
      } else {
        toast.error(data.message || "Failed to update adjustment.")
      }
    } catch {
      toast.error("Network error updating adjustment.")
    }
  }

  const weekEnd = React.useMemo(() => addDays(weekStart, 6), [weekStart])

  // Fetch exports, employees, attendance, shifts & approvals from DB on mount or week start change
  React.useEffect(() => {
    async function loadData() {
      try {
        // 1. Load payroll export history from DB
        const res = await fetch(apiUrl("/api/payroll"))
        if (res.ok) {
          const data = await res.json()
          if (data.success && Array.isArray(data.exports)) {
            dispatch({ type: "SET_PAYROLL_EXPORTS", exports: data.exports })
          }
        }

        // 2. Load employees from DB
        const empRes = await fetch(apiUrl("/api/employees"))
        if (empRes.ok) {
          const empData = await empRes.json()
          if (empData.success && Array.isArray(empData.employees)) {
            dispatch({ type: "SET_EMPLOYEES", employees: empData.employees })
          }
        }

        // 3. Load attendance from DB
        const attRes = await fetch(apiUrl("/api/attendance"))
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

        // 4. Load approvals & shifts for each accessible site for current week
        for (const s of accessibleSites) {
          // Approvals
          const appRes = await fetch(apiUrl(`/api/approval?siteId=${s.id}&weekStart=${weekStart}`))
          if (appRes.ok) {
            const appData = await appRes.json()
            if (appData.success && appData.approval) {
              dispatch({
                type: "SET_WEEKLY_APPROVAL",
                approval: appData.approval,
              })
            }
          }

          // Shifts
          const shiftRes = await fetch(apiUrl(`/api/shifts?siteId=${s.id}&start=${weekStart}&end=${weekEnd}`))
          if (shiftRes.ok) {
            const shiftData = await shiftRes.json()
            if (shiftData.success && Array.isArray(shiftData.shifts)) {
              dispatch({ type: "SET_SHIFTS", shifts: shiftData.shifts })
            }
          }
        }
      } catch (err) {
        console.error("Failed to load payroll data from DB:", err)
      }
    }
    loadData()
  }, [dispatch, weekStart, weekEnd, accessibleSites])

  const weekOptions = React.useMemo(() => {
    return [
      addDays(weekStart, -14),
      addDays(weekStart, -7),
      weekStart,
      addDays(weekStart, 7),
      addDays(weekStart, 14),
    ]
  }, [weekStart])

  const siteSummaries = accessibleSites.map((site) => {
    const approval = state.approvals.find((a) => a.siteId === site.id && a.weekStart === weekStart)
    const status = approval?.status ?? "open"
    const employees = state.employees.filter(
      (e) => (e.primarySiteId === site.id || state.shifts.some((s) => s.employeeId === e.id && s.siteId === site.id)) && e.status !== "left"
    )

    let totalPayableMinutes = 0
    for (const employee of employees) {
      const records = state.attendance.filter(
        (a) => a.employeeId === employee.id && a.siteId === site.id && a.date >= weekStart && a.date <= weekEnd
      )
      totalPayableMinutes += records.reduce((sum, r) => sum + computeWorkedTotals(r.events).payableMinutes, 0)
    }

    return {
      site,
      status,
      employeeCount: employees.length,
      payableHours: minutesToHours(totalPayableMinutes),
      eligible: status === "approved",
    }
  })

  // Auto-select eligible site if manager has single site
  React.useEffect(() => {
    if (accessibleSites.length === 1) {
      const single = siteSummaries[0]
      if (single && single.eligible && !selectedSiteIds.includes(single.site.id)) {
        setSelectedSiteIds([single.site.id])
      }
    }
  }, [accessibleSites.length, siteSummaries, selectedSiteIds])

  const selectedSummaries = siteSummaries.filter((s) => selectedSiteIds.includes(s.site.id))
  const totalEmployees = selectedSummaries.reduce((sum, s) => sum + s.employeeCount, 0)
  const totalPayableHours = selectedSummaries.reduce((sum, s) => sum + s.payableHours, 0)
  const canGenerate = selectedSummaries.length > 0 && selectedSummaries.every((s) => s.eligible)

  function toggleSite(siteId: string, eligible: boolean) {
    if (!eligible) return
    setSelectedSiteIds((prev) => (prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]))
  }

  async function handleGenerate() {
    if (!canGenerate || submitting) return
    setSubmitting(true)

    const rows = ["Employee Number,Employee Name,Site,Payable Hours"]
    for (const summary of selectedSummaries) {
      const employees = state.employees.filter(
        (e) => (e.primarySiteId === summary.site.id || state.shifts.some((s) => s.employeeId === e.id && s.siteId === summary.site.id)) && e.status !== "left"
      )
      for (const employee of employees) {
        const records = state.attendance.filter(
          (a) => a.employeeId === employee.id && a.siteId === summary.site.id && a.date >= weekStart && a.date <= weekEnd
        )
        const minutes = records.reduce((sum, r) => sum + computeWorkedTotals(r.events).payableMinutes, 0)
        rows.push(
          `${employee.employeeNumber},${employee.firstName} ${employee.lastName},${summary.site.name},${minutesToHours(minutes).toFixed(1)}`,
        )
      }
    }

    const payload = {
      payPeriodLabel: formatWeekRange(weekStart),
      weekStart,
      siteIds: selectedSummaries.map((s) => s.site.id),
      employeeCount: totalEmployees,
      totalPayableHours,
      generatedBy: actor.name,
      csvData: rows.join("\n") + "\n",
    }

    try {
      const res = await fetch(apiUrl("/api/payroll"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (res.ok && data.success && data.export) {
        dispatch({
          type: "GENERATE_PAYROLL_EXPORT",
          export: data.export,
          siteIds: selectedSummaries.map((s) => s.site.id),
          weekStart,
          actorName: actor.name,
        })

        toast.success(`Payroll export ${data.export.id} generated & saved to database!`, {
          description: `${totalEmployees} employees, ${totalPayableHours.toFixed(1)} payable hours`,
        })
        setSelectedSiteIds([])
      } else {
        toast.error(data.message || "Failed to save payroll export to database.")
      }
    } catch (err: any) {
      console.error("Failed to generate payroll export:", err)
      toast.error("Failed to generate payroll export.")
    } finally {
      setSubmitting(false)
    }
  }

  function handleDownload(csvData: string, id: string) {
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${id}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const accessibleSiteIds = React.useMemo(() => new Set(accessibleSites.map((s) => s.id)), [accessibleSites])
  const history = React.useMemo(() => {
    return [...state.payrollExports]
      .filter((exp) => isOwner || exp.siteIds.some((sid) => accessibleSiteIds.has(sid)))
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
  }, [state.payrollExports, isOwner, accessibleSiteIds])

  return (
    <AdminShell crumbs={[{ label: "Payroll exports" }]}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Payroll exports</h1>
          <p className="text-sm text-muted-foreground">
            Generate a payable-hours export for owner-approved weeks and download the CSV for payroll.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generate export</CardTitle>
            <CardDescription>Choose a pay period and select the sites to include.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2 sm:max-w-xs">
              <Label htmlFor="week-select">Pay period</Label>
              <Select
                value={weekStart}
                onValueChange={(v) => {
                  if (!v) return
                  setWeekStart(v)
                  setSelectedSiteIds([])
                }}
              >
                <SelectTrigger id="week-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weekOptions.map((w) => (
                    <SelectItem key={w} value={w}>
                      {formatWeekRange(w)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Sites</Label>
              <div className="flex flex-col gap-2 rounded-lg border p-3">
                {siteSummaries.map((summary) => (
                  <div key={summary.site.id} className="flex items-center justify-between gap-3 py-1">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`site-${summary.site.id}`}
                        checked={selectedSiteIds.includes(summary.site.id)}
                        disabled={!summary.eligible}
                        onCheckedChange={() => toggleSite(summary.site.id, summary.eligible)}
                      />
                      <Label
                        htmlFor={`site-${summary.site.id}`}
                        className={!summary.eligible ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer font-medium"}
                      >
                        {summary.site.name}
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        {summary.employeeCount} employees · {summary.payableHours.toFixed(1)} hrs
                      </span>
                    </div>
                    <ExportStatusBadge status={summary.status} />
                  </div>
                ))}
              </div>
              {selectedSummaries.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Only weeks approved by the Business Owner in Weekly Approval are eligible for export.
                </p>
              )}
            </div>

            {selectedSummaries.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">Employees included</p>
                  <p className="text-2xl font-semibold">{totalEmployees}</p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">Total payable hours</p>
                  <p className="text-2xl font-semibold">{totalPayableHours.toFixed(1)}</p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={handleGenerate} disabled={!canGenerate || submitting}>
              <FileSpreadsheet data-icon="inline-start" />
              {submitting ? "Generating export..." : "Generate export"}
            </Button>
          </CardFooter>
        </Card>

        {/* Proposed Payroll Adjustments Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="size-5 text-amber-500" />
                  Proposed Payroll Adjustments (Late Unpaid Time)
                </CardTitle>
                <CardDescription>
                  Pro-rata deductions calculated strictly for unpaid late minutes at actual contract pay rates. Review and approve prior to final payroll.
                </CardDescription>
              </div>
              {adjustments.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {adjustments.filter((a) => a.status === "proposed").length} pending review
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 overflow-x-auto min-w-0 max-w-full">
            {adjustments.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No proposed payroll adjustments. Shifts are on time or exceptions have been settled.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Sched vs Worked</TableHead>
                    <TableHead>Late</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Proposed Deduction</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments.map((adj) => {
                    const isPending = adj.status === "proposed"
                    return (
                      <TableRow key={adj.id}>
                        <TableCell>
                          <div className="font-medium text-xs">{adj.employeeName}</div>
                          <div className="text-[11px] text-muted-foreground">{adj.employeeNumber}</div>
                        </TableCell>
                        <TableCell className="text-xs">{adj.date}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{adj.siteName}</TableCell>
                        <TableCell className="text-xs">
                          {adj.scheduledHours.toFixed(1)}h sched / {adj.workedHours.toFixed(1)}h worked
                        </TableCell>
                        <TableCell className="text-xs font-medium text-amber-600 dark:text-amber-400">
                          {adj.lateMinutes} mins
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          £{adj.hourlyRate.toFixed(2)}/hr
                        </TableCell>
                        <TableCell className="text-xs font-bold text-destructive">
                          -£{adj.deductionAmount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              adj.status === "approved"
                                ? "default"
                                : adj.status === "rejected"
                                ? "secondary"
                                : "outline"
                            }
                            className={`text-[10px] ${
                              adj.status === "proposed"
                                ? "text-amber-600 border-amber-300 dark:text-amber-400"
                                : adj.status === "approved"
                                ? "bg-emerald-600 text-white"
                                : "text-muted-foreground"
                            }`}
                          >
                            {adj.status === "proposed"
                              ? "Pending Review"
                              : adj.status === "approved"
                              ? "Approved"
                              : "Waived"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {isPending ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => handleReviewAdjustment(adj.id, "approve")}
                              >
                                <Check className="size-3.5 mr-1" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => handleReviewAdjustment(adj.id, "reject")}
                              >
                                <X className="size-3.5 mr-1" /> Waive
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              {adj.reviewedBy ? `by ${adj.reviewedBy}` : "Reviewed"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export history</CardTitle>
            <CardDescription>
              {isOwner
                ? "All past payroll exports generated across your organisation."
                : "Past payroll exports generated for your site."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 overflow-x-auto min-w-0 max-w-full shadow-inner">
            {history.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileSpreadsheet />
                  </EmptyMedia>
                  <EmptyTitle>No exports yet</EmptyTitle>
                  <EmptyDescription>Generate your first payroll export above once the week is approved.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Export ID</TableHead>
                    <TableHead>Pay period</TableHead>
                    <TableHead>Sites</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Payable hours</TableHead>
                    <TableHead>Generated</TableHead>
                    <TableHead className="text-right">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell className="font-medium">{exp.id}</TableCell>
                      <TableCell className="text-muted-foreground">{exp.payPeriodLabel}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {exp.siteIds
                          .map((id) => state.sites.find((s) => s.id === id)?.name ?? id)
                          .join(", ")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{exp.employeeCount}</TableCell>
                      <TableCell className="text-muted-foreground">{exp.totalPayableHours.toFixed(1)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(exp.generatedAt)} · {exp.generatedBy}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleDownload(exp.csvData, exp.id)}>
                          <Download data-icon="inline-start" />
                          CSV
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  )
}

function ExportStatusBadge({ status }: { status: "open" | "under_review" | "approved" | "exported" }) {
  const map: Record<typeof status, { label: string; variant: "secondary" | "default" | "outline" | "destructive"; icon: React.ReactNode }> = {
    open: { label: "Not started", variant: "secondary", icon: <AlertCircle data-icon="inline-start" /> },
    under_review: { label: "Under review / Pending owner", variant: "outline", icon: <AlertCircle data-icon="inline-start" /> },
    approved: { label: "Ready to export", variant: "default", icon: <CheckCircle2 data-icon="inline-start" /> },
    exported: { label: "Exported & Locked", variant: "secondary", icon: <Lock data-icon="inline-start" /> },
  }
  const info = map[status] || map.open
  return (
    <Badge variant={info.variant} className="font-normal">
      {info.icon}
      {info.label}
    </Badge>
  )
}

