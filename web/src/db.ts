// IndexedDB persistence layer. See PRD/SPEC.md §2 (storage), §4.4 (FR-002
// photo blob storage) and AC-FR001-10 / AC-FR002-01.
//
// Single source of truth for project / stage / photo / budget / schedule
// records. Schema versions (bump on every schema change):
//   v1 — projects, stages.
//   v2 — adds photos store (Blob payload) with `byProjectId` index.
//   v3 — adds budgets store (FR-003) with `byProjectId` index.
//   v4 — adds schedules store (FR-005) with `byProjectId` index.
//   v5 — adds warranties store (FR-006) with `byProjectId` index.

import type {
  BudgetItem,
  PhotoRecord,
  Project,
  ScheduleItem,
  Stage,
  WarrantyRecord,
} from './types'

const DB_NAME = 'renovation-tracker'
const DB_VERSION = 5
export const STORE_PROJECTS = 'projects'
export const STORE_STAGES = 'stages'
export const STORE_PHOTOS = 'photos'
export const STORE_BUDGETS = 'budgets'
export const STORE_SCHEDULES = 'schedules'
export const STORE_WARRANTIES = 'warranties'

let cachedDb: Promise<IDBDatabase> | null = null

/** Resolve the database, opening / upgrading it once per session. */
export function openDb(): Promise<IDBDatabase> {
  if (cachedDb) return cachedDb
  cachedDb = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_STAGES)) {
        const stageStore = db.createObjectStore(STORE_STAGES, { keyPath: 'id' })
        stageStore.createIndex('byProjectId', 'projectId', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        const photoStore = db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' })
        photoStore.createIndex('byProjectId', 'projectId', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_BUDGETS)) {
        const budgetStore = db.createObjectStore(STORE_BUDGETS, { keyPath: 'id' })
        budgetStore.createIndex('byProjectId', 'projectId', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_SCHEDULES)) {
        const scheduleStore = db.createObjectStore(STORE_SCHEDULES, { keyPath: 'id' })
        scheduleStore.createIndex('byProjectId', 'projectId', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_WARRANTIES)) {
        const warrantyStore = db.createObjectStore(STORE_WARRANTIES, { keyPath: 'id' })
        warrantyStore.createIndex('byProjectId', 'projectId', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('indexedDB.open failed'))
    req.onblocked = () => reject(new Error('indexedDB.open blocked'))
  })
  return cachedDb
}

/** Force the cached database to be re-opened — used by tests. */
export function resetDbCache(): void {
  cachedDb = null
}

/** Drop the cached database connection and close it — used by tests. */
export function closeDb(): Promise<void> {
  if (!cachedDb) return Promise.resolve()
  return cachedDb
    .then((db) => {
      db.close()
      cachedDb = null
    })
    .catch(() => {
      cachedDb = null
    })
}

function runTx<T>(
  db: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode)
    let result: T
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error ?? new Error('transaction error'))
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'))
    Promise.resolve(fn(tx))
      .then((value) => {
        result = value
      })
      .catch((err) => {
        reject(err instanceof Error ? err : new Error(String(err)))
        try {
          tx.abort()
        } catch {
          /* noop */
        }
      })
  })
}

function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('request failed'))
  })
}

// ---------- Projects ----------

export async function getAllProjects(): Promise<Project[]> {
  const db = await openDb()
  return runTx(db, [STORE_PROJECTS], 'readonly', (tx) => {
    const store = tx.objectStore(STORE_PROJECTS)
    return reqAsPromise<Project[]>(store.getAll() as IDBRequest<Project[]>)
  })
}

export async function putProject(project: Project): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_PROJECTS], 'readwrite', (tx) => {
    const store = tx.objectStore(STORE_PROJECTS)
    store.put(project)
  })
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_PROJECTS], 'readwrite', (tx) => {
    tx.objectStore(STORE_PROJECTS).delete(id)
  })
}

// ---------- Stages ----------

export async function getAllStages(): Promise<Stage[]> {
  const db = await openDb()
  return runTx(db, [STORE_STAGES], 'readonly', (tx) => {
    return reqAsPromise<Stage[]>(tx.objectStore(STORE_STAGES).getAll() as IDBRequest<Stage[]>)
  })
}

export async function getStagesByProject(projectId: string): Promise<Stage[]> {
  const db = await openDb()
  return runTx(db, [STORE_STAGES], 'readonly', (tx) => {
    const index = tx.objectStore(STORE_STAGES).index('byProjectId')
    return reqAsPromise<Stage[]>(index.getAll(projectId) as IDBRequest<Stage[]>)
  })
}

export async function putStage(stage: Stage): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_STAGES], 'readwrite', (tx) => {
    tx.objectStore(STORE_STAGES).put(stage)
  })
}

export async function deleteStage(id: string): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_STAGES], 'readwrite', (tx) => {
    tx.objectStore(STORE_STAGES).delete(id)
  })
}

export async function deleteStagesByProject(projectId: string): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_STAGES], 'readwrite', (tx) => {
    const index = tx.objectStore(STORE_STAGES).index('byProjectId')
    const req = index.openCursor(projectId)
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      cursor.delete()
      cursor.continue()
    }
  })
}

// ---------- Photos (FR-002) ----------

export async function getAllPhotos(): Promise<PhotoRecord[]> {
  const db = await openDb()
  return runTx(db, [STORE_PHOTOS], 'readonly', (tx) => {
    return reqAsPromise<PhotoRecord[]>(tx.objectStore(STORE_PHOTOS).getAll() as IDBRequest<PhotoRecord[]>)
  })
}

export async function getPhotosByProject(projectId: string): Promise<PhotoRecord[]> {
  const db = await openDb()
  return runTx(db, [STORE_PHOTOS], 'readonly', (tx) => {
    const index = tx.objectStore(STORE_PHOTOS).index('byProjectId')
    return reqAsPromise<PhotoRecord[]>(index.getAll(projectId) as IDBRequest<PhotoRecord[]>)
  })
}

export async function putPhoto(photo: PhotoRecord): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_PHOTOS], 'readwrite', (tx) => {
    tx.objectStore(STORE_PHOTOS).put(photo)
  })
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_PHOTOS], 'readwrite', (tx) => {
    tx.objectStore(STORE_PHOTOS).delete(id)
  })
}

export async function deletePhotosByProject(projectId: string): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_PHOTOS], 'readwrite', (tx) => {
    const index = tx.objectStore(STORE_PHOTOS).index('byProjectId')
    const req = index.openCursor(projectId)
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      cursor.delete()
      cursor.continue()
    }
  })
}

// ---------- Budgets (FR-003) ----------

export async function getAllBudgets(): Promise<BudgetItem[]> {
  const db = await openDb()
  return runTx(db, [STORE_BUDGETS], 'readonly', (tx) => {
    return reqAsPromise<BudgetItem[]>(tx.objectStore(STORE_BUDGETS).getAll() as IDBRequest<BudgetItem[]>)
  })
}

export async function getBudgetsByProject(projectId: string): Promise<BudgetItem[]> {
  const db = await openDb()
  return runTx(db, [STORE_BUDGETS], 'readonly', (tx) => {
    const index = tx.objectStore(STORE_BUDGETS).index('byProjectId')
    return reqAsPromise<BudgetItem[]>(index.getAll(projectId) as IDBRequest<BudgetItem[]>)
  })
}

export async function putBudget(budget: BudgetItem): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_BUDGETS], 'readwrite', (tx) => {
    tx.objectStore(STORE_BUDGETS).put(budget)
  })
}

export async function deleteBudget(id: string): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_BUDGETS], 'readwrite', (tx) => {
    tx.objectStore(STORE_BUDGETS).delete(id)
  })
}

export async function deleteBudgetsByProject(projectId: string): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_BUDGETS], 'readwrite', (tx) => {
    const index = tx.objectStore(STORE_BUDGETS).index('byProjectId')
    const req = index.openCursor(projectId)
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      cursor.delete()
      cursor.continue()
    }
  })
}

// ---------- Schedules (FR-005) ----------

export async function getAllSchedules(): Promise<ScheduleItem[]> {
  const db = await openDb()
  return runTx(db, [STORE_SCHEDULES], 'readonly', (tx) => {
    return reqAsPromise<ScheduleItem[]>(
      tx.objectStore(STORE_SCHEDULES).getAll() as IDBRequest<ScheduleItem[]>,
    )
  })
}

export async function getSchedulesByProject(projectId: string): Promise<ScheduleItem[]> {
  const db = await openDb()
  return runTx(db, [STORE_SCHEDULES], 'readonly', (tx) => {
    const index = tx.objectStore(STORE_SCHEDULES).index('byProjectId')
    return reqAsPromise<ScheduleItem[]>(
      index.getAll(projectId) as IDBRequest<ScheduleItem[]>,
    )
  })
}

export async function putSchedule(schedule: ScheduleItem): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_SCHEDULES], 'readwrite', (tx) => {
    tx.objectStore(STORE_SCHEDULES).put(schedule)
  })
}

export async function deleteSchedule(id: string): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_SCHEDULES], 'readwrite', (tx) => {
    tx.objectStore(STORE_SCHEDULES).delete(id)
  })
}

export async function deleteSchedulesByProject(projectId: string): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_SCHEDULES], 'readwrite', (tx) => {
    const index = tx.objectStore(STORE_SCHEDULES).index('byProjectId')
    const req = index.openCursor(projectId)
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      cursor.delete()
      cursor.continue()
    }
  })
}

// ---------- Warranties (FR-006) ----------

export async function getAllWarranties(): Promise<WarrantyRecord[]> {
  const db = await openDb()
  return runTx(db, [STORE_WARRANTIES], 'readonly', (tx) => {
    return reqAsPromise<WarrantyRecord[]>(
      tx.objectStore(STORE_WARRANTIES).getAll() as IDBRequest<WarrantyRecord[]>,
    )
  })
}

export async function getWarrantiesByProject(projectId: string): Promise<WarrantyRecord[]> {
  const db = await openDb()
  return runTx(db, [STORE_WARRANTIES], 'readonly', (tx) => {
    const index = tx.objectStore(STORE_WARRANTIES).index('byProjectId')
    return reqAsPromise<WarrantyRecord[]>(
      index.getAll(projectId) as IDBRequest<WarrantyRecord[]>,
    )
  })
}

export async function putWarranty(warranty: WarrantyRecord): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_WARRANTIES], 'readwrite', (tx) => {
    tx.objectStore(STORE_WARRANTIES).put(warranty)
  })
}

export async function deleteWarranty(id: string): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_WARRANTIES], 'readwrite', (tx) => {
    tx.objectStore(STORE_WARRANTIES).delete(id)
  })
}

export async function deleteWarrantiesByProject(projectId: string): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_WARRANTIES], 'readwrite', (tx) => {
    const index = tx.objectStore(STORE_WARRANTIES).index('byProjectId')
    const req = index.openCursor(projectId)
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      cursor.delete()
      cursor.continue()
    }
  })
}

/** Wipe all projects + stages + photos + budgets + schedules + warranties — only used by tests. */
export async function clearAll(): Promise<void> {
  const db = await openDb()
  await runTx(
    db,
    [
      STORE_PROJECTS,
      STORE_STAGES,
      STORE_PHOTOS,
      STORE_BUDGETS,
      STORE_SCHEDULES,
      STORE_WARRANTIES,
    ],
    'readwrite',
    (tx) => {
      tx.objectStore(STORE_PROJECTS).clear()
      tx.objectStore(STORE_STAGES).clear()
      tx.objectStore(STORE_PHOTOS).clear()
      tx.objectStore(STORE_BUDGETS).clear()
      tx.objectStore(STORE_SCHEDULES).clear()
      tx.objectStore(STORE_WARRANTIES).clear()
    },
  )
}

export interface LoadResult {
  projects: Project[]
  stages: Stage[]
  photos: PhotoRecord[]
  budgets: BudgetItem[]
  schedules: ScheduleItem[]
  warranties: WarrantyRecord[]
}

/** Convenience: load everything in one round trip. */
export async function loadAll(): Promise<LoadResult> {
  const [projects, stages, photos, budgets, schedules, warranties] = await Promise.all([
    getAllProjects(),
    getAllStages(),
    getAllPhotos(),
    getAllBudgets(),
    getAllSchedules(),
    getAllWarranties(),
  ])
  return { projects, stages, photos, budgets, schedules, warranties }
}
