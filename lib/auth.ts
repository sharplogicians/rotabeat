 import { apiUrl } from '@/lib/api';
import bcrypt from "bcryptjs"


// ─── Password Hashing (12 rounds) ───────────────────────────────────────────

const PASSWORD_SALT_ROUNDS = 12
const PIN_SALT_ROUNDS = 10

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, PASSWORD_SALT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  // Handle legacy plaintext passwords during migration period
  if (!hash.startsWith("$2a$") && !hash.startsWith("$2b$")) {
    return plain === hash
  }
  return bcrypt.compare(plain, hash)
}

// ─── PIN Hashing (10 rounds) ────────────────────────────────────────────────

export async function hashPin(plain: string): Promise<string> {
  return bcrypt.hash(plain, PIN_SALT_ROUNDS)
}

export async function verifyPin(plain: string, hash: string): Promise<boolean> {
  // Handle legacy plaintext PINs during migration period
  if (!hash.startsWith("$2a$") && !hash.startsWith("$2b$")) {
    return plain === hash
  }
  return bcrypt.compare(plain, hash)
}

// ─── JWT-like Session Token (HMAC-SHA256, no extra deps) ────────────────────

import { createHmac, randomBytes } from "crypto"

const SECRET_KEY = process.env.SESSION_SECRET || "rotaflow-default-secret-change-me-in-production"
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000 // 12 hours

export interface SessionPayload {
  userId: string
  role: string
  locationId: string | null
  userName: string
  exp: number
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data).toString("base64url")
}

function base64UrlDecode(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8")
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      exp: Date.now() + SESSION_DURATION_MS,
    })
  )
  const signature = createHmac("sha256", SECRET_KEY)
    .update(`${header}.${body}`)
    .digest("base64url")
  return `${header}.${body}.${signature}`
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null

    const [header, body, signature] = parts

    // Verify signature
    const expectedSig = createHmac("sha256", SECRET_KEY)
      .update(`${header}.${body}`)
      .digest("base64url")

    if (signature !== expectedSig) return null

    // Decode and check expiry
    const payload: SessionPayload = JSON.parse(base64UrlDecode(body))
    if (payload.exp < Date.now()) return null

    return payload
  } catch {
    return null
  }
}

// ─── Cookie helpers ─────────────────────────────────────────────────────────

export const SESSION_COOKIE_NAME = "rotaflow_session"

export function getSessionCookieHeader(token: string): string {
  const maxAge = SESSION_DURATION_MS / 1000
  // In production, add Secure flag. In dev, omit it so localhost works.
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

export function getClearSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
}

// ─── Request Session Extraction ─────────────────────────────────────────────

import { NextRequest } from "next/server"

export function getSessionFromRequest(request: NextRequest): SessionPayload | null {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)
  if (!cookie?.value) return null
  return verifySessionToken(cookie.value)
}

// ─── Generate Secure Random Token ───────────────────────────────────────────

export function generateResetToken(): string {
  return randomBytes(32).toString("hex")
}
