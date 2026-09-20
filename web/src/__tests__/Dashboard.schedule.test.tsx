// Schedule section integration tests — AC-FR005-01 ~ AC-FR005-04.
// Mounts the real <Dashboard> against fake-indexeddb and drives the form
// the same way a user would.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DashboardProvider } from '../store'
import { Dashboard } from '../components/Dashboard'
import { closeDb, getAllSchedules, putProject, putStage, resetDbCache } from '../db'
import { todayISO } from '../dates'
import type { Project, Stage } from '../types'

const seedProject: Project = {
  id: 'proj-schedule',
  name: '排程測試工程',
  status: 'in_progress',
  plannedStart: '2026-01-05',
  plannedEnd: '2026-12-31',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const seedStages: Stage[] = [
  {
    id: 'stage-water',
    projectId: 'proj-schedule',
    name: '水電',
    order: 1,
    status: 'in_progress',
    plannedStart: '2026-02-01',
    plannedEnd: '2026-02-15',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'stage-floor',
    projectId: 'proj-schedule',
    name: '地板',
    order: 2,
    status: 'not_started',
    plannedStart: '2026-04-01',
    plannedEnd: '2026-04-30',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

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
  // Wait for the provider's load effect to finish (project loaded from IDB).
  await waitFor(() =>
    expect(screen.getByTestId('schedule-add-cta')).toBeInTheDocument(),
  )
  return result
}

afterEach(() => {
  cleanup()
})

beforeEach(async () => {
  await resetIndexedDb()
})

async function openScheduleForm() {
  // Wait for the dashboard to finish loading before clicking the CTA — the
  // provider's load effect resolves asynchronously (see store.tsx).
  await waitFor(() =>
    expect(screen.getByTestId('schedule-add-cta')).toBeInTheDocument(),
  )
  fireEvent.click(screen.getByTestId('schedule-add-cta'))
  return screen.findByRole('dialog')
}

function fillAndSubmit(
  dialog: HTMLElement,
  values: {
    workerName: string
    phone?: string
    stageId?: string
    startOn: string
    endOn: string
    reminderOn?: string
    note?: string
    completed?: boolean
  },
) {
  fireEvent.change(within(dialog).getByTestId('schedule-worker-input'), {
    target: { value: values.workerName },
  })
  if (values.phone !== undefined) {
    fireEvent.change(within(dialog).getByTestId('schedule-phone-input'), {
      target: { value: values.phone },
    })
  }
  if (values.stageId !== undefined) {
    fireEvent.change(within(dialog).getByTestId('schedule-stage-select'), {
      target: { value: values.stageId },
    })
  }
  fireEvent.change(within(dialog).getByTestId('schedule-start-input'), {
    target: { value: values.startOn },
  })
  fireEvent.change(within(dialog).getByTestId('schedule-end-input'), {
    target: { value: values.endOn },
  })
  if (values.reminderOn !== undefined) {
    fireEvent.change(within(dialog).getByTestId('schedule-reminder-input'), {
      target: { value: values.reminderOn },
    })
  }
  if (values.note !== undefined) {
    fireEvent.change(within(dialog).getByTestId('schedule-note-input'), {
      target: { value: values.note },
    })
  }
  if (values.completed) {
    fireEvent.click(within(dialog).getByTestId('schedule-completed-input'))
  }
  fireEvent.click(within(dialog).getByTestId('schedule-submit'))
}

describe('AC-FR005-01 — schedule list, CRUD, validation, reminder', () => {
  it('shows the section header + empty state when no schedules exist', async () => {
    await putProject(seedProject)
    await renderDashboard()
    await waitFor(() => expect(screen.getByText('師傅排程')).toBeInTheDocument())
    expect(screen.getByTestId('schedule-empty')).toBeInTheDocument()
    expect(screen.getByTestId('schedule-add-cta')).toBeInTheDocument()
  })

  it('creates a valid schedule, persists it, and shows it in the list', async () => {
    await putProject(seedProject)
    // Seed the stage referenced by the form so the <select> actually contains
    // an `<option value="stage-water">` — without it, jsdom ignores the
    // fireEvent.change value because no option matches.
    await Promise.all(seedStages.map((s) => putStage(s)))
    await renderDashboard()
    const dialog = await openScheduleForm()
    fillAndSubmit(dialog, {
      workerName: '水電師傅',
      phone: '0912345678',
      stageId: 'stage-water',
      startOn: todayISO(),
      endOn: todayISO(),
      note: '上午進場',
    })
    await waitFor(() => expect(screen.getByTestId('schedule-list')).toBeInTheDocument())
    expect(screen.getByText('水電師傅')).toBeInTheDocument()
    expect(screen.getByText(/上午進場/)).toBeInTheDocument()
    // Stage name appears both in the row and the reminder list, so look it
    // up by its testid container.
    const row = screen.getByTestId(
      `schedule-row-${(await getAllSchedules())[0]!.id}`,
    )
    expect(within(row).getByText(/關聯階段：水電/)).toBeInTheDocument()

    const stored = await getAllSchedules()
    expect(stored).toHaveLength(1)
    expect(stored[0]!.workerName).toBe('水電師傅')
    expect(stored[0]!.projectId).toBe(seedProject.id)
    expect(stored[0]!.stageId).toBe('stage-water')
    expect(stored[0]!.completed).toBe(false)
  })

  it('rejects empty workerName with inline error and does not persist', async () => {
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openScheduleForm()
    // workerName left empty, only fill dates.
    fireEvent.change(within(dialog).getByTestId('schedule-start-input'), {
      target: { value: todayISO() },
    })
    fireEvent.change(within(dialog).getByTestId('schedule-end-input'), {
      target: { value: todayISO() },
    })
    fireEvent.click(within(dialog).getByTestId('schedule-submit'))
    await waitFor(() =>
      expect(within(dialog).getByTestId('schedule-worker-error')).toBeInTheDocument(),
    )
    expect(within(dialog).getByTestId('schedule-worker-error').textContent).toMatch(
      /工班名稱不可為空/,
    )
    expect(await getAllSchedules()).toHaveLength(0)
  })

  it('rejects reminderOn later than startOn (SPEC §4.6)', async () => {
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openScheduleForm()
    fillAndSubmit(dialog, {
      workerName: '木工',
      startOn: '2026-09-25',
      endOn: '2026-09-30',
      reminderOn: '2026-09-26',
    })
    await waitFor(() =>
      expect(within(dialog).getByTestId('schedule-reminder-error')).toBeInTheDocument(),
    )
    expect(within(dialog).getByTestId('schedule-reminder-error').textContent).toMatch(
      /提醒日期不可晚於開始日期/,
    )
    expect(await getAllSchedules()).toHaveLength(0)
  })

  it('rejects endOn earlier than startOn', async () => {
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openScheduleForm()
    fillAndSubmit(dialog, {
      workerName: '木工',
      startOn: '2026-09-25',
      endOn: '2026-09-20',
    })
    await waitFor(() =>
      expect(within(dialog).getByTestId('schedule-end-error')).toBeInTheDocument(),
    )
    expect(within(dialog).getByTestId('schedule-end-error').textContent).toMatch(
      /結束日期不可早於開始日期/,
    )
    expect(await getAllSchedules()).toHaveLength(0)
  })

  it('cancel does not persist anything and dismisses the form', async () => {
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openScheduleForm()
    fireEvent.change(within(dialog).getByTestId('schedule-worker-input'), {
      target: { value: '放棄的排程' },
    })
    fireEvent.click(within(dialog).getByTestId('schedule-cancel'))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(await getAllSchedules()).toHaveLength(0)
  })

  it('edits an existing schedule', async () => {
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openScheduleForm()
    fillAndSubmit(dialog, {
      workerName: '原名',
      startOn: '2026-09-22',
      endOn: '2026-09-23',
    })
    // Wait for the async dispatch + IDB write to land before we read the id.
    await waitFor(async () => {
      const stored = await getAllSchedules()
      expect(stored).toHaveLength(1)
    })
    const id = (await getAllSchedules())[0]!.id
    await waitFor(() =>
      expect(screen.getByTestId(`schedule-row-${id}`)).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByTestId(`schedule-edit-${id}`))
    const editDialog = await screen.findByRole('dialog')
    fireEvent.change(within(editDialog).getByTestId('schedule-worker-input'), {
      target: { value: '新名' },
    })
    fireEvent.click(within(editDialog).getByTestId('schedule-submit'))
    await waitFor(() =>
      expect(screen.getByTestId(`schedule-row-${id}`)).toHaveTextContent('新名'),
    )
    expect(screen.queryByText('原名')).not.toBeInTheDocument()
    const stored = await getAllSchedules()
    expect(stored[0]!.workerName).toBe('新名')
    expect(stored[0]!.id).toBe(id)
  })

  it('delete prompts for confirmation and persists the removal only on confirm', async () => {
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openScheduleForm()
    fillAndSubmit(dialog, {
      workerName: '要刪的',
      startOn: todayISO(),
      endOn: todayISO(),
    })
    await waitFor(async () => {
      const stored = await getAllSchedules()
      expect(stored).toHaveLength(1)
    })
    const id = (await getAllSchedules())[0]!.id
    await waitFor(() =>
      expect(screen.getByTestId(`schedule-row-${id}`)).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByTestId(`schedule-delete-${id}`))
    const confirm = await screen.findByRole('dialog')
    // First cancel — data must remain.
    fireEvent.click(within(confirm).getByRole('button', { name: '取消' }))
    await waitFor(() =>
      expect(screen.queryByTestId('confirm-delete')).not.toBeInTheDocument(),
    )
    expect(await getAllSchedules()).toHaveLength(1)

    // Confirm — data removed.
    fireEvent.click(screen.getByTestId(`schedule-delete-${id}`))
    const confirm2 = await screen.findByRole('dialog')
    // The confirm button lives inside the dialog with data-testid="confirm-delete".
    fireEvent.click(within(confirm2).getByTestId('confirm-delete'))
    await waitFor(() => expect(screen.queryByText('要刪的')).not.toBeInTheDocument())
    expect(await getAllSchedules()).toHaveLength(0)
  })

  it('completed toggle persists and updates the summary', async () => {
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openScheduleForm()
    fillAndSubmit(dialog, {
      workerName: '會完成',
      startOn: '2026-09-22',
      endOn: '2026-09-23',
    })
    await waitFor(() => expect(screen.getByText('會完成')).toBeInTheDocument())
    const id = (await getAllSchedules())[0]!.id

    fireEvent.click(screen.getByTestId(`schedule-complete-toggle-${id}`))
    await waitFor(async () => {
      const stored = await getAllSchedules()
      expect(stored[0]!.completed).toBe(true)
    })
    expect(screen.getByTestId('schedule-summary').textContent).toMatch(/已完成 1 筆/)
  })

  it('renders the in-page reminder for an upcoming schedule and hides completed ones', async () => {
    await putProject(seedProject)
    await renderDashboard()
    const dialog = await openScheduleForm()
    fillAndSubmit(dialog, {
      workerName: '未來提醒',
      startOn: '2026-09-22',
      endOn: '2026-09-30',
      reminderOn: '2026-09-22',
    })
    await waitFor(async () => {
      const stored = await getAllSchedules()
      expect(stored).toHaveLength(1)
    })
    const id = (await getAllSchedules())[0]!.id
    await waitFor(() =>
      expect(screen.getByTestId(`schedule-row-${id}`)).toBeInTheDocument(),
    )
    expect(screen.getByTestId('schedule-reminder')).toBeInTheDocument()
    expect(screen.getByTestId(`schedule-reminder-item-${id}`)).toBeInTheDocument()

    fireEvent.click(screen.getByTestId(`schedule-complete-toggle-${id}`))
    await waitFor(async () => {
      const stored = await getAllSchedules()
      expect(stored[0]!.completed).toBe(true)
    })
    // Reminder gone because the item is now completed.
    expect(screen.queryByTestId('schedule-reminder')).not.toBeInTheDocument()
  })

  it('keeps schedules sorted by startOn (AC-FR005-04)', async () => {
    await putProject(seedProject)
    await renderDashboard()
    const dlg1 = await openScheduleForm()
    fillAndSubmit(dlg1, {
      workerName: 'Z',
      startOn: '2026-09-25',
      endOn: '2026-09-28',
    })
    await waitFor(() => expect(screen.getByText('Z')).toBeInTheDocument())
    const dlg2 = await openScheduleForm()
    fillAndSubmit(dlg2, {
      workerName: 'A',
      startOn: '2026-09-21',
      endOn: '2026-09-22',
    })
    await waitFor(() => expect(screen.getByText('A')).toBeInTheDocument())

    const items = screen.getAllByTestId(/schedule-row-/)
    expect(items[0]!.textContent).toMatch(/A/)
    expect(items[1]!.textContent).toMatch(/Z/)
  })

  it('does not crash when Notification API is unavailable (FR-005 best-effort)', async () => {
    await putProject(seedProject)
    // Pretend Notification does not exist.
    const original = (globalThis as { Notification?: unknown }).Notification
    // `delete` on an optional property is allowed by strict TS, so no
    // `@ts-expect-error` is needed here — but keep the explicit cast so the
    // intent ("pretend this global doesn't exist") is clear at the call site.
    delete (globalThis as { Notification?: unknown }).Notification
    try {
      await renderDashboard()
      const dialog = await openScheduleForm()
      fillAndSubmit(dialog, {
        workerName: 'no-notify',
        startOn: '2026-09-22',
        endOn: '2026-09-30',
        reminderOn: '2026-09-22',
      })
      // Scope the worker-name check to the schedule list so the reminder
      // entry (which intentionally echoes the worker name) does not cause a
      // duplicate-match failure. The reminder's existence is verified below
      // via its dedicated testid.
      await waitFor(() => {
        const list = screen.getByTestId('schedule-list')
        expect(within(list).getByText('no-notify')).toBeInTheDocument()
      })
      expect(screen.getByTestId('schedule-reminder')).toBeInTheDocument()
    } finally {
      ;(globalThis as { Notification?: unknown }).Notification = original
    }
  })

  it('fires a one-shot Notification when reminder window opens and permission is granted', async () => {
    await putProject(seedProject)
    const notificationCtor = vi.fn()
    class FakeNotification {
      title: string
      options: NotificationOptions | undefined
      static permission: NotificationPermission = 'granted'
      static requestPermission = vi.fn().mockResolvedValue('granted')
      constructor(title: string, options?: NotificationOptions) {
        this.title = title
        this.options = options
        notificationCtor(title, options)
      }
    }
    const original = (globalThis as { Notification?: unknown }).Notification
    ;(globalThis as { Notification?: unknown }).Notification = FakeNotification
    try {
      await renderDashboard()
      const dialog = await openScheduleForm()
      fillAndSubmit(dialog, {
        workerName: 'notif-once',
        startOn: '2026-09-22',
        endOn: '2026-09-30',
        reminderOn: '2026-09-22',
      })
      await waitFor(() => {
        const list = screen.getByTestId('schedule-list')
        expect(within(list).getByText('notif-once')).toBeInTheDocument()
      })
      await waitFor(() =>
        expect(notificationCtor).toHaveBeenCalledWith('師傅排程提醒', expect.objectContaining({ body: expect.stringMatching(/notif-once/) })),
      )
      // Adding another in-window item still produces exactly one notification
      // for the combined signature (no duplicate per render).
      notificationCtor.mockClear()
      const dialog2 = await openScheduleForm()
      fillAndSubmit(dialog2, {
        workerName: 'second-notif',
        startOn: '2026-09-23',
        endOn: '2026-09-30',
        reminderOn: '2026-09-23',
      })
      await waitFor(() => {
        const list = screen.getByTestId('schedule-list')
        expect(within(list).getByText('second-notif')).toBeInTheDocument()
      })
      // The signature changed (two items now), so a new notification fires.
      await waitFor(() => expect(notificationCtor).toHaveBeenCalled())
    } finally {
      ;(globalThis as { Notification?: unknown }).Notification = original
    }
  })
})
