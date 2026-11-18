import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getApiUser } from "@/lib/auth-guard"
import { logAuditEvent } from "@/lib/audit"
import { logger } from "@/lib/logger"
import {
  sendPayrollAdjustmentApprovedEmail,
  sendWarningIssuedEmail,
} from "@/lib/email-service"

// POST /api/attendance/late-review — Process manager decision on late arrival
export async function POST(request: Request) {
  try {
    const user = getApiUser(request)
    const body = await request.json()
    const {
      action,
      employeeId,
      attendanceRecordId,
      shiftId,
      date,
      lateMinutes,
      hourlyRate,
      siteId,
      siteName,
      comment,
      reviewedBy,
    } = body

    if (!employeeId || !action) {
      return NextResponse.json(
        { success: false, message: "employeeId and action are required." },
        { status: 400 }
      )
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { primarySite: true },
    })

    if (!employee) {
      return NextResponse.json(
        { success: false, message: "Employee not found." },
        { status: 404 }
      )
    }

    const employeeName = `${employee.firstName} ${employee.lastName}`
    const managerName = user?.userName || reviewedBy || "Manager"
    const managerRole = (user?.role as any) || "manager"
    const dateIso = date || new Date().toISOString().slice(0, 10)
    const nowIso = new Date().toISOString()
    const minsLate = Number(lateMinutes) || 0

    // Determine hourly rate
    const rate =
      typeof hourlyRate === "number" && hourlyRate > 0
        ? hourlyRate
        : employee.payType === "hourly"
        ? Number(employee.hourlyRate) || 0
        : (Number(employee.salaryAnnual) || 0) / (52 * 40)

    // Calculate deduction amount
    const deductionAmount = Number(((minsLate / 60) * rate).toFixed(2))

    // Safe site ID
    const safeSiteId = siteId || employee.primarySiteId || employee.primarySite?.id || ""
    const safeSiteName = siteName || employee.primarySite?.name || "Site"

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. ACTION: "record_late" — Mark late AND DEDUCT SALARY
    // ─────────────────────────────────────────────────────────────────────────────
    if (action === "record_late") {
      // Upsert Payroll Adjustment as APPROVED (deducts salary)
      let adjustment: any = null
      if (attendanceRecordId) {
        const existingAdj = await prisma.payrollAdjustment.findFirst({
          where: { attendanceRecordId },
        })
        if (existingAdj) {
          adjustment = await prisma.payrollAdjustment.update({
            where: { id: existingAdj.id },
            data: {
              hourlyRate: rate,
              lateMinutes: minsLate,
              deductionAmount,
              status: "approved",
              reviewedBy: managerName,
              reviewedAt: nowIso,
              reviewNotes: comment || "Manager recorded late arrival with salary deduction.",
            },
          })
        }
      }

      if (!adjustment) {
        adjustment = await prisma.payrollAdjustment.create({
          data: {
            attendanceRecordId: attendanceRecordId || null,
            shiftId: shiftId || null,
            employeeId,
            siteId: safeSiteId,
            date: dateIso,
            payType: employee.payType || "hourly",
            hourlyRate: rate,
            scheduledHours: 0,
            workedHours: 0,
            lateMinutes: minsLate,
            deductionAmount,
            status: "approved",
            reviewedBy: managerName,
            reviewedAt: nowIso,
            reviewNotes: comment || "Manager recorded late arrival with salary deduction.",
          },
        })
      }

      // Update Attendance Record status to "reviewed"
      if (attendanceRecordId) {
        await prisma.attendanceRecord.update({
          where: { id: attendanceRecordId },
          data: {
            status: "reviewed",
            correctionReason: `Manager recorded late arrival (${minsLate} mins late). Deduction: £${deductionAmount.toFixed(2)}.`,
            correctedBy: managerName,
            correctedAt: nowIso,
          },
        }).catch((err) => console.warn("Could not update attendanceRecord status:", err.message))
      }

      // Send IN-APP NOTIFICATION to employee
      await prisma.appNotification.create({
        data: {
          recipientRole: "employee",
          recipientUserId: employeeId,
          employeeId,
          employeeName,
          siteId: safeSiteId,
          siteName: safeSiteName,
          type: "payroll_deduction_approved",
          title: `Late Arrival Recorded (-£${deductionAmount.toFixed(2)})`,
          message: `Your shift on ${dateIso} was recorded as ${minsLate} mins late by ${managerName}. A salary deduction of £${deductionAmount.toFixed(2)} has been applied for unpaid late time.`,
          timestamp: nowIso,
          read: false,
          isWarning: true,
          metaJson: JSON.stringify({
            date: dateIso,
            lateMinutes: minsLate,
            deductionAmount,
            hourlyRate: rate,
            managerName,
            comment,
          }),
        },
      })

      // Send Email to employee
      if (employee.email) {
        sendPayrollAdjustmentApprovedEmail({
          toEmail: employee.email,
          employeeName,
          date: dateIso,
          scheduledHours: 0,
          workedHours: 0,
          lateMinutes: minsLate,
          hourlyRate: rate,
          deductionAmount,
          managerName,
          notes: comment,
        }).catch((err) => console.error("Adjustment email error:", err))
      }

      // Audit Log
      await logAuditEvent({
        userName: managerName,
        role: managerRole,
        siteId: safeSiteId || null,
        entity: "AttendanceRecord",
        action: "RECORD_LATE_ARRIVAL",
        newValue: `Recorded late arrival for ${employeeName} (${minsLate} mins late). Applied deduction: -£${deductionAmount.toFixed(2)}`,
        reason: comment || "Manager recorded late arrival",
        source: "Late Review",
      })

      return NextResponse.json({
        success: true,
        message: `Late arrival recorded and deduction of £${deductionAmount.toFixed(2)} applied.`,
        data: { action, adjustment },
      })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. ACTION: "issue_warning" — Issue disciplinary warning (NO salary deduction)
    // ─────────────────────────────────────────────────────────────────────────────
    if (action === "issue_warning") {
      const reasonText = comment?.trim() || "Unpunctual arrival for scheduled shift."

      // 1. Create Employee Warning record
      const warning = await prisma.employeeWarning.create({
        data: {
          employeeId,
          attendanceRecordId: attendanceRecordId || null,
          shiftId: shiftId || null,
          date: dateIso,
          managerName,
          managerRole: String(managerRole),
          lateMinutes: minsLate,
          reason: reasonText,
          acknowledged: false,
        },
      })

      // 2. Waive any existing payroll deduction (warnings do NOT deduct salary)
      if (attendanceRecordId) {
        await prisma.payrollAdjustment.updateMany({
          where: { attendanceRecordId },
          data: {
            status: "rejected",
            deductionAmount: 0,
            reviewedBy: managerName,
            reviewedAt: nowIso,
            reviewNotes: `Warning issued: "${reasonText}". No salary deduction — warning only.`,
          },
        })
      }

      // Update Attendance Record
      if (attendanceRecordId) {
        await prisma.attendanceRecord.update({
          where: { id: attendanceRecordId },
          data: {
            status: "reviewed",
            correctionReason: `Warning issued by ${managerName}: "${reasonText}". No salary deduction.`,
            correctedBy: managerName,
            correctedAt: nowIso,
          },
        }).catch((err) => console.warn("Could not update attendanceRecord status:", err.message))
      }

      // Send IN-APP NOTIFICATION to employee
      await prisma.appNotification.create({
        data: {
          recipientRole: "employee",
          recipientUserId: employeeId,
          employeeId,
          employeeName,
          siteId: safeSiteId,
          siteName: safeSiteName,
          type: "warning_issued",
          title: `Formal Late Warning Issued (${minsLate} mins late)`,
          message: `Manager ${managerName} issued a formal warning for lateness on ${dateIso}: "${reasonText}". No salary deduction has been applied. Please acknowledge this warning.`,
          timestamp: nowIso,
          read: false,
          isWarning: true,
          metaJson: JSON.stringify({
            warningId: warning.id,
            date: dateIso,
            lateMinutes: minsLate,
            managerName,
            reason: reasonText,
            actionText: "Acknowledge Warning",
          }),
        },
      })

      // Send Email to employee
      if (employee.email) {
        sendWarningIssuedEmail({
          toEmail: employee.email,
          employeeName,
          date: dateIso,
          lateMinutes: minsLate,
          managerName,
          reason: reasonText,
        }).catch((err) => console.error("Warning email error:", err))
      }

      // Audit Log
      await logAuditEvent({
        userName: managerName,
        role: managerRole,
        siteId: safeSiteId || null,
        entity: "EmployeeWarning",
        action: "ISSUE_LATE_WARNING",
        newValue: `Issued warning to ${employeeName} (${minsLate} mins late): "${reasonText}". No salary deduction.`,
        reason: reasonText,
        source: "Late Review",
      })

      return NextResponse.json({
        success: true,
        message: `Warning issued to ${employeeName}. No salary deduction applied.`,
        data: { action, warning },
      })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. ACTION: "approve_exception" — Waive lateness AND DO NOT DEDUCT SALARY
    // ─────────────────────────────────────────────────────────────────────────────
    if (action === "approve_exception") {
      const noteText = comment?.trim() || "Manager approved late arrival exception."

      // 1. Waive / reject any proposed payroll adjustment (NO DEDUCTION)
      if (attendanceRecordId) {
        await prisma.payrollAdjustment.updateMany({
          where: { attendanceRecordId },
          data: {
            status: "rejected", // Rejected = Waived / Not deducted
            deductionAmount: 0,
            reviewedBy: managerName,
            reviewedAt: nowIso,
            reviewNotes: `Exception approved by ${managerName}: "${noteText}". Deduction waived.`,
          },
        })
      } else {
        await prisma.payrollAdjustment.updateMany({
          where: { employeeId, date: dateIso },
          data: {
            status: "rejected",
            deductionAmount: 0,
            reviewedBy: managerName,
            reviewedAt: nowIso,
            reviewNotes: `Exception approved by ${managerName}: "${noteText}". Deduction waived.`,
          },
        })
      }

      // 2. Clear late exception from attendance record
      if (attendanceRecordId) {
        const attRec = await prisma.attendanceRecord.findUnique({
          where: { id: attendanceRecordId },
        })
        if (attRec) {
          let exceptions: string[] = []
          try {
            exceptions = JSON.parse(attRec.exceptionsJson || "[]")
          } catch {
            exceptions = []
          }
          const filtered = exceptions.filter((e) => e !== "late_arrival" && e !== "absent")

          await prisma.attendanceRecord.update({
            where: { id: attendanceRecordId },
            data: {
              status: filtered.length > 0 ? "exception" : "normal",
              exceptionsJson: JSON.stringify(filtered),
              correctionReason: `Exception approved by ${managerName}: "${noteText}". No salary deducted.`,
              correctedBy: managerName,
              correctedAt: nowIso,
            },
          })
        }
      }

      // 3. Send IN-APP NOTIFICATION to employee (Good news: excused, no deduction)
      await prisma.appNotification.create({
        data: {
          recipientRole: "employee",
          recipientUserId: employeeId,
          employeeId,
          employeeName,
          siteId: safeSiteId,
          siteName: safeSiteName,
          type: "clock_in",
          title: `Late Arrival Excused (No Deduction)`,
          message: `Manager ${managerName} approved an exception for your late arrival on ${dateIso}. Your lateness is excused and no salary deduction will be made.`,
          timestamp: nowIso,
          read: false,
          isWarning: false,
          metaJson: JSON.stringify({
            date: dateIso,
            lateMinutes: minsLate,
            managerName,
            notes: noteText,
          }),
        },
      })

      // Audit Log
      await logAuditEvent({
        userName: managerName,
        role: managerRole,
        siteId: safeSiteId || null,
        entity: "AttendanceRecord",
        action: "APPROVE_LATE_EXCEPTION",
        newValue: `Approved exception for ${employeeName} on ${dateIso}. Lateness excused, deduction waived.`,
        reason: noteText,
        source: "Late Review",
      })

      return NextResponse.json({
        success: true,
        message: `Exception approved. Lateness waived and salary will NOT be deducted.`,
        data: { action },
      })
    }

    return NextResponse.json(
      { success: false, message: `Unknown action '${action}'` },
      { status: 400 }
    )
  } catch (error: any) {
    logger.error("POST /api/attendance/late-review", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to process late review decision." },
      { status: 500 }
    )
  }
}
