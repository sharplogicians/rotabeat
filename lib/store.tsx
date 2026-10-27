"use client"
import { apiUrl } from '@/lib/api'

import * as React from "react"
import type {
  AppNotification,
  AttendanceRecord,
  AuditEvent,
  ClockEvent,
  Employee,
  KioskDevice,
  OrgSettings,
  PayrollExport,
  Role,
  Shift,
  Site,
  User,
  WeeklyApproval,
} from "./types"
import {
  ALL_ATTENDANCE,
  ALL_SHIFTS,
  AUDIT_LOG,
  EMPLOYEES,
  ORG_SETTINGS,
  PAYROLL_EXPORTS,
  SITES,
  USERS,
  WEEKLY_APPROVALS,
} from "./mock-data"
import { CURRENT_WEEK_START, DEMO_NOW } from "./date-utils"

export type RotaStatus = "draft" | "published" | "locked"

interface AppState {
  role: Role
  currentUserId: string
  currentSiteId: string
  currentWeekStart: string
  sites: Site[]
  users: User[]
  employees: Employee[]
  shifts: Shift[]
  attendance: AttendanceRecord[]
  approvals: WeeklyApproval[]
  payrollExports: PayrollExport[]
  auditLog: AuditEvent[]
  rotaStatus: Record<string, RotaStatus>
  kioskSiteId: string
  orgSettings: OrgSettings
  notifications: AppNotification[]
  currentUserProfile?: Partial<User> | null
  /** true once /api/auth/me has been checked; prevents stale initialState from flashing */
  sessionReady: boolean
}

function rotaKey(siteId: string, weekStart: string) {
  return `${siteId}|${weekStart}`
}

function getPersistedSiteId(): string {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("rotabeat_current_site_id") || localStorage.getItem("rotaflow_current_site_id") || sessionStorage.getItem("rotabeat_current_site_id") || sessionStorage.getItem("rotaflow_current_site_id")
      if (saved) return saved
      const match = document.cookie.match(/rotabeat_last_site=([^;]+)/) || document.cookie.match(/rotaflow_last_site=([^;]+)/)
      if (match && match[1]) return decodeURIComponent(match[1].trim())
    } catch { }
  }
  return "site-bright"
}

const initialState: AppState = {
  role: "business_owner",
  currentUserId: "user-aisha",
  currentSiteId: getPersistedSiteId(),
  currentWeekStart: CURRENT_WEEK_START,
  sites: SITES,
  users: USERS,
  employees: EMPLOYEES,
  shifts: ALL_SHIFTS,
  attendance: ALL_ATTENDANCE,
  approvals: WEEKLY_APPROVALS,
  payrollExports: PAYROLL_EXPORTS,
  auditLog: AUDIT_LOG,
  rotaStatus: {
    [rotaKey("site-bright", CURRENT_WEEK_START)]: "draft",
    [rotaKey("site-riverside", CURRENT_WEEK_START)]: "draft",
  },
  kioskSiteId: "site-bright",
  orgSettings: ORG_SETTINGS,
  notifications: [],
  currentUserProfile: null,
  sessionReady: false,
}

type Action =
  | { type: "SET_ROLE"; role: Role }
  | { type: "SET_USER_SESSION"; userId: string; role: Role; siteId?: string | null; profile?: Partial<User> | null }
  | { type: "SET_SESSION_READY" }
  | { type: "SET_SITE"; siteId: string }
  | { type: "SET_WEEK"; weekStart: string }
  | { type: "SET_KIOSK_SITE"; siteId: string }
  | { type: "SET_EMPLOYEES"; employees: Employee[] }
  | { type: "ADD_EMPLOYEE"; employee: Employee; actorName: string }
  | { type: "UPDATE_EMPLOYEE"; employee: Employee; actorName: string; reason?: string }
  | { type: "SET_EMPLOYEE_STATUS"; employeeId: string; status: Employee["status"]; actorName: string; leavingDate?: string; reason?: string }
  | { type: "RESET_PIN"; employeeId: string; pin: string; actorName: string }
  | { type: "SET_SHIFTS"; shifts: Shift[] }
  | { type: "ADD_SHIFT"; shift: Shift }
  | { type: "UPDATE_SHIFT"; shift: Shift }
  | { type: "DELETE_SHIFT"; shiftId: string }
  | { type: "COPY_PREVIOUS_WEEK"; siteId: string; fromWeekStart: string; toWeekStart: string }
  | { type: "SET_ROTA_STATUS"; siteId: string; weekStart: string; status: RotaStatus }
  | {
    type: "KIOSK_CLOCK_EVENT"
    employeeId: string
    siteId: string
    shiftId?: string
    eventType: ClockEvent["type"]
    scheduledStartTime?: string
    scheduledEndTime?: string
    photo?: string | null
  }
  | {
    type: "CORRECT_ATTENDANCE"
    attendanceId?: string
    employeeId: string
    siteId: string
    date: string
    shiftId?: string
    events: ClockEvent[]
    exceptions: AttendanceRecord["exceptions"]
    reason: string
    actorName: string
    markAbsent?: boolean
  }
  | { type: "RESOLVE_EXCEPTION"; attendanceId: string; actorName: string }
  | { type: "MARK_EMPLOYEE_REVIEWED"; siteId: string; weekStart: string; employeeId: string; actorName: string }
  | { type: "START_WEEKLY_REVIEW"; siteId: string; weekStart: string; actorName: string }
  | { type: "SET_WEEKLY_APPROVAL"; approval: WeeklyApproval }
  | { type: "APPROVE_WEEK"; siteId: string; weekStart: string; actorName: string }
  | { type: "REOPEN_WEEK"; siteId: string; weekStart: string; actorName: string; reason: string }
  | { type: "GENERATE_PAYROLL_EXPORT"; export: PayrollExport; siteIds: string[]; weekStart: string; actorName: string }
  | { type: "SET_PAYROLL_EXPORTS"; exports: PayrollExport[] }
  | { type: "SET_SITES"; sites: Site[] }
  | { type: "SET_USERS"; users: User[] }
  | { type: "ADD_SITE"; site: Site }
  | { type: "UPDATE_SITE"; site: Site }
  | { type: "DELETE_SITE"; siteId: string }
  | { type: "REGISTER_KIOSK"; siteId: string; kiosk: KioskDevice }
  | { type: "REVOKE_KIOSK"; siteId: string; kioskId: string; actorName: string }
  | { type: "ADD_AUDIT"; event: AuditEvent }
  | { type: "UPDATE_ORG_SETTINGS"; settings: OrgSettings; actorName: string }
  | { type: "ADD_NOTIFICATION"; notification: AppNotification }
  | { type: "SET_NOTIFICATIONS"; notifications: AppNotification[] }
  | { type: "MARK_NOTIFICATION_READ"; notificationId: string }
  | { type: "MARK_ALL_NOTIFICATIONS_READ" }

function withAudit(state: AppState, event: Omit<AuditEvent, "id" | "timestamp">): AuditEvent {
  return {
    ...event,
    id: `audit-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: DEMO_NOW.toISOString(),
  }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_SESSION_READY":
      return { ...state, sessionReady: true }
    case "SET_ROLE": {
      const defaults: Record<Role, { userId: string; siteId: string }> = {
        business_owner: { userId: "user-aisha", siteId: "site-bright" },
        head_office: { userId: "user-aisha", siteId: "site-bright" },
        manager: { userId: state.users.find((u) => u.role === "manager")?.id || "user-aisha", siteId: "site-bright" },
        kiosk: { userId: state.currentUserId, siteId: state.kioskSiteId },
        employee: { userId: state.employees[0]?.id || "", siteId: state.currentSiteId || "site-bright" },
      }
      const d = defaults[action.role] || { userId: state.currentUserId, siteId: state.currentSiteId }
      return { ...state, role: action.role, currentUserId: d.userId, currentSiteId: d.siteId }
    }
    case "SET_USER_SESSION": {
      const isOwner = action.role === "business_owner" || action.role === "head_office"
      let persistedSiteId: string | null = null
      if (typeof window !== "undefined") {
        try {
          persistedSiteId = localStorage.getItem("rotabeat_current_site_id") || localStorage.getItem("rotaflow_current_site_id") || sessionStorage.getItem("rotabeat_current_site_id") || sessionStorage.getItem("rotaflow_current_site_id")
          if (!persistedSiteId) {
            const match = document.cookie.match(/rotabeat_last_site=([^;]+)/) || document.cookie.match(/rotaflow_last_site=([^;]+)/)
            if (match && match[1]) persistedSiteId = decodeURIComponent(match[1].trim())
          }
        } catch { }
      }

      const assignedSite = state.sites.find((s) => s.managerId === action.userId)
      const isValidSite = (id: string | null | undefined): boolean =>
        Boolean(id && state.sites.some((s) => s.id === id))

      let targetSiteId: string = state.currentSiteId

      if (isOwner) {
        if (isValidSite(persistedSiteId)) {
          targetSiteId = persistedSiteId!
        } else if (isValidSite(action.siteId)) {
          targetSiteId = action.siteId!
        } else if (persistedSiteId) {
          targetSiteId = persistedSiteId
        } else if (action.siteId) {
          targetSiteId = action.siteId
        } else if (state.sites.length > 0) {
          targetSiteId = state.sites[0].id
        }
      } else {
        targetSiteId = action.siteId || assignedSite?.id || persistedSiteId || state.currentSiteId
      }

      if (typeof window !== "undefined") {
        try {
          if (targetSiteId) {
            localStorage.setItem("rotabeat_current_site_id", targetSiteId)
            sessionStorage.setItem("rotabeat_current_site_id", targetSiteId)
            document.cookie = `rotabeat_last_site=${encodeURIComponent(targetSiteId)}; Path=/; Max-Age=31536000; SameSite=Lax`
          }
          sessionStorage.setItem("rotabeat_user_role", action.role)
          sessionStorage.setItem("rotabeat_user_id", action.userId)
          if (action.profile) {
            sessionStorage.setItem("rotabeat_user_profile", JSON.stringify(action.profile))
          }
        } catch { }
      }

      let updatedUsers = state.users
      if (action.profile && action.profile.id) {
        const fullUser: User = {
          id: action.profile.id,
          name: action.profile.name || `${action.profile.firstName || ""} ${action.profile.lastName || ""}`.trim(),
          firstName: action.profile.firstName || "",
          lastName: action.profile.lastName || "",
          email: action.profile.email || "",
          username: action.profile.username || "",
          role: action.role,
          status: (action.profile.status as any) || "active",
          siteIds: action.profile.siteIds || (action.siteId ? [action.siteId] : [state.currentSiteId]),
          avatarInitials: action.profile.avatarInitials || "US",
        }
        const exists = state.users.some((u) => u.id === fullUser.id)
        updatedUsers = exists ? state.users.map((u) => (u.id === fullUser.id ? fullUser : u)) : [...state.users, fullUser]
      }

      return {
        ...state,
        role: action.role,
        currentUserId: action.userId,
        currentSiteId: targetSiteId,
        currentUserProfile: action.profile || state.currentUserProfile,
        users: updatedUsers,
      }
    }
    case "SET_SITE": {
      if (typeof window !== "undefined" && action.siteId) {
        try {
          localStorage.setItem("rotabeat_current_site_id", action.siteId)
          sessionStorage.setItem("rotabeat_current_site_id", action.siteId)
          document.cookie = `rotabeat_last_site=${encodeURIComponent(action.siteId)}; Path=/; Max-Age=31536000; SameSite=Lax`
        } catch { }
      }
      return { ...state, currentSiteId: action.siteId }
    }
    case "SET_WEEK":
      return { ...state, currentWeekStart: action.weekStart }
    case "SET_KIOSK_SITE":
      return { ...state, kioskSiteId: action.siteId, currentSiteId: action.siteId }
    case "SET_EMPLOYEES":
      return { ...state, employees: action.employees }
    case "ADD_EMPLOYEE":
      return {
        ...state,
        employees: [...state.employees, action.employee],
        auditLog: [
          withAudit(state, {
            userName: action.actorName,
            role: state.role,
            siteId: action.employee.primarySiteId,
            entity: "Employee",
            action: "Added employee",
            newValue: `${action.employee.firstName} ${action.employee.lastName} (${action.employee.employeeNumber})`,
            source: "Employee directory",
          }),
          ...state.auditLog,
        ],
      }
    case "UPDATE_EMPLOYEE":
      return {
        ...state,
        employees: state.employees.map((e) => (e.id === action.employee.id ? action.employee : e)),
        auditLog: [
          withAudit(state, {
            userName: action.actorName,
            role: state.role,
            siteId: action.employee.primarySiteId,
            entity: "Employee",
            action: "Updated employee details",
            newValue: `${action.employee.firstName} ${action.employee.lastName}`,
            reason: action.reason,
            source: "Employee directory",
          }),
          ...state.auditLog,
        ],
      }
    case "SET_EMPLOYEE_STATUS": {
      const emp = state.employees.find((e) => e.id === action.employeeId)
      return {
        ...state,
        employees: state.employees.map((e) =>
          e.id === action.employeeId
            ? { ...e, status: action.status, leavingDate: action.leavingDate, leavingReason: action.reason }
            : e,
        ),
        auditLog: [
          withAudit(state, {
            userName: action.actorName,
            role: state.role,
            siteId: emp?.primarySiteId,
            entity: "Employee",
            action:
              action.status === "inactive"
                ? "Deactivated employee"
                : action.status === "left"
                  ? "Marked employee as left"
                  : "Reactivated employee",
            previousValue: emp ? `Status: ${emp.status}` : undefined,
            newValue: `Status: ${action.status}`,
            reason: action.reason,
            source: "Employee directory",
          }),
          ...state.auditLog,
        ],
      }
    }
    case "RESET_PIN": {
      const emp = state.employees.find((e) => e.id === action.employeeId)
      return {
        ...state,
        employees: state.employees.map((e) =>
          e.id === action.employeeId ? { ...e, pinSet: true, pin: action.pin } : e,
        ),
        auditLog: [
          withAudit(state, {
            userName: action.actorName,
            role: state.role,
            siteId: emp?.primarySiteId,
            entity: "Employee",
            action: "Reset kiosk PIN",
            source: "Employee profile",
          }),
          ...state.auditLog,
        ],
      }
    }
    case "SET_SHIFTS": {
      const shiftMap = new Map(state.shifts.map((s) => [s.id, s]))
      action.shifts.forEach((s) => shiftMap.set(s.id, s))
      return { ...state, shifts: Array.from(shiftMap.values()) }
    }
    case "ADD_SHIFT": {
      const exists = state.shifts.some((s) => s.id === action.shift.id)
      if (exists) {
        return {
          ...state,
          shifts: state.shifts.map((s) => (s.id === action.shift.id ? action.shift : s)),
        }
      }
      return { ...state, shifts: [...state.shifts, action.shift] }
    }
    case "UPDATE_SHIFT":
      return { ...state, shifts: state.shifts.map((s) => (s.id === action.shift.id ? action.shift : s)) }
    case "DELETE_SHIFT":
      return { ...state, shifts: state.shifts.filter((s) => s.id !== action.shiftId) }
    case "COPY_PREVIOUS_WEEK": {
      const fromShifts = state.shifts.filter((s) => s.siteId === action.siteId)
      const offset =
        (new Date(action.toWeekStart).getTime() - new Date(action.fromWeekStart).getTime()) / (1000 * 60 * 60 * 24)
      const copied = fromShifts
        .filter((s) => {
          const d = new Date(s.date)
          const start = new Date(action.fromWeekStart)
          const diff = (d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
          return diff >= 0 && diff < 7
        })
        .map((s) => {
          const d = new Date(s.date)
          d.setDate(d.getDate() + offset)
          return { ...s, id: `shift-${Math.random().toString(36).slice(2, 9)}`, date: d.toISOString().slice(0, 10) }
        })
      const toWeekDates = new Set(copied.map((s) => s.date))
      return {
        ...state,
        shifts: [...state.shifts.filter((s) => !(s.siteId === action.siteId && toWeekDates.has(s.date))), ...copied],
        rotaStatus: { ...state.rotaStatus, [rotaKey(action.siteId, action.toWeekStart)]: "draft" },
      }
    }
    case "SET_ROTA_STATUS":
      return {
        ...state,
        rotaStatus: { ...state.rotaStatus, [rotaKey(action.siteId, action.weekStart)]: action.status },
      }
    case "KIOSK_CLOCK_EVENT": {
      const dateIso = DEMO_NOW.toISOString().slice(0, 10)
      const existing = state.attendance.find(
        (a) => a.employeeId === action.employeeId && a.date === dateIso,
      )
      const newEvent: ClockEvent = {
        id: `evt-${Math.random().toString(36).slice(2, 9)}`,
        type: action.eventType,
        timestamp: DEMO_NOW.toISOString(),
        source: "kiosk",
        photo: action.photo || null,
      }
      if (existing) {
        const events = [...existing.events, newEvent]
        const exceptions = existing.exceptions.filter((e) => e !== "missing_clock_out" && e !== "absent")
        return {
          ...state,
          attendance: state.attendance.map((a) =>
            a.id === existing.id ? { ...a, events, exceptions, status: exceptions.length ? "exception" : "normal" } : a,
          ),
        }
      }
      const record: AttendanceRecord = {
        id: `attend-${Math.random().toString(36).slice(2, 9)}`,
        employeeId: action.employeeId,
        siteId: action.siteId,
        date: dateIso,
        shiftId: action.shiftId,
        scheduledStartTime: action.scheduledStartTime,
        scheduledEndTime: action.scheduledEndTime,
        events: [newEvent],
        exceptions: action.shiftId ? [] : ["unplanned_attendance"],
        status: action.shiftId ? "normal" : "exception",
      }
      return { ...state, attendance: [...state.attendance, record] }
    }
    case "CORRECT_ATTENDANCE": {
      const existing = state.attendance.find(
        (a) => (action.attendanceId && a.id === action.attendanceId) || (a.employeeId === action.employeeId && a.date === action.date)
      )
      if (existing) {
        return {
          ...state,
          attendance: state.attendance.map((a) =>
            a.id === existing.id
              ? {
                ...a,
                events: action.events,
                exceptions: action.exceptions,
                status: "corrected",
                correctionReason: action.reason,
                correctedBy: action.actorName,
                correctedAt: DEMO_NOW.toISOString(),
              }
              : a,
          ),
          auditLog: [
            withAudit(state, {
              userName: action.actorName,
              role: state.role,
              siteId: action.siteId,
              entity: "Attendance",
              action: "Corrected attendance record",
              reason: action.reason,
              source: "Attendance & timesheets",
            }),
            ...state.auditLog,
          ],
        }
      }
      const record: AttendanceRecord = {
        id: `attend-${Math.random().toString(36).slice(2, 9)}`,
        employeeId: action.employeeId,
        siteId: action.siteId,
        date: action.date,
        shiftId: action.shiftId,
        events: action.events,
        exceptions: action.exceptions,
        status: "corrected",
        correctionReason: action.reason,
        correctedBy: action.actorName,
        correctedAt: DEMO_NOW.toISOString(),
      }
      return {
        ...state,
        attendance: [...state.attendance, record],
        auditLog: [
          withAudit(state, {
            userName: action.actorName,
            role: state.role,
            siteId: action.siteId,
            entity: "Attendance",
            action: "Added attendance record",
            reason: action.reason,
            source: "Attendance & timesheets",
          }),
          ...state.auditLog,
        ],
      }
    }
    case "RESOLVE_EXCEPTION":
      return {
        ...state,
        attendance: state.attendance.map((a) => (a.id === action.attendanceId ? { ...a, status: "reviewed" } : a)),
      }
    case "MARK_EMPLOYEE_REVIEWED": {
      const existing = state.approvals.find((ap) => ap.siteId === action.siteId && ap.weekStart === action.weekStart)
      if (!existing) {
        const created: WeeklyApproval = {
          id: `approval-${Math.random().toString(36).slice(2, 9)}`,
          siteId: action.siteId,
          weekStart: action.weekStart,
          status: "under_review",
          reviewedEmployeeIds: [action.employeeId],
          lastUpdatedBy: action.actorName,
          lastUpdatedAt: DEMO_NOW.toISOString(),
        }
        return { ...state, approvals: [...state.approvals, created] }
      }
      return {
        ...state,
        approvals: state.approvals.map((ap) =>
          ap.siteId === action.siteId && ap.weekStart === action.weekStart
            ? {
              ...ap,
              reviewedEmployeeIds: ap.reviewedEmployeeIds.includes(action.employeeId)
                ? ap.reviewedEmployeeIds
                : [...ap.reviewedEmployeeIds, action.employeeId],
              status: ap.status === "open" ? "under_review" : ap.status,
              lastUpdatedBy: action.actorName,
              lastUpdatedAt: DEMO_NOW.toISOString(),
            }
            : ap,
        ),
      }
    }
    case "START_WEEKLY_REVIEW": {
      const isOwnerRole = state.role === "business_owner" || state.role === "head_office"
      const existing = state.approvals.find((ap) => ap.siteId === action.siteId && ap.weekStart === action.weekStart)
      const approvals = existing
        ? state.approvals.map((ap) =>
          ap.siteId === action.siteId && ap.weekStart === action.weekStart
            ? {
                ...ap,
                status: "under_review" as const,
                ownerReviewStarted: isOwnerRole ? true : ap.ownerReviewStarted,
                ownerReviewStartedAt: isOwnerRole ? DEMO_NOW.toISOString() : ap.ownerReviewStartedAt,
                lastUpdatedBy: action.actorName,
                lastUpdatedAt: DEMO_NOW.toISOString()
              }
            : ap,
        )
        : [
          ...state.approvals,
          {
            id: `approval-${Math.random().toString(36).slice(2, 9)}`,
            siteId: action.siteId,
            weekStart: action.weekStart,
            status: "under_review" as const,
            reviewedEmployeeIds: [],
            ownerReviewStarted: isOwnerRole,
            ownerReviewStartedAt: isOwnerRole ? DEMO_NOW.toISOString() : undefined,
            lastUpdatedBy: action.actorName,
            lastUpdatedAt: DEMO_NOW.toISOString(),
          },
        ]
      return {
        ...state,
        approvals,
        auditLog: [
          withAudit(state, {
            userName: action.actorName,
            role: state.role,
            siteId: action.siteId,
            entity: "Weekly Approval",
            action: "Started weekly review",
            previousValue: "Open",
            newValue: "Under Review",
            source: "Weekly approval",
          }),
          ...state.auditLog,
        ],
      }
    }
    case "SET_WEEKLY_APPROVAL": {
      const existing = state.approvals.find(
        (ap) => ap.siteId === action.approval.siteId && ap.weekStart === action.approval.weekStart
      )
      return {
        ...state,
        approvals: existing
          ? state.approvals.map((ap) =>
            ap.siteId === action.approval.siteId && ap.weekStart === action.approval.weekStart
              ? action.approval
              : ap
          )
          : [...state.approvals, action.approval],
      }
    }
    case "APPROVE_WEEK": {
      const existing = state.approvals.find((ap) => ap.siteId === action.siteId && ap.weekStart === action.weekStart)
      const approvals = existing
        ? state.approvals.map((ap) =>
          ap.siteId === action.siteId && ap.weekStart === action.weekStart
            ? { ...ap, status: "approved" as const, approvedBy: action.actorName, approvedAt: DEMO_NOW.toISOString(), lastUpdatedBy: action.actorName, lastUpdatedAt: DEMO_NOW.toISOString() }
            : ap,
        )
        : [
          ...state.approvals,
          {
            id: `approval-${Math.random().toString(36).slice(2, 9)}`,
            siteId: action.siteId,
            weekStart: action.weekStart,
            status: "approved" as const,
            reviewedEmployeeIds: [],
            approvedBy: action.actorName,
            approvedAt: DEMO_NOW.toISOString(),
            lastUpdatedBy: action.actorName,
            lastUpdatedAt: DEMO_NOW.toISOString(),
          },
        ]
      return {
        ...state,
        approvals,
        auditLog: [
          withAudit(state, {
            userName: action.actorName,
            role: state.role,
            siteId: action.siteId,
            entity: "Weekly Approval",
            action: "Approved week",
            previousValue: "Under review",
            newValue: "Approved",
            source: "Weekly approval",
          }),
          ...state.auditLog,
        ],
      }
    }
    case "REOPEN_WEEK":
      return {
        ...state,
        approvals: state.approvals.map((ap) =>
          ap.siteId === action.siteId && ap.weekStart === action.weekStart
            ? {
              ...ap,
              status: "under_review",
              reopenedReason: action.reason,
              reopenedBy: action.actorName,
              reopenedAt: DEMO_NOW.toISOString(),
              lastUpdatedBy: action.actorName,
              lastUpdatedAt: DEMO_NOW.toISOString(),
            }
            : ap,
        ),
        auditLog: [
          withAudit(state, {
            userName: action.actorName,
            role: state.role,
            siteId: action.siteId,
            entity: "Weekly Approval",
            action: "Reopened approved week",
            previousValue: "Approved",
            newValue: "Under Review",
            reason: action.reason,
            source: "Head office console",
          }),
          ...state.auditLog,
        ],
      }
    case "GENERATE_PAYROLL_EXPORT":
      return {
        ...state,
        payrollExports: [action.export, ...state.payrollExports],
        approvals: state.approvals.map((ap) =>
          action.siteIds.includes(ap.siteId) && ap.weekStart === action.weekStart ? { ...ap, status: "exported" } : ap,
        ),
        auditLog: [
          withAudit(state, {
            userName: action.actorName,
            role: state.role,
            entity: "Payroll Export",
            action: "Generated payroll export",
            newValue: `Export ${action.export.id}, ${action.export.employeeCount} employees, ${action.export.totalPayableHours} payable hours`,
            source: "Payroll exports",
          }),
          ...state.auditLog,
        ],
      }
    case "SET_PAYROLL_EXPORTS":
      return {
        ...state,
        payrollExports: action.exports,
      }
    case "SET_SITES": {
      const siteExists = action.sites.some((s) => s.id === state.currentSiteId)
      let resolvedSiteId = state.currentSiteId

      if (!siteExists && action.sites.length > 0) {
        let savedSite: string | null = null
        if (typeof window !== "undefined") {
          try {
            savedSite = localStorage.getItem("rotabeat_current_site_id") || localStorage.getItem("rotaflow_current_site_id") || sessionStorage.getItem("rotabeat_current_site_id") || sessionStorage.getItem("rotaflow_current_site_id")
            if (!savedSite) {
              const match = document.cookie.match(/rotabeat_last_site=([^;]+)/) || document.cookie.match(/rotaflow_last_site=([^;]+)/)
              if (match && match[1]) savedSite = decodeURIComponent(match[1].trim())
            }
          } catch { }
        }
        if (savedSite && action.sites.some((s) => s.id === savedSite)) {
          resolvedSiteId = savedSite
        } else {
          resolvedSiteId = action.sites[0].id
        }

        if (typeof window !== "undefined" && resolvedSiteId) {
          try {
            localStorage.setItem("rotabeat_current_site_id", resolvedSiteId)
            sessionStorage.setItem("rotabeat_current_site_id", resolvedSiteId)
            document.cookie = `rotabeat_last_site=${encodeURIComponent(resolvedSiteId)}; Path=/; Max-Age=31536000; SameSite=Lax`
          } catch { }
        }
      }

      return { ...state, sites: action.sites, currentSiteId: resolvedSiteId }
    }
    case "SET_USERS": {
      // Preserve the current user profile in the users list so it is not overwritten
      let mergedUsers = action.users
      if (state.currentUserProfile && state.currentUserProfile.id) {
        const existsInNew = mergedUsers.some((u) => u.id === state.currentUserProfile!.id)
        if (!existsInNew) {
          const fullUser: User = {
            id: state.currentUserProfile.id!,
            name: state.currentUserProfile.name || "",
            firstName: state.currentUserProfile.firstName || "",
            lastName: state.currentUserProfile.lastName || "",
            email: state.currentUserProfile.email || "",
            username: state.currentUserProfile.username || "",
            role: (state.currentUserProfile.role as any) || state.role,
            status: state.currentUserProfile.status || "active",
            siteIds: state.currentUserProfile.siteIds || [state.currentSiteId],
            avatarInitials: state.currentUserProfile.avatarInitials || "US",
          }
          mergedUsers = [...mergedUsers, fullUser]
        }
      }
      return { ...state, users: mergedUsers }
    }
    case "ADD_SITE":
      return { ...state, sites: [...state.sites, action.site] }
    case "UPDATE_SITE":
      return { ...state, sites: state.sites.map((s) => (s.id === action.site.id ? action.site : s)) }
    case "DELETE_SITE": {
      const remainingSites = state.sites.filter((s) => s.id !== action.siteId)
      const nextSiteId = state.currentSiteId === action.siteId ? (remainingSites[0]?.id || "") : state.currentSiteId
      return {
        ...state,
        sites: remainingSites,
        currentSiteId: nextSiteId,
        employees: state.employees.filter((e) => e.primarySiteId !== action.siteId),
        shifts: state.shifts.filter((s) => s.siteId !== action.siteId),
        attendance: state.attendance.filter((a) => a.siteId !== action.siteId),
      }
    }
    case "REGISTER_KIOSK":
      return {
        ...state,
        sites: state.sites.map((s) => (s.id === action.siteId ? { ...s, kiosks: [...s.kiosks, action.kiosk] } : s)),
      }
    case "REVOKE_KIOSK":
      return {
        ...state,
        sites: state.sites.map((s) =>
          s.id === action.siteId
            ? { ...s, kiosks: s.kiosks.map((k) => (k.id === action.kioskId ? { ...k, status: "revoked" } : k)) }
            : s,
        ),
        auditLog: [
          withAudit(state, {
            userName: action.actorName,
            role: state.role,
            siteId: action.siteId,
            entity: "Kiosk",
            action: "Revoked kiosk device",
            source: "Kiosk registration",
          }),
          ...state.auditLog,
        ],
      }
    case "ADD_AUDIT":
      return { ...state, auditLog: [action.event, ...state.auditLog] }
    case "ADD_NOTIFICATION":
      return {
        ...state,
        notifications: [action.notification, ...state.notifications],
      }
    case "SET_NOTIFICATIONS":
      return {
        ...state,
        notifications: action.notifications,
      }
    case "MARK_NOTIFICATION_READ":
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.notificationId ? { ...n, read: true } : n,
        ),
      }
    case "MARK_ALL_NOTIFICATIONS_READ":
      return {
        ...state,
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      }
    default:
      return state
  }
}

const StoreContext = React.createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null)

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, initialState)

  React.useEffect(() => {
    async function initSession() {
      try {
        // ── 1. Fetch active/inactive locations from DB FIRST to sync site data ──
        try {
          const locRes = await fetch(apiUrl("/api/locations"))
          if (locRes.ok) {
            const locData = await locRes.json()
            if (locData.success && Array.isArray(locData.locations)) {
              const formattedSites: Site[] = locData.locations.map((loc: any) => ({
                id: loc.id,
                name: loc.name,
                town: loc.town,
                address: loc.address || "",
                city: loc.city || loc.town || "",
                postalCode: loc.postalCode || "",
                country: loc.country || "UK",
                phone: loc.phone || "",
                email: loc.email || "",
                managerId: loc.managerId || "",
                businessOwnerId: loc.businessOwnerId || "user-aisha",
                timeZone: loc.timeZone || "Europe/London",
                weekStart: (loc.weekStart as any) || "monday",
                status: (loc.status as any) || "active",
                kiosks: loc.kiosks || [],
              }))
              dispatch({ type: "SET_SITES", sites: formattedSites })
            }
          }
        } catch (err) {
          console.error("Failed to sync locations from DB:", err)
        }

        // ── 2. Authoritative session from server (cookie-based) ──────────
        // This is the ONLY source of truth. sessionStorage is used only
        // to persist the session data for the current tab and is saved
        // inside SET_USER_SESSION, but the server cookie always wins.
        const meRes = await fetch(apiUrl("/api/auth/me"))
        if (meRes.ok) {
          const meData = await meRes.json()
          if (meData.success && meData.user) {
            const u = meData.user
            const initials = u.avatarInitials || `${u.firstName?.[0] || ""}${u.lastName?.[0] || ""}`.toUpperCase() || "US"
            const userProfile: Partial<User> = {
              id: u.id,
              name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim(),
              firstName: u.firstName || "",
              lastName: u.lastName || "",
              email: u.email || "",
              username: u.username || u.employeeNumber || "",
              role: u.role,
              status: u.status || "active",
              siteIds: u.locationId ? [u.locationId] : [],
              avatarInitials: initials,
            }

            const isOwner = u.role === "business_owner" || u.role === "head_office"
            let persistedSiteId: string | null = null
            if (typeof window !== "undefined") {
              try {
                persistedSiteId = localStorage.getItem("rotabeat_current_site_id") || localStorage.getItem("rotaflow_current_site_id") || sessionStorage.getItem("rotabeat_current_site_id") || sessionStorage.getItem("rotaflow_current_site_id")
                if (!persistedSiteId) {
                  const match = document.cookie.match(/rotabeat_last_site=([^;]+)/) || document.cookie.match(/rotaflow_last_site=([^;]+)/)
                  if (match && match[1]) persistedSiteId = decodeURIComponent(match[1].trim())
                }
              } catch { }
            }

            const effectiveSiteId = (isOwner && persistedSiteId) ? persistedSiteId : (u.locationId || persistedSiteId || null)

            dispatch({
              type: "SET_USER_SESSION",
              userId: u.id,
              role: u.role,
              siteId: effectiveSiteId,
              profile: userProfile,
            })
          }
        } else {
          // Server returned non-OK (e.g. 401). Try sessionStorage as fallback
          // for a degraded offline experience, but this is NOT authoritative.
          const savedRole = (sessionStorage.getItem("rotabeat_user_role") || sessionStorage.getItem("rotaflow_user_role")) as Role | null
          const savedUserId = sessionStorage.getItem("rotabeat_user_id") || sessionStorage.getItem("rotaflow_user_id")
          const savedSiteId = sessionStorage.getItem("rotabeat_current_site_id") || sessionStorage.getItem("rotaflow_current_site_id")
          const savedProfileStr = sessionStorage.getItem("rotabeat_user_profile") || sessionStorage.getItem("rotaflow_user_profile")
          const savedProfile = savedProfileStr ? JSON.parse(savedProfileStr) : null

          if (savedUserId && savedRole) {
            dispatch({
              type: "SET_USER_SESSION",
              userId: savedUserId,
              role: savedRole,
              siteId: savedSiteId,
              profile: savedProfile,
            })
          }
        }

        // ── 3. Fetch managers from DB to sync users list ─────────────────
        const mgrRes = await fetch(apiUrl("/api/managers"))
        if (mgrRes.ok) {
          const mgrData = await mgrRes.json()
          if (mgrData.success && Array.isArray(mgrData.managers)) {
            const mgrUsers: User[] = mgrData.managers.map((m: any) => ({
              id: m.id,
              firstName: m.firstName,
              lastName: m.lastName,
              name: m.name || `${m.firstName} ${m.lastName}`,
              email: m.email,
              username: m.username,
              role: "manager",
              status: m.status,
              siteIds: m.locationId ? [m.locationId] : [],
              avatarInitials: m.avatarInitials || "SM",
            }))
            const owner = USERS[0]
            dispatch({ type: "SET_USERS", users: [owner, ...mgrUsers] })
          }
        }

        // ── 4. Fetch employees from DB ──────────────────────────────────
        const empRes = await fetch(apiUrl("/api/employees?siteId=all"))
        if (empRes.ok) {
          const empData = await empRes.json()
          if (empData.success && Array.isArray(empData.employees)) {
            dispatch({ type: "SET_EMPLOYEES", employees: empData.employees })
          }
        }
      } catch (err) {
        console.error("Session init error:", err)
      } finally {
        // Mark session as ready so the UI can render with the correct user
        dispatch({ type: "SET_SESSION_READY" })
      }
    }

    initSession()
  }, [])

  const value = React.useMemo(() => ({ state, dispatch }), [state])

  // Show nothing until the session has been verified from the server.
  // This prevents the wrong user (from initialState) from flashing on screen.
  if (!state.sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Loading session…</span>
        </div>
      </div>
    )
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useAppStore() {
  const ctx = React.useContext(StoreContext)
  if (!ctx) throw new Error("useAppStore must be used within AppStoreProvider")
  return ctx
}

// ---------------------------------------------------------------------------
// Convenience selector hooks
// ---------------------------------------------------------------------------

export function useCurrentUser(): User {
  const { state } = useAppStore()

  // 1. If we have a cached/synced profile in state matching current role/id, use it!
  if (state.currentUserProfile && state.currentUserProfile.id === state.currentUserId) {
    const p = state.currentUserProfile
    return {
      id: p.id || state.currentUserId,
      firstName: p.firstName || "",
      lastName: p.lastName || "",
      name: p.name || `${p.firstName || ""} ${p.lastName || ""}`.trim(),
      email: p.email || "",
      username: p.username || "",
      role: (p.role as Role) || state.role,
      status: p.status || "active",
      siteIds: p.siteIds || [state.currentSiteId],
      avatarInitials: p.avatarInitials || `${p.firstName?.[0] || ""}${p.lastName?.[0] || ""}`.toUpperCase() || "US",
    }
  }

  // 2. If Employee role, find in state.employees
  if (state.role === "employee") {
    const emp = state.employees.find(
      (e) => e.id === state.currentUserId || e.employeeNumber === state.currentUserId || e.email === state.currentUserId
    )
    if (emp) {
      const initials = `${emp.firstName?.[0] || ""}${emp.lastName?.[0] || ""}`.toUpperCase() || "EM"
      return {
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        name: `${emp.firstName} ${emp.lastName}`.trim(),
        email: emp.email,
        username: emp.employeeNumber,
        role: "employee" as any,
        status: emp.status === "left" ? "inactive" : emp.status,
        siteIds: [emp.primarySiteId],
        avatarInitials: initials,
      }
    }
  }

  // 3. Find in state.users by ID
  const found = state.users.find((u) => u.id === state.currentUserId)
  if (found) return found

  // 4. Strict fallback — only return a user that matches BOTH role AND id
  //    Never pick a random user just because their role matches.
  //    This prevents "logged in as owner" from switching to a random manager.
  const fallback = state.users.find((u) => u.role === state.role && u.id === state.currentUserId)
  if (fallback) return fallback

  // 5. Absolute last resort: create a synthetic user from whatever we have
  return {
    id: state.currentUserId,
    firstName: "",
    lastName: "",
    name: "User",
    email: "",
    username: "",
    role: state.role,
    status: "active",
    siteIds: [state.currentSiteId],
    avatarInitials: "US",
  }
}

export function useCurrentSite(): Site | undefined {
  const { state } = useAppStore()
  return state.sites.find((s) => s.id === state.currentSiteId)
}

export function useAccessibleSites(): Site[] {
  const { state } = useAppStore()
  return React.useMemo(() => {
    const user = state.users.find((u) => u.id === state.currentUserId)
    if (!user) return state.sites
    if (state.role === "head_office" || state.role === "business_owner") return state.sites
    // Managers can ONLY access their single assigned site
    const assignedSites = state.sites.filter(
      (s) => s.managerId === user.id || (Array.isArray(user.siteIds) && user.siteIds.includes(s.id))
    )
    if (assignedSites.length > 0) return assignedSites
    return state.sites.length > 0 ? [state.sites[0]] : []
  }, [state.sites, state.users, state.currentUserId, state.role])
}

export function useRotaStatus(siteId: string, weekStart: string): RotaStatus {
  const { state } = useAppStore()
  return state.rotaStatus[rotaKey(siteId, weekStart)] ?? "draft"
}

export { rotaKey }


