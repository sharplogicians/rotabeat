import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"
 import { apiUrl } from '@/lib/api';

export interface LogAuditParams {
  userName?: string | null
  role?: string | null
  siteId?: string | null
  entity: string
  action: string
  previousValue?: any
  newValue?: any
  reason?: string | null
  source?: string
}

/**
 * Centrally logs an audit trail record to the AuditEvent table in MySQL.
 */
export async function logAuditEvent(params: LogAuditParams) {
  try {
    let safeRole: Role = Role.business_owner
    if (params.role === "manager") safeRole = Role.manager
    else if (params.role === "head_office") safeRole = Role.head_office
    else if (params.role === "kiosk") safeRole = Role.kiosk
    else if (params.role === "business_owner") safeRole = Role.business_owner

    const prevStr = params.previousValue != null
      ? (typeof params.previousValue === "string" ? params.previousValue : JSON.stringify(params.previousValue))
      : null

    const newStr = params.newValue != null
      ? (typeof params.newValue === "string" ? params.newValue : JSON.stringify(params.newValue))
      : null

    return await prisma.auditEvent.create({
      data: {
        timestamp: new Date().toISOString(),
        userName: params.userName || "System",
        role: safeRole,
        siteId: params.siteId || null,
        entity: params.entity,
        action: params.action,
        previousValue: prevStr,
        newValue: newStr,
        reason: params.reason || null,
        source: params.source || "web",
      },
    })
  } catch (err) {
    console.error("Failed to write audit event:", err)
    return null
  }
}
