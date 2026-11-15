// AC-001 (FR-007) — change orders on the real <Dashboard>: add, validation,
// approve, reject, edit (pending only), cancel / confirm delete, and
// persistence across a remount.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { getAllChangeOrders, putProject, putStage } from '../db'
import { demoProject, demoStages, renderDashboard, resetIndexedDb } from './m1TestUtils'

const FIXED_NOW = new Date(2026, 0, 20, 10, 0, 0)
const clock = () => FIXED_NOW

beforeEach(async () => {
  await resetIndexedDb()
  await putProject(demoProject)
  await Promise.all(demoStages.map((s) => putStage(s)))
})

afterEach(() => {
  cleanup()
})

async function openForm() {
  fireEvent.click(screen.getByTestId('add-change-order'))
  return screen.findByRole('dialog')
}

function fillAndSubmit(
  dialog: HTMLElement,
  values: { title: string; amount: string; stageId?: string; material?: string; note?: string },
) {
  fireEvent.change(within(dialog).getByTestId('change-order-title-input'), {
    target: { value: values.title },
  })
  fireEvent.change(within(dialog).getByTestId('change-order-amount-input'), {
    target: { value: values.amount },
  })
  if (values.stageId !== undefined) {
    fireEvent.change(within(dialog).getByTestId('change-order-stage-select'), {
      target: { value: values.stageId },
    })
  }
  if (values.material !== undefined) {
    fireEvent.change(within(dialog).getByTestId('change-order-material-input'), {
      target: { value: values.material },
    })
  }
  if (values.note !== undefined) {
    fireEvent.change(within(dialog).getByTestId('change-order-note-input'), {
      target: { value: values.note },
    })
  }
  fireEvent.click(within(dialog).getByTestId('change-order-submit'))
}

/** Add one change order through the UI and return its stored id. */
async function addOrder(values: { title: string; amount: string; stageId?: string }) {
  const before = (await getAllChangeOrders()).length
  const dialog = await openForm()
  fillAndSubmit(dialog, values)
  await waitFor(async () => {
    expect(await getAllChangeOrders()).toHaveLength(before + 1)
  })
  const stored = await getAllChangeOrders()
  const id = stored.find((o) => o.title === values.title)!.id
  await waitFor(() => expect(screen.getByTestId(`change-order-row-${id}`)).toBeInTheDocument())
  return id
}

describe('AC-001 change orders on the dashboard', () => {
  it('AC-001: shows the section, the empty state and the local-record notice', async () => {
    await renderDashboard()
    expect(screen.getByRole('heading', { name: '預算變更單' })).toBeInTheDocument()
    expect(screen.getByTestId('change-order-empty-state')).toBeInTheDocument()
    expect(screen.getByTestId('change-order-local-notice')).toHaveTextContent(
      '本機紀錄，非屋主線上簽核',
    )
    expect(screen.getByTestId('change-order-local-notice')).toHaveTextContent('不是電子簽章')
  })

  it('AC-001: adds a change order as pending and persists it to IndexedDB', async () => {
    await renderDashboard({ clock })
    const id = await addOrder({ title: '示範追加：增加插座', amount: '12000', stageId: 'stage-water' })

    const row = screen.getByTestId(`change-order-row-${id}`)
    expect(within(row).getByText('示範追加：增加插座')).toBeInTheDocument()
    expect(screen.getByTestId(`change-order-status-${id}`)).toHaveTextContent('待決定')
    expect(screen.getByTestId(`change-order-amount-${id}`)).toHaveTextContent(/追加 \+12,?000/)
    expect(within(row).getByText('關聯階段：水電')).toBeInTheDocument()
    expect(screen.getByTestId('change-order-summary')).toHaveTextContent('共 1 筆')
    expect(screen.getByTestId('change-order-summary')).toHaveTextContent('待決定 1')

    const stored = await getAllChangeOrders()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      projectId: demoProject.id,
      stageId: 'stage-water',
      title: '示範追加：增加插座',
      amount: 12000,
      status: 'pending',
    })
    expect(stored[0]!.decidedOn).toBeUndefined()
    // A pending order must not change the adjusted contract total.
    expect(screen.getByTestId('contract-approved-changes')).toHaveTextContent(/^0$/)
  })

  it('AC-001: a blank title shows an error and writes nothing', async () => {
    await renderDashboard()
    const dialog = await openForm()
    fillAndSubmit(dialog, { title: '   ', amount: '500' })
    await waitFor(() =>
      expect(within(dialog).getByTestId('change-order-title-error')).toHaveTextContent(
        '變更單標題不可為空',
      ),
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(await getAllChangeOrders()).toHaveLength(0)
  })

  it.each([
    ['0', '金額不可為 0'],
    ['', '金額必須是有限數字'],
    ['12.345', '金額最多兩位小數'],
    ['-12.345', '金額最多兩位小數'],
  ])('AC-001: amount %j shows 「%s」 and writes nothing', async (amount, message) => {
    await renderDashboard()
    const dialog = await openForm()
    fillAndSubmit(dialog, { title: '示範變更', amount })
    await waitFor(() =>
      expect(within(dialog).getByTestId('change-order-amount-error')).toHaveTextContent(message),
    )
    expect(await getAllChangeOrders()).toHaveLength(0)
  })

  it('AC-001: approving records the decision and only then counts towards the total', async () => {
    await renderDashboard({ clock })
    const id = await addOrder({ title: '示範追加：增加插座', amount: '12000' })

    fireEvent.click(screen.getByTestId(`change-order-approve-${id}`))
    await waitFor(() =>
      expect(screen.getByTestId(`change-order-status-${id}`)).toHaveTextContent('已核准'),
    )
    expect(screen.getByTestId(`change-order-decided-on-${id}`)).toHaveTextContent('2026-01-20')
    expect(screen.getByTestId('contract-approved-changes')).toHaveTextContent(/\+12,?000/)
    expect(screen.getByTestId('contract-adjusted-total')).toHaveTextContent(/12,?000/)

    const stored = await getAllChangeOrders()
    expect(stored[0]!.status).toBe('approved')
    expect(stored[0]!.decidedOn).toBe('2026-01-20')
    expect(stored[0]!.amount).toBe(12000)

    // Decided orders can no longer be edited or re-decided.
    expect(screen.queryByTestId(`change-order-approve-${id}`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`change-order-reject-${id}`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`change-order-edit-${id}`)).not.toBeInTheDocument()
  })

  it('AC-001: rejecting records the decision and never counts towards the total', async () => {
    await renderDashboard({ clock })
    const id = await addOrder({ title: '示範追加：更換地板', amount: '30000' })

    fireEvent.click(screen.getByTestId(`change-order-reject-${id}`))
    await waitFor(() =>
      expect(screen.getByTestId(`change-order-status-${id}`)).toHaveTextContent('已拒絕'),
    )
    expect(screen.getByTestId('contract-approved-changes')).toHaveTextContent(/^0$/)
    expect(screen.getByTestId('contract-adjusted-total')).toHaveTextContent(/^0$/)

    const stored = await getAllChangeOrders()
    expect(stored[0]!.status).toBe('rejected')
    expect(stored[0]!.decidedOn).toBe('2026-01-20')
    expect(screen.queryByTestId(`change-order-edit-${id}`)).not.toBeInTheDocument()
  })

  it('AC-001: a pending change order can be edited', async () => {
    await renderDashboard()
    const id = await addOrder({ title: '示範追加：原標題', amount: '1000' })

    fireEvent.click(screen.getByTestId(`change-order-edit-${id}`))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByTestId('change-order-title-input')).toHaveValue('示範追加：原標題')
    fillAndSubmit(dialog, { title: '示範追減：新標題', amount: '-2500.5' })

    await waitFor(() =>
      expect(screen.getByTestId(`change-order-row-${id}`)).toHaveTextContent('示範追減：新標題'),
    )
    expect(screen.getByTestId(`change-order-amount-${id}`)).toHaveTextContent(/追減 -2,?500\.5/)
    const stored = await getAllChangeOrders()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ id, title: '示範追減：新標題', amount: -2500.5, status: 'pending' })
  })

  it('AC-001: cancelling the delete confirmation keeps the change order', async () => {
    await renderDashboard()
    const id = await addOrder({ title: '示範追加：保留', amount: '800' })

    fireEvent.click(screen.getByTestId(`change-order-delete-${id}`))
    const confirm = await screen.findByRole('dialog')
    expect(confirm).toHaveTextContent('確定要刪除變更單「示範追加：保留」嗎？')
    fireEvent.click(within(confirm).getByRole('button', { name: '取消' }))
    await waitFor(() => expect(screen.queryByTestId('confirm-delete')).not.toBeInTheDocument())

    expect(screen.getByTestId(`change-order-row-${id}`)).toBeInTheDocument()
    expect(await getAllChangeOrders()).toHaveLength(1)
  })

  it('AC-001: confirming the delete removes the change order and its effect on the total', async () => {
    await renderDashboard({ clock })
    const id = await addOrder({ title: '示範追加：要刪除', amount: '5000' })
    fireEvent.click(screen.getByTestId(`change-order-approve-${id}`))
    await waitFor(() =>
      expect(screen.getByTestId('contract-approved-changes')).toHaveTextContent(/\+5,?000/),
    )

    fireEvent.click(screen.getByTestId(`change-order-delete-${id}`))
    const confirm = await screen.findByRole('dialog')
    fireEvent.click(within(confirm).getByTestId('confirm-delete'))
    await waitFor(() =>
      expect(screen.queryByTestId(`change-order-row-${id}`)).not.toBeInTheDocument(),
    )
    expect(await getAllChangeOrders()).toHaveLength(0)
    expect(screen.getByTestId('contract-approved-changes')).toHaveTextContent(/^0$/)
    expect(screen.getByTestId('change-order-empty-state')).toBeInTheDocument()
  })

  it('AC-001: change orders and their decisions persist across a remount', async () => {
    await renderDashboard({ clock })
    const approvedId = await addOrder({ title: '示範追加：已核准項目', amount: '12000' })
    const rejectedId = await addOrder({ title: '示範追加：已拒絕項目', amount: '7000' })
    const pendingId = await addOrder({ title: '示範追減：待決定項目', amount: '-3000' })
    fireEvent.click(screen.getByTestId(`change-order-approve-${approvedId}`))
    fireEvent.click(screen.getByTestId(`change-order-reject-${rejectedId}`))
    await waitFor(async () => {
      const stored = await getAllChangeOrders()
      expect(stored.find((o) => o.id === approvedId)!.status).toBe('approved')
      expect(stored.find((o) => o.id === rejectedId)!.status).toBe('rejected')
    })

    // Simulate a page reload: unmount everything and mount a fresh provider.
    cleanup()
    await renderDashboard({ clock })
    await waitFor(() =>
      expect(screen.getByTestId(`change-order-row-${approvedId}`)).toBeInTheDocument(),
    )
    expect(screen.getByTestId(`change-order-status-${approvedId}`)).toHaveTextContent('已核准')
    expect(screen.getByTestId(`change-order-status-${rejectedId}`)).toHaveTextContent('已拒絕')
    expect(screen.getByTestId(`change-order-status-${pendingId}`)).toHaveTextContent('待決定')
    expect(screen.getByTestId('change-order-summary')).toHaveTextContent(
      '共 3 筆（待決定 1 · 已核准 1 · 已拒絕 1）',
    )
    // Only the approved 12,000 is in the total — not the rejected or pending.
    expect(screen.getByTestId('contract-approved-changes')).toHaveTextContent(/^\+12,?000$/)
  })
})
