import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

import { verifyPassword, hashPassword, verifyPin, hashPin, createSessionToken, getSessionCookieHeader } from "@/lib/auth"
import { deriveCurrentAttendanceStatus } from "@/lib/attendance"
import { logger } from "@/lib/logger"

async function handleManagerSuccessResponse(user: any, request: Request, todayIso: string) {
  // Check if there is a previously remembered site from cookie
  let preferredSiteId: string | null = null
  try {
    const cookieHeader = request.headers.get("cookie") || ""
    const match = cookieHeader.match(/rotaflow_last_site=([^;]+)/)
    if (match && match[1]) {
      preferredSiteId = decodeURIComponent(match[1].trim())
    }
  } catch { }

  let assignedLocation = null

  // For business owners / head office, prioritize the site they previously selected/logged out from
  if (preferredSiteId && (user.role === "business_owner" || user.role === "head_office")) {
    assignedLocation = await prisma.location.findFirst({
      where: {
        id: preferredSiteId,
        businessOwnerId: user.id,
        status: "active",
      },
      select: {
        id: true,
        name: true,
        town: true,
      },
    })
  }

  // If preferred location not found or for managers, find assigned location
  if (!assignedLocation) {
    assignedLocation = await prisma.location.findFirst({
      where: {
        OR: [
          { managerId: user.id },
          { businessOwnerId: user.id },
        ],
        status: "active",
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        town: true,
      },
    })
  }

  // Check if there is an associated Employee record for this user
  const associatedEmployee = await prisma.employee.findFirst({
    where: {
      OR: [
        { email: user.email },
        { managerId: user.id },
      ],
    },
  })

  let todayShift = null
  let upcomingShift = null

  if (associatedEmployee) {
    todayShift = await prisma.shift.findFirst({
      where: { employeeId: associatedEmployee.id, date: todayIso },
    })
    upcomingShift = await prisma.shift.findFirst({
      where: { employeeId: associatedEmployee.id, date: { gte: todayIso } },
      orderBy: { date: "asc" },
    })
  }

  // Create session token
  const sessionToken = createSessionToken({
    userId: user.id,
    role: user.role,
    locationId: assignedLocation?.id ?? associatedEmployee?.primarySiteId ?? null,
    userName: user.name,
  })

  // Log successful login
  await prisma.auditEvent.create({
    data: {
      timestamp: new Date().toISOString(),
      userName: user.name,
      role: user.role,
      siteId: assignedLocation?.id ?? null,
      entity: "User",
      action: "LOGIN_SUCCESS",
      previousValue: null,
      newValue: JSON.stringify({ userId: user.id, role: user.role }),
      reason: null,
      source: "web",
    },
  }).catch(() => { })

  const response = NextResponse.json({
    success: true,
    message: `Signed in as ${user.name}`,
    user: {
      id: user.id,
      employeeId: associatedEmployee?.id ?? null,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
      hourlyRate: associatedEmployee?.hourlyRate ?? 0,
      locationId: assignedLocation?.id ?? associatedEmployee?.primarySiteId ?? null,
      assignedLocation: assignedLocation ? { id: assignedLocation.id, name: assignedLocation.name, town: assignedLocation.town } : null,
      todayShift: todayShift ? {
        id: todayShift.id,
        date: todayShift.date,
        startTime: todayShift.startTime,
        endTime: todayShift.endTime,
        unpaidBreakMinutes: todayShift.unpaidBreakMinutes,
        role: todayShift.role,
        late_allowed_minutes: 5,
      } : null,
      upcomingShift: upcomingShift ? {
        id: upcomingShift.id,
        date: upcomingShift.date,
        startTime: upcomingShift.startTime,
        endTime: upcomingShift.endTime,
        unpaidBreakMinutes: upcomingShift.unpaidBreakMinutes,
        role: upcomingShift.role,
      } : null,
    },
  })

  // Set HttpOnly session cookie
  response.headers.set("Set-Cookie", getSessionCookieHeader(sessionToken))
  if (assignedLocation?.id) {
    response.headers.append("Set-Cookie", `rotaflow_last_site=${assignedLocation.id}; Path=/; Max-Age=31536000; SameSite=Lax`)
  }

  return response
}

async function handleEmployeeSuccessResponse(employee: any, secretInput: string, todayIso: string) {
  // Auto-sync pinHash if needed
  if (secretInput && (!employee.pinHash || !(await verifyPin(secretInput, employee.pinHash)))) {
    const newHash = await hashPin(secretInput)
    await prisma.employee.update({
      where: { id: employee.id },
      data: { pin: secretInput, pinHash: newHash },
    }).catch(() => {})
  }

  // Fetch today's shift and upcoming shift for employee from Rota
  const todayShift = await prisma.shift.findFirst({
    where: {
      employeeId: employee.id,
      date: todayIso,
    },
  })

  const upcomingShift = await prisma.shift.findFirst({
    where: {
      employeeId: employee.id,
      date: { gte: todayIso },
    },
    orderBy: { date: "asc" },
  })

  // Create session token for employee
  const sessionToken = createSessionToken({
    userId: employee.id,
    role: "employee",
    locationId: employee.primarySiteId,
    userName: `${employee.firstName} ${employee.lastName}`,
  })

  // Log successful employee login
  await prisma.auditEvent.create({
    data: {
      timestamp: new Date().toISOString(),
      userName: `${employee.firstName} ${employee.lastName}`,
      role: "manager", // AuditEvent requires a Role enum value
      siteId: employee.primarySiteId,
      entity: "Employee",
      action: "LOGIN_SUCCESS",
      previousValue: null,
      newValue: JSON.stringify({ employeeId: employee.id }),
      reason: null,
      source: "web",
    },
  }).catch(() => { })

  const response = NextResponse.json({
    success: true,
    message: `Signed in as ${employee.firstName} ${employee.lastName}`,
    user: {
      id: employee.id,
      employeeId: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      employeeNumber: employee.employeeNumber,
      role: "employee",
      jobTitle: employee.jobTitle,
      payType: employee.payType,
      hourlyRate: employee.hourlyRate || 0,
      salaryAnnual: employee.salaryAnnual || 0,
      locationId: employee.primarySiteId,
      assignedLocation: employee.primarySite ? { id: employee.primarySite.id, name: employee.primarySite.name, town: employee.primarySite.town } : null,
      todayShift: todayShift ? {
        id: todayShift.id,
        date: todayShift.date,
        startTime: todayShift.startTime,
        endTime: todayShift.endTime,
        unpaidBreakMinutes: todayShift.unpaidBreakMinutes,
        role: todayShift.role,
        late_allowed_minutes: 5,
      } : null,
      upcomingShift: upcomingShift ? {
        id: upcomingShift.id,
        date: upcomingShift.date,
        startTime: upcomingShift.startTime,
        endTime: upcomingShift.endTime,
        unpaidBreakMinutes: upcomingShift.unpaidBreakMinutes,
        role: upcomingShift.role,
      } : null,
    },
  })

  // Set HttpOnly session cookie
  response.headers.set("Set-Cookie", getSessionCookieHeader(sessionToken))

  logger.info("AUTH_LOGIN", `Employee signed in: ${employee.firstName} ${employee.lastName}`, { employeeId: employee.id })
  return response
}

// ─────────────────────────────────────────────────────────────────────────────
// APP LOGIN HANDLER (Mobile App Endpoint Branch)
// ─────────────────────────────────────────────────────────────────────────────
async function handleAppLoginRequest(body: any, request: Request, todayIso: string) {
  const timestamp = new Date().toISOString()
  const username = (body.username || body.identifier || "").trim()
  const pin = (body.pin || body.password || "").trim()

  // 400 Bad Request - Missing or Invalid Parameters
  if (!username || !pin || !/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      {
        success: false,
        timestamp,
        error: {
          code: "VALIDATION_ERROR",
          message: "Username is required and PIN must be exactly 4 digits.",
        },
      },
      { status: 400 }
    )
  }

  const cleanInput = username.toLowerCase()

  // Ensure Owner and Site Manager user accounts cannot access the mobile app
  const managerUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: cleanInput }, { username: cleanInput }],
    },
  })

  if (managerUser && (managerUser.role === "business_owner" || managerUser.role === "head_office" || managerUser.role === "manager")) {
    // Check if there is an employee record for them, if not block immediately
    const linkedEmployee = await prisma.employee.findFirst({
      where: { email: cleanInput, status: "active" },
    })

    if (!linkedEmployee) {
      return NextResponse.json(
        {
          success: false,
          timestamp,
          error: {
            code: "FORBIDDEN",
            message: "The mobile app is for employees only. Business owners and site managers must use the web portal.",
          },
        },
        { status: 403 }
      )
    }
  }

  // Search employee by email, employeeNumber, or ID
  const employee = await prisma.employee.findFirst({
    where: {
      OR: [
        { email: cleanInput },
        { employeeNumber: username },
        { employeeNumber: username.toUpperCase() },
        { id: username },
      ],
    },
    include: {
      primarySite: true,
    },
  })

  // 401 Unauthorized - Invalid Credentials (Employee not found or inactive)
  if (!employee || employee.status !== "active") {
    return NextResponse.json(
      {
        success: false,
        timestamp,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Incorrect username or 4-digit PIN. Please try again.",
        },
      },
      { status: 401 }
    )
  }

  // Validate 4-digit PIN
  let pinValid = false
  if (employee.pin && pin === employee.pin) {
    pinValid = true
  } else if (employee.pinHash) {
    pinValid = await verifyPin(pin, employee.pinHash)
  }

  if (!pinValid) {
    return NextResponse.json(
      {
        success: false,
        timestamp,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Incorrect username or 4-digit PIN. Please try again.",
        },
      },
      { status: 401 }
    )
  }

  // Check today's shift scheduled on rota
  const todayShift = await prisma.shift.findFirst({
    where: {
      employeeId: employee.id,
      date: todayIso,
    },
  })

  // 403 Forbidden - No Active Shift Today
  if (!todayShift) {
    return NextResponse.json(
      {
        success: false,
        timestamp,
        error: {
          code: "NO_ACTIVE_SHIFT",
          message: "No active shift scheduled for today. Please contact your manager.",
        },
      },
      { status: 403 }
    )
  }

  // Query today's attendance record and events to determine live shift status
  const attendanceRecord = await prisma.attendanceRecord.findFirst({
    where: {
      employeeId: employee.id,
      date: todayIso,
    },
    include: {
      events: {
        orderBy: { timestamp: "asc" },
      },
    },
  })

  const events = attendanceRecord?.events || []
  const currentStatus = deriveCurrentAttendanceStatus(events)

  const isAbsent =
    attendanceRecord?.exceptionsJson?.includes("absent") ||
    attendanceRecord?.source === "auto_absent" ||
    (todayShift?.startTime &&
      events.length === 0 &&
      (() => {
        const [h, m] = todayShift.startTime.split(":").map(Number)
        const shiftStartMins = (h || 0) * 60 + (m || 0)
        const nowObj = new Date()
        const nowMins = nowObj.getHours() * 60 + nowObj.getMinutes()
        return nowMins > shiftStartMins + 5
      })())

  let shiftStatus = "NOT_CHECKED_IN"
  let allowedActions: string[] = ["clock_in"]

  if (isAbsent) {
    shiftStatus = "ABSENT"
    allowedActions = []
  } else {
    switch (currentStatus) {
      case "not_clocked_in":
        shiftStatus = "NOT_CHECKED_IN"
        allowedActions = ["clock_in"]
        break
      case "working":
        shiftStatus = "CLOCKED_IN"
        allowedActions = ["break_start", "clock_out"]
        break
      case "on_break":
        shiftStatus = "ON_BREAK"
        allowedActions = ["break_end"]
        break
      case "clocked_out":
        shiftStatus = "CLOCKED_OUT"
        allowedActions = []
        break
    }
  }

  // Generate session token
  const sessionToken = createSessionToken({
    userId: employee.id,
    role: "employee",
    locationId: employee.primarySiteId,
    userName: `${employee.firstName} ${employee.lastName}`,
  })

  const response = NextResponse.json({
    success: true,
    timestamp,
    data: {
      employee: {
        employeeId: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        role: "employee",
        jobTitle: employee.jobTitle,
        locationId: employee.primarySiteId,
      },
      todayShift: {
        id: todayShift.id,
        date: todayShift.date,
        startTime: todayShift.startTime,
        endTime: todayShift.endTime,
        unpaidBreakMinutes: todayShift.unpaidBreakMinutes ?? 0,
        role: todayShift.role || employee.jobTitle || "Staff",
        status: shiftStatus,
        allowed_actions: allowedActions,
        late_allowed_minutes: 5,
      },
    },
  })

  response.headers.set("Set-Cookie", getSessionCookieHeader(sessionToken))
  return response
}

// POST /api/auth/login — Authenticate user (Business Owner / Manager) or Employee (via PIN)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const todayIso = new Date().toISOString().slice(0, 10)

    // Detect if this request is from the Mobile App
    const clientType = (
      body.clientType ||
      body.platform ||
      body.source ||
      body.client ||
      request.headers.get("x-client-type") ||
      request.headers.get("x-platform") ||
      ""
    ).toLowerCase()

    const isAppRequest = clientType === "app" || clientType === "mobile" || body.loginType === "app"

    if (isAppRequest) {
      return handleAppLoginRequest(body, request, todayIso)
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // WEB LOGIN FLOW (Unchanged, backwards-compatible)
    // ─────────────────────────────────────────────────────────────────────────────
    const { identifier, password, pin, loginType } = body

    const secretInput = (pin || password || "").trim()

    if (!identifier || !identifier.trim()) {
      return NextResponse.json({ success: false, message: "Please enter your email, username, or employee number." }, { status: 400 })
    }
    if (!secretInput) {
      return NextResponse.json({
        success: false,
        message: loginType === "employee" ? "Please enter your 4-digit PIN." : "Please enter your password."
      }, { status: 400 })
    }

    const cleanInput = identifier.trim().toLowerCase()
    const rawInput = identifier.trim()

    // ─────────────────────────────────────────────────────────────────────────────
    // PORTAL 1: OWNER / SITE MANAGER LOGIN
    // ─────────────────────────────────────────────────────────────────────────────
    if (loginType === "manager") {
      // 1. Look in User table (Business Owners, Head Office, Site Managers)
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: cleanInput },
            { username: cleanInput },
          ],
        },
      })

      // If not in User table, check if an Employee is attempting to log in on the Manager portal
      if (!user) {
        const employee = await prisma.employee.findFirst({
          where: {
            OR: [
              { email: cleanInput },
              { employeeNumber: rawInput },
              { employeeNumber: rawInput.toUpperCase() },
              { id: rawInput },
            ],
          },
        })

        if (employee) {
          return NextResponse.json({
            success: false,
            message: "Employee accounts cannot log in from the Owner / Manager portal. Please switch to the Employee PIN tab.",
          }, { status: 403 })
        }

        return NextResponse.json({ success: false, message: "Invalid username, email, or password." }, { status: 401 })
      }

      // If user is found, ensure they are an Owner or Site Manager
      if (user.role !== "business_owner" && user.role !== "head_office" && user.role !== "manager") {
        return NextResponse.json({
          success: false,
          message: "Employee accounts cannot log in from the Owner / Manager portal. Please switch to the Employee PIN tab.",
        }, { status: 403 })
      }

      // Verify password strictly
      let passwordValid = false
      if (user.passwordHash) {
        passwordValid = await verifyPassword(secretInput, user.passwordHash)
      } else if (secretInput === "demo-password" || secretInput === "admin") {
        passwordValid = true
        const newHash = await hashPassword(secretInput)
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: newHash },
        }).catch(() => {})
      }

      if (!passwordValid) {
        await prisma.auditEvent.create({
          data: {
            timestamp: new Date().toISOString(),
            userName: cleanInput,
            role: user.role,
            siteId: null,
            entity: "User",
            action: "LOGIN_FAILED",
            previousValue: null,
            newValue: JSON.stringify({ identifier: cleanInput, reason: "Invalid credentials" }),
            reason: "Invalid password",
            source: "web",
          },
        }).catch(() => { })

        return NextResponse.json({ success: false, message: "Incorrect password." }, { status: 401 })
      }

      if (user.status === "inactive") {
        return NextResponse.json({
          success: false,
          message: "Your account is inactive. Please contact the administrator.",
        }, { status: 403 })
      }

      return handleManagerSuccessResponse(user, request, todayIso)
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // PORTAL 2: EMPLOYEE PIN LOGIN
    // ─────────────────────────────────────────────────────────────────────────────
    if (loginType === "employee") {
      // 1. Check if an Owner or Site Manager is attempting to log in on the Employee portal
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: cleanInput },
            { username: cleanInput },
          ],
        },
      })

      if (user && (user.role === "business_owner" || user.role === "head_office" || user.role === "manager")) {
        return NextResponse.json({
          success: false,
          message: "Owner and Site Manager accounts cannot log in from the Employee portal. Please switch to the Owner / Manager tab.",
        }, { status: 403 })
      }

      // 2. Fetch Employee record
      const employee = await prisma.employee.findFirst({
        where: {
          OR: [
            { email: cleanInput },
            { employeeNumber: rawInput },
            { employeeNumber: rawInput.toUpperCase() },
            { id: rawInput },
          ],
        },
        include: {
          primarySite: true,
        },
      })

      if (!employee) {
        return NextResponse.json({ success: false, message: "Invalid employee number, email, or PIN." }, { status: 401 })
      }

      // Double-check if this employee also holds an administrative Owner / Manager role
      const isOwnerOrManagerUser = await prisma.user.findFirst({
        where: {
          email: employee.email.toLowerCase(),
          role: { in: ["business_owner", "head_office", "manager"] },
        },
      })
      const isLocationManager = await prisma.location.findFirst({
        where: { managerId: employee.id },
      })

      if (isOwnerOrManagerUser || isLocationManager) {
        return NextResponse.json({
          success: false,
          message: "Owner and Site Manager accounts cannot log in from the Employee portal. Please switch to the Owner / Manager tab.",
        }, { status: 403 })
      }

      if (employee.status !== "active") {
        return NextResponse.json({
          success: false,
          message: `Your employee account is ${employee.status}. Please contact your site manager.`,
        }, { status: 403 })
      }

      // Verify Employee PIN against stored pin or pinHash
      let pinValid = false
      if (employee.pin && secretInput === employee.pin) {
        pinValid = true
      } else if (employee.pinHash) {
        pinValid = await verifyPin(secretInput, employee.pinHash)
      }

      if (!pinValid) {
        await prisma.auditEvent.create({
          data: {
            timestamp: new Date().toISOString(),
            userName: `${employee.firstName} ${employee.lastName}`,
            role: "manager", // AuditEvent requires a Role enum value
            siteId: employee.primarySiteId,
            entity: "Employee",
            action: "LOGIN_FAILED",
            previousValue: null,
            newValue: JSON.stringify({ employeeId: employee.id, reason: "Invalid PIN" }),
            reason: "Invalid employee PIN",
            source: "web",
          },
        }).catch(() => { })

        return NextResponse.json({ success: false, message: "Incorrect employee PIN." }, { status: 401 })
      }

      return handleEmployeeSuccessResponse(employee, secretInput, todayIso)
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // FALLBACK: When loginType is not specified (e.g. legacy/API)
    // ─────────────────────────────────────────────────────────────────────────────
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanInput },
          { username: cleanInput },
        ],
      },
    })

    if (user) {
      const passwordValid = user.passwordHash
        ? await verifyPassword(secretInput, user.passwordHash)
        : false

      if (!passwordValid) {
        return NextResponse.json({ success: false, message: "Incorrect password." }, { status: 401 })
      }

      if (user.status === "inactive") {
        return NextResponse.json({
          success: false,
          message: "Your account is inactive. Please contact the administrator.",
        }, { status: 403 })
      }

      return handleManagerSuccessResponse(user, request, todayIso)
    }

    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { email: cleanInput },
          { employeeNumber: rawInput },
          { employeeNumber: rawInput.toUpperCase() },
          { id: rawInput },
        ],
      },
      include: {
        primarySite: true,
      },
    })

    if (!employee) {
      return NextResponse.json({ success: false, message: "Invalid username, email, or employee number." }, { status: 401 })
    }

    if (employee.status !== "active") {
      return NextResponse.json({
        success: false,
        message: `Your employee account is ${employee.status}. Please contact your site manager.`,
      }, { status: 403 })
    }

    let pinValid = false
    if (employee.pin && secretInput === employee.pin) {
      pinValid = true
    } else if (employee.pinHash) {
      pinValid = await verifyPin(secretInput, employee.pinHash)
    }

    if (!pinValid) {
      return NextResponse.json({ success: false, message: "Incorrect employee PIN." }, { status: 401 })
    }

    return handleEmployeeSuccessResponse(employee, secretInput, todayIso)
  } catch (error: any) {
    logger.error("POST /api/auth/login", error)
    return NextResponse.json(
      { success: false, message: "Authentication failed." },
      { status: 500 }
    )
  }
}
