// IndexedDB persistence tests — AC-FR001-10 (round-trip after reload).

import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAll,
  closeDb,
  deleteStage,
  deleteStagesByProject,
  getAllProjects,
  getAllStages,
  getStagesByProject,
  loadAll,
  openDb,
  putProject,
  putStage,
  resetDbCache,
  STORE_PROJECTS,
  STORE_STAGES,
} from '../db'
import type { Project, Stage } from '../types'

const project: Project = {
  id: 'proj-1',
  name: '我的裝修工程',
  status: 'planning',
  plannedStart: '2026-01-05',
  plannedEnd: '2026-02-13',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function mkStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: 'id-' + Math.random().toString(36).slice(2, 8),
    projectId: 'proj-1',
    name: 'stage',
    order: 1,
    status: 'not_started',
    plannedStart: '2026-01-05',
    plannedEnd: '2026-01-09',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('IndexedDB persistence', () => {
  beforeEach(async () => {
    await closeDb()
    resetDbCache()
    // Wipe by deleting the database entirely so each test starts clean.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('renovation-tracker')
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
      req.onblocked = () => resolve()
    })
    resetDbCache()
  })

  it('round-trips projects across simulated page reloads', async () => {
    await putProject(project)
    // simulate reload — close + reopen the connection
    await closeDb()
    resetDbCache()
    const projects = await getAllProjects()
    expect(projects).toHaveLength(1)
    expect(projects[0]!.id).toBe(project.id)
    expect(projects[0]!.name).toBe(project.name)
  })

  it('round-trips stages by project across simulated page reloads', async () => {
    await putProject(project)
    await putStage(mkStage({ id: 'a', order: 1, name: '拆除', plannedStart: '2026-01-05', plannedEnd: '2026-01-09' }))
    await putStage(mkStage({ id: 'b', order: 2, name: '水電', plannedStart: '2026-01-10', plannedEnd: '2026-01-14' }))
    await closeDb()
    resetDbCache()
    const stages = await getStagesByProject('proj-1')
    expect(stages.map((s) => s.name)).toEqual(['拆除', '水電'])
  })

  it('loads both projects and stages in one round trip', async () => {
    await putProject(project)
    await putStage(mkStage({ id: 'a', order: 1, name: '拆除', plannedStart: '2026-01-05', plannedEnd: '2026-01-09' }))
    await closeDb()
    resetDbCache()
    const all = await loadAll()
    expect(all.projects).toHaveLength(1)
    expect(all.stages).toHaveLength(1)
  })

  it('updates a project on re-put', async () => {
    await putProject(project)
    const updated: Project = { ...project, name: '新名稱', status: 'in_progress' }
    await putProject(updated)
    await closeDb()
    resetDbCache()
    const projects = await getAllProjects()
    expect(projects[0]!.name).toBe('新名稱')
    expect(projects[0]!.status).toBe('in_progress')
  })

  it('deletes a stage and the rest are preserved', async () => {
    await putProject(project)
    const a = mkStage({ id: 'a', order: 1 })
    const b = mkStage({ id: 'b', order: 2 })
    await putStage(a)
    await putStage(b)
    await deleteStage('a')
    await closeDb()
    resetDbCache()
    const stages = await getAllStages()
    expect(stages.map((s) => s.id)).toEqual(['b'])
  })

  it('deleteStagesByProject removes only the project\'s stages', async () => {
    await putProject(project)
    await putProject({ ...project, id: 'proj-2', name: '另一個' })
    await putStage(mkStage({ id: 'a', projectId: 'proj-1' }))
    await putStage(mkStage({ id: 'b', projectId: 'proj-1' }))
    await putStage(mkStage({ id: 'c', projectId: 'proj-2' }))
    await deleteStagesByProject('proj-1')
    await closeDb()
    resetDbCache()
    const stages = await getAllStages()
    expect(stages.map((s) => s.id)).toEqual(['c'])
  })

  it('clearAll wipes everything', async () => {
    await putProject(project)
    await putStage(mkStage({ id: 'a' }))
    await clearAll()
    await closeDb()
    resetDbCache()
    expect(await getAllProjects()).toEqual([])
    expect(await getAllStages()).toEqual([])
  })

  it('exposes both stores with keyPath id', async () => {
    // Force openDb to run onupgradeneeded by writing first; that gives the
    // schema a deterministic state to inspect.
    await putProject(project)
    const db = await openDb()
    expect(db.objectStoreNames.contains(STORE_PROJECTS)).toBe(true)
    expect(db.objectStoreNames.contains(STORE_STAGES)).toBe(true)
    db.close()
  })
})
