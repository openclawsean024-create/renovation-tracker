// Pure schedule domain tests — SPEC §4.6 + AC-FR005-01 / 02 / 04.

import { describe, expect, it } from 'vitest'
import {
  compareScheduleStartOn,
  dayDiff,
  filterReminders,
  isValidIsoDate,
  scheduleDateStatus,
  sortSchedulesForDisplay,
  summarizeSchedules,
} from '../schedule'
import type { ScheduleItem } from '../types'

const TODAY = '2026-09-20'

function mk(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 'sch-' + Math.random().toString(36).slice(2, 8),
    projectId: 'proj-1',
    workerName: '水電師傅',
    startOn: TODAY,
    endOn: TODAY,
    completed: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('isValidIsoDate', () => {
  it('accepts valid YYYY-MM-DD strings', () => {
    expect(isValidIsoDate('2026-02-10')).toBe(true)
    expect(isValidIsoDate('2024-12-31')).toBe(true)
  })
  it('rejects malformed strings and non-string types', () => {
    expect(isValidIsoDate('2026/02/10')).toBe(false)
    expect(isValidIsoDate('2026-2-10')).toBe(false)
    expect(isValidIsoDate('2026-13-01')).toBe(false)
    expect(isValidIsoDate('2026-02-30')).toBe(false)
    // Cast to `unknown` so TS doesn't complain about the input type.
    expect(isValidIsoDate(undefined as unknown as string)).toBe(false)
    expect(isValidIsoDate(123 as unknown as string)).toBe(false)
  })
})

describe('dayDiff', () => {
  it('returns positive when later > earlier', () => {
    expect(dayDiff('2026-02-10', '2026-02-07')).toBe(3)
  })
  it('returns zero on the same date', () => {
    expect(dayDiff('2026-02-10', '2026-02-10')).toBe(0)
  })
  it('returns negative when earlier > later', () => {
    expect(dayDiff('2026-02-07', '2026-02-10')).toBe(-3)
  })
})

describe('scheduleDateStatus — AC-FR005-01', () => {
  it('returns "completed" when completed=true regardless of dates', () => {
    expect(scheduleDateStatus(mk({ startOn: '2026-09-01', endOn: '2026-09-01', completed: true }), TODAY)).toBe('completed')
  })
  it('returns "overdue" when endOn is before today and not completed', () => {
    expect(scheduleDateStatus(mk({ startOn: '2026-09-01', endOn: '2026-09-10' }), TODAY)).toBe('overdue')
  })
  it('returns "not_started" when startOn is after today', () => {
    expect(scheduleDateStatus(mk({ startOn: '2026-10-01', endOn: '2026-10-05' }), TODAY)).toBe('not_started')
  })
  it('returns "today" when startOn equals today', () => {
    expect(scheduleDateStatus(mk({ startOn: TODAY, endOn: TODAY }), TODAY)).toBe('today')
  })
  it('returns "in_progress" when today is between startOn and endOn inclusive', () => {
    expect(scheduleDateStatus(mk({ startOn: '2026-09-18', endOn: '2026-09-25' }), TODAY)).toBe('in_progress')
  })
})

describe('compareScheduleStartOn — AC-FR005-04 list ordering', () => {
  it('orders by startOn ascending', () => {
    const a = mk({ id: 'a', startOn: '2026-09-15', endOn: '2026-09-20' })
    const b = mk({ id: 'b', startOn: '2026-09-10', endOn: '2026-09-12' })
    const c = mk({ id: 'c', startOn: '2026-09-20', endOn: '2026-09-22' })
    const sorted = sortSchedulesForDisplay([a, b, c])
    expect(sorted.map((s) => s.id)).toEqual(['b', 'a', 'c'])
  })
  it('uses endOn + id as deterministic tiebreakers', () => {
    const a = mk({ id: 'a', startOn: '2026-09-15', endOn: '2026-09-22' })
    const b = mk({ id: 'b', startOn: '2026-09-15', endOn: '2026-09-18' })
    const c = mk({ id: 'c', startOn: '2026-09-15', endOn: '2026-09-22' })
    const sorted = sortSchedulesForDisplay([a, b, c])
    expect(sorted.map((s) => s.id)).toEqual(['b', 'a', 'c'])
  })
  it('compareScheduleStartOn returns 0 for identical records', () => {
    const a = mk({ id: 'x', startOn: '2026-09-15', endOn: '2026-09-20' })
    const b = mk({ id: 'x', startOn: '2026-09-15', endOn: '2026-09-20' })
    expect(compareScheduleStartOn(a, b)).toBe(0)
  })
})

describe('summarizeSchedules — AC-FR005-04', () => {
  it('returns all-zero counts when no schedules exist', () => {
    expect(summarizeSchedules([], TODAY)).toEqual({
      total: 0,
      upcoming: 0,
      overdue: 0,
      completed: 0,
    })
  })
  it('partitions schedules into upcoming / overdue / completed buckets', () => {
    const items: ScheduleItem[] = [
      mk({ id: 'a', startOn: '2026-10-01', endOn: '2026-10-05' }), // upcoming
      mk({ id: 'b', startOn: '2026-09-10', endOn: '2026-09-18' }), // overdue
      mk({ id: 'c', startOn: '2026-09-15', endOn: '2026-09-25', completed: true }), // completed
      mk({ id: 'd', startOn: TODAY, endOn: '2026-09-25' }), // upcoming (in_progress)
    ]
    expect(summarizeSchedules(items, TODAY)).toEqual({
      total: 4,
      upcoming: 2,
      overdue: 1,
      completed: 1,
    })
  })
})

describe('filterReminders — AC-FR005-01', () => {
  it('excludes completed schedules', () => {
    const items: ScheduleItem[] = [
      mk({ id: 'a', startOn: TODAY, endOn: TODAY, reminderOn: TODAY, completed: true }),
    ]
    expect(filterReminders(items, TODAY)).toEqual([])
  })
  it('excludes schedules without a reminderOn', () => {
    const items: ScheduleItem[] = [
      mk({ id: 'a', startOn: TODAY, endOn: '2026-09-30' }),
    ]
    expect(filterReminders(items, TODAY)).toEqual([])
  })
  it('includes schedules whose reminder is overdue', () => {
    const items: ScheduleItem[] = [
      mk({ id: 'a', startOn: '2026-09-20', endOn: '2026-09-30', reminderOn: '2026-09-15' }),
    ]
    const out = filterReminders(items, TODAY)
    expect(out.map((s) => s.id)).toEqual(['a'])
  })
  it('includes schedules whose reminder is within 7 days from today', () => {
    const items: ScheduleItem[] = [
      mk({ id: 'a', startOn: '2026-09-22', endOn: '2026-09-30', reminderOn: '2026-09-22' }),
      mk({ id: 'b', startOn: '2026-09-27', endOn: '2026-10-02', reminderOn: '2026-09-27' }),
    ]
    const out = filterReminders(items, TODAY)
    expect(out.map((s) => s.id).sort()).toEqual(['a', 'b'])
  })
  it('excludes reminders whose reminderOn is more than 7 days away', () => {
    const items: ScheduleItem[] = [
      mk({ id: 'a', startOn: '2026-10-15', endOn: '2026-10-20', reminderOn: '2026-10-15' }),
    ]
    expect(filterReminders(items, TODAY)).toEqual([])
  })
  it('excludes windows that have ended long ago (endOn < today-1)', () => {
    const items: ScheduleItem[] = [
      mk({ id: 'a', startOn: '2026-08-01', endOn: '2026-08-05', reminderOn: '2026-07-25' }),
    ]
    expect(filterReminders(items, TODAY)).toEqual([])
  })
  it('sorts the result by reminderOn ascending', () => {
    const items: ScheduleItem[] = [
      mk({ id: 'later', startOn: '2026-09-25', endOn: '2026-09-30', reminderOn: '2026-09-25' }),
      mk({ id: 'earlier', startOn: '2026-09-21', endOn: '2026-09-25', reminderOn: '2026-09-21' }),
    ]
    const out = filterReminders(items, TODAY)
    expect(out.map((s) => s.id)).toEqual(['earlier', 'later'])
  })
})
