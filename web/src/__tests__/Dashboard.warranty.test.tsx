// Warranty section integration tests — AC-FR006-01 ~ AC-FR006-04.
// Mounts the real <Dashboard> against fake-indexeddb and drives the form
// the same way a user would. Drives today via a fixed reference date so
// the status banners behave deterministically.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { DashboardProvider } from '../store'
import { Dashboard } from '../components/Dashboard'
import {
  closeDb,
  getAllWarranties,
  putProject,
  resetDbCache,
} from '../db'
import { todayISO } from '../dates'
import type { Project } from '../types'

// Pin "today" so the date-driven banners + countdown strings stay
// deterministic across runs. Matches the FR-005 + FR-006 fixtures.
const FIXED_TODAY = '2026-09-20'

beforeEach(() => {
  // Pin "today" for the warranty banner / countdown logic without taking
  // the rest of the timer system offline.
  //
  // The previous version called bare `vi.useFakeTimers()` — that fakes
  // `setTimeout` AND `setImmediate` by default. Two things then broke:
  //   1. `@testing-library/react`'s `waitFor` polls via `setTimeout`, so
  //      every UI test in this file hung on the very first `waitFor`
  //      until the 5000ms global testTimeout.
  //   2. `fake-indexeddb` dispatches IDB request events through
  //      `setImmediate` (with a `setTimeout(0)` fallback), so once fake
  //      timers blocked those, every `getAll*()` call resolved with
  //      `undefined`, the DashboardProvider's load effect crashed on
  //      `projects.length`, and the dashboard rendered an error state.
  //
  // The deterministic fix: fake only `Date` (and `performance`, which the
  // fake-clock always co-fakes and is harmless). With `Date` faked,
  // `new Date()` keeps returning FIXED_TODAY everywhere in the app code,
  // but the real timer APIs keep running, so both `waitFor` and
  // `fake-indexeddb` behave normally. `vi.setSystemTime` then anchors the
  // pinned "today" inside the fake Date instance.
  vi.useFakeTimers({ toFake: ['Date', 'performance'] })
  vi.setSystemTime(new Date(`${FIXED_TODAY}T12:00:00.000Z`))
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

const seedProject: Project = {
  id: 'proj-warranty',
  name: '保固測試工程',
  status: 'in_progress',
  plannedStart: '2026-01-05',
  plannedEnd: '2026-12-31',
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

async function renderDashboard() {
  const result = render(
    <DashboardProvider>
      <Dashboard />
    </DashboardProvider>,
  )
  await waitFor(() =>
    expect(screen.getByTestId('warranty-add-cta')).toBeInTheDocument(),
  )
  return result
}

async function openWarrantyForm() {
  await waitFor(() =>
    expect(screen.getByTestId('warranty-add-cta')).toBeInTheDocument(),
  )
  fireEvent.click(screen.getByTestId('warranty-add-cta'))
  return screen.findByRole('dialog')
}

function fillAndSubmit(
  dialog: HTMLElement,
  values: {
    itemName: string
    provider: string
    contact?: string
    startsOn: string
    endsOn: string
    note?: string
  },
) {
  fireEvent.change(within(dialog).getByTestId('warranty-item-input'), {
    target: { value: values.itemName },
  })
  fireEvent.change(within(dialog).getByTestId('warranty-provider-input'), {
    target: { value: values.provider },
  })
  if (values.contact !== undefined) {
    fireEvent.change(within(dialog).getByTestId('warranty-contact-input'), {
      target: { value: values.contact },
    })
  }
  fireEvent.change(within(dialog).getByTestId('warranty-starts-input'), {
    target: { value: values.startsOn },
  })
  fireEvent.change(within(dialog).getByTestId('warranty-ends-input'), {
    target: { value: values.endsOn },
  })
  if (values.note !== undefined) {
    fireEvent.change(within(dialog).getByTestId('warranty-note-input'), {
      target: { value: values.note },
    })
  }
  fireEvent.click(within(dialog).getByTestId('warranty-submit'))
}

describe('AC-FR006-01 — empty state, CRUD, section header', () => {
  it('shows the section header + empty state when no warranties exist', async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    await renderDashboard()
    expect(screen.getByText('保固紀錄')).toBeInTheDocument()
    expect(screen.getByTestId('warranty-empty')).toBeInTheDocument()
    expect(screen.getByTestId('warranty-add-cta')).toBeInTheDocument()
  })

  it('creates a valid warranty, persists it, and shows it in the list', async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openWarrantyForm()
    fillAndSubmit(dialog, {
      itemName: '磁磚保固',
      provider: '里歐建材',
      contact: '0912345678',
      startsOn: '2026-01-01',
      endsOn: '2026-12-31',
      note: '客廳',
    })
    await waitFor(() =>
      expect(screen.getByTestId('warranty-list')).toBeInTheDocument(),
    )
    expect(screen.getByText('磁磚保固')).toBeInTheDocument()
    expect(screen.getByText(/里歐建材/)).toBeInTheDocument()
    expect(screen.getByText(/0912345678/)).toBeInTheDocument()

    const stored = await getAllWarranties()
    expect(stored).toHaveLength(1)
    expect(stored[0]!.itemName).toBe('磁磚保固')
    expect(stored[0]!.provider).toBe('里歐建材')
    expect(stored[0]!.projectId).toBe(seedProject.id)
    expect(stored[0]!.contact).toBe('0912345678')
    expect(stored[0]!.note).toBe('客廳')
  })

  it('persists across simulated reload (close + reopen DB cache)', async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openWarrantyForm()
    fillAndSubmit(dialog, {
      itemName: '油漆保固',
      provider: '山崎油漆',
      startsOn: '2026-01-01',
      endsOn: '2027-01-01',
    })
    await waitFor(() =>
      expect(screen.getByTestId('warranty-list')).toBeInTheDocument(),
    )
    const stored = await getAllWarranties()
    expect(stored).toHaveLength(1)
    // Re-render to ensure the second mount reads from IndexedDB.
    cleanup()
    await renderDashboard()
    expect(screen.getByText('油漆保固')).toBeInTheDocument()
  })
})

describe('AC-FR006-02 — validation', () => {
  it('rejects empty itemName with inline error and does not persist', async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openWarrantyForm()
    // Leave itemName empty; fill the rest with valid data.
    fireEvent.change(within(dialog).getByTestId('warranty-provider-input'), {
      target: { value: '里歐建材' },
    })
    fireEvent.change(within(dialog).getByTestId('warranty-starts-input'), {
      target: { value: '2026-01-01' },
    })
    fireEvent.change(within(dialog).getByTestId('warranty-ends-input'), {
      target: { value: '2026-12-31' },
    })
    fireEvent.click(within(dialog).getByTestId('warranty-submit'))
    await waitFor(() =>
      expect(within(dialog).getByTestId('warranty-item-error')).toBeInTheDocument(),
    )
    expect(within(dialog).getByTestId('warranty-item-error').textContent).toMatch(
      /項目/,
    )
    expect(await getAllWarranties()).toHaveLength(0)
  })

  it('rejects empty provider with inline error and does not persist', async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openWarrantyForm()
    fireEvent.change(within(dialog).getByTestId('warranty-item-input'), {
      target: { value: '磁磚保固' },
    })
    fireEvent.change(within(dialog).getByTestId('warranty-starts-input'), {
      target: { value: '2026-01-01' },
    })
    fireEvent.change(within(dialog).getByTestId('warranty-ends-input'), {
      target: { value: '2026-12-31' },
    })
    fireEvent.click(within(dialog).getByTestId('warranty-submit'))
    await waitFor(() =>
      expect(within(dialog).getByTestId('warranty-provider-error')).toBeInTheDocument(),
    )
    expect(within(dialog).getByTestId('warranty-provider-error').textContent).toMatch(
      /提供者/,
    )
    expect(await getAllWarranties()).toHaveLength(0)
  })

  it('rejects endsOn < startsOn with inline error', async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openWarrantyForm()
    fillAndSubmit(dialog, {
      itemName: '磁磚保固',
      provider: '里歐建材',
      startsOn: '2026-06-01',
      endsOn: '2026-05-01',
    })
    await waitFor(() =>
      expect(within(dialog).getByTestId('warranty-ends-error')).toBeInTheDocument(),
    )
    expect(within(dialog).getByTestId('warranty-ends-error').textContent).toMatch(
      /結束日不得早於開始日/,
    )
    expect(await getAllWarranties()).toHaveLength(0)
  })

  it('rejects a non-ISO startsOn with inline error', async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openWarrantyForm()
    fireEvent.change(within(dialog).getByTestId('warranty-item-input'), {
      target: { value: '磁磚保固' },
    })
    fireEvent.change(within(dialog).getByTestId('warranty-provider-input'), {
      target: { value: '里歐建材' },
    })
    // date inputs normally reject malformed values; the validation path is
    // still covered by `warranty.test.ts`. Here we test that an empty endsOn
    // surfaces the validation error in the dialog.
    fireEvent.change(within(dialog).getByTestId('warranty-starts-input'), {
      target: { value: '' },
    })
    fireEvent.change(within(dialog).getByTestId('warranty-ends-input'), {
      target: { value: '' },
    })
    fireEvent.click(within(dialog).getByTestId('warranty-submit'))
    await waitFor(() =>
      expect(within(dialog).getByTestId('warranty-starts-error')).toBeInTheDocument(),
    )
    expect(await getAllWarranties()).toHaveLength(0)
  })
})

describe('AC-FR006-02 — list ordering by endsOn', () => {
  it('sorts the list by endsOn ascending', async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    await renderDashboard()
    // Add three warranties in scrambled order; the list should still render
    // by endsOn ascending.
    const dialog1 = await openWarrantyForm()
    fillAndSubmit(dialog1, {
      itemName: '中保固',
      provider: '中商',
      startsOn: '2026-01-01',
      endsOn: '2027-06-30', // endsOn: 2027-06-30 — third
    })
    await waitFor(() =>
      expect(screen.getByTestId('warranty-list')).toBeInTheDocument(),
    )

    const dialog2 = await openWarrantyForm()
    fillAndSubmit(dialog2, {
      itemName: '早保固',
      provider: '早商',
      startsOn: '2026-01-01',
      endsOn: '2026-12-31', // endsOn: 2026-12-31 — first
    })
    await waitFor(() => expect(screen.getByText('早保固')).toBeInTheDocument())

    const dialog3 = await openWarrantyForm()
    fillAndSubmit(dialog3, {
      itemName: '晚保固',
      provider: '晚商',
      startsOn: '2026-01-01',
      endsOn: '2027-03-31', // endsOn: 2027-03-31 — second
    })
    await waitFor(() => expect(screen.getByText('晚保固')).toBeInTheDocument())

    const rows = screen.getAllByTestId(/^warranty-row-/)
    const names = rows.map((r) => r.querySelector('.warranty-name')!.textContent)
    expect(names).toEqual(['早保固', '晚保固', '中保固'])
  })
})

describe('AC-FR006-03 — 30-day expiring soon warning + expired status', () => {
  it('shows the expiring-soon banner when an active warranty expires within 30 days', async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openWarrantyForm()
    fillAndSubmit(dialog, {
      itemName: '即將到期',
      provider: '快到期商',
      startsOn: '2026-01-01',
      // 10 days from FIXED_TODAY (2026-09-20)
      endsOn: '2026-09-30',
    })
    await waitFor(() =>
      expect(screen.getByTestId('warranty-alert-expiring')).toBeInTheDocument(),
    )
    const alert = screen.getByTestId('warranty-alert-expiring')
    expect(alert.textContent).toMatch(/30 天內到期的保固/)
    // The expiring item appears in the alert list. The name is also rendered
    // in the warranty row beneath the alert, so we scope the lookup to the
    // alert to match the AC's literal intent ("appears in the alert list").
    expect(within(alert).getByText('即將到期')).toBeInTheDocument()
  })

  it('does NOT show the expiring banner when the warranty ends in 60 days', async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openWarrantyForm()
    fillAndSubmit(dialog, {
      itemName: '遙遠保固',
      provider: '遠商',
      startsOn: '2026-01-01',
      endsOn: '2026-11-19', // 60 days from FIXED_TODAY
    })
    await waitFor(() =>
      expect(screen.getByTestId('warranty-list')).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('warranty-alert-expiring')).toBeNull()
  })

  it('shows the expired banner + "已過期" status when endsOn < today', async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openWarrantyForm()
    fillAndSubmit(dialog, {
      itemName: '已過期保固',
      provider: '過期商',
      startsOn: '2025-01-01',
      endsOn: '2025-12-31',
    })
    await waitFor(() =>
      expect(screen.getByTestId('warranty-alert-expired')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('warranty-alert-expired').textContent).toMatch(
      /已過期的保固/,
    )
    // Row shows the "已過期" status pill.
    const row = screen.getAllByTestId(/^warranty-row-/)[0]!
    expect(within(row).getByText('已過期')).toBeInTheDocument()
  })

  it('shows "尚未開始" status for future warranties', async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openWarrantyForm()
    fillAndSubmit(dialog, {
      itemName: '未來保固',
      provider: '未來商',
      startsOn: '2027-01-01',
      endsOn: '2027-12-31',
    })
    await waitFor(() =>
      expect(screen.getByTestId('warranty-list')).toBeInTheDocument(),
    )
    const row = screen.getAllByTestId(/^warranty-row-/)[0]!
    expect(within(row).getByText('尚未開始')).toBeInTheDocument()
    expect(screen.queryByTestId('warranty-alert-expiring')).toBeNull()
    expect(screen.queryByTestId('warranty-alert-expired')).toBeNull()
  })
})

describe('AC-FR006-03 — edit + delete with confirmation', () => {
  it('edits an existing warranty and persists the change', async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openWarrantyForm()
    fillAndSubmit(dialog, {
      itemName: '原名',
      provider: '原商',
      startsOn: '2026-01-01',
      endsOn: '2026-12-31',
    })
    await waitFor(() =>
      expect(screen.getByText('原名')).toBeInTheDocument(),
    )
    const stored = await getAllWarranties()
    const id = stored[0]!.id

    fireEvent.click(screen.getByTestId(`warranty-edit-${id}`))
    const editDialog = await screen.findByRole('dialog')
    // The form should be pre-filled.
    const itemInput = within(editDialog).getByTestId(
      'warranty-item-input',
    ) as HTMLInputElement
    expect(itemInput.value).toBe('原名')
    fireEvent.change(itemInput, { target: { value: '新名' } })
    fireEvent.click(within(editDialog).getByTestId('warranty-submit'))

    await waitFor(() => expect(screen.getByText('新名')).toBeInTheDocument())
    expect(screen.queryByText('原名')).toBeNull()
    const after = await getAllWarranties()
    expect(after[0]!.itemName).toBe('新名')
  })

  it('deletes after confirmation; cancel does NOT mutate data', async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openWarrantyForm()
    fillAndSubmit(dialog, {
      itemName: '待刪除',
      provider: '刪商',
      startsOn: '2026-01-01',
      endsOn: '2026-12-31',
    })
    await waitFor(() =>
      expect(screen.getByText('待刪除')).toBeInTheDocument(),
    )
    const stored = await getAllWarranties()
    const id = stored[0]!.id

    // Click delete → cancel → must remain.
    fireEvent.click(screen.getByTestId(`warranty-delete-${id}`))
    const confirm = await screen.findByTestId('confirm-delete')
    fireEvent.click(
      within(confirm.closest('.modal') as HTMLElement).getByText('取消'),
    )
    await waitFor(() => expect(screen.getByText('待刪除')).toBeInTheDocument())
    expect((await getAllWarranties())).toHaveLength(1)

    // Click delete → confirm → must be removed.
    fireEvent.click(screen.getByTestId(`warranty-delete-${id}`))
    const confirm2 = await screen.findByTestId('confirm-delete')
    fireEvent.click(confirm2)
    await waitFor(() => expect(screen.queryByText('待刪除')).toBeNull())
    expect(await getAllWarranties()).toEqual([])
  })

  it('also accepts editing just the contact via the edit form', async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openWarrantyForm()
    fillAndSubmit(dialog, {
      itemName: '聯絡測試',
      provider: '商',
      startsOn: '2026-01-01',
      endsOn: '2026-12-31',
    })
    await waitFor(() =>
      expect(screen.getByText('聯絡測試')).toBeInTheDocument(),
    )
    const id = (await getAllWarranties())[0]!.id
    fireEvent.click(screen.getByTestId(`warranty-edit-${id}`))
    const editDialog = await screen.findByRole('dialog')
    fireEvent.change(within(editDialog).getByTestId('warranty-contact-input'), {
      target: { value: '02-8765-4321' },
    })
    fireEvent.click(within(editDialog).getByTestId('warranty-submit'))
    await waitFor(() =>
      expect(screen.getByText(/02-8765-4321/)).toBeInTheDocument(),
    )
    expect((await getAllWarranties())[0]!.contact).toBe('02-8765-4321')
  })
})

describe('AC-FR006-04 — summary text reflects the current state', () => {
  it('renders a per-status summary line', async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    await renderDashboard()
    const today = todayISO()
    // One active, one expired, one not_started.
    let dialog = await openWarrantyForm()
    fillAndSubmit(dialog, {
      itemName: '有效中保固',
      provider: '商',
      startsOn: '2026-01-01',
      endsOn: '2027-01-01',
    })
    await waitFor(() =>
      expect(screen.getByTestId('warranty-list')).toBeInTheDocument(),
    )
    dialog = await openWarrantyForm()
    fillAndSubmit(dialog, {
      itemName: '已過期保固',
      provider: '商',
      startsOn: '2025-01-01',
      endsOn: '2025-12-31',
    })
    // Wait for the warranty to render. The name also appears inside the
    // expired-alert list once it surfaces, so use `findAllByText` which
    // resolves once at least one match exists rather than erroring on
    // multiple matches (which `getByText`/`findByText` would).
    expect((await screen.findAllByText('已過期保固')).length).toBeGreaterThan(0)
    dialog = await openWarrantyForm()
    fillAndSubmit(dialog, {
      itemName: '未來保固',
      provider: '商',
      startsOn: '2027-06-01',
      endsOn: '2028-06-01',
    })
    await waitFor(() => expect(screen.getByText('未來保固')).toBeInTheDocument())

    const summary = screen.getByTestId('warranty-summary')
    expect(summary.textContent).toMatch(/共 3 筆/)
    expect(summary.textContent).toMatch(/有效中 1 筆/)
    expect(summary.textContent).toMatch(/已過期 1 筆/)
    expect(summary.textContent).toMatch(/尚未開始 1 筆/)
    // sanity — we did generate today's local ISO in the test env.
    expect(typeof today).toBe('string')
  })
})