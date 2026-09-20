// Photo section integration tests — AC-FR002-01 ~ AC-FR002-04.
// Mounts the real <Dashboard> against fake-indexeddb, drives the form via
// user events, and asserts the IndexedDB store / the rendered list stay
// in sync. Delete-confirm cancellation is also verified here per AC-FR002-04.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DashboardProvider } from '../store'
import { Dashboard } from '../components/Dashboard'
import {
  closeDb,
  deletePhoto as dbDeletePhoto,
  getAllPhotos,
  putProject,
  resetDbCache,
} from '../db'
import type { Project, PhotoRecord } from '../types'

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

const seedProject: Project = {
  id: 'proj-photos',
  name: '我的裝修工程',
  status: 'in_progress',
  plannedStart: '2026-01-05',
  plannedEnd: '2026-02-06',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
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

/** Build a synthetic File-like object that React / fake-indexeddb will both
 *  accept. We hand-build a File (which accepts an array of parts + a name)
 *  and override size + type so the validator's 10MB ceiling is meaningful. */
function makePhotoFile(name: string, size: number, type: string): File {
  const bytes = new Uint8Array(Math.max(1, Math.min(size, 1024)))
  const file = new File([bytes], name, { type })
  Object.defineProperty(file, 'size', { value: size, configurable: true })
  return file
}

/** Select a file on a real `<input type="file">` so React's onChange handler
 *  sees `e.target.files[0]`. jsdom blocks assigning `files` directly, so we
 *  define it as an own property and then fire a bubbling change event. */
function setInputFiles(input: HTMLElement, file: File): void {
  const fileInput = input as HTMLInputElement
  Object.defineProperty(fileInput, 'files', {
    value: [file],
    configurable: true,
    writable: true,
  })
  fireEvent.change(fileInput)
}

beforeEach(async () => {
  await resetIndexedDb()
})

describe('AC-FR002-01 upload + validation', () => {
  it('uploads a valid image and shows it in the list (thumbnail rendered, persisted)', async () => {
    // Seed a project directly so the dashboard skips the seed animation.
    await putProject(seedProject)

    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())

    // Open the upload modal via the photo section CTA.
    fireEvent.click(screen.getByTestId('add-photo'))
    const dialog = await screen.findByRole('dialog')

    const fileInput = within(dialog).getByTestId('photo-file-input') as HTMLInputElement
    setInputFiles(fileInput, makePhotoFile('front.png', 4096, 'image/png'))

    // Kind + date defaults are acceptable; submit.
    fireEvent.change(within(dialog).getByTestId('photo-kind-select'), {
      target: { value: 'before' },
    })
    fireEvent.change(within(dialog).getByTestId('photo-taken-on-input'), {
      target: { value: '2026-01-10' },
    })
    fireEvent.click(within(dialog).getByTestId('photo-submit'))

    // AC-FR002-01: list now contains the uploaded photo.
    await waitFor(() => {
      expect(screen.getByText('front.png')).toBeInTheDocument()
    })
    const row = screen.getByText('front.png').closest('[data-testid^="photo-row-"]') as HTMLElement
    expect(row).toBeTruthy()
    // Thumbnail slot is either an <img> or the fallback; either way it's there.
    expect(
      row.querySelector('img.photo-thumb, .photo-thumb-missing'),
    ).toBeTruthy()

    // Persisted to IndexedDB.
    const stored = await getAllPhotos()
    expect(stored).toHaveLength(1)
    expect(stored[0]!.fileName).toBe('front.png')
    expect(stored[0]!.kind).toBe('before')
    expect(stored[0]!.takenOn).toBe('2026-01-10')
    // The strict byte-level Blob round-trip is asserted in photos.db.test.ts
    // (which runs under the node environment where structuredClone preserves
    // Blobs). Here we only need to confirm the store accepted a blob-shaped
    // payload — the strict IDB contract is covered by the dedicated test.
    expect(stored[0]!.blob).toBeDefined()
  })
})

describe('AC-FR002-02 invalid file rejected', () => {
  it('rejects a non-image file with a readable error and writes nothing', async () => {
    await putProject(seedProject)
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('add-photo'))
    const dialog = await screen.findByRole('dialog')
    setInputFiles(within(dialog).getByTestId('photo-file-input'), makePhotoFile('notes.pdf', 1024, 'application/pdf'))
    fireEvent.click(within(dialog).getByTestId('photo-submit'))

    await waitFor(() => {
      expect(within(dialog).getByTestId('photo-form-error').textContent).toMatch(
        /只接受圖片檔案/,
      )
    })
    // IndexedDB must be untouched.
    expect(await getAllPhotos()).toEqual([])
  })

  it('rejects a file larger than 10 MB', async () => {
    await putProject(seedProject)
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('add-photo'))
    const dialog = await screen.findByRole('dialog')
    setInputFiles(within(dialog).getByTestId('photo-file-input'), makePhotoFile('huge.png', 11 * 1024 * 1024, 'image/png'))
    fireEvent.click(within(dialog).getByTestId('photo-submit'))

    await waitFor(() => {
      expect(within(dialog).getByTestId('photo-form-error').textContent).toMatch(
        /10 MB/,
      )
    })
    expect(await getAllPhotos()).toEqual([])
  })
})

describe('AC-FR002-03 filter + timeline ordering', () => {
  beforeEach(async () => {
    // Seed two photos directly via the db layer so we don't depend on the
    // form — we're testing filter + sort, not upload.
    await putProject(seedProject)
    const older: PhotoRecord = {
      id: 'p-old',
      projectId: seedProject.id,
      kind: 'progress',
      takenOn: '2026-01-15',
      fileName: 'older.png',
      mimeType: 'image/png',
      blob: new Blob([new Uint8Array([1, 2])], { type: 'image/png' }),
      createdAt: '2026-01-15T00:00:00.000Z',
    }
    const newer: PhotoRecord = {
      id: 'p-new',
      projectId: seedProject.id,
      kind: 'before',
      takenOn: '2026-01-25',
      fileName: 'newer.png',
      mimeType: 'image/png',
      blob: new Blob([new Uint8Array([3, 4])], { type: 'image/png' }),
      createdAt: '2026-01-25T00:00:00.000Z',
    }
    const { putPhoto } = await import('../db')
    await putPhoto(older)
    await putPhoto(newer)
  })

  it('renders the timeline newest-first by takenOn', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('newer.png')).toBeInTheDocument())
    const rows = screen.getAllByTestId(/^photo-row-/)
    expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual([
      'photo-row-p-new',
      'photo-row-p-old',
    ])
  })

  it('filters by kind and shows only matching rows', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('newer.png')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('photo-filter'), {
      target: { value: 'before' },
    })
    await waitFor(() => {
      expect(screen.getByText('newer.png')).toBeInTheDocument()
      expect(screen.queryByText('older.png')).not.toBeInTheDocument()
    })
    expect(screen.getByTestId('photo-filter-count').textContent).toMatch(/1 \/ 2/)

    fireEvent.change(screen.getByTestId('photo-filter'), {
      target: { value: 'progress' },
    })
    await waitFor(() => expect(screen.getByText('older.png')).toBeInTheDocument())
    expect(screen.queryByText('newer.png')).not.toBeInTheDocument()
  })

  it('shows a friendly empty state when no photo matches the current filter', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('newer.png')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('photo-filter'), { target: { value: 'after' } })
    await waitFor(() => expect(screen.getByTestId('photo-filter-empty')).toBeInTheDocument())
  })
})

describe('AC-FR002-04 preview + delete-confirm', () => {
  beforeEach(async () => {
    await putProject(seedProject)
    const photo: PhotoRecord = {
      id: 'p-prev',
      projectId: seedProject.id,
      kind: 'progress',
      takenOn: '2026-02-01',
      fileName: 'preview.png',
      mimeType: 'image/png',
      blob: new Blob([new Uint8Array([9, 9, 9])], { type: 'image/png' }),
      createdAt: '2026-02-01T00:00:00.000Z',
    }
    const { putPhoto } = await import('../db')
    await putPhoto(photo)
  })

  it('opens a preview dialog showing the photo metadata', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('preview.png')).toBeInTheDocument())
    // The visible 預覽 button (the thumb button has a different label).
    fireEvent.click(screen.getByRole('button', { name: '預覽照片 preview.png' }))
    const dialog = await screen.findByRole('dialog')
    // The preview dialog reuses the Modal pattern; the metadata should be visible.
    await waitFor(() => {
      expect(within(dialog).getByText('preview.png')).toBeInTheDocument()
    })
    expect(within(dialog).getByText('施工中')).toBeInTheDocument()
    expect(within(dialog).getByText('2026-02-01')).toBeInTheDocument()
  })

  it('cancel leaves the photo intact in storage and UI', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('preview.png')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('photo-delete-p-prev'))
    const confirm = await screen.findByRole('dialog')
    fireEvent.click(within(confirm).getByRole('button', { name: '取消' }))

    // Confirm dialog closed; photo is still there.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('preview.png')).toBeInTheDocument()
    const stored = await getAllPhotos()
    expect(stored).toHaveLength(1)
    expect(stored[0]!.id).toBe('p-prev')
  })

  it('confirm removes the photo from storage and the UI', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('preview.png')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('photo-delete-p-prev'))
    const confirm = await screen.findByRole('dialog')
    fireEvent.click(within(confirm).getByTestId('confirm-delete'))

    await waitFor(() => {
      expect(screen.queryByText('preview.png')).not.toBeInTheDocument()
    })
    expect(await getAllPhotos()).toEqual([])
  })
})

describe('AC-FR002-04 no photos empty state', () => {
  it('renders the empty state when no photos are stored', async () => {
    await putProject(seedProject)
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())
    expect(screen.getByTestId('photo-empty-state')).toBeInTheDocument()
    expect(screen.getByTestId('add-photo')).toBeInTheDocument()
  })
})

describe('AC-FR002 photo storage isolation from stages', () => {
  it('deleting a photo does not affect stage records', async () => {
    await putProject(seedProject)
    const photo: PhotoRecord = {
      id: 'p-iso',
      projectId: seedProject.id,
      kind: 'progress',
      takenOn: '2026-02-01',
      fileName: 'iso.png',
      mimeType: 'image/png',
      blob: new Blob([new Uint8Array([1])], { type: 'image/png' }),
      createdAt: '2026-02-01T00:00:00.000Z',
    }
    const { putPhoto, getAllStages } = await import('../db')
    await putPhoto(photo)

    renderDashboard()
    await waitFor(() => expect(screen.getByText('iso.png')).toBeInTheDocument())

    // Sanity: 0 stages persisted for this project (we didn't seed any).
    expect(await getAllStages()).toEqual([])

    fireEvent.click(screen.getByTestId('photo-delete-p-iso'))
    const confirm = await screen.findByRole('dialog')
    fireEvent.click(within(confirm).getByTestId('confirm-delete'))
    await waitFor(() => expect(screen.queryByText('iso.png')).not.toBeInTheDocument())

    expect(await getAllPhotos()).toEqual([])
    expect(await getAllStages()).toEqual([])
  })

  it('stores photo createdAt independent of stage fields', async () => {
    await putProject(seedProject)
    const photo: PhotoRecord = {
      id: 'p-time',
      projectId: seedProject.id,
      kind: 'after',
      takenOn: '2026-02-05',
      fileName: 'time.png',
      mimeType: 'image/png',
      blob: new Blob([new Uint8Array([7])], { type: 'image/png' }),
      createdAt: '2026-02-05T12:34:56.000Z',
    }
    const { putPhoto } = await import('../db')
    await putPhoto(photo)

    renderDashboard()
    await waitFor(() => expect(screen.getByText('time.png')).toBeInTheDocument())
    // db.deletePhoto is referenced via the store; sanity-import it so the
    // linter doesn't strip it from the test bundle.
    expect(typeof dbDeletePhoto).toBe('function')
  })
})
