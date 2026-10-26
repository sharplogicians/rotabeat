import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword, hashPin, verifyPassword } from "@/lib/auth"
import { getApiUser, enforceSiteAccess } from "@/lib/auth-guard"
import { logAuditEvent } from "@/lib/audit"

// Helper to generate next employee number if needed
async function generateEmployeeNumber(): Promise<string> {
  const allEmployees = await prisma.employee.findMany({
    select: { employeeNumber: true },
  })
  let max = 1000
  for (const emp of allEmployees) {
    const num = parseInt(emp.employeeNumber.replace(/\D/g, ""), 10)
    if (!isNaN(num) && num > max) {
      max = num
    }
  }
  return `EMP-${max + 1}`
}

// GET /api/employees — List all employees (optionally filtered by siteId)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rawSiteId = searchParams.get("siteId")

    const user = getApiUser(request)
    let effectiveSiteId = rawSiteId

    if (user) {
      try {
        effectiveSiteId = enforceSiteAccess(user, rawSiteId === "all" ? undefined : rawSiteId) || null
      } catch (err: any) {
        if (err instanceof Response || (err && err.status)) return err
      }
    }

    const where: any = {}
    if (effectiveSiteId && effectiveSiteId !== "all") {
      where.primarySiteId = effectiveSiteId
    }

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { lastName: "asc" },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        jobTitle: true,
        profileImage: true,
        primarySiteId: true,
        managerId: true,
        payType: true,
        hourlyRate: true,
        salaryAnnual: true,
        startDate: true,
        status: true,
        leavingDate: true,
        leavingReason: true,
        pinSet: true,
        pin: true,
        createdAt: true,
        primarySite: {
          select: { id: true, name: true, town: true },
        },
      },
    })

    return NextResponse.json({ success: true, employees })
  } catch (error: any) {
    console.error("GET /api/employees error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to retrieve employees." },
      { status: 500 }
    )
  }
}

// POST /api/employees — Create a new employee (and User if Site Manager)
export async function POST(request: Request) {
  try {
    const user = getApiUser(request)
    const body = await request.json()
    const {
      employeeNumber: inputEmpNumber,
      firstName,
      lastName,
      email,
      phone,
      jobTitle,
      profileImage,
      primarySiteId,
      managerId,
      payType,
      hourlyRate,
      salaryAnnual,
      startDate,
      status,
      password,
      pin,
    } = body

    // Validate profile image if provided
    if (profileImage) {
      if (typeof profileImage !== "string" || !profileImage.startsWith("data:image/")) {
        return NextResponse.json({ success: false, message: "Profile image must be a valid data URI (data:image/...)." }, { status: 400 })
      }
      if (profileImage.length > 1_400_000) {
        return NextResponse.json({ success: false, message: "Profile image must be less than 1 MB." }, { status: 400 })
      }
    }

    if (!firstName || !firstName.trim()) {
      return NextResponse.json({ success: false, message: "First name is required." }, { status: 400 })
    }
    if (!lastName || !lastName.trim()) {
      return NextResponse.json({ success: false, message: "Last name is required." }, { status: 400 })
    }
    if (!email || !email.trim()) {
      return NextResponse.json({ success: false, message: "Email is required." }, { status: 400 })
    }
    if (!jobTitle || !jobTitle.trim()) {
      return NextResponse.json({ success: false, message: "Job title is required." }, { status: 400 })
    }
    if (!primarySiteId) {
      return NextResponse.json({ success: false, message: "Primary site is required." }, { status: 400 })
    }
    if (!startDate) {
      return NextResponse.json({ success: false, message: "Start date is required." }, { status: 400 })
    }

    // Site permission check
    if (user) {
      try {
        enforceSiteAccess(user, primarySiteId)
      } catch (err: any) {
        if (err instanceof Response || (err && err.status)) return err
      }
    }

    const cleanEmail = email.trim().toLowerCase()
    const isSiteManager = jobTitle.trim() === "Site Manager"

    // If Site Manager, password is compulsory
    if (isSiteManager && (!password || !password.trim())) {
      return NextResponse.json(
        { success: false, message: "Password is required when creating a Site Manager." },
        { status: 400 }
      )
    }

    // Verify site exists
    const site = await prisma.location.findUnique({ where: { id: primarySiteId } })
    if (!site) {
      return NextResponse.json({ success: false, message: "Selected location was not found in database." }, { status: 400 })
    }

    // Check if Site Manager already exists at this location
    if (isSiteManager) {
      const existingSiteManager = await prisma.employee.findFirst({
        where: {
          primarySiteId,
          jobTitle: "Site Manager",
          status: { not: "left" },
        },
      })
      if (existingSiteManager) {
        return NextResponse.json(
          { success: false, message: "A Site Manager already exists for this location." },
          { status: 400 }
        )
      }
    }

    // Check duplicate employee email
    const existingEmail = await prisma.employee.findUnique({
      where: { email: cleanEmail },
    })
    if (existingEmail) {
      return NextResponse.json({ success: false, message: "An employee with this email already exists." }, { status: 400 })
    }

    // Check duplicate employee name
    const existingName = await prisma.employee.findFirst({
      where: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        status: { not: "left" },
      },
    })
    if (existingName) {
      return NextResponse.json({ success: false, message: `An employee named "${firstName.trim()} ${lastName.trim()}" already exists.` }, { status: 400 })
    }

    // Check duplicate employee phone
    if (phone && phone.trim()) {
      const existingPhone = await prisma.employee.findFirst({
        where: { phone: phone.trim() },
      })
      if (existingPhone) {
        return NextResponse.json({ success: false, message: "An employee with this phone number already exists." }, { status: 400 })
      }
    }

    let createdUserId: string | null = null

    // If Site Manager, create / upsert User in DB with bcrypt password
    if (isSiteManager) {
      const hashedPassword = await hashPassword(password.trim())
      const managerUser = await prisma.user.upsert({
        where: { email: cleanEmail },
        update: {
          name: `${firstName.trim()} ${lastName.trim()}`,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role: "manager",
          passwordHash: hashedPassword,
          status: status || "active",
        },
        create: {
          name: `${firstName.trim()} ${lastName.trim()}`,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: cleanEmail,
          username: cleanEmail.split("@")[0],
          role: "manager",
          passwordHash: hashedPassword,
          status: status || "active",
          avatarInitials: `${firstName[0]}${lastName[0]}`.toUpperCase(),
        },
      })
      createdUserId = managerUser.id

      // Link User to Location managerId
      await prisma.location.update({
        where: { id: primarySiteId },
        data: { managerId: managerUser.id },
      })
    }

    let employeeNumber = inputEmpNumber?.trim()
    if (!employeeNumber) {
      employeeNumber = await generateEmployeeNumber()
    } else {
      const existingEmpNumber = await prisma.employee.findUnique({
        where: { employeeNumber },
      })
      if (existingEmpNumber) {
        employeeNumber = await generateEmployeeNumber()
      }
    }
    const rawPin = pin && pin.trim() ? pin.trim() : null
    const hashedPin = rawPin ? await hashPin(rawPin) : null

    const employee = await prisma.employee.create({
      data: {
        employeeNumber,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: cleanEmail,
        phone: (phone || "").trim(),
        jobTitle: jobTitle.trim(),
        profileImage: profileImage || null,
        primarySiteId,
        managerId: createdUserId || managerId || null,
        payType: payType === "salaried" ? "salaried" : "hourly",
        hourlyRate: payType === "hourly" ? Number(hourlyRate) || 0 : null,
        salaryAnnual: payType === "salaried" ? Number(salaryAnnual) || 0 : null,
        startDate,
        status: status || "active",
        pinSet: Boolean(rawPin),
        pin: rawPin,
        pinHash: hashedPin,
      },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        jobTitle: true,
        profileImage: true,
        primarySiteId: true,
        managerId: true,
        payType: true,
        hourlyRate: true,
        salaryAnnual: true,
        startDate: true,
        status: true,
        leavingDate: true,
        leavingReason: true,
        pinSet: true,
        pin: true,
        createdAt: true,
        primarySite: {
          select: { id: true, name: true, town: true },
        },
      },
    })

    // Log Audit Event
    await logAuditEvent({
      userName: user?.userName || "Admin",
      role: user?.role,
      siteId: primarySiteId,
      entity: "Employee",
      action: "CREATE_EMPLOYEE",
      newValue: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        name: `${employee.firstName} ${employee.lastName}`,
        jobTitle: employee.jobTitle,
        siteId: primarySiteId,
      },
      reason: "Created new employee record",
    })

    return NextResponse.json({ success: true, employee }, { status: 201 })
  } catch (error: any) {
    console.error("POST /api/employees error:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create employee in database." },
      { status: 500 }
    )
  }
}

// PUT /api/employees — Update employee (and User/Password if Site Manager)
export async function PUT(request: Request) {
  try {
    const user = getApiUser(request)
    const body = await request.json()
    const {
      id,
      firstName,
      lastName,
      email,
      phone,
      jobTitle,
      profileImage,
      primarySiteId,
      managerId,
      payType,
      hourlyRate,
      salaryAnnual,
      startDate,
      status,
      leavingDate,
      leavingReason,
      currentPassword,
      newPassword,
      pin,
    } = body

    // Validate profile image if provided
    if (profileImage && profileImage !== "__REMOVE__") {
      if (typeof profileImage !== "string" || !profileImage.startsWith("data:image/")) {
        return NextResponse.json({ success: false, message: "Profile image must be a valid data URI (data:image/...)." }, { status: 400 })
      }
      if (profileImage.length > 1_400_000) {
        return NextResponse.json({ success: false, message: "Profile image must be less than 1 MB." }, { status: 400 })
      }
    }

    if (!id) {
      return NextResponse.json({ success: false, message: "Employee ID is required." }, { status: 400 })
    }

    const existingEmp = await prisma.employee.findUnique({ where: { id } })
    if (!existingEmp) {
      return NextResponse.json({ success: false, message: "Employee not found." }, { status: 404 })
    }

    // Site permission check
    if (user) {
      try {
        enforceSiteAccess(user, existingEmp.primarySiteId)
        if (primarySiteId && primarySiteId !== existingEmp.primarySiteId) {
          enforceSiteAccess(user, primarySiteId)
        }
      } catch (err: any) {
        if (err instanceof Response || (err && err.status)) return err
      }
    }

    const cleanEmail = email ? email.trim().toLowerCase() : existingEmp.email
    const isSiteManager = (jobTitle ? jobTitle.trim() : existingEmp.jobTitle) === "Site Manager"

    // Check duplicate email if changed
    if (email && cleanEmail !== existingEmp.email) {
      const duplicateEmail = await prisma.employee.findUnique({
        where: { email: cleanEmail },
      })
      if (duplicateEmail) {
        return NextResponse.json({ success: false, message: "Another employee with this email already exists." }, { status: 400 })
      }
    }

    // Check duplicate name if changed
    const targetFirst = firstName ? firstName.trim() : existingEmp.firstName
    const targetLast = lastName ? lastName.trim() : existingEmp.lastName
    if (targetFirst !== existingEmp.firstName || targetLast !== existingEmp.lastName) {
      const duplicateName = await prisma.employee.findFirst({
        where: {
          firstName: targetFirst,
          lastName: targetLast,
          id: { not: id },
          status: { not: "left" },
        },
      })
      if (duplicateName) {
        return NextResponse.json({ success: false, message: `Another employee named "${targetFirst} ${targetLast}" already exists.` }, { status: 400 })
      }
    }

    // Check duplicate phone if changed
    const targetPhone = phone !== undefined ? phone.trim() : existingEmp.phone
    if (targetPhone && targetPhone !== existingEmp.phone) {
      const duplicatePhone = await prisma.employee.findFirst({
        where: {
          phone: targetPhone,
          id: { not: id },
        },
      })
      if (duplicatePhone) {
        return NextResponse.json({ success: false, message: "Another employee with this phone number already exists." }, { status: 400 })
      }
    }

    // Handle password update & User DB record for Site Manager
    if (isSiteManager) {
      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ email: existingEmp.email }, { email: cleanEmail }] },
      })

      // If user provided passwords, verify current password with bcrypt
      let newHashedPassword: string | undefined = undefined
      if (newPassword && newPassword.trim()) {
        if (existingUser && existingUser.passwordHash) {
          if (!currentPassword || !(await verifyPassword(currentPassword.trim(), existingUser.passwordHash))) {
            return NextResponse.json(
              { success: false, message: "Current password does not match." },
              { status: 400 }
            )
          }
        }
        newHashedPassword = await hashPassword(newPassword.trim())
      }

      // Upsert User table
      const updatedUser = await prisma.user.upsert({
        where: { email: cleanEmail },
        update: {
          name: `${firstName ? firstName.trim() : existingEmp.firstName} ${lastName ? lastName.trim() : existingEmp.lastName}`,
          firstName: firstName ? firstName.trim() : existingEmp.firstName,
          lastName: lastName ? lastName.trim() : existingEmp.lastName,
          email: cleanEmail,
          role: "manager",
          status: status || existingEmp.status,
          ...(newHashedPassword ? { passwordHash: newHashedPassword } : {}),
        },
        create: {
          name: `${firstName ? firstName.trim() : existingEmp.firstName} ${lastName ? lastName.trim() : existingEmp.lastName}`,
          firstName: firstName ? firstName.trim() : existingEmp.firstName,
          lastName: lastName ? lastName.trim() : existingEmp.lastName,
          email: cleanEmail,
          username: cleanEmail.split("@")[0],
          role: "manager",
          passwordHash: newHashedPassword || (await hashPassword("123456")),
          status: status || "active",
        },
      })

      // Link Location.managerId
      const targetSiteId = primarySiteId || existingEmp.primarySiteId
      await prisma.location.update({
        where: { id: targetSiteId },
        data: { managerId: updatedUser.id },
      })
    }

    // Hash PIN if changed
    let hashedPin: string | undefined = undefined
    if (pin && pin.trim()) {
      hashedPin = await hashPin(pin.trim())
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: {
        firstName: firstName ? firstName.trim() : existingEmp.firstName,
        lastName: lastName ? lastName.trim() : existingEmp.lastName,
        email: cleanEmail,
        phone: phone !== undefined ? phone.trim() : existingEmp.phone,
        jobTitle: jobTitle ? jobTitle.trim() : existingEmp.jobTitle,
        ...(profileImage === "__REMOVE__" ? { profileImage: null } : profileImage ? { profileImage } : {}),
        primarySiteId: primarySiteId || existingEmp.primarySiteId,
        managerId: managerId !== undefined ? managerId : existingEmp.managerId,
        payType: payType || existingEmp.payType,
        hourlyRate: (payType || existingEmp.payType) === "hourly" ? Number(hourlyRate) || 0 : null,
        salaryAnnual: (payType || existingEmp.payType) === "salaried" ? Number(salaryAnnual) || 0 : null,
        startDate: startDate || existingEmp.startDate,
        status: status || existingEmp.status,
        leavingDate: leavingDate !== undefined ? leavingDate : existingEmp.leavingDate,
        leavingReason: leavingReason !== undefined ? leavingReason : existingEmp.leavingReason,
        ...(hashedPin ? { pin: pin.trim(), pinHash: hashedPin, pinSet: true } : {}),
      },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        jobTitle: true,
        profileImage: true,
        primarySiteId: true,
        managerId: true,
        payType: true,
        hourlyRate: true,
        salaryAnnual: true,
        startDate: true,
        status: true,
        leavingDate: true,
        leavingReason: true,
        pinSet: true,
        pin: true,
        createdAt: true,
        primarySite: {
          select: { id: true, name: true, town: true },
        },
      },
    })

    // Log Audit Event
    const isPinReset = Boolean(hashedPin)
    await logAuditEvent({
      userName: user?.userName || "Admin",
      role: user?.role,
      siteId: updatedEmployee.primarySiteId,
      entity: "Employee",
      action: isPinReset ? "RESET_PIN" : "UPDATE_EMPLOYEE",
      previousValue: {
        name: `${existingEmp.firstName} ${existingEmp.lastName}`,
        jobTitle: existingEmp.jobTitle,
        status: existingEmp.status,
      },
      newValue: {
        id: updatedEmployee.id,
        name: `${updatedEmployee.firstName} ${updatedEmployee.lastName}`,
        jobTitle: updatedEmployee.jobTitle,
        status: updatedEmployee.status,
        pinUpdated: isPinReset,
      },
      reason: isPinReset ? "Employee PIN updated/reset" : "Updated employee details",
    })

    return NextResponse.json({ success: true, employee: updatedEmployee })
  } catch (error: any) {
    console.error("PUT /api/employees error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to update employee in database." },
      { status: 500 }
    )
  }
}

// DELETE /api/employees — Remove employee from Database
export async function DELETE(request: Request) {
  try {
    const user = getApiUser(request)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ success: false, message: "Employee ID is required." }, { status: 400 })
    }

    const emp = await prisma.employee.findUnique({ where: { id } })
    if (!emp) {
      return NextResponse.json({ success: false, message: "Employee not found." }, { status: 404 })
    }

    if (user) {
      try {
        enforceSiteAccess(user, emp.primarySiteId)
      } catch (err: any) {
        if (err instanceof Response || (err && err.status)) return err
      }
    }

    if (emp.jobTitle === "Site Manager") {
      // Clear location managerId
      await prisma.location.updateMany({
        where: { managerId: emp.managerId || undefined },
        data: { managerId: null },
      })
      // Delete user account if exists
      if (emp.email) {
        await prisma.user.deleteMany({
          where: { email: emp.email, role: "manager" },
        })
      }
    }

    await prisma.employee.delete({ where: { id } })

    // Log Audit Event
    await logAuditEvent({
      userName: user?.userName || "Admin",
      role: user?.role,
      siteId: emp.primarySiteId,
      entity: "Employee",
      action: "DELETE_EMPLOYEE",
      previousValue: {
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        employeeNumber: emp.employeeNumber,
        jobTitle: emp.jobTitle,
      },
      reason: "Employee deleted from database",
    })

    return NextResponse.json({ success: true, message: "Employee deleted successfully." })
  } catch (error: any) {
    console.error("DELETE /api/employees error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to delete employee from database." },
      { status: 500 }
    )
  }
}
