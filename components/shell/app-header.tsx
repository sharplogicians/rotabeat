"use client"
import { apiUrl } from '@/lib/api';

import * as React from "react"
import { AlertTriangle, Bell, Briefcase, Building2, CheckCircle2, ChevronDown, Clock, Coffee, Hash, LogOut, MapPin, Search, Settings, User, UserCog } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAccessibleSites, useAppStore, useCurrentUser, useCurrentSite } from "@/lib/store"
import type { Role } from "@/lib/types"
import { formatWeekRange, addDays, CURRENT_WEEK_START } from "@/lib/date-utils"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { RotaBeatLogo, RotaBeatIcon } from "@/components/brand/rotabeat-logo"

const ROLE_LABELS: Record<Role, string> = {
  business_owner: "Business Owner",
  head_office: "Business Owner",
  manager: "Site Manager",
  kiosk: "Tablet Kiosk",
  employee: "Employee",
}

export function AppHeader({ breadcrumb }: { breadcrumb?: React.ReactNode }) {
  const router = useRouter()
  const { state, dispatch } = useAppStore()
  const user = useCurrentUser()
  const currentSite = useCurrentSite()
  const sites = useAccessibleSites().filter((s) => s.status === "active")
  const pathname = usePathname()
  const isClockPage = pathname === "/attendance/clock" || pathname.startsWith("/attendance/clock")
  const isOwner = state.role === "business_owner" || state.role === "head_office"
  const isEmpRole = state.role === "employee"
  const isFixedLocation = isClockPage || state.role === "manager" || state.role === "employee" || sites.length <= 1
  const exceptions = isEmpRole
    ? []
    : state.attendance.filter(
        (a) => a.status === "exception" && (isOwner || a.siteId === state.currentSiteId)
      )

  // Fetch live notifications from DB on mount & interval
  React.useEffect(() => {
    async function syncNotifications() {
      try {
        const siteId = state.currentSiteId || ""
        const res = await fetch(apiUrl(`/api/notifications?siteId=${siteId}&role=${state.role}&userId=${user.id}`))
        if (res.ok) {
          const data = await res.json()
          if (data.success && Array.isArray(data.notifications)) {
            dispatch({ type: "SET_NOTIFICATIONS", notifications: data.notifications })
          }
        }
      } catch (err) {
        console.error("Failed to sync notifications from DB:", err)
      }
    }

    syncNotifications()
    const interval = setInterval(syncNotifications, 5000)
    return () => clearInterval(interval)
  }, [state.currentSiteId, state.role, user.id, dispatch])

  const relevantNotis = React.useMemo(() => {
    if (!state.notifications) return []
    if (isOwner) {
      // Business Owner receives notifications across all locations
      return state.notifications.filter(
        (n) =>
          n.recipientRole === "business_owner" ||
          n.recipientRole === "management" ||
          n.recipientRole === "manager" ||
          n.recipientRole === "all"
      )
    }
    if (isEmpRole) {
      // Employee receives only their own notifications
      return state.notifications.filter(
        (n) => n.recipientRole === "employee" && (n.recipientUserId === user.id || n.employeeId === user.id)
      )
    }
    // Site Manager role: strictly scoped to the manager's assigned site
    return state.notifications.filter(
      (n) =>
        n.siteId === state.currentSiteId &&
        (n.recipientRole === "manager" || n.recipientRole === "management" || n.recipientRole === "all")
    )
  }, [state.notifications, isOwner, isEmpRole, user.id, state.currentSiteId])

  const unreadCount = relevantNotis.filter((n) => !n.read).length + exceptions.length
  const hasWarningNotis = relevantNotis.some((n) => !n.read && n.isWarning) || exceptions.length > 0

  async function handleMarkAllRead() {
    dispatch({ type: "MARK_ALL_NOTIFICATIONS_READ" })
    try {
      await fetch(apiUrl("/api/notifications/read"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      })
    } catch { }
  }

  const [notiOpen, setNotiOpen] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase().trim()
    return state.employees
      .filter(
        (e) =>
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
          e.employeeNumber.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.jobTitle.toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [searchQuery, state.employees])

  async function handleMarkRead(notificationId: string) {
    dispatch({ type: "MARK_NOTIFICATION_READ", notificationId })
    try {
      await fetch(apiUrl("/api/notifications/read"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      })
    } catch { }
  }

  const handleNotificationClick = (noti: {
    id: string
    siteId?: string
    siteName?: string
    weekStart?: string
  }) => {
    handleMarkRead(noti.id)
    setNotiOpen(false)

    if (noti.siteId && noti.siteId !== state.currentSiteId) {
      dispatch({ type: "SET_SITE", siteId: noti.siteId })
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("rotabeat_current_site_id", noti.siteId)
          document.cookie = `rotabeat_last_site=${encodeURIComponent(noti.siteId)}; Path=/; Max-Age=31536000; SameSite=Lax`
        } catch { }
      }
      const targetSite = state.sites.find((s) => s.id === noti.siteId)
      const siteDisplayName = targetSite?.name || noti.siteName || "Location"
      const isInactive = targetSite?.status === "inactive"
      toast.info(`Switched location to ${siteDisplayName}${isInactive ? " (Inactive)" : ""}`)
    }

    if (noti.weekStart && noti.weekStart !== state.currentWeekStart) {
      dispatch({ type: "SET_WEEK", weekStart: noti.weekStart })
    }
  }


  return (
    <header className="flex h-16 shrink-0 items-center gap-2 sm:gap-3 border-b border-border bg-card px-3 sm:px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Link href={isEmpRole ? "/attendance/clock" : "/dashboard"} className="flex md:hidden items-center shrink-0">
          <RotaBeatIcon size={22} />
        </Link>
      </div>
      <Separator orientation="vertical" className="h-6 hidden sm:block" />
      <div className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs sm:text-sm">{breadcrumb}</div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {isFixedLocation ? (
          <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-2.5 py-1.5 text-xs font-semibold text-foreground max-w-[200px] sm:max-w-none">
            <Building2 className="size-3.5 shrink-0 text-primary" />
            <span className="truncate">{currentSite ? `${currentSite.name}` : "Location"}</span>
            {currentSite?.status === "inactive" && (
              <span className="shrink-0 rounded bg-amber-500/15 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Inactive
              </span>
            )}
          </div>
        ) : (
          <Select
            items={
              currentSite?.status === "inactive"
                ? [{ value: currentSite.id, label: `${currentSite.name} (Inactive)` }, ...sites.map((s) => ({ value: s.id, label: `${s.name} — ${s.town}` }))]
                : sites.map((s) => ({ value: s.id, label: `${s.name} — ${s.town}` }))
            }
            value={currentSite ? state.currentSiteId : (sites[0]?.id ?? "")}
            onValueChange={(v) => {
              if (v) {
                dispatch({ type: "SET_SITE", siteId: v })
                if (typeof window !== "undefined") {
                  try {
                    localStorage.setItem("rotabeat_current_site_id", v)
                    document.cookie = `rotabeat_last_site=${encodeURIComponent(v)}; Path=/; Max-Age=31536000; SameSite=Lax`
                  } catch { }
                }
              }
            }}
          >
            <SelectTrigger className="w-44 sm:w-48 md:w-52 text-xs h-8 font-medium justify-between gap-1.5 px-2.5" size="sm">
              <SelectValue placeholder="Location">
                {currentSite?.status === "inactive" ? (
                  <span className="flex items-center gap-1 truncate">
                    <span className="truncate">{currentSite.name}</span>
                    <span className="shrink-0 rounded bg-amber-500/15 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      Inactive
                    </span>
                  </span>
                ) : currentSite ? (
                  `${currentSite.name} — ${currentSite.town}`
                ) : (
                  sites[0] ? `${sites[0].name} — ${sites[0].town}` : "Location"
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} align="end" className="w-[260px] sm:w-[270px] max-h-[380px] p-1.5 shadow-lg">
              <SelectGroup>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="py-2 pl-2.5 pr-8 text-xs cursor-pointer">
                    <span className="font-medium text-foreground">{s.name}</span>
                    <span className="text-muted-foreground ml-1.5">— {s.town}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}

        <Popover>
          <PopoverTrigger render={<Button variant="outline" size="sm" className="justify-between font-normal text-xs px-2 sm:px-3 h-8" />}>
            <span className="hidden sm:inline">{formatWeekRange(state.currentWeekStart)}</span>
            <span className="sm:hidden font-medium">Week</span>
            <ChevronDown data-icon="inline-end" className="size-3.5 ml-1" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 sm:w-80 p-2">
            <WeekPicker />
          </PopoverContent>
        </Popover>
      </div>

      <Popover open={searchOpen} onOpenChange={(open) => { setSearchOpen(open); if (!open) setSearchQuery("") }}>
        <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative" />}>
          <Search />
          <span className="sr-only">Search employees</span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 sm:w-96 p-0">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, employee number, email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm bg-muted/30"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {searchQuery.trim() === "" ? (
              <div className="px-4 py-6 text-center">
                <User className="size-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">
                  Type a name, employee number or email to search.
                </p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <Search className="size-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">No employees found</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  No results for &ldquo;{searchQuery}&rdquo;
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {searchResults.map((emp) => {
                  const empSite = state.sites.find((s) => s.id === emp.primarySiteId)
                  return (
                    <Link
                      key={emp.id}
                      href={`/employees/${emp.id}`}
                      onClick={() => {
                        setSearchOpen(false)
                        setSearchQuery("")
                        if (emp.primarySiteId && emp.primarySiteId !== state.currentSiteId) {
                          dispatch({ type: "SET_SITE", siteId: emp.primarySiteId })
                          toast.info(`Switched location to ${empSite?.name || "Location"}`)
                        }
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 text-xs hover:bg-muted/70 transition-colors cursor-pointer"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                        {emp.firstName[0]}{emp.lastName[0]}
                      </div>
                      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm text-foreground truncate">
                            {emp.firstName} {emp.lastName}
                          </span>
                          <Badge
                            variant={emp.status === "active" ? "default" : "secondary"}
                            className={`text-[9px] px-1.5 py-0 h-4 ${
                              emp.status === "active" ? "bg-emerald-600" : ""
                            }`}
                          >
                            {emp.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2.5 text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Hash className="size-3" />
                            {emp.employeeNumber}
                          </span>
                          <span className="inline-flex items-center gap-1 truncate">
                            <Briefcase className="size-3 shrink-0" />
                            {emp.jobTitle}
                          </span>
                        </div>
                        {empSite && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <MapPin className="size-3 shrink-0" />
                            {empSite.name}
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={notiOpen} onOpenChange={setNotiOpen}>
        <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative" />}>
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <Badge
              variant={hasWarningNotis ? "destructive" : "default"}
              className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1 text-[11px] font-bold shadow-xs animate-in zoom-in"
            >
              {unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 sm:w-96 max-h-[500px] overflow-y-auto p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            {relevantNotis.length > 0 && (
              <button
                type="button"
                className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                onClick={handleMarkAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="divide-y divide-border">
            {relevantNotis.map((n) => {
              const formattedTime = new Date(n.timestamp).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })

              const notiType = (n as any).type
              const isCritical = notiType === "weekly_approval_overdue" || Boolean((n.meta as any)?.isOverdue)
              
              const isApprovalNoti =
                notiType === "timesheet_approved" ||
                notiType === "weekly_approval_due" ||
                notiType === "weekly_approval_overdue" ||
                n.title?.toLowerCase().includes("approval") ||
                n.title?.toLowerCase().includes("timesheet")

              const weekStartFromMeta = (n.meta as any)?.weekStart
              const weekStartFromMsg = n.message?.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1]
              const notiWeekStart = weekStartFromMeta || weekStartFromMsg

              let linkUrl: string = (n.meta as any)?.link || ""
              let actionLabel: string = (n.meta as any)?.actionText || ""

              if (isApprovalNoti) {
                linkUrl = "/approval"
                actionLabel =
                  actionLabel && actionLabel !== "View Attendance" && actionLabel !== "Review Attendance"
                    ? actionLabel
                    : notiType === "timesheet_approved" || n.title?.toLowerCase().includes("ready")
                    ? "Review Approval"
                    : "Review Week"
              } else if (!linkUrl) {
                if (notiType === "shift_conflict") {
                  linkUrl = "/rota"
                  actionLabel = actionLabel || "View Schedule"
                } else {
                  linkUrl = "/attendance"
                  actionLabel = actionLabel || (notiType === "missing_punch" ? "Review Attendance" : "View Attendance")
                }
              } else if (!actionLabel) {
                actionLabel = "View Details"
              }

              // Employees have access only to their portal (/attendance/clock) and cannot access /attendance, /approval, or /rota
              if (isEmpRole) {
                linkUrl = ""
                actionLabel = ""
              }

              const notiSite = state.sites.find((s) => s.id === n.siteId)
              const notiSiteName = notiSite?.name || n.siteName || ""
              const isDifferentSite = Boolean(n.siteId && n.siteId !== state.currentSiteId)

              const cardContent = (
                <div
                  className={`flex items-start gap-3 p-3 text-xs transition-colors hover:bg-muted/70 cursor-pointer ${
                    !n.read ? "bg-primary/5" : ""
                  }`}
                  onClick={() =>
                    handleNotificationClick({
                      id: n.id,
                      siteId: n.siteId,
                      siteName: notiSiteName,
                      weekStart: notiWeekStart,
                    })
                  }
                >
                  <div
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${
                      isCritical
                        ? "bg-destructive/10 text-destructive dark:bg-destructive/20"
                        : n.isWarning
                        ? "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                        : isApprovalNoti
                        ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                        : n.type === "clock_in" || n.type === "clock_out"
                        ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                        : "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
                    }`}
                  >
                    {isCritical || n.isWarning ? (
                      <AlertTriangle className="size-4" />
                    ) : isApprovalNoti ? (
                      <CheckCircle2 className="size-4" />
                    ) : n.type === "break_start" || n.type === "break_end" ? (
                      <Coffee className="size-4" />
                    ) : (
                      <Clock className="size-4" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-foreground truncate">{n.title}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formattedTime}</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed text-[11px]">{n.message}</p>

                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      {!isEmpRole && actionLabel && (
                        <span className="inline-flex items-center gap-1 rounded bg-primary/10 hover:bg-primary/20 text-primary px-2 py-0.5 text-[11px] font-semibold w-fit transition-colors">
                          {actionLabel} →
                        </span>
                      )}
                      {notiSiteName && (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ml-auto ${
                            isDifferentSite
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Building2 className="size-3" />
                          {notiSiteName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )

              return linkUrl ? (
                <Link key={n.id} href={linkUrl} className="block no-underline">
                  {cardContent}
                </Link>
              ) : (
                <div key={n.id}>{cardContent}</div>
              )
            })}

            {!isEmpRole && exceptions.map((e) => {
              const emp = state.employees.find((x) => x.id === e.employeeId)
              const exSite = sites.find((s) => s.id === e.siteId)
              const exSiteName = exSite?.name || "Location"
              const isDifferentSite = Boolean(e.siteId && e.siteId !== state.currentSiteId)

              return (
                <Link
                  key={e.id}
                  href="/attendance"
                  onClick={() => {
                    setNotiOpen(false)
                    if (e.siteId && e.siteId !== state.currentSiteId) {
                      dispatch({ type: "SET_SITE", siteId: e.siteId })
                      toast.info(`Switched location to ${exSiteName}`)
                    }
                  }}
                  className="flex items-start gap-3 p-3 text-xs hover:bg-muted/70 cursor-pointer transition-colors"
                >
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <AlertTriangle className="size-4" />
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-foreground">
                        {emp ? `${emp.firstName} ${emp.lastName}` : "Employee"}
                      </span>
                      {exSite && (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            isDifferentSite
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Building2 className="size-3" />
                          {exSite.name}
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground text-[11px]">
                      {e.exceptions.map((x) => x.replaceAll("_", " ")).join(", ")}
                    </span>
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-destructive">
                      Resolve Exception →
                    </span>
                  </div>
                </Link>
              )
            })}

            {relevantNotis.length === 0 && exceptions.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="size-6 mx-auto mb-2 text-emerald-500 opacity-80" />
                No unread notifications or exceptions. All clear!
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <div className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 py-1.5 text-xs font-medium text-foreground">
        <UserCog className="size-3.5 text-muted-foreground" />
        <span>{ROLE_LABELS[state.role] || "Business Owner"}</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 px-1.5" />}>
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary text-xs text-primary-foreground">
              {user.avatarInitials}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{user.name}</span>
              <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {!isEmpRole && (
              <DropdownMenuItem render={<Link href="/settings" />}>
                <Settings data-icon="inline-start" />
                Settings
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={async () => {
                const currentSiteId = state.currentSiteId
                try {
                  await fetch(apiUrl("/api/auth/logout"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ siteId: currentSiteId }),
                  })
                } catch { }
                if (typeof window !== "undefined") {
                  sessionStorage.clear()
                  // Preserve currentSiteId so owner returns to the exact same location on next login
                  if (currentSiteId) {
                    try {
                      localStorage.setItem("rotabeat_current_site_id", currentSiteId)
                      document.cookie = `rotabeat_last_site=${encodeURIComponent(currentSiteId)}; Path=/; Max-Age=31536000; SameSite=Lax`
                    } catch { }
                  }
                  window.location.href = apiUrl("/login")
                } else {
                  router.push("/login")
                }
              }}
            >
              <LogOut data-icon="inline-start" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}

function WeekPicker() {
  const { state, dispatch } = useAppStore()
  const selectedWeek = state.currentWeekStart || CURRENT_WEEK_START
  const realCurrentWeek = CURRENT_WEEK_START

  // Dynamically compute options centered on selected week (-2, -1, 0, +1, +2 weeks)
  const weekValues = [
    addDays(selectedWeek, -14),
    addDays(selectedWeek, -7),
    selectedWeek,
    addDays(selectedWeek, 7),
    addDays(selectedWeek, 14),
  ]

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between mb-1 px-1">
        <p className="text-xs font-semibold text-muted-foreground">Select Week</p>
        {selectedWeek !== realCurrentWeek && (
          <button
            type="button"
            className="text-[11px] font-medium text-emerald-600 hover:underline"
            onClick={() => dispatch({ type: "SET_WEEK", weekStart: realCurrentWeek })}
          >
            Today&apos;s Week
          </button>
        )}
      </div>
      {weekValues.map((w) => {
        const isSelected = w === selectedWeek
        const isToday = w === realCurrentWeek
        const rangeText = formatWeekRange(w)

        return (
          <Button
            key={w}
            variant={isSelected ? "secondary" : "ghost"}
            size="sm"
            className={`justify-between w-full text-xs font-normal h-8 px-2 ${isSelected ? "font-semibold text-primary" : ""}`}
            onClick={() => dispatch({ type: "SET_WEEK", weekStart: w })}
          >
            <span className="truncate">{rangeText}</span>
            {isToday && (
              <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                current week
              </span>
            )}
          </Button>
        )
      })}
    </div>
  )
}

