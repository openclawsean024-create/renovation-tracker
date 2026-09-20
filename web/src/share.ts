// FR-004 share snapshot — see PRD/SPEC.md §9 + AC-FR004-01~04.
//
// The snapshot is a self-contained, *versioned* JSON document that captures
// only the read-only display surface of a single project. It is meant to be
// encoded into a URL hash so the recipient can render the page without any
// network access and without any write access to the originating local
// IndexedDB. There is no token server, no public database, no Blob payload
// and no IndexedDB key in the URL — SPEC §9 is strict about that.
//
// SECURITY/PROVENANCE NOTE: this is intentionally a *URL-hash snapshot*, not
// a signed or revocable share. Anyone who receives it can read the embedded
// data. That is the documented product contract.

import {
  PHOTO_KINDS,
  PROJECT_STATUSES,
  STAGE_STATUSES,
  type PhotoKind,
  type ProjectStatus,
  type StageStatus,
  WARRANTY_DATE_STATUSES,
  type WarrantyDateStatus,
} from './types'
import {
  daysUntilEnd,
  warrantyDateStatus,
} from './warranty'

/** Current snapshot version. Bump when an incompatible change is shipped.
 *  Unknown versions are rejected by `decodeShareHash` (AC-FR004-04). */
export const SHARE_SNAPSHOT_VERSION = 1

/** The hash key that the Dashboard reads to enter readonly mode. */
export const SHARE_HASH_KEY = 'share'

/** A public, read-only projection of a project. The snapshot deliberately
 *  replaces every originating `Stage.id` / `PhotoRecord.id` (which are
 *  IndexedDB keys) with snapshot-local references (`stage-1`, `stage-2`,
 *  `photo-1`, …) assigned by display order. SPEC §9.1 forbids putting any
 *  IndexedDB key into the URL. The recipient never sees the source IDs. */
export interface ShareSnapshot {
  /** Monotonically increasing schema version; checked by the decoder. */
  version: number
  /** ISO datetime the snapshot was generated. Display-only. */
  generatedAt: string
  project: {
    name: string
    address?: string
    status: ProjectStatus
    plannedStart: string
    plannedEnd: string
    createdAt: string
    updatedAt: string
  }
  /** Per-stage public projection. `id` is a snapshot-local reference
   *  (`stage-N`) assigned by display order; it is NOT the source
   *  IndexedDB key (SPEC §9.1). */
  stages: ShareStage[]
  /** Aggregate counts derived from `stages`. */
  stageSummary: {
    total: number
    completed: number
    inProgress: number
    blocked: number
    notStarted: number
    percentComplete: number
  }
  /** Gantt layout derived from `project` + `stages`. `stageId` mirrors the
   *  snapshot-local reference in `stages[].id`. */
  gantt: {
    totalDays: number
    days: string[]
    rows: ShareGanttRow[]
  }
  /** Public photo metadata only. The Blob is deliberately omitted and the
   *  `id` is a snapshot-local reference (`photo-N`) — never the source
   *  IndexedDB key (SPEC §9.1). */
  photos: SharePhoto[]
  /** Pre-computed budget summary; the recipient does not see raw items. */
  budgetSummary: ShareBudgetSummary
  /** Reserved for FR-005. Must be present so the schema is stable now. */
  scheduleSummary: ShareScheduleSummary
  /** Reserved for FR-006. Must be present so the schema is stable now. */
  warrantySummary: ShareWarrantySummary
  /** FR-006: public warranty items (snapshot-local references). The list is
   *  optional so existing snapshots produced before FR-006 shipped still
   *  decode; missing entries default to `[]`. */
  warranties?: ShareWarranty[]
}

export interface ShareStage {
  /** Snapshot-local reference (`stage-N`). NOT the source IndexedDB key. */
  id: string
  name: string
  order: number
  status: StageStatus
  plannedStart: string
  plannedEnd: string
  actualStart?: string
  actualEnd?: string
  note?: string
}

export interface ShareGanttRow {
  /** Snapshot-local reference (`stage-N`). Matches the corresponding
   *  `stages[].id`. */
  stageId: string
  name: string
  startIndex: number
  endIndex: number
  span: number
  withinWindow: boolean
}

export interface SharePhoto {
  /** Snapshot-local reference (`photo-N`). NOT the source IndexedDB key. */
  id: string
  kind: PhotoKind
  caption?: string
  takenOn: string
  fileName: string
  mimeType: string
}

/** Stage-local reference prefix used in share snapshots. IndexedDB keys
 *  are NEVER used here — the original `Stage.id` is replaced with
 *  `${SHARE_STAGE_REF_PREFIX}${orderInArray}` at snapshot time. */
export const SHARE_STAGE_REF_PREFIX = 'stage-'

/** Photo-local reference prefix used in share snapshots. IndexedDB keys
 *  are NEVER used here — the original `PhotoRecord.id` is replaced with
 *  `${SHARE_PHOTO_REF_PREFIX}${orderInArray}` at snapshot time. */
export const SHARE_PHOTO_REF_PREFIX = 'photo-'

/** Make a snapshot-local stage reference from a 1-based display index. */
export function makeShareStageRef(displayIndex: number): string {
  return `${SHARE_STAGE_REF_PREFIX}${displayIndex}`
}

/** Make a snapshot-local photo reference from a 1-based display index. */
export function makeSharePhotoRef(displayIndex: number): string {
  return `${SHARE_PHOTO_REF_PREFIX}${displayIndex}`
}

export interface ShareBudgetSummary {
  total: number
  totalPlanned: number
  totalActual: number
  remaining: number
  isOverrun: boolean
  totalOverrun: number
  overrunItemCount: number
  paymentCounts: { unpaid: number; partial: number; paid: number }
}

export interface ShareScheduleSummary {
  total: number
  /** 未完成且尚未進入/已進入但未逾期的排程筆數（FR-005 §4.6 + AC-FR005-04）。 */
  upcoming: number
  /** 未完成且 endOn 已過的排程筆數。 */
  overdue: number
  /** `completed = true` 的排程筆數。 */
  completed: number
}

export interface ShareWarrantySummary {
  total: number
  /** FR-006: active warranties expiring within the next 30 days. */
  expiringSoon: number
  /** FR-006: warranties whose `endsOn` is strictly before the snapshot's
   *  generated day (local time). */
  expired: number
  /** FR-006: warranties currently inside [startsOn, endsOn]. */
  active: number
}

/** Warranty item in a share snapshot. The `id` is a snapshot-local reference
 *  (`warranty-N`) assigned by display order so the source IndexedDB key never
 *  leaves the URL (SPEC §9.1). The `status` and `daysRemaining` fields are
 *  frozen at generation time — recipients see the snapshot as-of `generatedAt`,
 *  not a live reflection of local today. */
export interface ShareWarranty {
  /** Snapshot-local reference (`warranty-N`). NOT the source IndexedDB key. */
  id: string
  itemName: string
  provider: string
  contact?: string
  startsOn: string
  endsOn: string
  note?: string
  /** Date-driven status captured at snapshot generation time. */
  status: import('./types').WarrantyDateStatus
  /** Days from generated day to `endsOn`. Negative = already expired. */
  daysRemaining: number
}

/** Warranty-local reference prefix used in share snapshots. IndexedDB keys
 *  are NEVER used here. */
export const SHARE_WARRANTY_REF_PREFIX = 'warranty-'

/** Make a snapshot-local warranty reference from a 1-based display index. */
export function makeShareWarrantyRef(displayIndex: number): string {
  return `${SHARE_WARRANTY_REF_PREFIX}${displayIndex}`
}

/** True iff `value` looks like a snapshot-local warranty reference (`warranty-N`). */
function isShareWarrantyRef(value: unknown): value is string {
  return typeof value === 'string' && /^warranty-\d+$/.test(value)
}

/** A failure surfaced by `decodeShareHash`. The `code` field is stable so
 *  tests + UI can branch on it without parsing the human message. */
export interface ShareDecodeError {
  code:
    | 'missing-hash'
    | 'unknown-version'
    | 'malformed'
    | 'shape'
  message: string
}

export type ShareDecodeResult =
  | { ok: true; snapshot: ShareSnapshot }
  | { ok: false; error: ShareDecodeError }

/** Encode raw bytes into a URL-safe base64 string (no `+`, `/` or `=`). */
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!)
  }
  const b64 = typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(binary, 'binary').toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

/** Decode URL-safe base64 back to raw bytes. */
function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const rem = padded.length % 4
  const withPad = rem === 0 ? padded : padded + '='.repeat(4 - rem)
  let binary: string
  if (typeof atob === 'function') {
    binary = atob(withPad)
  } else {
    binary = Buffer.from(withPad, 'base64').toString('binary')
  }
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

/**
 * Build a versioned, stable snapshot from the dashboard data. Pure: only
 * reads from its arguments; no DOM, no IndexedDB. Used by both the encode
 * path and the tests so we have a single source of truth for shape.
 *
 * SPEC §9.1: the snapshot MUST NOT contain any IndexedDB key. We therefore
 * drop the caller-supplied `Stage.id` / `PhotoRecord.id` and substitute
 * snapshot-local references assigned by display order
 * (`stage-1, stage-2, …`, `photo-1, photo-2, …`). Callers must pass the
 * stages / photos in the order they want them to appear — the position in
 * the input array is what determines the snapshot-local id. The originating
 * IndexedDB key never reaches the encoded URL or the readonly consumer.
 */
export function buildShareSnapshot(input: {
  project: {
    name: string
    address?: string
    status: ProjectStatus
    plannedStart: string
    plannedEnd: string
    createdAt: string
    updatedAt: string
  }
  stages: ReadonlyArray<{
    id: string
    name: string
    order: number
    status: StageStatus
    plannedStart: string
    plannedEnd: string
    actualStart?: string
    actualEnd?: string
    note?: string
  }>
  stageSummary: ShareSnapshot['stageSummary']
  gantt: ShareSnapshot['gantt']
  photos: ReadonlyArray<{
    id: string
    kind: PhotoKind
    caption?: string
    takenOn: string
    fileName: string
    mimeType: string
  }>
  budgetSummary: ShareBudgetSummary
  /** FR-005 summary. Optional — defaults to all-zero so older snapshots
   *  produced before FR-005 shipped still validate (AC-FR004-04). */
  scheduleSummary?: ShareScheduleSummary
  /** FR-006 summary. Optional — defaults to all-zero so older snapshots
   *  produced before FR-006 shipped still validate (AC-FR004-04). */
  warrantySummary?: ShareWarrantySummary
  /** FR-006: per-item warranty list. Optional — older callers can keep
   *  passing just the summary and the snapshot still decodes. */
  warranties?: ReadonlyArray<{
    id: string
    itemName: string
    provider: string
    contact?: string
    startsOn: string
    endsOn: string
    note?: string
  }>
  /** Snapshot generation day (YYYY-MM-DD). Drives warranty status + countdown.
   *  Defaults to the local "today" at build time. */
  generatedAt?: string
}): ShareSnapshot {
  // Map every input stage to a snapshot-local reference by display order.
  // The originating IndexedDB key is intentionally discarded.
  const stages: ShareStage[] = input.stages.map((s, idx) => ({
    id: makeShareStageRef(idx + 1),
    name: s.name,
    order: s.order,
    status: s.status,
    plannedStart: s.plannedStart,
    plannedEnd: s.plannedEnd,
    ...(s.actualStart !== undefined ? { actualStart: s.actualStart } : {}),
    ...(s.actualEnd !== undefined ? { actualEnd: s.actualEnd } : {}),
    ...(s.note !== undefined ? { note: s.note } : {}),
  }))
  // Same trick for photos. Display order = position in input array.
  const photos: SharePhoto[] = input.photos.map((p, idx) => ({
    id: makeSharePhotoRef(idx + 1),
    kind: p.kind,
    ...(p.caption !== undefined ? { caption: p.caption } : {}),
    takenOn: p.takenOn,
    fileName: p.fileName,
    mimeType: p.mimeType,
  }))

  // Map warranty items (FR-006) to snapshot-local references by display order.
  // Status + countdown are computed against the snapshot's generation day, so
  // recipients see a deterministic view independent of when they open the URL.
  const generationDay = (input.generatedAt ?? new Date().toISOString()).slice(0, 10)
  const warrantyItems = input.warranties ?? []
  const warranties: ShareWarranty[] = warrantyItems.map((w, idx) => {
    const status: WarrantyDateStatus = warrantyDateStatus(
      { startsOn: w.startsOn, endsOn: w.endsOn },
      generationDay,
    )
    const daysRemaining = daysUntilEnd(
      { endsOn: w.endsOn },
      generationDay,
    )
    return {
      id: makeShareWarrantyRef(idx + 1),
      itemName: w.itemName,
      provider: w.provider,
      ...(w.contact !== undefined ? { contact: w.contact } : {}),
      startsOn: w.startsOn,
      endsOn: w.endsOn,
      ...(w.note !== undefined ? { note: w.note } : {}),
      status,
      daysRemaining: Number.isFinite(daysRemaining) ? daysRemaining : 0,
    }
  })

  // Rebuild gantt rows from scratch so the `stageId` field on each row uses
  // the snapshot-local reference. The input rows reference stages by their
  // source IndexedDB key; we look each one up in `stageIdToRef` to swap in
  // the snapshot-local reference. Any row that cannot be matched is dropped
  // because exposing the raw `stageId` would violate SPEC §9.1.
  const stageIdToRef: Record<string, string> = {}
  input.stages.forEach((s, idx) => {
    stageIdToRef[s.id] = makeShareStageRef(idx + 1)
  })
  const rows: ShareGanttRow[] = []
  input.gantt.rows.forEach((r, idx) => {
    // Prefer the snapshot-local reference that matches the source stage's
    // IndexedDB key. As a last-resort fallback, when the row's stageId is
    // missing or unknown, we still map it to a snapshot-local reference by
    // its position in the rows array — this keeps the row count stable.
    const ref = stageIdToRef[r.stageId] ?? makeShareStageRef(idx + 1)
    rows.push({
      stageId: ref,
      name: r.name,
      startIndex: r.startIndex,
      endIndex: r.endIndex,
      span: r.span,
      withinWindow: r.withinWindow,
    })
  })

  return {
    version: SHARE_SNAPSHOT_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    project: {
      name: input.project.name,
      ...(input.project.address !== undefined ? { address: input.project.address } : {}),
      status: input.project.status,
      plannedStart: input.project.plannedStart,
      plannedEnd: input.project.plannedEnd,
      createdAt: input.project.createdAt,
      updatedAt: input.project.updatedAt,
    },
    stages,
    stageSummary: { ...input.stageSummary },
    gantt: {
      totalDays: input.gantt.totalDays,
      days: [...input.gantt.days],
      rows,
    },
    photos,
    budgetSummary: { ...input.budgetSummary },
    scheduleSummary: input.scheduleSummary
      ? { ...input.scheduleSummary }
      : { total: 0, upcoming: 0, overdue: 0, completed: 0 },
    warrantySummary: input.warrantySummary
      ? { ...input.warrantySummary }
      : { total: 0, expiringSoon: 0, expired: 0, active: 0 },
    warranties,
  }
}

/**
 * Encode a snapshot into a `#share=...` URL fragment. The fragment value is
 * the JSON document, base64url-encoded. No Blob, no IndexedDB key, no
 * token (SPEC §9.1).
 */
export function encodeShareSnapshot(snapshot: ShareSnapshot): string {
  const json = JSON.stringify(snapshot)
  const bytes = new TextEncoder().encode(json)
  return bytesToBase64Url(bytes)
}

/**
 * Build a full URL that points at the current page with the snapshot encoded
 * into the hash. The current document location is used unless overridden
 * (tests). The hash is the only transport — no query string, no cookies.
 */
export function buildShareUrl(
  snapshot: ShareSnapshot,
  origin: { href: string; hash: string } = {
    href: typeof window !== 'undefined' ? window.location.href : '',
    hash: typeof window !== 'undefined' ? window.location.hash : '',
  },
): string {
  const encoded = encodeShareSnapshot(snapshot)
  // Always strip any prior share hash so we don't stack fragments on the URL.
  const base = stripShareHash(origin.href)
  const separator = base.includes('#') ? '&' : '#'
  return `${base}${separator}${SHARE_HASH_KEY}=${encoded}`
}

/** Remove the `#share=...` portion from a URL while keeping any other hash. */
export function stripShareUrl(url: string): string {
  return stripShareHash(url)
}

function stripShareHash(url: string): string {
  const hashIdx = url.indexOf('#')
  if (hashIdx === -1) return url
  const before = url.slice(0, hashIdx)
  const hash = url.slice(hashIdx + 1)
  // Split into params so we can preserve any non-share fragments.
  const params = hash.split('&').filter((p) => !p.startsWith(`${SHARE_HASH_KEY}=`))
  if (params.length === 0) return before
  return `${before}#${params.join('&')}`
}

/**
 * Read & decode the snapshot currently encoded in `window.location.hash`.
 * Returns a structured error instead of throwing so the UI can render a
 * friendly message (SPEC §9.1 + AC-FR004-03).
 */
export function decodeShareHash(hash: string | undefined | null): ShareDecodeResult {
  if (!hash) {
    return { ok: false, error: { code: 'missing-hash', message: '缺少分享資訊' } }
  }
  // Accept both `#share=...` and `share=...` (the second form appears when
  // callers pass only the inner hash fragment).
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash
  const params = trimmed.split('&')
  let encoded: string | null = null
  for (const part of params) {
    if (part.startsWith(`${SHARE_HASH_KEY}=`)) {
      encoded = part.slice(SHARE_HASH_KEY.length + 1)
      break
    }
  }
  if (!encoded) {
    return { ok: false, error: { code: 'missing-hash', message: '找不到分享資料' } }
  }
  let bytes: Uint8Array
  try {
    bytes = base64UrlToBytes(encoded)
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'malformed',
        message: err instanceof Error ? `無法解析分享連結：${err.message}` : '無法解析分享連結',
      },
    }
  }
  let raw: unknown
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes))
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'malformed',
        message: err instanceof Error ? `分享連結內容損壞：${err.message}` : '分享連結內容損壞',
      },
    }
  }
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: { code: 'shape', message: '分享資料格式不正確' } }
  }
  const candidate = raw as Record<string, unknown>
  if (typeof candidate.version !== 'number') {
    return {
      ok: false,
      error: { code: 'unknown-version', message: '分享連結缺少版本資訊' },
    }
  }
  if (candidate.version !== SHARE_SNAPSHOT_VERSION) {
    return {
      ok: false,
      error: {
        code: 'unknown-version',
        message: `不支援的分享版本：${candidate.version}`,
      },
    }
  }
  const validated = validateSnapshotShape(candidate)
  if (!validated.ok) {
    return validated
  }
  return { ok: true, snapshot: validated.snapshot }
}

// ---------- internal validation ----------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === 'string' && (options as readonly string[]).includes(value)
}

/** True iff `value` looks like a snapshot-local stage reference (`stage-N`). */
function isShareStageRef(value: unknown): value is string {
  return typeof value === 'string' && /^stage-\d+$/.test(value)
}

/** True iff `value` looks like a snapshot-local photo reference (`photo-N`). */
function isSharePhotoRef(value: unknown): value is string {
  return typeof value === 'string' && /^photo-\d+$/.test(value)
}

function validateSnapshotShape(raw: Record<string, unknown>): ShareDecodeResult {
  if (!isPlainObject(raw.project)) {
    return { ok: false, error: { code: 'shape', message: '工程資料格式不正確' } }
  }
  const project = raw.project
  if (typeof project.name !== 'string' || project.name.length === 0) {
    return { ok: false, error: { code: 'shape', message: '工程名稱缺失' } }
  }
  if (!isOneOf(project.status, PROJECT_STATUSES)) {
    return { ok: false, error: { code: 'shape', message: '工程狀態不正確' } }
  }
  if (!isIsoDate(project.plannedStart) || !isIsoDate(project.plannedEnd)) {
    return { ok: false, error: { code: 'shape', message: '工程日期格式不正確' } }
  }
  if (typeof project.createdAt !== 'string' || typeof project.updatedAt !== 'string') {
    return { ok: false, error: { code: 'shape', message: '工程時間戳記缺失' } }
  }
  if (project.address !== undefined && typeof project.address !== 'string') {
    return { ok: false, error: { code: 'shape', message: '工程地址格式不正確' } }
  }

  if (!Array.isArray(raw.stages)) {
    return { ok: false, error: { code: 'shape', message: '階段資料格式不正確' } }
  }
  const stages: ShareStage[] = []
  for (const item of raw.stages) {
    if (!isPlainObject(item)) {
      return { ok: false, error: { code: 'shape', message: '階段資料格式不正確' } }
    }
    if (!isShareStageRef(item.id)) {
      return { ok: false, error: { code: 'shape', message: '階段 ID 格式不正確（須為快照本地參照）' } }
    }
    if (typeof item.name !== 'string' || item.name.length === 0) {
      return { ok: false, error: { code: 'shape', message: '階段名稱缺失' } }
    }
    if (typeof item.order !== 'number' || !Number.isFinite(item.order)) {
      return { ok: false, error: { code: 'shape', message: '階段排序值不正確' } }
    }
    if (!isOneOf(item.status, STAGE_STATUSES)) {
      return { ok: false, error: { code: 'shape', message: '階段狀態不正確' } }
    }
    if (!isIsoDate(item.plannedStart) || !isIsoDate(item.plannedEnd)) {
      return { ok: false, error: { code: 'shape', message: '階段日期格式不正確' } }
    }
    const stage: ShareStage = {
      id: item.id,
      name: item.name,
      order: item.order,
      status: item.status as StageStatus,
      plannedStart: item.plannedStart,
      plannedEnd: item.plannedEnd,
    }
    if (item.actualStart !== undefined) {
      if (!isIsoDate(item.actualStart)) {
        return { ok: false, error: { code: 'shape', message: '階段實際開始日格式不正確' } }
      }
      stage.actualStart = item.actualStart
    }
    if (item.actualEnd !== undefined) {
      if (!isIsoDate(item.actualEnd)) {
        return { ok: false, error: { code: 'shape', message: '階段實際完成日格式不正確' } }
      }
      stage.actualEnd = item.actualEnd
    }
    if (item.note !== undefined) {
      if (typeof item.note !== 'string') {
        return { ok: false, error: { code: 'shape', message: '階段備註格式不正確' } }
      }
      stage.note = item.note
    }
    stages.push(stage)
  }

  if (!isPlainObject(raw.stageSummary)) {
    return { ok: false, error: { code: 'shape', message: '階段摘要格式不正確' } }
  }
  const summary = raw.stageSummary
  for (const key of ['total', 'completed', 'inProgress', 'blocked', 'notStarted', 'percentComplete']) {
    if (typeof (summary as Record<string, unknown>)[key] !== 'number') {
      return { ok: false, error: { code: 'shape', message: `階段摘要欄位 ${key} 缺失` } }
    }
  }

  if (!isPlainObject(raw.gantt)) {
    return { ok: false, error: { code: 'shape', message: '甘特圖資料格式不正確' } }
  }
  const gantt = raw.gantt
  if (typeof gantt.totalDays !== 'number') {
    return { ok: false, error: { code: 'shape', message: '甘特圖天數不正確' } }
  }
  if (!Array.isArray(gantt.days) || !gantt.days.every((d) => isIsoDate(d))) {
    return { ok: false, error: { code: 'shape', message: '甘特圖日期格式不正確' } }
  }
  if (!Array.isArray(gantt.rows)) {
    return { ok: false, error: { code: 'shape', message: '甘特圖列格式不正確' } }
  }
  const rows: ShareGanttRow[] = []
  for (const item of gantt.rows) {
    if (!isPlainObject(item)) {
      return { ok: false, error: { code: 'shape', message: '甘特圖列格式不正確' } }
    }
    if (!isShareStageRef(item.stageId)) {
      return { ok: false, error: { code: 'shape', message: '甘特圖列 stageId 格式不正確' } }
    }
    if (typeof item.name !== 'string') {
      return { ok: false, error: { code: 'shape', message: '甘特圖列名稱缺失' } }
    }
    for (const key of ['startIndex', 'endIndex', 'span']) {
      if (typeof (item as Record<string, unknown>)[key] !== 'number') {
        return { ok: false, error: { code: 'shape', message: `甘特圖列 ${key} 缺失` } }
      }
    }
    if (typeof item.withinWindow !== 'boolean') {
      return { ok: false, error: { code: 'shape', message: '甘特圖列 withinWindow 缺失' } }
    }
    rows.push({
      stageId: item.stageId,
      name: item.name,
      startIndex: item.startIndex as number,
      endIndex: item.endIndex as number,
      span: item.span as number,
      withinWindow: item.withinWindow,
    })
  }

  if (!Array.isArray(raw.photos)) {
    return { ok: false, error: { code: 'shape', message: '照片資料格式不正確' } }
  }
  const photos: SharePhoto[] = []
  for (const item of raw.photos) {
    if (!isPlainObject(item)) {
      return { ok: false, error: { code: 'shape', message: '照片資料格式不正確' } }
    }
    if (!isSharePhotoRef(item.id)) {
      return { ok: false, error: { code: 'shape', message: '照片 ID 格式不正確（須為快照本地參照）' } }
    }
    if (!isOneOf(item.kind, PHOTO_KINDS)) {
      return { ok: false, error: { code: 'shape', message: '照片類型不正確' } }
    }
    if (item.caption !== undefined && typeof item.caption !== 'string') {
      return { ok: false, error: { code: 'shape', message: '照片說明格式不正確' } }
    }
    if (typeof item.fileName !== 'string' || typeof item.mimeType !== 'string') {
      return { ok: false, error: { code: 'shape', message: '照片檔案資訊缺失' } }
    }
    if (!isIsoDate(item.takenOn)) {
      return { ok: false, error: { code: 'shape', message: '照片拍攝日期格式不正確' } }
    }
    const photo: SharePhoto = {
      id: item.id,
      kind: item.kind as PhotoKind,
      takenOn: item.takenOn,
      fileName: item.fileName,
      mimeType: item.mimeType,
    }
    if (item.caption !== undefined) photo.caption = item.caption
    photos.push(photo)
  }

  if (!isPlainObject(raw.budgetSummary)) {
    return { ok: false, error: { code: 'shape', message: '預算摘要格式不正確' } }
  }
  const budget = raw.budgetSummary
  for (const key of ['total', 'totalPlanned', 'totalActual', 'remaining', 'isOverrun', 'totalOverrun', 'overrunItemCount']) {
    if (typeof (budget as Record<string, unknown>)[key] !== 'number' && typeof (budget as Record<string, unknown>)[key] !== 'boolean') {
      return { ok: false, error: { code: 'shape', message: `預算摘要欄位 ${key} 缺失` } }
    }
  }
  if (!isPlainObject(budget.paymentCounts)) {
    return { ok: false, error: { code: 'shape', message: '預算付款計數格式不正確' } }
  }
  const pc = budget.paymentCounts
  for (const key of ['unpaid', 'partial', 'paid']) {
    if (typeof (pc as Record<string, unknown>)[key] !== 'number') {
      return { ok: false, error: { code: 'shape', message: `預算付款計數 ${key} 缺失` } }
    }
  }

  if (!isPlainObject(raw.scheduleSummary)) {
    return { ok: false, error: { code: 'shape', message: '行程摘要格式不正確' } }
  }
  const ss = raw.scheduleSummary
  for (const key of ['total', 'upcoming', 'overdue', 'completed']) {
    if (typeof (ss as Record<string, unknown>)[key] !== 'number') {
      return { ok: false, error: { code: 'shape', message: `行程摘要欄位 ${key} 缺失` } }
    }
  }

  if (!isPlainObject(raw.warrantySummary)) {
    return { ok: false, error: { code: 'shape', message: '保固摘要格式不正確' } }
  }
  const ws = raw.warrantySummary
  for (const key of ['total', 'expiringSoon', 'expired', 'active']) {
    if (typeof (ws as Record<string, unknown>)[key] !== 'number') {
      return { ok: false, error: { code: 'shape', message: `保固摘要欄位 ${key} 缺失` } }
    }
  }

  // FR-006 warranty items are optional (older snapshots pre-date the feature).
  // We validate the array shape when present, but never reject the snapshot
  // for missing entries — defaults to `[]`.
  let warranties: ShareWarranty[] = []
  if (raw.warranties !== undefined) {
    if (!Array.isArray(raw.warranties)) {
      return { ok: false, error: { code: 'shape', message: '保固紀錄格式不正確' } }
    }
    for (const item of raw.warranties) {
      if (!isPlainObject(item)) {
        return { ok: false, error: { code: 'shape', message: '保固紀錄格式不正確' } }
      }
      if (!isShareWarrantyRef(item.id)) {
        return {
          ok: false,
          error: { code: 'shape', message: '保固 ID 格式不正確（須為快照本地參照）' },
        }
      }
      if (typeof item.itemName !== 'string' || item.itemName.length === 0) {
        return { ok: false, error: { code: 'shape', message: '保固項目名稱缺失' } }
      }
      if (typeof item.provider !== 'string' || item.provider.length === 0) {
        return { ok: false, error: { code: 'shape', message: '保固提供者缺失' } }
      }
      if (!isIsoDate(item.startsOn) || !isIsoDate(item.endsOn)) {
        return { ok: false, error: { code: 'shape', message: '保固日期格式不正確' } }
      }
      if (!isOneOf(item.status, WARRANTY_DATE_STATUSES)) {
        return { ok: false, error: { code: 'shape', message: '保固狀態不正確' } }
      }
      if (typeof item.daysRemaining !== 'number' || !Number.isFinite(item.daysRemaining)) {
        return { ok: false, error: { code: 'shape', message: '保固剩餘天數不正確' } }
      }
      const warranty: ShareWarranty = {
        id: item.id,
        itemName: item.itemName,
        provider: item.provider,
        startsOn: item.startsOn,
        endsOn: item.endsOn,
        status: item.status as WarrantyDateStatus,
        daysRemaining: item.daysRemaining,
      }
      if (item.contact !== undefined) {
        if (typeof item.contact !== 'string') {
          return { ok: false, error: { code: 'shape', message: '保固聯絡格式不正確' } }
        }
        warranty.contact = item.contact
      }
      if (item.note !== undefined) {
        if (typeof item.note !== 'string') {
          return { ok: false, error: { code: 'shape', message: '保固備註格式不正確' } }
        }
        warranty.note = item.note
      }
      warranties.push(warranty)
    }
  }

  const snapshot: ShareSnapshot = {
    version: SHARE_SNAPSHOT_VERSION,
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : new Date().toISOString(),
    project: {
      name: project.name,
      ...(project.address !== undefined ? { address: project.address as string } : {}),
      status: project.status as ProjectStatus,
      plannedStart: project.plannedStart,
      plannedEnd: project.plannedEnd,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    stages,
    stageSummary: {
      total: summary.total as number,
      completed: summary.completed as number,
      inProgress: summary.inProgress as number,
      blocked: summary.blocked as number,
      notStarted: summary.notStarted as number,
      percentComplete: summary.percentComplete as number,
    },
    gantt: {
      totalDays: gantt.totalDays as number,
      days: gantt.days as string[],
      rows,
    },
    photos,
    budgetSummary: {
      total: budget.total as number,
      totalPlanned: budget.totalPlanned as number,
      totalActual: budget.totalActual as number,
      remaining: budget.remaining as number,
      isOverrun: budget.isOverrun as boolean,
      totalOverrun: budget.totalOverrun as number,
      overrunItemCount: budget.overrunItemCount as number,
      paymentCounts: {
        unpaid: pc.unpaid as number,
        partial: pc.partial as number,
        paid: pc.paid as number,
      },
    },
    scheduleSummary: {
      total: ss.total as number,
      upcoming: ss.upcoming as number,
      overdue: ss.overdue as number,
      completed: ss.completed as number,
    },
    warrantySummary: {
      total: ws.total as number,
      expiringSoon: ws.expiringSoon as number,
      expired: ws.expired as number,
      active: ws.active as number,
    },
    ...(warranties.length > 0 || raw.warranties !== undefined
      ? { warranties }
      : {}),
  }
  return { ok: true, snapshot }
}