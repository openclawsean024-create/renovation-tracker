// Shared helpers for the M1 Dashboard integration tests (AC-001 ~ AC-006).
// Mounts the real <Dashboard> against fake-indexeddb, exactly like the
// existing Dashboard.*.test.tsx suites. Only obviously fake data is used.

import { render, screen, waitFor } from '@testing-library/react'
import { DashboardProvider } from '../store'
import { Dashboard } from '../components/Dashboard'
import { closeDb, resetDbCache } from '../db'
import type { Project, Stage } from '../types'

export const demoProject: Project = {
  id: 'proj-m1',
  name: '示範工程',
  status: 'in_progress',
  plannedStart: '2026-01-05',
  plannedEnd: '2026-03-31',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

export const demoStages: Stage[] = [
  {
    id: 'stage-demo',
    projectId: 'proj-m1',
    name: '拆除',
    order: 1,
    status: 'completed',
    plannedStart: '2026-01-05',
    plannedEnd: '2026-01-09',
    actualStart: '2026-01-05',
    actualEnd: '2026-01-09',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'stage-water',
    projectId: 'proj-m1',
    name: '水電',
    order: 2,
    status: 'in_progress',
    plannedStart: '2026-01-12',
    plannedEnd: '2026-01-23',
    actualStart: '2026-01-12',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'stage-wood',
    projectId: 'proj-m1',
    name: '木作',
    order: 3,
    status: 'not_started',
    plannedStart: '2026-01-26',
    plannedEnd: '2026-02-13',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

export async function resetIndexedDb(): Promise<void> {
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

/** Mount the editable dashboard and wait until the project has loaded. */
export async function renderDashboard(opts: { clock?: () => Date } = {}) {
  const result = render(
    <DashboardProvider clock={opts.clock}>
      <Dashboard />
    </DashboardProvider>,
  )
  await waitFor(() => expect(screen.getByTestId('project-name')).toBeInTheDocument())
  return result
}
