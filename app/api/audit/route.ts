import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logAuditEvent } from "@/lib/audit"
import { logger } from "@/lib/logger"

/**
 * GET /api/audit
 * Fetch system audit events with filtering and pagination.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)))
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
        const offset = (page - 1) * limit

        const entity = searchParams.get("entity")
        const action = searchParams.get("action")
        const siteId = searchParams.get("siteId")
        const dateFrom = searchParams.get("dateFrom")
        const dateTo = searchParams.get("dateTo")
        const search = searchParams.get("search") || searchParams.get("q")

        const where: any = {}

        if (entity && entity !== "all") {
            where.entity = entity
        }

        if (action && action !== "all") {
            where.action = action
        }

        if (siteId && siteId !== "all") {
            where.siteId = siteId
        }

        if (dateFrom || dateTo) {
            where.timestamp = {}
            if (dateFrom) {
                where.timestamp.gte = dateFrom
            }
            if (dateTo) {
                // If YYYY-MM-DD, extend to end of day
                where.timestamp.lte = dateTo.includes("T") ? dateTo : `${dateTo}T23:59:59.999Z`
            }
        }

        if (search && search.trim()) {
            const q = search.trim()
            where.OR = [
                { userName: { contains: q } },
                { action: { contains: q } },
                { entity: { contains: q } },
                { reason: { contains: q } },
                { newValue: { contains: q } },
            ]
        }

        const [total, events] = await Promise.all([
            prisma.auditEvent.count({ where }),
            prisma.auditEvent.findMany({
                where,
                orderBy: { timestamp: "desc" },
                take: limit,
                skip: offset,
            }),
        ])

        const formattedLogs = events.map((e) => {
            let parsedNewValue: any = e.newValue
            let parsedPrevValue: any = e.previousValue
            try {
                if (typeof e.newValue === "string" && (e.newValue.startsWith("{") || e.newValue.startsWith("["))) {
                    parsedNewValue = JSON.parse(e.newValue)
                }
            } catch { }
            try {
                if (typeof e.previousValue === "string" && (e.previousValue.startsWith("{") || e.previousValue.startsWith("["))) {
                    parsedPrevValue = JSON.parse(e.previousValue)
                }
            } catch { }

            return {
                id: e.id,
                timestamp: e.timestamp,
                userName: e.userName,
                role: e.role,
                siteId: e.siteId,
                entity: e.entity,
                action: e.action,
                previousValue: parsedPrevValue,
                newValue: parsedNewValue,
                reason: e.reason,
                source: e.source,
            }
        })

        return NextResponse.json({
            success: true,
            total,
            page,
            limit,
            count: formattedLogs.length,
            logs: formattedLogs,
        })
    } catch (error: any) {
        logger.error("GET /api/audit error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Failed to fetch audit logs." },
            { status: 500 }
        )
    }
}

/**
 * POST /api/audit
 * Create an audit log entry.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { userName, role, siteId, entity, action, previousValue, newValue, reason, source } = body

        if (!entity || !action) {
            return NextResponse.json(
                { success: false, message: "entity and action are required." },
                { status: 400 }
            )
        }

        const created = await logAuditEvent({
            userName: userName || "App User",
            role: role || "employee",
            siteId: siteId || null,
            entity,
            action,
            previousValue,
            newValue,
            reason,
            source: source || "mobile_app",
        })

        return NextResponse.json({
            success: true,
            message: "Audit log recorded successfully.",
            log: created,
        })
    } catch (error: any) {
        logger.error("POST /api/audit error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Failed to record audit log." },
            { status: 500 }
        )
    }
}