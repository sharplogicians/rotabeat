"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { History, ShieldCheck, ArrowRight, User, Calendar, FileText } from "lucide-react"
import type { AttendanceAudit } from "@/lib/types"
import { formatDateLong } from "@/lib/date-utils"

interface AuditHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeName: string
  date: string
  audits?: AttendanceAudit[]
}

export function AuditHistoryDialog({
  open,
  onOpenChange,
  employeeName,
  date,
  audits = [],
}: AuditHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <History className="w-5 h-5 text-emerald-600" />
            <DialogTitle className="text-xl font-bold">Attendance Audit History</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {employeeName} — {formatDateLong(date)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground border">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            This audit trail is <strong>immutable</strong>. Every manual edit or creation is permanently recorded with user, timestamp, and mandatory reason.
          </span>
        </div>

        {audits.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No manual corrections recorded for this record.
          </div>
        ) : (
          <div className="relative pl-6 border-l-2 border-primary/20 flex flex-col gap-6 my-2">
            {audits.map((item) => (
              <div key={item.id} className="relative flex flex-col gap-2">
                {/* Timeline dot */}
                <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-emerald-600 border-2 border-background" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{item.changedBy}</span>
                    <Badge variant="outline" className="text-[10px] ml-1 uppercase">
                      {item.action}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(item.changedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                </div>

                {/* Changes diff table */}
                {item.changes && item.changes.length > 0 && (
                  <div className="bg-card border rounded-md p-2.5 text-xs flex flex-col gap-1.5 shadow-sm">
                    {item.changes.map((c, idx) => (
                      <div key={idx} className="flex items-center justify-between font-mono text-[11px]">
                        <span className="font-semibold font-sans text-muted-foreground">{c.field}:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-red-500 line-through">{c.previousValue}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="text-emerald-600 font-semibold">{c.newValue}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reason box */}
                <div className="flex items-start gap-1.5 text-xs bg-amber-500/10 text-amber-900 dark:text-amber-200 border border-amber-500/20 p-2.5 rounded-md">
                  <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-amber-700 dark:text-amber-300">Reason: </span>
                    <span>{item.reason}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
