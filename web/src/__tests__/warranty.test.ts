// Pure warranty domain tests — SPEC §4.7 + §11 + AC-FR006-01～04.
// Covers validation, date status, sort, summary, and "expiring soon" logic.

import { describe, expect, it } from 'vitest'
import {
  compareWarrantyEndsOn,
  daysUntilEnd,
  emptyWarrantyErrors,
  hasWarrantyExpired,
  hasWarrantyExpiringSoon,
  isWarrantyExpiringSoon,
  isWarrantyValid,
  sortWarrantiesForDisplay,
  summarizeWarranties,
  validateNewWarrantyInput,
  validateWarrantyEditInput,
  warrantyDateStatus,
} from '../warranty'
import {
  WARRANTY_DATE_STATUSES,
  WARRANTY_EXPIRING_WINDOW_DAYS,
  type NewWarrantyItemInput,
  type WarrantyRecord,
} from '../types'

const TODAY = '2026-09-20'

function mkRecord(overrides: Partial<WarrantyRecord> = {}): WarrantyRecord {
  return {
    id: 'w-' + Math.random().toString(36).slice(2, 8),
    projectId: 'proj-1',
    itemName: '磁磚保固',
    provider: '里歐建材',
    contact: '0912345678',
    startsOn: '2026-01-01',
    endsOn: '2026-12-31',
    note: '客廳',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function mkNewInput(overrides: Partial<NewWarrantyItemInput> = {}): NewWarrantyItemInput {
  return {
    projectId: 'proj-1',
    itemName: '磁磚保固',
    provider: '里歐建材',
    contact: '0912345678',
    startsOn: '2026-01-01',
    endsOn: '2026-12-31',
    note: '客廳',
    ...overrides,
  }
}

describe('validateNewWarrantyInput — AC-FR006-02', () => {
  it('accepts a fully-populated valid payload', () => {
    expect(isWarrantyValid(validateNewWarrantyInput(mkNewInput()))).toBe(true)
  })

  it('rejects an empty itemName', () => {
    const errors = validateNewWarrantyInput(mkNewInput({ itemName: '' }))
    expect(errors.itemName).toBeTruthy()
    expect(errors.provider).toBeUndefined()
    expect(errors.startsOn).toBeUndefined()
    expect(errors.endsOn).toBeUndefined()
  })

  it('rejects whitespace-only itemName', () => {
    const errors = validateNewWarrantyInput(mkNewInput({ itemName: '   ' }))
    expect(errors.itemName).toBeTruthy()
  })

  it('rejects an empty provider', () => {
    const errors = validateNewWarrantyInput(mkNewInput({ provider: '' }))
    expect(errors.provider).toBeTruthy()
  })

  it('accepts an empty contact / note (optional fields)', () => {
    const errors = validateNewWarrantyInput(
      mkNewInput({ contact: '', note: undefined }),
    )
    expect(errors.contact).toBeUndefined()
    expect(errors.note).toBeUndefined()
  })

  it('rejects a non-ISO startsOn', () => {
    const errors = validateNewWarrantyInput(mkNewInput({ startsOn: '2026/01/01' }))
    expect(errors.startsOn).toBeTruthy()
  })

  it('rejects a non-ISO endsOn', () => {
    const errors = validateNewWarrantyInput(mkNewInput({ endsOn: '20261231' }))
    expect(errors.endsOn).toBeTruthy()
  })

  it('rejects endsOn < startsOn', () => {
    const errors = validateNewWarrantyInput(
      mkNewInput({ startsOn: '2026-06-01', endsOn: '2026-05-01' }),
    )
    expect(errors.endsOn).toBeTruthy()
  })

  it('accepts endsOn === startsOn (single-day warranty)', () => {
    const errors = validateNewWarrantyInput(
      mkNewInput({ startsOn: '2026-06-01', endsOn: '2026-06-01' }),
    )
    expect(errors.endsOn).toBeUndefined()
    expect(isWarrantyValid(errors)).toBe(true)
  })

  it('surfaces multiple errors at once', () => {
    const errors = validateNewWarrantyInput(
      mkNewInput({ itemName: '', provider: '', startsOn: '', endsOn: '' }),
    )
    expect(errors.itemName).toBeTruthy()
    expect(errors.provider).toBeTruthy()
    expect(errors.startsOn).toBeTruthy()
    expect(errors.endsOn).toBeTruthy()
  })
})

describe('validateWarrantyEditInput', () => {
  it('shares the same rules as create', () => {
    const errors = validateWarrantyEditInput({
      itemName: '',
      provider: 'x',
      contact: undefined,
      startsOn: '2026-01-01',
      endsOn: '2026-01-02',
      note: undefined,
    })
    expect(errors.itemName).toBeTruthy()
  })

  it('returns the empty errors object from emptyWarrantyErrors()', () => {
    expect(emptyWarrantyErrors()).toEqual({})
    expect(isWarrantyValid(emptyWarrantyErrors())).toBe(true)
  })
})

describe('warrantyDateStatus — AC-FR006-02', () => {
  it('returns "not_started" when startsOn is after today', () => {
    expect(
      warrantyDateStatus(mkRecord({ startsOn: '2026-12-01', endsOn: '2027-01-01' }), TODAY),
    ).toBe('not_started')
  })

  it('returns "active" when today is inside [startsOn, endsOn]', () => {
    expect(
      warrantyDateStatus(mkRecord({ startsOn: '2026-09-01', endsOn: '2026-09-30' }), TODAY),
    ).toBe('active')
  })

  it('returns "active" when today equals startsOn (inclusive)', () => {
    expect(
      warrantyDateStatus(mkRecord({ startsOn: TODAY, endsOn: '2027-01-01' }), TODAY),
    ).toBe('active')
  })

  it('returns "active" when today equals endsOn (inclusive)', () => {
    expect(
      warrantyDateStatus(mkRecord({ startsOn: '2026-01-01', endsOn: TODAY }), TODAY),
    ).toBe('active')
  })

  it('returns "expired" when endsOn is strictly before today', () => {
    expect(
      warrantyDateStatus(mkRecord({ startsOn: '2025-01-01', endsOn: '2025-12-31' }), TODAY),
    ).toBe('expired')
  })

  it('falls back to "not_started" for invalid dates (graceful display)', () => {
    expect(warrantyDateStatus(mkRecord({ startsOn: '', endsOn: '' }), TODAY)).toBe('not_started')
    expect(warrantyDateStatus(mkRecord({ startsOn: 'bad', endsOn: 'bad' }), TODAY)).toBe('not_started')
  })

  it('the three values cover all valid records', () => {
    expect(WARRANTY_DATE_STATUSES).toEqual(['not_started', 'active', 'expired'])
  })
})

describe('daysUntilEnd', () => {
  it('returns positive integer for future endsOn', () => {
    expect(daysUntilEnd(mkRecord({ endsOn: '2026-10-20' }), TODAY)).toBe(30)
  })

  it('returns 0 when endsOn equals today', () => {
    expect(daysUntilEnd(mkRecord({ endsOn: TODAY }), TODAY)).toBe(0)
  })

  it('returns negative when endsOn is in the past', () => {
    expect(daysUntilEnd(mkRecord({ endsOn: '2026-09-10' }), TODAY)).toBe(-10)
  })

  it('returns NaN when endsOn is invalid', () => {
    expect(Number.isNaN(daysUntilEnd(mkRecord({ endsOn: 'bad' }), TODAY))).toBe(true)
  })
})

describe('isWarrantyExpiringSoon — AC-FR006-03 (30-day window)', () => {
  it('returns false when status is not_started', () => {
    expect(
      isWarrantyExpiringSoon(mkRecord({ startsOn: '2026-12-01', endsOn: '2027-01-15' }), TODAY),
    ).toBe(false)
  })

  it('returns false when status is expired', () => {
    expect(
      isWarrantyExpiringSoon(mkRecord({ startsOn: '2025-01-01', endsOn: '2025-12-31' }), TODAY),
    ).toBe(false)
  })

  it('returns true when endsOn equals today (boundary)', () => {
    expect(
      isWarrantyExpiringSoon(mkRecord({ startsOn: '2026-09-01', endsOn: TODAY }), TODAY),
    ).toBe(true)
  })

  it('returns true when endsOn is exactly 30 days away', () => {
    expect(
      isWarrantyExpiringSoon(
        mkRecord({ startsOn: '2026-09-01', endsOn: '2026-10-20' }),
        TODAY,
      ),
    ).toBe(true)
    // Sanity: the constant matches our AC.
    expect(WARRANTY_EXPIRING_WINDOW_DAYS).toBe(30)
  })

  it('returns false when endsOn is 31 days away (just outside the window)', () => {
    expect(
      isWarrantyExpiringSoon(
        mkRecord({ startsOn: '2026-09-01', endsOn: '2026-10-21' }),
        TODAY,
      ),
    ).toBe(false)
  })

  it('returns false when endsOn is far in the future', () => {
    expect(
      isWarrantyExpiringSoon(
        mkRecord({ startsOn: '2026-09-01', endsOn: '2027-12-31' }),
        TODAY,
      ),
    ).toBe(false)
  })
})

describe('sortWarrantiesForDisplay — AC-FR006-02 list ordering', () => {
  it('orders by endsOn ascending', () => {
    const a = mkRecord({ id: 'a', endsOn: '2027-12-31' })
    const b = mkRecord({ id: 'b', endsOn: '2026-09-15' })
    const c = mkRecord({ id: 'c', endsOn: '2026-10-01' })
    expect(sortWarrantiesForDisplay([a, b, c]).map((w) => w.id)).toEqual(['b', 'c', 'a'])
  })

  it('breaks ties by itemName when endsOn is identical', () => {
    // Use Latin alphabetic names so the tie-break is unambiguous regardless of
    // which Chinese collation the test runner picks. The function still uses
    // zh-Hant locale when both names are Chinese.
    const a = mkRecord({ id: 'a', itemName: 'Tile', endsOn: '2027-12-31' })
    const b = mkRecord({ id: 'b', itemName: 'Paint', endsOn: '2027-12-31' })
    expect(sortWarrantiesForDisplay([a, b]).map((w) => w.id)).toEqual(['b', 'a'])
  })

  it('does not mutate the input array', () => {
    const a = mkRecord({ id: 'a', endsOn: '2027-12-31' })
    const b = mkRecord({ id: 'b', endsOn: '2026-09-15' })
    const input = [a, b]
    sortWarrantiesForDisplay(input)
    expect(input.map((w) => w.id)).toEqual(['a', 'b'])
  })

  it('compareWarrantyEndsOn returns 0 for identical records', () => {
    const a = mkRecord({ id: 'x', endsOn: '2027-12-31' })
    const b = mkRecord({ id: 'x', endsOn: '2027-12-31' })
    expect(compareWarrantyEndsOn(a, b)).toBe(0)
  })
})

describe('summarizeWarranties — AC-FR006-04 summary', () => {
  it('returns all-zero counts for an empty list', () => {
    expect(summarizeWarranties([], TODAY)).toEqual({
      total: 0,
      active: 0,
      expiringSoon: 0,
      expired: 0,
      notStarted: 0,
    })
  })

  it('partitions records into active / expired / notStarted and counts expiring soon', () => {
    const items: WarrantyRecord[] = [
      // active — 60 days away (NOT expiring soon)
      mkRecord({ id: 'active-far', startsOn: '2026-09-01', endsOn: '2026-11-19' }),
      // active — today (expiring + expired status same day, since expired needs endsOn < today)
      mkRecord({ id: 'active-today', startsOn: '2026-09-01', endsOn: TODAY }),
      // active — 25 days away (expiring)
      mkRecord({ id: 'active-soon', startsOn: '2026-09-01', endsOn: '2026-10-15' }),
      // expired
      mkRecord({ id: 'old', startsOn: '2025-01-01', endsOn: '2025-12-31' }),
      // not started
      mkRecord({ id: 'future', startsOn: '2026-12-01', endsOn: '2027-12-31' }),
    ]
    expect(summarizeWarranties(items, TODAY)).toEqual({
      total: 5,
      active: 3,
      expiringSoon: 2,
      expired: 1,
      notStarted: 1,
    })
  })

  it('does not double-count expired items as expiringSoon', () => {
    const items = [mkRecord({ id: 'old', startsOn: '2025-01-01', endsOn: '2025-12-31' })]
    const summary = summarizeWarranties(items, TODAY)
    expect(summary.expired).toBe(1)
    expect(summary.expiringSoon).toBe(0)
    expect(summary.active).toBe(0)
  })
})

describe('hasWarrantyExpiringSoon / hasWarrantyExpired — banner gating', () => {
  it('hasWarrantyExpiringSoon returns false on an empty list', () => {
    expect(hasWarrantyExpiringSoon([], TODAY)).toBe(false)
  })

  it('hasWarrantyExpired returns false on an empty list', () => {
    expect(hasWarrantyExpired([], TODAY)).toBe(false)
  })

  it('hasWarrantyExpiringSoon returns true when an active warranty is within 30 days', () => {
    expect(
      hasWarrantyExpiringSoon(
        [mkRecord({ startsOn: '2026-09-01', endsOn: '2026-10-01' })],
        TODAY,
      ),
    ).toBe(true)
  })

  it('hasWarrantyExpired returns true when at least one record is past its end date', () => {
    expect(
      hasWarrantyExpired(
        [
          mkRecord({ startsOn: '2025-01-01', endsOn: '2025-12-31' }),
          mkRecord({ startsOn: '2026-01-01', endsOn: '2027-01-01' }),
        ],
        TODAY,
      ),
    ).toBe(true)
  })

  it('hasWarrantyExpired returns false when no record is past its end date', () => {
    expect(
      hasWarrantyExpired(
        [mkRecord({ startsOn: '2026-01-01', endsOn: '2027-01-01' })],
        TODAY,
      ),
    ).toBe(false)
  })
})