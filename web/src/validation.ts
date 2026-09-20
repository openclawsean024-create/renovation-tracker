// Form / domain validation rules.
// See PRD/SPEC.md §4 (project/stage rules), §6 AC-FR001-04 and §4.6 (FR-005).

import { isISODate, isOnOrBefore, isWithinRange } from './dates'
import type { NewScheduleItemInput, NewStageInput, ScheduleItemEditInput, StageEditInput } from './types'
import { isValidIsoDate } from './schedule'

export interface ValidationError {
  field:
    | 'name'
    | 'plannedStart'
    | 'plannedEnd'
    | 'status'
    | 'workerName'
    | 'startOn'
    | 'endOn'
    | 'reminderOn'
    | 'stageId'
  message: string
}

export interface ValidationResult {
  ok: boolean
  errors: ValidationError[]
}

/**
 * Optional project date window — when supplied, stage plannedStart and
 * plannedEnd must each lie inside the project range (inclusive). See
 * PRD/SPEC.md §4.2 and §6 AC-FR001-04.
 */
export interface ProjectDateBounds {
  plannedStart: string
  plannedEnd: string
}

/** Validate a stage create/edit payload. Empty string is treated as missing. */
export function validateStageInput(
  input: Partial<StageEditInput>,
  projectBounds?: ProjectDateBounds,
): ValidationResult {
  const errors: ValidationError[] = []

  const name = (input.name ?? '').trim()
  if (name.length === 0) {
    errors.push({ field: 'name', message: '階段名稱不可為空' })
  }

  const start = input.plannedStart ?? ''
  const end = input.plannedEnd ?? ''

  if (!start) {
    errors.push({ field: 'plannedStart', message: '請選擇預計開始日期' })
  } else if (!isISODate(start)) {
    errors.push({ field: 'plannedStart', message: '開始日期格式不正確' })
  }

  if (!end) {
    errors.push({ field: 'plannedEnd', message: '請選擇預計結束日期' })
  } else if (!isISODate(end)) {
    errors.push({ field: 'plannedEnd', message: '結束日期格式不正確' })
  }

  if (start && end && isISODate(start) && isISODate(end) && !isOnOrBefore(start, end)) {
    errors.push({
      field: 'plannedEnd',
      message: '預計結束日期不可早於預計開始日期',
    })
  }

  // AC-FR001-04: stage plannedStart and plannedEnd must fall inside the
  // project's planned range, inclusive. Only enforced when bounds are
  // provided AND both stage dates AND project bounds are themselves valid
  // ISO dates, AND the project bounds are not themselves inverted (a
  // well-formed project always satisfies start <= end per §4.1). Skipping
  // in degenerate cases keeps existing tests that omit bounds working
  // unchanged and avoids masking the basic ISO / ordering errors above.
  if (
    projectBounds &&
    isISODate(start) &&
    isISODate(end) &&
    isISODate(projectBounds.plannedStart) &&
    isISODate(projectBounds.plannedEnd) &&
    isOnOrBefore(projectBounds.plannedStart, projectBounds.plannedEnd)
  ) {
    if (!isWithinRange(start, projectBounds.plannedStart, projectBounds.plannedEnd)) {
      errors.push({
        field: 'plannedStart',
        message: '預計開始日期必須落在工程日期範圍內',
      })
    }
    if (!isWithinRange(end, projectBounds.plannedStart, projectBounds.plannedEnd)) {
      errors.push({
        field: 'plannedEnd',
        message: '預計結束日期必須落在工程日期範圍內',
      })
    }
  }

  return { ok: errors.length === 0, errors }
}

export function errorFor(errors: ValidationError[], field: ValidationError['field']): string | undefined {
  return errors.find((e) => e.field === field)?.message
}

/** Ensure a new-stage payload has a projectId; validation logic is shared. */
export function validateNewStageInput(
  input: Partial<NewStageInput>,
  projectBounds?: ProjectDateBounds,
): ValidationResult {
  const base = validateStageInput(input, projectBounds)
  if (!input.projectId) {
    base.errors.push({ field: 'name', message: '缺少工程 ID' })
    return { ok: false, errors: base.errors }
  }
  return base
}

/** Compute next order value (max + 1) within an array of stages. */
export function nextOrder(stages: { order: number }[]): number {
  if (stages.length === 0) return 1
  return stages.reduce((max, s) => (s.order > max ? s.order : max), 0) + 1
}

/** Apply §4.2 auto-date rules when transitioning stage status. */
export interface StatusDateResolution {
  actualStart?: string
  actualEnd?: string
}

/**
 * Decide which actual* dates should be set given a status change.
 * - in_progress + no actualStart → today
 * - completed + no actualEnd → today (actualStart also normalized if missing)
 * - blocked → never auto-fill
 */
export function resolveStatusDates(
  nextStatus: import('./types').StageStatus,
  prev: { actualStart?: string; actualEnd?: string },
  today: string,
): StatusDateResolution {
  const out: StatusDateResolution = {}
  if (nextStatus === 'in_progress') {
    if (!prev.actualStart) out.actualStart = today
  } else if (nextStatus === 'completed') {
    if (!prev.actualStart) out.actualStart = today
    if (!prev.actualEnd) out.actualEnd = today
  }
  return out
}

/* ──────────────────────────────────────────────────────────────────────── */
/* ScheduleItem (FR-005) — SPEC §4.6                                       */
/* ──────────────────────────────────────────────────────────────────────── */

/** Project context required to validate that an optional `stageId` belongs
 *  to the same project. */
export interface ScheduleValidationContext {
  /** Stages used to look up stageId.projectId. */
  stages: ReadonlyArray<{ id: string; projectId: string }>
}

/** Internal helper that runs the §4.6 rules on a normalised edit payload. */
function runScheduleRules(
  workerName: string,
  startOn: string,
  endOn: string,
  reminderOn: string | undefined,
  stageId: string | undefined,
  ctx: ScheduleValidationContext,
): ValidationError[] {
  const errors: ValidationError[] = []
  if (workerName.length === 0) {
    errors.push({ field: 'workerName', message: '工班名稱不可為空' })
  }

  if (!startOn) {
    errors.push({ field: 'startOn', message: '請選擇開始日期' })
  } else if (!isISODate(startOn)) {
    errors.push({ field: 'startOn', message: '開始日期格式不正確' })
  }

  if (!endOn) {
    errors.push({ field: 'endOn', message: '請選擇結束日期' })
  } else if (!isISODate(endOn)) {
    errors.push({ field: 'endOn', message: '結束日期格式不正確' })
  }

  if (
    startOn &&
    endOn &&
    isISODate(startOn) &&
    isISODate(endOn) &&
    !isOnOrBefore(startOn, endOn)
  ) {
    errors.push({ field: 'endOn', message: '結束日期不可早於開始日期' })
  }

  if (reminderOn && reminderOn.length > 0) {
    if (!isValidIsoDate(reminderOn)) {
      errors.push({ field: 'reminderOn', message: '提醒日期格式不正確' })
    } else if (
      isISODate(startOn) &&
      isValidIsoDate(reminderOn) &&
      !isOnOrBefore(reminderOn, startOn)
    ) {
      errors.push({ field: 'reminderOn', message: '提醒日期不可晚於開始日期' })
    }
  }

  if (stageId) {
    const st = ctx.stages.find((s) => s.id === stageId)
    if (!st) {
      errors.push({ field: 'stageId', message: '找不到對應的階段' })
    }
  }
  return errors
}

/** Validate a new-schedule payload (SPEC §4.6). */
export function validateNewScheduleInput(
  input: Partial<NewScheduleItemInput> & { projectId?: string },
  ctx: ScheduleValidationContext,
): ValidationResult {
  const errors: ValidationError[] = []
  if (!input.projectId) {
    errors.push({ field: 'stageId', message: '缺少工程 ID' })
  }
  const ruleErrors = runScheduleRules(
    (input.workerName ?? '').trim(),
    input.startOn ?? '',
    input.endOn ?? '',
    input.reminderOn && input.reminderOn.length > 0 ? input.reminderOn : undefined,
    input.stageId && input.stageId.length > 0 ? input.stageId : undefined,
    ctx,
  )
  errors.push(...ruleErrors)
  return { ok: errors.length === 0, errors }
}

/** Validate an edit payload (SPEC §4.6). */
export function validateScheduleInput(
  input: Partial<ScheduleItemEditInput>,
  ctx: ScheduleValidationContext,
): ValidationResult {
  const errors = runScheduleRules(
    (input.workerName ?? '').trim(),
    input.startOn ?? '',
    input.endOn ?? '',
    input.reminderOn && input.reminderOn.length > 0 ? input.reminderOn : undefined,
    input.stageId && input.stageId.length > 0 ? input.stageId : undefined,
    ctx,
  )
  return { ok: errors.length === 0, errors }
}

/** Cross-field rule: if `stageId` is provided, that stage must belong to the
 *  schedule's projectId. Called by the store after the basic rules pass. */
export function assertScheduleProjectConsistency(
  input: { projectId: string; stageId?: string },
  ctx: ScheduleValidationContext,
): ValidationError[] {
  if (!input.stageId) return []
  const st = ctx.stages.find((s) => s.id === input.stageId)
  if (!st) {
    return [{ field: 'stageId', message: '找不到對應的階段' }]
  }
  if (st.projectId !== input.projectId) {
    return [{ field: 'stageId', message: '關聯階段必須屬於同一工程' }]
  }
  return []
}
