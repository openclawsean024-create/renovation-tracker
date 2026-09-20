// Status summary calculations used by Dashboard summary card.
// See PRD/SPEC.md §5.3 and AC-FR001-05.

import type { Stage, StageStatus } from './types'

export interface StageSummary {
  total: number
  completed: number
  inProgress: number
  blocked: number
  notStarted: number
  /** Rounded integer percent; 0 when total === 0. Never NaN/Infinity. */
  percentComplete: number
}

export function summarizeStages(stages: Stage[]): StageSummary {
  let total = 0
  let completed = 0
  let inProgress = 0
  let blocked = 0
  let notStarted = 0
  for (const s of stages) {
    total += 1
    switch (s.status) {
      case 'completed':
        completed += 1
        break
      case 'in_progress':
        inProgress += 1
        break
      case 'blocked':
        blocked += 1
        break
      case 'not_started':
        notStarted += 1
        break
      default: {
        // exhaustive guard
        const _exhaustive: never = s.status
        void _exhaustive
      }
    }
  }
  const raw = total === 0 ? 0 : (completed / total) * 100
  const percentComplete = total === 0 ? 0 : Math.round(raw)
  return { total, completed, inProgress, blocked, notStarted, percentComplete }
}

/** Stable comparator by stage.order (tie-break by id for determinism). */
export function compareStageOrder(a: Stage, b: Stage): number {
  if (a.order !== b.order) return a.order - b.order
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export const STATUS_PRESENTATION: Record<StageStatus, { tone: string; symbol: string }> = {
  not_started: { tone: 'neutral', symbol: '○' },
  in_progress: { tone: 'progress', symbol: '◐' },
  completed: { tone: 'done', symbol: '●' },
  blocked: { tone: 'blocked', symbol: '⚠' },
}
