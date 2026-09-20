// UI Polish Pass — UI-008 behavior preservation smoke test.
// Re-runs the core CRUD + persistence checks against the polished
// Dashboard. The assertions are intentionally narrower than the existing
// FR-001..FR-006 suites; this file only exists to prove the polish pass
// did not break the previously green paths.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

afterEach(() => {
  cleanup()
})

describe('UI-008 — Behavior preservation', () => {
  beforeEach(async () => {
    await resetIndexedDb()
  })

  it('seed data still renders 7 stages with 0% completion', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-stage')).toBeInTheDocument())
    expect(screen.getByTestId('total-stages').textContent).toBe('7')
    expect(screen.getByTestId('percent-complete').textContent).toBe('0%')
    expect(screen.getAllByTestId(/^stage-row-/).length).toBe(7)
  })

  it('adding a stage increases total-stages and persists across remount', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-stage')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('add-stage'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('階段名稱'), { target: { value: '追加工程' } })
    const startInput = screen.getByLabelText('預計開始') as HTMLInputElement
    const endInput = screen.getByLabelText('預計結束') as HTMLInputElement
    fireEvent.change(startInput, { target: { value: '2026-02-01' } })
    fireEvent.change(endInput, { target: { value: '2026-02-03' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))
    await waitFor(() => expect(screen.getByTestId('total-stages').textContent).toBe('8'))

    cleanup()
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('total-stages').textContent).toBe('8'))
  })

  it('share button text still reads 產生唯讀分享連結', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-stage')).toBeInTheDocument())
    const share = screen.getByTestId('generate-share')
    expect(share.textContent).toContain('產生唯讀分享連結')
  })

  it('editable surfaces preserve the project-name testid hook', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())
  })
})
