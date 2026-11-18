import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getApiUser } from "@/lib/auth-guard"
import { logAuditEvent } from "@/lib/audit"
import { logger } from "@/lib/logger"
import { sendPayrollAdjustmentApprovedEmail } from "@/lib/email-service"

// GET /api/payroll/adjustments — List adjustments with filters
export async function GET(request: Request) {
  try {
    const user = getApiUser(request)
    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get("siteId")
    const employeeId = searchParams.get("employeeId")
    const status = searchParams.get("status")
    const date = searchParams.get("date")

    const where: any = {}
    if (siteId) where.siteId = siteId
    if (employeeId) where.employeeId = employeeId
    if (status) where.status = status
    if (date) where.date = date

    // Role-based scoping: Site managers only see adjustments for their assigned location
    if (user && user.role === "manager" && user.locationId) {
      where.siteId = user.locationId
    }

    const adjustments = await prisma.payrollAdjustment.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })

    // Fetch employee and site details for enriched display
    const employeeIds = [...new Set(adjustments.map((a) => a.employeeId))]
    const siteIds = [...new Set(adjustments.map((a) => a.siteId))]

    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, firstName: true, lastName: true, employeeNumber: true, email: true },
    })
    const empMap = new Map(employees.map((e) => [e.id, e]))

    const sites = await prisma.location.findMany({
      where: { id: { in: siteIds } },
      select: { id: true, name: true, town: true },
    })
    const siteMap = new Map(sites.map((s) => [s.id, `${s.name} (${s.town})`]))

    const formatted = adjustments.map((adj) => {
      const emp = empMap.get(adj.employeeId)
      return {
        ...adj,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
        employeeNumber: emp?.employeeNumber || "",
        siteName: siteMap.get(adj.siteId) || "Site",
      }
    })

    return NextResponse.json({
      success: true,
      adjustments: formatted,
    })
  } catch (error: any) {
    logger.error("GET /api/payroll/adjustments", error)
    return NextResponse.json(
      { success: false, message: "Failed to fetch payroll adjustments." },
      { status: 500 }
    )
  }
}

// POST /api/payroll/adjustments — Approve or Reject a proposed adjustment
export async function POST(request: Request) {
  try {
    const user = getApiUser(request)
    if (user && user.role === "employee") {
      return NextResponse.json(
        { success: false, message: "Forbidden: Employees cannot review adjustments." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { adjustmentId, action, reviewNotes, reviewedBy } = body

    if (!adjustmentId || !action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, message: "adjustmentId and action ('approve' or 'reject') are required." },
        { status: 400 }
      )
    }

    const adjustment = await prisma.payrollAdjustment.findUnique({
      where: { id: adjustmentId },
    })

    if (!adjustment) {
      return NextResponse.json(
        { success: false, message: "Payroll adjustment not found." },
        { status: 404 }
      )
    }

    const actor = user?.userName || reviewedBy || "Manager"
    const actorRole = (user?.role as any) || "manager"
    const nowIso = new Date().toISOString()
    const newStatus = action === "approve" ? "approved" : "rejected"

    const updated = await prisma.payrollAdjustment.update({
      where: { id: adjustmentId },
      data: {
        status: newStatus,
        reviewedBy: actor,
        reviewedAt: nowIso,
        reviewNotes: reviewNotes || null,
      },
    })

    // Fetch employee details
    const employee = await prisma.employee.findUnique({
      where: { id: adjustment.employeeId },
      select: { id: true, firstName: true, lastName: true, email: true },
    })
    const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : "Employee"

    // Log audit event
    await logAuditEvent({
      userName: actor,
      role: actorRole,
      siteId: adjustment.siteId,
      entity: "PayrollAdjustment",
      action: action === "approve" ? "APPROVE_LATE_DEDUCTION" : "REJECT_LATE_DEDUCTION",
      previousValue: `Status: ${adjustment.status}`,
      newValue: `Status: ${newStatus}, Deduction: £${adjustment.deductionAmount}, Notes: ${reviewNotes || "None"}`,
      reason: reviewNotes || (action === "approve" ? "Manager approved late time deduction" : "Manager waived late deduction"),
      source: "Payroll Adjustments",
    })

    // Notify employee of adjustment decision
    if (action === "approve") {
      await prisma.appNotification.create({
        data: {
          recipientRole: "employee",
          recipientUserId: adjustment.employeeId,
          employeeId: adjustment.employeeId,
          employeeName,
          siteId: adjustment.siteId,
          siteName: "Site",
          type: "payroll_deduction_approved",
          title: `Payroll Deduction Approved (-£${adjustment.deductionAmount})`,
          message: `Your late deduction of £${adjustment.deductionAmount} for shift on ${adjustment.date} (${adjustment.lateMinutes} mins unpaid late time) was approved by ${actor}.`,
          timestamp: nowIso,
          read: false,
          isWarning: true,
          metaJson: JSON.stringify({
            adjustmentId: updated.id,
            date: adjustment.date,
            deductionAmount: adjustment.deductionAmount,
            lateMinutes: adjustment.lateMinutes,
            hourlyRate: adjustment.hourlyRate,
            scheduledHours: adjustment.scheduledHours,
            workedHours: adjustment.workedHours,
            reviewedBy: actor,
            reviewNotes,
          }),
        },
      })

      // Send detailed email if employee has an email address
      if (employee?.email) {
        sendPayrollAdjustmentApprovedEmail({
          toEmail: employee.email,
          employeeName,
          date: adjustment.date,
          scheduledHours: adjustment.scheduledHours,
          workedHours: adjustment.workedHours,
          lateMinutes: adjustment.lateMinutes,
          hourlyRate: adjustment.hourlyRate,
          deductionAmount: adjustment.deductionAmount,
          managerName: actor,
          notes: reviewNotes,
        }).catch((err) => console.error("Failed to send adjustment email:", err))
      }
    }

    return NextResponse.json({
      success: true,
      adjustment: updated,
    })
  } catch (error: any) {
    logger.error("POST /api/payroll/adjustments", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to review payroll adjustment." },
      { status: 500 }
    )
  }
}
