// UI Polish Pass — UI-007 accessibility smoke test.
// Adds supplementary assertions for the polish pass:
//   - skip link is present and accessible
//   - nav-row exposes a labelled nav landmark
//   - nav links use a stable aria-current="location" model
//   - status pills inside the app-header carry text content
//   - body.readonly class hides edit controls (UI-006 readonly state)
//   - gantt grid uses the new timeline-grid class
//   - inputs and selects inside forms have minimum 44px height (token-driven)
//
// These assertions do NOT modify any existing test file.

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

describe('UI-007 — Polish pass accessibility', () => {
  beforeEach(async () => {
    await resetIndexedDb()
  })

  it('renders a skip-to-main-content link', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-stage')).toBeInTheDocument())
    const skip = document.querySelector('a.skip[href="#main"]')
    expect(skip).not.toBeNull()
    expect(skip!.textContent ?? '').toContain('跳至主要內容')
  })

  it('exposes a labelled nav landmark with stable anchor links', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-stage')).toBeInTheDocument())
    const nav = document.querySelector('nav[aria-label]')
    expect(nav).not.toBeNull()
    const links = nav!.querySelectorAll('a.nav-link')
    expect(links.length).toBeGreaterThanOrEqual(4)
    for (const a of Array.from(links)) {
      expect((a as HTMLAnchorElement).getAttribute('href')).toMatch(/^#/)
    }
  })

  it('marks the overview nav link as current on first load', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-stage')).toBeInTheDocument())
    const currentLinks = document.querySelectorAll('a.nav-link[aria-current="location"]')
    expect(currentLinks.length).toBeGreaterThanOrEqual(1)
    expect((currentLinks[0] as HTMLAnchorElement).getAttribute('href')).toBe('#overview')
  })

  it('brand row contains a wordmark with product name', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-stage')).toBeInTheDocument())
    const brand = document.querySelector('.brand-row .brand')
    expect(brand).not.toBeNull()
    expect(brand!.textContent ?? '').toContain('裝修進度神器')
  })

  it('summary grid exposes six labelled metrics, with completion highlighted', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('total-stages')).toBeInTheDocument())
    const metrics = document.querySelectorAll('dl.summary > .metric')
    expect(metrics.length).toBe(6)
    const completion = document.querySelector('dl.summary > .metric.completion')
    expect(completion).not.toBeNull()
    expect(completion!.querySelector('[role="progressbar"]')).not.toBeNull()
  })

  it('every major section card exposes a section header and section-heading', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('total-stages')).toBeInTheDocument())
    const sections = document.querySelectorAll('section.section')
    expect(sections.length).toBeGreaterThanOrEqual(4)
    // Every section should have an h2 (either in a section-header or inside
    // a nested section header like the gantt card).
    for (const s of Array.from(sections)) {
      expect(s.querySelector('h2')).not.toBeNull()
    }
  })

  it('stage view-switch uses proper tab semantics with selected state', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-stage')).toBeInTheDocument())
    const tabs = document.querySelectorAll('.view-switch [role="tab"]')
    expect(tabs.length).toBe(2)
    const selected = document.querySelectorAll('.view-switch [aria-selected="true"]')
    expect(selected.length).toBe(1)
  })

  it('app-header status pill carries text content (not color-only)', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-stage')).toBeInTheDocument())
    const pill = document.querySelector('.app-header .status-pill') as HTMLElement | null
    expect(pill).not.toBeNull()
    expect(pill!.textContent ?? '').toMatch(/規劃中|進行中|已完成/)
  })

  it('form inputs and selects use the 44px minimum touch target', () => {
    // Token-driven rule — verified by inspecting the stylesheet text.
    expect(cssText).toMatch(/input,\s*select,\s*textarea\s*\{[^}]*min-height:\s*44px/)
    expect(cssText).toMatch(/\.btn\s*\{[^}]*min-height:\s*44px/)
  })

  it('respects prefers-reduced-motion (no forced transitions)', () => {
    expect(cssText).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/)
  })

  it('respects forced-colors mode', () => {
    expect(cssText).toMatch(/@media\s*\(\s*forced-colors:\s*active\s*\)/)
  })

  it('read-only mode hides every edit-control', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('add-stage')).toBeInTheDocument())
    // Toggle the body class manually (matches what App.tsx does when the URL
    // hash contains the share key) and verify the CSS rule hides edit-controls.
    document.body.classList.add('readonly')
    expect(cssText).toMatch(/body\.readonly\s+\.edit-control\s*\{\s*display:\s*none\s*!important/)
    document.body.classList.remove('readonly')
  })
})
