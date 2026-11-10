import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getWeekStart } from "@/lib/date-utils"

// POST /api/shifts/copy — Copy an existing shift to another target date
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { shiftId, targetDate, targetEmployeeId } = body

    if (!shiftId || !targetDate) {
      return NextResponse.json(
        { success: false, message: "shiftId and targetDate are required." },
        { status: 400 }
      )
    }

    const sourceShift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: { employee: true },
    })

    if (!sourceShift) {
      return NextResponse.json({ success: false, message: "Source shift not found." }, { status: 404 })
    }

    const employeeId = targetEmployeeId || sourceShift.employeeId

    // Verify employee active status
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
    if (!employee) {
      return NextResponse.json({ success: false, message: "Target employee not found." }, { status: 404 })
    }
    if (employee.status !== "active") {
      return NextResponse.json(
        { success: false, message: `Cannot copy shift: ${employee.firstName} ${employee.lastName} is ${employee.status}.` },
        { status: 400 }
      )
    }

    const newShift = await prisma.shift.create({
      data: {
        employeeId,
        siteId: sourceShift.siteId,
        date: targetDate,
        startTime: sourceShift.startTime,
        endTime: sourceShift.endTime,
        unpaidBreakMinutes: sourceShift.unpaidBreakMinutes,
        role: sourceShift.role,
        notes: sourceShift.notes,
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

    // Mark the target week's rota as draft so copied shift can be published
    try {
      const targetWeekStart = getWeekStart(targetDate)
      await prisma.rota.upsert({
        where: { siteId_weekStart: { siteId: sourceShift.siteId, weekStart: targetWeekStart } },
        update: { status: "draft" },
        create: { siteId: sourceShift.siteId, weekStart: targetWeekStart, status: "draft" },
      })
    } catch (rotaErr) {
      console.error("Non-blocking error updating rota status to draft on shift copy:", rotaErr)
    }

    return NextResponse.json({
      success: true,
      message: `Copied shift to ${targetDate}`,
      shift: newShift,
    })
  } catch (error: any) {
    console.error("POST /api/shifts/copy error:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to copy shift." },
      { status: 500 }
    )
  }
}
