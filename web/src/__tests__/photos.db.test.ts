// Photo IndexedDB tests — AC-FR002-05 covers Blob round-trip + delete confirm.
//
// Uses fake-indexeddb so we exercise the real db.ts code path including the
// v1 → v2 schema migration and the keyPath-based photos object store.
//
// NOTE: This file runs under Vitest's `node` environment (not jsdom). jsdom
// replaces the global Blob with its own implementation that does NOT survive
// Node's native structuredClone — which is what fake-indexeddb uses to copy
// values across the IDB boundary. Running this file under pure Node lets the
// real Blob class round-trip with byte-for-byte fidelity, matching what the
// production browser does via IDB's structured clone.
// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAll,
  closeDb,
  deletePhoto,
  deletePhotosByProject,
  getAllPhotos,
  getPhotosByProject,
  openDb,
  putPhoto,
  resetDbCache,
  STORE_PHOTOS,
} from '../db'
import type { PhotoRecord } from '../types'

function fakeBlob(bytes: number[], mime = 'image/png'): Blob {
  return new Blob([new Uint8Array(bytes)], { type: mime })
}

function mkPhoto(overrides: Partial<PhotoRecord> = {}): PhotoRecord {
  return {
    id: 'photo-' + Math.random().toString(36).slice(2, 8),
    projectId: 'proj-1',
    kind: 'progress',
    takenOn: '2026-02-09',
    fileName: 'shot.png',
    mimeType: 'image/png',
    blob: fakeBlob([1, 2, 3, 4]),
    createdAt: '2026-02-09T00:00:00.000Z',
    ...overrides,
  }
}

describe('Photo IndexedDB round-trip — AC-FR002-05', () => {
  beforeEach(async () => {
    await closeDb()
    resetDbCache()
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('renovation-tracker')
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
      req.onblocked = () => resolve()
    })
    resetDbCache()
  })

  it('round-trips a photo Blob across simulated reloads', async () => {
    const blob = fakeBlob([10, 20, 30, 40, 50])
    const photo = mkPhoto({ id: 'p1', blob, mimeType: 'image/png' })
    await putPhoto(photo)

    // Simulate a reload — close + reopen the connection.
    await closeDb()
    resetDbCache()
    const all = await getAllPhotos()
    expect(all).toHaveLength(1)
    const round = all[0]!
    expect(round.id).toBe('p1')
    expect(round.fileName).toBe('shot.png')
    expect(round.mimeType).toBe('image/png')
    expect(round.kind).toBe('progress')
    expect(round.takenOn).toBe('2026-02-09')
    // Blob identity + bytes must survive the round-trip — the production
    // browser does this via IDB's structured clone; under node + fake-indexeddb
    // we get the same behaviour because both go through Node's structuredClone.
    expect(round.blob).toBeInstanceOf(Blob)
    expect(round.blob.size).toBe(5)
    expect(round.blob.type).toBe('image/png')
    const roundBytes = new Uint8Array(await round.blob.arrayBuffer())
    expect(Array.from(roundBytes)).toEqual([10, 20, 30, 40, 50])
  })

  it('preserves Blob contents for jpeg and arbitrary bytes', async () => {
    const bytes = Array.from({ length: 64 }, (_, i) => i * 4)
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' })
    await putPhoto(mkPhoto({ id: 'p2', blob, mimeType: 'image/jpeg' }))
    await closeDb()
    resetDbCache()
    const all = await getAllPhotos()
    const back = all.find((p) => p.id === 'p2')!
    expect(back.blob).toBeInstanceOf(Blob)
    expect(back.blob.type).toBe('image/jpeg')
    expect(back.blob.size).toBe(64)
    const buf = new Uint8Array(await back.blob.arrayBuffer())
    expect(Array.from(buf)).toEqual(bytes)
  })

  it('round-trips a Blob constructed from a plain string', async () => {
    const blob = new Blob(['hello-photo'], { type: 'image/webp' })
    await putPhoto(mkPhoto({ id: 'p3', blob, mimeType: 'image/webp' }))
    await closeDb()
    resetDbCache()
    const all = await getAllPhotos()
    const back = all.find((p) => p.id === 'p3')!
    expect(back.blob).toBeInstanceOf(Blob)
    expect(back.blob.type).toBe('image/webp')
    expect(await back.blob.text()).toBe('hello-photo')
  })

  it('filters photos by projectId via the index', async () => {
    await putPhoto(mkPhoto({ id: 'a', projectId: 'proj-1' }))
    await putPhoto(mkPhoto({ id: 'b', projectId: 'proj-1' }))
    await putPhoto(mkPhoto({ id: 'c', projectId: 'proj-2' }))
    await closeDb()
    resetDbCache()
    const a = await getPhotosByProject('proj-1')
    const c = await getPhotosByProject('proj-2')
    expect(a.map((p) => p.id).sort()).toEqual(['a', 'b'])
    expect(c.map((p) => p.id)).toEqual(['c'])
  })

  it('deletePhoto removes the record but keeps the rest intact', async () => {
    await putPhoto(mkPhoto({ id: 'a' }))
    await putPhoto(mkPhoto({ id: 'b' }))
    await deletePhoto('a')
    await closeDb()
    resetDbCache()
    const remaining = (await getAllPhotos()).map((p) => p.id).sort()
    expect(remaining).toEqual(['b'])
  })

  it('deletePhotosByProject removes only the target project photos', async () => {
    await putPhoto(mkPhoto({ id: 'a', projectId: 'proj-1' }))
    await putPhoto(mkPhoto({ id: 'b', projectId: 'proj-1' }))
    await putPhoto(mkPhoto({ id: 'c', projectId: 'proj-2' }))
    await deletePhotosByProject('proj-1')
    await closeDb()
    resetDbCache()
    const remaining = (await getAllPhotos()).map((p) => p.id)
    expect(remaining).toEqual(['c'])
  })

  it('clearAll also wipes photos', async () => {
    await putPhoto(mkPhoto({ id: 'a' }))
    await putPhoto(mkPhoto({ id: 'b' }))
    await clearAll()
    expect(await getAllPhotos()).toEqual([])
  })

  it('exposes the photos object store with keyPath id and byProjectId index', async () => {
    await putPhoto(mkPhoto({ id: 'a', projectId: 'proj-1' }))
    const db = await openDb()
    expect(db.objectStoreNames.contains(STORE_PHOTOS)).toBe(true)
    const tx = db.transaction(STORE_PHOTOS, 'readonly')
    const store = tx.objectStore(STORE_PHOTOS)
    expect(store.keyPath).toBe('id')
    const indexes = Array.from(store.indexNames)
    expect(indexes).toContain('byProjectId')
    db.close()
  })
})
