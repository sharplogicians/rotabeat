const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function main() {
  console.log("=== CHECKING ROTABEAT DATABASE STATUS ===\n")
  
  // 1. Connection check
  try {
    const rawResult = await prisma.$queryRaw`SELECT DATABASE() as current_db, NOW() as server_time`
    console.log("Connected to database successfully:")
    console.log("Current Database:", rawResult[0].current_db)
    console.log("Server Time:", rawResult[0].server_time)
  } catch (err) {
    console.error("Connection error:", err.message)
    return
  }

  // 2. Counts and latest updates for each model
  const models = [
    { name: "User", delegate: prisma.user, timestampField: "updatedAt" },
    { name: "Location", delegate: prisma.location, timestampField: "updatedAt" },
    { name: "KioskDevice", delegate: prisma.kioskDevice, timestampField: "registeredAt" },
    { name: "Employee", delegate: prisma.employee, timestampField: "createdAt" },
    { name: "Shift", delegate: prisma.shift, timestampField: "createdAt" },
    { name: "Rota", delegate: prisma.rota, timestampField: "updatedAt" },
    { name: "AttendanceRecord", delegate: prisma.attendanceRecord, timestampField: "updatedAt" },
    { name: "AttendanceAudit", delegate: prisma.attendanceAudit, timestampField: "changedAt" },
    { name: "ClockEvent", delegate: prisma.clockEvent, timestampField: null },
    { name: "WeeklyApproval", delegate: prisma.weeklyApproval, timestampField: "lastUpdatedAt" },
    { name: "PayrollExport", delegate: prisma.payrollExport, timestampField: "generatedAt" },
    { name: "AuditEvent", delegate: prisma.auditEvent, timestampField: "timestamp" },
    { name: "OrgSettings", delegate: prisma.orgSettings, timestampField: null },
    { name: "AppNotification", delegate: prisma.appNotification, timestampField: "createdAt" },
    { name: "NotificationAuditLog", delegate: prisma.notificationAuditLog, timestampField: "sentAt" },
    { name: "PasswordResetToken", delegate: prisma.passwordResetToken, timestampField: "createdAt" },
  ]

  console.log("\n--- Table Counts & Most Recent Entries ---")
  for (const m of models) {
    try {
      const count = await m.delegate.count()
      let latest = null
      if (count > 0 && m.timestampField) {
        latest = await m.delegate.findFirst({
          orderBy: { [m.timestampField]: 'desc' },
          select: { id: true, [m.timestampField]: true }
        })
      }
      console.log(`- ${m.name.padEnd(22)}: ${count} rows ${latest ? `(Latest ${m.timestampField}: ${JSON.stringify(latest[m.timestampField])})` : ''}`)
    } catch (e) {
      console.log(`- ${m.name.padEnd(22)}: ERROR (${e.message.split('\n')[0]})`)
    }
  }

  // 3. Test Write & Delete Verification
  console.log("\n--- Testing Write / Save Capability ---")
  try {
    const testSetting = await prisma.orgSettings.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default", orgName: "Northern Table Group" }
    })
    console.log("OrgSettings read/upsert verified: orgName =", testSetting.orgName)

    // Create a temporary audit event to verify direct INSERT and DELETE
    const tempAudit = await prisma.auditEvent.create({
      data: {
        timestamp: new Date().toISOString(),
        userName: "System Test",
        role: "head_office",
        entity: "system_test",
        action: "WRITE_VERIFICATION",
        source: "verification_script",
      }
    })
    console.log("Write test successful! Created test AuditEvent id:", tempAudit.id)

    // Delete the test record
    await prisma.auditEvent.delete({
      where: { id: tempAudit.id }
    })
    console.log("Delete test successful! Cleaned up test AuditEvent.")
  } catch (err) {
    console.error("Write test failed:", err)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

