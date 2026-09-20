// Dashboard component integration tests — covers AC-FR001-01, 02, 03, 05, 07, 08, 09, 10.

import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DashboardProvider } from '../store'
import { Dashboard } from '../components/Dashboard'
import { closeDb, resetDbCache } from '../db'

async function resetIndexedDb() {
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

function renderDashboard() {
  return render(
    <DashboardProvider>
      <Dashboard />
    </DashboardProvider>,
  )
}

/**
 * Mirrors the production mount in `src/main.tsx`, which wraps the entire app
 * in <StrictMode>. Without the StrictMode double-invocation, the load effect
 * would only run once and the bug below would not surface in tests — that's
 * exactly what masked the previous regression where the dashboard stayed
 * stuck on "載入中…" forever in a real browser.
 */
function renderDashboardInStrictMode() {
  return render(
    <StrictMode>
      <DashboardProvider>
        <Dashboard />
      </DashboardProvider>
    </StrictMode>,
  )
}

/**
 * Returns the data-testid of the row for the named stage by inspecting the
 * already-rendered DOM. Avoids mounting a second provider that would race
 * with the seed effect.
 */
async function rowTestIdFor(stageName: string): Promise<string> {
  await waitFor(() => {
    expect(screen.getAllByText(stageName).length).toBeGreaterThan(0)
  })
  const matches = screen.getAllByText(stageName)
  for (const el of matches) {
    const row = el.closest('[data-testid^="stage-row-"]') as HTMLElement | null
    if (row) return row.getAttribute('data-testid')!
  }
  throw new Error(`No stage row found for "${stageName}"`)
}

async function firstStageRowTestId(): Promise<string> {
  await waitFor(() => {
    const rows = document.querySelectorAll('[data-testid^="stage-row-"]')
    expect(rows.length).toBeGreaterThan(0)
  })
  const first = document.querySelector('[data-testid^="stage-row-"]') as HTMLElement | null
  if (!first) throw new Error('No stage row found')
  return first.getAttribute('data-testid')!
}

afterEach(() => {
  cleanup()
})

describe('Dashboard — AC-FR001-01 seed data', () => {
  beforeEach(async () => {
    await resetIndexedDb()
  })

  it('renders the seed project and seven stages on first load', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())
    expect(screen.getByTestId('project-name').textContent).toBe('我的裝修工程')
    // AC-FR001-01: total = 7, percent = 0%
    expect(screen.getByTestId('total-stages').textContent).toBe('7')
    expect(screen.getByTestId('percent-complete').textContent).toBe('0%')
    expect(screen.getByTestId('completed-stages').textContent).toBe('0')
    expect(screen.getByTestId('in-progress-stages').textContent).toBe('0')
    expect(screen.getByTestId('blocked-stages').textContent).toBe('0')
    // AC-FR001-02: every seed stage name is visible
    for (const name of ['拆除', '水電', '泥作', '木作', '油漆', '安裝', '驗收']) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0)
    }
  })

  // Regression for the QA round that found the dashboard stuck on "載入中…"
  // indefinitely at http://127.0.0.1:5173/. The production mount wraps the
  // app in <StrictMode>; previously the load effect used a useRef gate that
  // persisted across the StrictMode mount/unmount/remount cycle, so the
  // second invocation skipped the IndexedDB read and the loading state was
  // never resolved. This test fails on that bug and pins the fix.
  it('seeds and renders under React StrictMode (real-browser parity)', async () => {
    renderDashboardInStrictMode()
    await waitFor(
      () => expect(screen.getByTestId('project-name')).toBeInTheDocument(),
      { timeout: 3000 },
    )
    expect(screen.queryByText('載入中…')).toBeNull()
    expect(screen.getByTestId('total-stages').textContent).toBe('7')
    expect(screen.getByTestId('percent-complete').textContent).toBe('0%')
  })

  // The same regression for the read path: a populated IndexedDB must still
  // surface the project when mounted under StrictMode.
  it('loads existing project + stages under StrictMode (no re-seed)', async () => {
    // Seed directly so the next mount finds an existing project.
    const { putProject, putStage } = await import('../db')
    await putProject({
      id: 'proj-explicit',
      name: '既有工程',
      status: 'planning',
      plannedStart: '2026-01-05',
      plannedEnd: '2026-01-09',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await putStage({
      id: 'stage-explicit',
      projectId: 'proj-explicit',
      name: '拆除',
      order: 1,
      status: 'in_progress',
      plannedStart: '2026-01-05',
      plannedEnd: '2026-01-09',
      actualStart: '2026-01-05',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    renderDashboardInStrictMode()
    await waitFor(
      () => expect(screen.getByTestId('project-name')).toBeInTheDocument(),
      { timeout: 3000 },
    )
    expect(screen.queryByText('載入中…')).toBeNull()
    expect(screen.getByTestId('project-name').textContent).toBe('既有工程')
    expect(screen.getByTestId('total-stages').textContent).toBe('1')
    expect(screen.getByTestId('in-progress-stages').textContent).toBe('1')
  })
})

describe('Dashboard — AC-FR001-03 new stage', () => {
  beforeEach(async () => {
    await resetIndexedDb()
  })

  it('adds a new stage that persists across simulated reload', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-stage')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('add-stage'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('階段名稱'), { target: { value: '追加工程' } })
    const startInput = screen.getByLabelText('預計開始') as HTMLInputElement
    const endInput = screen.getByLabelText('預計結束') as HTMLInputElement
    // Stay inside the seed project window (2026-01-05 ~ 2026-02-06).
    fireEvent.change(startInput, { target: { value: '2026-02-01' } })
    fireEvent.change(endInput, { target: { value: '2026-02-03' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))
    await waitFor(() => {
      expect(screen.getByTestId('total-stages').textContent).toBe('8')
    })
    expect(screen.getAllByText('追加工程').length).toBeGreaterThan(0)

    // Simulate reload by re-rendering (Dashboard reads from IndexedDB).
    cleanup()
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('total-stages').textContent).toBe('8'))
    expect(screen.getAllByText('追加工程').length).toBeGreaterThan(0)
  })
})

describe('Dashboard — AC-FR001-04 form validation', () => {
  beforeEach(async () => {
    await resetIndexedDb()
  })

  it('rejects empty stage name with a readable error', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-stage')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('add-stage'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('階段名稱'), { target: { value: '' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '儲存' }))
    await waitFor(() => {
      expect(within(dialog).getAllByText('階段名稱不可為空').length).toBeGreaterThan(0)
    })
    expect(screen.getByTestId('total-stages').textContent).toBe('7')
  })

  it('rejects start after end with a readable error', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-stage')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('add-stage'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('階段名稱'), { target: { value: '壞日期' } })
    fireEvent.change(within(dialog).getByLabelText('預計開始'), { target: { value: '2026-02-15' } })
    fireEvent.change(within(dialog).getByLabelText('預計結束'), { target: { value: '2026-02-09' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '儲存' }))
    await waitFor(() => {
      expect(within(dialog).getAllByText('預計結束日期不可早於預計開始日期').length).toBeGreaterThan(0)
    })
    expect(screen.getByTestId('total-stages').textContent).toBe('7')
  })

  // AC-FR001-04: stage plannedStart / plannedEnd must lie inside the project
  // plannedStart..plannedEnd (inclusive). The seed project covers
  // 2026-01-05 ~ 2026-02-06, so anything outside that window is rejected
  // and existing data is left untouched.
  it('create: rejects plannedStart before the project plannedStart', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-stage')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('add-stage'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('階段名稱'), { target: { value: '超出範圍' } })
    fireEvent.change(within(dialog).getByLabelText('預計開始'), { target: { value: '2025-12-31' } })
    fireEvent.change(within(dialog).getByLabelText('預計結束'), { target: { value: '2026-01-04' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '儲存' }))
    await waitFor(() => {
      expect(within(dialog).getAllByText('預計開始日期必須落在工程日期範圍內').length).toBeGreaterThan(0)
      expect(within(dialog).getAllByText('預計結束日期必須落在工程日期範圍內').length).toBeGreaterThan(0)
    })
    expect(screen.getByTestId('total-stages').textContent).toBe('7')
  })

  it('create: rejects plannedStart after the project plannedEnd', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-stage')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('add-stage'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('階段名稱'), { target: { value: '超出範圍' } })
    fireEvent.change(within(dialog).getByLabelText('預計開始'), { target: { value: '2026-03-01' } })
    fireEvent.change(within(dialog).getByLabelText('預計結束'), { target: { value: '2026-03-05' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '儲存' }))
    await waitFor(() => {
      expect(within(dialog).getAllByText('預計開始日期必須落在工程日期範圍內').length).toBeGreaterThan(0)
      expect(within(dialog).getAllByText('預計結束日期必須落在工程日期範圍內').length).toBeGreaterThan(0)
    })
    expect(screen.getByTestId('total-stages').textContent).toBe('7')
  })

  it('edit: rejects plannedEnd moved past the project plannedEnd', async () => {
    renderDashboard()
    const rowTestId = await rowTestIdFor('拆除')
    const row = screen.getByTestId(rowTestId)
    fireEvent.click(within(row).getByRole('button', { name: '編輯階段 拆除' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('預計結束'), { target: { value: '2026-03-05' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '儲存' }))
    await waitFor(() => {
      expect(within(dialog).getAllByText('預計結束日期必須落在工程日期範圍內').length).toBeGreaterThan(0)
    })
    // Existing data unchanged: still 7 stages, 0 completed.
    expect(screen.getByTestId('total-stages').textContent).toBe('7')
    expect(screen.getByTestId('completed-stages').textContent).toBe('0')
  })
})

describe('Dashboard — AC-FR001-05 status updates', () => {
  beforeEach(async () => {
    await resetIndexedDb()
  })

  it('updating a stage to completed updates summary + persistence', async () => {
    renderDashboard()
    const rowTestId = await rowTestIdFor('拆除')
    const row = screen.getByTestId(rowTestId)
    fireEvent.click(within(row).getByRole('button', { name: '編輯階段 拆除' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('狀態'), { target: { value: 'completed' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '儲存' }))
    await waitFor(() => {
      expect(screen.getByTestId('completed-stages').textContent).toBe('1')
    })
    // percent: 1/7 = 14.29 → 14
    expect(screen.getByTestId('percent-complete').textContent).toBe('14%')

    cleanup()
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('completed-stages').textContent).toBe('1')
    })
    expect(screen.getByTestId('percent-complete').textContent).toBe('14%')
  })
})

describe('Dashboard — AC-FR001-07 delete confirm', () => {
  beforeEach(async () => {
    await resetIndexedDb()
  })

  it('cancel delete leaves stage intact', async () => {
    renderDashboard()
    const rowTestId = await rowTestIdFor('拆除')
    const row = screen.getByTestId(rowTestId)
    fireEvent.click(within(row).getByRole('button', { name: '刪除階段 拆除' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }))
    expect(screen.getByTestId('total-stages').textContent).toBe('7')
  })

  it('confirm delete removes stage and persists', async () => {
    renderDashboard()
    const rowTestId = await rowTestIdFor('拆除')
    const row = screen.getByTestId(rowTestId)
    fireEvent.click(within(row).getByRole('button', { name: '刪除階段 拆除' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByTestId('confirm-delete'))
    await waitFor(() => {
      expect(screen.getByTestId('total-stages').textContent).toBe('6')
    })
    // AC-FR001-07: confirm-and-refresh leaves the data removed.
    cleanup()
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('total-stages').textContent).toBe('6'))
  })
})

describe('Dashboard — AC-FR001-08 empty state', () => {
  beforeEach(async () => {
    await resetIndexedDb()
  })

  it('shows 0% and an add CTA when no stages remain', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getAllByText('拆除').length).toBeGreaterThan(0))
    // delete all 7 stages, by deleting the first row repeatedly until none left
    for (let i = 0; i < 7; i++) {
      const rowTestId = await firstStageRowTestId()
      const row = screen.getByTestId(rowTestId)
      const name = row.querySelector('.stage-name')?.textContent ?? ''
      // Capture the summary count BEFORE firing the delete so we can wait for
      // the React list to actually shrink. Waiting only on dialog disappearance
      // is racy: the ConfirmDialog unmounts first, but the reducer that removes
      // the stage row from the list renders on a later microtask, so the next
      // iteration can still see the old row count and the final empty-state
      // assertion fails intermittently.
      const beforeTotal = Number(screen.getByTestId('total-stages').textContent)
      fireEvent.click(within(row).getByRole('button', { name: `刪除階段 ${name}` }))
      const dialog = await screen.findByRole('dialog')
      fireEvent.click(within(dialog).getByTestId('confirm-delete'))
      await waitFor(() => screen.queryByRole('dialog') === null)
      // Pin the state transition: total-stages must drop by exactly one
      // (no fixed sleeps, no relaxed assertions).
      await waitFor(() => {
        expect(screen.getByTestId('total-stages').textContent).toBe(String(beforeTotal - 1))
      })
    }
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByTestId('percent-complete').textContent).toBe('0%')
    expect(screen.getByTestId('add-stage-empty')).toBeInTheDocument()
  })
})
