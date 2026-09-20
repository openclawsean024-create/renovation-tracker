// Gantt chart layout tests — AC-FR001-06 (cross-month + single-day stages).

import { describe, expect, it } from 'vitest'
import { dayGridTemplate, layoutGantt, stageSpan } from '../gantt'
import type { Project, Stage } from '../types'

function mkProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: '我的裝修工程',
    status: 'planning',
    plannedStart: '2026-01-05',
    plannedEnd: '2026-02-13',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function mkStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: 'id-' + Math.random().toString(36).slice(2, 8),
    projectId: 'proj-1',
    name: 'stage',
    order: 1,
    status: 'not_started',
    plannedStart: '2026-01-05',
    plannedEnd: '2026-01-09',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('layoutGantt', () => {
  it('produces one entry per project day', () => {
    const p = mkProject({ plannedStart: '2026-01-05', plannedEnd: '2026-01-11' })
    const layout = layoutGantt(p, [])
    expect(layout.days).toHaveLength(7)
    expect(layout.days[0]).toBe('2026-01-05')
    expect(layout.days[6]).toBe('2026-01-11')
    expect(layout.totalDays).toBe(7)
  })

  it('lays a stage across the correct day indices (cross-month case)', () => {
    const p = mkProject({ plannedStart: '2026-01-25', plannedEnd: '2026-02-13' })
    const stage = mkStage({
      plannedStart: '2026-01-28',
      plannedEnd: '2026-02-05',
    })
    const layout = layoutGantt(p, [stage])
    expect(layout.days[0]).toBe('2026-01-25')
    expect(layout.days.at(-1)).toBe('2026-02-13')
    const row = layout.rows[0]!
    // 2026-01-25 is index 0; 2026-01-28 is index 3; 2026-02-05 is index 11
    // (7 Jan days + 5 Feb days = 12 days, so last index = 11).
    expect(row.startIndex).toBe(3)
    expect(row.endIndex).toBe(11)
    expect(row.span).toBe(9) // inclusive span: 2026-01-28 .. 2026-02-05 = 9 days
    expect(row.withinWindow).toBe(true)
  })

  it('handles a single-day stage (AC-FR001-06 single-day case)', () => {
    const p = mkProject({ plannedStart: '2026-01-05', plannedEnd: '2026-01-15' })
    const stage = mkStage({
      plannedStart: '2026-01-09',
      plannedEnd: '2026-01-09',
    })
    const layout = layoutGantt(p, [stage])
    const row = layout.rows[0]!
    expect(row.startIndex).toBe(4)
    expect(row.endIndex).toBe(4)
    expect(row.span).toBe(1)
  })

  it('clamps a stage that starts before the project', () => {
    const p = mkProject({ plannedStart: '2026-01-10', plannedEnd: '2026-01-20' })
    const stage = mkStage({
      plannedStart: '2026-01-05',
      plannedEnd: '2026-01-15',
    })
    const layout = layoutGantt(p, [stage])
    const row = layout.rows[0]!
    expect(row.startIndex).toBe(0)
    expect(row.endIndex).toBe(5) // 2026-01-15 is index 5
    expect(row.withinWindow).toBe(false)
  })

  it('clamps a stage that ends after the project', () => {
    const p = mkProject({ plannedStart: '2026-01-05', plannedEnd: '2026-01-15' })
    const stage = mkStage({
      plannedStart: '2026-01-12',
      plannedEnd: '2026-01-25',
    })
    const layout = layoutGantt(p, [stage])
    const row = layout.rows[0]!
    expect(row.endIndex).toBe(10) // 2026-01-15
    expect(row.withinWindow).toBe(false)
  })

  it('handles a stage that spans two months correctly (regression)', () => {
    // The §5.4 contract explicitly requires that month-crossing stages use
    // day-level columns (not just month labels). We assert the bar's left /
    // right edges map to the day indices at the month boundary.
    const p = mkProject({ plannedStart: '2026-01-25', plannedEnd: '2026-02-08' })
    const stage = mkStage({
      plannedStart: '2026-01-30',
      plannedEnd: '2026-02-04',
    })
    const layout = layoutGantt(p, [stage])
    // 2026-01-25 → idx 0, ..., 2026-01-30 → idx 5, 2026-02-04 → idx 10
    // (7 Jan days + 4 Feb days = 11 days, so last index = 10).
    const row = layout.rows[0]!
    expect(row.startIndex).toBe(5)
    expect(row.endIndex).toBe(10)
    expect(row.span).toBe(6)
    // Verify the actual day list contains the month boundary on the correct index.
    expect(layout.days[6]).toBe('2026-01-31')
    expect(layout.days[7]).toBe('2026-02-01')
  })
})

describe('dayGridTemplate / stageSpan', () => {
  it('returns a CSS repeat() expression', () => {
    expect(dayGridTemplate(10)).toContain('repeat(10')
    expect(dayGridTemplate(0)).toContain('repeat(1')
  })

  it('computes inclusive day span', () => {
    expect(stageSpan({ plannedStart: '2026-01-05', plannedEnd: '2026-01-09' })).toBe(5)
    expect(stageSpan({ plannedStart: '2026-01-05', plannedEnd: '2026-01-05' })).toBe(1)
  })
})
