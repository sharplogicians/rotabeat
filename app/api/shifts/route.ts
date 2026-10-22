import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { shiftSpanMinutes } from "@/lib/calc"
import { getApiUser, enforceSiteAccess } from "@/lib/auth-guard"
import { logAuditEvent } from "@/lib/audit"

// GET /api/shifts?siteId=...&weekStart=...
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rawSiteId = searchParams.get("siteId")
    const weekStart = searchParams.get("weekStart")
    const endDate = searchParams.get("endDate")

    const user = getApiUser(request)
    let effectiveSiteId = rawSiteId

    if (user) {
      try {
        effectiveSiteId = enforceSiteAccess(user, rawSiteId === "all" ? undefined : rawSiteId) || null
      } catch (err: any) {
        if (err instanceof Response || (err && err.status)) return err
      }
    }

    const where: any = {}
    if (effectiveSiteId && effectiveSiteId !== "all") where.siteId = effectiveSiteId
    if (weekStart && endDate) {
      where.date = { gte: weekStart, lte: endDate }
    }

    const shifts = await prisma.shift.findMany({
      where,
      orderBy: { date: "asc" },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            status: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, shifts })
  } catch (error: any) {
    console.error("GET /api/shifts error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to fetch shifts." },
      { status: 500 }
    )
  }
}

// POST /api/shifts — Create new shift
export async function POST(request: Request) {
  try {
    const user = getApiUser(request)
    const body = await request.json()
    const {
      employeeId,
      siteId,
      date,
      startTime,
      endTime,
      unpaidBreakMinutes,
      role,
      notes,
    } = body

    if (!employeeId) {
      return NextResponse.json({ success: false, message: "Please select an employee." }, { status: 400 })
    }
    if (!siteId) {
      return NextResponse.json({ success: false, message: "Primary site is required." }, { status: 400 })
    }
    if (!date) {
      return NextResponse.json({ success: false, message: "Shift date is required." }, { status: 400 })
    }
    if (!startTime) {
      return NextResponse.json({ success: false, message: "Please enter a start time." }, { status: 400 })
    }
    if (!endTime) {
      return NextResponse.json({ success: false, message: "Please enter an end time." }, { status: 400 })
    }

    // Site permission check
    if (user) {
      try {
        enforceSiteAccess(user, siteId)
      } catch (err: any) {
        if (err instanceof Response || (err && err.status)) return err
      }
    }

    const breakMins = Number(unpaidBreakMinutes) || 0
    if (breakMins < 0) {
      return NextResponse.json({ success: false, message: "Break duration cannot be negative." }, { status: 400 })
    }

    const spanMins = shiftSpanMinutes(startTime, endTime)
    if (breakMins > spanMins) {
      return NextResponse.json(
        { success: false, message: `Break duration (${breakMins}m) cannot exceed shift duration (${spanMins}m).` },
        { status: 400 }
      )
    }

    // Verify employee
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
    if (!employee) {
      return NextResponse.json({ success: false, message: "Employee not found." }, { status: 404 })
    }
    if (employee.status !== "active") {
      return NextResponse.json(
        { success: false, message: `Cannot assign shift: ${employee.firstName} ${employee.lastName} is ${employee.status}.` },
        { status: 400 }
      )
    }

    const shift = await prisma.shift.create({
      data: {
        employeeId,
        siteId,
        date,
        startTime,
        endTime,
        unpaidBreakMinutes: breakMins,
        role: (role || employee.jobTitle).trim(),
        notes: (notes || "").trim() || null,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            status: true,
          },
        },
      },
    })

    // Log Audit Event
    await logAuditEvent({
      userName: user?.userName || "Admin",
      role: user?.role,
      siteId,
      entity: "Shift",
      action: "CREATE_SHIFT",
      newValue: {
        id: shift.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        date,
        startTime,
        endTime,
        role: shift.role,
      },
      reason: "Shift scheduled",
    })

    return NextResponse.json({ success: true, shift }, { status: 201 })
  } catch (error: any) {
    console.error("POST /api/shifts error:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create shift in database." },
      { status: 500 }
    )
  }
}

// PUT /api/shifts — Update shift
export async function PUT(request: Request) {
  try {
    const user = getApiUser(request)
    const body = await request.json()
    const {
      id,
      employeeId,
      siteId,
      date,
      startTime,
      endTime,
      unpaidBreakMinutes,
      role,
      notes,
    } = body

    if (!id) {
      return NextResponse.json({ success: false, message: "Shift ID is required." }, { status: 400 })
    }

    const existingShift = await prisma.shift.findUnique({
      where: { id },
      include: { employee: true },
    })
    if (!existingShift) {
      return NextResponse.json({ success: false, message: "Shift not found." }, { status: 404 })
    }

    // Site permission check
    if (user) {
      try {
        enforceSiteAccess(user, existingShift.siteId)
        if (siteId && siteId !== existingShift.siteId) {
          enforceSiteAccess(user, siteId)
        }
      } catch (err: any) {
        if (err instanceof Response || (err && err.status)) return err
      }
    }

    const targetStartTime = startTime || existingShift.startTime
    const targetEndTime = endTime || existingShift.endTime
    const breakMins = unpaidBreakMinutes !== undefined ? Number(unpaidBreakMinutes) : existingShift.unpaidBreakMinutes

    if (breakMins < 0) {
      return NextResponse.json({ success: false, message: "Break duration cannot be negative." }, { status: 400 })
    }

    const spanMins = shiftSpanMinutes(targetStartTime, targetEndTime)
    if (breakMins > spanMins) {
      return NextResponse.json(
        { success: false, message: `Break duration (${breakMins}m) cannot exceed shift duration (${spanMins}m).` },
        { status: 400 }
      )
    }

    const shift = await prisma.shift.update({
      where: { id },
      data: {
        employeeId: employeeId || existingShift.employeeId,
        siteId: siteId || existingShift.siteId,
        date: date || existingShift.date,
        startTime: targetStartTime,
        endTime: targetEndTime,
        unpaidBreakMinutes: breakMins,
        role: role ? role.trim() : existingShift.role,
        notes: notes !== undefined ? notes.trim() || null : existingShift.notes,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            status: true,
          },
        },
      },
    })

    // Log Audit Event
    await logAuditEvent({
      userName: user?.userName || "Admin",
      role: user?.role,
      siteId: shift.siteId,
      entity: "Shift",
      action: "UPDATE_SHIFT",
      previousValue: {
        date: existingShift.date,
        startTime: existingShift.startTime,
        endTime: existingShift.endTime,
      },
      newValue: {
        id: shift.id,
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
      },
      reason: "Shift updated",
    })

    return NextResponse.json({ success: true, shift })
  } catch (error: any) {
    console.error("PUT /api/shifts error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to update shift in database." },
      { status: 500 }
    )
  }
}

// DELETE /api/shifts?id=...
export async function DELETE(request: Request) {
  try {
    const user = getApiUser(request)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ success: false, message: "Shift ID is required." }, { status: 400 })
    }

    const existingShift = await prisma.shift.findUnique({
      where: { id },
      include: { employee: true },
    })
    if (!existingShift) {
      return NextResponse.json({ success: false, message: "Shift not found." }, { status: 404 })
    }

    // Site permission check
    if (user) {
      try {
        enforceSiteAccess(user, existingShift.siteId)
      } catch (err: any) {
        if (err instanceof Response || (err && err.status)) return err
      }
    }

    await prisma.shift.delete({ where: { id } })

    // Log Audit Event
    await logAuditEvent({
      userName: user?.userName || "Admin",
      role: user?.role,
      siteId: existingShift.siteId,
      entity: "Shift",
      action: "DELETE_SHIFT",
      previousValue: {
        id: existingShift.id,
        employeeName: `${existingShift.employee.firstName} ${existingShift.employee.lastName}`,
        date: existingShift.date,
        startTime: existingShift.startTime,
        endTime: existingShift.endTime,
      },
      reason: "Shift deleted",
    })

    return NextResponse.json({ success: true, message: "Shift deleted successfully." })
  } catch (error: any) {
    console.error("DELETE /api/shifts error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to delete shift from database." },
      { status: 500 }
    )
  }
}
