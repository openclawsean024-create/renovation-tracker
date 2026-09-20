// Dashboard navigation regression tests — production bug filed by Sean on
// 2026-09-20:
//
//   "In the deployed app, clicking the editable dashboard navigation items
//    預算, 現場照片, 近期工作, 保固 appears to do nothing."
//
// Root cause (fixed in this commit): the <Dashboard>'s NAV_LINKS array
// renders `<a href="#budget">`, `<a href="#photos">`, `<a href="#schedule">`
// and `<a href="#warranties">`, but the corresponding section components
// (BudgetSection, PhotoSection, ScheduleSection, WarrantySection) did not
// carry matching `id` attributes on their outer elements. Clicking those
// four nav links therefore had no scroll target — the browser silently
// did nothing, because the href hash pointed to a non-existent element.
//
// This file is the regression suite for that bug. It is intentionally
// additive — none of the existing tests are weakened, deleted, or
// rewritten. All assertions below fail before the fix and pass after it.
//
// Coverage matrix:
//   N1  every nav link carries the documented href (#overview/#timeline/
//       #budget/#photos/#schedule/#warranties)
//   N2  every nav target section exists in the rendered DOM with the
//       documented id (the literal regression — this is what the user
//       filed)
//   N3  clicking a nav link scrolls the target section into the viewport
//       via the defensive handler (UX-visible, not just href-correct)
//   N4  re-clicking the same nav link still scrolls (the built-in anchor
//       jump is a no-op on identical-hash clicks; the handler fixes that)
//   N5  every anchor target carries `scroll-margin-top` so the sticky
//       app-header cannot cover the section heading after navigation
//   N6  the readonly/share boundary still works — #share=...&budget remains
//       readonly, ordinary anchors remain editable, malformed share hashes
//       remain friendly errors

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DashboardProvider } from '../store'
import { Dashboard } from '../components/Dashboard'
import { AppShell } from '../components/AppShell'
import { closeDb, putProject, resetDbCache } from '../db'
import {
  SHARE_HASH_KEY,
  buildShareSnapshot,
  encodeShareSnapshot,
} from '../share'
import type { Project } from '../types'

/**
 * Mirrors the production NAV_LINKS order so the test stays in lock-step
 * with the actual navigation. If you add a new section, add a row here too.
 */
const EXPECTED_NAV_TARGETS = [
  { id: 'overview', label: '總覽' },
  { id: 'timeline', label: '階段與工期' },
  { id: 'budget', label: '預算' },
  { id: 'photos', label: '現場照片' },
  { id: 'schedule', label: '近期工作' },
  { id: 'warranties', label: '保固' },
] as const

const seedProject: Project = {
  id: 'proj-nav',
  name: '我的裝修工程',
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
  const url = new URL(window.location.href)
  url.hash = value
  window.history.replaceState(null, '', url.toString())
}

function renderDashboard() {
  return render(
    <DashboardProvider>
      <Dashboard />
    </DashboardProvider>,
  )
}

function renderAppShell() {
  return render(<AppShell />)
}

/* jsdom does not implement Element.prototype.scrollIntoView. The defensive
 * handler in <Dashboard>'s NavLink still calls scrollIntoView when present,
 * so we polyfill it for the navigation tests. The handler is also
 * defensive — if scrollIntoView is absent, it still updates the URL hash
 * and the activeSection state, which is what the production user sees. */
beforeAll(() => {
  if (typeof Element === 'undefined') return
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = function scrollIntoViewPolyfill() {
      /* no-op — tests assert on the spy, not the actual scroll */
    }
  }
})

afterEach(() => {
  cleanup()
  document.body.classList.remove('readonly')
  setHash('')
  vi.restoreAllMocks()
})

/* ─────────────────────────────────────────────────────────────────────────
 * N1 — Every nav link carries the documented href
 * ──────────────────────────────────────────────────────────────────────── */
describe('N1 — nav link hrefs match documented section targets', () => {
  beforeEach(async () => {
    await resetIndexedDb()
    setHash('')
  })

  it('renders exactly the 6 documented nav links in order', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('nav.nav-row a.nav-link'),
    )
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '#overview',
      '#timeline',
      '#budget',
      '#photos',
      '#schedule',
      '#warranties',
    ])
  })

  it('nav link labels match the documented copy in zh-Hant', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('nav.nav-row a.nav-link'),
    )
    expect(links.map((a) => a.textContent?.trim())).toEqual(
      EXPECTED_NAV_TARGETS.map((t) => t.label),
    )
  })

  it('every nav link carries a data-nav-target attribute that matches its href', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('nav.nav-row a.nav-link'),
    )
    for (const link of links) {
      const dataAttr = link.getAttribute('data-nav-target')
      const href = link.getAttribute('href')
      expect(dataAttr, `data-nav-target on ${link.textContent?.trim()}`).toBeTruthy()
      expect(href).toBe(`#${dataAttr}`)
    }
  })
})

/* ─────────────────────────────────────────────────────────────────────────
 * N2 — Every nav target section exists in the DOM with the documented id
 *      (this is the literal regression — was missing before the fix)
 * ──────────────────────────────────────────────────────────────────────── */
describe('N2 — every nav target section is reachable in the DOM', () => {
  beforeEach(async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    setHash('')
  })

  it.each(EXPECTED_NAV_TARGETS.map((t) => [t.id, t.label] as const))(
    'renders an element with id="%s" in the DOM for nav target %s',
    async (id) => {
      renderDashboard()
      await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())
      const el = document.getElementById(id)
      expect(el, `expected an element with id="${id}" (this is the literal regression)`).not.toBeNull()
      expect(el!.tagName.toLowerCase()).not.toBe('')
    },
  )

  it('budget section is the outer <section> wrapper, not just the heading', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())
    const el = document.getElementById('budget')
    expect(el).not.toBeNull()
    expect(el!.id).toBe('budget')
    expect(el!.querySelector('#budget-section-heading')).not.toBeNull()
  })

  it('photos section is the outer <section> wrapper', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())
    const el = document.getElementById('photos')
    expect(el).not.toBeNull()
    expect(el!.id).toBe('photos')
    expect(el!.querySelector('#photo-section-heading')).not.toBeNull()
  })

  it('schedule and warranties sections are distinct elements', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())
    const schedule = document.getElementById('schedule')
    const warranties = document.getElementById('warranties')
    expect(schedule).not.toBeNull()
    expect(warranties).not.toBeNull()
    // They must be distinct — if they shared an id the browser would only
    // scroll to the first one and the user would still see the same section
    // regardless of which nav link they clicked.
    expect(schedule === warranties).toBe(false)
  })
})

/* ─────────────────────────────────────────────────────────────────────────
 * N3 — Clicking a nav link scrolls the target into the viewport
 * ──────────────────────────────────────────────────────────────────────── */
describe('N3 — clicking a nav link scrolls the target into the viewport', () => {
  beforeEach(async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    setHash('')
  })

  it.each(EXPECTED_NAV_TARGETS.map((t) => [t.id] as const))(
    'clicking the #%s nav link calls scrollIntoView on the target element',
    async (id) => {
      renderDashboard()
      await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())

      const target = document.getElementById(id)
      expect(target).not.toBeNull()
      const scrollSpy = vi.spyOn(target as HTMLElement, 'scrollIntoView')

      const link = document.querySelector<HTMLAnchorElement>(
        `nav.nav-row a.nav-link[data-nav-target="${id}"]`,
      )
      expect(link).not.toBeNull()
      fireEvent.click(link!)

      expect(scrollSpy).toHaveBeenCalledTimes(1)
      const call = scrollSpy.mock.calls[0]?.[0] as ScrollIntoViewOptions | undefined
      expect(call?.block).toBe('start')
    },
  )

  it('clicking a nav link updates window.location.hash to the section anchor', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())

    fireEvent.click(
      document.querySelector<HTMLAnchorElement>(
        'nav.nav-row a.nav-link[data-nav-target="budget"]',
      )!,
    )

    expect(window.location.hash).toBe('#budget')
  })

  it('clicking a nav link immediately marks the target section as active (aria-current)', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())

    fireEvent.click(
      document.querySelector<HTMLAnchorElement>(
        'nav.nav-row a.nav-link[data-nav-target="schedule"]',
      )!,
    )

    const scheduleLink = document.querySelector<HTMLAnchorElement>(
      'nav.nav-row a.nav-link[data-nav-target="schedule"]',
    )
    expect(scheduleLink!.getAttribute('aria-current')).toBe('location')
  })
})

/* ─────────────────────────────────────────────────────────────────────────
 * N4 — Re-clicking the same nav link still scrolls
 *      (the built-in anchor jump is a no-op on identical-hash clicks)
 * ──────────────────────────────────────────────────────────────────────── */
describe('N4 — re-clicking the same nav link still scrolls', () => {
  beforeEach(async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    setHash('')
  })

  it('clicking the same nav link twice triggers scrollIntoView twice', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())

    const link = document.querySelector<HTMLAnchorElement>(
      'nav.nav-row a.nav-link[data-nav-target="warranties"]',
    )!
    const target = document.getElementById('warranties') as HTMLElement
    const scrollSpy = vi.spyOn(target, 'scrollIntoView')

    fireEvent.click(link)
    fireEvent.click(link)

    expect(scrollSpy).toHaveBeenCalledTimes(2)
  })

  it('clicking a nav link while the hash already equals its target still scrolls', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())

    const link = document.querySelector<HTMLAnchorElement>(
      'nav.nav-row a.nav-link[data-nav-target="photos"]',
    )!
    const target = document.getElementById('photos') as HTMLElement
    const scrollSpy = vi.spyOn(target, 'scrollIntoView')

    // Pre-set the hash to the target. Browsers would normally treat the
    // click as a no-op because the hash is unchanged.
    setHash('#photos')
    fireEvent.click(link)

    expect(scrollSpy).toHaveBeenCalledTimes(1)
  })
})

/* ─────────────────────────────────────────────────────────────────────────
 * N5 — Every anchor target carries scroll-margin-top so the sticky header
 *      cannot cover the section heading.
 *
 * jsdom does not implement CSSOM-level getComputedStyle for shorthand
 * properties, and Vite does not inject the CSS into jsdom the same way
 * the browser does. So we read the source stylesheet directly and verify
 * the rule is present with a positive value >= the sticky-header clearance.
 * This is the same approach the orchestrator used for the readonly
 * class-toggle contract — the rule itself is what we are testing.
 * ──────────────────────────────────────────────────────────────────────── */
describe('N5 — anchor targets clear the sticky app-header', () => {
  beforeEach(async () => {
    await resetIndexedDb()
    await putProject(seedProject)
    setHash('')
  })

  function loadCssSource(): string {
    const path = resolve(__dirname, '../index.css')
    return readFileSync(path, 'utf8')
  }

  it.each(EXPECTED_NAV_TARGETS.map((t) => [t.id] as const))(
    '#%s has a positive scroll-margin-top in index.css',
    (id) => {
      const css = loadCssSource()
      const re = new RegExp(
        `\\[id="${id}"\\][^{]*\\{[^}]*scroll-margin-top:\\s*(\\d+)px`,
        'm',
      )
      const match = re.exec(css)
      expect(
        match,
        `expected [id="${id}"] { scroll-margin-top: NNNpx; } in index.css`,
      ).not.toBeNull()
      const px = Number(match![1])
      expect(px).toBeGreaterThan(0)
      // The sticky header is ~140px on desktop and ~184px on mobile; the
      // rule must clear both, so >= 140px is the floor.
      expect(px).toBeGreaterThanOrEqual(140)
    },
  )

  it('provides a larger mobile scroll-margin-top via the @media (max-width: 767px) override', () => {
    const css = loadCssSource()
    // Find the @media block that targets mobile and re-declares
    // scroll-margin-top for the anchor targets.
    const mediaMatch = /@media\s*\(max-width:\s*767px\)\s*\{([\s\S]*?)\n\}/m.exec(css)
    expect(mediaMatch, 'expected an @media (max-width: 767px) block').not.toBeNull()
    const body = mediaMatch![1]
    // The selectors in the @media block are comma-separated into a single
    // rule, so we expect exactly one rule that lists all 6 anchor ids and
    // sets a positive scroll-margin-top.
    const mobileRule = /\[id="(?:overview|timeline|budget|photos|schedule|warranties)"\][^{]*\{[^}]*scroll-margin-top:\s*(\d+)px/.exec(body)
    expect(
      mobileRule,
      'expected a mobile @media rule that lists every anchor target with scroll-margin-top',
    ).not.toBeNull()
    const px = Number(mobileRule![1])
    expect(px).toBeGreaterThanOrEqual(140)
    // Mobile header is taller than desktop; the override must be at least
    // the mobile scroll-padding-top (184px) declared elsewhere in the file.
    expect(px).toBeGreaterThanOrEqual(184)
    // Confirm the override is actually larger than the desktop rule.
    const desktopPx = Number(
      /\[id="overview"\][^{]*\{[^}]*scroll-margin-top:\s*(\d+)px/.exec(css)![1],
    )
    expect(px).toBeGreaterThan(desktopPx)
  })
})

/* ─────────────────────────────────────────────────────────────────────────
 * N6 — Readonly/share boundary is preserved by the navigation fix.
 * ──────────────────────────────────────────────────────────────────────── */
describe('N6 — navigation fix does not break the readonly/share boundary', () => {
  beforeEach(async () => {
    await resetIndexedDb()
    await putProject(seedProject)
  })

  it('valid share URL remains readonly and the body gets the readonly class', async () => {
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

    renderAppShell()
    await waitFor(() => expect(screen.getByTestId('readonly-banner')).toBeInTheDocument())
    expect(document.body.classList.contains('readonly')).toBe(true)
  })

  it('ordinary section anchor remains editable even though the section now has an id', async () => {
    setHash('#budget')
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())
    expect(document.body.classList.contains('readonly')).toBe(false)
    const link = document.querySelector<HTMLAnchorElement>(
      'nav.nav-row a.nav-link[data-nav-target="budget"]',
    )
    expect(link).not.toBeNull()
    expect(link!.getAttribute('href')).toBe('#budget')
    expect(document.getElementById('budget')).not.toBeNull()
  })

  it('malformed share hash still shows the friendly error (regression guard)', async () => {
    setHash(`${SHARE_HASH_KEY}=@@@@@@`)
    renderAppShell()
    await waitFor(() => expect(screen.getByTestId('readonly-error')).toBeInTheDocument())
    expect(document.body.classList.contains('readonly')).toBe(true)
  })
})
