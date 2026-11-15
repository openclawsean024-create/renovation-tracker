// AC-002 (FR-008) — contract amount & receipts on the real <Dashboard>.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import {
  getAllBudgets,
  getAllContracts,
  putChangeOrder,
  putContract,
  putProject,
} from '../db'
import { demoProject, renderDashboard, resetIndexedDb } from './m1TestUtils'
import type { ChangeOrder } from '../types'

beforeEach(async () => {
  await resetIndexedDb()
  await putProject(demoProject)
})

afterEach(() => {
  cleanup()
})

function order(overrides: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    projectId: demoProject.id,
    title: '示範變更',
    amount: 1000,
    status: 'pending',
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  }
}

async function editContract(contractAmount: string, receivedAmount: string) {
  fireEvent.click(screen.getByTestId('edit-contract'))
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByTestId('contract-amount-input'), {
    target: { value: contractAmount },
  })
  fireEvent.change(within(dialog).getByTestId('contract-received-input'), {
    target: { value: receivedAmount },
  })
  fireEvent.click(within(dialog).getByTestId('contract-submit'))
  return dialog
}

describe('AC-002 contract & receipts on the dashboard', () => {
  it('AC-002: shows the five figures, all zero before anything is entered', async () => {
    await renderDashboard()
    expect(screen.getByRole('heading', { name: '合約與收款' })).toBeInTheDocument()
    const summary = screen.getByTestId('contract-summary')
    for (const label of ['原合約', '已核准變更合計', '調整後總額', '已收', '待收']) {
      expect(within(summary).getByText(label)).toBeInTheDocument()
    }
    for (const id of [
      'contract-original',
      'contract-approved-changes',
      'contract-adjusted-total',
      'contract-received',
      'contract-outstanding',
    ]) {
      expect(screen.getByTestId(id)).toHaveTextContent(/^0$/)
    }
    expect(screen.queryByTestId('contract-overpaid-note')).not.toBeInTheDocument()
  })

  it('AC-002: editing contract and received amounts updates the summary and persists', async () => {
    await renderDashboard()
    await editContract('1000000', '300000.5')

    await waitFor(() =>
      expect(screen.getByTestId('contract-original')).toHaveTextContent(/^1,?000,?000$/),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('contract-adjusted-total')).toHaveTextContent(/^1,?000,?000$/)
    expect(screen.getByTestId('contract-received')).toHaveTextContent(/^300,?000\.5$/)
    expect(screen.getByTestId('contract-outstanding')).toHaveTextContent(/^699,?999\.5$/)

    const stored = await getAllContracts()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      projectId: demoProject.id,
      contractAmount: 1000000,
      receivedAmount: 300000.5,
    })

    // Reload — the figures come back from IndexedDB.
    cleanup()
    await renderDashboard()
    await waitFor(() =>
      expect(screen.getByTestId('contract-original')).toHaveTextContent(/^1,?000,?000$/),
    )
    expect(screen.getByTestId('contract-received')).toHaveTextContent(/^300,?000\.5$/)
  })

  it('AC-002: only approved change orders move the adjusted total and the outstanding amount', async () => {
    await putContract({
      projectId: demoProject.id,
      contractAmount: 1000000,
      receivedAmount: 400000,
      updatedAt: '2026-01-10T00:00:00.000Z',
    })
    await putChangeOrder(order({ id: 'a', amount: 50000, status: 'approved', decidedOn: '2026-01-11' }))
    await putChangeOrder(order({ id: 'b', amount: -10000, status: 'approved', decidedOn: '2026-01-12' }))
    await putChangeOrder(order({ id: 'c', amount: 70000, status: 'rejected', decidedOn: '2026-01-12' }))
    await putChangeOrder(order({ id: 'd', amount: 90000, status: 'pending' }))
    await renderDashboard()

    await waitFor(() =>
      expect(screen.getByTestId('contract-approved-changes')).toHaveTextContent(/^\+40,?000$/),
    )
    expect(screen.getByTestId('contract-original')).toHaveTextContent(/^1,?000,?000$/)
    expect(screen.getByTestId('contract-adjusted-total')).toHaveTextContent(/^1,?040,?000$/)
    expect(screen.getByTestId('contract-received')).toHaveTextContent(/^400,?000$/)
    expect(screen.getByTestId('contract-outstanding')).toHaveTextContent(/^640,?000$/)
  })

  it('AC-002: approving a pending change order on screen raises the adjusted total', async () => {
    await putContract({
      projectId: demoProject.id,
      contractAmount: 500000,
      receivedAmount: 0,
      updatedAt: '2026-01-10T00:00:00.000Z',
    })
    await putChangeOrder(order({ id: 'p', amount: 25000, status: 'pending' }))
    await renderDashboard()
    await waitFor(() =>
      expect(screen.getByTestId('contract-adjusted-total')).toHaveTextContent(/^500,?000$/),
    )
    fireEvent.click(screen.getByTestId('change-order-approve-p'))
    await waitFor(() =>
      expect(screen.getByTestId('contract-adjusted-total')).toHaveTextContent(/^525,?000$/),
    )
    expect(screen.getByTestId('contract-outstanding')).toHaveTextContent(/^525,?000$/)
  })

  it('AC-002: a negative outstanding amount is spelled out as 溢收', async () => {
    await renderDashboard()
    await editContract('100000', '130000')
    await waitFor(() =>
      expect(screen.getByTestId('contract-outstanding')).toHaveTextContent(/^-30,?000$/),
    )
    const note = screen.getByTestId('contract-overpaid-note')
    expect(note).toHaveTextContent(/溢收 30,?000/)
    expect(note).toHaveAttribute('role', 'alert')
  })

  it.each([
    ['-1', '0', 'contract-amount-error', '金額不可為負數'],
    ['100.123', '0', 'contract-amount-error', '金額最多兩位小數'],
    ['', '0', 'contract-amount-error', '金額必須是有限數字'],
    ['100', '-5', 'contract-received-error', '金額不可為負數'],
    ['100', '1.999', 'contract-received-error', '金額最多兩位小數'],
    ['100', '', 'contract-received-error', '金額必須是有限數字'],
  ])(
    'AC-002: invalid amounts (contract %j, received %j) show an error and write nothing',
    async (contractAmount, receivedAmount, errorId, message) => {
      await renderDashboard()
      const dialog = await editContract(contractAmount, receivedAmount)
      await waitFor(() => expect(within(dialog).getByTestId(errorId)).toHaveTextContent(message))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(await getAllContracts()).toHaveLength(0)
      expect(screen.getByTestId('contract-original')).toHaveTextContent(/^0$/)
    },
  )

  it('AC-002: cancelling the form keeps the stored figures', async () => {
    await putContract({
      projectId: demoProject.id,
      contractAmount: 200000,
      receivedAmount: 50000,
      updatedAt: '2026-01-10T00:00:00.000Z',
    })
    await renderDashboard()
    await waitFor(() =>
      expect(screen.getByTestId('contract-original')).toHaveTextContent(/^200,?000$/),
    )
    fireEvent.click(screen.getByTestId('edit-contract'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByTestId('contract-amount-input')).toHaveValue(200000)
    fireEvent.change(within(dialog).getByTestId('contract-amount-input'), {
      target: { value: '999' },
    })
    fireEvent.click(within(dialog).getByTestId('contract-cancel'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByTestId('contract-original')).toHaveTextContent(/^200,?000$/)
    expect((await getAllContracts())[0]!.contractAmount).toBe(200000)
  })

  it('AC-002: contract figures stay separate from the FR-003 cost budget', async () => {
    await renderDashboard()
    await editContract('800000', '100000')
    await waitFor(() =>
      expect(screen.getByTestId('contract-original')).toHaveTextContent(/^800,?000$/),
    )
    // The cost-budget summary and store are untouched by the contract figures.
    expect(screen.getByTestId('budget-summary-planned')).toHaveTextContent(/^0$/)
    expect(screen.getByTestId('budget-summary-actual')).toHaveTextContent(/^0$/)
    expect(screen.getByTestId('budget-empty-state')).toBeInTheDocument()
    expect(await getAllBudgets()).toEqual([])
  })
})
