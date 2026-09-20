// Date utilities — all dates are local-ISO strings (YYYY-MM-DD).
// See PRD/SPEC.md §5.4: dates must not shift by a day due to UTC conversion.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Today as a local-ISO date string (YYYY-MM-DD). */
export function todayISO(): string {
  const now = new Date()
  return formatLocalISO(now)
}

/**
 * Format a Date as YYYY-MM-DD using local-time fields, NOT UTC.
 * Using Date#toISOString() would shift dates in negative-UTC timezones; this
 * helper intentionally uses getFullYear/getMonth/getDate.
 */
export function formatLocalISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Strict parse of an ISO date string (YYYY-MM-DD). Returns null if invalid. */
export function parseISODate(value: string): Date | null {
  const match = ISO_DATE.exec(value)
  if (!match) return null
  const [, y, m, d] = match
  const year = Number(y)
  const month = Number(m)
  const day = Number(d)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }
  // Construct in local time, NOT UTC, so day boundaries are preserved.
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

/** True if the value is a valid YYYY-MM-DD string. */
export function isISODate(value: string): boolean {
  return parseISODate(value) !== null
}

/** True when `a` is the same calendar day as `b` (both YYYY-MM-DD). */
export function sameDay(a: string, b: string): boolean {
  return a === b
}

/**
 * Inclusive day-count between two YYYY-MM-DD strings.
 * For a 1-day range (start === end) the result is 1.
 * Returns NaN if either side is invalid.
 */
export function dayCountInclusive(start: string, end: string): number {
  const s = parseISODate(start)
  const e = parseISODate(end)
  if (!s || !e) return NaN
  const ms = e.getTime() - s.getTime()
  return Math.round(ms / 86_400_000) + 1
}

/** True when `start` is on or before `end` (calendar comparison, no TZ drift). */
export function isOnOrBefore(start: string, end: string): boolean {
  const s = parseISODate(start)
  const e = parseISODate(end)
  if (!s || !e) return false
  return s.getTime() <= e.getTime()
}

/** True when `value` falls inside [start, end] inclusive. */
export function isWithinRange(value: string, start: string, end: string): boolean {
  const v = parseISODate(value)
  const s = parseISODate(start)
  const e = parseISODate(end)
  if (!v || !s || !e) return false
  const t = v.getTime()
  return t >= s.getTime() && t <= e.getTime()
}

/** Enumerate every YYYY-MM-DD date between `start` and `end` (inclusive). */
export function eachDay(start: string, end: string): string[] {
  const s = parseISODate(start)
  const e = parseISODate(end)
  if (!s || !e) return []
  const out: string[] = []
  const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate())
  const last = new Date(e.getFullYear(), e.getMonth(), e.getDate())
  while (cur.getTime() <= last.getTime()) {
    out.push(formatLocalISO(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

/** Add `days` (may be negative) to an ISO date and return a new ISO date. */
export function addDays(value: string, days: number): string {
  const d = parseISODate(value)
  if (!d) return value
  d.setDate(d.getDate() + days)
  return formatLocalISO(d)
}

/**
 * Format an ISO date as YYYY-MM-DD for display, or `—` if invalid.
 * Used by UI to avoid showing `Invalid Date` when data is corrupt.
 */
export function displayDate(value: string | undefined | null): string {
  if (!value) return '—'
  if (!isISODate(value)) return '—'
  return value
}

/** Group consecutive days sharing the same (year, month) for header rendering. */
export interface MonthSpan {
  label: string // e.g. "2026-09"
  /** inclusive day indices [from, to] within the enumerated day list */
  from: number
  to: number
}

export function monthSpans(days: string[]): MonthSpan[] {
  const spans: MonthSpan[] = []
  for (let i = 0; i < days.length; i++) {
    const d = parseISODate(days[i])
    if (!d) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const last = spans[spans.length - 1]
    if (last && last.label === key) {
      last.to = i
    } else {
      spans.push({ label: key, from: i, to: i })
    }
  }
  return spans
}
