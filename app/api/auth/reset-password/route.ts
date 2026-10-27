import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateResetToken, hashPassword } from "@/lib/auth"
import { apiUrl } from "@/lib/api"

// POST /api/auth/reset-password — Request a password reset (generate token, send email)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || !email.trim()) {
      return NextResponse.json(
        { success: false, message: "Please provide your email address." },
        { status: 400 }
      )
    }

    const cleanEmail = email.trim().toLowerCase()

    // Look up the user
    const user = await prisma.user.findFirst({
      where: { email: cleanEmail },
    })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, a reset link has been sent.",
      })
    }

    // Generate secure token
    const token = generateResetToken()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour expiry

    // Invalidate any existing tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(), // Mark as used
      },
    })

    // Create new reset token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    })

    // Attempt to send email
    try {
      const { sendEmailNotification } = await import("@/lib/email-service")
      const appBase = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      const resetUrl = `${appBase}${apiUrl(`/login?reset=${token}`)}`

      await sendEmailNotification({
        to: user.email,
        subject: "RotaBeat — Password Reset Request",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #1e293b;">Password Reset</h2>
            <p>Hello ${user.name},</p>
            <p>You requested a password reset for your RotaBeat account. Click the button below to set a new password:</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Reset Password
              </a>
            </p>
            <p style="color: #64748b; font-size: 13px;">This link expires in 1 hour. If you didn't request this, please ignore this email.</p>
            <p style="color: #64748b; font-size: 13px;">Token: <code>${token}</code></p>
          </div>
        `,
      })
    } catch (emailError) {
      console.error("Failed to send reset email:", emailError)
      // Still return success — don't expose email delivery status
    }

    // Log audit event
    await prisma.auditEvent.create({
      data: {
        timestamp: new Date().toISOString(),
        userName: user.name,
        role: user.role,
        siteId: null,
        entity: "User",
        action: "PASSWORD_RESET_REQUEST",
        previousValue: null,
        newValue: JSON.stringify({ userId: user.id, email: cleanEmail }),
        reason: "Password reset requested",
        source: "web",
      },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, a reset link has been sent.",
    })
  } catch (error: any) {
    console.error("POST /api/auth/reset-password error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to process reset request." },
      { status: 500 }
    )
  }
}

// PUT /api/auth/reset-password — Complete password reset (verify token, set new password)
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { token, newPassword } = body

    if (!token || !newPassword || newPassword.trim().length < 6) {
      return NextResponse.json(
        { success: false, message: "Please provide a valid token and a password with at least 6 characters." },
        { status: 400 }
      )
    }

    // Look up the token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!resetToken) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired reset token." },
        { status: 400 }
      )
    }

    if (resetToken.usedAt) {
      return NextResponse.json(
        { success: false, message: "This reset token has already been used." },
        { status: 400 }
      )
    }

    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, message: "This reset token has expired. Please request a new one." },
        { status: 400 }
      )
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword.trim())

    // Update password and mark token as used in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash: hashedPassword,
          sessionVersion: { increment: 1 }, // Invalidate all existing sessions
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ])

    // Log audit event
    await prisma.auditEvent.create({
      data: {
        timestamp: new Date().toISOString(),
        userName: resetToken.user.name,
        role: resetToken.user.role,
        siteId: null,
        entity: "User",
        action: "PASSWORD_RESET_COMPLETE",
        previousValue: null,
        newValue: JSON.stringify({ userId: resetToken.userId }),
        reason: "Password reset completed via email token",
        source: "web",
      },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. You can now log in with your new password.",
    })
  } catch (error: any) {
    console.error("PUT /api/auth/reset-password error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to reset password." },
      { status: 500 }
    )
  }
}
