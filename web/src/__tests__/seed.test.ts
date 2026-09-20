// Seed-data tests — AC-FR001-01.

import { describe, expect, it } from 'vitest'
import { buildSeed, SEED_STAGE_NAMES } from '../seed'
import { dayCountInclusive, isWithinRange } from '../dates'

describe('buildSeed', () => {
  const fixedId = (() => {
    let n = 0
    return () => `id-${(++n).toString().padStart(4, '0')}`
  })()
  const fixedNow = () => '2026-01-01T00:00:00.000Z'

  it('creates exactly seven stages in the §4.3 order', () => {
    const { stages } = buildSeed({ idFactory: fixedId, now: fixedNow })
    expect(stages).toHaveLength(7)
    expect(stages.map((s) => s.name)).toEqual([...SEED_STAGE_NAMES])
    expect(stages.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('lays stages back-to-back without gaps or overlap', () => {
    const { stages } = buildSeed({ idFactory: fixedId, now: fixedNow })
    for (let i = 1; i < stages.length; i++) {
      const prev = stages[i - 1]!
      const cur = stages[i]!
      // next stage starts the day after previous ends
      const expectedStart = (() => {
        const d = new Date(prev.plannedEnd + 'T00:00:00')
        d.setDate(d.getDate() + 1)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${dd}`
      })()
      expect(cur.plannedStart).toBe(expectedStart)
    }
  })

  it('keeps every stage inside the project window', () => {
    const { project, stages } = buildSeed({ idFactory: fixedId, now: fixedNow })
    for (const s of stages) {
      expect(isWithinRange(s.plannedStart, project.plannedStart, project.plannedEnd)).toBe(true)
      expect(isWithinRange(s.plannedEnd, project.plannedStart, project.plannedEnd)).toBe(true)
    }
  })

  it('uses a non-empty project name and defaults to planning', () => {
    const { project } = buildSeed({ idFactory: fixedId, now: fixedNow })
    expect(project.name.length).toBeGreaterThan(0)
    expect(project.status).toBe('planning')
  })

  it('seeds stages with status "not_started" and no actual dates', () => {
    const { stages } = buildSeed({ idFactory: fixedId, now: fixedNow })
    for (const s of stages) {
      expect(s.status).toBe('not_started')
      expect(s.actualStart).toBeUndefined()
      expect(s.actualEnd).toBeUndefined()
    }
  })

  it('every stage has a positive inclusive day span', () => {
    const { stages } = buildSeed({ idFactory: fixedId, now: fixedNow })
    for (const s of stages) {
      const n = dayCountInclusive(s.plannedStart, s.plannedEnd)
      expect(n).toBeGreaterThan(0)
    }
  })

  it('uses the deterministic reference start by default', () => {
    const { project, stages } = buildSeed({ idFactory: fixedId, now: fixedNow })
    expect(project.plannedStart).toBe('2026-01-05')
    expect(stages[0]!.plannedStart).toBe('2026-01-05')
  })

  it('respects referenceStart override for deterministic cross-month tests', () => {
    // Reference start chosen so several stages land in February 2026.
    const { project, stages } = buildSeed({
      idFactory: fixedId,
      now: fixedNow,
      referenceStart: '2026-01-25',
    })
    expect(project.plannedStart).toBe('2026-01-25')
    // The first 3 stages (5+5+5 = 15 days) should land inside January
    expect(stages[0]!.plannedEnd).toBe('2026-01-29')
    expect(stages[2]!.plannedEnd).toBe('2026-02-08')
  })

  it('back-fills projectId on every stage', () => {
    const { project, stages } = buildSeed({ idFactory: fixedId, now: fixedNow })
    for (const s of stages) {
      expect(s.projectId).toBe(project.id)
    }
  })
})
