import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Cleaning up all existing database records...")

  // Delete dependent records in correct foreign key order
  await prisma.clockEvent.deleteMany({})
  await prisma.attendanceAudit.deleteMany({})
  await prisma.attendanceRecord.deleteMany({})
  await prisma.weeklyApproval.deleteMany({})
  await prisma.payrollExport.deleteMany({})
  await prisma.auditEvent.deleteMany({})
  await prisma.rota.deleteMany({})
  await prisma.shift.deleteMany({})
  await prisma.employee.deleteMany({})
  await prisma.kioskDevice.deleteMany({})

  // Clear manager pointers on locations before deleting locations/users
  await prisma.location.updateMany({
    data: { managerId: null },
  })

  await prisma.location.deleteMany({})
  await prisma.user.deleteMany({})

  console.log("Seeding RotaBeat database with 1 Business Owner and 2 clean locations...")

  // 1. Create Single Business Owner Account
  const owner = await prisma.user.create({
    data: {
      id: "user-aisha",
      firstName: "Aisha",
      lastName: "Khan",
      name: "Aisha Khan",
      email: "aisha.khan@northerntable.co.uk",
      username: "aishakhan",
      role: "business_owner",
      status: "active",
      avatarInitials: "AK",
    },
  })

  console.log(`Created Business Owner: ${owner.name} (${owner.id})`)

  // 2. Create Exactly 2 Initial Clean Locations
  const locationsData = [
    {
      id: "site-bright",
      name: "Bride Leeds Cafe",
      town: "Leeds",
      address: "14 Boar Lane, Leeds, LS1 5EL",
      city: "Leeds",
      postalCode: "LS1 5EL",
      country: "UK",
      phone: "+44 113 234 5678",
      email: "bright.leeds@northerntable.co.uk",
      managerId: null,
      businessOwnerId: owner.id,
      status: "active" as const,
    },
    {
      id: "site-riverside",
      name: "Riverside Kitchen",
      town: "York",
      address: "8 Coney Street, York, YO1 9QL",
      city: "York",
      postalCode: "YO1 9QL",
      country: "UK",
      phone: "+44 190 456 7890",
      email: "riverside.york@northerntable.co.uk",
      managerId: null,
      businessOwnerId: owner.id,
      status: "active" as const,
    },
  ]

  for (const loc of locationsData) {
    await prisma.location.create({
      data: loc,
    })
    console.log(`Created Location: ${loc.name} (${loc.town})`)
  }

  // 3. Org Settings
  await prisma.orgSettings.upsert({
    where: { id: "default" },
    update: { orgName: "Northern Table Group" },
    create: {
      id: "default",
      orgName: "Northern Table Group",
      timeZone: "Europe/London",
      weekStart: "monday",
    },
  })

  console.log("Database clean seed complete! 1 Business Owner and 2 Locations successfully saved.")
}

main()
  .catch((e) => {
    console.error("Seed error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
