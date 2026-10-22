"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EXCEPTION_LABELS, computeWorkedTotals, attendanceStatusLabel } from "@/lib/calc"
import type { AttendanceRecord, Employee, Shift } from "@/lib/types"
import { formatDateLong, formatTime12, formatTimestamp12 } from "@/lib/date-utils"
import { Clock, Calendar, MapPin, User, AlertTriangle, History, CheckCircle2 } from "lucide-react"

interface AttendanceDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: Employee | null
  siteName: string
  date: string
  shift?: Shift | null
  record?: AttendanceRecord | null
  onOpenHistory?: () => void
  onOpenCorrection?: () => void
}

export function AttendanceDetailsDialog({
  open,
  onOpenChange,
  employee,
  siteName,
  date,
  shift,
  record,
  onOpenHistory,
  onOpenCorrection,
}: AttendanceDetailsDialogProps) {
  if (!employee) return null

  const events = record?.events || []
  const totals = computeWorkedTotals(events)

  const grossHours = (totals.grossMinutes / 60).toFixed(2)
  const breakHours = (totals.breakMinutes / 60).toFixed(2)
  const workedHours = (totals.payableMinutes / 60).toFixed(2)

  const clockInTime = totals.clockInAt ? formatTimestamp12(totals.clockInAt) : "—"
  const clockOutTime = totals.clockOutAt ? formatTimestamp12(totals.clockOutAt) : "—"

  const breakStartEv = events.find((e) => e.type === "break_start")
  const breakEndEv = events.find((e) => e.type === "break_end")
  const breakStartTime = breakStartEv ? formatTimestamp12(breakStartEv.timestamp) : "—"
  const breakEndTime = breakEndEv ? formatTimestamp12(breakEndEv.timestamp) : "—"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5 flex-wrap pr-8">
            <DialogTitle className="text-xl font-bold font-heading">Attendance Record Details</DialogTitle>
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-medium rounded-full px-2.5 py-0.5",
                record?.status === "exception"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : record?.status === "corrected" || record?.status === "reviewed"
                    ? "border-muted-foreground/30 bg-muted/60 text-muted-foreground"
                    : record
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-border text-muted-foreground"
              )}
            >
              {record ? attendanceStatusLabel(record.status) : "Not Started"}
            </Badge>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Complete daily breakdown, schedule matching, and payable worked hours calculation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* Employee & Site info header */}
          <div className="grid grid-cols-2 gap-4 p-3.5 bg-muted/40 rounded-xl border border-border/60 text-xs">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <div className="font-semibold text-foreground">{employee.firstName} {employee.lastName}</div>
                <div className="text-muted-foreground">{employee.jobTitle}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <div className="font-semibold text-foreground">{siteName}</div>
                <div className="text-muted-foreground">{formatDateLong(date)}</div>
              </div>
            </div>
          </div>

          {/* Scheduled vs Actual */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="rounded-xl border border-border/70 shadow-2xs">
              <CardContent className="p-4 flex flex-col gap-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  Scheduled Shift
                </div>
                {shift ? (
                  <div className="flex flex-col gap-1 text-xs">
                    <div className="text-base font-bold text-foreground">
                      {formatTime12(shift.startTime)} – {formatTime12(shift.endTime)}
                    </div>
                    <div className="text-muted-foreground">Unpaid Break: {shift.unpaidBreakMinutes} mins</div>
                    <div className="text-muted-foreground">Role: {shift.role}</div>
                  </div>
                ) : (
                  <div className="text-sm font-medium text-amber-600 dark:text-amber-400 py-1">
                    Unplanned Attendance (No scheduled shift)
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-border/70 shadow-2xs">
              <CardContent className="p-4 flex flex-col gap-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-500" />
                  Actual Clocking
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Clock In:</span>
                    <span className="font-bold text-foreground text-sm">{clockInTime}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Clock Out:</span>
                    <span className="font-bold text-foreground text-sm">{clockOutTime}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Break Start:</span>
                    <span className="font-medium text-foreground">{breakStartTime}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Break End:</span>
                    <span className="font-medium text-foreground">{breakEndTime}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Worked Hours Summary */}
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-xs text-muted-foreground block">Gross Shift Time</span>
              <span className="text-base font-bold text-foreground">{grossHours} hrs</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Unpaid Break</span>
              <span className="text-base font-bold text-amber-600 dark:text-amber-400">{breakHours} hrs</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Payable Worked</span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{workedHours} hrs</span>
            </div>
          </div>

          {/* Exceptions Flag section */}
          {record && record.exceptions.length > 0 && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
                Detected Exceptions ({record.exceptions.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {record.exceptions.map((ex) => (
                  <Badge key={ex} variant="destructive" className="text-xs font-normal">
                    {EXCEPTION_LABELS[ex] || ex}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Correction Reason if present */}
          {record?.correctionReason && (
            <div className="p-3 bg-card border rounded-xl text-xs flex flex-col gap-1">
              <span className="font-semibold text-foreground">Last Manager Correction Reason:</span>
              <span className="text-muted-foreground italic">"{record.correctionReason}"</span>
              {record.correctedBy && (
                <span className="text-[11px] text-muted-foreground">
                  By {record.correctedBy} on {record.correctedAt ? new Date(record.correctedAt).toLocaleString() : "N/A"}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          {onOpenHistory && (
            <Button variant="outline" size="sm" onClick={onOpenHistory} className="gap-2 text-xs rounded-lg">
              <History className="w-3.5 h-3.5 text-emerald-600" />
              View Audit History
            </Button>
          )}
          {onOpenCorrection && (
            <Button size="sm" onClick={onOpenCorrection} className="gap-2 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Correct Attendance
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
