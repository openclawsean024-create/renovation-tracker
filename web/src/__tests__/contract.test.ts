// AC-002 (FR-008) — contract amount & receipts summary. Pure domain tests.

import { describe, expect, it } from 'vitest'
import { summarizeContract, validateContractInput } from '../contract'
import type { ChangeOrder } from '../types'

function order(amount: number, status: ChangeOrder['status']): Pick<ChangeOrder, 'amount' | 'status'> {
  return { amount, status }
}

describe('AC-002 contract summary', () => {
  it('AC-002: with no change orders the adjusted total equals the contract amount', () => {
    expect(summarizeContract({ contractAmount: 1000000, receivedAmount: 300000 }, [])).toEqual({
      contractAmount: 1000000,
      approvedChangeTotal: 0,
      adjustedTotal: 1000000,
      receivedAmount: 300000,
      outstanding: 700000,
      isOverpaid: false,
      overpaidAmount: 0,
    })
  })

  it('AC-002: an approved change order raises the adjusted total and the outstanding amount', () => {
    const summary = summarizeContract({ contractAmount: 1000000, receivedAmount: 300000 }, [
      order(50000, 'approved'),
    ])
    expect(summary.approvedChangeTotal).toBe(50000)
    expect(summary.adjustedTotal).toBe(1050000)
    expect(summary.outstanding).toBe(750000)
  })

  it('AC-002: an approved 追減 (negative) change order lowers the adjusted total', () => {
    const summary = summarizeContract({ contractAmount: 1000000, receivedAmount: 0 }, [
      order(-20000, 'approved'),
    ])
    expect(summary.approvedChangeTotal).toBe(-20000)
    expect(summary.adjustedTotal).toBe(980000)
  })

  it('AC-002: rejected and pending change orders do not affect the totals', () => {
    const base = summarizeContract({ contractAmount: 1000000, receivedAmount: 300000 }, [])
    const withOthers = summarizeContract({ contractAmount: 1000000, receivedAmount: 300000 }, [
      order(50000, 'rejected'),
      order(80000, 'pending'),
    ])
    expect(withOthers).toEqual(base)
  })

  it('AC-002: mixing statuses only sums the approved ones', () => {
    const summary = summarizeContract({ contractAmount: 500000, receivedAmount: 100000 }, [
      order(30000, 'approved'),
      order(-5000.5, 'approved'),
      order(99999, 'rejected'),
      order(12345, 'pending'),
    ])
    expect(summary.approvedChangeTotal).toBe(24999.5)
    expect(summary.adjustedTotal).toBe(524999.5)
    expect(summary.outstanding).toBe(424999.5)
  })

  it('AC-002: receiving more than the adjusted total is flagged as 溢收', () => {
    const summary = summarizeContract({ contractAmount: 100000, receivedAmount: 130000 }, [
      order(10000, 'approved'),
    ])
    expect(summary.outstanding).toBe(-20000)
    expect(summary.isOverpaid).toBe(true)
    expect(summary.overpaidAmount).toBe(20000)
  })

  it('AC-002: fully paid is not 溢收', () => {
    const summary = summarizeContract({ contractAmount: 100000, receivedAmount: 100000 }, [])
    expect(summary.outstanding).toBe(0)
    expect(summary.isOverpaid).toBe(false)
    expect(summary.overpaidAmount).toBe(0)
  })

  it('AC-002: a missing contract record counts as 0 / 0', () => {
    for (const empty of [null, undefined]) {
      expect(summarizeContract(empty, [order(1000, 'approved')])).toEqual({
        contractAmount: 0,
        approvedChangeTotal: 1000,
        adjustedTotal: 1000,
        receivedAmount: 0,
        outstanding: 1000,
        isOverpaid: false,
        overpaidAmount: 0,
      })
    }
  })

  it('AC-002: totals never produce NaN or float artefacts', () => {
    const summary = summarizeContract({ contractAmount: 0.1, receivedAmount: 0.2 }, [
      order(0.2, 'approved'),
    ])
    expect(summary.adjustedTotal).toBe(0.3)
    expect(summary.outstanding).toBe(0.1)
    for (const value of Object.values(summary)) {
      if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true)
    }
  })
})

describe('AC-002 contract validation', () => {
  it('AC-002: accepts zero and two-decimal amounts', () => {
    expect(validateContractInput({ contractAmount: 0, receivedAmount: 0 }).ok).toBe(true)
    expect(validateContractInput({ contractAmount: 1285600.5, receivedAmount: 872400.25 }).ok).toBe(true)
  })

  it('AC-002: rejects negative amounts', () => {
    const result = validateContractInput({ contractAmount: -1, receivedAmount: -0.01 })
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual([
      { field: 'contractAmount', message: '金額不可為負數' },
      { field: 'receivedAmount', message: '金額不可為負數' },
    ])
  })

  it('AC-002: rejects more than two decimal places', () => {
    const result = validateContractInput({ contractAmount: 100.123, receivedAmount: 1 })
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual([{ field: 'contractAmount', message: '金額最多兩位小數' }])
  })

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a string', 'abc' as unknown as number],
    ['undefined', undefined as unknown as number],
  ])('AC-002: rejects a non-finite received amount (%s)', (_label, receivedAmount) => {
    const result = validateContractInput({ contractAmount: 100, receivedAmount })
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual([{ field: 'receivedAmount', message: '金額必須是有限數字' }])
  })
})

describe('AC-002 amount edge cases (Codex review)', () => {
  it('AC-002: rejects tiny amounts written in exponent form', () => {
    const result = validateContractInput({ contractAmount: 0.0000001, receivedAmount: 0 })
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual([{ field: 'contractAmount', message: '金額最多兩位小數' }])
  })

  it('AC-002: rejects amounts too large to total safely', () => {
    const result = validateContractInput({ contractAmount: 1e307, receivedAmount: 1e12 })
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual([
      { field: 'contractAmount', message: '金額超出可記錄範圍' },
      { field: 'receivedAmount', message: '金額超出可記錄範圍' },
    ])
  })
})
