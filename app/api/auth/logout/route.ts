import { NextResponse } from "next/server"
import { getClearSessionCookieHeader } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getApiUser } from "@/lib/auth-guard"

// POST /api/auth/logout — Clear session cookie and log the event
export async function POST(request: Request) {
  try {
    const user = getApiUser(request)

    let siteId: string | null = null
    try {
      const body = await request.json()
      if (body?.siteId && typeof body.siteId === "string") {
        siteId = body.siteId
      }
    } catch { }

    if (!siteId) {
      try {
        const cookieHeader = request.headers.get("cookie") || ""
        const match = cookieHeader.match(/rotaflow_last_site=([^;]+)/)
        if (match && match[1]) siteId = decodeURIComponent(match[1].trim())
      } catch { }
    }

    const finalSiteId = siteId || user?.locationId || null

    // Log logout event if we know who is logging out
    if (user) {
      await prisma.auditEvent.create({
        data: {
          timestamp: new Date().toISOString(),
          userName: user.userName || user.id,
          role: user.role === "employee" ? "manager" : user.role as any,
          siteId: finalSiteId,
          entity: "User",
          action: "LOGOUT",
          previousValue: null,
          newValue: JSON.stringify({ userId: user.id }),
          reason: null,
          source: "web",
        },
      }).catch(() => {})
    }

    const response = NextResponse.json({
      success: true,
      message: "Signed out successfully.",
      lastSiteId: finalSiteId,
    })

    // Clear the session cookie
    response.headers.set("Set-Cookie", getClearSessionCookieHeader())

    // Remember the site from which user logged out
    if (finalSiteId) {
      response.headers.append("Set-Cookie", `rotaflow_last_site=${finalSiteId}; Path=/; Max-Age=31536000; SameSite=Lax`)
    }

    return response
  } catch (error: any) {
    console.error("POST /api/auth/logout error:", error)
    // Even on error, clear the cookie
    const response = NextResponse.json(
      { success: true, message: "Signed out." },
    )
    response.headers.set("Set-Cookie", getClearSessionCookieHeader())
    return response
  }
}
