// Codex review (2026-11-22) — AC-005 share dialog edge cases.
// 1. If updating the address bar fails while consent is removed, the link the
//    dialog offers must still match the (now unticked) boxes.
// 2. A page that already has a key=value hash (e.g. #keep=1) must still
//    produce a link that opens in read-only mode.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DashboardProvider } from '../store'
import { Dashboard } from '../components/Dashboard'
import { AppShell } from '../components/AppShell'
import { putProject, putSchedule } from '../db'
import { decodeShareHash, hasShareHash } from '../share'
import { demoProject, resetIndexedDb } from './m1TestUtils'

const FAKE_ADDRESS = '測試市示範路 1 號'
const FAKE_PHONE = '0900-000-000'

function setHash(value: string) {
  const url = new URL(window.location.href)
  url.hash = value
  window.history.replaceState(null, '', url.toString())
}

function dialogUrl(): string {
  return (screen.getByTestId('share-dialog-url') as HTMLInputElement).value
}

function snapshotOf(url: string) {
  const result = decodeShareHash(`#${url.split('#')[1]}`)
  if (!result.ok) throw new Error(result.error.message)
  return result.snapshot
}

beforeEach(async () => {
  await resetIndexedDb()
  setHash('')
  await putProject({ ...demoProject, address: FAKE_ADDRESS })
  await putSchedule({
    id: 'sch-1',
    projectId: demoProject.id,
    workerName: '示範水電師傅',
    phone: FAKE_PHONE,
    startOn: '2026-01-12',
    endOn: '2026-01-23',
    completed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
  document.body.classList.remove('readonly')
  setHash('')
})

async function openDialog(clipboard = vi.fn<(t: string) => Promise<void>>(async () => undefined)) {
  render(
    <DashboardProvider>
      <Dashboard clipboard={clipboard} />
    </DashboardProvider>,
  )
  fireEvent.click(await screen.findByTestId('generate-share'))
  await waitFor(() => expect(screen.getByTestId('share-dialog')).toBeInTheDocument())
  return clipboard
}

describe('AC-005 share dialog keeps boxes and link in sync', () => {
  it('AC-005: removing consent still removes personal data from the offered link when the address bar cannot be updated', async () => {
    const clipboard = await openDialog()
    fireEvent.click(screen.getByTestId('share-include-address'))
    fireEvent.click(screen.getByTestId('share-include-contacts'))
    await waitFor(() => expect(snapshotOf(dialogUrl()).privacy?.includesContacts).toBe(true))
    expect(snapshotOf(dialogUrl()).project.address).toBe(FAKE_ADDRESS)

    // From now on every history update fails.
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    fireEvent.click(screen.getByTestId('share-include-address'))
    fireEvent.click(screen.getByTestId('share-include-contacts'))

    expect(screen.getByTestId('share-include-address')).not.toBeChecked()
    expect(screen.getByTestId('share-include-contacts')).not.toBeChecked()
    const offered = snapshotOf(dialogUrl())
    expect(offered.project.address).toBeUndefined()
    expect(offered.scheduleContacts).toBeUndefined()
    expect(offered.privacy).toEqual({ includesAddress: false, includesContacts: false })
    expect(JSON.stringify(offered)).not.toContain(FAKE_PHONE)
    expect(screen.getByTestId('share-feedback')).toHaveTextContent('無法更新網址')

    // What gets copied is that same consent-free link.
    fireEvent.click(screen.getByTestId('share-dialog-copy'))
    await waitFor(() => expect(clipboard).toHaveBeenCalledTimes(2))
    const copied = clipboard.mock.calls[1]![0]
    expect(copied).toBe(dialogUrl())
    expect(snapshotOf(copied).project.address).toBeUndefined()
  })
})

describe('AC-005 share link with an existing hash parameter', () => {
  it('AC-005: a page with #keep=1 still produces a link that opens read-only', async () => {
    setHash('keep=1')
    const clipboard = await openDialog()
    await waitFor(() => expect(clipboard).toHaveBeenCalledTimes(1))
    const copied = clipboard.mock.calls[0]![0]
    const hash = `#${copied.split('#')[1]}`
    expect(hash).toMatch(/^#keep=1&share=/)
    expect(hasShareHash(hash)).toBe(true)
    cleanup()

    setHash(hash.slice(1))
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('readonly-banner')).toBeInTheDocument())
    expect(screen.queryByTestId('generate-share')).not.toBeInTheDocument()
  })
})
