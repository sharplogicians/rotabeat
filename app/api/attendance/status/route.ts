import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { deriveCurrentAttendanceStatus, getAttendanceStateLabel } from "@/lib/attendance"


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get("employeeId")

    if (!employeeId) {
      return NextResponse.json(
        { success: false, message: "Employee ID or email is required." },
        { status: 400 }
      )
    }

    const cleanInput = employeeId.trim().toLowerCase()
    const rawInput = employeeId.trim()

    // 1. Search Employee by id, email, or employeeNumber
    let employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { id: rawInput },
          { email: cleanInput },
          { employeeNumber: rawInput },
          { employeeNumber: rawInput.toUpperCase() },
        ],
      },
      include: { primarySite: true },
    })

    // 2. If not found, check if input belongs to a User record
    if (!employee) {
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ id: rawInput }, { email: cleanInput }],
        },
      })
      if (user) {
        employee = await prisma.employee.findFirst({
          where: {
            OR: [
              { email: user.email },
              { managerId: user.id },
            ],
          },
          include: { primarySite: true },
        })
      }
    }

    // 3. Fallback: fetch first active employee if still not found
    if (!employee) {
      employee = await prisma.employee.findFirst({
        where: { status: "active" },
        include: { primarySite: true },
      })
    }

    if (!employee) {
      return NextResponse.json(
        { success: false, message: "No active employee record found." },
        { status: 404 }
      )
    }

    const dateIso = new Date().toLocaleDateString("en-CA")

    // Today's attendance record & clock events
    const attendanceRecord = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId: employee.id,
        date: dateIso,
      },
      include: {
        events: {
          orderBy: { timestamp: "asc" },
        },
      },
    })

    const events = attendanceRecord?.events || []
    let status = deriveCurrentAttendanceStatus(events)

    // Today's shift from Rota
    const todayShift = await prisma.shift.findFirst({
      where: {
        employeeId: employee.id,
        date: dateIso,
      },
    })

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

    if (isAbsent && events.length === 0) {
      status = "absent" as any
    }

    // Next / upcoming shift on or after today
    let upcomingShift = await prisma.shift.findFirst({
      where: {
        employeeId: employee.id,
        date: { gte: dateIso },
      },
      orderBy: { date: "asc" },
    })

    // Demo fallback for Rota shift dates (e.g. August 2026)
    if (!todayShift && !upcomingShift) {
      upcomingShift = await prisma.shift.findFirst({
        where: {
          employeeId: employee.id,
        },
        orderBy: { date: "asc" },
      })
    }

    return NextResponse.json({
      success: true,
      employee: {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        firstName: employee.firstName,
        lastName: employee.lastName,
        employeeNumber: employee.employeeNumber,
        jobTitle: employee.jobTitle,
        siteName: employee.primarySite?.name || "Main Location",
        siteId: employee.primarySiteId,
        hourlyRate: employee.hourlyRate || 0,
        payType: employee.payType,
        profileImage: employee.profileImage || null,
        faceEmbedding: employee.faceEmbedding || null,
      },
      currentStatus: status,
      currentStatusLabel: status === ("absent" as any) ? "Absent" : getAttendanceStateLabel(status),
      isAbsent: status === ("absent" as any),
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
      events,
      date: dateIso,
    })
  } catch (error: any) {
    console.error("GET /api/attendance/status error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to fetch attendance status." },
      { status: 500 }
    )
  }
}
