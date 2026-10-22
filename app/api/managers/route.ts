import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword, verifyPassword } from "@/lib/auth"
import { getApiUser } from "@/lib/auth-guard"
import { logAuditEvent } from "@/lib/audit"

// GET /api/managers — Retrieve all Manager user accounts with assigned location
export async function GET(request: Request) {
  try {
    const managers = await prisma.user.findMany({
      where: { role: "manager" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        username: true,
        role: true,
        status: true,
        avatarInitials: true,
        createdAt: true,
        locations: {
          select: {
            id: true,
            name: true,
            town: true,
          },
        },
      },
    })

    const formatted = managers.map((m) => ({
      ...m,
      assignedLocation: m.locations[0] ?? null,
      locationId: m.locations[0]?.id ?? null,
    }))

    return NextResponse.json({ success: true, managers: formatted })
  } catch (error: any) {
    console.error("GET /api/managers error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to retrieve managers." },
      { status: 500 }
    )
  }
}

// POST /api/managers — Create a new Manager account and assign Location
export async function POST(request: Request) {
  try {
    const user = getApiUser(request)
    const body = await request.json()
    const { firstName, lastName, email, username, password, confirmPassword, status, locationId } = body

    // 1. Required field validations
    if (!firstName || !firstName.trim()) {
      return NextResponse.json({ success: false, message: "Please enter the Manager's first name." }, { status: 400 })
    }
    if (!lastName || !lastName.trim()) {
      return NextResponse.json({ success: false, message: "Please enter the Manager's last name." }, { status: 400 })
    }
    if (!email || !email.trim()) {
      return NextResponse.json({ success: false, message: "Please enter an email address." }, { status: 400 })
    }
    if (!username || !username.trim()) {
      return NextResponse.json({ success: false, message: "Please enter a username." }, { status: 400 })
    }
    if (!password || !password.trim()) {
      return NextResponse.json({ success: false, message: "Please enter a password." }, { status: 400 })
    }
    if (!confirmPassword || !confirmPassword.trim()) {
      return NextResponse.json({ success: false, message: "Please confirm the password." }, { status: 400 })
    }

    // 2. Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ success: false, message: "Please enter a valid email address." }, { status: 400 })
    }

    // 3. Password confirmation check
    if (password !== confirmPassword) {
      return NextResponse.json({ success: false, message: "Passwords do not match." }, { status: 400 })
    }

    const cleanEmail = email.trim().toLowerCase()
    const cleanUsername = username.trim().toLowerCase()
    const cleanLocationId = locationId && locationId !== "none" ? locationId.trim() : null

    // 4. Duplicate Email check
    const existingEmail = await prisma.user.findUnique({
      where: { email: cleanEmail },
    })
    if (existingEmail) {
      return NextResponse.json({ success: false, message: "A user with this email already exists." }, { status: 400 })
    }

    // 5. Duplicate Username check
    const existingUsername = await prisma.user.findUnique({
      where: { username: cleanUsername },
    })
    if (existingUsername) {
      return NextResponse.json({ success: false, message: "This username is already in use." }, { status: 400 })
    }

    // 6. Check unique Location assignment (if a location is selected)
    if (cleanLocationId) {
      const existingLoc = await prisma.location.findUnique({ where: { id: cleanLocationId } })
      if (existingLoc && existingLoc.managerId) {
        return NextResponse.json({
          success: false,
          message: "This location is already assigned to another Manager.",
        }, { status: 400 })
      }
    }

    // 7. Secure Bcrypt Password Hashing
    const passwordHash = await hashPassword(password.trim())
    const initials = `${firstName.trim()[0]}${lastName.trim()[0]}`.toUpperCase()
    const fullName = `${firstName.trim()} ${lastName.trim()}`

    // 8. Create Manager & update Location relation in MySQL transaction
    const newManager = await prisma.$transaction(async (tx) => {
      const mgr = await tx.user.create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          name: fullName,
          email: cleanEmail,
          username: cleanUsername,
          passwordHash: passwordHash,
          role: "manager",
          status: status === "inactive" ? "inactive" : "active",
          avatarInitials: initials,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          name: true,
          email: true,
          username: true,
          role: true,
          status: true,
          avatarInitials: true,
          createdAt: true,
        },
      })

      if (cleanLocationId) {
        await tx.location.update({
          where: { id: cleanLocationId },
          data: { managerId: mgr.id },
        })
      }

      return mgr
    })

    // Log Audit Event
    await logAuditEvent({
      userName: user?.userName || "Admin",
      role: user?.role,
      siteId: cleanLocationId,
      entity: "Manager",
      action: "CREATE_MANAGER",
      newValue: {
        id: newManager.id,
        name: newManager.name,
        email: newManager.email,
        locationId: cleanLocationId,
      },
      reason: "Created new Manager account",
    })

    return NextResponse.json({
      success: true,
      message: "Manager created successfully.",
      manager: newManager,
    }, { status: 201 })
  } catch (error: any) {
    console.error("POST /api/managers error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to create Manager." },
      { status: 500 }
    )
  }
}

// PUT /api/managers — Edit existing Manager, verify Current Password in DB, update Password & Location
export async function PUT(request: Request) {
  try {
    const user = getApiUser(request)
    const body = await request.json()
    const { id, firstName, lastName, email, username, isChangingPassword, currentPassword, previousPassword, password, confirmPassword, status, locationId } = body

    if (!id) {
      return NextResponse.json({ success: false, message: "Manager ID is required." }, { status: 400 })
    }

    const existingManager = await prisma.user.findUnique({
      where: { id },
      include: { locations: true },
    })
    if (!existingManager) {
      return NextResponse.json({ success: false, message: "Manager not found." }, { status: 404 })
    }

    const testCurrentPassword = currentPassword || previousPassword

    // Password Change Validation (Current password verification against DB with bcrypt)
    if (isChangingPassword) {
      if (!testCurrentPassword || !testCurrentPassword.trim()) {
        return NextResponse.json({ success: false, message: "Please enter the current password." }, { status: 400 })
      }
      const isCurrentValid = existingManager.passwordHash
        ? await verifyPassword(testCurrentPassword.trim(), existingManager.passwordHash)
        : false
      if (!isCurrentValid) {
        return NextResponse.json({ success: false, message: "Current password is incorrect." }, { status: 400 })
      }
      if (!password || !password.trim()) {
        return NextResponse.json({ success: false, message: "Please enter a new password." }, { status: 400 })
      }
      if (!confirmPassword || !confirmPassword.trim()) {
        return NextResponse.json({ success: false, message: "Please confirm the new password." }, { status: 400 })
      }
      if (password !== confirmPassword) {
        return NextResponse.json({ success: false, message: "Passwords do not match." }, { status: 400 })
      }
    }

    const cleanEmail = email?.trim().toLowerCase() || existingManager.email
    const cleanUsername = username?.trim().toLowerCase() || existingManager.username
    const cleanLocationId = locationId !== undefined
      ? (locationId && locationId !== "none" ? locationId.trim() : null)
      : (existingManager.locations[0]?.id ?? null)

    // Check duplicate email (if changing)
    if (cleanEmail !== existingManager.email) {
      const duplicateEmail = await prisma.user.findUnique({ where: { email: cleanEmail } })
      if (duplicateEmail) {
        return NextResponse.json({ success: false, message: "A user with this email already exists." }, { status: 400 })
      }
    }

    // Check duplicate username (if changing)
    if (cleanUsername && cleanUsername !== existingManager.username) {
      const duplicateUsername = await prisma.user.findUnique({ where: { username: cleanUsername } })
      if (duplicateUsername) {
        return NextResponse.json({ success: false, message: "This username is already in use." }, { status: 400 })
      }
    }

    // Check Location uniqueness if changing location
    const currentLocId = existingManager.locations[0]?.id ?? null
    if (cleanLocationId && cleanLocationId !== currentLocId) {
      const existingLoc = await prisma.location.findUnique({ where: { id: cleanLocationId } })
      if (existingLoc && existingLoc.managerId && existingLoc.managerId !== id) {
        return NextResponse.json({
          success: false,
          message: "This location is already assigned to another Manager.",
        }, { status: 400 })
      }
    }

    const updatedFirstName = firstName?.trim() || existingManager.firstName || ""
    const updatedLastName = lastName?.trim() || existingManager.lastName || ""
    const fullName = `${updatedFirstName} ${updatedLastName}`.trim() || existingManager.name

    const updatedManager = await prisma.$transaction(async (tx) => {
      // 1. Unassign previous location if changed
      if (currentLocId && currentLocId !== cleanLocationId) {
        await tx.location.update({
          where: { id: currentLocId },
          data: { managerId: null },
        })
      }

      // 2. Assign new location if provided
      if (cleanLocationId) {
        await tx.location.update({
          where: { id: cleanLocationId },
          data: { managerId: id },
        })
      }

      // 3. Update User fields
      const updateData: any = {
        firstName: updatedFirstName,
        lastName: updatedLastName,
        name: fullName,
        email: cleanEmail,
        username: cleanUsername,
        status: status || existingManager.status,
      }

      if (isChangingPassword && password && password.trim()) {
        updateData.passwordHash = await hashPassword(password.trim())
        // Invalidate previous sessions
        updateData.sessionVersion = { increment: 1 }
      }

      return await tx.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          name: true,
          email: true,
          username: true,
          role: true,
          status: true,
          avatarInitials: true,
          createdAt: true,
        },
      })
    })

    // Log Audit Event
    await logAuditEvent({
      userName: user?.userName || "Admin",
      role: user?.role,
      siteId: cleanLocationId,
      entity: "Manager",
      action: isChangingPassword ? "CHANGE_PASSWORD" : "UPDATE_MANAGER",
      previousValue: {
        name: existingManager.name,
        email: existingManager.email,
        status: existingManager.status,
      },
      newValue: {
        id: updatedManager.id,
        name: updatedManager.name,
        email: updatedManager.email,
        status: updatedManager.status,
        passwordChanged: Boolean(isChangingPassword),
      },
      reason: isChangingPassword ? "Manager password updated" : "Manager profile updated",
    })

    return NextResponse.json({
      success: true,
      message: isChangingPassword ? "Password changed successfully." : "Manager updated successfully.",
      manager: updatedManager,
    })
  } catch (error: any) {
    console.error("PUT /api/managers error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to update Manager." },
      { status: 500 }
    )
  }
}
