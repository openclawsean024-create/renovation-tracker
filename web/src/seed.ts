// Seed data — first-run initialisation. See PRD/SPEC.md §4.3 and AC-FR001-01.
//
// We pin the seed project window to a deterministic calendar window derived
// from a fixed reference start date so the gantt chart, date math, and tests
// never depend on `new Date()`. The actual start is computed once at module
// load using a fixed UTC reference (2026-01-05), independent of system clock.

import { addDays } from './dates'
import type { Project, Stage } from './types'

/** Fixed deterministic reference start (Monday) for seed data. */
const SEED_REFERENCE_START = '2026-01-05'

/** The seven default renovation stages in §4.3 order. */
export const SEED_STAGE_NAMES: readonly string[] = [
  '拆除',
  '水電',
  '泥作',
  '木作',
  '油漆',
  '安裝',
  '驗收',
] as const

/** Deterministic per-stage day length — five days each except verification (3). */
const SEED_STAGE_LENGTHS: readonly number[] = [5, 5, 5, 5, 5, 5, 3] as const

export interface SeedBundle {
  project: Project
  stages: Stage[]
}

interface SeedOptions {
  /** Override the reference start — only used in tests for determinism. */
  referenceStart?: string
  /** Stable ID generator — only used in tests for determinism. */
  idFactory?: () => string
  /** Stable timestamp generator — only used in tests. */
  now?: () => string
}

let counter = 0
const defaultIdFactory = (): string => {
  counter += 1
  return `seed-${counter.toString(36).padStart(4, '0')}`
}

const defaultNow = (): string => '2026-01-01T00:00:00.000Z'

/**
 * Build the seed project + 7 stages. The default reference start is the
 * fixed value above; tests pass `referenceStart` to drive deterministic
 * assertions across month boundaries.
 */
export function buildSeed(options: SeedOptions = {}): SeedBundle {
  const referenceStart = options.referenceStart ?? SEED_REFERENCE_START
  const idFactory = options.idFactory ?? defaultIdFactory
  const now = options.now ?? defaultNow

  // Lay stages back-to-back starting from the reference start.
  let cursor = referenceStart
  const stages: Stage[] = SEED_STAGE_NAMES.map((name, index) => {
    const length = SEED_STAGE_LENGTHS[index] ?? 5
    const start = cursor
    const end = addDays(start, length - 1)
    cursor = addDays(end, 1) // next stage starts the day after
    const stage: Stage = {
      id: idFactory(),
      projectId: 'placeholder', // filled in below
      name,
      order: index + 1,
      status: 'not_started',
      plannedStart: start,
      plannedEnd: end,
      createdAt: now(),
      updatedAt: now(),
    }
    return stage
  })

  const firstStart = stages[0]?.plannedStart ?? referenceStart
  const lastEnd = stages[stages.length - 1]?.plannedEnd ?? referenceStart
  const project: Project = {
    id: idFactory(),
    name: '我的裝修工程',
    address: undefined,
    status: 'planning',
    plannedStart: firstStart,
    plannedEnd: lastEnd,
    createdAt: now(),
    updatedAt: now(),
  }
  // Back-fill projectId on each stage.
  for (const s of stages) s.projectId = project.id

  return { project, stages }
}
