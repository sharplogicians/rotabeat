import { NextResponse } from "next/server"
import { runAllNotificationDetectors } from "@/lib/notifications-engine"
import {
  sendUpcomingShiftReminders,
  sendWeeklyApprovalDueReminder,
} from "@/lib/automated-emails"
import { prisma } from "@/lib/prisma"

// GET or POST /api/cron/reminders — Run background notification detectors & automated emails
export async function GET() {
  return handleCron()
}

export async function POST() {
  return handleCron()
}

async function handleCron() {
  try {
    // 1. Run all existing detectors (missed punch, late absence alerts, shift conflicts, weekly approvals)
    await runAllNotificationDetectors()

    // 2. Upcoming shift reminders for tomorrow
    const upcomingResult = await sendUpcomingShiftReminders()

    // 3. Scan open weekly approvals and send reminders
    const openApprovals = await prisma.weeklyApproval.findMany({
      where: {
        status: { in: ["open", "under_review"] },
      },
    })

    let weeklyRemindersSent = 0
    for (const app of openApprovals) {
      const res = await sendWeeklyApprovalDueReminder({
        siteId: app.siteId,
        weekStart: app.weekStart,
      })
      weeklyRemindersSent += res.sentCount
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      upcomingShiftRemindersSent: upcomingResult.sentCount,
      weeklyApprovalRemindersSent: weeklyRemindersSent,
    })
  } catch (error: any) {
    console.error("Cron reminders error:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to process reminders." },
      { status: 500 }
    )
  }
}

