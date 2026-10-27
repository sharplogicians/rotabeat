// RotaBeat domain types — front-end POC only. No database, no real auth.
 import { apiUrl } from '@/lib/api';
export type Role = "business_owner" | "head_office" | "manager" | "kiosk" | "employee"

export type PayType = "hourly" | "salaried"

export type EmployeeStatus = "active" | "inactive" | "left"

export interface Site {
  id: string
  name: string
  town: string
  address: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  phone?: string
  email?: string
  managerId: string
  businessOwnerId?: string
  timeZone: string
  weekStart: "monday"
  status: "active" | "inactive"
  kiosks: KioskDevice[]
}

export interface KioskDevice {
  id: string
  siteId: string
  name: string
  registeredAt: string
  lastActiveAt: string | null
  status: "active" | "revoked" | "pending"
  registrationCode?: string
  codeExpiresAt?: string
}

export interface User {
  id: string
  firstName?: string
  lastName?: string
  name: string
  email: string
  username?: string
  role: Role
  status?: "active" | "inactive"
  siteIds: string[] // sites this user can access; head office / business owner = all
  avatarInitials: string
}

export interface Employee {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  email: string
  phone: string
  jobTitle: string
  profileImage?: string
  faceEmbedding?: string | null
  primarySiteId: string
  managerId: string
  payType: PayType
  hourlyRate?: number
  salaryAnnual?: number
  startDate: string
  status: EmployeeStatus
  leavingDate?: string
  leavingReason?: string
  pinSet: boolean
  pin?: string // demo only, would never be stored client-side in a real product
}

export type ShiftStatus = "scheduled" | "warning"

export interface Shift {
  id: string
  employeeId: string
  siteId: string
  date: string // ISO date yyyy-mm-dd
  startTime: string // HH:mm
  endTime: string // HH:mm
  unpaidBreakMinutes: number
  role: string
  notes?: string
}

export type ClockEventType = "clock_in" | "break_start" | "break_end" | "clock_out"

export interface ClockEvent {
  id: string
  type: ClockEventType
  timestamp: string // ISO datetime
  source: "kiosk" | "web" | "clock_event" | "manager_manual" | "manager_correction"
  deviceId?: string
  photo?: string | null
  faceMatchScore?: number | null
  faceVerified?: boolean
}

export type ExceptionType =
  | "late_arrival"
  | "early_departure"
  | "missing_clock_in"
  | "missing_clock_out"
  | "missing_break_end"
  | "absent"
  | "unplanned_attendance"
  | "invalid_event_sequence"
  | "overtime"
  | "other"

export type AttendanceStatus = "normal" | "exception" | "corrected" | "reviewed"

export interface AttendanceAuditChange {
  field: string
  previousValue: string
  newValue: string
}

export interface AttendanceAudit {
  id: string
  attendanceRecordId: string
  employeeId: string
  changedBy: string
  changedAt: string
  action: "CREATE" | "UPDATE"
  changes: AttendanceAuditChange[]
  reason: string
}

export interface AttendanceRecord {
  id: string
  employeeId: string
  siteId: string
  date: string
  shiftId?: string // undefined if unplanned attendance
  events: ClockEvent[]
  scheduledStartTime?: string
  scheduledEndTime?: string
  source?: "clock_event" | "manager_manual" | "manager_correction"
  grossMinutes?: number
  totalBreakMinutes?: number
  workedMinutes?: number
  exceptions: ExceptionType[]
  status: AttendanceStatus
  correctionReason?: string
  correctedBy?: string
  correctedAt?: string
  audits?: AttendanceAudit[]
}

export type WeekApprovalStatus = "open" | "under_review" | "approved" | "exported"

export interface WeeklyApproval {
  id: string
  siteId: string
  weekStart: string // ISO date, Monday
  status: WeekApprovalStatus
  reviewedEmployeeIds: string[]
  ownerReviewedEmployeeIds?: string[]
  managerApprovedBy?: string
  managerApprovedAt?: string
  ownerReviewStarted?: boolean
  ownerReviewStartedAt?: string
  approvedBy?: string
  approvedAt?: string
  reopenedReason?: string
  reopenedBy?: string
  reopenedAt?: string
  lastUpdatedBy: string
  lastUpdatedAt: string
}

export interface PayrollExport {
  id: string
  payPeriodLabel: string
  weekStart: string
  siteIds: string[]
  employeeCount: number
  totalPayableHours: number
  generatedBy: string
  generatedAt: string
  status: "completed"
  csvData: string
}

export interface AuditEvent {
  id: string
  timestamp: string
  userName: string
  role: Role
  siteId?: string
  entity: string
  action: string
  previousValue?: string
  newValue?: string
  reason?: string
  source: string
}

export interface OrgSettings {
  orgName: string
  timeZone: string
  weekStart: "monday"
  defaultPayPeriod: "weekly"
  earlyClockInMinutes: number
  lateThresholdMinutes: number
  rounding: "exact" | "5" | "15"
  breaksClocked: boolean
  duplicateActionPrevention: boolean
  overtimeEnabled: boolean
  weeklyOvertimeThreshold: number
  weeklyApprovalEmailReminder?: boolean
}

export type NotificationType =
  | "clock_in"
  | "late_clock_in"
  | "break_start"
  | "break_end"
  | "extra_break"
  | "clock_out"
  | "timesheet_approved"

export interface AppNotification {
  id: string
  recipientRole: "business_owner" | "manager" | "management" | "employee" | "all"
  recipientUserId?: string
  employeeId?: string
  employeeName: string
  siteId: string
  siteName: string
  type: NotificationType
  title: string
  message: string
  timestamp: string // ISO string
  read: boolean
  isWarning?: boolean
  meta?: {
    scheduledTime?: string
    clockTime?: string
    minsLate?: number
    breakMinutesTaken?: number
    breakMinutesAllowed?: number
    extraBreakMinutes?: number
    link?: string
    actionText?: string
    weekStart?: string
    siteId?: string
    [key: string]: any
  }
}

