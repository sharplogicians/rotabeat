"use client"

import * as React from "react"
 import { apiUrl } from '@/lib/api';
import Link from "next/link"
import { AdminShell } from "@/components/shell/admin-shell"
import { EmployeeAttendanceCard } from "@/components/attendance/employee-attendance-card"
import { InactiveLocationBanner } from "@/components/dashboard/inactive-location-banner"
import { useAppStore, useCurrentSite } from "@/lib/store"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, UserCheck, RefreshCw, ShieldAlert } from "lucide-react"
import type { ClockEventLike } from "@/lib/attendance"
import { TODAY_ISO } from "@/lib/date-utils"

export default function EmployeeClockPage() {
  const { state, dispatch } = useAppStore()
  const isEmployeeRole = state.role === "employee"

  // Sync DB employees on mount
  React.useEffect(() => {
    async function loadDbEmployees() {
      try {
        const res = await fetch(apiUrl("/api/employees"))
        if (res.ok) {
          const data = await res.json()
          if (data.success && Array.isArray(data.employees) && data.employees.length > 0) {
            dispatch({ type: "SET_EMPLOYEES", employees: data.employees })
          }
        }
      } catch (err) {
        console.error("Failed to load employees from DB:", err)
      }
    }
    loadDbEmployees()
  }, [dispatch])

  const currentSite = useCurrentSite()

  const activeEmployees = React.useMemo(() => {
    if (!currentSite) return state.employees.filter((e) => e.status === "active")
    return state.employees.filter(
      (e) => e.status === "active" && e.primarySiteId === currentSite.id
    )
  }, [state.employees, currentSite])

  const currentUser = React.useMemo(() => {
    return state.users.find((u) => u.id === state.currentUserId)
  }, [state.users, state.currentUserId])

  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const empIdParam = params.get("employeeId")
      if (empIdParam && !isEmployeeRole) return empIdParam
    }
    if (state.currentUserId) {
      return state.currentUserId
    }
    return activeEmployees[0]?.id || ""
  })

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const empIdParam = params.get("employeeId")
      if (empIdParam && !isEmployeeRole) {
        const isValidInSite = activeEmployees.some((e) => e.id === empIdParam)
        if (isValidInSite) {
          setSelectedEmployeeId(empIdParam)
          return
        }
      }
    }
    if (state.currentUserId) {
      const isUserInSite = activeEmployees.some((e) => e.id === state.currentUserId)
      if (isUserInSite) {
        setSelectedEmployeeId(state.currentUserId)
        return
      }
    }
    if (activeEmployees.length > 0) {
      setSelectedEmployeeId(activeEmployees[0].id)
    }
  }, [state.currentUserId, isEmployeeRole, activeEmployees])

  const [events, setEvents] = React.useState<ClockEventLike[]>([])
  const [fetchingStatus, setFetchingStatus] = React.useState<boolean>(false)

  // States returned directly from API /api/attendance/status
  const [apiEmployee, setApiEmployee] = React.useState<any>(null)
  const [apiTodayShift, setApiTodayShift] = React.useState<any>(null)
  const [apiUpcomingShift, setApiUpcomingShift] = React.useState<any>(null)

  const selectedEmployee = React.useMemo(() => {
    if (selectedEmployeeId) {
      const found = state.employees.find((e) => e.id === selectedEmployeeId)
      if (found) return found
    }
    if (currentUser?.email) {
      const foundByEmail = state.employees.find((e) => e.email.toLowerCase() === currentUser.email.toLowerCase())
      if (foundByEmail) return foundByEmail
    }
    return activeEmployees[0]
  }, [state.employees, selectedEmployeeId, activeEmployees, currentUser])

  const site = React.useMemo(() => {
    if (!selectedEmployee) return null
    return state.sites.find((s) => s.id === selectedEmployee.primarySiteId)
  }, [state.sites, selectedEmployee])

  // Get scheduled shift from Rota for today from store
  const todayShift = React.useMemo(() => {
    if (apiTodayShift !== undefined && apiTodayShift !== null) return apiTodayShift
    if (!selectedEmployee) return null
    return state.shifts.find(
      (s) => s.employeeId === selectedEmployee.id && s.date === TODAY_ISO
    )
  }, [state.shifts, selectedEmployee, apiTodayShift])

  // Get next / upcoming shift from Rota from store or API
  const upcomingShift = React.useMemo(() => {
    if (apiUpcomingShift !== undefined && apiUpcomingShift !== null) return apiUpcomingShift
    if (!selectedEmployee) return null
    const futureShifts = state.shifts
      .filter((s) => s.employeeId === selectedEmployee.id && s.date >= TODAY_ISO)
      .sort((a, b) => a.date.localeCompare(b.date))
    return futureShifts[0] || null
  }, [state.shifts, selectedEmployee, apiUpcomingShift])

  // Fetch status, shift details, and employee details from API
  const fetchStatus = React.useCallback(async (empId: string) => {
    if (!empId) return
    setFetchingStatus(true)
    try {
      const res = await fetch(apiUrl(`/api/attendance/status?employeeId=${empId}`))
      if (res.ok) {
        const json = await res.json()
        if (json.success) {
          if (Array.isArray(json.events)) setEvents(json.events)
          if (json.employee) setApiEmployee(json.employee)
          if (json.todayShift !== undefined) setApiTodayShift(json.todayShift)
          if (json.upcomingShift !== undefined) setApiUpcomingShift(json.upcomingShift)
        }
      }
    } catch (e) {
      console.error("Failed to fetch employee attendance status from DB:", e)
    } finally {
      setFetchingStatus(false)
    }
  }, [])

  React.useEffect(() => {
    const targetId = selectedEmployeeId || state.currentUserId
    if (targetId) {
      fetchStatus(targetId)
    }
  }, [selectedEmployeeId, state.currentUserId, fetchStatus])

  // Resolved display employee object
  const activeEmployeeObj = apiEmployee || (selectedEmployee ? {
    id: selectedEmployee.id,
    name: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
    employeeNumber: selectedEmployee.employeeNumber,
    jobTitle: selectedEmployee.jobTitle,
    siteId: selectedEmployee.primarySiteId,
    siteName: site?.name || "Main Location",
    hourlyRate: selectedEmployee.hourlyRate ?? 0,
    payType: selectedEmployee.payType,
  } : null)

  return (
    <AdminShell
      crumbs={
        isEmployeeRole
          ? [{ label: "My Shift & Attendance" }]
          : [
              { label: "Attendance", href: "/attendance" },
              { label: "Employee Clocking" },
            ]
      }
    >
      <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-12">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {!isEmployeeRole && (
                <Link href="/attendance">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
              )}
              <h1 className="text-2xl font-bold font-heading tracking-tight">
                {isEmployeeRole ? "My Shift & Attendance Portal" : "Employee Attendance Clock"}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground pl-10">
              {isEmployeeRole
                ? "View your shift details, track working hours, and manage clock in / breaks."
                : "Clock In, Start Break, End Break, and Clock Out for employee work sessions."}
            </p>
          </div>
        </div>

        {/* Deactivated Location Warning Banner */}
        {((site && site.status === "inactive") || (currentSite && currentSite.status === "inactive")) && (
          <InactiveLocationBanner
            siteName={site?.name || currentSite?.name}
            isInactive={true}
          />
        )}

        {/* Manager Employee Selector Bar */}
        {!isEmployeeRole && (
          <Card className="shadow-sm">
            <CardContent className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Select Employee
                  </label>
                  <span className="text-xs text-muted-foreground">
                    Choose an active employee to view or manage attendance
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 min-w-[240px]">
                <Select
                  items={activeEmployees.map((emp) => ({
                    value: emp.id,
                    label: `${emp.firstName} ${emp.lastName}${emp.jobTitle ? ` (${emp.jobTitle})` : ""}`,
                  }))}
                  value={selectedEmployeeId}
                  onValueChange={(val) => val && setSelectedEmployeeId(val)}
                >
                  <SelectTrigger className="w-full sm:min-w-[260px]">
                    <SelectValue placeholder="Select an employee...">
                      {selectedEmployee
                        ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}${selectedEmployee.jobTitle ? ` (${selectedEmployee.jobTitle})` : ""}`
                        : apiEmployee
                          ? (apiEmployee.name || `${apiEmployee.firstName || ""} ${apiEmployee.lastName || ""}`.trim())
                          : "Select an employee..."}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {activeEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}{emp.jobTitle ? ` (${emp.jobTitle})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fetchStatus(selectedEmployeeId)}
                  title="Refresh Status"
                  disabled={fetchingStatus}
                >
                  <RefreshCw className={`h-4 w-4 ${fetchingStatus ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Employee Portal Lock Banner */}
        {isEmployeeRole && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300">
            <ShieldAlert className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Signed in as <strong>{activeEmployeeObj?.name || "Employee"}</strong>. Your account is locked to the Employee Attendance Portal.
            </span>
          </div>
        )}

        {/* Attendance Card */}
        {activeEmployeeObj ? (
          <div className="py-2">
            <EmployeeAttendanceCard
              employee={{
                id: activeEmployeeObj.id,
                name: activeEmployeeObj.name,
                employeeNumber: activeEmployeeObj.employeeNumber,
                jobTitle: activeEmployeeObj.jobTitle,
                siteId: activeEmployeeObj.siteId,
                siteName: activeEmployeeObj.siteName || site?.name || "Main Location",
                hourlyRate: activeEmployeeObj.hourlyRate ?? undefined,
                payType: activeEmployeeObj.payType,
              }}
              todayShift={todayShift}
              upcomingShift={upcomingShift}
              initialEvents={events}
              onActionComplete={() => fetchStatus(activeEmployeeObj.id)}
            />
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            {fetchingStatus ? "Loading employee details..." : "No active employee details found. Please sign in again."}
          </div>
        )}
      </div>
    </AdminShell>
  )
}

