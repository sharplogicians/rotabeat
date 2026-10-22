import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Starting credential migration...")

  // 1. Migrate Users' passwords
  const users = await prisma.user.findMany()
  let usersMigrated = 0

  for (const user of users) {
    if (user.passwordHash && !user.passwordHash.startsWith("$2a$") && !user.passwordHash.startsWith("$2b$")) {
      const plain = user.passwordHash.startsWith("hashed_")
        ? Buffer.from(user.passwordHash.replace("hashed_", ""), "base64").toString("utf8")
        : user.passwordHash

      const newHash = await bcrypt.hash(plain, 12)
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      })
      usersMigrated++
      console.log(`Migrated password for user: ${user.email}`)
    }
  }

  // 2. Migrate Employees' PINs
  const employees = await prisma.employee.findMany()
  let employeesMigrated = 0

  for (const emp of employees) {
    if (emp.pinHash && !emp.pinHash.startsWith("$2a$") && !emp.pinHash.startsWith("$2b$")) {
      const newPinHash = await bcrypt.hash(emp.pinHash, 10)
      await prisma.employee.update({
        where: { id: emp.id },
        data: { pinHash: newPinHash },
      })
      employeesMigrated++
      console.log(`Migrated PIN for employee: ${emp.firstName} ${emp.lastName} (${emp.employeeNumber})`)
    }
  }

  console.log(`\nMigration completed successfully!`)
  console.log(`- Users migrated: ${usersMigrated}`)
  console.log(`- Employees migrated: ${employeesMigrated}`)
}

main()
  .catch((e) => {
    console.error("Migration error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
