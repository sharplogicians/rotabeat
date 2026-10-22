const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany()
  console.log(`Found ${users.length} users:`)
  for (const u of users) {
    console.log({
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username,
      role: u.role,
      passwordHash: u.passwordHash ? (u.passwordHash.startsWith("$2a$") || u.passwordHash.startsWith("$2b$") ? "[BCRYPT HASH]" : u.passwordHash) : "NULL",
    })
  }
}

main().finally(() => prisma.$disconnect())
