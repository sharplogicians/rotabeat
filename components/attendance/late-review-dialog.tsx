"use client"

import * as React from "react"
import { apiUrl } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  ShieldAlert,
} from "lucide-react"
import { toast } from "sonner"

export interface LateReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: {
    id: string
    employeeId: string
    employeeName: string
    date: string
    scheduledStartTime?: string | null
    scheduledEndTime?: string | null
    actualClockInTime?: string | null
    lateMinutes?: number
    hourlyRate?: number
    siteId?: string
    siteName?: string
  } | null
  onSuccess?: () => void
}

export function LateReviewDialog({
  open,
  onOpenChange,
  record,
  onSuccess,
}: LateReviewDialogProps) {
  const [selectedAction, setSelectedAction] = React.useState<
    "record_late" | "issue_warning" | "approve_exception"
  >("record_late")
  const [comment, setComment] = React.useState("")
  const [includeDeduction, setIncludeDeduction] = React.useState(true)
  const [loading, setLoading] = React.useState(false)

  if (!record) return null

  const lateMins = record.lateMinutes || 0
  const rate = record.hourlyRate || 10
  const deduction = Number(((lateMins / 60) * rate).toFixed(2))

  async function handleSubmit() {
    if (!record) return
    if (selectedAction === "issue_warning" && !comment.trim()) {
      toast.error("Please enter a warning reason / comment for the employee.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch(apiUrl("/api/attendance/late-review"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: selectedAction,
          employeeId: record.employeeId,
          attendanceRecordId: record.id,
          date: record.date,
          lateMinutes: lateMins,
          hourlyRate: rate,
          siteId: record.siteId,
          siteName: record.siteName,
          comment: comment.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to process decision.")
      }

      toast.success(data.message || "Decision processed successfully.")
      onOpenChange(false)
      onSuccess?.()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to submit review.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <AlertTriangle className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-semibold">
                Late Arrival Review
              </DialogTitle>
              <DialogDescription className="text-xs">
                Review late arrival and configure proposed payroll impact.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Shift & Lateness Summary */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Employee:</span>
            <span className="font-semibold">{record.employeeName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Shift Date:</span>
            <span>{record.date}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Scheduled Start:</span>
            <span>{record.scheduledStartTime || "N/A"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Actual Clock-In:</span>
            <span className="font-medium text-amber-600 dark:text-amber-400">
              {record.actualClockInTime || "Late"}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t">
            <span className="font-medium">Total Late Duration:</span>
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              <Clock className="size-3 mr-1" />
              {lateMins} minutes
            </Badge>
          </div>
        </div>

        {/* Proposed Payroll Deduction Preview (Dynamic based on selected action) */}
        {lateMins > 0 && (
          <div className="rounded-lg border border-amber-200/70 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5 text-foreground">
                <DollarSign className="size-3.5" /> Proposed Payroll Deduction:
              </span>
              {selectedAction === "record_late" ? (
                <span className="text-sm font-bold text-destructive">
                  -£{deduction.toFixed(2)}
                </span>
              ) : selectedAction === "issue_warning" ? (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  £0.00 (Warning Only — No Deduction)
                </span>
              ) : (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  £0.00 (Excused — No Deduction)
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {selectedAction === "record_late"
                ? `Calculated as (${lateMins} mins / 60) × £${rate.toFixed(2)}/hr. Unpaid late time will be deducted.`
                : selectedAction === "issue_warning"
                ? "Disciplinary warning is recorded in employee history without any salary deduction."
                : "Lateness is excused and no salary deduction will be made."}
            </p>
          </div>
        )}

        {/* Review Action Radios */}
        <div className="space-y-2 pt-1">
          <label className="text-xs font-semibold">Choose Manager Action:</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setSelectedAction("record_late")}
              className={`p-2.5 rounded-lg border text-left transition-colors flex flex-col gap-1 ${
                selectedAction === "record_late"
                  ? "border-primary bg-primary/5 font-semibold text-primary"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                <span>Record Late</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-normal">
                Deduct salary for late time &amp; notify staff
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedAction("issue_warning")}
              className={`p-2.5 rounded-lg border text-left transition-colors flex flex-col gap-1 ${
                selectedAction === "issue_warning"
                  ? "border-destructive bg-destructive/5 font-semibold text-destructive"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="size-3.5" />
                <span>Issue Warning</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-normal">
                Save warning (NO deduction) &amp; notify
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedAction("approve_exception")}
              className={`p-2.5 rounded-lg border text-left transition-colors flex flex-col gap-1 ${
                selectedAction === "approve_exception"
                  ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 font-semibold text-emerald-700 dark:text-emerald-300"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" />
                <span>Approve Exception</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-normal">
                Excuse lateness, NO deduction &amp; notify
              </span>
            </button>
          </div>
        </div>

        {/* Comment field */}
        <div className="space-y-1 pt-1">
          <label className="text-xs font-medium">
            {selectedAction === "issue_warning"
              ? "Warning Reason / Disciplinary Note *"
              : "Manager Note / Reason (Optional)"}
          </label>
          <Textarea
            placeholder={
              selectedAction === "issue_warning"
                ? "e.g. Third consecutive late arrival this month. Advised to arrive on time."
                : selectedAction === "approve_exception"
                ? "e.g. Train delay verified on public transport board."
                : "e.g. Late arrival noted and pro-rata deduction confirmed."
            }
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="text-xs min-h-[65px]"
          />
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={loading}
            className={
              selectedAction === "issue_warning"
                ? "bg-destructive hover:bg-destructive/90 text-white"
                : selectedAction === "approve_exception"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            }
          >
            {loading
              ? "Submitting…"
              : selectedAction === "issue_warning"
              ? "Issue Warning (No Deduction)"
              : selectedAction === "approve_exception"
              ? "Approve Exception (No Deduction)"
              : `Confirm Late (-£${deduction.toFixed(2)})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
