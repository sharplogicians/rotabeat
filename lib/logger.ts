import fs from "fs"
import path from "path"

// APP_ROOT_DIR = the actual deployed app root on the server
// Falls back to process.cwd() for local development
const APP_ROOT = process.env.APP_ROOT_DIR || process.cwd()
const LOG_DIR = path.join(APP_ROOT, "logs")
const APP_LOG_PATH = path.join(LOG_DIR, "app.log")
const ERROR_LOG_PATH = path.join(LOG_DIR, "error.log")
const MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024 // 10MB rotation limit

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    try {
      fs.mkdirSync(LOG_DIR, { recursive: true })
    } catch {
      // Ignore if directory creation fails or exists
    }
  }
}

function rotateIfNeeded(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath)
      if (stats.size > MAX_LOG_SIZE_BYTES) {
        const backupPath = `${filePath}.${Date.now()}.bak`
        fs.renameSync(filePath, backupPath)
      }
    }
  } catch {
    // Non-blocking fallback
  }
}

function appendLog(filePath: string, content: string) {
  try {
    ensureLogDir()
    rotateIfNeeded(filePath)
    fs.appendFileSync(filePath, content, "utf-8")
  } catch (err) {
    console.error(`[Logger] Failed to write log to ${filePath}:`, err)
  }
}

function formatMeta(metadata?: Record<string, any>): string {
  if (!metadata || Object.keys(metadata).length === 0) return ""
  try {
    return "\n" + JSON.stringify(metadata, null, 2)
  } catch {
    return "\n[Unserializable metadata]"
  }
}

export const logger = {
  info(context: string, message: string, metadata?: Record<string, any>) {
    const timestamp = new Date().toISOString()
    const metaStr = formatMeta(metadata)
    const logLine = `[${timestamp}] [INFO] [${context}] ${message}${metaStr}\n`

    console.log(`[INFO] [${context}] ${message}`, metadata || "")
    appendLog(APP_LOG_PATH, logLine)
  },

  warn(context: string, message: string, metadata?: Record<string, any>) {
    const timestamp = new Date().toISOString()
    const metaStr = formatMeta(metadata)
    const logLine = `[${timestamp}] [WARN] [${context}] ${message}${metaStr}\n`

    console.warn(`[WARN] [${context}] ${message}`, metadata || "")
    appendLog(APP_LOG_PATH, logLine)
  },

  error(context: string, error: unknown, metadata?: Record<string, any>) {
    const timestamp = new Date().toISOString()
    const errorMessage =
      error instanceof Error ? error.stack || error.message : String(error)
    const metaStr = formatMeta(metadata)

    const logEntry = `[${timestamp}] [ERROR] [${context}]
Message: ${errorMessage}${metaStr}
--------------------------------------------------------------------------------\n`

    console.error(`[ERROR] [${context}]`, error, metadata || "")
    appendLog(APP_LOG_PATH, logEntry)
    appendLog(ERROR_LOG_PATH, logEntry)
  },
}

export const logServerError = logger.error
