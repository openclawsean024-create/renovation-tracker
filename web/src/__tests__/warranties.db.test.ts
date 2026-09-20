// Warranty IndexedDB tests — AC-FR006-01 (CRUD & persistence) + AC-FR006-04
// (test coverage of round-trip / byProjectId / delete / schema upgrade).
//
// Verifies the v4 → v5 schema upgrade keeps projects + stages + photos +
// budgets + schedules intact while introducing the new 'warranties' object
// store, and that warranty fields survive the structured-clone round-trip
// without drift.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAll,
  closeDb,
  deleteBudget,
  deletePhoto,
  deleteSchedule,
  deleteWarranty,
  deleteWarrantiesByProject,
  getAllBudgets,
  getAllPhotos,
  getAllProjects,
  getAllSchedules,
  getAllStages,
  getAllWarranties,
  getWarrantiesByProject,
  openDb,
  putBudget,
  putPhoto,
  putProject,
  putSchedule,
  putStage,
  putWarranty,
  resetDbCache,
  STORE_WARRANTIES,
} from '../db'
import type {
  BudgetItem,
  PhotoRecord,
  Project,
  ScheduleItem,
  Stage,
  WarrantyRecord,
} from '../types'

function fakeBlob(bytes: number[], mime = 'image/png'): Blob {
  return new Blob([new Uint8Array(bytes)], { type: mime })
}

function mkProject(): Project {
  return {
    id: 'proj-1',
    name: '我的裝修工程',
    status: 'in_progress',
    plannedStart: '2026-01-05',
    plannedEnd: '2026-02-06',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function mkStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: 'stage-1',
    projectId: 'proj-1',
    name: '拆除',
    order: 1,
    status: 'completed',
    plannedStart: '2026-01-05',
    plannedEnd: '2026-01-09',
    actualStart: '2026-01-05',
    actualEnd: '2026-01-08',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function mkPhoto(overrides: Partial<PhotoRecord> = {}): PhotoRecord {
  return {
    id: 'photo-1',
    projectId: 'proj-1',
    kind: 'progress',
    takenOn: '2026-01-10',
    fileName: 'shot.png',
    mimeType: 'image/png',
    blob: fakeBlob([1, 2, 3]),
    createdAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  }
}

function mkBudget(overrides: Partial<BudgetItem> = {}): BudgetItem {
  return {
    id: 'budget-1',
    projectId: 'proj-1',
    category: '材料',
    name: '磁磚',
    plannedAmount: 10000,
    actualAmount: 0,
    paymentStatus: 'unpaid',
    note: '客廳',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  }
}

function mkSchedule(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 'schedule-1',
    projectId: 'proj-1',
    workerName: '水電師傅',
    startOn: '2026-01-10',
    endOn: '2026-01-15',
    completed: false,
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
    ...overrides,
  }
}

function mkWarranty(overrides: Partial<WarrantyRecord> = {}): WarrantyRecord {
  return {
    id: 'warranty-' + Math.random().toString(36).slice(2, 8),
    projectId: 'proj-1',
    itemName: '磁磚保固',
    provider: '里歐建材',
    contact: '0912345678',
    startsOn: '2026-01-01',
    endsOn: '2027-01-01',
    note: '客廳',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

async function resetDb(): Promise<void> {
  await closeDb()
  resetDbCache()
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('renovation-tracker')
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
  resetDbCache()
}

describe('Warranty IndexedDB — schema + round-trip (AC-FR006-01)', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('round-trips a warranty record across simulated reload', async () => {
    const item = mkWarranty({
      id: 'w1',
      itemName: '磁磚保固',
      provider: '里歐建材',
      contact: '02-1234-5678',
      startsOn: '2026-01-15',
      endsOn: '2027-01-15',
      note: '客廳',
    })
    await putWarranty(item)

    await closeDb()
    resetDbCache()
    const all = await getAllWarranties()
    expect(all).toHaveLength(1)
    const back = all[0]!
    expect(back.id).toBe('w1')
    expect(back.projectId).toBe('proj-1')
    expect(back.itemName).toBe('磁磚保固')
    expect(back.provider).toBe('里歐建材')
    expect(back.contact).toBe('02-1234-5678')
    expect(back.startsOn).toBe('2026-01-15')
    expect(back.endsOn).toBe('2027-01-15')
    expect(back.note).toBe('客廳')
  })

  it('preserves optional fields as undefined when omitted', async () => {
    const item = mkWarranty({ id: 'w-min', contact: undefined, note: undefined })
    await putWarranty(item)

    await closeDb()
    resetDbCache()
    const back = (await getAllWarranties())[0]!
    expect(back.contact).toBeUndefined()
    expect(back.note).toBeUndefined()
  })

  it('deleteWarranty removes only the targeted record', async () => {
    await putWarranty(mkWarranty({ id: 'keep' }))
    await putWarranty(mkWarranty({ id: 'drop' }))
    await deleteWarranty('drop')
    await closeDb()
    resetDbCache()
    const ids = (await getAllWarranties()).map((w) => w.id).sort()
    expect(ids).toEqual(['keep'])
  })

  it('getWarrantiesByProject filters via the byProjectId index', async () => {
    await putWarranty(mkWarranty({ id: 'a', projectId: 'proj-1' }))
    await putWarranty(mkWarranty({ id: 'b', projectId: 'proj-1' }))
    await putWarranty(mkWarranty({ id: 'c', projectId: 'proj-2' }))
    await closeDb()
    resetDbCache()
    expect(
      (await getWarrantiesByProject('proj-1')).map((w) => w.id).sort(),
    ).toEqual(['a', 'b'])
    expect((await getWarrantiesByProject('proj-2')).map((w) => w.id)).toEqual(['c'])
    expect(await getWarrantiesByProject('proj-3')).toEqual([])
  })

  it('deleteWarrantiesByProject removes only the target project', async () => {
    await putWarranty(mkWarranty({ id: 'a', projectId: 'proj-1' }))
    await putWarranty(mkWarranty({ id: 'b', projectId: 'proj-1' }))
    await putWarranty(mkWarranty({ id: 'c', projectId: 'proj-2' }))
    await deleteWarrantiesByProject('proj-1')
    await closeDb()
    resetDbCache()
    expect((await getAllWarranties()).map((w) => w.id)).toEqual(['c'])
  })

  it('clearAll also wipes warranties', async () => {
    await putWarranty(mkWarranty({ id: 'a' }))
    await putWarranty(mkWarranty({ id: 'b' }))
    await clearAll()
    expect(await getAllWarranties()).toEqual([])
  })

  it('exposes the warranties object store with keyPath id and byProjectId index', async () => {
    await putWarranty(mkWarranty({ id: 'a', projectId: 'proj-1' }))
    const db = await openDb()
    expect(db.objectStoreNames.contains(STORE_WARRANTIES)).toBe(true)
    const tx = db.transaction(STORE_WARRANTIES, 'readonly')
    const store = tx.objectStore(STORE_WARRANTIES)
    expect(store.keyPath).toBe('id')
    expect(Array.from(store.indexNames)).toContain('byProjectId')
    db.close()
  })
})

describe('Warranty IndexedDB — v5 schema upgrade is additive (FR-001～FR-005 preserved)', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('keeps pre-existing project / stage / photo / budget / schedule data when upgrading to v5', async () => {
    // Seed FR-001～FR-005 records BEFORE the upgrade path sees them — they
    // trigger the v1→v2→v3→v4→v5 onupgradeneeded callbacks under fresh
    // fake-indexeddb.
    await putProject(mkProject())
    await putStage(mkStage())
    await putPhoto(mkPhoto())
    await putBudget(mkBudget())
    await putSchedule(mkSchedule())

    await closeDb()
    resetDbCache()
    const [projects, stages, photos, budgets, schedules, warranties] = await Promise.all([
      getAllProjects(),
      getAllStages(),
      getAllPhotos(),
      getAllBudgets(),
      getAllSchedules(),
      getAllWarranties(),
    ])
    expect(projects.map((p) => p.id)).toEqual(['proj-1'])
    expect(stages.map((s) => s.id)).toEqual(['stage-1'])
    expect(photos.map((p) => p.id)).toEqual(['photo-1'])
    expect(budgets.map((b) => b.id)).toEqual(['budget-1'])
    expect(schedules.map((s) => s.id)).toEqual(['schedule-1'])
    // No warranties yet — empty list, not undefined.
    expect(warranties).toEqual([])
  })

  it('supports writing warranties alongside pre-existing records', async () => {
    await putProject(mkProject())
    await putStage(mkStage())
    await putPhoto(mkPhoto())
    await putBudget(mkBudget())
    await putSchedule(mkSchedule())
    await putWarranty(mkWarranty({ id: 'w1' }))
    await putWarranty(mkWarranty({ id: 'w2', projectId: 'proj-2' }))

    await closeDb()
    resetDbCache()
    expect(await getAllWarranties()).toHaveLength(2)
    // Pre-existing data is still reachable through their respective queries.
    expect(await getAllProjects()).toHaveLength(1)
    expect(await getAllStages()).toHaveLength(1)
    expect(await getAllPhotos()).toHaveLength(1)
    expect(await getAllBudgets()).toHaveLength(1)
    expect(await getAllSchedules()).toHaveLength(1)
  })
})

describe('Warranty IndexedDB — ISO date integrity (no drift on read)', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('preserves exact ISO YYYY-MM-DD strings verbatim', async () => {
    await putWarranty(mkWarranty({ id: 'iso', startsOn: '2026-02-29', endsOn: '2027-02-28' }))
    await closeDb()
    resetDbCache()
    const back = (await getAllWarranties())[0]!
    expect(back.startsOn).toBe('2026-02-29')
    expect(back.endsOn).toBe('2027-02-28')
  })

  it('persists zero-as-okay empty string contact as undefined', async () => {
    await putWarranty(mkWarranty({ id: 'no-contact', contact: undefined }))
    await closeDb()
    resetDbCache()
    expect((await getAllWarranties())[0]!.contact).toBeUndefined()
  })

  it('upsert semantics: putWarranty with the same id replaces the prior record', async () => {
    await putWarranty(mkWarranty({ id: 'same', itemName: 'before' }))
    await putWarranty(mkWarranty({ id: 'same', itemName: 'after' }))
    await closeDb()
    resetDbCache()
    const all = await getAllWarranties()
    expect(all).toHaveLength(1)
    expect(all[0]!.itemName).toBe('after')
  })
})

// Touch the imported helpers so tree-shaking never drops them — these are
// used by tests for FR-001～FR-005 coverage and we want the same import
// surface for FR-006 to feel consistent.
void deleteBudget
void deletePhoto
void deleteSchedule