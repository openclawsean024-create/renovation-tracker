// Budget section integration tests — AC-FR003-01 ~ AC-FR003-04.
// Mounts the real <Dashboard> against fake-indexeddb and drives the form
// the same way a user would. Mirrors the structure of Dashboard.photos.test.tsx.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DashboardProvider } from '../store'
import { Dashboard } from '../components/Dashboard'
import { closeDb, getAllBudgets, putProject, resetDbCache } from '../db'
import type { Project } from '../types'

const seedProject: Project = {
  id: 'proj-budget',
  name: '我的裝修工程',
  status: 'in_progress',
  plannedStart: '2026-01-05',
  plannedEnd: '2026-02-06',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

async function resetIndexedDb() {
  await closeDb()
  resetDbCache()
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('renovation-tracker')
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
  resetDbCache()
}

function renderDashboard() {
  return render(
    <DashboardProvider>
      <Dashboard />
    </DashboardProvider>,
  )
}

afterEach(() => {
  cleanup()
})

beforeEach(async () => {
  await resetIndexedDb()
})

/** Open the budget form via the section CTA and return the dialog node. */
async function openBudgetForm() {
  fireEvent.click(screen.getByTestId('add-budget'))
  return screen.findByRole('dialog')
}

/** Fill the current budget form modal with the given values and submit. */
function fillAndSubmit(
  dialog: HTMLElement,
  values: {
    category: string
    name: string
    planned: string
    actual: string
    payment: 'unpaid' | 'partial' | 'paid'
  },
) {
  fireEvent.change(within(dialog).getByTestId('budget-category-input'), {
    target: { value: values.category },
  })
  fireEvent.change(within(dialog).getByTestId('budget-name-input'), {
    target: { value: values.name },
  })
  fireEvent.change(within(dialog).getByTestId('budget-planned-input'), {
    target: { value: values.planned },
  })
  fireEvent.change(within(dialog).getByTestId('budget-actual-input'), {
    target: { value: values.actual },
  })
  fireEvent.change(within(dialog).getByTestId('budget-payment-select'), {
    target: { value: values.payment },
  })
  fireEvent.click(within(dialog).getByTestId('budget-submit'))
}

describe('AC-FR003-01 CRUD + persistence + summary + payment status', () => {
  it('renders the budget section header + empty state when no budgets exist', async () => {
    await putProject(seedProject)
    renderDashboard()
    await waitFor(() => expect(screen.getByText('預算追蹤')).toBeInTheDocument())
    expect(screen.getByText('預算追蹤')).toBeInTheDocument()
    expect(screen.getByTestId('budget-empty-state')).toBeInTheDocument()
    // Summary starts at zero.
    expect(screen.getByTestId('budget-summary-planned').textContent).toMatch(/0/)
    expect(screen.getByTestId('budget-summary-actual').textContent).toMatch(/0/)
    expect(screen.getByTestId('budget-summary-remaining').textContent).toMatch(/0/)
    expect(screen.getByTestId('budget-summary-overrun-status').textContent).toBe('未超支')
  })

  it('creates a valid budget item, persists it, and renders totals / payment status', async () => {
    await putProject(seedProject)
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-budget')).toBeInTheDocument())

    const dialog = await openBudgetForm()
    fillAndSubmit(dialog, {
      category: '材料',
      name: '磁磚',
      planned: '10000',
      actual: '0',
      payment: 'unpaid',
    })

    await waitFor(() => {
      expect(screen.getByText('磁磚')).toBeInTheDocument()
    })

    // Summary reflects the new item.
    await waitFor(() => {
      expect(screen.getByTestId('budget-summary-planned').textContent).toMatch(/10,?000/)
    })
    expect(screen.getByTestId('budget-summary-actual').textContent).toMatch(/0/)
    expect(screen.getByTestId('budget-summary-remaining').textContent).toMatch(/10,?000/)
    expect(screen.getByTestId('budget-summary-overrun-status').textContent).toBe('未超支')

    // Payment status pill reflects the persisted value.
    const status = screen.getByLabelText(/付款狀態：未付款/)
    expect(status).toBeInTheDocument()

    // IndexedDB persisted.
    const stored = await getAllBudgets()
    expect(stored).toHaveLength(1)
    expect(stored[0]!.name).toBe('磁磚')
    expect(stored[0]!.paymentStatus).toBe('unpaid')
    expect(stored[0]!.plannedAmount).toBe(10000)
    expect(stored[0]!.actualAmount).toBe(0)

    // Simulate reload — data persists.
    cleanup()
    renderDashboard()
    await waitFor(() => expect(screen.getByText('磁磚')).toBeInTheDocument())
    expect(screen.getByTestId('budget-summary-planned').textContent).toMatch(/10,?000/)
    expect(screen.getByLabelText(/付款狀態：未付款/)).toBeInTheDocument()
  })

  it('edit updates the persisted item + summary', async () => {
    await putProject(seedProject)
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-budget')).toBeInTheDocument())
    const dialog = await openBudgetForm()
    fillAndSubmit(dialog, {
      category: '材料',
      name: '磁磚',
      planned: '10000',
      actual: '0',
      payment: 'unpaid',
    })
    await waitFor(() => expect(screen.getByText('磁磚')).toBeInTheDocument())

    // Open the edit form for the new row.
    const editBtn = screen.getByRole('button', { name: '編輯預算項目 磁磚' })
    fireEvent.click(editBtn)
    const editDialog = await screen.findByRole('dialog')
    fireEvent.change(within(editDialog).getByTestId('budget-actual-input'), {
      target: { value: '5500' },
    })
    fireEvent.change(within(editDialog).getByTestId('budget-payment-select'), {
      target: { value: 'partial' },
    })
    fireEvent.click(within(editDialog).getByTestId('budget-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('budget-summary-actual').textContent).toMatch(/5,?500/)
    })
    expect(screen.getByLabelText(/付款狀態：部分付款/)).toBeInTheDocument()
    expect(screen.getByTestId('budget-summary-remaining').textContent).toMatch(/4,?500/)

    const stored = await getAllBudgets()
    expect(stored[0]!.actualAmount).toBe(5500)
    expect(stored[0]!.paymentStatus).toBe('partial')
  })

  it('renders per-status counts in the sub-header', async () => {
    await putProject(seedProject)
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-budget')).toBeInTheDocument())

    let dialog = await openBudgetForm()
    fillAndSubmit(dialog, { category: 'A', name: 'a', planned: '100', actual: '0', payment: 'unpaid' })
    await waitFor(() => expect(screen.getByText('a')).toBeInTheDocument())

    dialog = await openBudgetForm()
    fillAndSubmit(dialog, { category: 'B', name: 'b', planned: '100', actual: '50', payment: 'partial' })
    await waitFor(() => expect(screen.getByText('b')).toBeInTheDocument())

    dialog = await openBudgetForm()
    fillAndSubmit(dialog, { category: 'C', name: 'c', planned: '100', actual: '100', payment: 'paid' })
    await waitFor(() => expect(screen.getByText('c')).toBeInTheDocument())

    // The sub-header text contains React text nodes interleaved with the
    // counts — match each fragment against the same <p>'s textContent.
    const sub = document.querySelector('.budget-section-sub') as HTMLElement | null
    expect(sub).not.toBeNull()
    const text = sub!.textContent ?? ''
    expect(text).toMatch(/未付款\s*1/)
    expect(text).toMatch(/部分付款\s*1/)
    expect(text).toMatch(/已付款\s*1/)
    expect(text).toMatch(/共\s*3\s*筆/)
  })
})

describe('AC-FR003-02 amount validation', () => {
  it('rejects an empty category with a readable error and writes nothing', async () => {
    await putProject(seedProject)
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-budget')).toBeInTheDocument())
    const dialog = await openBudgetForm()
    fillAndSubmit(dialog, { category: '', name: '磁磚', planned: '100', actual: '0', payment: 'unpaid' })
    await waitFor(() => {
      expect(within(dialog).getByTestId('budget-category-error').textContent).toMatch(/不可為空/)
    })
    expect(await getAllBudgets()).toEqual([])
  })

  it('rejects an empty name with a readable error and writes nothing', async () => {
    await putProject(seedProject)
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-budget')).toBeInTheDocument())
    const dialog = await openBudgetForm()
    fillAndSubmit(dialog, { category: '材料', name: '', planned: '100', actual: '0', payment: 'unpaid' })
    await waitFor(() => {
      expect(within(dialog).getByTestId('budget-name-error').textContent).toMatch(/不可為空/)
    })
    expect(await getAllBudgets()).toEqual([])
  })

  it('rejects negative amounts with a readable error', async () => {
    await putProject(seedProject)
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-budget')).toBeInTheDocument())
    const dialog = await openBudgetForm()
    fillAndSubmit(dialog, { category: '材料', name: '磁磚', planned: '-1', actual: '0', payment: 'unpaid' })
    await waitFor(() => {
      expect(within(dialog).getByTestId('budget-planned-error').textContent).toMatch(/不可為負/)
    })
    expect(await getAllBudgets()).toEqual([])
  })

  it('rejects more-than-two-decimal amounts with a readable error', async () => {
    await putProject(seedProject)
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-budget')).toBeInTheDocument())
    const dialog = await openBudgetForm()
    fillAndSubmit(dialog, { category: '材料', name: '磁磚', planned: '100.123', actual: '0', payment: 'unpaid' })
    await waitFor(() => {
      expect(within(dialog).getByTestId('budget-planned-error').textContent).toMatch(/兩位小數/)
    })
    expect(await getAllBudgets()).toEqual([])
  })

  it('rejects NaN amounts (empty input parses as NaN)', async () => {
    await putProject(seedProject)
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-budget')).toBeInTheDocument())
    const dialog = await openBudgetForm()
    fillAndSubmit(dialog, { category: '材料', name: '磁磚', planned: '   ', actual: '0', payment: 'unpaid' })
    await waitFor(() => {
      expect(within(dialog).getByTestId('budget-planned-error').textContent).toMatch(/有限數字/)
    })
    expect(await getAllBudgets()).toEqual([])
  })

  it('reports multiple field errors at once', async () => {
    await putProject(seedProject)
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-budget')).toBeInTheDocument())
    const dialog = await openBudgetForm()
    fillAndSubmit(dialog, { category: '', name: '', planned: '-5', actual: '0.001', payment: 'unpaid' })
    await waitFor(() => {
      expect(within(dialog).getByTestId('budget-category-error').textContent).toMatch(/不可為空/)
      expect(within(dialog).getByTestId('budget-name-error').textContent).toMatch(/不可為空/)
      expect(within(dialog).getByTestId('budget-planned-error').textContent).toMatch(/不可為負/)
      expect(within(dialog).getByTestId('budget-actual-error').textContent).toMatch(/兩位小數/)
    })
    expect(await getAllBudgets()).toEqual([])
  })
})

describe('AC-FR003-03 overrun alert + per-item badges', () => {
  it('shows no alert when nothing is over budget', async () => {
    await putProject(seedProject)
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-budget')).toBeInTheDocument())
    const dialog = await openBudgetForm()
    fillAndSubmit(dialog, { category: '材料', name: '磁磚', planned: '10000', actual: '0', payment: 'unpaid' })
    await waitFor(() => expect(screen.getByText('磁磚')).toBeInTheDocument())
    expect(screen.queryByTestId('budget-overrun-alert')).not.toBeInTheDocument()
  })

  it('flags a per-item overrun via a visible badge', async () => {
    await putProject(seedProject)
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-budget')).toBeInTheDocument())
    const dialog = await openBudgetForm()
    fillAndSubmit(dialog, { category: '材料', name: '磁磚', planned: '1000', actual: '1500', payment: 'paid' })
    await waitFor(() => expect(screen.getByText('磁磚')).toBeInTheDocument())
    // The per-item badge includes the overrun amount.
    await waitFor(() => {
      expect(screen.getAllByText(/超支/).length).toBeGreaterThan(0)
    })
  })

  it('shows the project-level alert + total overrun when actual exceeds planned', async () => {
    await putProject(seedProject)
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-budget')).toBeInTheDocument())
    let dialog = await openBudgetForm()
    fillAndSubmit(dialog, { category: '材料', name: '磁磚', planned: '10000', actual: '12000', payment: 'paid' })
    await waitFor(() => expect(screen.getByText('磁磚')).toBeInTheDocument())
    dialog = await openBudgetForm()
    fillAndSubmit(dialog, { category: '人工', name: '水電', planned: '5000', actual: '4000', payment: 'partial' })
    await waitFor(() => expect(screen.getByText('水電')).toBeInTheDocument())

    // Alert: total actual 16000 > total planned 15000 → 超支 1000.
    await waitFor(() => {
      expect(screen.getByTestId('budget-overrun-alert')).toBeInTheDocument()
    })
    expect(screen.getByTestId('budget-overrun-alert').textContent).toMatch(/超支/)
    expect(screen.getByTestId('budget-overrun-alert').textContent).toMatch(/1,?000/)

    // The summary mirrors this:
    expect(screen.getByTestId('budget-summary-overrun-status').textContent).toMatch(/超支/)
    expect(screen.getByTestId('budget-summary-remaining').textContent).toMatch(/-?1,?000/)

    // The alert names the offending item(s).
    expect(screen.getByTestId('budget-overrun-alert').textContent).toMatch(/材料／磁磚/)
  })

  it('does not show the alert when individual items overrun but the total stays within budget', async () => {
    await putProject(seedProject)
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-budget')).toBeInTheDocument())
    let dialog = await openBudgetForm()
    fillAndSubmit(dialog, { category: '材料', name: 'a', planned: '1000', actual: '1500', payment: 'paid' })
    await waitFor(() => expect(screen.getByText('a')).toBeInTheDocument())
    dialog = await openBudgetForm()
    fillAndSubmit(dialog, { category: '人工', name: 'b', planned: '5000', actual: '4500', payment: 'partial' })
    await waitFor(() => expect(screen.getByText('b')).toBeInTheDocument())

    // Total planned 6000, total actual 6000 → not over.
    expect(screen.queryByTestId('budget-overrun-alert')).not.toBeInTheDocument()
    // The per-item badge for "a" is still visible.
    expect(screen.getAllByText(/超支/).length).toBeGreaterThan(0)
  })
})

describe('AC-FR003-04 delete-confirm (cancel + confirm)', () => {
  it('cancel delete leaves the budget intact', async () => {
    await putProject(seedProject)
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-budget')).toBeInTheDocument())
    const dialog = await openBudgetForm()
    fillAndSubmit(dialog, { category: '材料', name: '磁磚', planned: '100', actual: '0', payment: 'unpaid' })
    await waitFor(() => expect(screen.getByText('磁磚')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '刪除預算項目 磁磚' }))
    const confirm = await screen.findByRole('dialog')
    fireEvent.click(within(confirm).getByRole('button', { name: '取消' }))

    // Dialog closed; data still there.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('磁磚')).toBeInTheDocument()
    expect(await getAllBudgets()).toHaveLength(1)
  })

  it('confirm delete removes the budget from UI and storage', async () => {
    await putProject(seedProject)
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-budget')).toBeInTheDocument())
    const dialog = await openBudgetForm()
    fillAndSubmit(dialog, { category: '材料', name: '磁磚', planned: '100', actual: '0', payment: 'unpaid' })
    await waitFor(() => expect(screen.getByText('磁磚')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '刪除預算項目 磁磚' }))
    const confirm = await screen.findByRole('dialog')
    fireEvent.click(within(confirm).getByTestId('confirm-delete'))

    await waitFor(() => {
      expect(screen.queryByText('磁磚')).not.toBeInTheDocument()
    })
    expect(await getAllBudgets()).toEqual([])
    // Empty state returns.
    expect(screen.getByTestId('budget-empty-state')).toBeInTheDocument()
  })
})

describe('FR-003 isolation — budget operations do not affect stages or photos', () => {
  it('creating a budget does not change the project or stage counts', async () => {
    // Seed a project + a single stage directly so we have a known stage count
    // to compare against before / after a budget write.
    await putProject(seedProject)
    const { putStage } = await import('../db')
    await putStage({
      id: 'stage-iso',
      projectId: seedProject.id,
      name: '拆除',
      order: 1,
      status: 'not_started',
      plannedStart: '2026-01-05',
      plannedEnd: '2026-01-09',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-budget')).toBeInTheDocument())

    // Stage counter is the one we seeded — not 7 (no auto-seed happens once a
    // project is already present).
    expect(screen.getByTestId('total-stages').textContent).toBe('1')
    expect(screen.getByTestId('percent-complete').textContent).toBe('0%')

    const dialog = await openBudgetForm()
    fillAndSubmit(dialog, { category: '材料', name: '磁磚', planned: '100', actual: '0', payment: 'unpaid' })
    await waitFor(() => expect(screen.getByText('磁磚')).toBeInTheDocument())

    // Same totals — no cross-contamination.
    expect(screen.getByTestId('total-stages').textContent).toBe('1')
    expect(screen.getByTestId('percent-complete').textContent).toBe('0%')
  })
})