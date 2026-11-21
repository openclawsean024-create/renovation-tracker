// Codex review (2026-11-22) — two tabs on the same IndexedDB. Each test mounts
// two independent <DashboardProvider>s (two "tabs"), lets both load, acts in
// tab A, then acts in tab B with its now-stale in-memory copy. Covers AC-001
// (change-order approval cannot be bypassed), AC-003 (acceptance items),
// AC-005 (a cleared address must not come back) and project isolation.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { DashboardProvider, useDashboard, type DashboardContextValue } from '../store'
import {
  getAllAcceptanceItems,
  getAllChangeOrders,
  getAllProjects,
  getAllStages,
  putAcceptanceItem,
  putChangeOrder,
  putContract,
  putProject,
  putStage,
} from '../db'
import { demoProject, demoStages, resetIndexedDb } from './m1TestUtils'
import type { ChangeOrder } from '../types'

const clock = () => new Date(2026, 0, 20, 10, 0, 0)

function Capture({ onValue }: { onValue: (v: DashboardContextValue) => void }) {
  onValue(useDashboard())
  return null
}

/** Mount one "tab" and return a getter for its latest context value. */
async function mountTab() {
  let latest: DashboardContextValue | null = null
  render(
    <DashboardProvider clock={clock}>
      <Capture onValue={(v) => { latest = v }} />
    </DashboardProvider>,
  )
  await waitFor(() => expect(latest?.loadState).toBe('ready'))
  return () => latest as unknown as DashboardContextValue
}

const pending: ChangeOrder = {
  id: 'co-1',
  projectId: demoProject.id,
  title: '示範追加：增加插座',
  amount: 12000,
  status: 'pending',
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T00:00:00.000Z',
}

beforeEach(async () => {
  await resetIndexedDb()
  await putProject(demoProject)
  await Promise.all(demoStages.map((s) => putStage(s)))
})

afterEach(() => {
  cleanup()
})

describe('stale tabs — change orders (AC-001)', () => {
  it('AC-001: a stale tab cannot reject an order another tab already approved', async () => {
    await putChangeOrder(pending)
    const tabA = await mountTab()
    const tabB = await mountTab()
    await act(() => tabA().decideChangeOrder({ id: 'co-1', decision: 'approved' }).then(() => undefined))

    let error: unknown
    await act(async () => {
      await tabB()
        .decideChangeOrder({ id: 'co-1', decision: 'rejected' })
        .catch((err: unknown) => {
          error = err
        })
    })
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe('已決定的變更單不可再變更')
    const stored = await getAllChangeOrders()
    expect(stored[0]!.status).toBe('approved')
    expect(stored[0]!.amount).toBe(12000)
    // The stale tab now shows the stored decision.
    await waitFor(() => expect(tabB().changeOrders[0]!.status).toBe('approved'))
  })

  it('AC-001: a stale tab cannot edit an order another tab already approved', async () => {
    await putChangeOrder(pending)
    const tabA = await mountTab()
    const tabB = await mountTab()
    await act(() => tabA().decideChangeOrder({ id: 'co-1', decision: 'approved' }).then(() => undefined))

    await expect(
      act(() =>
        tabB()
          .updateChangeOrder({ id: 'co-1', patch: { title: '示範：改過的標題', amount: 99999 } })
          .then(() => undefined),
      ),
    ).rejects.toThrow('已決定的變更單不可再編輯')
    const stored = await getAllChangeOrders()
    expect(stored[0]).toMatchObject({ status: 'approved', amount: 12000, title: pending.title })
  })
})

describe('stale tabs — project address (AC-005)', () => {
  it('AC-005: an unrelated update from a stale tab does not restore a cleared address', async () => {
    await putProject({ ...demoProject, address: '測試市示範路 1 號' })
    const tabA = await mountTab()
    const tabB = await mountTab()
    await act(() => tabA().updateProject({ address: undefined }).then(() => undefined))
    await act(() => tabB().updateProject({ status: 'completed' }).then(() => undefined))

    const stored = (await getAllProjects())[0]!
    expect(stored.status).toBe('completed')
    expect('address' in stored).toBe(false)
  })
})

describe('stale tabs — acceptance (AC-003)', () => {
  it('AC-003: a stale tab cannot add an item to a stage deleted in another tab', async () => {
    const tabA = await mountTab()
    const tabB = await mountTab()
    await act(() => tabA().deleteStage('stage-wood'))
    await expect(
      act(() =>
        tabB()
          .createAcceptanceItem({
            input: { projectId: demoProject.id, stageId: 'stage-wood', name: '示範驗收' },
          })
          .then(() => undefined),
      ),
    ).rejects.toThrow('找不到對應的階段')
    expect(await getAllAcceptanceItems()).toEqual([])
  })

  it('AC-003: deleting a stage removes the stage and its items together', async () => {
    await putAcceptanceItem({
      id: 'acc-1',
      projectId: demoProject.id,
      stageId: 'stage-wood',
      name: '示範驗收',
      passed: false,
      createdAt: '2026-01-10T00:00:00.000Z',
      updatedAt: '2026-01-10T00:00:00.000Z',
    })
    const tab = await mountTab()
    await act(() => tab().deleteStage('stage-wood'))
    expect((await getAllStages()).map((s) => s.id)).not.toContain('stage-wood')
    expect(await getAllAcceptanceItems()).toEqual([])
  })

  it('AC-003: a stale tab ticking an item another tab already ticked keeps it passed', async () => {
    await putAcceptanceItem({
      id: 'acc-1',
      projectId: demoProject.id,
      stageId: 'stage-demo',
      name: '示範驗收',
      passed: false,
      createdAt: '2026-01-10T00:00:00.000Z',
      updatedAt: '2026-01-10T00:00:00.000Z',
    })
    const tabA = await mountTab()
    const tabB = await mountTab()
    await act(() => tabA().toggleAcceptanceItem('acc-1').then(() => undefined))
    await act(() => tabB().toggleAcceptanceItem('acc-1').then(() => undefined))
    const stored = await getAllAcceptanceItems()
    expect(stored[0]!.passed).toBe(true)
    expect(stored[0]!.checkedOn).toBe('2026-01-20')
  })
})

describe('project isolation (AC-002 / AC-005)', () => {
  it('AC-002: records of another project in the same database are not loaded', async () => {
    const other = { ...demoProject, id: 'proj-other', createdAt: '2026-06-01T00:00:00.000Z' }
    await putProject(other)
    await putChangeOrder({ ...pending, id: 'co-mine' })
    await putChangeOrder({
      ...pending,
      id: 'co-other',
      projectId: 'proj-other',
      title: '示範：其他工程的變更',
      status: 'approved',
      decidedOn: '2026-01-11',
    })
    await putContract({ projectId: 'proj-other', contractAmount: 5, receivedAmount: 0, updatedAt: 'x' })
    const tab = await mountTab()
    expect(tab().project?.id).toBe(demoProject.id)
    expect(tab().changeOrders.map((c) => c.id)).toEqual(['co-mine'])
    expect(tab().contract).toBeNull()
  })

  it('AC-002: two tabs opening an empty database seed only one project', async () => {
    await resetIndexedDb()
    const tabA = mountTab()
    const tabB = mountTab()
    await Promise.all([tabA, tabB])
    expect(await getAllProjects()).toHaveLength(1)
  })
})
