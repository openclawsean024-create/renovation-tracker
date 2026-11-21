// AC-001 (FR-007) — change-order validation and totals. Pure domain tests.

import { describe, expect, it } from 'vitest'
import {
  CHANGE_ORDER_LOCAL_NOTICE,
  canEditChangeOrder,
  decideChangeOrder,
  sortChangeOrdersForDisplay,
  sumApprovedChangeOrders,
  summarizeChangeOrders,
  validateChangeOrderInput,
  validateNewChangeOrderInput,
} from '../changeOrders'
import type { ChangeOrder } from '../types'

function mk(overrides: Partial<ChangeOrder> = {}): ChangeOrder {
  return {
    id: 'co-1',
    projectId: 'proj-1',
    title: '示範追加：增加插座',
    amount: 12000,
    status: 'pending',
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  }
}

describe('AC-001 change order validation', () => {
  it('AC-001: accepts a positive and a negative (追減) amount with a title', () => {
    expect(validateChangeOrderInput({ title: '示範追加', amount: 1500 }).ok).toBe(true)
    expect(validateChangeOrderInput({ title: '示範追減', amount: -1500.25 }).ok).toBe(true)
  })

  it('AC-001: rejects a blank title', () => {
    const result = validateChangeOrderInput({ title: '   ', amount: 100 })
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual([{ field: 'title', message: '變更單標題不可為空' }])
  })

  it('AC-001: rejects an amount of 0', () => {
    const result = validateChangeOrderInput({ title: '示範', amount: 0 })
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual([{ field: 'amount', message: '金額不可為 0' }])
  })

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ])('AC-001: rejects a non-finite amount (%s)', (_label, amount) => {
    const result = validateChangeOrderInput({ title: '示範', amount })
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual([{ field: 'amount', message: '金額必須是有限數字' }])
  })

  it('AC-001: rejects a missing / non-numeric amount', () => {
    const result = validateChangeOrderInput({
      title: '示範',
      amount: 'abc' as unknown as number,
    })
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toEqual({ field: 'amount', message: '金額必須是有限數字' })
    expect(validateChangeOrderInput({ title: '示範' }).ok).toBe(false)
  })

  it('AC-001: rejects more than two decimal places, positive or negative', () => {
    for (const amount of [10.123, -10.123, 0.1 + 0.2]) {
      const result = validateChangeOrderInput({ title: '示範', amount })
      expect(result.ok).toBe(false)
      expect(result.errors).toEqual([{ field: 'amount', message: '金額最多兩位小數' }])
    }
    expect(validateChangeOrderInput({ title: '示範', amount: 10.12 }).ok).toBe(true)
  })

  it('AC-001: reports title and amount errors together', () => {
    const result = validateChangeOrderInput({ title: '', amount: 0 })
    expect(result.errors.map((e) => e.field)).toEqual(['title', 'amount'])
  })

  it('AC-001: rejects an empty-string stageId but allows it to be omitted', () => {
    expect(validateChangeOrderInput({ title: '示範', amount: 1, stageId: '' }).ok).toBe(false)
    expect(validateChangeOrderInput({ title: '示範', amount: 1 }).ok).toBe(true)
    expect(validateChangeOrderInput({ title: '示範', amount: 1, stageId: 'stage-1' }).ok).toBe(true)
  })

  it('AC-001: create-time validation requires a projectId', () => {
    expect(validateNewChangeOrderInput({ title: '示範', amount: 1, projectId: '' }).ok).toBe(false)
    expect(validateNewChangeOrderInput({ title: '示範', amount: 1, projectId: 'p' }).ok).toBe(true)
  })
})

describe('AC-001 change order totals', () => {
  it('AC-001: only approved orders count towards the adjusted total', () => {
    const orders = [
      mk({ id: 'a', amount: 10000, status: 'approved' }),
      mk({ id: 'b', amount: 5000, status: 'pending' }),
      mk({ id: 'c', amount: 7000, status: 'rejected' }),
      mk({ id: 'd', amount: -2500.5, status: 'approved' }),
    ]
    expect(sumApprovedChangeOrders(orders)).toBe(7499.5)
  })

  it('AC-001: a freshly added (pending) order does not change the total', () => {
    expect(sumApprovedChangeOrders([mk({ amount: 99999, status: 'pending' })])).toBe(0)
    expect(sumApprovedChangeOrders([])).toBe(0)
  })

  it('AC-001: totals are rounded once so float artefacts do not leak', () => {
    const orders = [
      mk({ id: 'a', amount: 0.1, status: 'approved' }),
      mk({ id: 'b', amount: 0.2, status: 'approved' }),
    ]
    expect(sumApprovedChangeOrders(orders)).toBe(0.3)
  })

  it('AC-001: summary reports per-status counts plus approved / pending totals', () => {
    const summary = summarizeChangeOrders([
      mk({ id: 'a', amount: 100, status: 'approved' }),
      mk({ id: 'b', amount: 40, status: 'pending' }),
      mk({ id: 'c', amount: -10, status: 'pending' }),
      mk({ id: 'd', amount: 999, status: 'rejected' }),
    ])
    expect(summary).toEqual({
      total: 4,
      counts: { pending: 2, approved: 1, rejected: 1 },
      approvedTotal: 100,
      pendingTotal: 30,
    })
  })
})

describe('AC-001 change order decisions', () => {
  it('AC-001: only pending orders are editable', () => {
    expect(canEditChangeOrder(mk({ status: 'pending' }))).toBe(true)
    expect(canEditChangeOrder(mk({ status: 'approved' }))).toBe(false)
    expect(canEditChangeOrder(mk({ status: 'rejected' }))).toBe(false)
  })

  it('AC-001: approving records the status and the decision date without mutating the input', () => {
    const order = mk()
    const approved = decideChangeOrder(order, 'approved', '2026-01-20', '2026-01-20T03:00:00.000Z')
    expect(approved.status).toBe('approved')
    expect(approved.decidedOn).toBe('2026-01-20')
    expect(approved.updatedAt).toBe('2026-01-20T03:00:00.000Z')
    expect(approved.amount).toBe(order.amount)
    expect(order.status).toBe('pending')
    expect(order.decidedOn).toBeUndefined()
  })

  it('AC-001: rejecting records the status and the decision date', () => {
    const rejected = decideChangeOrder(mk(), 'rejected', '2026-01-21', '2026-01-21T03:00:00.000Z')
    expect(rejected.status).toBe('rejected')
    expect(rejected.decidedOn).toBe('2026-01-21')
  })

  it('AC-001: an already decided order cannot be decided again', () => {
    const approved = mk({ status: 'approved', decidedOn: '2026-01-20' })
    expect(() => decideChangeOrder(approved, 'rejected', '2026-01-22', 'x')).toThrow(
      '已決定的變更單不可再變更',
    )
  })

  it('AC-001: display order is oldest first', () => {
    const sorted = sortChangeOrdersForDisplay([
      mk({ id: 'late', createdAt: '2026-01-12T00:00:00.000Z' }),
      mk({ id: 'early', createdAt: '2026-01-10T00:00:00.000Z' }),
      mk({ id: 'mid', createdAt: '2026-01-11T00:00:00.000Z' }),
    ])
    expect(sorted.map((o) => o.id)).toEqual(['early', 'mid', 'late'])
  })

  it('AC-001: the UI notice states the decision is a local record, not an online sign-off', () => {
    expect(CHANGE_ORDER_LOCAL_NOTICE).toBe('本機紀錄，非屋主線上簽核')
  })
})

describe('AC-001 amount edge cases (Codex review)', () => {
  it('AC-001: rejects tiny amounts written in exponent form (e.g. 0.0000001)', () => {
    for (const amount of [0.0000001, -0.0000001, 1.5e-7]) {
      const result = validateChangeOrderInput({ title: '示範', amount })
      expect(result.ok).toBe(false)
      expect(result.errors).toEqual([{ field: 'amount', message: '金額最多兩位小數' }])
    }
  })

  it('AC-001: rejects amounts too large to total safely (e.g. 1e307)', () => {
    for (const amount of [1e307, -1e307, 1_000_000_000_000]) {
      const result = validateChangeOrderInput({ title: '示範', amount })
      expect(result.ok).toBe(false)
      expect(result.errors).toEqual([{ field: 'amount', message: '金額超出可記錄範圍' }])
    }
    expect(validateChangeOrderInput({ title: '示範', amount: 999_999_999_999.99 }).ok).toBe(true)
  })
})
