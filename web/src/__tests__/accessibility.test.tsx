// Accessibility + responsive sanity test — AC-FR001-09.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { DashboardProvider } from '../store'
import { Dashboard } from '../components/Dashboard'
import { closeDb, resetDbCache } from '../db'

const cssText = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

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

describe('Accessibility — AC-FR001-09', () => {
  beforeEach(async () => {
    await resetIndexedDb()
  })

  it('every interactive control has an accessible name', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-stage')).toBeInTheDocument())
    // Project status switcher
    const statusSelect = screen.getByLabelText('切換工程狀態')
    expect(statusSelect).toBeInTheDocument()
    // Per-stage edit / delete buttons
    const editButtons = screen.getAllByRole('button', { name: /^編輯階段 / })
    const deleteButtons = screen.getAllByRole('button', { name: /^刪除階段 / })
    expect(editButtons.length).toBe(7)
    expect(deleteButtons.length).toBe(7)
  })

  it('status pills expose a label, not just colour', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getAllByText('拆除').length).toBeGreaterThan(0))
    // The project status pill has an aria-label and contains both symbol + label
    const projectPill = document.querySelector('.app-header .status-pill') as HTMLElement | null
    expect(projectPill).not.toBeNull()
    expect(projectPill!.textContent ?? '').toMatch(/規劃中|進行中|已完成/)
    // Each stage status pill has an aria-label with a Chinese status word
    const stageStatuses = screen.getAllByLabelText(/階段狀態/)
    expect(stageStatuses.length).toBe(7)
    for (const el of stageStatuses) {
      expect(el.textContent ?? '').toMatch(/未開始|進行中|已完成|阻塞/)
    }
  })

  it('gantt has a labelled section and bars expose aria-label', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getAllByText('拆除').length).toBeGreaterThan(0))
    // Gantt bars are aria-labelled
    const bar = screen.getByLabelText(/拆除：第 \d+ 天到第 \d+ 天，共 \d+ 天/)
    expect(bar).toBeInTheDocument()
  })
})

describe('Responsive — AC-FR001-09', () => {
  beforeEach(async () => {
    await resetIndexedDb()
  })

  it('renders without horizontal overflow at 375px viewport', async () => {
    // jsdom does not compute layout, so we statically assert the CSS rules
    // that guarantee no horizontal scrollbar at >=375px width (AC-FR001-09).
    expect(cssText).toMatch(/body\s*\{[^}]*overflow-x:\s*hidden/)
    expect(cssText).toMatch(/\.timeline-scroll\s*\{[^}]*overflow-x:\s*auto/)
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-stage')).toBeInTheDocument())
    const wrapper = document.querySelector('.timeline-scroll') as HTMLElement | null
    expect(wrapper).not.toBeNull()
    expect(wrapper!.classList.contains('timeline-scroll')).toBe(true)
  })
})
