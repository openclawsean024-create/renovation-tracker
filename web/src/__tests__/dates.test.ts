// Date utility tests — covers AC-FR001-06 helpers.

import { describe, expect, it } from 'vitest'
import {
  addDays,
  dayCountInclusive,
  eachDay,
  formatLocalISO,
  isISODate,
  isOnOrBefore,
  isWithinRange,
  monthSpans,
  parseISODate,
  sameDay,
  todayISO,
} from '../dates'

describe('parseISODate / isISODate', () => {
  it('parses well-formed dates', () => {
    const d = parseISODate('2026-02-09')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(1) // February (0-indexed)
    expect(d!.getDate()).toBe(9)
  })
  it('rejects malformed dates', () => {
    expect(isISODate('not-a-date')).toBe(false)
    expect(isISODate('2026-13-01')).toBe(false)
    expect(isISODate('2026-02-30')).toBe(false)
    expect(isISODate('')).toBe(false)
  })
  it('does not shift by a day on negative-UTC zones', () => {
    // Use a date that is famously TZ-sensitive: 2026-01-01 in Asia/Tokyo is
    // 2025-12-31 in UTC. Our helpers must treat the string as the local date.
    const iso = '2026-01-01'
    expect(isISODate(iso)).toBe(true)
    const d = parseISODate(iso)!
    expect(formatLocalISO(d)).toBe(iso)
  })
})

describe('dayCountInclusive', () => {
  it('returns 1 for a single-day window', () => {
    expect(dayCountInclusive('2026-02-09', '2026-02-09')).toBe(1)
  })
  it('handles multi-day windows', () => {
    expect(dayCountInclusive('2026-02-09', '2026-02-15')).toBe(7)
    expect(dayCountInclusive('2026-02-28', '2026-03-01')).toBe(2) // crosses month
  })
  it('returns NaN for invalid input', () => {
    expect(Number.isNaN(dayCountInclusive('bad', '2026-02-09'))).toBe(true)
  })
})

describe('isOnOrBefore / isWithinRange', () => {
  it('compares dates without timezone drift', () => {
    expect(isOnOrBefore('2026-02-09', '2026-02-09')).toBe(true)
    expect(isOnOrBefore('2026-02-09', '2026-02-10')).toBe(true)
    expect(isOnOrBefore('2026-02-10', '2026-02-09')).toBe(false)
  })
  it('range check is inclusive on both ends', () => {
    expect(isWithinRange('2026-02-09', '2026-02-09', '2026-02-15')).toBe(true)
    expect(isWithinRange('2026-02-15', '2026-02-09', '2026-02-15')).toBe(true)
    expect(isWithinRange('2026-02-08', '2026-02-09', '2026-02-15')).toBe(false)
  })
})

describe('eachDay', () => {
  it('enumerates single-day windows', () => {
    expect(eachDay('2026-02-09', '2026-02-09')).toEqual(['2026-02-09'])
  })
  it('enumerates across months', () => {
    expect(eachDay('2026-01-30', '2026-02-02')).toEqual([
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ])
  })
  it('handles leap year', () => {
    expect(eachDay('2028-02-28', '2028-03-01')).toEqual([
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ])
  })
})

describe('addDays', () => {
  it('moves forward across months', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
  it('moves backward', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('monthSpans', () => {
  it('groups consecutive days by year-month', () => {
    const spans = monthSpans(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02'])
    expect(spans).toEqual([
      { label: '2026-01', from: 0, to: 1 },
      { label: '2026-02', from: 2, to: 3 },
    ])
  })
  it('returns empty list for empty input', () => {
    expect(monthSpans([])).toEqual([])
  })
})

describe('sameDay / todayISO', () => {
  it('compares strings without drift', () => {
    expect(sameDay('2026-02-09', '2026-02-09')).toBe(true)
    expect(sameDay('2026-02-09', '2026-02-10')).toBe(false)
  })
  it('todayISO matches local Date', () => {
    const expected = formatLocalISO(new Date())
    expect(todayISO()).toBe(expected)
  })
})
