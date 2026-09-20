// FR-003 budget domain helpers. See PRD/SPEC.md §4.5, §8 and AC-FR003-01~04.
//
// Amounts are stored as `number`. To avoid the SPEC §8.1 "浮點字串累加" drift
// risk we keep every computation in numeric form, round each value to at most
// two decimal places, and round the totals once at the boundary. Strings only
// enter the pipeline at the very last step (formatting for display).

import {
  MAX_BUDGET_DECIMALS,
  PAYMENT_STATUSES,
  roundBudgetAmount,
  type BudgetItem,
  type BudgetItemEditInput,
  type NewBudgetItemInput,
  type PaymentStatus,
} from './types'

/** A single field-level budget validation problem. */
export interface BudgetFieldError {
  field: 'name' | 'category' | 'plannedAmount' | 'actualAmount' | 'paymentStatus'
  message: string
}

export interface BudgetValidationResult {
  ok: boolean
  errors: BudgetFieldError[]
}

/** True when `value` is one of the three SPEC §4.5 PaymentStatus values. */
export function isPaymentStatus(value: string | null | undefined): value is PaymentStatus {
  return value === 'unpaid' || value === 'partial' || value === 'paid'
}

/**
 * Return the maximum allowed number of fraction digits for a number. We
 * compare against the input's natural representation (`String(value)`), which
 * preserves the fewest digits needed to round-trip the value.
 *
 * Examples:
 *   - `123`            → 0
 *   - `123.4`          → 1
 *   - `123.45`         → 2
 *   - `123.456`        → 3   (rejected by SPEC §4.5)
 *   - `0.1 + 0.2`      → 18  (rejected — typical FP artefact)
 */
export function fractionDigitsOf(value: number): number {
  if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY
  // `Number.prototype.toString()` uses the shortest round-trip representation.
  const s = String(value)
  const dot = s.indexOf('.')
  if (dot === -1) return 0
  const expIdx = s.indexOf('e')
  if (expIdx !== -1) {
    // Scientific notation — translate to a fraction digit count.
    const mantissa = s.slice(0, expIdx)
    const exp = parseInt(s.slice(expIdx + 1), 10)
    const mantissaDigits = mantissa.indexOf('.') === -1
      ? mantissa.length
      : mantissa.length - mantissa.indexOf('.') - 1
    return Math.max(0, mantissaDigits - exp)
  }
  return s.length - dot - 1
}

/**
 * Parse a value coming from a form input. Accepts numbers, numeric strings,
 * empty strings and NaN. Returns NaN for anything that isn't a finite number.
 * Used by the form to turn `<input type="number">` values into safe numbers.
 */
export function parseAmountInput(raw: unknown): number {
  if (typeof raw === 'number') return raw
  if (typeof raw !== 'string') return Number(raw)
  const trimmed = raw.trim()
  if (trimmed.length === 0) return NaN
  const n = Number(trimmed)
  return n
}

/**
 * SPEC §4.5 rules:
 *  - `name` and `category` must be non-empty (after trim)
 *  - `plannedAmount` and `actualAmount` must be finite, >= 0, with at most
 *    two decimal places (FR-003 AC-FR003-02)
 *  - `paymentStatus` must be one of unpaid/partial/paid
 *
 * This helper is shared by both create and edit flows; `projectId` is NOT
 * checked here. Use `validateNewBudgetInput` for create payloads (mirrors
 * the existing FR-001 stage validator split).
 */
export function validateBudgetInput(
  input: Partial<NewBudgetItemInput & BudgetItemEditInput>,
): BudgetValidationResult {
  const errors: BudgetFieldError[] = []

  const name = (input.name ?? '').trim()
  if (name.length === 0) {
    errors.push({ field: 'name', message: '預算名稱不可為空' })
  }

  const category = (input.category ?? '').trim()
  if (category.length === 0) {
    errors.push({ field: 'category', message: '分類不可為空' })
  }

  validateAmountField('plannedAmount', input.plannedAmount, errors)
  validateAmountField('actualAmount', input.actualAmount, errors)

  if (!isPaymentStatus(input.paymentStatus)) {
    errors.push({ field: 'paymentStatus', message: '請選擇付款狀態' })
  }

  return { ok: errors.length === 0, errors }
}

/**
 * Like `validateBudgetInput` but additionally requires a non-empty
 * `projectId` — used by the store's `createBudget` action. Empty `projectId`
 * is rejected (matches the FR-001 stage validator behaviour).
 */
export function validateNewBudgetInput(
  input: Partial<NewBudgetItemInput>,
): BudgetValidationResult {
  const result = validateBudgetInput(input)
  if (input.projectId === undefined || input.projectId.length === 0) {
    result.errors.push({ field: 'name', message: '缺少工程 ID' })
    return { ok: false, errors: result.errors }
  }
  return result
}

function validateAmountField(
  field: 'plannedAmount' | 'actualAmount',
  value: unknown,
  out: BudgetFieldError[],
): void {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) {
    out.push({ field, message: '金額必須是有限數字' })
    return
  }
  if (n < 0) {
    out.push({ field, message: '金額不可為負數' })
    return
  }
  if (fractionDigitsOf(n) > MAX_BUDGET_DECIMALS) {
    out.push({ field, message: `金額最多兩位小數` })
  }
}

/** Helper used by the form / list to look up the first error for a field. */
export function errorFor(
  errors: BudgetFieldError[],
  field: BudgetFieldError['field'],
): string | undefined {
  return errors.find((e) => e.field === field)?.message
}

/**
 * Per-item overrun test — SPEC §4.5: "`actualAmount > plannedAmount` 視為該
 * 項目超支".
 */
export function isItemOverrun(
  item: Pick<BudgetItem, 'plannedAmount' | 'actualAmount'>,
): boolean {
  return item.actualAmount > item.plannedAmount
}

/** Amount by which the actual exceeds the planned for one item (>= 0). */
export function itemOverrunAmount(
  item: Pick<BudgetItem, 'plannedAmount' | 'actualAmount'>,
): number {
  if (!isItemOverrun(item)) return 0
  return roundBudgetAmount(item.actualAmount - item.plannedAmount)
}

export interface BudgetSummary {
  total: number
  totalPlanned: number
  totalActual: number
  /** planned - actual. Negative when the project is over budget. */
  remaining: number
  /** True iff total actual > total planned. SPEC §4.5. */
  isOverrun: boolean
  /** actual - planned when positive; otherwise 0. */
  totalOverrun: number
  /** Number of items whose actualAmount > plannedAmount. */
  overrunItemCount: number
  /** Per-payment-status counts (so AC-FR003-01 can verify persistence). */
  paymentCounts: Record<PaymentStatus, number>
}

export const EMPTY_PAYMENT_COUNTS: Record<PaymentStatus, number> = {
  unpaid: 0,
  partial: 0,
  paid: 0,
}

/**
 * Aggregate the project's planned + actual totals and per-status counts.
 * Rounding happens once at the boundary so floating-point artefacts from the
 * accumulation of N values can't leak into the totals.
 */
export function summarizeBudget(items: BudgetItem[]): BudgetSummary {
  let total = 0
  let rawPlanned = 0
  let rawActual = 0
  let overrunItemCount = 0
  const paymentCounts: Record<PaymentStatus, number> = { ...EMPTY_PAYMENT_COUNTS }
  for (const item of items) {
    total += 1
    rawPlanned += item.plannedAmount
    rawActual += item.actualAmount
    if (isItemOverrun(item)) overrunItemCount += 1
    paymentCounts[item.paymentStatus] += 1
  }
  const totalPlanned = roundBudgetAmount(rawPlanned)
  const totalActual = roundBudgetAmount(rawActual)
  const remaining = roundBudgetAmount(totalPlanned - totalActual)
  const isOverrun = totalActual > totalPlanned
  const totalOverrun = isOverrun ? roundBudgetAmount(totalActual - totalPlanned) : 0
  return {
    total,
    totalPlanned,
    totalActual,
    remaining,
    isOverrun,
    totalOverrun,
    overrunItemCount,
    paymentCounts,
  }
}

/** Return only the items that are over budget. Order is preserved. */
export function listOverrunItems(items: BudgetItem[]): BudgetItem[] {
  return items.filter(isItemOverrun)
}

/**
 * Stable comparator — display order is "category asc, then createdAt asc,
 * then id asc". Categories are grouped together so users can scan the budget
 * by the same buckets the form auto-suggests.
 */
export function compareBudgets(a: BudgetItem, b: BudgetItem): number {
  if (a.category !== b.category) {
    return a.category < b.category ? -1 : 1
  }
  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? -1 : 1
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Convenience: defensive copy sorted for display. */
export function sortBudgetsForDisplay(items: BudgetItem[]): BudgetItem[] {
  return items.slice().sort(compareBudgets)
}

/**
 * Format a budget amount for display. We use the runtime locale by default;
 * tests pin a deterministic locale. Rounding to the SPEC §4.5 two-decimal
 * ceiling happens here so format drift never leaks into the rendered number.
 */
export function formatBudgetAmount(
  value: number,
  options: { locale?: string; withSymbol?: string } = {},
): string {
  if (!Number.isFinite(value)) return '—'
  const rounded = roundBudgetAmount(value)
  const locale = options.locale
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: MAX_BUDGET_DECIMALS,
  })
  const body = formatter.format(rounded)
  return options.withSymbol ? `${options.withSymbol}${body}` : body
}

/**
 * Format a difference (e.g. remaining, overrun) with an explicit sign so the
 * UI doesn't need to do math at render time. Negative remaining shows as
 * `-123`; non-negative overrun shows as `+123`; zero shows as `0`.
 */
export function formatSignedAmount(
  value: number,
  options: { locale?: string; withSymbol?: string } = {},
): string {
  if (!Number.isFinite(value)) return '—'
  const rounded = roundBudgetAmount(value)
  const body = formatBudgetAmount(Math.abs(rounded), options)
  if (rounded === 0) return body
  return rounded > 0 ? `+${body}` : `-${body}`
}

// Re-export PAYMENT_STATUSES so the form can render the same labels without
// importing from `types` directly. Keeps the import surface narrow.
export { PAYMENT_STATUSES }