// Form validation tests — AC-FR001-04.

import { describe, expect, it } from 'vitest'
import {
  errorFor,
  nextOrder,
  resolveStatusDates,
  validateNewStageInput,
  validateStageInput,
} from '../validation'

describe('validateStageInput', () => {
  it('accepts well-formed input', () => {
    const r = validateStageInput({
      name: '拆除',
      status: 'not_started',
      plannedStart: '2026-02-09',
      plannedEnd: '2026-02-15',
    })
    expect(r.ok).toBe(true)
    expect(r.errors).toEqual([])
  })

  it('rejects empty name with a readable message', () => {
    const r = validateStageInput({
      name: '',
      status: 'not_started',
      plannedStart: '2026-02-09',
      plannedEnd: '2026-02-15',
    })
    expect(r.ok).toBe(false)
    expect(r.errors[0]!.field).toBe('name')
    expect(r.errors[0]!.message.length).toBeGreaterThan(0)
  })

  it('rejects whitespace-only name', () => {
    const r = validateStageInput({
      name: '   ',
      status: 'not_started',
      plannedStart: '2026-02-09',
      plannedEnd: '2026-02-15',
    })
    expect(r.ok).toBe(false)
  })

  it('rejects start date after end date', () => {
    const r = validateStageInput({
      name: '拆除',
      status: 'not_started',
      plannedStart: '2026-02-15',
      plannedEnd: '2026-02-09',
    })
    expect(r.ok).toBe(false)
    expect(errorFor(r.errors, 'plannedEnd')).toBeDefined()
  })

  it('rejects invalid date strings', () => {
    const r = validateStageInput({
      name: '拆除',
      status: 'not_started',
      plannedStart: 'bad-date',
      plannedEnd: '2026-02-09',
    })
    expect(r.ok).toBe(false)
    expect(errorFor(r.errors, 'plannedStart')).toBeDefined()
  })

  it('rejects missing dates', () => {
    const r = validateStageInput({
      name: '拆除',
      status: 'not_started',
      plannedStart: '',
      plannedEnd: '',
    })
    expect(r.ok).toBe(false)
    expect(errorFor(r.errors, 'plannedStart')).toBeDefined()
    expect(errorFor(r.errors, 'plannedEnd')).toBeDefined()
  })

  it('accepts same-day start/end (single-day stage)', () => {
    const r = validateStageInput({
      name: '拆除',
      status: 'not_started',
      plannedStart: '2026-02-09',
      plannedEnd: '2026-02-09',
    })
    expect(r.ok).toBe(true)
  })
})

describe('validateNewStageInput', () => {
  it('requires projectId', () => {
    const r = validateNewStageInput({
      name: '拆除',
      status: 'not_started',
      plannedStart: '2026-02-09',
      plannedEnd: '2026-02-15',
    })
    expect(r.ok).toBe(false)
  })

  it('passes when projectId present', () => {
    const r = validateNewStageInput({
      projectId: 'proj-1',
      name: '拆除',
      status: 'not_started',
      plannedStart: '2026-02-09',
      plannedEnd: '2026-02-15',
    })
    expect(r.ok).toBe(true)
  })
})

describe('validateStageInput — project bounds (AC-FR001-04)', () => {
  // Deterministic window: project runs the whole month of Feb 2026.
  const bounds = { plannedStart: '2026-02-01', plannedEnd: '2026-02-28' }

  it('accepts dates strictly inside the project range', () => {
    const r = validateStageInput(
      {
        name: '拆除',
        status: 'not_started',
        plannedStart: '2026-02-09',
        plannedEnd: '2026-02-15',
      },
      bounds,
    )
    expect(r.ok).toBe(true)
    expect(r.errors).toEqual([])
  })

  it('accepts dates that exactly match the project bounds (inclusive)', () => {
    const r = validateStageInput(
      {
        name: '拆除',
        status: 'not_started',
        plannedStart: bounds.plannedStart,
        plannedEnd: bounds.plannedEnd,
      },
      bounds,
    )
    expect(r.ok).toBe(true)
  })

  it('rejects plannedStart before the project plannedStart', () => {
    const r = validateStageInput(
      {
        name: '拆除',
        status: 'not_started',
        plannedStart: '2026-01-31',
        plannedEnd: '2026-02-10',
      },
      bounds,
    )
    expect(r.ok).toBe(false)
    expect(errorFor(r.errors, 'plannedStart')).toMatch(/工程日期範圍/)
  })

  it('rejects plannedStart after the project plannedEnd', () => {
    const r = validateStageInput(
      {
        name: '拆除',
        status: 'not_started',
        plannedStart: '2026-03-01',
        plannedEnd: '2026-03-05',
      },
      bounds,
    )
    expect(r.ok).toBe(false)
    expect(errorFor(r.errors, 'plannedStart')).toMatch(/工程日期範圍/)
  })

  it('rejects plannedEnd after the project plannedEnd', () => {
    const r = validateStageInput(
      {
        name: '拆除',
        status: 'not_started',
        plannedStart: '2026-02-25',
        plannedEnd: '2026-03-01',
      },
      bounds,
    )
    expect(r.ok).toBe(false)
    expect(errorFor(r.errors, 'plannedEnd')).toMatch(/工程日期範圍/)
  })

  it('rejects plannedEnd before the project plannedStart', () => {
    const r = validateStageInput(
      {
        name: '拆除',
        status: 'not_started',
        plannedStart: '2026-01-30',
        plannedEnd: '2026-01-31',
      },
      bounds,
    )
    expect(r.ok).toBe(false)
    expect(errorFor(r.errors, 'plannedEnd')).toMatch(/工程日期範圍/)
  })

  it('reports separate errors for start and end when both are out of range', () => {
    const r = validateStageInput(
      {
        name: '拆除',
        status: 'not_started',
        plannedStart: '2026-03-01',
        plannedEnd: '2026-03-05',
      },
      bounds,
    )
    expect(r.ok).toBe(false)
    expect(errorFor(r.errors, 'plannedStart')).toMatch(/工程日期範圍/)
    expect(errorFor(r.errors, 'plannedEnd')).toMatch(/工程日期範圍/)
  })

  it('does not enforce bounds when project bounds are not provided', () => {
    const r = validateStageInput({
      name: '拆除',
      status: 'not_started',
      plannedStart: '2026-02-09',
      plannedEnd: '2026-02-15',
    })
    expect(r.ok).toBe(true)
  })

  it('does not enforce bounds when project bounds themselves are invalid', () => {
    const r = validateStageInput(
      {
        name: '拆除',
        status: 'not_started',
        plannedStart: '2026-02-09',
        plannedEnd: '2026-02-15',
      },
      { plannedStart: 'bad', plannedEnd: 'also-bad' },
    )
    expect(r.ok).toBe(true)
  })

  it('does not enforce bounds when project bounds are inverted', () => {
    const r = validateStageInput(
      {
        name: '拆除',
        status: 'not_started',
        plannedStart: '2026-02-09',
        plannedEnd: '2026-02-15',
      },
      { plannedStart: '2026-03-01', plannedEnd: '2026-02-01' },
    )
    expect(r.ok).toBe(true)
  })
})

describe('validateNewStageInput — project bounds (AC-FR001-04)', () => {
  const bounds = { plannedStart: '2026-02-01', plannedEnd: '2026-02-28' }

  it('accepts dates inside the project range when projectId is present', () => {
    const r = validateNewStageInput(
      {
        projectId: 'proj-1',
        name: '拆除',
        status: 'not_started',
        plannedStart: '2026-02-09',
        plannedEnd: '2026-02-15',
      },
      bounds,
    )
    expect(r.ok).toBe(true)
  })

  it('rejects out-of-range plannedStart even when projectId is present', () => {
    const r = validateNewStageInput(
      {
        projectId: 'proj-1',
        name: '拆除',
        status: 'not_started',
        plannedStart: '2026-03-01',
        plannedEnd: '2026-03-05',
      },
      bounds,
    )
    expect(r.ok).toBe(false)
    expect(errorFor(r.errors, 'plannedStart')).toMatch(/工程日期範圍/)
  })

  it('rejects out-of-range plannedEnd even when projectId is present', () => {
    const r = validateNewStageInput(
      {
        projectId: 'proj-1',
        name: '拆除',
        status: 'not_started',
        plannedStart: '2026-02-25',
        plannedEnd: '2026-03-05',
      },
      bounds,
    )
    expect(r.ok).toBe(false)
    expect(errorFor(r.errors, 'plannedEnd')).toMatch(/工程日期範圍/)
  })
})

describe('nextOrder', () => {
  it('returns 1 for empty list', () => {
    expect(nextOrder([])).toBe(1)
  })
  it('returns max+1', () => {
    expect(nextOrder([{ order: 1 }, { order: 2 }, { order: 3 }])).toBe(4)
    expect(nextOrder([{ order: 5 }, { order: 10 }])).toBe(11)
  })
})

describe('resolveStatusDates', () => {
  it('sets actualStart on in_progress when missing', () => {
    const out = resolveStatusDates('in_progress', {}, '2026-02-09')
    expect(out.actualStart).toBe('2026-02-09')
    expect(out.actualEnd).toBeUndefined()
  })

  it('does not overwrite existing actualStart', () => {
    const out = resolveStatusDates('in_progress', { actualStart: '2026-01-01' }, '2026-02-09')
    expect(out.actualStart).toBeUndefined()
  })

  it('sets actualEnd on completed when missing', () => {
    const out = resolveStatusDates('completed', {}, '2026-02-09')
    expect(out.actualEnd).toBe('2026-02-09')
  })

  it('completed without actualStart also fills it', () => {
    const out = resolveStatusDates('completed', {}, '2026-02-09')
    expect(out.actualStart).toBe('2026-02-09')
  })

  it('blocked never auto-fills', () => {
    const out = resolveStatusDates('blocked', {}, '2026-02-09')
    expect(out.actualStart).toBeUndefined()
    expect(out.actualEnd).toBeUndefined()
  })

  it('not_started does not auto-fill', () => {
    const out = resolveStatusDates('not_started', {}, '2026-02-09')
    expect(out.actualStart).toBeUndefined()
    expect(out.actualEnd).toBeUndefined()
  })
})
