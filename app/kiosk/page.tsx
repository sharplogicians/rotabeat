"use client"

import * as React from "react"
import { apiUrl } from '@/lib/api'
import Link from "next/link"
import { Delete, Check, Coffee, LogIn, LogOut, ArrowLeft, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAppStore } from "@/lib/store"
import type { ClockEvent, ClockEventType, Employee } from "@/lib/types"
import { DEMO_NOW, TODAY_ISO, formatClock, formatDateLong, formatTime12 } from "@/lib/date-utils"
import { cn } from "@/lib/utils"

type KioskStatus = "not_started" | "clocked_in" | "on_break" | "clocked_out"

function getKioskStatus(events: ClockEvent[]): KioskStatus {
  if (events.length === 0) return "not_started"
  const last = events[events.length - 1]
  if (last.type === "clock_in" || last.type === "break_end") return "clocked_in"
  if (last.type === "break_start") return "on_break"
  return "clocked_out"
}

const STATUS_LABEL: Record<KioskStatus, string> = {
  not_started: "Not clocked in",
  clocked_in: "Clocked in",
  on_break: "On break",
  clocked_out: "Clocked out",
}

export default function KioskPage() {
  const { state, dispatch } = useAppStore()
  const site = state.sites.find((s) => s.id === state.kioskSiteId) ?? state.sites[0]

  const [pin, setPin] = React.useState("")
  const [error, setError] = React.useState(false)
  const [matchedEmployee, setMatchedEmployee] = React.useState<Employee | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [now, setNow] = React.useState(DEMO_NOW)

  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date(Date.now())), 1000)
    return () => clearInterval(id)
  }, [])

  function resetToPin() {
    setPin("")
    setError(false)
    setMatchedEmployee(null)
  }

  function handleDigit(d: string) {
    if (matchedEmployee || successMessage) return
    setError(false)
    const next = pin + d
    if (next.length > 4) return
    setPin(next)
    if (next.length === 4) {
      const employee = state.employees.find(
        (e) => e.status === "active" && e.primarySiteId === site.id && e.pinSet && e.pin === next,
      )
      if (employee) {
        setMatchedEmployee(employee)
      } else {
        setError(true)
        setTimeout(() => {
          setPin("")
          setError(false)
        }, 700)
      }
    }
  }

  function handleBackspace() {
    setPin((p) => p.slice(0, -1))
  }

  const todaysShift = matchedEmployee
    ? state.shifts.find((s) => s.employeeId === matchedEmployee.id && s.siteId === site.id && s.date === TODAY_ISO)
    : undefined

  const todaysAttendance = matchedEmployee
    ? state.attendance.find((a) => a.employeeId === matchedEmployee.id && a.date === TODAY_ISO)
    : undefined

  const kioskStatus = getKioskStatus(todaysAttendance?.events ?? [])

  function handleClockAction(eventType: ClockEventType, label: string) {
    if (!matchedEmployee) return
    dispatch({
      type: "KIOSK_CLOCK_EVENT",
      employeeId: matchedEmployee.id,
      siteId: site.id,
      shiftId: todaysShift?.id,
      eventType,
      scheduledStartTime: todaysShift?.startTime,
      scheduledEndTime: todaysShift?.endTime,
    })
    setSuccessMessage(label)
    setTimeout(() => {
      setSuccessMessage(null)
      resetToPin()
    }, 1800)
  }

  return (
    <div className="flex min-h-screen flex-col bg-primary text-primary-foreground">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary-foreground/10 font-heading text-sm font-bold">
            RB
          </div>
          <div className="flex flex-col">
            <span className="font-heading text-sm font-semibold leading-tight">RotaBeat Kiosk</span>
            <span className="text-xs text-primary-foreground/60 leading-tight">{site.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-mono text-lg font-semibold tabular-nums leading-tight">{formatClock(now)}</div>
            <div className="text-xs text-primary-foreground/60 leading-tight">{formatDateLong(TODAY_ISO)}</div>
          </div>
          <Select
            value={site.id}
            onValueChange={(v) => v && dispatch({ type: "SET_KIOSK_SITE", siteId: v })}
            items={state.sites.map((s) => ({ value: s.id, label: s.name }))}
          >
            <SelectTrigger
              size="sm"
              className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground [&_svg]:text-primary-foreground/70"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {state.sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 items-center justify-center px-6 pb-10">
        {successMessage ? (
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex size-24 items-center justify-center rounded-full bg-success">
              <Check className="size-12 text-success-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-heading text-2xl font-semibold">{successMessage}</p>
              <p className="text-primary-foreground/60">{matchedEmployee?.firstName}, have a great shift.</p>
            </div>
          </div>
        ) : matchedEmployee ? (
          <div className="flex w-full max-w-md flex-col items-center gap-6">
            <button
              onClick={resetToPin}
              className="flex items-center gap-1 self-start text-sm text-primary-foreground/60 transition-colors hover:text-primary-foreground"
            >
              <ChevronLeft className="size-4" />
              Not you?
            </button>
            <Avatar className="size-24 border-2 border-primary-foreground/20">
              <AvatarFallback className="bg-accent text-2xl font-heading font-semibold text-accent-foreground">
                {matchedEmployee.firstName[0]}
                {matchedEmployee.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="font-heading text-2xl font-semibold">
                {matchedEmployee.firstName} {matchedEmployee.lastName}
              </p>
              <p className="text-primary-foreground/60">{matchedEmployee.jobTitle}</p>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <Badge variant="secondary" className="bg-primary-foreground/10 text-primary-foreground">
                {STATUS_LABEL[kioskStatus]}
              </Badge>
              {todaysShift ? (
                <p className="text-sm text-primary-foreground/60">
                  Scheduled {formatTime12(todaysShift.startTime)}–{formatTime12(todaysShift.endTime)} · {todaysShift.role}
                </p>
              ) : (
                <p className="text-sm text-primary-foreground/60">No shift scheduled today</p>
              )}
            </div>

            <div className="flex w-full flex-col gap-3">
              {kioskStatus === "not_started" && (
                <Button
                  size="lg"
                  className="h-16 w-full rounded-2xl bg-accent text-lg font-semibold text-accent-foreground hover:bg-accent/90"
                  onClick={() => handleClockAction("clock_in", "Clocked in")}
                >
                  <LogIn data-icon="inline-start" />
                  Clock in
                </Button>
              )}
              {kioskStatus === "clocked_in" && (
                <>
                  <Button
                    size="lg"
                    className="h-16 w-full rounded-2xl bg-accent text-lg font-semibold text-accent-foreground hover:bg-accent/90"
                    onClick={() => handleClockAction("clock_out", "Clocked out")}
                  >
                    <LogOut data-icon="inline-start" />
                    Clock out
                  </Button>
                  {!todaysAttendance?.events.some((e) => e.type === "break_start" || e.type === "break_end") && (
                    <Button
                      size="lg"
                      variant="secondary"
                      className="h-14 w-full rounded-2xl bg-primary-foreground/10 text-base font-medium text-primary-foreground hover:bg-primary-foreground/15"
                      onClick={() => handleClockAction("break_start", "Break started")}
                    >
                      <Coffee data-icon="inline-start" />
                      Start break
                    </Button>
                  )}
                </>
              )}
              {kioskStatus === "on_break" && (
                <Button
                  size="lg"
                  className="h-16 w-full rounded-2xl bg-accent text-lg font-semibold text-accent-foreground hover:bg-accent/90"
                  onClick={() => handleClockAction("break_end", "Break ended")}
                >
                  <Coffee data-icon="inline-start" />
                  End break
                </Button>
              )}
              {kioskStatus === "clocked_out" && (
                <>
                  <p className="text-center text-sm text-primary-foreground/60">Shift complete for today.</p>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="h-14 w-full rounded-2xl bg-primary-foreground/10 text-base font-medium text-primary-foreground hover:bg-primary-foreground/15"
                    onClick={() => handleClockAction("clock_in", "Clocked in")}
                  >
                    <LogIn data-icon="inline-start" />
                    Clock in again
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex w-full max-w-xs flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="font-heading text-lg font-semibold">Enter your 4-digit PIN</p>
              <p className="text-sm text-primary-foreground/60">Use the kiosk PIN set on your profile</p>
            </div>

            <div className={cn("flex gap-3", error && "animate-[shake_0.4s]")}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full border-2 border-primary-foreground/30",
                    i < pin.length && (error ? "border-destructive bg-destructive" : "border-accent bg-accent"),
                  )}
                />
              ))}
            </div>
            {error && <p className="text-sm font-medium text-destructive">PIN not recognised. Try again.</p>}

            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button
                  key={d}
                  onClick={() => handleDigit(d)}
                  className="flex size-16 sm:size-20 items-center justify-center rounded-2xl bg-primary-foreground/10 font-heading text-xl sm:text-2xl font-semibold transition-colors hover:bg-primary-foreground/20 active:bg-primary-foreground/25"
                >
                  {d}
                </button>
              ))}
              <div />
              <button
                onClick={() => handleDigit("0")}
                className="flex size-16 sm:size-20 items-center justify-center rounded-2xl bg-primary-foreground/10 font-heading text-xl sm:text-2xl font-semibold transition-colors hover:bg-primary-foreground/20 active:bg-primary-foreground/25"
              >
                0
              </button>
              <button
                onClick={handleBackspace}
                aria-label="Backspace"
                className="flex size-16 sm:size-20 items-center justify-center rounded-2xl bg-primary-foreground/10 transition-colors hover:bg-primary-foreground/20 active:bg-primary-foreground/25"
              >
                <Delete className="size-5 sm:size-6" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center pb-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-xs text-primary-foreground/40 transition-colors hover:text-primary-foreground/70"
        >
          <ArrowLeft className="size-3" />
          Exit kiosk mode to admin
        </Link>
      </div>
    </div>
  )
}
