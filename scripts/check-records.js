const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function main() {
  const records = await prisma.attendanceRecord.findMany({
    include: { employee: true, events: true },
  })
  console.log("Total attendance records:", records.length)
  for (const r of records) {
    console.log({
      id: r.id,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      employeeNumber: r.employee.employeeNumber,
      date: r.date,
      source: r.source,
      status: r.status,
      exceptionsJson: r.exceptionsJson,
      correctionReason: r.correctionReason,
      eventsCount: r.events.length,
    })
  }

  const shifts = await prisma.shift.findMany({
    include: { employee: true },
  })
  console.log("\nTotal shifts:", shifts.length)
  for (const s of shifts) {
    console.log({
      id: s.id,
      employeeName: `${s.employee.firstName} ${s.employee.lastName}`,
      employeeNumber: s.employee.employeeNumber,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
    })
  }
}

main().finally(() => prisma.$disconnect())
