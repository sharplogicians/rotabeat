import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { addDays } from "@/lib/date-utils"

// POST /api/rota/copy-previous — Copy shifts from previous week to new draft week
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { siteId, fromWeekStart, toWeekStart } = body

    if (!siteId || !fromWeekStart || !toWeekStart) {
      return NextResponse.json(
        { success: false, message: "siteId, fromWeekStart, and toWeekStart are required." },
        { status: 400 }
      )
    }

    // Get previous week date range (7 days)
    const fromEnd = addDays(fromWeekStart, 6)
    const toEnd = addDays(toWeekStart, 6)

    // Fetch shifts from previous week
    const previousShifts = await prisma.shift.findMany({
      where: {
        siteId,
        date: { gte: fromWeekStart, lte: fromEnd },
      },
    })

    if (previousShifts.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No shifts found in the previous week to copy.",
      }, { status: 400 })
    }

    // Delete existing shifts in target week to avoid duplicates
    await prisma.shift.deleteMany({
      where: {
        siteId,
        date: { gte: toWeekStart, lte: toEnd },
      },
    })

    // Calculate day offset in days
    const fromDate = new Date(fromWeekStart)
    const toDate = new Date(toWeekStart)
    const offsetDays = Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))

    // Map shifts to new dates
    const newShiftsData = previousShifts.map((s) => {
      const shiftDate = new Date(s.date)
      shiftDate.setDate(shiftDate.getDate() + offsetDays)
      const newDateStr = shiftDate.toISOString().slice(0, 10)

      return {
        employeeId: s.employeeId,
        siteId: s.siteId,
        date: newDateStr,
        startTime: s.startTime,
        endTime: s.endTime,
        unpaidBreakMinutes: s.unpaidBreakMinutes,
        role: s.role,
        notes: s.notes,
      }
    })

    // Create target shifts in DB
    await prisma.shift.createMany({
      data: newShiftsData,
    })

    // Ensure target week rota exists as Draft (PRD section 29 rule: target rota is always Draft)
    const targetRota = await prisma.rota.upsert({
      where: { siteId_weekStart: { siteId, weekStart: toWeekStart } },
      update: { status: "draft" },
      create: { siteId, weekStart: toWeekStart, status: "draft" },
    })

    const newShifts = await prisma.shift.findMany({
      where: {
        siteId,
        date: { gte: toWeekStart, lte: toEnd },
      },
    })

    return NextResponse.json({
      success: true,
      message: `Copied ${newShifts.length} shifts from previous week into target week as Draft.`,
      rota: targetRota,
      shifts: newShifts,
    })
  } catch (error: any) {
    console.error("POST /api/rota/copy-previous error:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to copy previous week's rota." },
      { status: 500 }
    )
  }
}
