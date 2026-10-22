"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, Calendar, Clock, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export interface AttentionItem {
  id: string
  type: "missing_punch" | "shift_conflict" | "weekly_approval_due" | "weekly_approval_overdue"
  title: string
  message: string
  isWarning: boolean
  link: string
  actionText: string
  timestamp: string
}

export function AttentionRequiredWidget({ notifications }: { notifications: AttentionItem[] }) {
  const missingPunchCount = notifications.filter((n) => n.type === "missing_punch").length
  const shiftConflictCount = notifications.filter((n) => n.type === "shift_conflict").length
  const approvalPendingCount = notifications.filter((n) => n.type === "weekly_approval_due" || n.type === "weekly_approval_overdue").length

  const activeWarnings = notifications.filter((n) => n.isWarning || n.type === "weekly_approval_overdue")

  if (activeWarnings.length === 0) {
    return null
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 shadow-xs">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            ATTENTION REQUIRED
          </CardTitle>
          <CardDescription className="text-xs text-amber-800/80 dark:text-amber-200/80">
            Issues requiring manager review &amp; resolution
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {missingPunchCount > 0 && (
            <Badge variant="outline" className="border-amber-500/40 text-amber-800 dark:text-amber-200 bg-amber-500/10">
              ⚠️ {missingPunchCount} Missing Punch{missingPunchCount > 1 ? "es" : ""}
            </Badge>
          )}
          {shiftConflictCount > 0 && (
            <Badge variant="outline" className="border-amber-500/40 text-amber-800 dark:text-amber-200 bg-amber-500/10">
              ⚡ {shiftConflictCount} Shift Conflict{shiftConflictCount > 1 ? "s" : ""}
            </Badge>
          )}
          {approvalPendingCount > 0 && (
            <Badge variant="destructive" className="font-semibold">
              🚨 {approvalPendingCount} Weekly Approval Pending
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-2.5">
          {activeWarnings.slice(0, 5).map((item) => {
            const isCritical = item.type === "weekly_approval_overdue"
            return (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-card/80 text-xs shadow-2xs"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${
                      isCritical
                        ? "bg-destructive/15 text-destructive"
                        : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {isCritical ? <AlertCircle className="size-4" /> : <AlertTriangle className="size-4" />}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-foreground">{item.title}</span>
                    <span className="text-muted-foreground text-[11px] leading-relaxed">{item.message}</span>
                  </div>
                </div>

                <Button size="sm" variant="secondary" className="h-7 text-xs font-semibold shrink-0" render={<Link href={item.link} />}>
                  {item.actionText || "Review"}
                  <ArrowRight className="size-3 ml-1" />
                </Button>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
