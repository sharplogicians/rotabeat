import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendRotaPublishedEmails } from "@/lib/rota-email"

// GET /api/rota?siteId=...&weekStart=...
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get("siteId")
    const weekStart = searchParams.get("weekStart")

    if (!siteId || !weekStart) {
      return NextResponse.json(
        { success: false, message: "siteId and weekStart are required." },
        { status: 400 }
      )
    }

    let rota = await prisma.rota.findUnique({
      where: {
        siteId_weekStart: { siteId, weekStart },
      },
    })

    if (!rota) {
      // Default auto-creation as draft
      rota = await prisma.rota.create({
        data: {
          siteId,
          weekStart,
          status: "draft",
        },
      })
    }

    return NextResponse.json({ success: true, rota })
  } catch (error: any) {
    console.error("GET /api/rota error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to fetch rota details." },
      { status: 500 }
    )
  }
}

// POST /api/rota — Update Rota status (draft, published, locked)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { siteId, weekStart, status, createdBy } = body

    if (!siteId || !weekStart || !status) {
      return NextResponse.json(
        { success: false, message: "siteId, weekStart, and status are required." },
        { status: 400 }
      )
    }

    const updateData: any = { status }
    if (status === "published") {
      updateData.publishedAt = new Date()
    } else if (status === "locked") {
      updateData.lockedAt = new Date()
    }

    const rota = await prisma.rota.upsert({
      where: {
        siteId_weekStart: { siteId, weekStart },
      },
      update: updateData,
      create: {
        siteId,
        weekStart,
        status,
        createdBy,
        ...(status === "published" ? { publishedAt: new Date() } : {}),
        ...(status === "locked" ? { lockedAt: new Date() } : {}),
      },
    })

    // If rota is published, send schedule emails to employees
    if (status === "published") {
      try {
        await sendRotaPublishedEmails(siteId, weekStart)
      } catch (emailErr) {
        console.error("Non-blocking error dispatching rota publish emails:", emailErr)
      }
    }

    return NextResponse.json({ success: true, rota })
  } catch (error: any) {
    console.error("POST /api/rota error:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update rota status." },
      { status: 500 }
    )
  }
}
