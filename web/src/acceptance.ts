// FR-009 per-stage acceptance checklist. See PRD/SPEC.md §12.3 and GOAL
// AC-003. Rewritten from decoration-tracker's four fixed `AcceptanceItem`s +
// `toggleAcceptance` into user-defined items per stage, with a check date and
// a note.

import type {
  AcceptanceItem,
  AcceptanceItemEditInput,
  NewAcceptanceItemInput,
  Stage,
} from './types'

export interface AcceptanceFieldError {
  field: 'name' | 'stageId'
  message: string
}

export interface AcceptanceValidationResult {
  ok: boolean
  errors: AcceptanceFieldError[]
}

/** Shared by create and edit: `name` must be non-empty after trim. */
export function validateAcceptanceInput(
  input: Partial<AcceptanceItemEditInput>,
): AcceptanceValidationResult {
  const errors: AcceptanceFieldError[] = []
  if ((input.name ?? '').trim().length === 0) {
    errors.push({ field: 'name', message: '驗收項目名稱不可為空' })
  }
  return { ok: errors.length === 0, errors }
}

/**
 * Create-time validation: additionally requires `projectId` and a `stageId`
 * that belongs to the same project.
 */
export function validateNewAcceptanceInput(
  input: Partial<NewAcceptanceItemInput>,
  ctx: { stages: ReadonlyArray<Pick<Stage, 'id' | 'projectId'>> },
): AcceptanceValidationResult {
  const result = validateAcceptanceInput(input)
  const errors = result.errors
  if (input.projectId === undefined || input.projectId.length === 0) {
    errors.push({ field: 'name', message: '缺少工程 ID' })
  }
  if (input.stageId === undefined || input.stageId.length === 0) {
    errors.push({ field: 'stageId', message: '請選擇驗收階段' })
  } else {
    const stage = ctx.stages.find((s) => s.id === input.stageId)
    if (!stage || (input.projectId && stage.projectId !== input.projectId)) {
      errors.push({ field: 'stageId', message: '找不到對應的階段' })
    }
  }
  return { ok: errors.length === 0, errors }
}

export function acceptanceErrorFor(
  errors: AcceptanceFieldError[],
  field: AcceptanceFieldError['field'],
): string | undefined {
  return errors.find((e) => e.field === field)?.message
}

/**
 * Flip `passed`. Turning it on stamps `checkedOn` with `today`; turning it off
 * clears the date again (the item is no longer checked). Pure.
 */
export function toggleAcceptancePassed(
  item: AcceptanceItem,
  today: string,
  nowIso: string,
): AcceptanceItem {
  if (item.passed) {
    const next: AcceptanceItem = { ...item, passed: false, updatedAt: nowIso }
    delete next.checkedOn
    return next
  }
  return { ...item, passed: true, checkedOn: today, updatedAt: nowIso }
}

export interface AcceptanceProgress {
  total: number
  passed: number
}

export const EMPTY_ACCEPTANCE_PROGRESS: AcceptanceProgress = { total: 0, passed: 0 }

/** Overall progress across every item. */
export function summarizeAcceptance(
  items: ReadonlyArray<Pick<AcceptanceItem, 'passed'>>,
): AcceptanceProgress {
  let passed = 0
  for (const item of items) if (item.passed) passed += 1
  return { total: items.length, passed }
}

/** Progress keyed by `stageId`. Stages without items are simply absent. */
export function summarizeAcceptanceByStage(
  items: ReadonlyArray<Pick<AcceptanceItem, 'stageId' | 'passed'>>,
): Record<string, AcceptanceProgress> {
  const out: Record<string, AcceptanceProgress> = {}
  for (const item of items) {
    const entry = out[item.stageId] ?? { total: 0, passed: 0 }
    entry.total += 1
    if (item.passed) entry.passed += 1
    out[item.stageId] = entry
  }
  return out
}

/** `驗收 x/y` — the label shown on each stage row. */
export function formatAcceptanceProgress(progress: AcceptanceProgress): string {
  return `驗收 ${progress.passed}/${progress.total}`
}

/**
 * A stage marked `completed` that still has un-passed items needs a text
 * warning (SPEC §12.3). The warning never blocks saving.
 */
export function hasUnpassedCompletedWarning(
  stage: Pick<Stage, 'status'>,
  progress: AcceptanceProgress | undefined,
): boolean {
  if (stage.status !== 'completed') return false
  if (!progress || progress.total === 0) return false
  return progress.passed < progress.total
}

export function acceptanceWarningText(progress: AcceptanceProgress): string {
  return `階段已標記完成，但仍有 ${progress.total - progress.passed} 項驗收未通過`
}

/** Display order within a stage: oldest first. */
export function compareAcceptanceItems(a: AcceptanceItem, b: AcceptanceItem): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function acceptanceItemsForStage(
  items: ReadonlyArray<AcceptanceItem>,
  stageId: string,
): AcceptanceItem[] {
  return items.filter((i) => i.stageId === stageId).sort(compareAcceptanceItems)
}
