// ScheduleItem IndexedDB tests — AC-FR005-02 (persistence) + AC-FR005-04
// (filter by projectId). Mirrors the photo/budget db tests so the v3→v4
// migration is exercised end-to-end.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAll,
  closeDb,
  deleteSchedule,
  deleteSchedulesByProject,
  getAllSchedules,
  getSchedulesByProject,
  openDb,
  putSchedule,
  resetDbCache,
  STORE_SCHEDULES,
} from '../db'
import type { ScheduleItem } from '../types'

function mk(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 'sch-' + Math.random().toString(36).slice(2, 8),
    projectId: 'proj-1',
    workerName: '水電師傅',
    startOn: '2026-09-20',
    endOn: '2026-09-22',
    completed: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('ScheduleItem IndexedDB — AC-FR005-02', () => {
  beforeEach(async () => {
    await closeDb()
    resetDbCache()
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('renovation-tracker')
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
      req.onblocked = () => resolve()
    })
    resetDbCache()
  })

  it('round-trips a schedule across simulated reloads', async () => {
    const s = mk({ id: 's1', reminderOn: '2026-09-19', phone: '0912345678', note: '帶電錶' })
    await putSchedule(s)
    await closeDb()
    resetDbCache()
    const all = await getAllSchedules()
    expect(all).toHaveLength(1)
    const back = all[0]!
    expect(back.id).toBe('s1')
    expect(back.workerName).toBe('水電師傅')
    expect(back.startOn).toBe('2026-09-20')
    expect(back.endOn).toBe('2026-09-22')
    expect(back.reminderOn).toBe('2026-09-19')
    expect(back.phone).toBe('0912345678')
    expect(back.note).toBe('帶電錶')
    expect(back.completed).toBe(false)
  })

  it('updates a schedule in place (idempotent put)', async () => {
    await putSchedule(mk({ id: 's2', workerName: '木工 A' }))
    await putSchedule(mk({ id: 's2', workerName: '木工 B', completed: true }))
    await closeDb()
    resetDbCache()
    const back = (await getAllSchedules()).find((s) => s.id === 's2')!
    expect(back.workerName).toBe('木工 B')
    expect(back.completed).toBe(true)
    expect((await getAllSchedules())).toHaveLength(1)
  })

  it('filters schedules by projectId via the byProjectId index', async () => {
    await putSchedule(mk({ id: 'a', projectId: 'proj-1' }))
    await putSchedule(mk({ id: 'b', projectId: 'proj-1' }))
    await putSchedule(mk({ id: 'c', projectId: 'proj-2' }))
    await closeDb()
    resetDbCache()
    expect((await getSchedulesByProject('proj-1')).map((s) => s.id).sort()).toEqual(['a', 'b'])
    expect((await getSchedulesByProject('proj-2')).map((s) => s.id)).toEqual(['c'])
  })

  it('deleteSchedule removes only the target schedule', async () => {
    await putSchedule(mk({ id: 'a' }))
    await putSchedule(mk({ id: 'b' }))
    await deleteSchedule('a')
    await closeDb()
    resetDbCache()
    expect((await getAllSchedules()).map((s) => s.id).sort()).toEqual(['b'])
  })

  it('deleteSchedulesByProject removes only the target project', async () => {
    await putSchedule(mk({ id: 'a', projectId: 'proj-1' }))
    await putSchedule(mk({ id: 'b', projectId: 'proj-1' }))
    await putSchedule(mk({ id: 'c', projectId: 'proj-2' }))
    await deleteSchedulesByProject('proj-1')
    await closeDb()
    resetDbCache()
    expect((await getAllSchedules()).map((s) => s.id)).toEqual(['c'])
  })

  it('clearAll also wipes schedules', async () => {
    await putSchedule(mk({ id: 'a' }))
    await putSchedule(mk({ id: 'b' }))
    await clearAll()
    expect(await getAllSchedules()).toEqual([])
  })

  it('exposes the schedules object store with keyPath id and byProjectId index', async () => {
    await putSchedule(mk({ id: 'a', projectId: 'proj-1' }))
    const db = await openDb()
    expect(db.objectStoreNames.contains(STORE_SCHEDULES)).toBe(true)
    const tx = db.transaction(STORE_SCHEDULES, 'readonly')
    const store = tx.objectStore(STORE_SCHEDULES)
    expect(store.keyPath).toBe('id')
    expect(Array.from(store.indexNames)).toContain('byProjectId')
    db.close()
  })
})
