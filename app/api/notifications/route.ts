import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { runAllNotificationDetectors } from "@/lib/notifications-engine"

// GET /api/notifications?siteId=...&role=...&userId=...
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get("siteId")
    const role = searchParams.get("role") || "business_owner"
    const userId = searchParams.get("userId")

    // Run proactive issue detectors (missing punch, shift conflict, weekly approval due)
    await runAllNotificationDetectors().catch((err) =>
      console.error("Detector runner error:", err)
    )

    const notifications = await prisma.appNotification.findMany({
      where: { resolved: false },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    const isOwner = role === "business_owner" || role === "head_office"
    const isEmpRole = role === "employee"

    const filtered = notifications.filter((n) => {
      if (isOwner) {
        // Business Owner / Head Office receives notifications across all locations
        return (
          n.recipientRole === "business_owner" ||
          n.recipientRole === "management" ||
          n.recipientRole === "manager" ||
          n.recipientRole === "all"
        )
      }
      if (isEmpRole) {
        // Employee receives only their own notifications
        return n.recipientRole === "employee" && (n.recipientUserId === userId || n.employeeId === userId)
      }
      // Site Manager role: strictly scoped to the manager's assigned site
      return (
        n.siteId === siteId &&
        (n.recipientRole === "manager" || n.recipientRole === "management" || n.recipientRole === "all")
      )
    })

    const formatted = filtered.map((n) => ({
      id: n.id,
      recipientRole: n.recipientRole,
      recipientUserId: n.recipientUserId || undefined,
      employeeId: n.employeeId || undefined,
      employeeName: n.employeeName,
      siteId: n.siteId,
      siteName: n.siteName,
      type: n.type,
      title: n.title,
      message: n.message,
      timestamp: n.timestamp,
      read: n.read,
      resolved: n.resolved,
      isWarning: n.isWarning,
      meta: n.metaJson ? JSON.parse(n.metaJson) : undefined,
    }))

    return NextResponse.json({
      success: true,
      notifications: formatted,
    })
  } catch (error: any) {
    console.error("GET /api/notifications error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to fetch notifications." },
      { status: 500 }
    )
  }
}

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
    console.error("POST /api/notifications error:", error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}
