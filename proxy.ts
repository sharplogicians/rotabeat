import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSessionFromRequest, SESSION_COOKIE_NAME } from "@/lib/auth"
import { apiUrl } from "@/lib/api"

// Routes that do NOT require authentication
const PUBLIC_ROUTES = [
  "/api/auth/login",
  "/api/auth/reset-password",
  "/login",
  "/kiosk",
  "/_next",
  "/favicon.ico",
]

// Routes that require authentication
const PROTECTED_PAGE_PREFIXES = [
  "/dashboard",
  "/employees",
  "/attendance",
  "/rota",
  "/sites",
  "/head-office",
  "/settings",
  "/payroll",
  "/approval",
  "/managers",
  "/audit",
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes through
  if (
    PUBLIC_ROUTES.some((route) => pathname.startsWith(route)) ||
    (request.method === "GET" && pathname.startsWith("/api/locations"))
  ) {
    return NextResponse.next()
  }

  // Allow static files and public assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js")
  ) {
    return NextResponse.next()
  }

  // Check if this is a protected API route
  const isApiRoute = pathname.startsWith("/api/")
  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some((p) => pathname.startsWith(p))

  if (!isApiRoute && !isProtectedPage) {
    return NextResponse.next()
  }

  // ─── Verify session ────────────────────────────────────────────────────
  const session = getSessionFromRequest(request)

  if (!session) {
    if (isApiRoute) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      )
    }
    // Redirect to login for page routes
    const loginUrl = new URL(apiUrl("/login"), request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ─── Inject auth headers for downstream API route handlers ─────────────
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-user-id", session.userId)
  requestHeaders.set("x-user-role", session.role)
  requestHeaders.set("x-user-name", session.userName)
  if (session.locationId) {
    requestHeaders.set("x-user-site", session.locationId)
  }

  // ─── Role-based page access ────────────────────────────────────────────
  if (isProtectedPage && session.role === "employee") {
    // Employees can access the attendance clock portal and their dashboard
    if (!pathname.startsWith("/attendance/clock") && !pathname.startsWith("/dashboard")) {
      const clockUrl = new URL(apiUrl("/attendance/clock"), request.url)
      return NextResponse.redirect(clockUrl)
    }
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

export const config = {
  matcher: [
    // Match all API routes except auth login
    "/api/:path*",
    // Match all protected pages
    "/dashboard/:path*",
    "/employees/:path*",
    "/attendance/:path*",
    "/rota/:path*",
    "/sites/:path*",
    "/head-office/:path*",
    "/settings/:path*",
    "/payroll/:path*",
    "/approval/:path*",
    "/managers/:path*",
    "/audit/:path*",
  ],
}
