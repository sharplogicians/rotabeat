import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/auth"
import { sendEmailNotification } from "@/lib/email-service"
import crypto from "crypto"
import fs from "fs"
import path from "path"

function maskEmail(email: string): string {
  const [localPart, domainPart] = email.split("@")
  if (!domainPart) return email
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domainPart}`
  }
  return `${localPart.slice(0, 2)}***${localPart.slice(-1)}@${domainPart}`
}

/**
 * POST /api/auth/reset-password
 * Step 1: Request 6-digit verification code sent to registered email
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const rawIdentifier = (body.identifier || body.email || "").trim()

    if (!rawIdentifier) {
      return NextResponse.json(
        { success: false, message: "Please provide your registered email or username." },
        { status: 400 }
      )
    }

    const cleanInput = rawIdentifier.toLowerCase()

    // Find Owner or Manager in User table
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanInput },
          { username: cleanInput },
        ],
      },
    })

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "No Owner or Manager account found with that email or username.",
        },
        { status: 404 }
      )
    }

    if (user.role !== "business_owner" && user.role !== "head_office" && user.role !== "manager") {
      return NextResponse.json(
        {
          success: false,
          message: "Only Owner and Manager accounts can reset passwords here. Staff members should contact their site manager.",
        },
        { status: 403 }
      )
    }

    if (!user.email) {
      return NextResponse.json(
        {
          success: false,
          message: "This account does not have a registered email address. Please contact your system administrator.",
        },
        { status: 400 }
      )
    }

    // Generate secure 6-digit verification code
    const verificationCode = crypto.randomInt(100000, 1000000).toString()
    // 15 minutes expiry
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

    // Invalidate / remove previous unexpired tokens for this user to keep tokens clean & unique
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    }).catch(() => {})

    // Store new 6-digit reset token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: verificationCode,
        expiresAt,
      },
    })

    const masked = maskEmail(user.email)

    // Load official RotaBeat Logo & Icon
    const attachments: Array<{ filename: string; path: string; cid: string; contentType: string }> = []
    let logoDataUri = ""
    let iconDataUri = ""

    const logoPath = path.join(process.cwd(), "public", "brand", "rotabeat-logo-trimmed.png")
    const iconPath = path.join(process.cwd(), "public", "brand", "rotabeat-icon-trimmed.png")

    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath)
      logoDataUri = `data:image/png;base64,${logoBuffer.toString("base64")}`
      attachments.push({
        filename: "rotabeat-logo.png",
        path: logoPath,
        cid: "rotabeat-logo",
        contentType: "image/png",
      })
    }

    if (fs.existsSync(iconPath)) {
      const iconBuffer = fs.readFileSync(iconPath)
      iconDataUri = `data:image/png;base64,${iconBuffer.toString("base64")}`
      attachments.push({
        filename: "rotabeat-icon.png",
        path: iconPath,
        cid: "rotabeat-icon",
        contentType: "image/png",
      })
    }

    const appBase = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000"
    const logoSrc = attachments.some((a) => a.cid === "rotabeat-logo")
      ? "cid:rotabeat-logo"
      : logoDataUri || `${appBase}/brand/rotabeat-logo-trimmed.png`
    const iconSrc = attachments.some((a) => a.cid === "rotabeat-icon")
      ? "cid:rotabeat-icon"
      : iconDataUri || `${appBase}/brand/rotabeat-icon-trimmed.png`

    // Build responsive, branded HTML email with official Logo and Icon
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Verification Code</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 16px;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
                
                <!-- Brand Top Accent Bar -->
                <tr>
                  <td style="height: 5px; background: linear-gradient(90deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%);"></td>
                </tr>

                <!-- Header with Official RotaBeat Logo -->
                <tr>
                  <td style="background-color: #ffffff; padding: 28px 24px 20px 24px; text-align: center; border-bottom: 1px solid #f1f5f9;">
                    <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                      <tr>
                        <td align="center">
                          <img src="${logoSrc}" alt="RotaBeat Logo" width="176" style="display: block; width: 176px; height: auto; border: 0; outline: none; margin: 0 auto;" />
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 8px 0 0 0; color: #64748b; font-size: 13px; font-weight: 500; letter-spacing: 0.2px;">
                      Workforce &amp; Attendance Platform
                    </p>
                  </td>
                </tr>

                <!-- Content Area with RotaBeat Icon -->
                <tr>
                  <td style="padding: 32px 30px;">
                    <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 12px;">
                          <img src="${iconSrc}" alt="RotaBeat Icon" width="34" style="display: block; width: 34px; height: auto; border: 0;" />
                        </td>
                        <td style="vertical-align: middle;">
                          <h2 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 700;">
                            Password Reset Verification
                          </h2>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                      Hello <strong>${user.name || user.firstName || "there"}</strong>,
                    </p>
                    <p style="margin: 0 0 20px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                      We received a request to reset the password for your <strong>${user.role === "business_owner" ? "Business Owner" : "Manager"}</strong> account (${user.email}).
                    </p>
                    <p style="margin: 0 0 12px 0; color: #334155; font-size: 14px; font-weight: 600;">
                      Use the 6-digit verification code below to set your new password:
                    </p>

                    <!-- Verification Code Box with Brand Accent -->
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 18px 0 22px 0;">
                      <tr>
                        <td align="center">
                          <div style="background-color: #f8fafc; border: 2px dashed #6366f1; border-radius: 14px; padding: 18px 24px; display: inline-block;">
                            <span style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #4F46E5; margin-left: 10px;">
                              ${verificationCode}
                            </span>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 0 0 20px 0; color: #64748b; font-size: 13px; line-height: 1.5; text-align: center;">
                      ⏱ This code will expire in <strong>15 minutes</strong>.
                    </p>

                    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 12px 16px; margin-top: 24px;">
                      <p style="margin: 0; color: #991b1b; font-size: 12px; line-height: 1.5;">
                        <strong>Security Notice:</strong> Never share this code with anyone. RotaBeat will never ask you for your verification code. If you did not make this request, you can safely ignore this email.
                      </p>
                    </div>
                  </td>
                </tr>

                <!-- Footer with Brand Icon -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 22px 24px; border-top: 1px solid #e2e8f0; text-align: center;">
                    <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 8px auto;">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 6px;">
                          <img src="${iconSrc}" alt="RotaBeat" width="18" style="display: block; width: 18px; height: auto; opacity: 0.85; border: 0;" />
                        </td>
                        <td style="vertical-align: middle;">
                          <span style="color: #475569; font-size: 12px; font-weight: 700; letter-spacing: 0.3px;">RotaBeat Platform</span>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                      Fast &middot; Accurate &middot; Compliant Workforce Scheduling &middot; &copy; ${new Date().getFullYear()} RotaBeat
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `

    // Send email notification with attachments
    let emailDispatched = false
    try {
      const emailResult = await sendEmailNotification({
        to: user.email,
        subject: `RotaBeat — Your Verification Code: ${verificationCode}`,
        html: emailHtml,
        attachments,
      })
      emailDispatched = Boolean(emailResult.success)
    } catch (err: any) {
      console.error("Email dispatch failed:", err)
    }

    // Log in NotificationAuditLog
    await prisma.notificationAuditLog.create({
      data: {
        type: "password_reset_code",
        recipient: user.email,
        siteId: null,
        status: emailDispatched ? "SENT" : "SIMULATED",
        reason: emailDispatched ? "Code sent to email." : "Logged (no active SMTP or dev mode).",
      },
    }).catch(() => {})

    // Log AuditEvent
    await prisma.auditEvent.create({
      data: {
        timestamp: new Date().toISOString(),
        userName: user.name,
        role: user.role,
        siteId: null,
        entity: "User",
        action: "PASSWORD_RESET_REQUESTED",
        previousValue: null,
        newValue: JSON.stringify({ userId: user.id, email: user.email }),
        reason: "Requested 6-digit password reset verification code",
        source: "web",
      },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${masked}.`,
      maskedEmail: masked,
      identifier: rawIdentifier,
      // Pass devCode in non-production environments to streamline testing when SMTP is not configured
      devCode: process.env.NODE_ENV !== "production" ? verificationCode : undefined,
    })
  } catch (error: any) {
    console.error("POST /api/auth/reset-password error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to process password reset request. Please try again." },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/auth/reset-password
 * Step 2: Verify 6-digit code and save new password in the database
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const rawIdentifier = (body.identifier || body.email || "").trim()
    const rawCode = (body.code || "").toString().trim()
    const newPassword = (body.newPassword || "").trim()
    const isVerificationOnly = body.action === "verify_code"

    const cleanCode = rawCode.replace(/\D/g, "").slice(0, 6)

    if (cleanCode.length !== 6) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid 6-digit verification code." },
        { status: 400 }
      )
    }

    if (!isVerificationOnly) {
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json(
          { success: false, message: "Password must be at least 6 characters long." },
          { status: 400 }
        )
      }
    }

    // If identifier was provided, find corresponding user
    let targetUserId: string | undefined = undefined
    if (rawIdentifier) {
      const cleanId = rawIdentifier.toLowerCase()
      const foundUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: cleanId },
            { username: cleanId },
          ],
        },
        select: { id: true },
      })
      if (foundUser) {
        targetUserId = foundUser.id
      }
    }

    // Look for a matching unexpired, unused reset token
    const resetRecord = await prisma.passwordResetToken.findFirst({
      where: {
        token: cleanCode,
        usedAt: null,
        expiresAt: { gt: new Date() },
        ...(targetUserId ? { userId: targetUserId } : {}),
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    })

    if (!resetRecord) {
      // Check if token was used or expired to provide accurate feedback
      const checkRecord = await prisma.passwordResetToken.findFirst({
        where: {
          token: cleanCode,
          ...(targetUserId ? { userId: targetUserId } : {}),
        },
        orderBy: { createdAt: "desc" },
      })

      if (checkRecord) {
        if (checkRecord.usedAt) {
          return NextResponse.json(
            { success: false, message: "This verification code has already been used. Please request a new code." },
            { status: 400 }
          )
        }
        if (checkRecord.expiresAt <= new Date()) {
          return NextResponse.json(
            { success: false, message: "This verification code has expired. Please request a new code." },
            { status: 400 }
          )
        }
      }

      return NextResponse.json(
        { success: false, message: "Invalid verification code. Please check your email and try again." },
        { status: 400 }
      )
    }

    // If user only wanted to verify code validity before entering password
    if (isVerificationOnly) {
      return NextResponse.json({
        success: true,
        message: "Verification code is valid.",
      })
    }

    // Hash the new password with bcrypt (12 rounds)
    const hashedPassword = await hashPassword(newPassword)

    // Update user's password in the database and mark token as used in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: {
          passwordHash: hashedPassword,
          sessionVersion: { increment: 1 }, // Invalidate prior active sessions
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: {
          usedAt: new Date(),
        },
      }),
    ])

    // Log successful audit event
    await prisma.auditEvent.create({
      data: {
        timestamp: new Date().toISOString(),
        userName: resetRecord.user.name,
        role: resetRecord.user.role,
        siteId: null,
        entity: "User",
        action: "PASSWORD_RESET_COMPLETE",
        previousValue: null,
        newValue: JSON.stringify({ userId: resetRecord.userId, email: resetRecord.user.email }),
        reason: "Password reset completed with 6-digit verification code",
        source: "web",
      },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      message: "Password reset successfully! You can now sign in with your new password.",
    })
  } catch (error: any) {
    console.error("PUT /api/auth/reset-password error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to reset password. Please try again." },
      { status: 500 }
    )
  }
}
