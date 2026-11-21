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
//   v6 — M1 (PRD/SPEC.md §12): adds changeOrders (FR-007, `byProjectId`),
//        contracts (FR-008, keyed by `projectId`, one record per project) and
//        acceptanceItems (FR-009, `byProjectId` + `byStageId`). Additive only:
//        no existing store or record is touched by the upgrade.

import type {
  AcceptanceItem,
  BudgetItem,
  ChangeOrder,
  ContractRecord,
  PhotoRecord,
  Project,
  ScheduleItem,
  Stage,
  WarrantyRecord,
} from './types'

const DB_NAME = 'renovation-tracker'
const DB_VERSION = 6
export const STORE_PROJECTS = 'projects'
export const STORE_STAGES = 'stages'
export const STORE_PHOTOS = 'photos'
export const STORE_BUDGETS = 'budgets'
export const STORE_SCHEDULES = 'schedules'
export const STORE_WARRANTIES = 'warranties'
export const STORE_CHANGE_ORDERS = 'changeOrders'
export const STORE_CONTRACTS = 'contracts'
export const STORE_ACCEPTANCE_ITEMS = 'acceptanceItems'

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
      if (!db.objectStoreNames.contains(STORE_CHANGE_ORDERS)) {
        const changeOrderStore = db.createObjectStore(STORE_CHANGE_ORDERS, { keyPath: 'id' })
        changeOrderStore.createIndex('byProjectId', 'projectId', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_CONTRACTS)) {
        // One contract record per project → the project id is the key.
        db.createObjectStore(STORE_CONTRACTS, { keyPath: 'projectId' })
      }
      if (!db.objectStoreNames.contains(STORE_ACCEPTANCE_ITEMS)) {
        const acceptanceStore = db.createObjectStore(STORE_ACCEPTANCE_ITEMS, { keyPath: 'id' })
        acceptanceStore.createIndex('byProjectId', 'projectId', { unique: false })
        acceptanceStore.createIndex('byStageId', 'stageId', { unique: false })
      }
    }
    req.onsuccess = () => {
      const db = req.result
      // When a newer version is opened elsewhere (another tab after an
      // upgrade), release this connection so that upgrade is not blocked.
      db.onversionchange = () => {
        db.close()
        cachedDb = null
      }
      resolve(db)
    }
    req.onerror = () => {
      // Do not cache a failed open: the next call must try again.
      cachedDb = null
      reject(req.error ?? new Error('indexedDB.open failed'))
    }
    // An older tab still holds the previous version. The request stays
    // pending and completes on its own once that tab closes its connection,
    // so `blocked` is not treated as a failure (the caller keeps waiting).
    req.onblocked = () => {
      dbBlocked = true
    }
  })
  return cachedDb
}

let dbBlocked = false

/** True while opening is waiting for an older tab to release the database. */
export function isDbUpgradeBlocked(): boolean {
  return dbBlocked
}

/** Force the cached database to be re-opened — used by tests. */
export function resetDbCache(): void {
  cachedDb = null
  dbBlocked = false
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

/** Raised inside a transactional update when the stored record forbids it. */
export class RecordConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecordConflictError'
  }
}

/**
 * Read one record, let `mutate` decide the new value from what is *stored*
 * (not from a possibly stale in-memory copy), and write it — all inside a
 * single readwrite transaction. If `mutate` throws, nothing is written and the
 * error is passed to the caller unchanged. Used wherever two tabs could race
 * (change-order decisions, project patches, acceptance toggles).
 */
export async function mutateRecord<T>(
  storeName: string,
  key: IDBValidKey,
  mutate: (current: T | undefined) => T,
): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite')
    const store = tx.objectStore(storeName)
    let next: T | undefined
    let failure: unknown
    const getReq = store.get(key)
    getReq.onsuccess = () => {
      try {
        next = mutate(getReq.result as T | undefined)
        store.put(next)
      } catch (err) {
        failure = err
        try {
          tx.abort()
        } catch {
          /* already finished */
        }
      }
    }
    tx.oncomplete = () => resolve(next as T)
    tx.onabort = () =>
      reject(failure ?? tx.error ?? new Error('transaction aborted'))
    tx.onerror = () => {
      if (failure === undefined) reject(tx.error ?? new Error('transaction error'))
    }
  })
}

/**
 * Seed a first-run project and its stages atomically: only if the projects
 * store is still empty when the transaction runs. Two tabs opening an empty
 * database at the same time therefore produce one project, not two.
 * Returns true when this call wrote the seed.
 */
export async function seedIfEmpty(project: Project, stages: Stage[]): Promise<boolean> {
  const db = await openDb()
  return new Promise<boolean>((resolve, reject) => {
    const tx = db.transaction([STORE_PROJECTS, STORE_STAGES], 'readwrite')
    let seeded = false
    const countReq = tx.objectStore(STORE_PROJECTS).count()
    countReq.onsuccess = () => {
      if (countReq.result > 0) return
      seeded = true
      tx.objectStore(STORE_PROJECTS).put(project)
      for (const stage of stages) tx.objectStore(STORE_STAGES).put(stage)
    }
    tx.oncomplete = () => resolve(seeded)
    tx.onerror = () => reject(tx.error ?? new Error('transaction error'))
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'))
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

// ---------- Change orders (FR-007) ----------

export async function getAllChangeOrders(): Promise<ChangeOrder[]> {
  const db = await openDb()
  return runTx(db, [STORE_CHANGE_ORDERS], 'readonly', (tx) => {
    return reqAsPromise<ChangeOrder[]>(tx.objectStore(STORE_CHANGE_ORDERS).getAll() as IDBRequest<ChangeOrder[]>)
  })
}

export async function getChangeOrdersByProject(projectId: string): Promise<ChangeOrder[]> {
  const db = await openDb()
  return runTx(db, [STORE_CHANGE_ORDERS], 'readonly', (tx) => {
    const index = tx.objectStore(STORE_CHANGE_ORDERS).index('byProjectId')
    return reqAsPromise<ChangeOrder[]>(index.getAll(projectId) as IDBRequest<ChangeOrder[]>)
  })
}

export async function putChangeOrder(record: ChangeOrder): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_CHANGE_ORDERS], 'readwrite', (tx) => {
    tx.objectStore(STORE_CHANGE_ORDERS).put(record)
  })
}

export async function deleteChangeOrder(id: string): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_CHANGE_ORDERS], 'readwrite', (tx) => {
    tx.objectStore(STORE_CHANGE_ORDERS).delete(id)
  })
}

/** Remove every change order of one project. */
export async function deleteChangeOrdersByProject(projectId: string): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_CHANGE_ORDERS], 'readwrite', (tx) => {
    const index = tx.objectStore(STORE_CHANGE_ORDERS).index('byProjectId')
    const req = index.openCursor(projectId)
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      cursor.delete()
      cursor.continue()
    }
  })
}

// ---------- Contracts (FR-008) ----------

export async function getAllContracts(): Promise<ContractRecord[]> {
  const db = await openDb()
  return runTx(db, [STORE_CONTRACTS], 'readonly', (tx) => {
    return reqAsPromise<ContractRecord[]>(
      tx.objectStore(STORE_CONTRACTS).getAll() as IDBRequest<ContractRecord[]>,
    )
  })
}

export async function getContract(projectId: string): Promise<ContractRecord | undefined> {
  const db = await openDb()
  return runTx(db, [STORE_CONTRACTS], 'readonly', (tx) => {
    return reqAsPromise<ContractRecord | undefined>(
      tx.objectStore(STORE_CONTRACTS).get(projectId) as IDBRequest<ContractRecord | undefined>,
    )
  })
}

export async function putContract(contract: ContractRecord): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_CONTRACTS], 'readwrite', (tx) => {
    tx.objectStore(STORE_CONTRACTS).put(contract)
  })
}

export async function deleteContract(projectId: string): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_CONTRACTS], 'readwrite', (tx) => {
    tx.objectStore(STORE_CONTRACTS).delete(projectId)
  })
}

// ---------- Acceptance items (FR-009) ----------

export async function getAllAcceptanceItems(): Promise<AcceptanceItem[]> {
  const db = await openDb()
  return runTx(db, [STORE_ACCEPTANCE_ITEMS], 'readonly', (tx) => {
    return reqAsPromise<AcceptanceItem[]>(tx.objectStore(STORE_ACCEPTANCE_ITEMS).getAll() as IDBRequest<AcceptanceItem[]>)
  })
}

export async function getAcceptanceItemsByProject(projectId: string): Promise<AcceptanceItem[]> {
  const db = await openDb()
  return runTx(db, [STORE_ACCEPTANCE_ITEMS], 'readonly', (tx) => {
    const index = tx.objectStore(STORE_ACCEPTANCE_ITEMS).index('byProjectId')
    return reqAsPromise<AcceptanceItem[]>(index.getAll(projectId) as IDBRequest<AcceptanceItem[]>)
  })
}

export async function putAcceptanceItem(record: AcceptanceItem): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_ACCEPTANCE_ITEMS], 'readwrite', (tx) => {
    tx.objectStore(STORE_ACCEPTANCE_ITEMS).put(record)
  })
}

export async function deleteAcceptanceItem(id: string): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_ACCEPTANCE_ITEMS], 'readwrite', (tx) => {
    tx.objectStore(STORE_ACCEPTANCE_ITEMS).delete(id)
  })
}

export async function getAcceptanceItemsByStage(stageId: string): Promise<AcceptanceItem[]> {
  const db = await openDb()
  return runTx(db, [STORE_ACCEPTANCE_ITEMS], 'readonly', (tx) => {
    const index = tx.objectStore(STORE_ACCEPTANCE_ITEMS).index('byStageId')
    return reqAsPromise<AcceptanceItem[]>(index.getAll(stageId) as IDBRequest<AcceptanceItem[]>)
  })
}

/**
 * Delete a stage and all of its acceptance items in ONE transaction, so an
 * interrupted delete can never leave orphaned items that still count in the
 * acceptance totals or in a share link.
 */
export async function deleteStageWithAcceptance(stageId: string): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_STAGES, STORE_ACCEPTANCE_ITEMS], 'readwrite', (tx) => {
    tx.objectStore(STORE_STAGES).delete(stageId)
    const req = tx.objectStore(STORE_ACCEPTANCE_ITEMS).index('byStageId').openCursor(stageId)
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      cursor.delete()
      cursor.continue()
    }
  })
}

/**
 * Add an acceptance item only if its stage still exists in the same project
 * when the transaction runs (a stale tab must not attach items to a stage
 * that was deleted elsewhere).
 */
export async function putAcceptanceItemIfStageExists(item: AcceptanceItem): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_STAGES, STORE_ACCEPTANCE_ITEMS], 'readwrite')
    let failure: unknown
    const stageReq = tx.objectStore(STORE_STAGES).get(item.stageId)
    stageReq.onsuccess = () => {
      const stage = stageReq.result as Stage | undefined
      if (!stage || stage.projectId !== item.projectId) {
        failure = new RecordConflictError('找不到對應的階段，可能已在其他分頁刪除')
        tx.abort()
        return
      }
      tx.objectStore(STORE_ACCEPTANCE_ITEMS).put(item)
    }
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('transaction aborted'))
  })
}

/** Remove every acceptance item of one stage. */
export async function deleteAcceptanceItemsByStage(stageId: string): Promise<void> {
  const db = await openDb()
  await runTx(db, [STORE_ACCEPTANCE_ITEMS], 'readwrite', (tx) => {
    const index = tx.objectStore(STORE_ACCEPTANCE_ITEMS).index('byStageId')
    const req = index.openCursor(stageId)
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      cursor.delete()
      cursor.continue()
    }
  })
}

/** Wipe every object store — only used by tests. */
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
      STORE_CHANGE_ORDERS,
      STORE_CONTRACTS,
      STORE_ACCEPTANCE_ITEMS,
    ],
    'readwrite',
    (tx) => {
      tx.objectStore(STORE_PROJECTS).clear()
      tx.objectStore(STORE_STAGES).clear()
      tx.objectStore(STORE_PHOTOS).clear()
      tx.objectStore(STORE_BUDGETS).clear()
      tx.objectStore(STORE_SCHEDULES).clear()
      tx.objectStore(STORE_WARRANTIES).clear()
      tx.objectStore(STORE_CHANGE_ORDERS).clear()
      tx.objectStore(STORE_CONTRACTS).clear()
      tx.objectStore(STORE_ACCEPTANCE_ITEMS).clear()
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
  changeOrders: ChangeOrder[]
  contracts: ContractRecord[]
  acceptanceItems: AcceptanceItem[]
}

/** Convenience: load everything in one round trip. */
export async function loadAll(): Promise<LoadResult> {
  const [
    projects,
    stages,
    photos,
    budgets,
    schedules,
    warranties,
    changeOrders,
    contracts,
    acceptanceItems,
  ] = await Promise.all([
    getAllProjects(),
    getAllStages(),
    getAllPhotos(),
    getAllBudgets(),
    getAllSchedules(),
    getAllWarranties(),
    getAllChangeOrders(),
    getAllContracts(),
    getAllAcceptanceItems(),
  ])
  return {
    projects,
    stages,
    photos,
    budgets,
    schedules,
    warranties,
    changeOrders,
    contracts,
    acceptanceItems,
  }
}
