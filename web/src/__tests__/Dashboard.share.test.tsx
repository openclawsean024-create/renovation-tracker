// FR-004 share integration tests — AC-FR004-01 ~ AC-FR004-04.
//
// Editable-mode tests mount <DashboardProvider><Dashboard /></DashboardProvider>
// directly, exactly like before — that pattern is preserved for backward
// compatibility. Share-mode tests mount <AppShell /> instead, because SPEC
// §9.1 + AC-FR004-02 require that no <DashboardProvider> be present on
// the read-only surface, and AppShell is the routing component that
// enforces that.
//
// Spy tests use vi.spyOn on the db module exports so we can prove that
// `getAllProjects`, `getAllStages`, `getAllPhotos`, and `getAllBudgets`
// are NEVER invoked during share-mode first render.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import * as dbModule from '../db'
import { DashboardProvider } from '../store'
import { Dashboard } from '../components/Dashboard'
import { AppShell } from '../components/AppShell'
import App from '../App'
import {
  closeDb,
  getAllBudgets,
  getAllPhotos,
  getAllProjects,
  getAllStages,
  putProject,
  resetDbCache,
} from '../db'
import {
  SHARE_HASH_KEY,
  SHARE_SNAPSHOT_VERSION,
  buildShareSnapshot,
  encodeShareSnapshot,
  type ShareSnapshot,
} from '../share'
import type { Project } from '../types'

const seedProject: Project = {
  id: 'proj-share',
  name: '我的裝修工程',
  address: '測試市示範路 1 號',
  status: 'in_progress',
  plannedStart: '2026-01-05',
  plannedEnd: '2026-02-06',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
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

function setHash(value: string) {
  // jsdom normalises # to an empty string when assigned directly; setting
  // via replaceState avoids that and still triggers the hashchange handler
  // when we dispatch it manually.
  const url = new URL(window.location.href)
  url.hash = value
  window.history.replaceState(null, '', url.toString())
}

/** Editable-mode mount — preserved for backward compatibility. */
function renderDashboard(opts: {
  clipboard?: (text: string) => Promise<void>
} = {}) {
  return render(
    <DashboardProvider>
      <Dashboard clipboard={opts.clipboard} />
    </DashboardProvider>,
  )
}

/** Share-aware mount: AppShell decides synchronously whether the share
 *  routing applies. Tests for the read-only surface must use this. */
function renderAppShell() {
  return render(<AppShell />)
}

afterEach(() => {
  cleanup()
  document.body.classList.remove('readonly')
  // Reset hash so the next test does not inherit it.
  setHash('')
  // Restore any spies so each test starts with a clean slate.
  vi.restoreAllMocks()
})

describe('AC-FR004-01 generate + copy share link', () => {
  beforeEach(async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    setHash('')
  })

  it('shows a 產生唯讀分享連結 button on the editable dashboard', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())
    expect(screen.getByTestId('generate-share')).toBeInTheDocument()
    expect(screen.getByTestId('generate-share')).toHaveTextContent('產生唯讀分享連結')
  })

  it('writes a versioned snapshot to the URL hash and copies it to the clipboard', async () => {
    const clipboard = vi.fn<(text: string) => Promise<void>>(async () => undefined)
    renderDashboard({ clipboard })

    const shareBtn = await screen.findByTestId('generate-share')
    fireEvent.click(shareBtn)

    await waitFor(() => {
      expect(clipboard).toHaveBeenCalledTimes(1)
    })
    const url = clipboard.mock.calls[0]![0]
    expect(url).toMatch(new RegExp(`#${SHARE_HASH_KEY}=`))
    // The clipboard URL must not include any Blob / IndexedDB key.
    expect(url).not.toMatch(/blob/i)
    expect(url).not.toMatch(/indexeddb/i)

    // Decode the URL fragment to confirm version + content.
    const fragment = url.split('#')[1] ?? ''
    const param = fragment
      .split('&')
      .find((p) => p.startsWith(`${SHARE_HASH_KEY}=`))
    expect(param).toBeDefined()
    const encoded = param!.slice(SHARE_HASH_KEY.length + 1)
    const decoded = new TextDecoder().decode(
      Uint8Array.from(
        atob(encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(encoded.length + (4 - (encoded.length % 4)) % 4, '=')),
        (c) => c.charCodeAt(0),
      ),
    )
    const parsed = JSON.parse(decoded) as ShareSnapshot
    expect(parsed.version).toBe(SHARE_SNAPSHOT_VERSION)
    expect(parsed.project.name).toBe('我的裝修工程')
    expect(parsed.project.plannedStart).toBe('2026-01-05')

    // Success toast is shown.
    expect(screen.getByTestId('share-feedback')).toHaveTextContent('已複製唯讀分享連結')
  })

  it('shows an error toast when the clipboard API throws', async () => {
    const clipboard = vi.fn<(text: string) => Promise<void>>(async () => {
      throw new Error('瀏覽器拒絕寫入剪貼簿')
    })
    renderDashboard({ clipboard })

    const shareBtn = await screen.findByTestId('generate-share')
    fireEvent.click(shareBtn)

    await waitFor(() => {
      expect(screen.getByTestId('share-feedback')).toBeInTheDocument()
    })
    const feedback = screen.getByTestId('share-feedback')
    expect(feedback).toHaveAttribute('data-tone', 'error')
    expect(feedback.textContent).toMatch(/複製失敗/)
    // URL hash is still updated so the user can copy manually.
    expect(window.location.hash).toMatch(new RegExp(`#${SHARE_HASH_KEY}=`))
  })

  it('produces a snapshot whose decoded version matches the public contract', async () => {
    const clipboard = vi.fn<(text: string) => Promise<void>>(async () => undefined)
    renderDashboard({ clipboard })

    const shareBtn = await screen.findByTestId('generate-share')
    fireEvent.click(shareBtn)
    await waitFor(() => expect(clipboard).toHaveBeenCalled())

    // Pull the snapshot back through `buildShareSnapshot` to validate its shape.
    const url = clipboard.mock.calls[0]![0]
    const fragment = url.split('#')[1] ?? ''
    const encoded = fragment.split('&').find((p) => p.startsWith(`${SHARE_HASH_KEY}=`))!.slice(SHARE_HASH_KEY.length + 1)
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(encoded.length + (4 - (encoded.length % 4)) % 4, '=')
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)),
    )
    const snap = JSON.parse(json) as ShareSnapshot

    // The snapshot contract must include all the keys listed in SPEC §9.1.
    expect(snap).toHaveProperty('version')
    expect(snap).toHaveProperty('generatedAt')
    expect(snap).toHaveProperty('project')
    expect(snap).toHaveProperty('stages')
    expect(snap).toHaveProperty('stageSummary')
    expect(snap).toHaveProperty('gantt')
    expect(snap).toHaveProperty('photos')
    expect(snap).toHaveProperty('budgetSummary')
    expect(snap).toHaveProperty('scheduleSummary')
    expect(snap).toHaveProperty('warrantySummary')
  })
})

describe('AC-FR004-02 + AC-FR004-03 readonly rendering + content', () => {
  beforeEach(async () => {
    await resetIndexedDb()
    await putProject(seedProject)
  })

  function setValidShareHash(snapshot: ShareSnapshot) {
    const encoded = encodeShareSnapshot(snapshot)
    setHash(`${SHARE_HASH_KEY}=${encoded}`)
  }

  it('enters readonly mode when the URL has a valid share hash', async () => {
    const snapshot = buildShareSnapshot({
      project: seedProject,
      stages: [
        {
          id: 'stage-1',
          name: '拆除',
          order: 1,
          status: 'completed',
          plannedStart: '2026-01-05',
          plannedEnd: '2026-01-09',
        },
        {
          id: 'stage-2',
          name: '水電',
          order: 2,
          status: 'in_progress',
          plannedStart: '2026-01-10',
          plannedEnd: '2026-01-14',
        },
      ],
      stageSummary: { total: 2, completed: 1, inProgress: 1, blocked: 0, notStarted: 0, percentComplete: 50 },
      gantt: {
        totalDays: 33,
        days: [],
        rows: [
          { stageId: 'stage-1', name: '拆除', startIndex: 0, endIndex: 4, span: 5, withinWindow: true },
          { stageId: 'stage-2', name: '水電', startIndex: 5, endIndex: 9, span: 5, withinWindow: true },
        ],
      },
      photos: [
        {
          id: 'photo-1',
          kind: 'before',
          takenOn: '2026-01-04',
          fileName: 'before.png',
          mimeType: 'image/png',
        },
      ],
      budgetSummary: {
        total: 0,
        totalPlanned: 0,
        totalActual: 0,
        remaining: 0,
        isOverrun: false,
        totalOverrun: 0,
        overrunItemCount: 0,
        paymentCounts: { unpaid: 0, partial: 0, paid: 0 },
      },
    })
    setValidShareHash(snapshot)

    renderAppShell()
    await waitFor(() => expect(screen.getByTestId('readonly-banner')).toBeInTheDocument())

    // Banner + summary + stage rows visible.
    expect(screen.getByTestId('readonly-project-name')).toHaveTextContent('我的裝修工程')
    expect(screen.getByTestId('readonly-total-stages').textContent).toBe('2')
    expect(screen.getByTestId('readonly-completed-stages').textContent).toBe('1')
    expect(screen.getByTestId('readonly-percent-complete').textContent).toBe('50%')
    expect(screen.getByTestId('readonly-stage-row-stage-1')).toBeInTheDocument()
    expect(screen.getByTestId('readonly-stage-row-stage-2')).toBeInTheDocument()
    expect(screen.getByTestId('readonly-photo-list')).toBeInTheDocument()

    // No edit CTAs visible in readonly mode.
    expect(screen.queryByTestId('add-stage')).not.toBeInTheDocument()
    expect(screen.queryByTestId('add-stage-empty')).not.toBeInTheDocument()
    expect(screen.queryByTestId('add-photo')).not.toBeInTheDocument()
    expect(screen.queryByTestId('add-budget')).not.toBeInTheDocument()
    expect(screen.queryByTestId('generate-share')).not.toBeInTheDocument()
    // Stage edit / delete buttons are gone too.
    expect(screen.queryByRole('button', { name: /^編輯階段 / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^刪除階段 / })).not.toBeInTheDocument()
    // The status select must not be present.
    expect(screen.queryByLabelText('切換工程狀態')).not.toBeInTheDocument()

    const timelineLink = screen.getByRole('link', { name: '階段與工期' })
    const timelineHref = timelineLink.getAttribute('href')
    expect(timelineHref).toMatch(/^#share=[^&]+&timeline$/)

    // The section anchor must not discard the snapshot payload.
    setHash(timelineHref!.slice(1))
    act(() => window.dispatchEvent(new Event('hashchange')))
    await waitFor(() => expect(screen.getByTestId('readonly-banner')).toBeInTheDocument())
  })

  it('keeps ordinary section anchors in editable mode', async () => {
    setHash('timeline')

    render(<App />)
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())

    expect(screen.queryByTestId('readonly-error')).not.toBeInTheDocument()
    expect(document.body).not.toHaveClass('readonly')
    expect(screen.getByRole('link', { name: '階段與工期' })).toHaveAttribute('href', '#timeline')
  })

  it('keeps every documented section anchor in editable mode', async () => {
    const anchors = ['overview', 'timeline', 'budget', 'photos', 'warranties']
    for (const anchor of anchors) {
      cleanup()
      setHash(anchor)
      render(<App />)
      await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())
      expect(
        screen.queryByTestId('readonly-error'),
        `anchor ${anchor} must not trigger share-error mode`,
      ).not.toBeInTheDocument()
      expect(
        document.body.classList.contains('readonly'),
        `anchor ${anchor} must not add the readonly body class`,
      ).toBe(false)
    }
  })

  it('preserves the share payload on every readonly nav link', async () => {
    const snapshot = buildShareSnapshot({
      project: seedProject,
      stages: [
        {
          id: 'stage-1',
          name: '拆除',
          order: 1,
          status: 'completed',
          plannedStart: '2026-01-05',
          plannedEnd: '2026-01-09',
        },
      ],
      stageSummary: { total: 1, completed: 1, inProgress: 0, blocked: 0, notStarted: 0, percentComplete: 100 },
      gantt: {
        totalDays: 33,
        days: [],
        rows: [
          { stageId: 'stage-1', name: '拆除', startIndex: 0, endIndex: 4, span: 5, withinWindow: true },
        ],
      },
      photos: [],
      budgetSummary: {
        total: 0, totalPlanned: 0, totalActual: 0, remaining: 0,
        isOverrun: false, totalOverrun: 0, overrunItemCount: 0,
        paymentCounts: { unpaid: 0, partial: 0, paid: 0 },
      },
    })
    setValidShareHash(snapshot)

    renderAppShell()
    await waitFor(() => expect(screen.getByTestId('readonly-banner')).toBeInTheDocument())

    // Every nav link must start with `#share=...&<anchor>` so the snapshot
    // payload survives navigation between sections.
    const linkLabels = ['總覽', '階段與工期', '預算', '現場照片', '保固']
    const expectedAnchors = ['overview', 'timeline', 'budget', 'photos', 'warranties']
    for (let i = 0; i < linkLabels.length; i += 1) {
      const link = screen.getByRole('link', { name: linkLabels[i]! })
      const href = link.getAttribute('href') ?? ''
      expect(
        href,
        `${linkLabels[i]} link must start with #share= and end with &${expectedAnchors[i]}`,
      ).toMatch(new RegExp(`^#share=[^&]+&${expectedAnchors[i]}$`))
    }
  })

  it('stays in readonly mode when the hash already has a section anchor appended', async () => {
    const snapshot = buildShareSnapshot({
      project: seedProject,
      stages: [
        {
          id: 'stage-1',
          name: '拆除',
          order: 1,
          status: 'completed',
          plannedStart: '2026-01-05',
          plannedEnd: '2026-01-09',
        },
      ],
      stageSummary: { total: 1, completed: 1, inProgress: 0, blocked: 0, notStarted: 0, percentComplete: 100 },
      gantt: {
        totalDays: 33,
        days: [],
        rows: [
          { stageId: 'stage-1', name: '拆除', startIndex: 0, endIndex: 4, span: 5, withinWindow: true },
        ],
      },
      photos: [],
      budgetSummary: {
        total: 0, totalPlanned: 0, totalActual: 0, remaining: 0,
        isOverrun: false, totalOverrun: 0, overrunItemCount: 0,
        paymentCounts: { unpaid: 0, partial: 0, paid: 0 },
      },
    })
    // Open the URL with the share payload AND a section anchor already
    // appended — e.g. the user followed a nav link from another readonly
    // session.
    const encoded = encodeShareSnapshot(snapshot)
    setHash(`${SHARE_HASH_KEY}=${encoded}&budget`)

    renderAppShell()
    await waitFor(() => expect(screen.getByTestId('readonly-banner')).toBeInTheDocument())
    // No share-error state.
    expect(screen.queryByTestId('readonly-error')).not.toBeInTheDocument()
    // Body must carry the readonly class so CSS-driven hiding still works.
    expect(document.body).toHaveClass('readonly')
  })

  it('malformed share hashes still show the friendly error, not the editable dashboard', async () => {
    // A hash with `share=` but a garbage payload must NOT be treated as a
    // section anchor — it must still produce the share-error state.
    setHash(`${SHARE_HASH_KEY}=@@@@@@`)

    renderAppShell()
    await waitFor(() => expect(screen.getByTestId('readonly-error')).toBeInTheDocument())
    expect(screen.queryByTestId('project-name')).not.toBeInTheDocument()
    expect(screen.queryByTestId('readonly-banner')).not.toBeInTheDocument()
    expect(document.body).toHaveClass('readonly')
  })

  it('does NOT load or write IndexedDB while in readonly mode (AC-FR004-02)', async () => {
    const snapshot = buildShareSnapshot({
      project: seedProject,
      stages: [],
      stageSummary: { total: 0, completed: 0, inProgress: 0, blocked: 0, notStarted: 0, percentComplete: 0 },
      gantt: { totalDays: 33, days: [], rows: [] },
      photos: [],
      budgetSummary: {
        total: 0,
        totalPlanned: 0,
        totalActual: 0,
        remaining: 0,
        isOverrun: false,
        totalOverrun: 0,
        overrunItemCount: 0,
        paymentCounts: { unpaid: 0, partial: 0, paid: 0 },
      },
    })
    setValidShareHash(snapshot)

    renderAppShell()
    await waitFor(() => expect(screen.getByTestId('readonly-banner')).toBeInTheDocument())

    // Snapshots of IndexedDB before any user gesture — must be untouched.
    const projectsBefore = await getAllProjects()
    const stagesBefore = await getAllStages()
    const photosBefore = await getAllPhotos()
    const budgetsBefore = await getAllBudgets()

    // Wait a tick — anything that might write to IDB would do it now.
    await new Promise((r) => setTimeout(r, 0))
    expect(await getAllProjects()).toEqual(projectsBefore)
    expect(await getAllStages()).toEqual(stagesBefore)
    expect(await getAllPhotos()).toEqual(photosBefore)
    expect(await getAllBudgets()).toEqual(budgetsBefore)
  })

  it('shows a friendly error state for an invalid share hash (AC-FR004-03)', async () => {
    setHash(`${SHARE_HASH_KEY}=@@@@@@`)

    renderAppShell()
    await waitFor(() => expect(screen.getByTestId('readonly-error')).toBeInTheDocument())

    const error = screen.getByTestId('readonly-error')
    const message = within(error).getByTestId('readonly-error-message')
    expect(message.textContent).toMatch(/無法解析/)
    // The IndexedDB write surface was not touched.
    expect(screen.queryByTestId('add-stage')).not.toBeInTheDocument()
    expect(screen.queryByTestId('generate-share')).not.toBeInTheDocument()
  })

  it('shows a friendly error state for an unknown snapshot version', async () => {
    const encoded = encodeShareSnapshot({
      ...buildShareSnapshot({
        project: seedProject,
        stages: [],
        stageSummary: { total: 0, completed: 0, inProgress: 0, blocked: 0, notStarted: 0, percentComplete: 0 },
        gantt: { totalDays: 33, days: [], rows: [] },
        photos: [],
        budgetSummary: {
          total: 0,
          totalPlanned: 0,
          totalActual: 0,
          remaining: 0,
          isOverrun: false,
          totalOverrun: 0,
          overrunItemCount: 0,
          paymentCounts: { unpaid: 0, partial: 0, paid: 0 },
        },
      }),
      version: 999 as unknown as 1,
    })
    setHash(`${SHARE_HASH_KEY}=${encoded}`)

    renderAppShell()
    await waitFor(() => expect(screen.getByTestId('readonly-error')).toBeInTheDocument())
    const message = within(screen.getByTestId('readonly-error')).getByTestId('readonly-error-message')
    expect(message.textContent).toMatch(/不支援的分享版本/)
  })

  it('returns to the editable dashboard when the user clears the hash from the error state', async () => {
    setHash(`${SHARE_HASH_KEY}=@@not-base64@@`)
    renderAppShell()
    await waitFor(() => expect(screen.getByTestId('readonly-error')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('readonly-error-clear'))
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())
    expect(screen.queryByTestId('readonly-error')).not.toBeInTheDocument()
  })
})

describe('AC-FR004-04 readonly snapshot round-trip via the URL hash', () => {
  beforeEach(async () => {
    await resetIndexedDb()
    // Seed both a project and at least one stage so the snapshot has rows to
    // render in the readonly gantt.
    await putProject(seedProject)
    const { putStage } = await import('../db')
    await putStage({
      id: 'stage-1',
      projectId: seedProject.id,
      name: '拆除',
      order: 1,
      status: 'in_progress',
      plannedStart: '2026-01-05',
      plannedEnd: '2026-01-09',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('snapshot encoded on the editable side reopens identically on the readonly side', async () => {
    const clipboard = vi.fn<(text: string) => Promise<void>>(async () => undefined)
    setHash('')
    const first = renderDashboard({ clipboard })
    const shareBtn = await screen.findByTestId('generate-share')
    fireEvent.click(shareBtn)
    await waitFor(() => expect(clipboard).toHaveBeenCalled())
    const url = clipboard.mock.calls[0]![0]

    // Tear down the editable dashboard and load the snapshot URL.
    cleanup()
    first.unmount()
    window.history.replaceState(null, '', url)

    const second = renderAppShell()
    await waitFor(() => expect(screen.getByTestId('readonly-banner')).toBeInTheDocument())

    expect(screen.getByTestId('readonly-project-name').textContent).toBe(seedProject.name)
    // The gantt rows for the seed project must render with the same ids.
    const ganttRows = document.querySelectorAll('[data-testid^="readonly-gantt-row-"]')
    expect(ganttRows.length).toBeGreaterThan(0)
    // We never visited the editable view in the second mount — no write
    // surface was created.
    expect(screen.queryByTestId('generate-share')).not.toBeInTheDocument()
    second.unmount()
  })
})

// FR-004 acceptance retry — SPEC §9.1 forbids leaking IndexedDB keys into
// the share URL. The tests below prove the round-trip drops the source
// `Stage.id` / `PhotoRecord.id` and substitutes snapshot-local references
// (`stage-N`, `photo-N`) assigned by display order.
describe('FR-004 IndexedDB-key leakage guard', () => {
  beforeEach(async () => {
    await resetIndexedDb()
    await putProject(seedProject)
  })

  // Realistic IndexedDB-shaped keys so the test would fail if any leakage
  // slipped through (a single-character coincidence would be very unlikely).
  const IDB_PROJECT_ID = 'idb-project-9c5a-AAAA-BBBB-CCCC-DDDD-EEEE'
  const IDB_STAGE_A = 'idb-stage-7d3f-1111-2222-3333-4444-5555'
  const IDB_STAGE_B = 'idb-stage-8e2a-6666-7777-8888-9999-AAAA'
  const IDB_PHOTO_1 = 'idb-photo-4b1c-BBBB-CCCC-DDDD-EEEE-FFFF'
  const IDB_PHOTO_2 = 'idb-photo-5a9b-1111-AAAA-BBBB-CCCC-DDDD'

  async function seedIdbShapedData() {
    await putProject({ ...seedProject, id: IDB_PROJECT_ID })
    const { putStage, putPhoto } = await import('../db')
    await putStage({
      id: IDB_STAGE_A,
      projectId: IDB_PROJECT_ID,
      name: '拆除',
      order: 1,
      status: 'in_progress',
      plannedStart: '2026-01-05',
      plannedEnd: '2026-01-09',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await putStage({
      id: IDB_STAGE_B,
      projectId: IDB_PROJECT_ID,
      name: '水電',
      order: 2,
      status: 'not_started',
      plannedStart: '2026-01-10',
      plannedEnd: '2026-01-14',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    // PhotoRecord requires a Blob — fake-indexeddb accepts any Blob.
    await putPhoto({
      id: IDB_PHOTO_1,
      projectId: IDB_PROJECT_ID,
      stageId: IDB_STAGE_A,
      kind: 'before',
      caption: '施工前',
      takenOn: '2026-01-04',
      fileName: 'before.png',
      mimeType: 'image/png',
      blob: new Blob(['fake'], { type: 'image/png' }),
      createdAt: '2026-01-04T00:00:00.000Z',
    })
    await putPhoto({
      id: IDB_PHOTO_2,
      projectId: IDB_PROJECT_ID,
      stageId: IDB_STAGE_B,
      kind: 'progress',
      caption: '進場中',
      takenOn: '2026-01-12',
      fileName: 'wiring.jpg',
      mimeType: 'image/jpeg',
      blob: new Blob(['fake'], { type: 'image/jpeg' }),
      createdAt: '2026-01-12T00:00:00.000Z',
    })
  }

  it('encoded share URL does NOT contain any source IndexedDB key', async () => {
    await seedIdbShapedData()
    const clipboard = vi.fn<(text: string) => Promise<void>>(async () => undefined)
    setHash('')
    renderDashboard({ clipboard })

    const shareBtn = await screen.findByTestId('generate-share')
    fireEvent.click(shareBtn)
    await waitFor(() => expect(clipboard).toHaveBeenCalled())
    const url = clipboard.mock.calls[0]![0]

    // The full URL (hash + everything) must not contain any source key.
    expect(url).not.toContain(IDB_PROJECT_ID)
    expect(url).not.toContain(IDB_STAGE_A)
    expect(url).not.toContain(IDB_STAGE_B)
    expect(url).not.toContain(IDB_PHOTO_1)
    expect(url).not.toContain(IDB_PHOTO_2)

    // Decode the URL and inspect the decoded JSON to confirm none of the
    // source keys survive even at the snapshot level (not just in the
    // hash-encoded form).
    const fragment = url.split('#')[1] ?? ''
    const encoded = fragment
      .split('&')
      .find((p) => p.startsWith(`${SHARE_HASH_KEY}=`))!
      .slice(SHARE_HASH_KEY.length + 1)
    const padded = encoded
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(encoded.length + (4 - (encoded.length % 4)) % 4, '=')
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)),
    )
    const parsed = JSON.parse(json) as ShareSnapshot
    expect(JSON.stringify(parsed)).not.toContain(IDB_PROJECT_ID)
    expect(JSON.stringify(parsed)).not.toContain(IDB_STAGE_A)
    expect(JSON.stringify(parsed)).not.toContain(IDB_STAGE_B)
    expect(JSON.stringify(parsed)).not.toContain(IDB_PHOTO_1)
    expect(JSON.stringify(parsed)).not.toContain(IDB_PHOTO_2)

    // Instead the snapshot should carry snapshot-local refs only.
    expect(parsed.stages.map((s) => s.id)).toEqual(['stage-1', 'stage-2'])
    expect(parsed.photos.map((p) => p.id)).toEqual(['photo-1', 'photo-2'])
    expect(parsed.gantt.rows.map((r) => r.stageId)).toEqual(['stage-1', 'stage-2'])
  })

  it('readonly view renders stages + photos correctly using snapshot-local refs', async () => {
    await seedIdbShapedData()
    const clipboard = vi.fn<(text: string) => Promise<void>>(async () => undefined)
    setHash('')
    const first = renderDashboard({ clipboard })

    const shareBtn = await screen.findByTestId('generate-share')
    fireEvent.click(shareBtn)
    await waitFor(() => expect(clipboard).toHaveBeenCalled())
    const url = clipboard.mock.calls[0]![0]

    // Tear down the editable dashboard and load the snapshot URL.
    cleanup()
    first.unmount()
    window.history.replaceState(null, '', url)

    renderAppShell()
    await waitFor(() => expect(screen.getByTestId('readonly-banner')).toBeInTheDocument())

    // The readonly gantt must render both rows under snapshot-local ids.
    expect(screen.getByTestId('readonly-stage-row-stage-1')).toBeInTheDocument()
    expect(screen.getByTestId('readonly-stage-row-stage-2')).toBeInTheDocument()
    expect(screen.getByTestId('readonly-gantt-row-stage-1')).toBeInTheDocument()
    expect(screen.getByTestId('readonly-gantt-row-stage-2')).toBeInTheDocument()

    // Photos render under snapshot-local photo ids.
    expect(screen.getByTestId('readonly-photo-photo-1')).toBeInTheDocument()
    expect(screen.getByTestId('readonly-photo-photo-2')).toBeInTheDocument()

    // No source key should appear anywhere in the rendered DOM.
    const html = document.body.innerHTML
    expect(html).not.toContain(IDB_PROJECT_ID)
    expect(html).not.toContain(IDB_STAGE_A)
    expect(html).not.toContain(IDB_STAGE_B)
    expect(html).not.toContain(IDB_PHOTO_1)
    expect(html).not.toContain(IDB_PHOTO_2)

    // And the IndexedDB remains untouched by the readonly view.
    const projectsAfter = await getAllProjects()
    const stagesAfter = await getAllStages()
    const photosAfter = await getAllPhotos()
    expect(projectsAfter.map((p) => p.id)).toContain(IDB_PROJECT_ID)
    expect(stagesAfter.map((s) => s.id)).toEqual(expect.arrayContaining([IDB_STAGE_A, IDB_STAGE_B]))
    expect(photosAfter.map((p) => p.id)).toEqual(expect.arrayContaining([IDB_PHOTO_1, IDB_PHOTO_2]))
  })
})

// FR-004 read-only guarantee (SPEC §9.1): a share URL must NEVER cause the
// DashboardProvider to mount on first render, because that would trigger
// a read of IndexedDB via the load effect. AppShell makes the share-vs-
// editable decision synchronously on first render — these tests prove
// that promise by spying on the underlying db exports.
describe('FR-004 AppShell does NOT touch IndexedDB on share-mode first render', () => {
  beforeEach(async () => {
    await resetIndexedDb()
    await putProject(seedProject)
  })

  function installSpyOnDbReads() {
    const projectsSpy = vi.spyOn(dbModule, 'getAllProjects')
    const stagesSpy = vi.spyOn(dbModule, 'getAllStages')
    const photosSpy = vi.spyOn(dbModule, 'getAllPhotos')
    const budgetsSpy = vi.spyOn(dbModule, 'getAllBudgets')
    return { projectsSpy, stagesSpy, photosSpy, budgetsSpy }
  }

  it('valid share hash never calls getAllProjects/Stages/Photos/Budgets', async () => {
    const snapshot = buildShareSnapshot({
      project: seedProject,
      stages: [],
      stageSummary: { total: 0, completed: 0, inProgress: 0, blocked: 0, notStarted: 0, percentComplete: 0 },
      gantt: { totalDays: 33, days: [], rows: [] },
      photos: [],
      budgetSummary: {
        total: 0,
        totalPlanned: 0,
        totalActual: 0,
        remaining: 0,
        isOverrun: false,
        totalOverrun: 0,
        overrunItemCount: 0,
        paymentCounts: { unpaid: 0, partial: 0, paid: 0 },
      },
    })
    setHash(`${SHARE_HASH_KEY}=${encodeShareSnapshot(snapshot)}`)

    const { projectsSpy, stagesSpy, photosSpy, budgetsSpy } = installSpyOnDbReads()

    renderAppShell()
    await waitFor(() => expect(screen.getByTestId('readonly-banner')).toBeInTheDocument())

    // A short delay to make sure any deferred effect that might call the
    // db has run. Wait a tick.
    await new Promise((r) => setTimeout(r, 0))

    expect(projectsSpy).not.toHaveBeenCalled()
    expect(stagesSpy).not.toHaveBeenCalled()
    expect(photosSpy).not.toHaveBeenCalled()
    expect(budgetsSpy).not.toHaveBeenCalled()
  })

  it('invalid share hash never calls getAllProjects/Stages/Photos/Budgets', async () => {
    setHash(`${SHARE_HASH_KEY}=@@@@@@`)
    const { projectsSpy, stagesSpy, photosSpy, budgetsSpy } = installSpyOnDbReads()

    renderAppShell()
    await waitFor(() => expect(screen.getByTestId('readonly-error')).toBeInTheDocument())

    await new Promise((r) => setTimeout(r, 0))

    expect(projectsSpy).not.toHaveBeenCalled()
    expect(stagesSpy).not.toHaveBeenCalled()
    expect(photosSpy).not.toHaveBeenCalled()
    expect(budgetsSpy).not.toHaveBeenCalled()
  })

  it('hashchange from share back to editable mounts the DashboardProvider + Dashboard', async () => {
    // Start in share mode so AppShell renders ReadOnlyView on first render.
    const snapshot = buildShareSnapshot({
      project: seedProject,
      stages: [],
      stageSummary: { total: 0, completed: 0, inProgress: 0, blocked: 0, notStarted: 0, percentComplete: 0 },
      gantt: { totalDays: 33, days: [], rows: [] },
      photos: [],
      budgetSummary: {
        total: 0,
        totalPlanned: 0,
        totalActual: 0,
        remaining: 0,
        isOverrun: false,
        totalOverrun: 0,
        overrunItemCount: 0,
        paymentCounts: { unpaid: 0, partial: 0, paid: 0 },
      },
    })
    setHash(`${SHARE_HASH_KEY}=${encodeShareSnapshot(snapshot)}`)

    const { projectsSpy, stagesSpy, photosSpy, budgetsSpy } = installSpyOnDbReads()

    renderAppShell()
    await waitFor(() => expect(screen.getByTestId('readonly-banner')).toBeInTheDocument())

    // Read-only surface never touched the db.
    expect(projectsSpy).not.toHaveBeenCalled()
    expect(stagesSpy).not.toHaveBeenCalled()
    expect(photosSpy).not.toHaveBeenCalled()
    expect(budgetsSpy).not.toHaveBeenCalled()

    // Now clear the hash — AppShell must react via the hashchange listener,
    // UNMOUNT the read-only view, and MOUNT DashboardProvider+Dashboard.
    // We spy FIRST so we observe the post-transition calls only.
    const projectsSpyAfter = vi.spyOn(dbModule, 'getAllProjects')
    const stagesSpyAfter = vi.spyOn(dbModule, 'getAllStages')
    const photosSpyAfter = vi.spyOn(dbModule, 'getAllPhotos')
    const budgetsSpyAfter = vi.spyOn(dbModule, 'getAllBudgets')

    setHash('')
    // Dispatch inside act() so the state update triggered by AppShell's
    // hashchange listener is flushed synchronously and React does not warn
    // about an unwrapped update.
    await act(async () => {
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })

    // The editable surface eventually loads — give the provider's effect
    // a chance to call the db.
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())
    expect(projectsSpyAfter).toHaveBeenCalled()
    expect(stagesSpyAfter).toHaveBeenCalled()
    expect(photosSpyAfter).toHaveBeenCalled()
    expect(budgetsSpyAfter).toHaveBeenCalled()
  })

  it('hashchange from editable back to share unmounts the DashboardProvider', async () => {
    // Start with no hash — AppShell mounts DashboardProvider+Dashboard.
    setHash('')
    renderAppShell()
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())

    // Install spies AFTER the editable mount so we only see what the
    // share-mode transition does (which should be: nothing).
    const { projectsSpy, stagesSpy, photosSpy, budgetsSpy } = installSpyOnDbReads()

    // Switch to share mode.
    const snapshot = buildShareSnapshot({
      project: seedProject,
      stages: [],
      stageSummary: { total: 0, completed: 0, inProgress: 0, blocked: 0, notStarted: 0, percentComplete: 0 },
      gantt: { totalDays: 33, days: [], rows: [] },
      photos: [],
      budgetSummary: {
        total: 0,
        totalPlanned: 0,
        totalActual: 0,
        remaining: 0,
        isOverrun: false,
        totalOverrun: 0,
        overrunItemCount: 0,
        paymentCounts: { unpaid: 0, partial: 0, paid: 0 },
      },
    })
    setHash(`${SHARE_HASH_KEY}=${encodeShareSnapshot(snapshot)}`)
    await act(async () => {
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })

    await waitFor(() => expect(screen.getByTestId('readonly-banner')).toBeInTheDocument())

    await new Promise((r) => setTimeout(r, 0))

    // The dashboard provider was unmounted (it was the only consumer of
    // these db reads), so no further db calls happen after the transition.
    expect(projectsSpy).not.toHaveBeenCalled()
    expect(stagesSpy).not.toHaveBeenCalled()
    expect(photosSpy).not.toHaveBeenCalled()
    expect(budgetsSpy).not.toHaveBeenCalled()
  })
})

// ───────────────────────── M1 / GOAL AC-005 ─────────────────────────
// Share dialog: personal data is opt-in and the "unencrypted / cannot be
// revoked" warning is shown. Read-only page: new M1 sections render and no
// editing control exists.

describe('AC-005 owner share link — privacy opt-in and M1 sections', () => {
  const FAKE_ADDRESS = '測試市示範路 1 號'
  const FAKE_PHONE = '0900-000-000'
  const FAKE_CONTACT = 'demo@example.com'

  const stageDone = {
    id: 'idb-stage-key-AAA',
    projectId: seedProject.id,
    name: '拆除',
    order: 1,
    status: 'completed' as const,
    plannedStart: '2026-01-05',
    plannedEnd: '2026-01-09',
    actualStart: '2026-01-05',
    actualEnd: '2026-01-09',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
  const stageOpen = {
    id: 'idb-stage-key-BBB',
    projectId: seedProject.id,
    name: '水電',
    order: 2,
    status: 'in_progress' as const,
    plannedStart: '2026-01-12',
    plannedEnd: '2026-01-23',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }

  /** Seed one record of every M1 kind, using obviously fake data only. */
  async function seedM1Data() {
    await dbModule.putStage(stageDone)
    await dbModule.putStage(stageOpen)
    await dbModule.putPhoto({
      id: 'idb-photo-key-1',
      projectId: seedProject.id,
      stageId: stageDone.id,
      kind: 'progress',
      takenOn: '2026-01-08',
      fileName: 'demo-a.png',
      mimeType: 'image/png',
      blob: new Blob([new Uint8Array([1])], { type: 'image/png' }),
      createdAt: '2026-01-08T00:00:00.000Z',
    })
    await dbModule.putPhoto({
      id: 'idb-photo-key-2',
      projectId: seedProject.id,
      kind: 'before',
      takenOn: '2026-01-03',
      fileName: 'demo-b.png',
      mimeType: 'image/png',
      blob: new Blob([new Uint8Array([2])], { type: 'image/png' }),
      createdAt: '2026-01-03T00:00:00.000Z',
    })
    await dbModule.putContract({
      projectId: seedProject.id,
      contractAmount: 1000000,
      receivedAmount: 400000,
      updatedAt: '2026-01-10T00:00:00.000Z',
    })
    await dbModule.putChangeOrder({
      id: 'idb-change-key-1',
      projectId: seedProject.id,
      title: '示範追加：增加插座',
      amount: 12000,
      material: '示範材料',
      note: '示範內部備註',
      status: 'approved',
      decidedOn: '2026-01-18',
      createdAt: '2026-01-10T00:00:00.000Z',
      updatedAt: '2026-01-18T00:00:00.000Z',
    })
    await dbModule.putChangeOrder({
      id: 'idb-change-key-2',
      projectId: seedProject.id,
      title: '示範追減：取消層板',
      amount: -3000,
      status: 'pending',
      createdAt: '2026-01-11T00:00:00.000Z',
      updatedAt: '2026-01-11T00:00:00.000Z',
    })
    await dbModule.putAcceptanceItem({
      id: 'idb-acc-key-1',
      projectId: seedProject.id,
      stageId: stageDone.id,
      name: '示範驗收：垃圾清運',
      passed: true,
      checkedOn: '2026-01-09',
      createdAt: '2026-01-09T00:00:00.000Z',
      updatedAt: '2026-01-09T00:00:00.000Z',
    })
    await dbModule.putAcceptanceItem({
      id: 'idb-acc-key-2',
      projectId: seedProject.id,
      stageId: stageDone.id,
      name: '示範驗收：管線保護',
      passed: false,
      createdAt: '2026-01-09T01:00:00.000Z',
      updatedAt: '2026-01-09T01:00:00.000Z',
    })
    await dbModule.putSchedule({
      id: 'idb-schedule-key-1',
      projectId: seedProject.id,
      workerName: '示範水電師傅',
      phone: FAKE_PHONE,
      startOn: '2026-01-12',
      endOn: '2026-01-23',
      completed: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await dbModule.putWarranty({
      id: 'idb-warranty-key-1',
      projectId: seedProject.id,
      itemName: '示範保固項目',
      provider: '示範廠商',
      contact: FAKE_CONTACT,
      startsOn: '2026-01-01',
      endsOn: '2027-01-01',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
  }

  function snapshotFromUrl(url: string): ShareSnapshot {
    const fragment = url.split('#')[1] ?? ''
    const encoded = fragment
      .split('&')
      .find((p) => p.startsWith(`${SHARE_HASH_KEY}=`))!
      .slice(SHARE_HASH_KEY.length + 1)
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json = new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)))
    return JSON.parse(json) as ShareSnapshot
  }

  function dialogUrl(): string {
    return (screen.getByTestId('share-dialog-url') as HTMLInputElement).value
  }

  beforeEach(async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    setHash('')
  })

  it('AC-005: the share dialog starts with both personal-data boxes unticked and shows the warning', async () => {
    await seedM1Data()
    const clipboard = vi.fn<(text: string) => Promise<void>>(async () => undefined)
    renderDashboard({ clipboard })
    fireEvent.click(await screen.findByTestId('generate-share'))
    await waitFor(() => expect(screen.getByTestId('share-dialog')).toBeInTheDocument())

    expect(screen.getByTestId('share-include-address')).not.toBeChecked()
    expect(screen.getByTestId('share-include-contacts')).not.toBeChecked()
    expect(screen.getByLabelText('包含工程地址')).toBe(screen.getByTestId('share-include-address'))
    expect(screen.getByLabelText('包含聯絡方式（工班電話、保固聯絡方式）')).toBe(
      screen.getByTestId('share-include-contacts'),
    )
    const warning = screen.getByTestId('share-dialog-warning')
    expect(warning).toHaveTextContent('連結未加密')
    expect(warning).toHaveTextContent('無法撤銷')
    expect(screen.getByTestId('share-facts-change-order-count')).toHaveTextContent('2 筆')
    expect(screen.getByTestId('share-facts-acceptance')).toHaveTextContent('驗收 1/2')
  })

  it('AC-005: by default the generated and auto-copied link has no address or contact details', async () => {
    await seedM1Data()
    const clipboard = vi.fn<(text: string) => Promise<void>>(async () => undefined)
    renderDashboard({ clipboard })
    fireEvent.click(await screen.findByTestId('generate-share'))
    await waitFor(() => expect(clipboard).toHaveBeenCalledTimes(1))

    const copied = clipboard.mock.calls[0]![0]
    expect(copied).toBe(dialogUrl())
    const snapshot = snapshotFromUrl(copied)
    const json = JSON.stringify(snapshot)
    expect(json).not.toContain(FAKE_ADDRESS)
    expect(json).not.toContain(FAKE_PHONE)
    expect(json).not.toContain(FAKE_CONTACT)
    expect(snapshot.project.address).toBeUndefined()
    expect(snapshot.warranties![0]!.contact).toBeUndefined()
    expect(snapshot.scheduleContacts).toBeUndefined()
    expect(snapshot.privacy).toEqual({ includesAddress: false, includesContacts: false })
    // The M1 sections are there.
    expect(snapshot.changeOrders).toHaveLength(2)
    expect(snapshot.contractSummary?.adjustedTotal).toBe(1012000)
    expect(snapshot.acceptanceSummary).toMatchObject({ total: 2, passed: 1 })
    expect(snapshot.photoReport?.stages).toEqual([
      { stageId: 'stage-1', count: 1, latestTakenOn: '2026-01-08' },
    ])
    expect(snapshot.photoReport?.unassigned).toEqual({ count: 1, latestTakenOn: '2026-01-03' })
    // No IndexedDB key, no Blob, no internal change-order detail.
    expect(json).not.toMatch(/idb-[a-z]+-key/)
    expect(json).not.toMatch(/blob/i)
    expect(json).not.toContain('示範材料')
    expect(json).not.toContain('示範內部備註')
  })

  it('AC-005: ticking 「包含工程地址」 puts the address — and only the address — into the link', async () => {
    await seedM1Data()
    const clipboard = vi.fn<(text: string) => Promise<void>>(async () => undefined)
    renderDashboard({ clipboard })
    fireEvent.click(await screen.findByTestId('generate-share'))
    await waitFor(() => expect(clipboard).toHaveBeenCalledTimes(1))
    const before = dialogUrl()

    fireEvent.click(screen.getByTestId('share-include-address'))
    await waitFor(() => expect(dialogUrl()).not.toBe(before))
    expect(screen.getByTestId('share-include-address')).toBeChecked()
    const snapshot = snapshotFromUrl(dialogUrl())
    expect(snapshot.project.address).toBe(FAKE_ADDRESS)
    expect(snapshot.privacy).toEqual({ includesAddress: true, includesContacts: false })
    expect(JSON.stringify(snapshot)).not.toContain(FAKE_PHONE)
    expect(JSON.stringify(snapshot)).not.toContain(FAKE_CONTACT)
    expect(window.location.hash).toBe(`#${dialogUrl().split('#')[1]}`)
    // A link with personal data is never copied automatically.
    expect(clipboard).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('share-dialog-copy'))
    await waitFor(() => expect(clipboard).toHaveBeenCalledTimes(2))
    expect(clipboard.mock.calls[1]![0]).toBe(dialogUrl())

    // Unticking removes it again.
    fireEvent.click(screen.getByTestId('share-include-address'))
    await waitFor(() =>
      expect(snapshotFromUrl(dialogUrl()).project.address).toBeUndefined(),
    )
  })

  it('AC-005: ticking 「包含聯絡方式」 adds worker phones and warranty contacts to the link', async () => {
    await seedM1Data()
    const clipboard = vi.fn<(text: string) => Promise<void>>(async () => undefined)
    renderDashboard({ clipboard })
    fireEvent.click(await screen.findByTestId('generate-share'))
    await waitFor(() => expect(clipboard).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByTestId('share-include-contacts'))
    await waitFor(() =>
      expect(snapshotFromUrl(dialogUrl()).privacy?.includesContacts).toBe(true),
    )
    const snapshot = snapshotFromUrl(dialogUrl())
    expect(snapshot.scheduleContacts).toEqual([
      { id: 'schedule-1', workerName: '示範水電師傅', phone: FAKE_PHONE },
    ])
    expect(snapshot.warranties![0]!.contact).toBe(FAKE_CONTACT)
    expect(snapshot.project.address).toBeUndefined()
    expect(JSON.stringify(snapshot)).not.toMatch(/idb-[a-z]+-key/)
  })

  it('AC-005: reopening the dialog resets both boxes to unticked', async () => {
    await seedM1Data()
    const clipboard = vi.fn<(text: string) => Promise<void>>(async () => undefined)
    renderDashboard({ clipboard })
    fireEvent.click(await screen.findByTestId('generate-share'))
    await waitFor(() => expect(screen.getByTestId('share-dialog')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('share-include-address'))
    fireEvent.click(screen.getByTestId('share-include-contacts'))
    await waitFor(() => expect(screen.getByTestId('share-include-contacts')).toBeChecked())
    fireEvent.click(screen.getByTestId('share-dialog-close'))
    await waitFor(() => expect(screen.queryByTestId('share-dialog')).not.toBeInTheDocument())

    fireEvent.click(screen.getByTestId('generate-share'))
    await waitFor(() => expect(screen.getByTestId('share-dialog')).toBeInTheDocument())
    expect(screen.getByTestId('share-include-address')).not.toBeChecked()
    expect(screen.getByTestId('share-include-contacts')).not.toBeChecked()
    const snapshot = snapshotFromUrl(dialogUrl())
    expect(snapshot.project.address).toBeUndefined()
    expect(snapshot.scheduleContacts).toBeUndefined()
  })

  it('AC-005: the address box is disabled when the project has no address', async () => {
    await resetIndexedDb()
    const { address: _address, ...withoutAddress } = seedProject
    void _address
    await putProject(withoutAddress)
    renderDashboard({ clipboard: vi.fn(async () => undefined) })
    fireEvent.click(await screen.findByTestId('generate-share'))
    await waitFor(() => expect(screen.getByTestId('share-dialog')).toBeInTheDocument())
    expect(screen.getByTestId('share-include-address')).toBeDisabled()
    expect(screen.getByTestId('share-privacy')).toHaveTextContent('本工程未填寫地址')
  })

  it('AC-005: the read-only page shows the M1 sections and has no editing control', async () => {
    await seedM1Data()
    const clipboard = vi.fn<(text: string) => Promise<void>>(async () => undefined)
    renderDashboard({ clipboard })
    fireEvent.click(await screen.findByTestId('generate-share'))
    await waitFor(() => expect(clipboard).toHaveBeenCalledTimes(1))
    const url = clipboard.mock.calls[0]![0]
    cleanup()

    // Open the link the way a homeowner would: only the URL, no local data.
    await resetIndexedDb()
    setHash(url.split('#')[1]!)
    renderAppShell()
    await waitFor(() => expect(screen.getByTestId('readonly-banner')).toBeInTheDocument())

    // Contract & receipts summary.
    const contract = screen.getByTestId('readonly-contract-summary')
    for (const label of ['原合約', '已核准變更合計', '調整後總額', '已收', '待收']) {
      expect(within(contract).getByText(label)).toBeInTheDocument()
    }
    expect(contract).toHaveTextContent(/1,?012,?000/)
    expect(contract).toHaveTextContent(/612,?000/)
    // Change orders: title, amount, status + the local-record notice.
    const orders = screen.getByTestId('readonly-change-order-list')
    expect(within(orders).getByText('示範追加：增加插座')).toBeInTheDocument()
    expect(within(orders).getByText('已核准')).toBeInTheDocument()
    expect(within(orders).getByText('待決定')).toBeInTheDocument()
    expect(orders).toHaveTextContent(/追加 \+12,?000/)
    expect(orders).toHaveTextContent(/追減 -3,?000/)
    expect(screen.getByTestId('readonly-change-order-notice')).toHaveTextContent(
      '本機紀錄，非屋主線上簽核',
    )
    // Acceptance progress.
    expect(screen.getByTestId('readonly-acceptance-summary')).toHaveTextContent('驗收 1/2')
    expect(screen.getByTestId('readonly-acceptance-stage-1')).toHaveTextContent('拆除')
    expect(screen.getByTestId('readonly-acceptance-stage-1')).toHaveTextContent(
      '階段已標記完成，但仍有 1 項驗收未通過',
    )
    // Photo progress report: count + latest date per stage, 未分類, empty stage.
    expect(screen.getByTestId('readonly-photo-report-stage-1')).toHaveTextContent('1 張')
    expect(screen.getByTestId('readonly-photo-report-stage-1')).toHaveTextContent(
      '最新拍攝日：2026-01-08',
    )
    expect(screen.getByTestId('readonly-photo-report-stage-2')).toHaveTextContent('尚無照片')
    expect(screen.getByTestId('readonly-photo-report-unassigned')).toHaveTextContent('未分類')
    expect(screen.getByTestId('readonly-photo-report-note')).toHaveTextContent(
      '照片原圖僅存於業者裝置，雲端照片分享規劃於後續版本',
    )
    // Privacy note; nothing personal is on the page.
    expect(screen.getByTestId('readonly-privacy-note')).toHaveTextContent('連結未加密、無法撤銷')
    expect(screen.getByTestId('readonly-privacy-note')).toHaveTextContent(
      '此快照不含工程地址與聯絡方式',
    )
    expect(screen.queryByTestId('readonly-project-address')).not.toBeInTheDocument()
    expect(screen.queryByTestId('readonly-schedule-contacts')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain(FAKE_ADDRESS)
    expect(document.body.textContent).not.toContain(FAKE_PHONE)
    expect(document.body.textContent).not.toContain(FAKE_CONTACT)

    // Read-only: no button, form field or M1 editing control anywhere.
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
    for (const id of [
      'add-change-order',
      'edit-contract',
      'open-help',
      'generate-share',
      'add-acceptance-stage-1',
    ]) {
      expect(screen.queryByTestId(id)).not.toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: /核准|拒絕|編輯|刪除|新增/ })).not.toBeInTheDocument()
  })

  it('AC-005: an opted-in link shows the address and contact details on the read-only page', async () => {
    await seedM1Data()
    const clipboard = vi.fn<(text: string) => Promise<void>>(async () => undefined)
    renderDashboard({ clipboard })
    fireEvent.click(await screen.findByTestId('generate-share'))
    await waitFor(() => expect(clipboard).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByTestId('share-include-address'))
    fireEvent.click(screen.getByTestId('share-include-contacts'))
    await waitFor(() =>
      expect(snapshotFromUrl(dialogUrl()).privacy).toEqual({
        includesAddress: true,
        includesContacts: true,
      }),
    )
    const url = dialogUrl()
    cleanup()

    setHash(url.split('#')[1]!)
    renderAppShell()
    await waitFor(() => expect(screen.getByTestId('readonly-banner')).toBeInTheDocument())
    expect(screen.getByTestId('readonly-project-address')).toHaveTextContent(
      `工程地址：${FAKE_ADDRESS}`,
    )
    expect(screen.getByTestId('readonly-schedule-contacts')).toHaveTextContent('示範水電師傅')
    expect(screen.getByTestId('readonly-schedule-contacts')).toHaveTextContent(FAKE_PHONE)
    expect(screen.getByTestId('readonly-warranty-list')).toHaveTextContent(`聯絡：${FAKE_CONTACT}`)
    expect(screen.getByTestId('readonly-privacy-note')).toHaveTextContent(
      '分享者選擇包含：工程地址、聯絡方式',
    )
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('AC-005: a version 1 link still opens, without the M1 sections', async () => {
    const current = buildShareSnapshot({
      project: seedProject,
      stages: [stageDone],
      stageSummary: { total: 1, completed: 1, inProgress: 0, blocked: 0, notStarted: 0, percentComplete: 100 },
      gantt: { totalDays: 33, days: [], rows: [] },
      photos: [],
      budgetSummary: {
        total: 0,
        totalPlanned: 0,
        totalActual: 0,
        remaining: 0,
        isOverrun: false,
        totalOverrun: 0,
        overrunItemCount: 0,
        paymentCounts: { unpaid: 0, partial: 0, paid: 0 },
      },
    })
    const { privacy, changeOrders, contractSummary, acceptanceSummary, photoReport, ...rest } = current
    void privacy
    void changeOrders
    void contractSummary
    void acceptanceSummary
    void photoReport
    const legacy = { ...rest, version: 1 } as ShareSnapshot
    setHash(`${SHARE_HASH_KEY}=${encodeShareSnapshot(legacy)}`)

    renderAppShell()
    await waitFor(() => expect(screen.getByTestId('readonly-banner')).toBeInTheDocument())
    expect(screen.queryByTestId('readonly-error')).not.toBeInTheDocument()
    expect(screen.getByTestId('readonly-project-name')).toHaveTextContent('我的裝修工程')
    expect(screen.getByTestId('readonly-stage-row-stage-1')).toBeInTheDocument()
    expect(screen.queryByTestId('readonly-contract-summary')).not.toBeInTheDocument()
    expect(screen.queryByTestId('readonly-change-order-list')).not.toBeInTheDocument()
    expect(screen.queryByTestId('readonly-acceptance-summary')).not.toBeInTheDocument()
    expect(screen.queryByTestId('readonly-photo-report')).not.toBeInTheDocument()
  })

  it('AC-005: a tampered M1 section shows the friendly error page instead of crashing', async () => {
    const snapshot = buildShareSnapshot({
      project: seedProject,
      stages: [stageDone],
      stageSummary: { total: 1, completed: 1, inProgress: 0, blocked: 0, notStarted: 0, percentComplete: 100 },
      gantt: { totalDays: 33, days: [], rows: [] },
      photos: [],
      budgetSummary: {
        total: 0,
        totalPlanned: 0,
        totalActual: 0,
        remaining: 0,
        isOverrun: false,
        totalOverrun: 0,
        overrunItemCount: 0,
        paymentCounts: { unpaid: 0, partial: 0, paid: 0 },
      },
    })
    const tampered = { ...snapshot, changeOrders: 'not-a-list' } as unknown as ShareSnapshot
    setHash(`${SHARE_HASH_KEY}=${encodeShareSnapshot(tampered)}`)

    renderAppShell()
    await waitFor(() => expect(screen.getByTestId('readonly-error')).toBeInTheDocument())
    expect(screen.queryByTestId('readonly-banner')).not.toBeInTheDocument()
    expect(screen.queryByTestId('generate-share')).not.toBeInTheDocument()
  })

  it('AC-005: opening a share link never reads the M1 stores from IndexedDB', async () => {
    const spies = [
      vi.spyOn(dbModule, 'getAllChangeOrders'),
      vi.spyOn(dbModule, 'getAllContracts'),
      vi.spyOn(dbModule, 'getAllAcceptanceItems'),
      vi.spyOn(dbModule, 'getAllSchedules'),
      vi.spyOn(dbModule, 'getAllWarranties'),
    ]
    const snapshot = buildShareSnapshot({
      project: seedProject,
      stages: [stageDone],
      stageSummary: { total: 1, completed: 1, inProgress: 0, blocked: 0, notStarted: 0, percentComplete: 100 },
      gantt: { totalDays: 33, days: [], rows: [] },
      photos: [],
      budgetSummary: {
        total: 0,
        totalPlanned: 0,
        totalActual: 0,
        remaining: 0,
        isOverrun: false,
        totalOverrun: 0,
        overrunItemCount: 0,
        paymentCounts: { unpaid: 0, partial: 0, paid: 0 },
      },
    })
    setHash(`${SHARE_HASH_KEY}=${encodeShareSnapshot(snapshot)}`)
    renderAppShell()
    await waitFor(() => expect(screen.getByTestId('readonly-banner')).toBeInTheDocument())
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
  })
})
