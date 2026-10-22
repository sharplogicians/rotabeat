import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/attendance/[id]/audit
 * Fetch immutable audit history logs for a specific attendance record.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const audits = await prisma.attendanceAudit.findMany({
      where: { attendanceRecordId: id },
      orderBy: { changedAt: "desc" },
    })

    const formatted = audits.map((a) => ({
      id: a.id,
      attendanceRecordId: a.attendanceRecordId,
      employeeId: a.employeeId,
      changedBy: a.changedBy,
      changedAt: a.changedAt.toISOString(),
      action: a.action,
      changes: JSON.parse(a.changesJson || "[]"),
      reason: a.reason,
    }))

    return NextResponse.json({
      success: true,
      audits: formatted,
    })
  } catch (error: any) {
    console.error("GET /api/attendance/[id]/audit error:", error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
