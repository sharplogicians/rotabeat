import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getApiUser } from "@/lib/auth-guard"
import { logAuditEvent } from "@/lib/audit"
import { logger } from "@/lib/logger"

function safeJsonParse<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback
  try {
    const parsed = JSON.parse(val)
    return Array.isArray(fallback) ? (Array.isArray(parsed) ? parsed : fallback) : parsed
  } catch {
    return fallback
  }
}

// GET /api/payroll — Fetch payroll export history from DB
export async function GET(request: Request) {
  try {
    const user = getApiUser(request)
    if (user && user.role === "employee") {
      return NextResponse.json(
        { success: false, message: "Access Denied: Employees cannot access payroll exports." },
        { status: 403 }
      )
    }

    const isManager = user?.role === "manager"
    const managerSiteId = user?.locationId

    const exports = await prisma.payrollExport.findMany({
      orderBy: { generatedAt: "desc" },
    })

    const formatted = exports
      .map((exp) => ({
        id: exp.id,
        payPeriodLabel: exp.payPeriodLabel,
        weekStart: exp.weekStart,
        siteIds: safeJsonParse<string[]>(exp.siteIdsJson, []),
        employeeCount: exp.employeeCount,
        totalPayableHours: exp.totalPayableHours,
        generatedBy: exp.generatedBy,
        generatedAt: exp.generatedAt,
        status: exp.status,
        csvData: exp.csvData,
      }))
      .filter((exp) => {
        if (!isManager || !managerSiteId) return true
        return exp.siteIds.includes(managerSiteId)
      })

    return NextResponse.json({
      success: true,
      exports: formatted,
    })
  } catch (error: any) {
    logger.error("GET /api/payroll", error)
    return NextResponse.json(
      { success: false, message: "Failed to fetch payroll export history." },
      { status: 500 }
    )
  }
}

// POST /api/payroll — Save new payroll export in DB and update weekly approval status to exported
export async function POST(request: Request) {
  try {
    const user = getApiUser(request)
    if (user && user.role === "employee") {
      return NextResponse.json(
        { success: false, message: "Access Denied: Employees cannot generate payroll exports." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      payPeriodLabel,
      weekStart,
      siteIds,
      employeeCount,
      totalPayableHours,
      generatedBy,
      csvData,
    } = body

    if (!weekStart || !siteIds || !Array.isArray(siteIds) || siteIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "weekStart and siteIds array are required." },
        { status: 400 }
      )
    }

    // Site Manager isolation check: Managers can only generate exports for their assigned location
    if (user && user.role === "manager" && user.locationId) {
      const unauthorizedSite = siteIds.find((sid) => sid !== user.locationId)
      if (unauthorizedSite) {
        return NextResponse.json(
          { success: false, message: "Forbidden: You can only generate payroll exports for your assigned site." },
          { status: 403 }
        )
      }
    }

    const nowIso = new Date().toISOString()
    const expId = `EXP-${Math.floor(100 + Math.random() * 900)}`
    const actor = user?.userName || generatedBy || "System"
    const actorRole = (user?.role as any) || "manager"

    // Create payroll export record in DB
    const newExport = await prisma.payrollExport.create({
      data: {
        id: expId,
        payPeriodLabel: payPeriodLabel || `Week of ${weekStart}`,
        weekStart,
        siteIdsJson: JSON.stringify(siteIds),
        employeeCount: Number(employeeCount) || 0,
        totalPayableHours: Number(totalPayableHours) || 0,
        generatedBy: actor,
        generatedAt: nowIso,
        status: "completed",
        csvData: csvData || "",
      },
    })

    // Update status to 'exported' for each weekly approval entry
    for (const siteId of siteIds) {
      await prisma.weeklyApproval.updateMany({
        where: { siteId, weekStart },
        data: {
          status: "exported",
          lastUpdatedBy: actor,
          lastUpdatedAt: nowIso,
        },
      })

      // Log Audit event
      await logAuditEvent({
        userName: actor,
        role: actorRole,
        siteId,
        entity: "PayrollExport",
        action: "EXPORT_PAYROLL",
        newValue: `Generated payroll export ${expId} for ${siteId} (${employeeCount} employees, ${totalPayableHours} hrs)`,
        reason: "Payroll CSV export generated",
        source: "Payroll Exports",
      })
    }

    const formattedExport = {
      id: newExport.id,
      payPeriodLabel: newExport.payPeriodLabel,
      weekStart: newExport.weekStart,
      siteIds: safeJsonParse<string[]>(newExport.siteIdsJson, []),
      employeeCount: newExport.employeeCount,
      totalPayableHours: newExport.totalPayableHours,
      generatedBy: newExport.generatedBy,
      generatedAt: newExport.generatedAt,
      status: newExport.status,
      csvData: newExport.csvData,
    }

    return NextResponse.json({
      success: true,
      export: formattedExport,
    })
  } catch (error: any) {
    logger.error("POST /api/payroll", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to generate payroll export." },
      { status: 500 }
    )
  }
}
