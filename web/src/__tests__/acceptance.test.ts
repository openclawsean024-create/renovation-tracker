// AC-003 (FR-009) — per-stage acceptance checklist. Pure domain tests.

import { describe, expect, it } from 'vitest'
import {
  acceptanceItemsForStage,
  acceptanceWarningText,
  formatAcceptanceProgress,
  hasUnpassedCompletedWarning,
  summarizeAcceptance,
  summarizeAcceptanceByStage,
  toggleAcceptancePassed,
  validateAcceptanceInput,
  validateNewAcceptanceInput,
} from '../acceptance'
import type { AcceptanceItem } from '../types'

function mk(overrides: Partial<AcceptanceItem> = {}): AcceptanceItem {
  return {
    id: 'acc-1',
    projectId: 'proj-1',
    stageId: 'stage-1',
    name: '示範驗收：插座通電',
    passed: false,
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  }
}

const stages = [
  { id: 'stage-1', projectId: 'proj-1' },
  { id: 'stage-2', projectId: 'proj-1' },
  { id: 'other', projectId: 'proj-2' },
]

describe('AC-003 acceptance validation', () => {
  it('AC-003: name must not be blank', () => {
    expect(validateAcceptanceInput({ name: '示範' }).ok).toBe(true)
    const result = validateAcceptanceInput({ name: '   ' })
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual([{ field: 'name', message: '驗收項目名稱不可為空' }])
  })

  it('AC-003: a new item needs a stage of the same project', () => {
    expect(
      validateNewAcceptanceInput({ projectId: 'proj-1', stageId: 'stage-1', name: '示範' }, { stages }).ok,
    ).toBe(true)
    expect(
      validateNewAcceptanceInput({ projectId: 'proj-1', stageId: '', name: '示範' }, { stages }).errors,
    ).toEqual([{ field: 'stageId', message: '請選擇驗收階段' }])
    expect(
      validateNewAcceptanceInput({ projectId: 'proj-1', stageId: 'missing', name: '示範' }, { stages }).errors,
    ).toEqual([{ field: 'stageId', message: '找不到對應的階段' }])
    expect(
      validateNewAcceptanceInput({ projectId: 'proj-1', stageId: 'other', name: '示範' }, { stages }).ok,
    ).toBe(false)
  })
})

describe('AC-003 acceptance toggle', () => {
  it('AC-003: passing an item stamps the check date automatically', () => {
    const item = mk()
    const passed = toggleAcceptancePassed(item, '2026-01-20', '2026-01-20T02:00:00.000Z')
    expect(passed.passed).toBe(true)
    expect(passed.checkedOn).toBe('2026-01-20')
    expect(passed.updatedAt).toBe('2026-01-20T02:00:00.000Z')
    // input untouched
    expect(item.passed).toBe(false)
    expect(item.checkedOn).toBeUndefined()
  })

  it('AC-003: un-passing an item clears the check date', () => {
    const passed = mk({ passed: true, checkedOn: '2026-01-20' })
    const back = toggleAcceptancePassed(passed, '2026-01-25', '2026-01-25T02:00:00.000Z')
    expect(back.passed).toBe(false)
    expect('checkedOn' in back).toBe(false)
  })

  it('AC-003: passing again uses the new day, not the old one', () => {
    const first = toggleAcceptancePassed(mk(), '2026-01-20', 'a')
    const off = toggleAcceptancePassed(first, '2026-01-21', 'b')
    const second = toggleAcceptancePassed(off, '2026-01-22', 'c')
    expect(second.checkedOn).toBe('2026-01-22')
  })
})

describe('AC-003 acceptance progress', () => {
  const items = [
    mk({ id: 'a', stageId: 'stage-1', passed: true }),
    mk({ id: 'b', stageId: 'stage-1', passed: false }),
    mk({ id: 'c', stageId: 'stage-1', passed: true }),
    mk({ id: 'd', stageId: 'stage-2', passed: false }),
  ]

  it('AC-003: per-stage progress counts passed / total', () => {
    expect(summarizeAcceptanceByStage(items)).toEqual({
      'stage-1': { total: 3, passed: 2 },
      'stage-2': { total: 1, passed: 0 },
    })
    expect(summarizeAcceptance(items)).toEqual({ total: 4, passed: 2 })
    expect(summarizeAcceptance([])).toEqual({ total: 0, passed: 0 })
  })

  it('AC-003: progress is rendered as 「驗收 x/y」', () => {
    expect(formatAcceptanceProgress({ total: 3, passed: 2 })).toBe('驗收 2/3')
    expect(formatAcceptanceProgress({ total: 0, passed: 0 })).toBe('驗收 0/0')
  })

  it('AC-003: a completed stage with un-passed items needs a warning', () => {
    expect(hasUnpassedCompletedWarning({ status: 'completed' }, { total: 3, passed: 2 })).toBe(true)
    expect(acceptanceWarningText({ total: 3, passed: 2 })).toBe(
      '階段已標記完成，但仍有 1 項驗收未通過',
    )
  })

  it('AC-003: no warning when everything passed, nothing is listed, or the stage is not completed', () => {
    expect(hasUnpassedCompletedWarning({ status: 'completed' }, { total: 3, passed: 3 })).toBe(false)
    expect(hasUnpassedCompletedWarning({ status: 'completed' }, { total: 0, passed: 0 })).toBe(false)
    expect(hasUnpassedCompletedWarning({ status: 'completed' }, undefined)).toBe(false)
    for (const status of ['not_started', 'in_progress', 'blocked'] as const) {
      expect(hasUnpassedCompletedWarning({ status }, { total: 3, passed: 0 })).toBe(false)
    }
  })

  it('AC-003: items are listed per stage, oldest first', () => {
    const list = acceptanceItemsForStage(
      [
        mk({ id: 'late', createdAt: '2026-01-12T00:00:00.000Z' }),
        mk({ id: 'elsewhere', stageId: 'stage-2' }),
        mk({ id: 'early', createdAt: '2026-01-09T00:00:00.000Z' }),
      ],
      'stage-1',
    )
    expect(list.map((i) => i.id)).toEqual(['early', 'late'])
  })
})
