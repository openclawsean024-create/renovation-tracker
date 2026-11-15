// AC-004 (FR-010) — photo progress report grouping. Pure domain tests.

import { describe, expect, it } from 'vitest'
import {
  PHOTO_REPORT_EMPTY_LABEL,
  PHOTO_REPORT_UNASSIGNED_LABEL,
  buildPhotoReport,
  formatPhotoReportCount,
} from '../photoReport'

interface P {
  id: string
  stageId?: string
  takenOn: string
  createdAt: string
  caption?: string
}

const stages = [
  { id: 'stage-wood', name: '木作', order: 3 },
  { id: 'stage-demo', name: '拆除', order: 1 },
  { id: 'stage-water', name: '水電', order: 2 },
]

function photo(overrides: Partial<P> & { id: string }): P {
  return {
    takenOn: '2026-01-10',
    createdAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  }
}

describe('AC-004 photo progress report', () => {
  it('AC-004: stages are listed by stage order, not by input order', () => {
    const report = buildPhotoReport(stages, [])
    expect(report.stages.map((g) => g.stageName)).toEqual(['拆除', '水電', '木作'])
    expect(report.stages.map((g) => g.stageId)).toEqual(['stage-demo', 'stage-water', 'stage-wood'])
  })

  it('AC-004: each stage reports its photo count and latest shooting date', () => {
    const report = buildPhotoReport(stages, [
      photo({ id: 'p1', stageId: 'stage-demo', takenOn: '2026-01-06' }),
      photo({ id: 'p2', stageId: 'stage-demo', takenOn: '2026-01-08' }),
      photo({ id: 'p3', stageId: 'stage-demo', takenOn: '2026-01-07' }),
      photo({ id: 'p4', stageId: 'stage-water', takenOn: '2026-01-15' }),
    ])
    const demo = report.stages[0]!
    expect(demo.count).toBe(3)
    expect(demo.latestTakenOn).toBe('2026-01-08')
    expect(demo.latestPhoto?.id).toBe('p2')
    const water = report.stages[1]!
    expect(water.count).toBe(1)
    expect(water.latestTakenOn).toBe('2026-01-15')
    expect(report.totalPhotos).toBe(4)
  })

  it('AC-004: the latest photo carries its caption for the report', () => {
    const report = buildPhotoReport(stages, [
      photo({ id: 'old', stageId: 'stage-demo', takenOn: '2026-01-06', caption: '示範：拆除前' }),
      photo({ id: 'new', stageId: 'stage-demo', takenOn: '2026-01-09', caption: '示範：拆除完成' }),
    ])
    expect(report.stages[0]!.latestPhoto?.caption).toBe('示範：拆除完成')
  })

  it('AC-004: same-day photos are ordered by createdAt, then id', () => {
    const report = buildPhotoReport(stages, [
      photo({ id: 'b', stageId: 'stage-demo', createdAt: '2026-01-10T09:00:00.000Z' }),
      photo({ id: 'a', stageId: 'stage-demo', createdAt: '2026-01-10T11:00:00.000Z' }),
      photo({ id: 'c', stageId: 'stage-demo', createdAt: '2026-01-10T10:00:00.000Z' }),
    ])
    expect(report.stages[0]!.latestPhoto?.id).toBe('a')
    const tie = buildPhotoReport(stages, [
      photo({ id: 'z', stageId: 'stage-demo' }),
      photo({ id: 'y', stageId: 'stage-demo' }),
    ])
    expect(tie.stages[0]!.latestPhoto?.id).toBe('y')
  })

  it('AC-004: photos without a stage go to 未分類', () => {
    const report = buildPhotoReport(stages, [
      photo({ id: 'p1', takenOn: '2026-01-03' }),
      photo({ id: 'p2', takenOn: '2026-01-04' }),
      photo({ id: 'p3', stageId: 'stage-demo' }),
    ])
    expect(report.unassigned.stageName).toBe(PHOTO_REPORT_UNASSIGNED_LABEL)
    expect(report.unassigned.stageName).toBe('未分類')
    expect(report.unassigned.stageId).toBeNull()
    expect(report.unassigned.count).toBe(2)
    expect(report.unassigned.latestTakenOn).toBe('2026-01-04')
  })

  it('AC-004: photos pointing at a deleted stage also go to 未分類', () => {
    const report = buildPhotoReport(stages, [photo({ id: 'p1', stageId: 'stage-gone' })])
    expect(report.unassigned.count).toBe(1)
    expect(report.stages.every((g) => g.count === 0)).toBe(true)
  })

  it('AC-004: stages without photos stay in the report with no latest photo', () => {
    const report = buildPhotoReport(stages, [photo({ id: 'p1', stageId: 'stage-water' })])
    const demo = report.stages[0]!
    expect(demo.count).toBe(0)
    expect(demo.latestTakenOn).toBeUndefined()
    expect(demo.latestPhoto).toBeUndefined()
    expect(formatPhotoReportCount(demo.count)).toBe(PHOTO_REPORT_EMPTY_LABEL)
    expect(formatPhotoReportCount(demo.count)).toBe('尚無照片')
    expect(formatPhotoReportCount(3)).toBe('3 張')
  })

  it('AC-004: no stages and no photos yields an empty report', () => {
    const report = buildPhotoReport([], [])
    expect(report.stages).toEqual([])
    expect(report.unassigned.count).toBe(0)
    expect(report.totalPhotos).toBe(0)
  })

  it('AC-004: the inputs are not mutated', () => {
    const inputStages = stages.slice()
    const photos = [photo({ id: 'p1', stageId: 'stage-demo' })]
    buildPhotoReport(inputStages, photos)
    expect(inputStages.map((s) => s.id)).toEqual(['stage-wood', 'stage-demo', 'stage-water'])
    expect(photos).toHaveLength(1)
  })
})
