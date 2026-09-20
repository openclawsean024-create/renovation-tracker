// Stage summary calculator — AC-FR001-05 + AC-FR001-08 (zero-stage guard).

import { describe, expect, it } from 'vitest'
import { compareStageOrder, summarizeStages } from '../status'
import type { Stage } from '../types'

function mkStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: 'id-' + Math.random().toString(36).slice(2, 8),
    projectId: 'proj-1',
    name: 'stage',
    order: 1,
    status: 'not_started',
    plannedStart: '2026-02-09',
    plannedEnd: '2026-02-15',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('summarizeStages', () => {
  it('returns 0% when there are no stages', () => {
    const s = summarizeStages([])
    expect(s).toEqual({
      total: 0,
      completed: 0,
      inProgress: 0,
      blocked: 0,
      notStarted: 0,
      percentComplete: 0,
    })
    expect(Number.isFinite(s.percentComplete)).toBe(true)
  })

  it('counts each status correctly', () => {
    const stages = [
      mkStage({ status: 'completed' }),
      mkStage({ status: 'completed' }),
      mkStage({ status: 'in_progress' }),
      mkStage({ status: 'blocked' }),
      mkStage({ status: 'not_started' }),
      mkStage({ status: 'not_started' }),
      mkStage({ status: 'not_started' }),
    ]
    const s = summarizeStages(stages)
    expect(s.total).toBe(7)
    expect(s.completed).toBe(2)
    expect(s.inProgress).toBe(1)
    expect(s.blocked).toBe(1)
    expect(s.notStarted).toBe(3)
    // 2 / 7 ≈ 28.57 → 29
    expect(s.percentComplete).toBe(29)
  })

  it('rounds to the nearest integer', () => {
    const stages = [
      mkStage({ status: 'completed' }),
      mkStage({ status: 'completed' }),
      mkStage({ status: 'completed' }),
      mkStage({ status: 'in_progress' }),
      mkStage({ status: 'in_progress' }),
      mkStage({ status: 'in_progress' }),
      mkStage({ status: 'in_progress' }),
      mkStage({ status: 'in_progress' }),
      mkStage({ status: 'in_progress' }),
      mkStage({ status: 'in_progress' }),
    ]
    const s = summarizeStages(stages)
    // 3 / 10 = 30
    expect(s.percentComplete).toBe(30)
  })

  it('returns 100 when every stage is completed', () => {
    const stages = [
      mkStage({ status: 'completed' }),
      mkStage({ status: 'completed' }),
    ]
    expect(summarizeStages(stages).percentComplete).toBe(100)
  })

  it('never produces NaN or Infinity', () => {
    expect(Number.isFinite(summarizeStages([]).percentComplete)).toBe(true)
    const stages = [mkStage({ status: 'completed' })]
    expect(Number.isFinite(summarizeStages(stages).percentComplete)).toBe(true)
  })
})

describe('compareStageOrder', () => {
  it('orders by stage.order asc', () => {
    const a = mkStage({ id: 'a', order: 1 })
    const b = mkStage({ id: 'b', order: 2 })
    expect([b, a].sort(compareStageOrder)).toEqual([a, b])
  })

  it('tie-breaks by id for determinism', () => {
    const a = mkStage({ id: 'a', order: 1 })
    const b = mkStage({ id: 'b', order: 1 })
    expect([b, a].sort(compareStageOrder)).toEqual([a, b])
  })
})
