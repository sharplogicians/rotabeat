"use client"
import { apiUrl } from '@/lib/api';

import * as React from "react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Clock,
  Coffee,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  LogIn,
  UserCheck,
  Building2,
  Calendar,
  DollarSign,
  CalendarRange,
  Lock,
} from "lucide-react"
import {
  deriveCurrentAttendanceStatus,
  getAttendanceStateLabel,
  validateAttendanceAction,
  type EmployeeAttendanceState,
  type AttendanceActionType,
  type ClockEventLike,
} from "@/lib/attendance"
import { computeWorkedTotals } from "@/lib/calc"
import { formatDayMonth, weekDays, formatWeekRange, TODAY_ISO } from "@/lib/date-utils"
import { useAppStore } from "@/lib/store"

interface EmployeeAttendanceCardProps {
  employee: {
    id: string
    name: string
    employeeNumber?: string
    jobTitle?: string
    siteId?: string
    siteName?: string
    hourlyRate?: number
    payType?: string
  }
  todayShift?: {
    id?: string
    date?: string
    startTime?: string
    endTime?: string
    unpaidBreakMinutes?: number
    role?: string
  } | null
  upcomingShift?: {
    id?: string
    date?: string
    startTime?: string
    endTime?: string
    unpaidBreakMinutes?: number
    role?: string
  } | null
  initialEvents?: ClockEventLike[]
  onActionComplete?: (result: any) => void
}

export function EmployeeAttendanceCard({
  employee,
  todayShift,
  upcomingShift,
  initialEvents = [],
  onActionComplete,
}: EmployeeAttendanceCardProps) {
  const { state, dispatch } = useAppStore()
  const [events, setEvents] = React.useState<ClockEventLike[]>(initialEvents)
  const [loading, setLoading] = React.useState<boolean>(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  // Confirmation state
  const [confirmationData, setConfirmationData] = React.useState<{
    title: string
    employeeName: string
    actionLabel: string
    formattedTime: string
    date: string
    statusLabel: string
  } | null>(null)

  React.useEffect(() => {
    setEvents(initialEvents)
  }, [initialEvents])

  const currentStatus: EmployeeAttendanceState = React.useMemo(() => {
    return deriveCurrentAttendanceStatus(events)
  }, [events])

  const workedTotals = React.useMemo(() => {
    return computeWorkedTotals(
      events.map((e, idx) => ({
        id: `evt-${idx}`,
        type: e.type as any,
        timestamp: e.timestamp,
        source: "web",
      }))
    )
  }, [events])

  const workedHoursStr = (workedTotals.payableMinutes / 60).toFixed(2)
  const breakMinutes = workedTotals.breakMinutes
  const estimatedPay = employee.hourlyRate ? (Number(workedHoursStr) * employee.hourlyRate).toFixed(2) : null

  // 7 Days of current week for weekly grid view
  const currentWeekDays = React.useMemo(() => {
    return weekDays(state.currentWeekStart)
  }, [state.currentWeekStart])

  async function handleAttendanceAction(action: AttendanceActionType) {
    const val = validateAttendanceAction(currentStatus, action)
    if (!val.valid) {
      setErrorMsg(val.error || "Action not allowed.")
      return
    }

    setLoading(true)
    setErrorMsg(null)

    try {
      const res = await fetch(apiUrl("/api/attendance/action"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.id,
          action,
          siteId: employee.siteId,
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        setErrorMsg(json.message || "Failed to submit attendance action.")
        setLoading(false)
        return
      }

      const data = json.data

      const newEvent: ClockEventLike = {
        type: data.action,
        timestamp: data.timestamp,
      }

      setEvents((prev) => [...prev, newEvent])

      dispatch({
        type: "KIOSK_CLOCK_EVENT",
        employeeId: employee.id,
        siteId: employee.siteId || "site-bright",
        eventType: action === "clock_in" ? "clock_in" : action === "break_start" ? "break_start" : action === "break_end" ? "break_end" : "clock_out",
      })

      if (Array.isArray(json.notifications)) {
        json.notifications.forEach((noti: any) => {
          dispatch({ type: "ADD_NOTIFICATION", notification: noti })
          if (noti.isWarning) {
            toast.warning(noti.title, { description: noti.message })
          } else {
            toast.success(noti.title, { description: noti.message })
          }
        })
      }

      setConfirmationData({
        title: json.message || "Action Successful",
        employeeName: data.employeeName || employee.name,
        actionLabel: data.actionLabel,
        formattedTime: data.formattedTime,
        date: data.date,
        statusLabel: data.statusLabel,
      })

      if (onActionComplete) {
        onActionComplete(data)
      }
    } catch {
      setErrorMsg("Unable to connect to the server. Your attendance action was not recorded. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const renderStatusBadge = () => {
    switch (currentStatus) {
      case "not_clocked_in":
        return (
          <Badge variant="outline" className="px-3 py-1 text-xs font-medium bg-secondary text-secondary-foreground border-muted">
            <Clock className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
            Not Clocked In
          </Badge>
        )
      case "working":
        return (
          <Badge variant="default" className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-600 text-white dark:bg-emerald-700">
            <span className="relative flex h-2 w-2 mr-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            Working
          </Badge>
        )
      case "on_break":
        return (
          <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold bg-amber-500 hover:bg-amber-500 text-white dark:bg-amber-600">
            <Coffee className="w-3.5 h-3.5 mr-1 text-white animate-bounce" />
            On Break
          </Badge>
        )
      case "clocked_out":
        return (
          <Badge variant="outline" className="px-3 py-1 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-purple-600 dark:text-purple-400" />
            Clocked Out
          </Badge>
        )
    }
  }

  return (
    <>
      <Card className="w-full max-w-xl mx-auto shadow-lg border-muted/80 backdrop-blur-sm bg-card/95">
        <CardHeader className="text-center pb-3">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2 ring-4 ring-primary/5">
            <UserCheck className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold font-heading tracking-tight">{employee.name}</CardTitle>
          <CardDescription className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-0.5">
            {employee.jobTitle && <span className="font-medium text-foreground">{employee.jobTitle}</span>}
            {employee.employeeNumber && <span>• ID: {employee.employeeNumber}</span>}
          </CardDescription>

          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2 flex-wrap">
            {employee.siteName && (
              <div className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span>{employee.siteName}</span>
              </div>
            )}
            {employee.hourlyRate ? (
              <div className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <DollarSign className="w-3.5 h-3.5" />
                <span>£{employee.hourlyRate.toFixed(2)} / hr</span>
              </div>
            ) : null}
          </div>

          <div className="pt-3 flex justify-center">{renderStatusBadge()}</div>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {/* Weekly Rota Schedule Grid (All 7 Days Together) */}
          <div className="rounded-lg border border-border bg-muted/40 p-3.5 space-y-2.5 text-xs">
            <div className="flex items-center justify-between font-semibold border-b border-border/60 pb-2">
              <span className="flex items-center gap-1.5 text-foreground">
                <CalendarRange className="w-4 h-4 text-primary" />
                Weekly Rota Schedule ({formatWeekRange(state.currentWeekStart)})
              </span>
              <Badge variant="outline" className="text-[10px]">
                Mon – Sun
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-2 pt-1">
              {currentWeekDays.map((dateIso) => {
                const isToday = dateIso === TODAY_ISO
                const shiftsForDay = state.shifts.filter(
                  (s) => (s.employeeId === employee.id || s.employeeId === state.currentUserId) && s.date === dateIso
                )

                return (
                  <div
                    key={dateIso}
                    className={`p-2.5 rounded-lg border text-xs transition-all ${isToday
                        ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-1 ring-emerald-500/40"
                        : "border-border/60 bg-background/80 opacity-85"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${isToday ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}`}>
                          {formatDayMonth(dateIso)}
                        </span>
                        {isToday ? (
                          <Badge variant="default" className="text-[10px] bg-emerald-600 hover:bg-emerald-600 px-1.5 py-0">
                            <Clock className="w-3 h-3 mr-1" /> Open Today
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground px-1.5 py-0 border-muted">
                            <Lock className="w-3 h-3 mr-1 text-muted-foreground" /> Locked
                          </Badge>
                        )}
                      </div>

                      {shiftsForDay.length > 0 ? (
                        <div className="text-right">
                          <span className="font-semibold text-foreground block">
                            {shiftsForDay.map((s) => `${s.startTime}–${s.endTime}`).join(", ")}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">Off</span>
                      )}
                    </div>

                    {shiftsForDay.length > 0 && (
                      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                        <span>Role: {shiftsForDay.map((s) => s.role).join(", ")}</span>
                        <span>Break: {shiftsForDay[0].unpaidBreakMinutes || 0} mins</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Live Worked & Pay Stats for Today */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-center">
              <div className="p-1.5 rounded bg-background">
                <span className="text-[10px] text-muted-foreground block">Today's Worked</span>
                <span className="font-mono font-bold text-foreground text-xs">{workedHoursStr} hrs</span>
              </div>
              <div className="p-1.5 rounded bg-background">
                <span className="text-[10px] text-muted-foreground block">Break Time</span>
                <span className="font-mono font-bold text-foreground text-xs">{breakMinutes} mins</span>
              </div>
              <div className="p-1.5 rounded bg-background">
                <span className="text-[10px] text-muted-foreground block">Est. Shift Pay</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                  {estimatedPay ? `£${estimatedPay}` : "—"}
                </span>
              </div>
            </div>
          </div>

          {errorMsg && (
            <Alert variant="destructive" className="py-2.5 text-xs">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Action Failed</AlertTitle>
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {/* Action Availability (Open strictly for Today's Date) */}
          <div className="flex flex-col gap-3 py-1">
            {currentStatus === "not_clocked_in" && (
              <Button
                size="lg"
                className="w-full h-14 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all duration-200"
                disabled={loading}
                onClick={() => handleAttendanceAction("clock_in")}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-5 w-5" />
                    Clock In for Today
                  </>
                )}
              </Button>
            )}

            {currentStatus === "working" && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 text-base font-semibold border-amber-300 dark:border-amber-700 bg-amber-50 hover:bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/60 shadow-sm transition-all"
                  disabled={loading}
                  onClick={() => handleAttendanceAction("break_start")}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Coffee className="mr-2 h-5 w-5 text-amber-600 dark:text-amber-400" />
                      Start Break
                    </>
                  )}
                </Button>

                <Button
                  size="lg"
                  variant="destructive"
                  className="h-14 text-base font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all"
                  disabled={loading}
                  onClick={() => handleAttendanceAction("clock_out")}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <LogOut className="mr-2 h-5 w-5" />
                      Clock Out
                    </>
                  )}
                </Button>
              </div>
            )}

            {currentStatus === "on_break" && (
              <div className="space-y-3">
                <Button
                  size="lg"
                  className="w-full h-14 text-base font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all"
                  disabled={loading}
                  onClick={() => handleAttendanceAction("break_end")}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Coffee className="mr-2 h-5 w-5" />
                      End Break
                    </>
                  )}
                </Button>

                <div className="p-2.5 rounded-md bg-muted/60 text-center">
                  <p className="text-xs text-muted-foreground font-medium">
                    Clock Out unavailable. Please end your break first.
                  </p>
                </div>
              </div>
            )}

            {currentStatus === "clocked_out" && (
              <div className="text-center py-4 px-3 rounded-lg bg-secondary/50 border border-border">
                <CheckCircle2 className="w-8 h-8 mx-auto text-purple-600 dark:text-purple-400 mb-2" />
                <h4 className="font-semibold text-sm">Session Completed</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  You have clocked out for today. Total payable hours: {workedHoursStr} hrs.
                </p>
              </div>
            )}
          </div>
        </CardContent>

        {events.length > 0 && (
          <CardFooter className="flex flex-col items-start border-t bg-muted/20 pt-3 pb-4">
            <span className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Today's Activity Log
            </span>
            <div className="w-full space-y-1.5 text-xs">
              {events.map((evt, idx) => {
                const timeStr = new Date(evt.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
                const label =
                  evt.type === "clock_in"
                    ? "Clock In"
                    : evt.type === "break_start"
                      ? "Start Break"
                      : evt.type === "break_end"
                        ? "End Break"
                        : "Clock Out"

                return (
                  <div key={idx} className="flex justify-between items-center text-muted-foreground">
                    <span className="font-medium text-foreground">{label}</span>
                    <span className="font-mono text-xs">{timeStr}</span>
                  </div>
                )
              })}
            </div>
          </CardFooter>
        )}
      </Card>

      {/* Confirmation Modal */}
      <Dialog open={Boolean(confirmationData)} onOpenChange={(open) => !open && setConfirmationData(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <DialogTitle className="text-xl font-bold text-center">{confirmationData?.title}</DialogTitle>
            <DialogDescription className="text-center text-sm pt-1">
              Your attendance event was successfully recorded.
            </DialogDescription>
          </DialogHeader>

          {confirmationData && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2.5 text-sm my-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Employee:</span>
                <span className="font-semibold text-foreground">{confirmationData.employeeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Action:</span>
                <span className="font-medium text-foreground">{confirmationData.actionLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium text-foreground">{confirmationData.statusLabel}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 mt-2">
                <span className="text-muted-foreground">Server Time:</span>
                <span className="font-mono font-bold text-primary">{confirmationData.formattedTime}</span>
              </div>
            </div>
          )}

          <div className="flex justify-center pt-2">
            <Button className="w-full sm:w-auto px-8" onClick={() => setConfirmationData(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
