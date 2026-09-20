// Gantt chart calculations. See PRD/SPEC.md §5.4.
//
// Each project day becomes an equal-width column; a stage that spans N days
// occupies N columns. Stages outside the project window are clamped so the
// visualisation never breaks (we just truncate / clip at the edges).

import { eachDay, dayCountInclusive, isWithinRange, parseISODate, formatLocalISO } from './dates'
import type { Project, Stage } from './types'

export interface GanttRow {
  stageId: string
  name: string
  /** Day index (0-based) where the bar starts in the project timeline. */
  startIndex: number
  /** Day index (0-based) where the bar ends (inclusive). */
  endIndex: number
  /** Inclusive span length in days (>= 1). */
  span: number
  /** True when the stage fully fits inside the project window. */
  withinWindow: boolean
}

export interface GanttLayout {
  /** Ordered list of YYYY-MM-DD strings representing every project day. */
  days: string[]
  /** Stage rows. */
  rows: GanttRow[]
  /** Total project span in days (>= 1). */
  totalDays: number
}

/**
 * Layout stages against a project window.
 *
 * - When a stage starts before `project.plannedStart`, the bar is clipped to
 *   the project start (startIndex = 0). The visible span reflects the actual
 *   days that fall inside the project window.
 * - When a stage ends after `project.plannedEnd`, the bar is clipped to the
 *   project end (endIndex = days.length - 1).
 * - Single-day stages get span = 1 (AC-FR001-06 single-day case).
 */
export function layoutGantt(project: Project, stages: Stage[]): GanttLayout {
  const days = eachDay(project.plannedStart, project.plannedEnd)
  const totalDays = days.length
  const rows: GanttRow[] = []

  for (const stage of stages) {
    const startDate = parseISODate(stage.plannedStart)
    const endDate = parseISODate(stage.plannedEnd)
    if (!startDate || !endDate) continue

    // Clamp to project window.
    const clampedStart = isWithinRange(stage.plannedStart, project.plannedStart, project.plannedEnd)
      ? stage.plannedStart
      : project.plannedStart
    const clampedEnd = isWithinRange(stage.plannedEnd, project.plannedStart, project.plannedEnd)
      ? stage.plannedEnd
      : project.plannedEnd

    const startIndex = days.indexOf(clampedStart)
    const endIndex = days.indexOf(clampedEnd)
    if (startIndex === -1 || endIndex === -1) continue

    const span = endIndex - startIndex + 1
    rows.push({
      stageId: stage.id,
      name: stage.name,
      startIndex,
      endIndex,
      span: Math.max(span, 1),
      withinWindow:
        stage.plannedStart >= project.plannedStart &&
        stage.plannedEnd <= project.plannedEnd,
    })
  }

  return { days, rows, totalDays }
}

/** Build a deterministic CSS grid template — `repeat(N, 1fr)`. */
export function dayGridTemplate(totalDays: number): string {
  return `repeat(${Math.max(totalDays, 1)}, minmax(1.5rem, 1fr))`
}

/** Inclusive day count between two YYYY-MM-DD strings (1 for a single day). */
export function stageSpan(stage: Pick<Stage, 'plannedStart' | 'plannedEnd'>): number {
  const n = dayCountInclusive(stage.plannedStart, stage.plannedEnd)
  return Number.isFinite(n) && n > 0 ? n : 1
}

/** Convenience: re-export for tests that want raw date math. */
export const _internal = { formatLocalISO, parseISODate }
