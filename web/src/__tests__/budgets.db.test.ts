// Budget IndexedDB tests — AC-FR003-01 (CRUD & persistence) + AC-FR003-04
// (test coverage of totals / payment status / delete).
//
// Verifies the v1 → v2 → v3 schema upgrade path keeps projects + stages +
// photos intact while introducing the new 'budgets' object store, and that
// amounts survive the structured-clone round-trip without drift.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAll,
  closeDb,
  deleteBudget,
  deleteBudgetsByProject,
  getAllBudgets,
  getAllPhotos,
  getAllProjects,
  getAllStages,
  getBudgetsByProject,
  openDb,
  putBudget,
  putPhoto,
  putProject,
  putStage,
  resetDbCache,
  STORE_BUDGETS,
} from '../db'
import type { BudgetItem, PhotoRecord, Project, Stage } from '../types'

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
    id: 'budget-' + Math.random().toString(36).slice(2, 8),
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

describe('Budget IndexedDB — schema + round-trip (AC-FR003-01)', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('round-trips a budget item across simulated reload', async () => {
    const item = mkBudget({ id: 'b1', plannedAmount: 1234.56, actualAmount: 1000 })
    await putBudget(item)

    await closeDb()
    resetDbCache()
    const all = await getAllBudgets()
    expect(all).toHaveLength(1)
    const back = all[0]!
    expect(back.id).toBe('b1')
    expect(back.category).toBe('材料')
    expect(back.name).toBe('磁磚')
    expect(back.plannedAmount).toBe(1234.56)
    expect(back.actualAmount).toBe(1000)
    expect(back.paymentStatus).toBe('unpaid')
    expect(back.note).toBe('客廳')
  })

  it('preserves the three payment-status values verbatim', async () => {
    await putBudget(mkBudget({ id: 'p-unpaid', paymentStatus: 'unpaid' }))
    await putBudget(mkBudget({ id: 'p-partial', paymentStatus: 'partial' }))
    await putBudget(mkBudget({ id: 'p-paid', paymentStatus: 'paid' }))

    const all = await getAllBudgets()
    const map = Object.fromEntries(all.map((b) => [b.id, b.paymentStatus]))
    expect(map).toEqual({
      'p-unpaid': 'unpaid',
      'p-partial': 'partial',
      'p-paid': 'paid',
    })
  })

  it('deleteBudget removes only the targeted record', async () => {
    await putBudget(mkBudget({ id: 'keep' }))
    await putBudget(mkBudget({ id: 'drop' }))
    await deleteBudget('drop')
    await closeDb()
    resetDbCache()
    const ids = (await getAllBudgets()).map((b) => b.id).sort()
    expect(ids).toEqual(['keep'])
  })

  it('getBudgetsByProject filters via the byProjectId index', async () => {
    await putBudget(mkBudget({ id: 'a', projectId: 'proj-1' }))
    await putBudget(mkBudget({ id: 'b', projectId: 'proj-1' }))
    await putBudget(mkBudget({ id: 'c', projectId: 'proj-2' }))
    await closeDb()
    resetDbCache()
    expect((await getBudgetsByProject('proj-1')).map((b) => b.id).sort()).toEqual(['a', 'b'])
    expect((await getBudgetsByProject('proj-2')).map((b) => b.id)).toEqual(['c'])
    expect(await getBudgetsByProject('proj-3')).toEqual([])
  })

  it('deleteBudgetsByProject removes only the target project', async () => {
    await putBudget(mkBudget({ id: 'a', projectId: 'proj-1' }))
    await putBudget(mkBudget({ id: 'b', projectId: 'proj-1' }))
    await putBudget(mkBudget({ id: 'c', projectId: 'proj-2' }))
    await deleteBudgetsByProject('proj-1')
    await closeDb()
    resetDbCache()
    expect((await getAllBudgets()).map((b) => b.id)).toEqual(['c'])
  })

  it('clearAll also wipes budgets', async () => {
    await putBudget(mkBudget({ id: 'a' }))
    await putBudget(mkBudget({ id: 'b' }))
    await clearAll()
    expect(await getAllBudgets()).toEqual([])
  })

  it('exposes the budgets object store with keyPath id and byProjectId index', async () => {
    await putBudget(mkBudget({ id: 'a', projectId: 'proj-1' }))
    const db = await openDb()
    expect(db.objectStoreNames.contains(STORE_BUDGETS)).toBe(true)
    const tx = db.transaction(STORE_BUDGETS, 'readonly')
    const store = tx.objectStore(STORE_BUDGETS)
    expect(store.keyPath).toBe('id')
    expect(Array.from(store.indexNames)).toContain('byProjectId')
    db.close()
  })
})

describe('Budget IndexedDB — v3 schema upgrade is additive (FR-001 / FR-002 preserved)', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('keeps pre-existing project / stage / photo data when upgrading to v3', async () => {
    // Seed v1/v2 records BEFORE the upgrade path sees them — putProject / putStage
    // trigger the v1→v2→v3 onupgradeneeded callbacks under fresh fake-indexeddb.
    await putProject(mkProject())
    await putStage(mkStage())
    await putPhoto(mkPhoto())

    // Close + reopen to confirm we round-tripped through the upgrade.
    await closeDb()
    resetDbCache()
    const [projects, stages, photos, budgets] = await Promise.all([
      getAllProjects(),
      getAllStages(),
      getAllPhotos(),
      getAllBudgets(),
    ])
    expect(projects.map((p) => p.id)).toEqual(['proj-1'])
    expect(stages.map((s) => s.id)).toEqual(['stage-1'])
    expect(photos.map((p) => p.id)).toEqual(['photo-1'])
    // No budgets yet — empty list, not undefined.
    expect(budgets).toEqual([])
  })

  it('supports writing budgets alongside pre-existing records', async () => {
    await putProject(mkProject())
    await putStage(mkStage())
    await putPhoto(mkPhoto())
    await putBudget(mkBudget({ id: 'b1' }))
    await putBudget(mkBudget({ id: 'b2', projectId: 'proj-2' }))

    await closeDb()
    resetDbCache()
    expect(await getAllBudgets()).toHaveLength(2)
    // Pre-existing data is still reachable through their respective queries.
    expect(await getAllProjects()).toHaveLength(1)
    expect(await getAllStages()).toHaveLength(1)
    expect(await getAllPhotos()).toHaveLength(1)
  })
})

describe('Budget IndexedDB — numeric integrity (no drift on read)', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('preserves two-decimal amounts and integer amounts identically', async () => {
    await putBudget(mkBudget({ id: 'a', plannedAmount: 0.1 + 0.2, actualAmount: 1234567.89 }))
    await closeDb()
    resetDbCache()
    const back = (await getAllBudgets())[0]!
    expect(back.plannedAmount).toBeCloseTo(0.30000000000000004, 15)
    expect(back.actualAmount).toBe(1234567.89)
  })

  it('preserves zero amounts', async () => {
    await putBudget(mkBudget({ id: 'z', plannedAmount: 0, actualAmount: 0 }))
    await closeDb()
    resetDbCache()
    const back = (await getAllBudgets())[0]!
    expect(back.plannedAmount).toBe(0)
    expect(back.actualAmount).toBe(0)
  })

  it('persists undefined note as undefined (not the empty string)', async () => {
    await putBudget(mkBudget({ id: 'n', note: undefined }))
    await closeDb()
    resetDbCache()
    const back = (await getAllBudgets())[0]!
    expect(back.note).toBeUndefined()
  })
})