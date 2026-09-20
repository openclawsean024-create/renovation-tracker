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
  address: '台北市信義區',
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