import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const details: string[] = []

    // 1. Create PayrollAdjustment table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`PayrollAdjustment\` (
        \`id\` varchar(191) NOT NULL,
        \`employeeId\` varchar(191) NOT NULL,
        \`attendanceRecordId\` varchar(191) DEFAULT NULL,
        \`shiftId\` varchar(191) DEFAULT NULL,
        \`siteId\` varchar(191) NOT NULL,
        \`date\` varchar(191) NOT NULL,
        \`payType\` varchar(191) NOT NULL DEFAULT 'hourly',
        \`hourlyRate\` double NOT NULL DEFAULT 0,
        \`scheduledHours\` double NOT NULL DEFAULT 0,
        \`workedHours\` double NOT NULL DEFAULT 0,
        \`lateMinutes\` int(11) NOT NULL DEFAULT 0,
        \`deductionAmount\` double NOT NULL DEFAULT 0,
        \`status\` varchar(191) NOT NULL DEFAULT 'proposed',
        \`reviewedBy\` varchar(191) DEFAULT NULL,
        \`reviewedAt\` varchar(191) DEFAULT NULL,
        \`reviewNotes\` text DEFAULT NULL,
        \`createdAt\` datetime(3) NOT NULL DEFAULT current_timestamp(3),
        \`updatedAt\` datetime(3) NOT NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
        PRIMARY KEY (\`id\`),
        KEY \`PayrollAdjustment_employeeId_idx\` (\`employeeId\`),
        KEY \`PayrollAdjustment_siteId_idx\` (\`siteId\`),
        KEY \`PayrollAdjustment_date_idx\` (\`date\`),
        KEY \`PayrollAdjustment_status_idx\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    details.push("Table `PayrollAdjustment` verified/created successfully.")

    // 2. Create EmployeeWarning table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`EmployeeWarning\` (
        \`id\` varchar(191) NOT NULL,
        \`employeeId\` varchar(191) NOT NULL,
        \`attendanceRecordId\` varchar(191) DEFAULT NULL,
        \`shiftId\` varchar(191) DEFAULT NULL,
        \`date\` varchar(191) NOT NULL,
        \`managerName\` varchar(191) NOT NULL,
        \`managerRole\` varchar(191) NOT NULL DEFAULT 'manager',
        \`lateMinutes\` int(11) NOT NULL DEFAULT 0,
        \`reason\` text NOT NULL,
        \`acknowledged\` tinyint(1) NOT NULL DEFAULT 0,
        \`acknowledgedAt\` datetime(3) DEFAULT NULL,
        \`createdAt\` datetime(3) NOT NULL DEFAULT current_timestamp(3),
        PRIMARY KEY (\`id\`),
        KEY \`EmployeeWarning_employeeId_idx\` (\`employeeId\`),
        KEY \`EmployeeWarning_date_idx\` (\`date\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    details.push("Table `EmployeeWarning` verified/created successfully.")

    // 3. Ensure OrgSettings columns exist
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE \`OrgSettings\`
        ADD COLUMN \`lateGracePeriodMinutes\` int(11) NOT NULL DEFAULT 5,
        ADD COLUMN \`lateDeductionEnabled\` tinyint(1) NOT NULL DEFAULT 1;
      `)
      details.push("Added `lateGracePeriodMinutes` and `lateDeductionEnabled` to `OrgSettings`.")
    } catch (e: any) {
      if (e?.message?.includes("Duplicate column") || e?.code === "P2010" || String(e).includes("Duplicate column")) {
        details.push("Columns in `OrgSettings` are already up to date.")
      } else {
        details.push("Note on OrgSettings columns: " + (e?.message || String(e)))
      }
    }

    return NextResponse.json({
      success: true,
      message: "Database synchronization completed successfully!",
      details,
    })
  } catch (error: any) {
    console.error("[SYNC_DB_ERROR]", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to sync database",
      },
      { status: 500 }
    )
  }
}
