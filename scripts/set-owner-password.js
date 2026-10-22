const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")

const prisma = new PrismaClient()

async function main() {
  const defaultPassword = "Qwertyuiop@123"
  const hashedPassword = await bcrypt.hash(defaultPassword, 12)

  // 1. Update Aisha Khan (Business Owner)
  await prisma.user.upsert({
    where: { email: "aisha.khan@northerntable.co.uk" },
    update: {
      passwordHash: hashedPassword,
      name: "Aisha Khan",
      firstName: "Aisha",
      lastName: "Khan",
      username: "aishakhan",
      role: "business_owner",
      status: "active",
      avatarInitials: "AK",
    },
    create: {
      id: "user-aisha",
      name: "Aisha Khan",
      firstName: "Aisha",
      lastName: "Khan",
      email: "aisha.khan@northerntable.co.uk",
      username: "aishakhan",
      role: "business_owner",
      passwordHash: hashedPassword,
      status: "active",
      avatarInitials: "AK",
    },
  })
  console.log("Updated Aisha Khan password to:", defaultPassword)

  // 2. Make sure all users have bcrypt hashes
  const users = await prisma.user.findMany()
  for (const u of users) {
    if (!u.passwordHash || (!u.passwordHash.startsWith("$2a$") && !u.passwordHash.startsWith("$2b$"))) {
      const plain = u.passwordHash || defaultPassword
      const hash = await bcrypt.hash(plain, 12)
      await prisma.user.update({
        where: { id: u.id },
        data: { passwordHash: hash },
      })
      console.log(`Updated user ${u.email} to bcrypt hash (plaintext was '${plain}')`)
    }
  }

  // 3. Print all users and their login identifiers
  console.log("\n--- AVAILABLE USERS ---")
  const allUsers = await prisma.user.findMany({ include: { locations: true } })
  for (const u of allUsers) {
    console.log({
      Role: u.role,
      Name: u.name,
      Email: u.email,
      Username: u.username,
      Password: defaultPassword,
      AssignedLocation: u.locations.map(l => l.name).join(", ") || "All Locations",
    })
  }

  // 4. Print sample employees
  console.log("\n--- SAMPLE EMPLOYEES ---")
  const emps = await prisma.employee.findMany({ take: 5, include: { primarySite: true } })
  for (const e of emps) {
    console.log({
      Name: `${e.firstName} ${e.lastName}`,
      EmployeeNumber: e.employeeNumber,
      Email: e.email,
      PIN: "1234",
      Site: e.primarySite.name,
    })
  }
}

main().finally(() => prisma.$disconnect())
