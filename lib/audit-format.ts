import type { Employee } from "@/lib/types"
import {
  CheckCircle2,
  RotateCcw,
  UserCheck,
  Edit3,
  History,
  LogIn,
  LogOut,
  KeyRound,
  UserPlus,
  Calendar,
  FileSpreadsheet,
} from "lucide-react"

/**
 * Format audit action codes into human-readable action titles.
 */
export function formatAuditAction(action?: string): string {
  if (!action) return "Audit Event"
  const map: Record<string, string> = {
    LOGOUT: "User Signed Out",
    LOGIN_SUCCESS: "User Signed In",
    LOGIN_FAILED: "Sign In Failed",
    RESET_PIN: "Security PIN Reset",
    CREATE_EMPLOYEE: "Employee Created",
    UPDATE_EMPLOYEE: "Employee Details Updated",
    DELETE_EMPLOYEE: "Employee Removed",
    CREATE_SHIFT: "Shift Scheduled",
    UPDATE_SHIFT: "Shift Updated",
    DELETE_SHIFT: "Shift Cancelled",
    START_REVIEW: "Weekly Review Started",
    UPDATE_MANAGER_REVIEW: "Manager Review Check",
    UPDATE_OWNER_REVIEW: "Owner Review Check",
    APPROVE_WEEK_MANAGER: "Manager Timesheet Approval",
    APPROVE_WEEK_FINAL: "Final Timesheet Approval",
    REOPEN_WEEK: "Timesheet Reopened",
    EXPORT_PAYROLL: "Payroll Export Generated",
    EXPORT_WEEK: "Weekly Timesheet Exported",
  }
  if (map[action]) return map[action]
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}

/**
 * Cleanly format audit log detail values into human-readable text.
 * Prevents raw JSON dumps like {"userId":"user-aisha"} from ever displaying.
 */
export function formatAuditDetails(
  val?: string | null,
  employees: Employee[] = [],
  action?: string,
  userName?: string,
  prevVal?: string | null
): string {
  const act = (action || "").toUpperCase()
  const user = userName || "User"

  // 1. Direct handling for auth events
  if (act === "LOGOUT") {
    return `${user} signed out of the web portal.`
  }

  if (act === "LOGIN_SUCCESS") {
    return `${user} signed in successfully.`
  }

  if (act === "LOGIN_FAILED") {
    return `Unsuccessful sign in attempt recorded for ${user}.`
  }

  if (!val || !val.trim()) {
    if (act.includes("APPROVE")) return "Timesheet approved and locked."
    if (act.includes("REOPEN")) return "Timesheet reopened for review."
    return ""
  }

  let formatted = val.trim()

  // 2. Parse JSON if present
  if (formatted.startsWith("{") && formatted.endsWith("}")) {
    try {
      const parsed = JSON.parse(formatted)
      if (parsed && typeof parsed === "object") {
        // Attendance/Timesheet record details
        const parts: string[] = []
        if (parsed.date) parts.push(`Date: ${parsed.date}`)
        if (parsed.clockIn) parts.push(`Clock In: ${parsed.clockIn}`)
        if (parsed.clockOut) parts.push(`Clock Out: ${parsed.clockOut}`)
        if (parsed.breakStart && parsed.breakEnd) parts.push(`Break: ${parsed.breakStart}–${parsed.breakEnd}`)
        if (parsed.markAbsent) parts.push(`Marked Absent`)

        // PIN Reset
        if (act === "RESET_PIN" || parsed.pinUpdated) {
          const empName = parsed.name || employees.find((e) => e.id === parsed.id)?.firstName || "Employee"
          const title = parsed.jobTitle ? ` (${parsed.jobTitle})` : ""
          return `Security PIN was updated/reset for ${empName}${title}.`
        }

        // Employee Creation
        if (act === "CREATE_EMPLOYEE") {
          const empName = parsed.name || `${parsed.firstName || ""} ${parsed.lastName || ""}`.trim() || "Employee"
          const title = parsed.jobTitle ? ` as ${parsed.jobTitle}` : ""
          const num = parsed.employeeNumber ? ` [ID: ${parsed.employeeNumber}]` : ""
          return `New employee record created for ${empName}${title}${num}.`
        }

        // Employee Update
        if (act === "UPDATE_EMPLOYEE") {
          const empName = parsed.name || `${parsed.firstName || ""} ${parsed.lastName || ""}`.trim() || "Employee"
          const title = parsed.jobTitle ? ` (${parsed.jobTitle})` : ""
          return `Employee profile updated for ${empName}${title}.`
        }

        // Employee Deletion
        if (act === "DELETE_EMPLOYEE") {
          const empName = parsed.name || `${parsed.firstName || ""} ${parsed.lastName || ""}`.trim() || "Employee"
          return `Employee record removed: ${empName}.`
        }

        // Shift Creation / Update / Deletion
        if (act === "CREATE_SHIFT") {
          const empName = parsed.employeeName || employees.find((e) => e.id === parsed.employeeId)?.firstName || "Employee"
          const time = parsed.startTime && parsed.endTime ? ` (${parsed.startTime}–${parsed.endTime})` : ""
          return `Scheduled shift for ${empName}${parsed.date ? ` on ${parsed.date}` : ""}${time}${parsed.role ? ` • ${parsed.role}` : ""}.`
        }

        if (act === "UPDATE_SHIFT") {
          const time = parsed.startTime && parsed.endTime ? ` (${parsed.startTime}–${parsed.endTime})` : ""
          return `Shift updated${parsed.date ? ` for ${parsed.date}` : ""}${time}.`
        }

        if (act === "DELETE_SHIFT") {
          const empName = parsed.employeeName || employees.find((e) => e.id === parsed.employeeId)?.firstName || "Employee"
          return `Shift removed for ${empName}${parsed.date ? ` on ${parsed.date}` : ""}.`
        }

        // Attendance parts
        if (parts.length > 0) {
          return parts.join(" • ")
        }

        // Generic JSON containing only userId / role
        if (parsed.userId && Object.keys(parsed).length <= 2) {
          const userEmp = employees.find((e) => e.id === parsed.userId)
          const nameToUse = userEmp ? `${userEmp.firstName} ${userEmp.lastName}` : (userName || parsed.userId)
          return `Account: ${nameToUse}${parsed.role ? ` (${parsed.role})` : ""}`
        }

        // Other generic JSON objects: format keys into human labels
        const genericParts: string[] = []
        for (const [key, val] of Object.entries(parsed)) {
          if (["id", "_id", "siteId"].includes(key)) continue
          if (val === null || val === undefined || val === "") continue
          const keyLabel = key
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase())
            .trim()
          genericParts.push(`${keyLabel}: ${String(val)}`)
        }
        if (genericParts.length > 0) {
          return genericParts.join(" • ")
        }
      }
    } catch {
      // Ignore JSON parse errors and continue
    }
  }

  // 3. String substitution for employee IDs -> Full names
  employees.forEach((emp) => {
    if (emp.id && formatted.includes(emp.id)) {
      formatted = formatted.split(emp.id).join(`${emp.firstName} ${emp.lastName}`)
    }
  })

  // 4. Fallback if still raw JSON
  if (formatted.startsWith("{") && formatted.endsWith("}")) {
    return userName ? `Action performed by ${userName}` : "Audit event recorded"
  }

  return formatted
}

/**
 * Returns icon and styling for an audit log entry.
 */
export function getAuditIconAndColor(action: string) {
  const lower = (action || "").toLowerCase()
  if (lower.includes("approve") || lower.includes("final")) {
    return {
      icon: CheckCircle2,
      nodeColor: "bg-emerald-600 text-white shadow-emerald-500/20",
    }
  }
  if (lower.includes("reopen")) {
    return {
      icon: RotateCcw,
      nodeColor: "bg-amber-500 text-white shadow-amber-500/20",
    }
  }
  if (lower.includes("review") || lower.includes("status")) {
    return {
      icon: UserCheck,
      nodeColor: "bg-blue-600 text-white shadow-blue-500/20",
    }
  }
  if (lower.includes("correct") || lower.includes("edit") || lower.includes("update")) {
    return {
      icon: Edit3,
      nodeColor: "bg-purple-600 text-white shadow-purple-500/20",
    }
  }
  if (lower.includes("logout")) {
    return {
      icon: LogOut,
      nodeColor: "bg-slate-600 text-white shadow-slate-500/20",
    }
  }
  if (lower.includes("login")) {
    return {
      icon: LogIn,
      nodeColor: "bg-sky-600 text-white shadow-sky-500/20",
    }
  }
  if (lower.includes("pin")) {
    return {
      icon: KeyRound,
      nodeColor: "bg-indigo-600 text-white shadow-indigo-500/20",
    }
  }
  if (lower.includes("employee")) {
    return {
      icon: UserPlus,
      nodeColor: "bg-teal-600 text-white shadow-teal-500/20",
    }
  }
  if (lower.includes("shift")) {
    return {
      icon: Calendar,
      nodeColor: "bg-violet-600 text-white shadow-violet-500/20",
    }
  }
  if (lower.includes("export")) {
    return {
      icon: FileSpreadsheet,
      nodeColor: "bg-emerald-600 text-white shadow-emerald-500/20",
    }
  }
  return {
    icon: History,
    nodeColor: "bg-slate-500 text-white",
  }
}
