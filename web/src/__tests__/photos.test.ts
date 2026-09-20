// Photo domain unit tests — AC-FR002-02 (file validation) and AC-FR002-03
// (sort + filter). Pure helpers, no DOM / IndexedDB.

import { describe, expect, it } from 'vitest'
import {
  comparePhotosByTakenOnDesc,
  filterPhotosByKind,
  isPhotoKind,
  sortPhotosByTakenOnDesc,
  summarizePhotos,
  validatePhotoFile,
  validatePhotoInput,
  validatePhotoMetadata,
} from '../photos'
import type { PhotoRecord } from '../types'

function fakeFile(name: string, size: number, type: string): File {
  // jsdom File lacks the size/type plumbing for tests that just need a stub.
  // We override the properties so validatePhotoFile sees deterministic values.
  const f = new File(['x'.repeat(Math.min(size, 8))], name, { type })
  Object.defineProperty(f, 'size', { value: size, configurable: true })
  return f
}

function fakeBlob(size: number): Blob {
  return new Blob([new Uint8Array(size)], { type: 'image/png' })
}

function mkPhoto(overrides: Partial<PhotoRecord> = {}): PhotoRecord {
  return {
    id: 'photo-' + Math.random().toString(36).slice(2, 8),
    projectId: 'proj-1',
    kind: 'progress',
    takenOn: '2026-02-09',
    fileName: 'shot.png',
    mimeType: 'image/png',
    blob: fakeBlob(16),
    createdAt: '2026-02-09T00:00:00.000Z',
    ...overrides,
  }
}

describe('validatePhotoFile — AC-FR002-02', () => {
  it('rejects a null/undefined file', () => {
    const r1 = validatePhotoFile(null)
    expect(r1.ok).toBe(false)
    expect(r1.errors[0]!.message).toMatch(/請選擇照片檔案/)
    const r2 = validatePhotoFile(undefined)
    expect(r2.ok).toBe(false)
  })

  it('rejects a non-image mime type', () => {
    const f = fakeFile('notes.pdf', 1024, 'application/pdf')
    const r = validatePhotoFile(f)
    expect(r.ok).toBe(false)
    expect(r.errors[0]!.message).toMatch(/只接受圖片/)
  })

  it('rejects a file larger than 10 MB', () => {
    const f = fakeFile('big.png', 11 * 1024 * 1024, 'image/png')
    const r = validatePhotoFile(f)
    expect(r.ok).toBe(false)
    expect(r.errors[0]!.message).toMatch(/10 MB/)
  })

  it('accepts a 10 MB image exactly', () => {
    const f = fakeFile('ten.png', 10 * 1024 * 1024, 'image/png')
    const r = validatePhotoFile(f)
    expect(r.ok).toBe(true)
    expect(r.errors).toEqual([])
  })

  it('accepts a small png', () => {
    const f = fakeFile('small.png', 12_345, 'image/png')
    expect(validatePhotoFile(f).ok).toBe(true)
  })

  it('falls back to filename sniff when mime is empty', () => {
    const f = fakeFile('image.jpg', 1024, '')
    expect(validatePhotoFile(f).ok).toBe(true)
    const g = fakeFile('notes.txt', 1024, '')
    expect(validatePhotoFile(g).ok).toBe(false)
  })
})

describe('validatePhotoMetadata', () => {
  it('accepts well-formed metadata', () => {
    expect(validatePhotoMetadata({ kind: 'progress', takenOn: '2026-02-09' }).ok).toBe(true)
  })

  it('rejects an unknown kind', () => {
    const r = validatePhotoMetadata({ kind: 'during', takenOn: '2026-02-09' })
    expect(r.ok).toBe(false)
    expect(r.errors[0]!.field).toBe('kind')
  })

  it('rejects an empty kind', () => {
    const r = validatePhotoMetadata({ kind: '', takenOn: '2026-02-09' })
    expect(r.ok).toBe(false)
  })

  it('rejects an empty takenOn', () => {
    const r = validatePhotoMetadata({ kind: 'after', takenOn: '' })
    expect(r.ok).toBe(false)
    expect(r.errors[0]!.field).toBe('takenOn')
  })

  it('rejects a malformed takenOn', () => {
    const r = validatePhotoMetadata({ kind: 'after', takenOn: '2026/02/09' })
    expect(r.ok).toBe(false)
  })

  it('rejects an empty stageId', () => {
    const r = validatePhotoMetadata({ kind: 'after', takenOn: '2026-02-09', stageId: '' })
    expect(r.ok).toBe(false)
  })

  it('accepts a stageId when present and non-empty', () => {
    const r = validatePhotoMetadata({ kind: 'after', takenOn: '2026-02-09', stageId: 'stage-1' })
    expect(r.ok).toBe(true)
  })
})

describe('validatePhotoInput', () => {
  it('rejects when file is missing', () => {
    const r = validatePhotoInput(null, { kind: 'progress', takenOn: '2026-02-09' })
    expect(r.ok).toBe(false)
  })

  it('rejects when metadata is bad even if file is fine', () => {
    const f = fakeFile('shot.png', 1024, 'image/png')
    const r = validatePhotoInput(f, { kind: '', takenOn: '2026-02-09' })
    expect(r.ok).toBe(false)
    expect(r.errors[0]!.field).toBe('kind')
  })

  it('accepts a complete, valid input', () => {
    const f = fakeFile('shot.png', 1024, 'image/png')
    const r = validatePhotoInput(f, {
      kind: 'progress',
      takenOn: '2026-02-09',
      stageId: 'stage-1',
    })
    expect(r.ok).toBe(true)
  })
})

describe('isPhotoKind', () => {
  it('matches the three SPEC §4.4 values', () => {
    expect(isPhotoKind('before')).toBe(true)
    expect(isPhotoKind('progress')).toBe(true)
    expect(isPhotoKind('after')).toBe(true)
  })
  it('rejects other strings', () => {
    expect(isPhotoKind('during')).toBe(false)
    expect(isPhotoKind('')).toBe(false)
    expect(isPhotoKind(null)).toBe(false)
    expect(isPhotoKind(undefined)).toBe(false)
  })
})

describe('comparePhotosByTakenOnDesc / sortPhotosByTakenOnDesc — AC-FR002-03', () => {
  it('orders photos takenOn descending', () => {
    const list = [
      mkPhoto({ id: 'a', takenOn: '2026-02-01' }),
      mkPhoto({ id: 'b', takenOn: '2026-02-15' }),
      mkPhoto({ id: 'c', takenOn: '2026-02-09' }),
    ]
    const sorted = list.slice().sort(comparePhotosByTakenOnDesc)
    expect(sorted.map((p) => p.id)).toEqual(['b', 'c', 'a'])
  })

  it('tie-breaks by createdAt desc', () => {
    const list = [
      mkPhoto({ id: 'a', takenOn: '2026-02-09', createdAt: '2026-02-09T01:00:00.000Z' }),
      mkPhoto({ id: 'b', takenOn: '2026-02-09', createdAt: '2026-02-09T03:00:00.000Z' }),
    ]
    const sorted = list.slice().sort(comparePhotosByTakenOnDesc)
    expect(sorted.map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('tie-breaks by id asc for determinism', () => {
    const list = [
      mkPhoto({ id: 'b', takenOn: '2026-02-09', createdAt: '2026-02-09T00:00:00.000Z' }),
      mkPhoto({ id: 'a', takenOn: '2026-02-09', createdAt: '2026-02-09T00:00:00.000Z' }),
    ]
    const sorted = list.slice().sort(comparePhotosByTakenOnDesc)
    expect(sorted.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('sortPhotosByTakenOnDesc does not mutate input', () => {
    const list = [
      mkPhoto({ id: 'a', takenOn: '2026-02-01' }),
      mkPhoto({ id: 'b', takenOn: '2026-02-15' }),
    ]
    const before = list.map((p) => p.id)
    sortPhotosByTakenOnDesc(list)
    expect(list.map((p) => p.id)).toEqual(before)
  })
})

describe('filterPhotosByKind — AC-FR002-03', () => {
  const photos = [
    mkPhoto({ id: 'a', kind: 'before' }),
    mkPhoto({ id: 'b', kind: 'progress' }),
    mkPhoto({ id: 'c', kind: 'after' }),
    mkPhoto({ id: 'd', kind: 'before' }),
  ]
  it('returns everything for "all"', () => {
    expect(filterPhotosByKind(photos, 'all').map((p) => p.id)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('filters by kind', () => {
    expect(filterPhotosByKind(photos, 'before').map((p) => p.id)).toEqual(['a', 'd'])
    expect(filterPhotosByKind(photos, 'progress').map((p) => p.id)).toEqual(['b'])
    expect(filterPhotosByKind(photos, 'after').map((p) => p.id)).toEqual(['c'])
  })
  it('returns an empty array when nothing matches', () => {
    expect(filterPhotosByKind([], 'after')).toEqual([])
  })
})

describe('summarizePhotos', () => {
  it('counts each kind', () => {
    const s = summarizePhotos([
      mkPhoto({ kind: 'before' }),
      mkPhoto({ kind: 'before' }),
      mkPhoto({ kind: 'progress' }),
      mkPhoto({ kind: 'after' }),
    ])
    expect(s).toEqual({ total: 4, before: 2, progress: 1, after: 1 })
  })
  it('handles empty input', () => {
    expect(summarizePhotos([])).toEqual({ total: 0, before: 0, progress: 0, after: 0 })
  })
})
