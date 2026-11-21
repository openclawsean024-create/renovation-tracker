// Codex review (2026-11-22) — failed writes must be reported, not swallowed.
// AC-001 (change-order delete) and AC-003 (acceptance toggle / delete).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import * as dbModule from '../db'
import { getAllAcceptanceItems, getAllChangeOrders, putAcceptanceItem, putChangeOrder, putProject, putStage } from '../db'
import { demoProject, demoStages, renderDashboard, resetIndexedDb } from './m1TestUtils'

beforeEach(async () => {
  await resetIndexedDb()
  await putProject(demoProject)
  await Promise.all(demoStages.map((s) => putStage(s)))
  await putChangeOrder({
    id: 'co-1',
    projectId: demoProject.id,
    title: '示範追加',
    amount: 1000,
    status: 'pending',
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
  })
  await putAcceptanceItem({
    id: 'acc-1',
    projectId: demoProject.id,
    stageId: 'stage-water',
    name: '示範驗收',
    passed: false,
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

const writeFailed = () => Promise.reject(new Error('示範寫入失敗'))

describe('failed writes are reported', () => {
  it('AC-001: a failed change-order delete shows an error and keeps the order', async () => {
    await renderDashboard()
    vi.spyOn(dbModule, 'deleteChangeOrder').mockImplementation(writeFailed)
    fireEvent.click(await screen.findByTestId('change-order-delete-co-1'))
    fireEvent.click(within(await screen.findByRole('dialog')).getByTestId('confirm-delete'))
    await waitFor(() =>
      expect(screen.getByTestId('change-order-action-error')).toHaveTextContent(
        '無法刪除變更單：示範寫入失敗，資料未變更',
      ),
    )
    expect(screen.getByTestId('change-order-row-co-1')).toBeInTheDocument()
    expect(await getAllChangeOrders()).toHaveLength(1)
  })

  it('AC-003: a failed acceptance toggle shows an error and leaves the item unchanged', async () => {
    await renderDashboard()
    vi.spyOn(dbModule, 'mutateRecord').mockImplementation(writeFailed)
    fireEvent.click(await screen.findByTestId('acceptance-toggle-acc-1'))
    await waitFor(() =>
      expect(screen.getByTestId('acceptance-action-error')).toHaveTextContent(
        '無法更新驗收項目「示範驗收」：示範寫入失敗',
      ),
    )
    expect(screen.getByTestId('acceptance-toggle-acc-1')).not.toBeChecked()
    expect((await getAllAcceptanceItems())[0]!.passed).toBe(false)
  })

  it('AC-003: a failed acceptance delete shows an error and keeps the item', async () => {
    await renderDashboard()
    vi.spyOn(dbModule, 'deleteAcceptanceItem').mockImplementation(writeFailed)
    fireEvent.click(await screen.findByTestId('acceptance-delete-acc-1'))
    fireEvent.click(within(await screen.findByRole('dialog')).getByTestId('confirm-delete'))
    await waitFor(() =>
      expect(screen.getByTestId('acceptance-action-error')).toHaveTextContent(
        '無法刪除驗收項目：示範寫入失敗，資料未變更',
      ),
    )
    expect(screen.getByTestId('acceptance-item-acc-1')).toBeInTheDocument()
    expect(await getAllAcceptanceItems()).toHaveLength(1)
  })
})
