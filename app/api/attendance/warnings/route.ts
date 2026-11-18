import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getApiUser } from "@/lib/auth-guard"
import { logAuditEvent } from "@/lib/audit"
import { logger } from "@/lib/logger"
import { sendWarningIssuedEmail } from "@/lib/email-service"

// GET /api/attendance/warnings — List warnings
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get("employeeId")
    const date = searchParams.get("date")

    const where: any = {}
    if (employeeId) where.employeeId = employeeId
    if (date) where.date = date

    const warnings = await prisma.employeeWarning.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ success: true, warnings })
  } catch (error: any) {
    logger.error("GET /api/attendance/warnings", error)
    return NextResponse.json(
      { success: false, message: "Failed to fetch warnings." },
      { status: 500 }
    )
  }
}

// POST /api/attendance/warnings — Manager issues warning
export async function POST(request: Request) {
  try {
    const user = getApiUser(request)
    const body = await request.json()
    const { employeeId, attendanceRecordId, shiftId, date, reason, lateMinutes } = body

    if (!employeeId || !reason) {
      return NextResponse.json(
        { success: false, message: "employeeId and reason are required." },
        { status: 400 }
      )
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, firstName: true, lastName: true, email: true },
    })

    if (!employee) {
      return NextResponse.json(
        { success: false, message: "Employee not found." },
        { status: 404 }
      )
    }

    const managerName = user?.userName || "Manager"
    const managerRole = user?.role || "manager"
    const employeeName = `${employee.firstName} ${employee.lastName}`
    const todayIso = date || new Date().toISOString().slice(0, 10)

    const warning = await prisma.employeeWarning.create({
      data: {
        employeeId,
        attendanceRecordId: attendanceRecordId || null,
        shiftId: shiftId || null,
        date: todayIso,
        managerName,
        managerRole,
        lateMinutes: Number(lateMinutes) || 0,
        reason,
        acknowledged: false,
      },
    })

    // Log audit event
    await logAuditEvent({
      userName: managerName,
      role: (managerRole as any) || "manager",
      entity: "EmployeeWarning",
      action: "ISSUE_LATE_WARNING",
      newValue: `Issued warning to ${employeeName} for ${lateMinutes || 0} mins late on ${todayIso}. Reason: ${reason}`,
      reason,
      source: "Attendance Review",
    })

    // Notify employee in-app
    await prisma.appNotification.create({
      data: {
        recipientRole: "employee",
        recipientUserId: employeeId,
        employeeId,
        employeeName,
        siteId: "general",
        siteName: "Site",
        type: "warning_issued",
        title: `Formal Late Warning Issued (${lateMinutes || 0} mins late)`,
        message: `${managerName} issued a warning for lateness on ${todayIso}: "${reason}". Please acknowledge receipt.`,
        timestamp: new Date().toISOString(),
        read: false,
        isWarning: true,
        metaJson: JSON.stringify({
          warningId: warning.id,
          date: todayIso,
          lateMinutes,
          managerName,
          reason,
          actionText: "Acknowledge Warning",
        }),
      },
    })

    // Send email to employee
    if (employee.email) {
      sendWarningIssuedEmail({
        toEmail: employee.email,
        employeeName,
        date: todayIso,
        lateMinutes: Number(lateMinutes) || 0,
        managerName,
        reason,
      }).catch((err) => console.error("Failed to send warning email:", err))
    }

    return NextResponse.json({ success: true, warning })
  } catch (error: any) {
    logger.error("POST /api/attendance/warnings", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to issue warning." },
      { status: 500 }
    )
  }
}

// PUT /api/attendance/warnings — Employee acknowledges warning
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { warningId } = body

    if (!warningId) {
      return NextResponse.json(
        { success: false, message: "warningId is required." },
        { status: 400 }
      )
    }

    const updated = await prisma.employeeWarning.update({
      where: { id: warningId },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, warning: updated })
  } catch (error: any) {
    logger.error("PUT /api/attendance/warnings", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to acknowledge warning." },
      { status: 500 }
    )
  }
}
