import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getApiUser, enforceSiteAccess } from "@/lib/auth-guard"
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

// GET /api/approval?siteId=...&weekStart=...
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rawSiteId = searchParams.get("siteId")
    const weekStart = searchParams.get("weekStart")

    if (!rawSiteId || !weekStart) {
      return NextResponse.json(
        { success: false, message: "siteId and weekStart are required parameters." },
        { status: 400 }
      )
    }

    const user = getApiUser(request)
    let siteId = rawSiteId
    if (user) {
      try {
        siteId = enforceSiteAccess(user, rawSiteId) || rawSiteId
      } catch (err: any) {
        if (err instanceof Response || (err && err.status)) return err
      }
    }

    let approval = await prisma.weeklyApproval.findFirst({
      where: { siteId, weekStart },
    })

    if (!approval) {
      approval = await prisma.weeklyApproval.create({
        data: {
          siteId,
          weekStart,
          status: "open",
          reviewedEmployeeIds: "[]",
          ownerReviewedEmployeeIds: "[]",
          lastUpdatedBy: "System",
          lastUpdatedAt: new Date().toISOString(),
        },
      })
    }

    // Fetch audit history for this site and week
    const auditLogs = await prisma.auditEvent.findMany({
      where: { siteId },
      orderBy: { timestamp: "desc" },
      take: 20,
    })

    return NextResponse.json({
      success: true,
      approval: {
        ...approval,
        reviewedEmployeeIds: safeJsonParse<string[]>(approval.reviewedEmployeeIds, []),
        ownerReviewedEmployeeIds: safeJsonParse<string[]>(approval.ownerReviewedEmployeeIds, []),
        ownerReviewStarted: Boolean(approval.ownerReviewStarted),
        ownerReviewStartedAt: approval.ownerReviewStartedAt || undefined,
      },
      auditLogs,
    })
  } catch (error: any) {
    logger.error("GET /api/approval", error)
    return NextResponse.json(
      { success: false, message: "Failed to retrieve weekly approval record." },
      { status: 500 }
    )
  }
}

// POST /api/approval — Update status (start_review, approve, reopen, mark_reviewed)
export async function POST(request: Request) {
  try {
    const user = getApiUser(request)
    const body = await request.json()
    const { siteId, weekStart, action, actorName, actorRole, employeeId, reason } = body

    if (!siteId || !weekStart || !action) {
      return NextResponse.json(
        { success: false, message: "siteId, weekStart, and action are required." },
        { status: 400 }
      )
    }

    // Site permission check
    if (user) {
      try {
        enforceSiteAccess(user, siteId)
      } catch (err: any) {
        if (err instanceof Response || (err && err.status)) return err
      }
    }

    let approval = await prisma.weeklyApproval.findFirst({
      where: { siteId, weekStart },
    })

    const nowIso = new Date().toISOString()
    const actor = user?.userName || actorName || "System"
    const role = (actorRole as any) || user?.role || "manager"
    const isOwner = role === "business_owner" || role === "head_office"

    let managerReviewedIds: string[] = safeJsonParse<string[]>(approval?.reviewedEmployeeIds, [])
    let ownerReviewedIds: string[] = safeJsonParse<string[]>(approval?.ownerReviewedEmployeeIds, [])

    let newStatus = approval?.status || "open"
    let managerApprovedBy = approval?.managerApprovedBy || null
    let managerApprovedAt = approval?.managerApprovedAt || null
    let ownerReviewStarted = approval?.ownerReviewStarted || false
    let ownerReviewStartedAt = approval?.ownerReviewStartedAt || null
    let approvedBy = approval?.approvedBy || null
    let approvedAt = approval?.approvedAt || null
    let reopenedReason = approval?.reopenedReason || null
    let reopenedBy = approval?.reopenedBy || null
    let reopenedAt = approval?.reopenedAt || null
    let auditAction = ""
    let auditDetails = ""

    if (action === "start_review") {
      newStatus = "under_review"
      if (isOwner) {
        ownerReviewStarted = true
        ownerReviewStartedAt = nowIso
        auditAction = "START_OWNER_REVIEW"
        auditDetails = `Weekly review initiated by Business Owner ${actor} for week starting ${weekStart}`
      } else {
        auditAction = "START_REVIEW"
        auditDetails = `Weekly review initiated by ${actor} for week starting ${weekStart}`
      }
    } else if (action === "review_all") {
      const targetIds: string[] = Array.isArray(body.employeeIds) ? body.employeeIds : []
      const shouldReview = Boolean(body.reviewed)
      if (isOwner) {
        if (shouldReview) {
          ownerReviewedIds = Array.from(new Set([...ownerReviewedIds, ...targetIds]))
        } else {
          ownerReviewedIds = ownerReviewedIds.filter((id) => !targetIds.includes(id))
        }
        auditAction = "UPDATE_OWNER_REVIEW"
        auditDetails = shouldReview
          ? `Owner marked all ${targetIds.length} employees as reviewed`
          : `Owner unchecked all employee reviews`
      } else {
        if (shouldReview) {
          managerReviewedIds = Array.from(new Set([...managerReviewedIds, ...targetIds]))
        } else {
          managerReviewedIds = managerReviewedIds.filter((id) => !targetIds.includes(id))
        }
        auditAction = "UPDATE_MANAGER_REVIEW"
        auditDetails = shouldReview
          ? `Manager marked all ${targetIds.length} employees as reviewed`
          : `Manager unchecked all employee reviews`
      }
    } else if (action === "toggle_reviewed" && employeeId) {
      const emp = await prisma.employee.findUnique({ where: { id: employeeId } })
      const empName = emp ? `${emp.firstName} ${emp.lastName}` : employeeId
      if (isOwner) {
        if (ownerReviewedIds.includes(employeeId)) {
          ownerReviewedIds = ownerReviewedIds.filter((id) => id !== employeeId)
        } else {
          ownerReviewedIds.push(employeeId)
        }
        auditAction = "UPDATE_OWNER_REVIEW"
        auditDetails = `Owner toggled review check for ${empName}`
      } else {
        if (managerReviewedIds.includes(employeeId)) {
          managerReviewedIds = managerReviewedIds.filter((id) => id !== employeeId)
        } else {
          managerReviewedIds.push(employeeId)
        }
        auditAction = "UPDATE_MANAGER_REVIEW"
        auditDetails = `Manager toggled review check for ${empName}`
      }
    } else if (action === "approve") {
      if (isOwner) {
        newStatus = "approved"
        approvedBy = actor
        approvedAt = nowIso
        auditAction = "APPROVE_WEEK_FINAL"
        auditDetails = `Weekly timesheet granted final approval and locked by Business Owner ${actor}`
      } else {
        newStatus = "under_review"
        managerApprovedBy = actor
        managerApprovedAt = nowIso
        auditAction = "APPROVE_WEEK_MANAGER"
        auditDetails = `Weekly timesheet reviewed and approved by Site Manager ${actor}. Sent to Business Owner for final approval.`

        // Fetch location details for notification message
        const location = await prisma.location.findUnique({ where: { id: siteId } })
        const siteName = location ? `${location.name} (${location.town})` : "Site"

        // Create notification targeting Business Owner
        await prisma.appNotification.create({
          data: {
            recipientRole: "business_owner",
            siteId,
            siteName,
            type: "timesheet_approved",
            title: "Ready for Owner Approval",
            message: `${actor} (Site Manager) has reviewed and approved the weekly timesheet for ${siteName} (Week of ${weekStart}). Ready for final approval.`,
            timestamp: nowIso,
            read: false,
            employeeName: actor,
            metaJson: JSON.stringify({
              siteId,
              weekStart,
              link: "/approval",
              actionText: "Review Approval",
            }),
          },
        })
      }
    } else if (action === "reopen") {
      if (!reason || !reason.trim()) {
        return NextResponse.json(
          { success: false, message: "A mandatory audit reason is required to reopen an approved week." },
          { status: 400 }
        )
      }
      newStatus = "under_review"
      reopenedReason = reason.trim()
      reopenedBy = actor
      reopenedAt = nowIso
      auditAction = "REOPEN_WEEK"
      auditDetails = `Approved week reopened by ${actor}. Reason: ${reason.trim()}`
    } else if (action === "exported") {
      newStatus = "exported"
      auditAction = "EXPORT_WEEK"
      auditDetails = `Approved week finalized and exported by ${actor}`
    } else {
      return NextResponse.json(
        { success: false, message: "Invalid approval action provided." },
        { status: 400 }
      )
    }

    if (!approval) {
      approval = await prisma.weeklyApproval.create({
        data: {
          siteId,
          weekStart,
          status: newStatus as any,
          reviewedEmployeeIds: JSON.stringify(managerReviewedIds),
          ownerReviewedEmployeeIds: JSON.stringify(ownerReviewedIds),
          managerApprovedBy,
          managerApprovedAt,
          ownerReviewStarted,
          ownerReviewStartedAt,
          approvedBy,
          approvedAt,
          reopenedReason,
          reopenedBy,
          reopenedAt,
          lastUpdatedBy: actor,
          lastUpdatedAt: nowIso,
        },
      })
    } else {
      approval = await prisma.weeklyApproval.update({
        where: { id: approval.id },
        data: {
          status: newStatus as any,
          reviewedEmployeeIds: JSON.stringify(managerReviewedIds),
          ownerReviewedEmployeeIds: JSON.stringify(ownerReviewedIds),
          managerApprovedBy,
          managerApprovedAt,
          ownerReviewStarted,
          ownerReviewStartedAt,
          approvedBy,
          approvedAt,
          reopenedReason,
          reopenedBy,
          reopenedAt,
          lastUpdatedBy: actor,
          lastUpdatedAt: nowIso,
        },
      })
    }

    // Log Audit Event in DB
    if (auditAction) {
      await logAuditEvent({
        userName: actor,
        role: role as any,
        siteId,
        entity: "Weekly Approval",
        action: auditAction,
        newValue: auditDetails,
        reason: reason ? reason.trim() : null,
        source: "Weekly Review & Approval",
      })
    }

    // Auto-resolve approval warnings when week is approved or exported
    if (newStatus === "approved" || newStatus === "exported") {
      const { autoResolveNotifications } = await import("@/lib/notifications-engine")
      await autoResolveNotifications({ siteId, weekStart })
    }

    return NextResponse.json({
      success: true,
      approval: {
        ...approval,
        reviewedEmployeeIds: managerReviewedIds,
        ownerReviewedEmployeeIds: ownerReviewedIds,
        ownerReviewStarted: Boolean(approval.ownerReviewStarted),
        ownerReviewStartedAt: approval.ownerReviewStartedAt || undefined,
      },
    })
  } catch (error: any) {
    logger.error("POST /api/approval", error)
    return NextResponse.json(
      { success: false, message: "Failed to update weekly approval." },
      { status: 500 }
    )
  }
}
