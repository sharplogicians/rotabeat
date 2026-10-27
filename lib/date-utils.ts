// Date/time helpers for RotaBeat. All timestamps are treated as Europe/London (demo assumption).

export function isoDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function getTodayIso(): string {
  return isoDate(new Date())
}

export function getWeekStartIso(dateIso?: string): string {
  const targetIso = dateIso || getTodayIso()
  const d = new Date(targetIso + "T00:00:00")
  const dow = (d.getDay() + 6) % 7 // 0 = Monday
  d.setDate(d.getDate() - dow)
  return isoDate(d)
}

export const DEMO_NOW = new Date()
export const TODAY_ISO = getTodayIso()
export const CURRENT_WEEK_START = getWeekStartIso()
export const PREVIOUS_WEEK_START = addDays(CURRENT_WEEK_START, -7)

export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso) || new Date()
  const copy = new Date(d.getTime())
  copy.setDate(copy.getDate() + days)
  return isoDate(copy)
}

export function weekDays(weekStartIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStartIso, i))
}

const DOW_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const DOW_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

function parseIsoDate(iso: string): Date | null {
  if (!iso || typeof iso !== "string") return null
  const dateOnly = iso.includes("T") ? iso.split("T")[0] : iso.split(" ")[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const d = new Date(dateOnly + "T00:00:00")
    if (!isNaN(d.getTime())) return d
  }
  const fallback = new Date(iso)
  return isNaN(fallback.getTime()) ? null : fallback
}

export function dayOfWeekShort(iso: string): string {
  const d = parseIsoDate(iso)
  if (!d) return ""
  return DOW_SHORT[(d.getDay() + 6) % 7]
}

export function dayOfWeekLong(iso: string): string {
  const d = parseIsoDate(iso)
  if (!d) return ""
  return DOW_LONG[(d.getDay() + 6) % 7]
}

/** UK date format: 6 August 2026 */
export function formatDateLong(iso: string): string {
  const d = parseIsoDate(iso)
  if (!d) return iso || ""
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** UK date format: 06/08/2026 */
export function formatDateShort(iso: string): string {
  const d = parseIsoDate(iso)
  if (!d) return iso || ""
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
}

/** e.g. "Thu 6 Aug" */
export function formatDayMonth(iso: string): string {
  const d = parseIsoDate(iso)
  if (!d) return iso || ""
  return `${DOW_SHORT[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
}

/** e.g. "3–9 August 2026" for a Mon-Sun week */
export function formatWeekRange(weekStartIso: string): string {
  const start = parseIsoDate(weekStartIso) || new Date()
  const end = parseIsoDate(addDays(weekStartIso, 6)) || new Date()
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()}`
  }
  return `${start.getDate()} ${MONTHS[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`
}

export function getWeekStart(iso: string): string {
  const d = parseIsoDate(iso) || new Date()
  const dow = (d.getDay() + 6) % 7 // 0 = Monday
  return addDays(iso, -dow)
}

/** Minutes since midnight from "HH:mm" */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

export function minutesToTime(mins: number): string {
  const wrapped = ((mins % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function formatTime12(t: string): string {
  const [h, m] = t.split(":").map(Number)
  const period = h >= 12 ? "pm" : "am"
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, "0")}${period}`
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${formatDateShort(isoDate(d))} ${hh}:${mm}`
}

export function formatClock(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")
  const ss = String(date.getSeconds()).padStart(2, "0")
  return `${hh}:${mm}:${ss}`
}

export function isoToLocalTime(isoTimestamp?: string | null): string {
  if (!isoTimestamp) return ""
  if (isoTimestamp.length === 5 && isoTimestamp.includes(":")) {
    return isoTimestamp
  }
  const d = new Date(isoTimestamp)
  if (isNaN(d.getTime())) return ""
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

export function formatTimestamp12(isoTimestamp?: string | null): string {
  if (!isoTimestamp) return "—"
  const timeStr = isoToLocalTime(isoTimestamp)
  if (!timeStr) return "—"
  return formatTime12(timeStr)
}

export function formatHours(hours: number): string {
  return `${hours.toFixed(1)}h`
}

export function formatGBP(amount: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount)
}

