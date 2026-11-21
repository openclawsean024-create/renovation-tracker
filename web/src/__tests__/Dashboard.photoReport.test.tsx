// AC-004 (FR-010) — photo progress report on the real <Dashboard>. Photos are
// synthetic 1-byte blobs; nothing here is a real construction photo and
// nothing leaves IndexedDB.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { putPhoto, putProject, putStage } from '../db'
import { demoProject, demoStages, renderDashboard, resetIndexedDb } from './m1TestUtils'
import type { PhotoRecord } from '../types'

function photo(overrides: Partial<PhotoRecord> & { id: string }): PhotoRecord {
  return {
    projectId: demoProject.id,
    kind: 'progress',
    takenOn: '2026-01-10',
    fileName: `${overrides.id}.png`,
    mimeType: 'image/png',
    blob: new Blob([new Uint8Array([1])], { type: 'image/png' }),
    createdAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(async () => {
  await resetIndexedDb()
  await putProject(demoProject)
  // Insert out of order on purpose: the report must follow `Stage.order`.
  await putStage(demoStages[2]!)
  await putStage(demoStages[0]!)
  await putStage(demoStages[1]!)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  const urlApi = URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown }
  delete urlApi.createObjectURL
  delete urlApi.revokeObjectURL
})

describe('AC-004 photo progress report on the dashboard', () => {
  it('AC-004: with no photos every stage shows 尚無照片 and there is no 未分類 row', async () => {
    await renderDashboard()
    expect(screen.getByRole('heading', { name: '照片進度回報' })).toBeInTheDocument()
    for (const stage of demoStages) {
      expect(screen.getByTestId(`photo-report-count-${stage.id}`)).toHaveTextContent('尚無照片')
      expect(screen.getByTestId(`photo-report-none-${stage.id}`)).toHaveTextContent('尚無照片')
      expect(screen.queryByTestId(`photo-report-latest-${stage.id}`)).not.toBeInTheDocument()
    }
    expect(screen.queryByTestId('photo-report-group-unassigned')).not.toBeInTheDocument()
    expect(screen.getByTestId('photo-report-summary')).toHaveTextContent('依階段彙整 0 張照片')
  })

  it('AC-004: lists stages by stage order', async () => {
    await renderDashboard()
    const rows = within(screen.getByTestId('photo-report')).getAllByRole('listitem')
    expect(rows.map((r) => within(r).getByRole('heading').textContent)).toEqual([
      '拆除',
      '水電',
      '木作',
    ])
  })

  it('AC-004: shows photo count, latest shooting date and latest caption per stage', async () => {
    await putPhoto(photo({ id: 'p1', stageId: 'stage-demo', takenOn: '2026-01-06', caption: '示範：拆除前' }))
    await putPhoto(photo({ id: 'p2', stageId: 'stage-demo', takenOn: '2026-01-09', caption: '示範：拆除完成' }))
    await putPhoto(photo({ id: 'p3', stageId: 'stage-demo', takenOn: '2026-01-07', caption: '示範：拆除中' }))
    await putPhoto(photo({ id: 'p4', stageId: 'stage-water', takenOn: '2026-01-15' }))
    await renderDashboard()

    await waitFor(() =>
      expect(screen.getByTestId('photo-report-count-stage-demo')).toHaveTextContent('3 張'),
    )
    expect(screen.getByTestId('photo-report-latest-stage-demo')).toHaveTextContent(
      '最新拍攝日：2026-01-09',
    )
    expect(screen.getByTestId('photo-report-caption-stage-demo')).toHaveTextContent(
      '最新說明：示範：拆除完成',
    )
    expect(screen.getByTestId('photo-report-count-stage-water')).toHaveTextContent('1 張')
    expect(screen.getByTestId('photo-report-latest-stage-water')).toHaveTextContent(
      '最新拍攝日：2026-01-15',
    )
    // No caption → the file name stands in for it.
    expect(screen.getByTestId('photo-report-caption-stage-water')).toHaveTextContent(
      '最新說明：p4.png',
    )
    // A stage without photos still appears, with the empty label.
    expect(screen.getByTestId('photo-report-count-stage-wood')).toHaveTextContent('尚無照片')
    expect(screen.getByTestId('photo-report-group-stage-wood')).toHaveAttribute('data-empty', 'true')
    expect(screen.getByTestId('photo-report-summary')).toHaveTextContent('依階段彙整 4 張照片')
  })

  it('AC-004: photos without a stage are grouped under 未分類, listed last', async () => {
    await putPhoto(photo({ id: 'u1', takenOn: '2026-01-03', caption: '示範：未分類舊照' }))
    await putPhoto(photo({ id: 'u2', takenOn: '2026-01-04', caption: '示範：未分類新照' }))
    await putPhoto(photo({ id: 'gone', stageId: 'stage-deleted', takenOn: '2026-01-02' }))
    await renderDashboard()

    const group = await screen.findByTestId('photo-report-group-unassigned')
    expect(within(group).getByRole('heading', { name: '未分類' })).toBeInTheDocument()
    expect(screen.getByTestId('photo-report-count-unassigned')).toHaveTextContent('3 張')
    expect(screen.getByTestId('photo-report-latest-unassigned')).toHaveTextContent(
      '最新拍攝日：2026-01-04',
    )
    expect(screen.getByTestId('photo-report-caption-unassigned')).toHaveTextContent(
      '最新說明：示範：未分類新照',
    )
    const rows = within(screen.getByTestId('photo-report')).getAllByRole('listitem')
    expect(within(rows[rows.length - 1]!).getByRole('heading').textContent).toBe('未分類')
  })

  it('AC-004: shows the latest photo as a thumbnail when object URLs are available', async () => {
    // jsdom does not implement object URLs, so install a minimal stand-in for
    // this test only (removed again in afterEach).
    const created: Blob[] = []
    const urlApi = URL as unknown as {
      createObjectURL?: (blob: Blob) => string
      revokeObjectURL?: (url: string) => void
    }
    urlApi.createObjectURL = (blob: Blob) => {
      created.push(blob)
      return `blob:demo-${created.length}`
    }
    urlApi.revokeObjectURL = () => undefined
    await putPhoto(photo({ id: 'p1', stageId: 'stage-demo', takenOn: '2026-01-06', caption: '示範：舊' }))
    await putPhoto(photo({ id: 'p2', stageId: 'stage-demo', takenOn: '2026-01-09', caption: '示範：新' }))
    await renderDashboard()

    const thumb = await screen.findByTestId('photo-report-thumb-stage-demo')
    expect(thumb.tagName).toBe('IMG')
    expect(thumb.getAttribute('src')).toMatch(/^blob:demo-/)
    expect(created.length).toBeGreaterThan(0)
    expect(thumb).toHaveAttribute('alt', '拆除 最新照片：示範：新')
    // Stages without photos never get an <img>.
    expect(screen.queryByTestId('photo-report-thumb-stage-wood')).not.toBeInTheDocument()
    expect(screen.getByTestId('photo-report-thumb-missing-stage-wood')).toBeInTheDocument()
  })

  it('AC-004: building the report makes no network request (no cloud storage)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    await putPhoto(photo({ id: 'p1', stageId: 'stage-demo' }))
    await renderDashboard()
    await waitFor(() =>
      expect(screen.getByTestId('photo-report-count-stage-demo')).toHaveTextContent('1 張'),
    )
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(screen.getByTestId('photo-report-summary')).toHaveTextContent('照片僅存於本機，不會上傳')
  })
})
