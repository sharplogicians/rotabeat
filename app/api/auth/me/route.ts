import { NextResponse } from "next/server"
import { getApiUser } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { apiUrl } from '@/lib/api';
import { logger } from "@/lib/logger"
// GET /api/auth/me — Return current authenticated user from session
export async function GET(request: Request) {
  try {
    const authUser = getApiUser(request)

    if (!authUser) {
      return NextResponse.json(
        { success: false, message: "Not authenticated." },
        { status: 401 }
      )
    }

    // Fetch full user data from database
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        username: true,
        role: true,
        status: true,
        avatarInitials: true,
      },
    })

    if (user) {
      // Check if there is a previously remembered site from cookie
      let preferredSiteId: string | null = null
      try {
        const cookieHeader = request.headers.get("cookie") || ""
        const match = cookieHeader.match(/rotaflow_last_site=([^;]+)/)
        if (match && match[1]) {
          preferredSiteId = decodeURIComponent(match[1].trim())
        }
      } catch { }

      let assignedLocation = null

      // For business owners / head office, prioritize the site they previously selected/logged out from
      if (preferredSiteId && (user.role === "business_owner" || user.role === "head_office")) {
        assignedLocation = await prisma.location.findFirst({
          where: {
            id: preferredSiteId,
            businessOwnerId: user.id,
            status: "active",
          },
          select: {
            id: true,
            name: true,
            town: true,
          },
        })
      }

      // If preferred location not found or for managers, find assigned location
      if (!assignedLocation) {
        assignedLocation = await prisma.location.findFirst({
          where: {
            OR: [
              { managerId: user.id },
              { businessOwnerId: user.id },
            ],
            status: "active",
          },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            town: true,
          },
        })
      }

      const locationId = assignedLocation?.id ?? authUser.locationId ?? null

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          username: user.username,
          role: user.role,
          status: user.status,
          avatarInitials: user.avatarInitials,
          locationId: locationId,
          assignedLocation,
        },
      })
    }

    // Might be an employee
    const employee = await prisma.employee.findUnique({
      where: { id: authUser.id },
      include: {
        primarySite: {
          select: { id: true, name: true, town: true },
        },
      },
    })

    if (employee) {
      return NextResponse.json({
        success: true,
        user: {
          id: employee.id,
          employeeId: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          employeeNumber: employee.employeeNumber,
          role: "employee",
          jobTitle: employee.jobTitle,
          locationId: employee.primarySiteId,
          assignedLocation: employee.primarySite ? { id: employee.primarySite.id, name: employee.primarySite.name, town: employee.primarySite.town } : null,
        },
      })
    }

    return NextResponse.json(
      { success: false, message: "User not found." },
      { status: 404 }
    )
  } catch (error: any) {
    logger.error("GET /api/auth/me", error)
    return NextResponse.json(
      { success: false, message: "Failed to verify session." },
      { status: 500 }
    )
  }
}
