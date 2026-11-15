// AC-001 (FR-007) — change orders IndexedDB round-trip, plus the v6 schema
// upgrade keeping the pre-M1 stores intact.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAll,
  closeDb,
  deleteChangeOrder,
  deleteChangeOrdersByProject,
  getAllBudgets,
  getAllChangeOrders,
  getAllProjects,
  getAllStages,
  getChangeOrdersByProject,
  openDb,
  putBudget,
  putChangeOrder,
  putProject,
  putStage,
  resetDbCache,
  STORE_ACCEPTANCE_ITEMS,
  STORE_BUDGETS,
  STORE_CHANGE_ORDERS,
  STORE_CONTRACTS,
  STORE_PROJECTS,
  STORE_STAGES,
} from '../db'
import type { ChangeOrder, Project } from '../types'

const project: Project = {
  id: 'proj-1',
  name: '示範工程',
  status: 'in_progress',
  plannedStart: '2026-01-05',
  plannedEnd: '2026-02-06',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function mk(overrides: Partial<ChangeOrder> = {}): ChangeOrder {
  return {
    id: 'co-1',
    projectId: 'proj-1',
    title: '示範追加：增加插座',
    amount: 12000,
    status: 'pending',
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  }
}

async function reopen() {
  await closeDb()
  resetDbCache()
}

beforeEach(async () => {
  await closeDb()
  resetDbCache()
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('renovation-tracker')
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
  resetDbCache()
})

describe('AC-001 change orders — IndexedDB', () => {
  it('AC-001: a change order survives a close + reopen round-trip unchanged', async () => {
    const order = mk({
      stageId: 'stage-1',
      amount: -1500.25,
      material: '示範材料',
      note: '示範備註',
    })
    await putChangeOrder(order)
    await reopen()
    const stored = await getAllChangeOrders()
    expect(stored).toEqual([order])
  })

  it('AC-001: approved status and decision date persist', async () => {
    await putChangeOrder(mk())
    await putChangeOrder(mk({ status: 'approved', decidedOn: '2026-01-20' }))
    await reopen()
    const stored = await getAllChangeOrders()
    expect(stored).toHaveLength(1)
    expect(stored[0]!.status).toBe('approved')
    expect(stored[0]!.decidedOn).toBe('2026-01-20')
  })

  it('AC-001: getChangeOrdersByProject only returns that project', async () => {
    await putChangeOrder(mk({ id: 'a', projectId: 'proj-1' }))
    await putChangeOrder(mk({ id: 'b', projectId: 'proj-2' }))
    await putChangeOrder(mk({ id: 'c', projectId: 'proj-1' }))
    const mine = await getChangeOrdersByProject('proj-1')
    expect(mine.map((o) => o.id).sort()).toEqual(['a', 'c'])
  })

  it('AC-001: delete removes one order; deleteByProject removes only that project', async () => {
    await putChangeOrder(mk({ id: 'a', projectId: 'proj-1' }))
    await putChangeOrder(mk({ id: 'b', projectId: 'proj-1' }))
    await putChangeOrder(mk({ id: 'c', projectId: 'proj-2' }))
    await deleteChangeOrder('a')
    expect((await getAllChangeOrders()).map((o) => o.id).sort()).toEqual(['b', 'c'])
    await deleteChangeOrdersByProject('proj-1')
    await reopen()
    expect((await getAllChangeOrders()).map((o) => o.id)).toEqual(['c'])
  })

  it('AC-001: schema v6 adds the M1 stores next to the existing ones', async () => {
    const db = await openDb()
    expect(db.version).toBe(6)
    for (const store of [
      STORE_PROJECTS,
      STORE_STAGES,
      STORE_BUDGETS,
      STORE_CHANGE_ORDERS,
      STORE_CONTRACTS,
      STORE_ACCEPTANCE_ITEMS,
    ]) {
      expect(db.objectStoreNames.contains(store)).toBe(true)
    }
  })

  it('AC-001: upgrading a v5 database to v6 keeps existing records', async () => {
    // Build a genuine v5 database first (the pre-M1 schema), bypassing db.ts.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('renovation-tracker', 5)
      req.onupgradeneeded = () => {
        const db = req.result
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' })
        for (const name of [STORE_STAGES, 'photos', STORE_BUDGETS, 'schedules', 'warranties']) {
          db.createObjectStore(name, { keyPath: 'id' }).createIndex('byProjectId', 'projectId')
        }
      }
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction([STORE_PROJECTS], 'readwrite')
        tx.objectStore(STORE_PROJECTS).put(project)
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
    resetDbCache()
    // db.ts now opens it at v6 and must add the new stores without data loss.
    const db = await openDb()
    expect(db.version).toBe(6)
    expect(db.objectStoreNames.contains(STORE_CHANGE_ORDERS)).toBe(true)
    expect(await getAllProjects()).toEqual([project])
    await putChangeOrder(mk())
    expect(await getAllChangeOrders()).toHaveLength(1)
  })

  it('AC-001: clearAll wipes change orders together with the other stores', async () => {
    await putProject(project)
    await putStage({
      id: 'stage-1',
      projectId: 'proj-1',
      name: '示範階段',
      order: 1,
      status: 'not_started',
      plannedStart: '2026-01-05',
      plannedEnd: '2026-01-09',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await putBudget({
      id: 'b-1',
      projectId: 'proj-1',
      category: '示範分類',
      name: '示範項目',
      plannedAmount: 1,
      actualAmount: 0,
      paymentStatus: 'unpaid',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await putChangeOrder(mk())
    await clearAll()
    expect(await getAllChangeOrders()).toEqual([])
    expect(await getAllProjects()).toEqual([])
    expect(await getAllStages()).toEqual([])
    expect(await getAllBudgets()).toEqual([])
  })
})
