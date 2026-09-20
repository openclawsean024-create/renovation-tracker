// Domain types for FR-001 / FR-002 — Project / Stage / PhotoRecord
// See PRD/SPEC.md §4 for authoritative definitions.

export type ProjectStatus = 'planning' | 'in_progress' | 'completed'

export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  'planning',
  'in_progress',
  'completed',
] as const

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: '規劃中',
  in_progress: '進行中',
  completed: '已完成',
}

export interface Project {
  id: string
  name: string
  address?: string
  status: ProjectStatus
  /** ISO date string YYYY-MM-DD (project planned start, inclusive) */
  plannedStart: string
  /** ISO date string YYYY-MM-DD (project planned end, inclusive) */
  plannedEnd: string
  /** ISO datetime string */
  createdAt: string
  /** ISO datetime string */
  updatedAt: string
}

export type StageStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked'

export const STAGE_STATUSES: readonly StageStatus[] = [
  'not_started',
  'in_progress',
  'completed',
  'blocked',
] as const

export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  not_started: '未開始',
  in_progress: '進行中',
  completed: '已完成',
  blocked: '阻塞',
}

export interface Stage {
  id: string
  projectId: string
  name: string
  /** 1-based display order; unique within a project */
  order: number
  status: StageStatus
  /** ISO date string YYYY-MM-DD (stage planned start, inclusive) */
  plannedStart: string
  /** ISO date string YYYY-MM-DD (stage planned end, inclusive) */
  plannedEnd: string
  /** ISO date string YYYY-MM-DD — set automatically when status becomes in_progress */
  actualStart?: string
  /** ISO date string YYYY-MM-DD — required when status === 'completed' */
  actualEnd?: string
  note?: string
  /** ISO datetime string */
  createdAt: string
  /** ISO datetime string */
  updatedAt: string
}

/** Stage payload for create operations (server-/db-managed fields omitted). */
export interface NewStageInput {
  projectId: string
  name: string
  status: StageStatus
  plannedStart: string
  plannedEnd: string
  note?: string
}

/** Stage payload for edit operations. */
export interface StageEditInput {
  name: string
  status: StageStatus
  plannedStart: string
  plannedEnd: string
  note?: string
}

// ---------- FR-002 PhotoRecord (PRD/SPEC.md §4.4) ----------

export type PhotoKind = 'before' | 'progress' | 'after'

export const PHOTO_KINDS: readonly PhotoKind[] = ['before', 'progress', 'after'] as const

export const PHOTO_KIND_LABELS: Record<PhotoKind, string> = {
  before: '施工前',
  progress: '施工中',
  after: '完工',
}

/** Maximum upload size for a single photo — SPEC §4.4 (10 MB). */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024

export interface PhotoRecord {
  id: string
  projectId: string
  stageId?: string
  kind: PhotoKind
  caption?: string
  /** ISO date string YYYY-MM-DD — SPEC §4.4 */
  takenOn: string
  fileName: string
  mimeType: string
  /** The raw image blob. Persisted to IndexedDB and never mutated. */
  blob: Blob
  /** ISO datetime string */
  createdAt: string
}

/**
 * Photo payload accepted by `createPhoto`. The store assigns `id`, `projectId`,
 * `fileName`, `mimeType`, `blob` (taken from the chosen File), and `createdAt`.
 */
export interface NewPhotoInput {
  stageId?: string
  kind: PhotoKind
  caption?: string
  takenOn: string
  file: File
}

// ---------- FR-003 BudgetItem (PRD/SPEC.md §4.5) ----------

export type PaymentStatus = 'unpaid' | 'partial' | 'paid'

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'unpaid',
  'partial',
  'paid',
] as const

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: '未付款',
  partial: '部分付款',
  paid: '已付款',
}

/** UI tone — color is paired with a label / symbol so the pill is not
 *  colour-only. See PRD/SPEC.md §1.2. */
export const PAYMENT_STATUS_TONE: Record<PaymentStatus, string> = {
  unpaid: 'unpaid',
  partial: 'partial',
  paid: 'paid',
}

/** Maximum allowed fraction digits for any amount. SPEC §4.5 mandates at most
 *  two decimal places so totals never drift due to floating-point artefacts. */
export const MAX_BUDGET_DECIMALS = 2

/** Rounding helper used before persisting amounts so the stored value never
 *  exceeds two decimal places. */
export function roundBudgetAmount(value: number): number {
  if (!Number.isFinite(value)) return value
  const factor = 10 ** MAX_BUDGET_DECIMALS
  return Math.round(value * factor) / factor
}

export interface BudgetItem {
  id: string
  projectId: string
  category: string
  name: string
  plannedAmount: number
  actualAmount: number
  paymentStatus: PaymentStatus
  note?: string
  /** ISO datetime string */
  createdAt: string
  /** ISO datetime string */
  updatedAt: string
}

/** Payload for `createBudget`. The store assigns `id`, `createdAt`, `updatedAt`. */
export interface NewBudgetItemInput {
  projectId: string
  category: string
  name: string
  plannedAmount: number
  actualAmount: number
  paymentStatus: PaymentStatus
  note?: string
}

/** Payload for `updateBudget`. */
export interface BudgetItemEditInput {
  category: string
  name: string
  plannedAmount: number
  actualAmount: number
  paymentStatus: PaymentStatus
  note?: string
}

/* ──────────────────────────────────────────────────────────────────────── */
/* ScheduleItem (FR-005) — see SPEC §4.6                                   */
/* ──────────────────────────────────────────────────────────────────────── */

/** Date-only status that the schedule row displays. The label is derived
 *  in `scheduleDateStatus` so the same logic feeds the dashboard, the
 *  reminder filter and the share snapshot. */
export type ScheduleDateStatus =
  | 'not_started'
  | 'today'
  | 'in_progress'
  | 'overdue'
  | 'completed'

export const SCHEDULE_DATE_STATUS_LABELS: Record<ScheduleDateStatus, string> = {
  not_started: '未開始',
  today: '今日',
  in_progress: '進行中',
  overdue: '逾期',
  completed: '已完成',
}

export interface ScheduleItem {
  id: string
  projectId: string
  /** Optional stage this schedule belongs to. Must reference a stage in the
   *  same project if set. */
  stageId?: string
  workerName: string
  phone?: string
  /** ISO date string `YYYY-MM-DD` (inclusive). */
  startOn: string
  /** ISO date string `YYYY-MM-DD` (inclusive). Must not precede `startOn`. */
  endOn: string
  note?: string
  /** ISO date string `YYYY-MM-DD`. Must not be later than `startOn` if set. */
  reminderOn?: string
  completed: boolean
  /** ISO datetime string. */
  createdAt: string
  /** ISO datetime string. */
  updatedAt: string
}

/** Payload for `createSchedule`. The store assigns `id`, `createdAt`,
 *  `updatedAt`, `completed=false` if omitted. */
export interface NewScheduleItemInput {
  projectId: string
  stageId?: string
  workerName: string
  phone?: string
  startOn: string
  endOn: string
  note?: string
  reminderOn?: string
  completed?: boolean
}

/** Payload for `updateSchedule`. The store updates `updatedAt`. */
export interface ScheduleItemEditInput {
  stageId?: string
  workerName: string
  phone?: string
  startOn: string
  endOn: string
  note?: string
  reminderOn?: string
  completed: boolean
}

/* ──────────────────────────────────────────────────────────────────────── */
/* WarrantyRecord (FR-006) — see SPEC §4.7 + §11                             */
/* ──────────────────────────────────────────────────────────────────────── */

/** Date-driven status that the warranty row + share summary display.
 *  Derived in `warranty.ts` from `startsOn` / `endsOn` vs. local today. */
export type WarrantyDateStatus = 'not_started' | 'active' | 'expired'

export const WARRANTY_DATE_STATUSES: readonly WarrantyDateStatus[] = [
  'not_started',
  'active',
  'expired',
] as const

export const WARRANTY_DATE_STATUS_LABELS: Record<WarrantyDateStatus, string> = {
  not_started: '尚未開始',
  active: '有效中',
  expired: '已過期',
}

/** Window (in days) used to surface an "即將到期" warning. Mirrors the
 *  SPEC §11.1 "30 天內到期的文字化警示" requirement and AC-FR006-03. */
export const WARRANTY_EXPIRING_WINDOW_DAYS = 30

export interface WarrantyRecord {
  id: string
  projectId: string
  itemName: string
  provider: string
  contact?: string
  /** ISO date string `YYYY-MM-DD` (inclusive). Must not be later than `endsOn`. */
  startsOn: string
  /** ISO date string `YYYY-MM-DD` (inclusive). Must not precede `startsOn`. */
  endsOn: string
  note?: string
  /** ISO datetime string. */
  createdAt: string
  /** ISO datetime string. */
  updatedAt: string
}

/** Payload for `createWarranty`. The store assigns `id`, `createdAt`,
 *  `updatedAt`, and falls back `projectId` to the current project when the
 *  caller leaves it blank. */
export interface NewWarrantyItemInput {
  projectId: string
  itemName: string
  provider: string
  contact?: string
  startsOn: string
  endsOn: string
  note?: string
}

/** Payload for `updateWarranty`. The store updates `updatedAt`. */
export interface WarrantyItemEditInput {
  itemName: string
  provider: string
  contact?: string
  startsOn: string
  endsOn: string
  note?: string
}
