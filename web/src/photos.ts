// FR-002 photo domain helpers. See PRD/SPEC.md §4.4 and AC-FR002-01~05.
//
// PhotoRecords are persisted as IndexedDB Blobs; this module contains the
// pure logic that doesn't touch the DOM or IndexedDB — file validation, list
// filtering, sort + summary helpers — so the same rules can be exercised
// in unit tests without spinning up jsdom or fake-indexeddb.

import { MAX_PHOTO_BYTES, type PhotoKind, type PhotoRecord } from './types'

/** Human-friendly error returned by file / input validators. */
export interface PhotoValidationError {
  field: 'file' | 'kind' | 'takenOn' | 'stageId'
  message: string
}

export interface PhotoValidationResult {
  ok: boolean
  errors: PhotoValidationError[]
}

/**
 * Validate a single File before it is persisted.
 * SPEC §4.4: only `image/*` is accepted and the file must be <= 10 MB.
 * The error field is always `'file'` for file-level violations so the form
 * can render a single, well-understood message (AC-FR002-02).
 */
export function validatePhotoFile(file: File | null | undefined): PhotoValidationResult {
  const errors: PhotoValidationError[] = []
  if (!file) {
    errors.push({ field: 'file', message: '請選擇照片檔案' })
    return { ok: false, errors }
  }
  // File#type may be empty for some browsers; the mime sniff below is the
  // defensive fallback. Either way the user must be told the file is
  // unusable.
  const mime = (file.type || '').toLowerCase()
  const isImage =
    mime.startsWith('image/') ||
    // Some browsers (and jsdom) report no mime type for synthetic Files.
    // Fall back to the extension sniff so the validator still rejects
    // clearly non-image extensions like .pdf or .txt.
    /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|avif)$/i.test(file.name ?? '')
  if (!isImage) {
    errors.push({ field: 'file', message: '只接受圖片檔案（image/*）' })
  }
  if (typeof file.size === 'number' && file.size > MAX_PHOTO_BYTES) {
    errors.push({ field: 'file', message: '照片檔案不得超過 10 MB' })
  }
  return { ok: errors.length === 0, errors }
}

/** True when a string is one of the accepted PhotoKind values. */
export function isPhotoKind(value: string | null | undefined): value is PhotoKind {
  return value === 'before' || value === 'progress' || value === 'after'
}

/**
 * Validate the metadata portion of a new photo: kind + takenOn must be
 * well-formed; stageId (if provided) must be a non-empty string.
 * File validation is handled separately by `validatePhotoFile`.
 */
export function validatePhotoMetadata(input: {
  kind?: string | null
  takenOn?: string
  stageId?: string
}): PhotoValidationResult {
  const errors: PhotoValidationError[] = []
  if (!isPhotoKind(input.kind)) {
    errors.push({ field: 'kind', message: '請選擇照片分類' })
  }
  const taken = input.takenOn ?? ''
  if (!taken) {
    errors.push({ field: 'takenOn', message: '請選擇拍攝日期' })
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(taken)) {
    errors.push({ field: 'takenOn', message: '拍攝日期格式不正確' })
  }
  if (input.stageId !== undefined && input.stageId.length === 0) {
    errors.push({ field: 'stageId', message: '關聯階段不可為空字串' })
  }
  return { ok: errors.length === 0, errors }
}

/** Convenience: validate file + metadata together. */
export function validatePhotoInput(
  file: File | null | undefined,
  input: { kind?: string | null; takenOn?: string; stageId?: string },
): PhotoValidationResult {
  const fileResult = validatePhotoFile(file)
  if (!fileResult.ok) return fileResult
  return validatePhotoMetadata(input)
}

/**
 * Stable comparator that orders photos by `takenOn` descending, with
 * `createdAt` desc and `id` asc as tie-breakers. Pure; deterministic.
 */
export function comparePhotosByTakenOnDesc(a: PhotoRecord, b: PhotoRecord): number {
  if (a.takenOn !== b.takenOn) {
    // YYYY-MM-DD strings sort lexicographically the same as chronologically.
    return a.takenOn < b.takenOn ? 1 : -1
  }
  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? 1 : -1
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Filter helper used by the UI to narrow a list by `kind`. */
export function filterPhotosByKind(
  photos: PhotoRecord[],
  kind: PhotoKind | 'all',
): PhotoRecord[] {
  if (kind === 'all') return photos.slice()
  return photos.filter((p) => p.kind === kind)
}

/** Convenience: produce a defensive copy sorted by `takenOn` desc. */
export function sortPhotosByTakenOnDesc(photos: PhotoRecord[]): PhotoRecord[] {
  return photos.slice().sort(comparePhotosByTakenOnDesc)
}

/** Small per-kind counter used in summary cells / a11y labels. */
export interface PhotoSummary {
  total: number
  before: number
  progress: number
  after: number
}

export function summarizePhotos(photos: PhotoRecord[]): PhotoSummary {
  let total = 0
  let before = 0
  let progress = 0
  let after = 0
  for (const p of photos) {
    total += 1
    if (p.kind === 'before') before += 1
    else if (p.kind === 'progress') progress += 1
    else if (p.kind === 'after') after += 1
  }
  return { total, before, progress, after }
}
