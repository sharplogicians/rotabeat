import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/locations — List active locations assigned to Business Owner
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessOwnerId = searchParams.get("businessOwnerId") || undefined

    const locations = await prisma.location.findMany({
      where: businessOwnerId ? { businessOwnerId } : undefined,
      include: {
        kiosks: true,
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({ success: true, locations })
  } catch (error: any) {
    console.error("GET /api/locations error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to retrieve locations." },
      { status: 500 }
    )
  }
}

// POST /api/locations — Add new location for Business Owner
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name,
      town,
      address,
      city,
      postalCode,
      phone,
      email,
      managerId,
      businessOwnerId,
      status,
    } = body

    // Input Validation & Security checks
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, message: "Location name is required." }, { status: 400 })
    }
    if (!address || typeof address !== "string" || !address.trim()) {
      return NextResponse.json({ success: false, message: "Address is required." }, { status: 400 })
    }
    if (!town || typeof town !== "string" || !town.trim()) {
      return NextResponse.json({ success: false, message: "Town/City is required." }, { status: 400 })
    }

    // Unique Location name check
    const existingName = await prisma.location.findFirst({
      where: { name: name.trim() },
    })
    if (existingName) {
      return NextResponse.json({ success: false, message: "A location with this name already exists." }, { status: 400 })
    }

    // Unique Location phone check
    if (phone && phone.trim()) {
      const existingPhone = await prisma.location.findFirst({
        where: { phone: phone.trim() },
      })
      if (existingPhone) {
        return NextResponse.json({ success: false, message: "A location with this phone number already exists." }, { status: 400 })
      }
    }

    // Unique Location email check
    if (email && email.trim()) {
      const existingEmail = await prisma.location.findFirst({
        where: { email: email.trim() },
      })
      if (existingEmail) {
        return NextResponse.json({ success: false, message: "A location with this email address already exists." }, { status: 400 })
      }
    }

    const cleanManagerId = managerId && managerId.trim() !== "" ? managerId.trim() : null

    // Unique Manager check
    if (cleanManagerId) {
      const existingAssignment = await prisma.location.findFirst({
        where: { managerId: cleanManagerId },
      })
      if (existingAssignment) {
        return NextResponse.json({
          success: false,
          message: "This Manager is already assigned to another Location.",
        }, { status: 400 })
      }
    }

    const newLocation = await prisma.location.create({
      data: {
        name: name.trim(),
        town: town.trim(),
        address: address.trim(),
        city: city?.trim() || town.trim(),
        postalCode: postalCode?.trim(),
        country: "UK",
        phone: phone?.trim(),
        email: email?.trim(),
        managerId: cleanManagerId,
        businessOwnerId: businessOwnerId || "user-aisha",
        timeZone: "Europe/London",
        weekStart: "monday",
        status: status === "inactive" ? "inactive" : "active",
      },
      include: {
        kiosks: true,
      },
    })

    return NextResponse.json({ success: true, location: newLocation }, { status: 201 })
  } catch (error: any) {
    console.error("POST /api/locations error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to create location." },
      { status: 500 }
    )
  }
}

// PUT /api/locations — Update existing location & manager assignment
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const {
      id,
      name,
      town,
      address,
      city,
      postalCode,
      phone,
      email,
      managerId,
      status,
    } = body

    if (!id) {
      return NextResponse.json({ success: false, message: "Location ID is required." }, { status: 400 })
    }

    const existingLoc = await prisma.location.findUnique({ where: { id } })
    if (!existingLoc) {
      return NextResponse.json({ success: false, message: "Location not found." }, { status: 404 })
    }

    const cleanManagerId = managerId !== undefined
      ? (managerId && managerId.trim() !== "" ? managerId.trim() : null)
      : existingLoc.managerId

    // Unique Manager check if changing manager
    if (cleanManagerId && cleanManagerId !== existingLoc.managerId) {
      const duplicateAssignment = await prisma.location.findFirst({
        where: { managerId: cleanManagerId, NOT: { id } },
      })
      if (duplicateAssignment) {
        return NextResponse.json({
          success: false,
          message: "This Manager is already assigned to another Location.",
        }, { status: 400 })
      }
    }

    // Unique Location name check if changing name
    if (name && name.trim() !== existingLoc.name) {
      const duplicateName = await prisma.location.findFirst({
        where: { name: name.trim(), NOT: { id } },
      })
      if (duplicateName) {
        return NextResponse.json({ success: false, message: "Another location with this name already exists." }, { status: 400 })
      }
    }

    // Unique Location phone check if changing phone
    if (phone && phone.trim() && phone.trim() !== existingLoc.phone) {
      const duplicatePhone = await prisma.location.findFirst({
        where: { phone: phone.trim(), NOT: { id } },
      })
      if (duplicatePhone) {
        return NextResponse.json({ success: false, message: "Another location with this phone number already exists." }, { status: 400 })
      }
    }

    // Unique Location email check if changing email
    if (email && email.trim() && email.trim() !== existingLoc.email) {
      const duplicateEmail = await prisma.location.findFirst({
        where: { email: email.trim(), NOT: { id } },
      })
      if (duplicateEmail) {
        return NextResponse.json({ success: false, message: "Another location with this email address already exists." }, { status: 400 })
      }
    }

    const updatedLocation = await prisma.location.update({
      where: { id },
      data: {
        name: name ? name.trim() : existingLoc.name,
        town: town ? town.trim() : existingLoc.town,
        address: address ? address.trim() : existingLoc.address,
        city: city !== undefined ? city.trim() : existingLoc.city,
        postalCode: postalCode !== undefined ? postalCode.trim() : existingLoc.postalCode,
        phone: phone !== undefined ? phone.trim() : existingLoc.phone,
        email: email !== undefined ? email.trim() : existingLoc.email,
        managerId: cleanManagerId,
        status: status || existingLoc.status,
      },
      include: {
        kiosks: true,
      },
    })

    // Auto-create notification when location is deactivated
    if (updatedLocation.status === "inactive" && existingLoc.status !== "inactive") {
      await prisma.appNotification.create({
        data: {
          recipientRole: "all",
          employeeName: "System",
          siteId: updatedLocation.id,
          siteName: updatedLocation.name,
          type: "location_deactivated",
          title: `Location Deactivated: ${updatedLocation.name}`,
          message: `${updatedLocation.name} has been deactivated. Daily shifts and operations are paused.`,
          timestamp: new Date().toISOString(),
          isWarning: true,
          metaJson: JSON.stringify({
            link: "/dashboard",
            actionText: "View Dashboard",
          }),
        },
      }).catch((err) => console.error("Failed to create location deactivated notification:", err))
    } else if (updatedLocation.status === "active" && existingLoc.status === "inactive") {
      await prisma.appNotification.updateMany({
        where: {
          siteId: updatedLocation.id,
          type: "location_deactivated",
          resolved: false,
        },
        data: {
          resolved: true,
          resolvedAt: new Date(),
        },
      }).catch((err) => console.error("Failed to resolve deactivation notifications:", err))
    }

    return NextResponse.json({
      success: true,
      message: "Location updated successfully.",
      location: updatedLocation,
    })
  } catch (error: any) {
    console.error("PUT /api/locations error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to update location." },
      { status: 500 }
    )
  }
}

// DELETE /api/locations — Delete location and all associated data
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ success: false, message: "Location ID is required." }, { status: 400 })
    }

    const existingLoc = await prisma.location.findUnique({
      where: { id },
      include: {
        employees: { select: { id: true } },
      },
    })

    if (!existingLoc) {
      return NextResponse.json({ success: false, message: "Location not found." }, { status: 404 })
    }

    // 1. Delete notifications related to this site
    await prisma.appNotification.deleteMany({
      where: { siteId: id },
    }).catch(() => {})

    // 2. Delete notification audit logs related to this site
    await prisma.notificationAuditLog.deleteMany({
      where: { siteId: id },
    }).catch(() => {})

    // 3. Delete manager user if assigned to this location
    if (existingLoc.managerId) {
      await prisma.user.delete({
        where: { id: existingLoc.managerId },
      }).catch(() => {})
    }

    // 4. Delete the location itself
    // Cascades delete to: employees, shifts, rotas, attendance records, weekly approvals, kiosk devices
    await prisma.location.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: `Location "${existingLoc.name}" and all associated data deleted successfully.`,
    })
  } catch (error: any) {
    console.error("DELETE /api/locations error:", error)
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to delete location and its data." },
      { status: 500 }
    )
  }
}
