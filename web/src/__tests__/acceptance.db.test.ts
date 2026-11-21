// AC-003 (FR-009) — acceptance items IndexedDB round-trip, and AC-002
// (FR-008) contract record storage being separate from FR-003 budgets.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  closeDb,
  deleteAcceptanceItem,
  deleteAcceptanceItemsByStage,
  deleteContract,
  getAcceptanceItemsByProject,
  getAcceptanceItemsByStage,
  getAllAcceptanceItems,
  getAllBudgets,
  getAllContracts,
  getContract,
  loadAll,
  putAcceptanceItem,
  putContract,
  resetDbCache,
} from '../db'
import type { AcceptanceItem } from '../types'

function mk(overrides: Partial<AcceptanceItem> = {}): AcceptanceItem {
  return {
    id: 'acc-1',
    projectId: 'proj-1',
    stageId: 'stage-1',
    name: '示範驗收：插座通電',
    passed: false,
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

describe('AC-003 acceptance items — IndexedDB', () => {
  it('AC-003: an item survives a close + reopen round-trip unchanged', async () => {
    const item = mk({ passed: true, checkedOn: '2026-01-20', note: '示範備註' })
    await putAcceptanceItem(item)
    await reopen()
    expect(await getAllAcceptanceItems()).toEqual([item])
  })

  it('AC-003: toggling back to un-passed persists without a check date', async () => {
    await putAcceptanceItem(mk({ passed: true, checkedOn: '2026-01-20' }))
    await putAcceptanceItem(mk({ passed: false }))
    await reopen()
    const stored = await getAllAcceptanceItems()
    expect(stored).toHaveLength(1)
    expect(stored[0]!.passed).toBe(false)
    expect(stored[0]!.checkedOn).toBeUndefined()
  })

  it('AC-003: items can be read by stage and by project', async () => {
    await putAcceptanceItem(mk({ id: 'a', stageId: 'stage-1' }))
    await putAcceptanceItem(mk({ id: 'b', stageId: 'stage-2' }))
    await putAcceptanceItem(mk({ id: 'c', stageId: 'stage-1' }))
    await putAcceptanceItem(mk({ id: 'd', stageId: 'stage-9', projectId: 'proj-2' }))
    expect((await getAcceptanceItemsByStage('stage-1')).map((i) => i.id).sort()).toEqual(['a', 'c'])
    expect((await getAcceptanceItemsByProject('proj-1')).map((i) => i.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('AC-003: delete removes one item; deleteByStage removes only that stage', async () => {
    await putAcceptanceItem(mk({ id: 'a', stageId: 'stage-1' }))
    await putAcceptanceItem(mk({ id: 'b', stageId: 'stage-1' }))
    await putAcceptanceItem(mk({ id: 'c', stageId: 'stage-2' }))
    await deleteAcceptanceItem('a')
    expect((await getAllAcceptanceItems()).map((i) => i.id).sort()).toEqual(['b', 'c'])
    await deleteAcceptanceItemsByStage('stage-1')
    await reopen()
    expect((await getAllAcceptanceItems()).map((i) => i.id)).toEqual(['c'])
  })
})

describe('AC-002 contract record — IndexedDB', () => {
  it('AC-002: the contract record round-trips and is keyed by project', async () => {
    const contract = {
      projectId: 'proj-1',
      contractAmount: 1000000.5,
      receivedAmount: 250000.25,
      updatedAt: '2026-01-10T00:00:00.000Z',
    }
    await putContract(contract)
    await reopen()
    expect(await getContract('proj-1')).toEqual(contract)
    expect(await getContract('proj-missing')).toBeUndefined()
  })

  it('AC-002: saving again replaces the single record for that project', async () => {
    await putContract({ projectId: 'proj-1', contractAmount: 1, receivedAmount: 0, updatedAt: 'a' })
    await putContract({ projectId: 'proj-1', contractAmount: 2, receivedAmount: 1, updatedAt: 'b' })
    const all = await getAllContracts()
    expect(all).toHaveLength(1)
    expect(all[0]!.contractAmount).toBe(2)
    await deleteContract('proj-1')
    expect(await getAllContracts()).toEqual([])
  })

  it('AC-002: contract figures are stored apart from FR-003 cost budgets', async () => {
    await putContract({ projectId: 'proj-1', contractAmount: 500, receivedAmount: 100, updatedAt: 'a' })
    expect(await getAllBudgets()).toEqual([])
    const all = await loadAll()
    expect(all.budgets).toEqual([])
    expect(all.contracts).toHaveLength(1)
    expect(all.changeOrders).toEqual([])
    expect(all.acceptanceItems).toEqual([])
  })
})
