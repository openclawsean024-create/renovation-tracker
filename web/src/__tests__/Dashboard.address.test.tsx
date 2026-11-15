// AC-005 — the 「包含工程地址」 opt-in must be usable in the real app: the
// address can be entered, stays out of share links by default, and is only
// added after the box is ticked. Also checks the read-only banner no longer
// prints the whole encoded link. Fake data only.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { getAllProjects, putProject } from '../db'
import { ReadOnlyView, shareUrlLabel } from '../components/ReadOnlyView'
import { decodeShareHash } from '../share'
import { demoProject, renderDashboard, resetIndexedDb } from './m1TestUtils'

const FAKE_ADDRESS = '測試市示範路 1 號'

beforeEach(async () => {
  await resetIndexedDb()
  await putProject(demoProject)
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', window.location.pathname)
})

async function saveAddress(value: string) {
  fireEvent.click(screen.getByTestId('edit-address'))
  const dialog = await screen.findByRole('dialog', { name: '工程地址' })
  fireEvent.change(within(dialog).getByTestId('address-input'), { target: { value } })
  fireEvent.click(within(dialog).getByTestId('address-submit'))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

function snapshotOf(url: string) {
  const result = decodeShareHash(`#${url.split('#')[1]}`)
  if (!result.ok) throw new Error(result.error.message)
  return result.snapshot
}

describe('AC-005 project address opt-in in the app', () => {
  it('AC-005: the address can be entered, is saved, and survives a remount', async () => {
    await renderDashboard()
    expect(screen.getByTestId('project-address')).toHaveTextContent('未填寫')
    await saveAddress(`  ${FAKE_ADDRESS}  `)
    expect(screen.getByTestId('project-address')).toHaveTextContent(FAKE_ADDRESS)
    expect((await getAllProjects())[0]!.address).toBe(FAKE_ADDRESS)

    cleanup()
    await renderDashboard()
    expect(screen.getByTestId('project-address')).toHaveTextContent(FAKE_ADDRESS)
  })

  it('AC-005: clearing the address removes it from storage', async () => {
    await putProject({ ...demoProject, address: FAKE_ADDRESS })
    await renderDashboard()
    await saveAddress('   ')
    expect(screen.getByTestId('project-address')).toHaveTextContent('未填寫')
    expect('address' in (await getAllProjects())[0]!).toBe(false)
  })

  it('AC-005: a saved address stays out of the link until 「包含工程地址」 is ticked', async () => {
    const clipboard = vi.fn<(text: string) => Promise<void>>(async () => undefined)
    await renderDashboard()
    await saveAddress(FAKE_ADDRESS)
    cleanup()
    const { DashboardProvider } = await import('../store')
    const { Dashboard } = await import('../components/Dashboard')
    render(
      <DashboardProvider>
        <Dashboard clipboard={clipboard} />
      </DashboardProvider>,
    )
    fireEvent.click(await screen.findByTestId('generate-share'))
    await waitFor(() => expect(clipboard).toHaveBeenCalledTimes(1))

    const box = screen.getByTestId('share-include-address')
    expect(box).toBeEnabled()
    expect(box).not.toBeChecked()
    const url = () => (screen.getByTestId('share-dialog-url') as HTMLInputElement).value
    expect(snapshotOf(url()).project.address).toBeUndefined()
    expect(url()).not.toContain(encodeURIComponent(FAKE_ADDRESS))

    fireEvent.click(box)
    await waitFor(() => expect(snapshotOf(url()).project.address).toBe(FAKE_ADDRESS))
    expect(snapshotOf(url()).privacy).toEqual({ includesAddress: true, includesContacts: false })
  })
})

describe('AC-005 read-only banner', () => {
  it('AC-005: shows only the page address, not the encoded snapshot', () => {
    const long = `http://localhost:5173/#share=${'A'.repeat(5000)}`
    expect(shareUrlLabel(long)).toBe('http://localhost:5173/（分享快照）')
    expect(shareUrlLabel('http://localhost:5173/')).toBe('http://localhost:5173/')
    expect(shareUrlLabel('')).toBe('')
  })

  it('AC-005: the rendered banner text stays short for a long link', () => {
    const snapshot = {
      version: 2,
      generatedAt: '2026-01-20T02:00:00.000Z',
      project: {
        name: '示範工程',
        status: 'in_progress' as const,
        plannedStart: '2026-01-05',
        plannedEnd: '2026-01-10',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      stages: [],
      stageSummary: { total: 0, completed: 0, inProgress: 0, blocked: 0, notStarted: 0, percentComplete: 0 },
      gantt: { totalDays: 6, days: [], rows: [] },
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
      scheduleSummary: { total: 0, upcoming: 0, overdue: 0, completed: 0 },
      warrantySummary: { total: 0, expiringSoon: 0, expired: 0, active: 0 },
    }
    render(
      <ReadOnlyView
        snapshot={snapshot}
        sourceUrl={`http://localhost:5173/#share=${'B'.repeat(4750)}`}
      />,
    )
    const text = screen.getByTestId('readonly-source-url').textContent ?? ''
    expect(text).toBe('http://localhost:5173/（分享快照）')
    expect(text.length).toBeLessThan(60)
  })
})
