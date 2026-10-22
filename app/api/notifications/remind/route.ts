import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendWeeklyApprovalEmailReminder } from "@/lib/email-service"

// POST /api/notifications/remind — Trigger weekly approval email reminder
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { siteId, weekStart } = body

    if (!siteId || !weekStart) {
      return NextResponse.json(
        { success: false, message: "siteId and weekStart are required." },
        { status: 400 }
      )
    }

    const location = await prisma.location.findUnique({
      where: { id: siteId },
      include: { businessOwner: true },
    })

    if (!location) {
      return NextResponse.json(
        { success: false, message: "Location not found." },
        { status: 404 }
      )
    }

    const targetEmail = location.email || location.businessOwner?.email || "manager@example.com"
    const targetName = location.businessOwner?.name || location.name

    const result = await sendWeeklyApprovalEmailReminder({
      toEmail: targetEmail,
      managerName: targetName,
      siteId,
      siteName: location.name,
      weekStart,
    })

    return NextResponse.json({
      success: result.success,
      message: result.message,
    })
  } catch (error: any) {
    console.error("POST /api/notifications/remind error:", error)
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    )
  }
}

// GET /api/notifications/remind — Get audit logs for reminders
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get("siteId")

    const logs = await prisma.notificationAuditLog.findMany({
      where: siteId ? { siteId } : undefined,
      orderBy: { sentAt: "desc" },
      take: 50,
    })

    return NextResponse.json({
      success: true,
      logs,
    })
  } catch (error: any) {
    console.error("GET /api/notifications/remind error:", error)
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    )
  }
}
