export type EmployeeAttendanceState = "not_clocked_in" | "working" | "on_break" | "clocked_out"

export type AttendanceActionType = "clock_in" | "break_start" | "break_end" | "clock_out"

export interface AttendanceValidationResult {
  valid: boolean
  error?: string
}

export interface ClockEventLike {
  type: string
  timestamp: string
  photo?: string | null
}

/**
 * Derives current attendance state for an employee based on ordered clock events.
 */
export function deriveCurrentAttendanceStatus(events: ClockEventLike[]): EmployeeAttendanceState {
  if (!events || events.length === 0) {
    return "not_clocked_in"
  }

  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  const lastEvent = sorted[sorted.length - 1]

  switch (lastEvent.type) {
    case "clock_in":
      return "working"
    case "break_start":
      return "on_break"
    case "break_end":
      return "working"
    case "clock_out":
      return "clocked_out"
    default:
      return "not_clocked_in"
  }
}

/**
 * Validates whether an attendance action is allowed for a given current status.
 * Enforces the PRD Backend Validation Matrix.
 */
export function validateAttendanceAction(
  currentStatus: EmployeeAttendanceState,
  action: AttendanceActionType,
  existingEvents?: ClockEventLike[]
): AttendanceValidationResult {
  switch (action) {
    case "clock_in": {
      if (currentStatus === "not_clocked_in") {
        return { valid: true }
      }
      if (currentStatus === "working" || currentStatus === "on_break") {
        return { valid: false, error: "You are already clocked in." }
      }
      if (currentStatus === "clocked_out") {
        return { valid: false, error: "This action has already been processed." }
      }
      return { valid: false, error: "Invalid action for current status." }
    }

    case "break_start": {
      // Employees are allowed only one break per shift
      if (existingEvents && existingEvents.some((e) => e.type === "break_start" || e.type === "break_end")) {
        return { valid: false, error: "Only one break is allowed per shift. You have already taken your break." }
      }
      if (currentStatus === "working") {
        return { valid: true }
      }
      if (currentStatus === "on_break") {
        return { valid: false, error: "You are already on break." }
      }
      if (currentStatus === "not_clocked_in" || currentStatus === "clocked_out") {
        return { valid: false, error: "You must clock in before performing this action." }
      }
      return { valid: false, error: "Invalid action for current status." }
    }

    case "break_end": {
      if (currentStatus === "on_break") {
        return { valid: true }
      }
      if (currentStatus === "working") {
        return { valid: false, error: "You are not currently on break." }
      }
      if (currentStatus === "not_clocked_in" || currentStatus === "clocked_out") {
        return { valid: false, error: "You must clock in before performing this action." }
      }
      return { valid: false, error: "Invalid action for current status." }
    }

    case "clock_out": {
      if (currentStatus === "working") {
        return { valid: true }
      }
      if (currentStatus === "on_break") {
        return { valid: false, error: "Please end your break before clocking out." }
      }
      if (currentStatus === "not_clocked_in") {
        return { valid: false, error: "You must clock in before performing this action." }
      }
      if (currentStatus === "clocked_out") {
        return { valid: false, error: "This action has already been processed." }
      }
      return { valid: false, error: "Invalid action for current status." }
    }

    default:
      return { valid: false, error: "Unknown attendance action." }
  }
}

/**
 * Returns human readable label for attendance states.
 */
export function getAttendanceStateLabel(status: EmployeeAttendanceState): string {
  switch (status) {
    case "not_clocked_in":
      return "Not Clocked In"
    case "working":
      return "Working"
    case "on_break":
      return "On Break"
    case "clocked_out":
      return "Clocked Out"
  }
}

/**
 * Returns human readable label for attendance actions.
 */
export function getAttendanceActionLabel(action: AttendanceActionType): string {
  switch (action) {
    case "clock_in":
      return "Clock In"
    case "break_start":
      return "Start Break"
    case "break_end":
      return "End Break"
    case "clock_out":
      return "Clock Out"
  }
}

/**
 * Returns standard confirmation heading according to PRD section 19.
 */
export function getSuccessConfirmationTitle(action: AttendanceActionType): string {
  switch (action) {
    case "clock_in":
      return "Clock In Successful"
    case "break_start":
      return "Break Started"
    case "break_end":
      return "Break Ended"
    case "clock_out":
      return "Clock Out Successful"
  }
}

/**
 * Returns the resulting status after an action is applied.
 */
export function getNextStateForAction(action: AttendanceActionType): EmployeeAttendanceState {
  switch (action) {
    case "clock_in":
    case "break_end":
      return "working"
    case "break_start":
      return "on_break"
    case "clock_out":
      return "clocked_out"
  }
}
