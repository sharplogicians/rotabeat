import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// POST /api/notifications/read — Mark notifications as read in DB
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { notificationId, markAll } = body

    if (markAll) {
      await prisma.appNotification.updateMany({
        data: { read: true },
      })
    } else if (notificationId) {
      await prisma.appNotification.updateMany({
        where: { id: notificationId },
        data: { read: true },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("POST /api/notifications/read error:", error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
