// Warranty domain — FR-006, see PRD/SPEC.md §4.7 + §11.
//
// Pure functions: validation, date status, sort, summary, "expiring soon"
// helper. All date math uses local-time ISO strings (YYYY-MM-DD), so day
// boundaries never shift across timezones. No IndexedDB / React here.

import {
  isISODate,
  isOnOrBefore,
  parseISODate,
  todayISO,
} from './dates'
import {
  WARRANTY_EXPIRING_WINDOW_DAYS,
  type NewWarrantyItemInput,
  type WarrantyDateStatus,
  type WarrantyItemEditInput,
  type WarrantyRecord,
} from './types'

/** Field-level validation messages. Empty when valid. */
export interface WarrantyValidationErrors {
  itemName?: string
  provider?: string
  contact?: string
  startsOn?: string
  endsOn?: string
  note?: string
  /** Index signature lets callers treat the object as a `Record<string, string | undefined>`. */
  [field: string]: string | undefined
}

export type WarrantyDraftField = keyof WarrantyValidationErrors

const EMPTY_ERRORS: WarrantyValidationErrors = {}

/** Normalize an optional text field — trim and treat empty string as undefined. */
function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined || value === null) return undefined
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

function normalizeRequiredText(value: string | undefined): string | undefined {
  return normalizeOptionalText(value)
}

/** Shape accepted by the validation helpers. Both new + edit inputs share it. */
export interface WarrantyDraft {
  itemName: string
  provider: string
  contact?: string
  startsOn: string
  endsOn: string
  note?: string
}

function validateDraft(draft: WarrantyDraft): WarrantyValidationErrors {
  const errors: WarrantyValidationErrors = {}

  const itemName = normalizeRequiredText(draft.itemName)
  if (!itemName) {
    errors.itemName = '請輸入項目名稱'
  }

  const provider = normalizeRequiredText(draft.provider)
  if (!provider) {
    errors.provider = '請輸入提供者'
  }

  if (!isISODate(draft.startsOn)) {
    errors.startsOn = '請輸入有效的開始日期'
  }
  if (!isISODate(draft.endsOn)) {
    errors.endsOn = '請輸入有效的結束日期'
  }

  // Cross-field date check: only run when both dates are individually valid.
  if (
    !errors.startsOn &&
    !errors.endsOn &&
    !isOnOrBefore(draft.startsOn, draft.endsOn)
  ) {
    errors.endsOn = '結束日不得早於開始日'
  }

  return errors
}

/** Validate a brand-new warranty record payload (used by `createWarranty`). */
export function validateNewWarrantyInput(
  input: NewWarrantyItemInput,
): WarrantyValidationErrors {
  return validateDraft(input)
}

/** Validate an edit payload (used by `updateWarranty`). */
export function validateWarrantyEditInput(
  input: WarrantyItemEditInput,
): WarrantyValidationErrors {
  return validateDraft(input)
}

/** True when the record has no validation errors. */
export function isWarrantyValid(errors: WarrantyValidationErrors): boolean {
  return Object.keys(errors).length === 0
}

/** Convenience: empty error object used to reset form state. */
export function emptyWarrantyErrors(): WarrantyValidationErrors {
  return { ...EMPTY_ERRORS }
}

/**
 * Compute the date-driven status of a warranty relative to `today`.
 *
 * - `not_started` — `today` precedes `startsOn`.
 * - `active`      — `today` is inside `[startsOn, endsOn]`.
 * - `expired`     — `today` is after `endsOn`.
 *
 * Invalid dates or missing fields fall back to `not_started` so the UI never
 * blows up on corrupt data — the AC for FR-006 expects graceful display.
 */
export function warrantyDateStatus(
  item: Pick<WarrantyRecord, 'startsOn' | 'endsOn'>,
  today: string,
): WarrantyDateStatus {
  const start = parseISODate(item.startsOn)
  const end = parseISODate(item.endsOn)
  const t = parseISODate(today)
  if (!start || !end || !t) return 'not_started'
  if (t.getTime() < start.getTime()) return 'not_started'
  if (t.getTime() > end.getTime()) return 'expired'
  return 'active'
}

/** Days between `today` and `endsOn` (negative when already past). */
export function daysUntilEnd(item: Pick<WarrantyRecord, 'endsOn'>, today: string): number {
  const end = parseISODate(item.endsOn)
  const t = parseISODate(today)
  if (!end || !t) return NaN
  const ms = end.getTime() - t.getTime()
  return Math.round(ms / 86_400_000)
}

/**
 * True when the warranty is currently `active` and expires within
 * `WARRANTY_EXPIRING_WINDOW_DAYS` (inclusive of today). Expired warranties
 * are NOT flagged as expiring-soon — they have their own status pill.
 */
export function isWarrantyExpiringSoon(
  item: Pick<WarrantyRecord, 'startsOn' | 'endsOn'>,
  today: string,
): boolean {
  if (warrantyDateStatus(item, today) !== 'active') return false
  const remaining = daysUntilEnd(item, today)
  if (!Number.isFinite(remaining)) return false
  return remaining <= WARRANTY_EXPIRING_WINDOW_DAYS && remaining >= 0
}

/** Comparator that orders by `endsOn` ascending; ties broken by `itemName`. */
export function compareWarrantyEndsOn(a: WarrantyRecord, b: WarrantyRecord): number {
  if (a.endsOn !== b.endsOn) return a.endsOn < b.endsOn ? -1 : 1
  return a.itemName.localeCompare(b.itemName, 'zh-Hant')
}

/** Return a new list sorted by `endsOn` ascending. Does not mutate. */
export function sortWarrantiesForDisplay(items: WarrantyRecord[]): WarrantyRecord[] {
  return [...items].sort(compareWarrantyEndsOn)
}

export interface WarrantySummary {
  total: number
  active: number
  expiringSoon: number
  expired: number
  notStarted: number
}

/**
 * Aggregate counts used by both the dashboard alerts and the share snapshot.
 * Caller passes `today` so the summary stays deterministic in tests.
 */
export function summarizeWarranties(
  items: readonly Pick<WarrantyRecord, 'startsOn' | 'endsOn'>[],
  today: string,
): WarrantySummary {
  let active = 0
  let expired = 0
  let notStarted = 0
  let expiringSoon = 0
  for (const item of items) {
    const status = warrantyDateStatus(item, today)
    if (status === 'active') {
      active += 1
      if (isWarrantyExpiringSoon(item, today)) expiringSoon += 1
    } else if (status === 'expired') {
      expired += 1
    } else {
      notStarted += 1
    }
  }
  return {
    total: items.length,
    active,
    expiringSoon,
    expired,
    notStarted,
  }
}

/** True when at least one warranty expires within the 30-day window. */
export function hasWarrantyExpiringSoon(
  items: readonly Pick<WarrantyRecord, 'startsOn' | 'endsOn'>[],
  today: string,
): boolean {
  for (const item of items) {
    if (isWarrantyExpiringSoon(item, today)) return true
  }
  return false
}

/** True when at least one warranty is already past its `endsOn`. */
export function hasWarrantyExpired(
  items: readonly Pick<WarrantyRecord, 'startsOn' | 'endsOn'>[],
  today: string,
): boolean {
  for (const item of items) {
    if (warrantyDateStatus(item, today) === 'expired') return true
  }
  return false
}

/** Convenience: today as a local ISO date, for callers that don't want to import dates. */
export function warrantyTodayISO(): string {
  return todayISO()
}