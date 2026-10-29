import type {
  AttendanceRecord,
  AuditEvent,
  Employee,
  OrgSettings,
  PayrollExport,
  Shift,
  Site,
  User,
  WeeklyApproval,
} from "./types"

// ---------------------------------------------------------------------------
// Sites (Exactly 2 Initial Clean Locations)
// ---------------------------------------------------------------------------

export const SITES: Site[] = [
  {
    id: "site-bright",
    name: "Bride Leeds Cafe",
    town: "Leeds",
    address: "14 Boar Lane, Leeds, LS1 5EL",
    city: "Leeds",
    postalCode: "LS1 5EL",
    country: "UK",
    phone: "+44 113 234 5678",
    email: "bright.leeds@northerntable.co.uk",
    managerId: "",
    businessOwnerId: "user-aisha",
    timeZone: "Europe/London",
    weekStart: "monday",
    status: "active",
    kiosks: [],
  },
  {
    id: "site-riverside",
    name: "Riverside Kitchen",
    town: "York",
    address: "8 Coney Street, York, YO1 9QL",
    city: "York",
    postalCode: "YO1 9QL",
    country: "UK",
    phone: "+44 190 456 7890",
    email: "riverside.york@northerntable.co.uk",
    managerId: "",
    businessOwnerId: "user-aisha",
    timeZone: "Europe/London",
    weekStart: "monday",
    status: "active",
    kiosks: [],
  },
]

// ---------------------------------------------------------------------------
// Users (1 Business Owner Account)
// ---------------------------------------------------------------------------

export const USERS: User[] = [
  {
    id: "user-aisha",
    firstName: "Aisha",
    lastName: "Khan",
    name: "Aisha Khan",
    email: "aisha.khan@northerntable.co.uk",
    username: "aishakhan",
    role: "business_owner",
    status: "active",
    siteIds: ["site-bright", "site-riverside"],
    avatarInitials: "AK",
  },
]

// ---------------------------------------------------------------------------
// Employees (Clean/Empty)
// ---------------------------------------------------------------------------

export const EMPLOYEES: Employee[] = []

// ---------------------------------------------------------------------------
// Shifts (Clean/Empty)
// ---------------------------------------------------------------------------

export const CURRENT_WEEK_SHIFTS: Shift[] = []
export const PREVIOUS_WEEK_SHIFTS: Shift[] = []
export const ALL_SHIFTS: Shift[] = []

// ---------------------------------------------------------------------------
// Attendance (Clean/Empty)
// ---------------------------------------------------------------------------

export const ALL_ATTENDANCE: AttendanceRecord[] = []

// ---------------------------------------------------------------------------
// Weekly approvals (Clean/Empty)
// ---------------------------------------------------------------------------

export const WEEKLY_APPROVALS: WeeklyApproval[] = []

// ---------------------------------------------------------------------------
// Payroll exports (Clean/Empty)
// ---------------------------------------------------------------------------

export const PAYROLL_EXPORTS: PayrollExport[] = []

// ---------------------------------------------------------------------------
// Audit log (Clean/Empty)
// ---------------------------------------------------------------------------

export const AUDIT_LOG: AuditEvent[] = []

// ---------------------------------------------------------------------------
// Organisation settings
// ---------------------------------------------------------------------------

export const ORG_SETTINGS: OrgSettings = {
  orgName: "",
  timeZone: "Europe/London",
  weekStart: "monday",
  defaultPayPeriod: "weekly",
  earlyClockInMinutes: 15,
  lateThresholdMinutes: 5,
  rounding: "5",
  breaksClocked: true,
  duplicateActionPrevention: true,
  overtimeEnabled: true,
  weeklyOvertimeThreshold: 40,
}
