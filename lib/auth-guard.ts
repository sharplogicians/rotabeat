import { NextResponse } from "next/server"
 import { apiUrl } from '@/lib/api';

export interface AuthUser {
  id: string
  role: "business_owner" | "head_office" | "manager" | "kiosk" | "employee"
  locationId?: string | null
  userName?: string
}

/**
 * Validates route access based on user role.
 * Employees can ONLY access their attendance clock portal (/attendance/clock).
 * Business Owners, Head Office, & Managers can access management routes.
 */
export function canAccessRoute(role: string, pathname: string): boolean {
  if (role === "employee") {
    if (pathname === "/attendance/clock" || pathname === "/dashboard" || pathname === "/login") {
      return true
    }
    return false
  }
  return true
}

/**
 * Validates if the authenticated user has permission to access the requested location ID.
 * Business Owner / Head Office -> Access to all locations.
 * Manager -> Access ONLY to their single assigned location ID.
 */
export function validateLocationAccess(user: AuthUser, requestedLocationId?: string | null): { allowed: boolean; response?: NextResponse } {
  if (user.role === "business_owner" || user.role === "head_office") {
    return { allowed: true }
  }

  if (user.role === "manager") {
    if (!user.locationId || !requestedLocationId) {
      return {
        allowed: false,
        response: NextResponse.json({
          success: false,
          message: "Access Denied: Unassigned or invalid location.",
        }, { status: 403 }),
      }
    }

    if (user.locationId !== requestedLocationId) {
      return {
        allowed: false,
        response: NextResponse.json({
          success: false,
          message: "Access Denied: You are not authorized to view or manage this location.",
        }, { status: 403 }),
      }
    }

    return { allowed: true }
  }

  if (user.role === "employee") {
    return {
      allowed: false,
      response: NextResponse.json({
        success: false,
        message: "Access Denied: Employees can only access their attendance portal.",
      }, { status: 403 }),
    }
  }

  return {
    allowed: false,
    response: NextResponse.json({
      success: false,
      message: "Access Denied: Unauthorized role.",
    }, { status: 403 }),
  }
}

// ─── Server-side API Auth Enforcement ────────────────────────────────────────

import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth"

/**
 * Extracts the authenticated user from proxy-injected headers or direct cookie.
 * Returns the AuthUser or null if not authenticated.
 * Call this at the top of every protected API route handler.
 */
export function getApiUser(request: Request): AuthUser | null {
  // 1. Check proxy-injected headers
  const userId = request.headers.get("x-user-id")
  const userRole = request.headers.get("x-user-role")
  const userName = request.headers.get("x-user-name")
  const userSite = request.headers.get("x-user-site")

  if (userId && userRole) {
    return {
      id: userId,
      role: userRole as AuthUser["role"],
      locationId: userSite || null,
      userName: userName || undefined,
    }
  }

  // 2. Direct Cookie Fallback (Guarantees authentication works even if proxy headers are bypassed)
  try {
    const cookieHeader = request.headers.get("cookie") || ""
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`))
    if (match && match[1]) {
      const session = verifySessionToken(match[1])
      if (session) {
        return {
          id: session.userId,
          role: session.role as AuthUser["role"],
          locationId: session.locationId || null,
          userName: session.userName,
        }
      }
    }
  } catch {}

  return null
}

/**
 * Extracts the authenticated user from proxy-injected headers.
 * Returns the AuthUser or throws a 401 JSON response.
 */
export function enforceApiAuth(request: Request): AuthUser {
  const user = getApiUser(request)
  if (!user) {
    throw NextResponse.json(
      { success: false, message: "Authentication required." },
      { status: 401 }
    )
  }
  return user
}

/**
 * Enforces site-based data isolation.
 * Business Owners / Head Office can access any site.
 * Managers can only access their assigned site.
 * If the manager's assigned site doesn't match the requested siteId, throws 403.
 * Returns the effective siteId to use in queries (manager's site for managers, passed siteId for owners).
 */
export function enforceSiteAccess(user: AuthUser, requestedSiteId?: string | null): string | undefined {
  // Business owners and head office can access any site
  if (user.role === "business_owner" || user.role === "head_office") {
    return requestedSiteId || undefined
  }

  // Managers are always scoped to their assigned location
  if (user.role === "manager") {
    if (!user.locationId) {
      throw NextResponse.json(
        { success: false, message: "Access Denied: No site assigned to your account." },
        { status: 403 }
      )
    }

    // If a siteId was requested, verify it matches the manager's site
    if (requestedSiteId && requestedSiteId !== user.locationId) {
      throw NextResponse.json(
        { success: false, message: "Access Denied: You can only access data for your assigned site." },
        { status: 403 }
      )
    }

    // Always return the manager's assigned site
    return user.locationId
  }

  // Kiosk and employee roles — return the requested site if provided
  return requestedSiteId || undefined
}
