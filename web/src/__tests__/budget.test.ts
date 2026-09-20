// Budget domain unit tests — AC-FR003-01~03 (validation, summary, overrun).
//
// Pure helpers; no DOM / IndexedDB. Mirrors the layout of validation.test.ts.

import { describe, expect, it } from 'vitest'
import {
  EMPTY_PAYMENT_COUNTS,
  errorFor,
  formatBudgetAmount,
  formatSignedAmount,
  fractionDigitsOf,
  isItemOverrun,
  isPaymentStatus,
  itemOverrunAmount,
  listOverrunItems,
  parseAmountInput,
  sortBudgetsForDisplay,
  summarizeBudget,
  validateBudgetInput,
  validateNewBudgetInput,
} from '../budget'
import { MAX_BUDGET_DECIMALS, roundBudgetAmount } from '../types'
import type { BudgetItem, PaymentStatus } from '../types'

function mkBudget(overrides: Partial<BudgetItem> = {}): BudgetItem {
  return {
    id: 'budget-' + Math.random().toString(36).slice(2, 8),
    projectId: 'proj-1',
    category: '材料',
    name: '磁磚',
    plannedAmount: 10000,
    actualAmount: 0,
    paymentStatus: 'unpaid',
    createdAt: '2026-02-09T00:00:00.000Z',
    updatedAt: '2026-02-09T00:00:00.000Z',
    ...overrides,
  }
}

describe('roundBudgetAmount — SPEC §4.5', () => {
  it('rounds to at most two decimal places', () => {
    expect(roundBudgetAmount(123.456)).toBe(123.46)
    expect(roundBudgetAmount(123.454)).toBe(123.45)
    expect(roundBudgetAmount(0.1 + 0.2)).toBeCloseTo(0.3, 10)
  })
  it('passes finite integers through unchanged', () => {
    expect(roundBudgetAmount(0)).toBe(0)
    expect(roundBudgetAmount(1000000)).toBe(1000000)
  })
  it('passes non-finite values through unchanged (caller decides)', () => {
    expect(roundBudgetAmount(NaN)).toBeNaN()
    expect(roundBudgetAmount(Infinity)).toBe(Infinity)
  })
})

describe('fractionDigitsOf', () => {
  it('returns 0 for whole numbers', () => {
    expect(fractionDigitsOf(0)).toBe(0)
    expect(fractionDigitsOf(123)).toBe(0)
  })
  it('returns the actual digit count', () => {
    expect(fractionDigitsOf(0.1)).toBe(1)
    expect(fractionDigitsOf(12.34)).toBe(2)
    expect(fractionDigitsOf(0.001)).toBe(3)
  })
  it('detects the 0.1 + 0.2 float artefact as more than two decimals', () => {
    // 0.1 + 0.2 === 0.30000000000000004
    expect(fractionDigitsOf(0.1 + 0.2)).toBeGreaterThan(2)
  })
  it('reports Infinity for non-finite values', () => {
    expect(fractionDigitsOf(NaN)).toBe(Number.POSITIVE_INFINITY)
    expect(fractionDigitsOf(Infinity)).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('parseAmountInput', () => {
  it('coerces numeric strings', () => {
    expect(parseAmountInput('123.45')).toBe(123.45)
    expect(parseAmountInput(' 0 ')).toBe(0)
  })
  it('returns NaN for empty or non-numeric input', () => {
    expect(parseAmountInput('')).toBeNaN()
    expect(parseAmountInput('abc')).toBeNaN()
  })
  it('passes numbers through', () => {
    expect(parseAmountInput(42)).toBe(42)
  })
})

describe('isPaymentStatus', () => {
  it('matches the SPEC §4.5 three values', () => {
    const valid: PaymentStatus[] = ['unpaid', 'partial', 'paid']
    for (const v of valid) expect(isPaymentStatus(v)).toBe(true)
  })
  it('rejects other strings / null / undefined', () => {
    expect(isPaymentStatus('done')).toBe(false)
    expect(isPaymentStatus('')).toBe(false)
    expect(isPaymentStatus(null)).toBe(false)
    expect(isPaymentStatus(undefined)).toBe(false)
  })
})

describe('validateBudgetInput — AC-FR003-02', () => {
  const valid = {
    projectId: 'proj-1',
    name: '磁磚',
    category: '材料',
    plannedAmount: 10000,
    actualAmount: 0,
    paymentStatus: 'unpaid' as PaymentStatus,
  }

  it('accepts a well-formed budget item', () => {
    const r = validateBudgetInput(valid)
    expect(r.ok).toBe(true)
    expect(r.errors).toEqual([])
  })

  it('rejects empty name with a readable error', () => {
    const r = validateBudgetInput({ ...valid, name: '' })
    expect(r.ok).toBe(false)
    expect(errorFor(r.errors, 'name')).toMatch(/不可為空/)
  })

  it('rejects whitespace-only name', () => {
    const r = validateBudgetInput({ ...valid, name: '   ' })
    expect(r.ok).toBe(false)
  })

  it('rejects empty category with a readable error', () => {
    const r = validateBudgetInput({ ...valid, category: '' })
    expect(r.ok).toBe(false)
    expect(errorFor(r.errors, 'category')).toMatch(/不可為空/)
  })

  it('rejects negative plannedAmount', () => {
    const r = validateBudgetInput({ ...valid, plannedAmount: -1 })
    expect(r.ok).toBe(false)
    expect(errorFor(r.errors, 'plannedAmount')).toMatch(/不可為負/)
  })

  it('rejects negative actualAmount', () => {
    const r = validateBudgetInput({ ...valid, actualAmount: -0.5 })
    expect(r.ok).toBe(false)
    expect(errorFor(r.errors, 'actualAmount')).toMatch(/不可為負/)
  })

  it('rejects non-finite amounts', () => {
    const r = validateBudgetInput({ ...valid, plannedAmount: NaN })
    expect(r.ok).toBe(false)
    expect(errorFor(r.errors, 'plannedAmount')).toMatch(/有限數字/)
    const r2 = validateBudgetInput({ ...valid, actualAmount: Infinity })
    expect(r2.ok).toBe(false)
    expect(errorFor(r2.errors, 'actualAmount')).toMatch(/有限數字/)
  })

  it('rejects more than two decimal places', () => {
    const r = validateBudgetInput({ ...valid, plannedAmount: 0.001 })
    expect(r.ok).toBe(false)
    expect(errorFor(r.errors, 'plannedAmount')).toMatch(/兩位小數/)
    const r2 = validateBudgetInput({ ...valid, actualAmount: 100.123 })
    expect(r2.ok).toBe(false)
    expect(errorFor(r2.errors, 'actualAmount')).toMatch(/兩位小數/)
  })

  it('accepts exactly two decimal places', () => {
    const r = validateBudgetInput({ ...valid, plannedAmount: 123.45, actualAmount: 100.5 })
    expect(r.ok).toBe(true)
  })

  it('rejects unknown paymentStatus', () => {
    const r = validateBudgetInput({ ...valid, paymentStatus: 'done' as unknown as PaymentStatus })
    expect(r.ok).toBe(false)
    expect(errorFor(r.errors, 'paymentStatus')).toMatch(/付款狀態/)
  })

  it('validateNewBudgetInput: rejects empty projectId on create payloads', () => {
    const r = validateNewBudgetInput({ ...valid, projectId: '' })
    expect(r.ok).toBe(false)
    expect(errorFor(r.errors, 'name')).toMatch(/缺少工程 ID/)
  })

  it('validateNewBudgetInput: rejects missing projectId', () => {
    const { projectId: _omit, ...withoutProject } = valid
    void _omit
    const r = validateNewBudgetInput(withoutProject)
    expect(r.ok).toBe(false)
    expect(errorFor(r.errors, 'name')).toMatch(/缺少工程 ID/)
  })

  it('validateNewBudgetInput: accepts valid input with projectId', () => {
    const r = validateNewBudgetInput({ ...valid, projectId: 'proj-1' })
    expect(r.ok).toBe(true)
  })

  it('reports multiple field errors at once', () => {
    const r = validateBudgetInput({
      name: '',
      category: '',
      plannedAmount: -1,
      actualAmount: 1.123,
      paymentStatus: 'done' as unknown as PaymentStatus,
    })
    expect(r.ok).toBe(false)
    // At least one error for each broken field.
    expect(errorFor(r.errors, 'name')).toBeDefined()
    expect(errorFor(r.errors, 'category')).toBeDefined()
    expect(errorFor(r.errors, 'plannedAmount')).toBeDefined()
    expect(errorFor(r.errors, 'actualAmount')).toBeDefined()
    expect(errorFor(r.errors, 'paymentStatus')).toBeDefined()
  })
})

describe('isItemOverrun / itemOverrunAmount — AC-FR003-03', () => {
  it('flags an item whose actual exceeds planned', () => {
    expect(isItemOverrun({ plannedAmount: 100, actualAmount: 100.01 })).toBe(true)
    expect(itemOverrunAmount({ plannedAmount: 100, actualAmount: 100.01 })).toBe(0.01)
  })
  it('does not flag equal amounts', () => {
    expect(isItemOverrun({ plannedAmount: 100, actualAmount: 100 })).toBe(false)
    expect(itemOverrunAmount({ plannedAmount: 100, actualAmount: 100 })).toBe(0)
  })
  it('does not flag under-budget items', () => {
    expect(isItemOverrun({ plannedAmount: 100, actualAmount: 50 })).toBe(false)
    expect(itemOverrunAmount({ plannedAmount: 100, actualAmount: 50 })).toBe(0)
  })
  it('rounds the overrun difference to two decimals', () => {
    expect(itemOverrunAmount({ plannedAmount: 100, actualAmount: 100.456 })).toBe(0.46)
  })
})

describe('summarizeBudget — AC-FR003-01 / AC-FR003-04', () => {
  it('returns zeroed totals for an empty list', () => {
    const s = summarizeBudget([])
    expect(s.total).toBe(0)
    expect(s.totalPlanned).toBe(0)
    expect(s.totalActual).toBe(0)
    expect(s.remaining).toBe(0)
    expect(s.isOverrun).toBe(false)
    expect(s.totalOverrun).toBe(0)
    expect(s.overrunItemCount).toBe(0)
    expect(s.paymentCounts).toEqual(EMPTY_PAYMENT_COUNTS)
  })

  it('aggregates planned and actual amounts', () => {
    const items = [
      mkBudget({ id: 'a', plannedAmount: 100, actualAmount: 80, paymentStatus: 'unpaid' }),
      mkBudget({ id: 'b', plannedAmount: 50, actualAmount: 60, paymentStatus: 'partial' }),
      mkBudget({ id: 'c', plannedAmount: 200, actualAmount: 100, paymentStatus: 'paid' }),
    ]
    const s = summarizeBudget(items)
    expect(s.total).toBe(3)
    expect(s.totalPlanned).toBe(350)
    expect(s.totalActual).toBe(240)
    expect(s.remaining).toBe(110)
    expect(s.isOverrun).toBe(false)
    expect(s.totalOverrun).toBe(0)
    expect(s.overrunItemCount).toBe(1)
    expect(s.paymentCounts).toEqual({ unpaid: 1, partial: 1, paid: 1 })
  })

  it('flags a project-level overrun', () => {
    const items = [
      mkBudget({ id: 'a', plannedAmount: 100, actualAmount: 200 }),
      mkBudget({ id: 'b', plannedAmount: 50, actualAmount: 0 }),
    ]
    const s = summarizeBudget(items)
    expect(s.isOverrun).toBe(true)
    expect(s.totalOverrun).toBe(50)
    expect(s.remaining).toBe(-50)
    expect(s.overrunItemCount).toBe(1)
  })

  it('rounds at the boundary so float artefacts do not leak', () => {
    const items = [
      mkBudget({ id: 'a', plannedAmount: 0.1, actualAmount: 0.2 }),
      mkBudget({ id: 'b', plannedAmount: 0.1, actualAmount: 0.2 }),
      mkBudget({ id: 'c', plannedAmount: 0.1, actualAmount: 0.2 }),
    ]
    const s = summarizeBudget(items)
    // 0.1 + 0.1 + 0.1 = 0.30000000000000004 (raw) — we round at the boundary.
    expect(s.totalPlanned).toBe(0.3)
    expect(s.totalActual).toBe(0.6)
    expect(s.remaining).toBe(-0.3)
    expect(s.isOverrun).toBe(true)
    expect(s.totalOverrun).toBe(0.3)
  })

  it('handles all three payment statuses independently', () => {
    const items = [
      mkBudget({ id: 'a', paymentStatus: 'unpaid' }),
      mkBudget({ id: 'b', paymentStatus: 'unpaid' }),
      mkBudget({ id: 'c', paymentStatus: 'partial' }),
      mkBudget({ id: 'd', paymentStatus: 'paid' }),
    ]
    const s = summarizeBudget(items)
    expect(s.paymentCounts).toEqual({ unpaid: 2, partial: 1, paid: 1 })
  })
})

describe('listOverrunItems — AC-FR003-03', () => {
  it('returns only items whose actual exceeds planned', () => {
    const a = mkBudget({ id: 'a', plannedAmount: 100, actualAmount: 200 })
    const b = mkBudget({ id: 'b', plannedAmount: 100, actualAmount: 50 })
    const c = mkBudget({ id: 'c', plannedAmount: 0, actualAmount: 1 })
    expect(listOverrunItems([a, b, c]).map((b) => b.id)).toEqual(['a', 'c'])
  })
  it('returns an empty list when nothing is over', () => {
    expect(listOverrunItems([mkBudget({ actualAmount: 1 })])).toEqual([])
  })
})

describe('sortBudgetsForDisplay', () => {
  it('groups by category asc, then createdAt asc, then id asc', () => {
    const items = [
      mkBudget({ id: 'z', category: '材料', createdAt: '2026-01-01T00:00:00.000Z' }),
      mkBudget({ id: 'a', category: '人工', createdAt: '2026-02-01T00:00:00.000Z' }),
      mkBudget({ id: 'b', category: '人工', createdAt: '2026-02-01T00:00:00.000Z' }),
      mkBudget({ id: 'c', category: '人工', createdAt: '2026-01-15T00:00:00.000Z' }),
    ]
    expect(sortBudgetsForDisplay(items).map((b) => b.id)).toEqual(['c', 'a', 'b', 'z'])
  })
  it('does not mutate the input array', () => {
    const items = [
      mkBudget({ id: 'a', category: 'Z' }),
      mkBudget({ id: 'b', category: 'A' }),
    ]
    const before = items.map((b) => b.id)
    sortBudgetsForDisplay(items)
    expect(items.map((b) => b.id)).toEqual(before)
  })
})

describe('formatBudgetAmount / formatSignedAmount — SPEC §8.1', () => {
  it('rounds to two decimals and strips trailing zeros', () => {
    expect(formatBudgetAmount(123.456, { locale: 'en-US' })).toBe('123.46')
    expect(formatBudgetAmount(100, { locale: 'en-US' })).toBe('100')
    expect(formatBudgetAmount(0, { locale: 'en-US' })).toBe('0')
  })
  it('uses thousands separators when locale provides them', () => {
    // en-US: comma separator → "1,234.5"
    expect(formatBudgetAmount(1234.5, { locale: 'en-US' })).toBe('1,234.5')
  })
  it('attaches an optional currency-like prefix', () => {
    expect(formatBudgetAmount(99, { locale: 'en-US', withSymbol: '$' })).toBe('$99')
  })
  it('shows non-finite values as em-dash', () => {
    expect(formatBudgetAmount(NaN)).toBe('—')
    expect(formatBudgetAmount(Infinity)).toBe('—')
  })
  it('honours MAX_BUDGET_DECIMALS at exactly two', () => {
    expect(MAX_BUDGET_DECIMALS).toBe(2)
  })
  it('formatSignedAmount prefixes + / − for non-zero', () => {
    expect(formatSignedAmount(0, { locale: 'en-US' })).toBe('0')
    expect(formatSignedAmount(5, { locale: 'en-US' })).toBe('+5')
    expect(formatSignedAmount(-5, { locale: 'en-US' })).toBe('-5')
  })
  it('formatSignedAmount survives non-finite values', () => {
    expect(formatSignedAmount(NaN)).toBe('—')
  })
})