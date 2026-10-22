const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function main() {
  const updatedEmp8 = await prisma.attendanceRecord.updateMany({
    where: {
      date: "2026-09-15",
      employee: {
        employeeNumber: "EMP-1012",
      },
    },
    data: {
      exceptionsJson: JSON.stringify(["absent"]),
      status: "exception",
    },
  })
  console.log("Updated Emp 8 attendance records:", updatedEmp8)

  const updatedEmp6 = await prisma.attendanceRecord.updateMany({
    where: {
      date: "2026-09-10",
      employee: {
        employeeNumber: "EMP-1010",
      },
    },
    data: {
      exceptionsJson: JSON.stringify(["absent"]),
      status: "exception",
    },
  })
  console.log("Updated Emp 6 attendance records:", updatedEmp6)
}

main().finally(() => prisma.$disconnect())
