// Centralised application store backed by IndexedDB. Single project / many
// stages for FR-001, plus photo records (Blob) for FR-002, budget items for
// FR-003, and schedule items for FR-005. Exposes a small action surface via
// the useDashboard hook.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import {
  deleteBudget as dbDeleteBudget,
  deletePhoto as dbDeletePhoto,
  deleteSchedule as dbDeleteSchedule,
  deleteStage as dbDeleteStage,
  deleteStagesByProject,
  deleteWarranty as dbDeleteWarranty,
  getAllBudgets,
  getAllPhotos,
  getAllProjects,
  getAllSchedules,
  getAllStages,
  getAllWarranties,
  putBudget,
  putPhoto,
  putProject,
  putSchedule,
  putStage,
  putWarranty,
} from './db'
import { buildSeed, SEED_STAGE_NAMES } from './seed'
import { compareStageOrder } from './status'
import {
  assertScheduleProjectConsistency,
  nextOrder,
  resolveStatusDates,
  validateNewScheduleInput,
  validateNewStageInput,
  validateScheduleInput,
  validateStageInput,
  type ValidationError,
} from './validation'
import { todayISO } from './dates'
import { validatePhotoInput } from './photos'
import { validateBudgetInput, validateNewBudgetInput } from './budget'
import {
  isWarrantyValid,
  validateNewWarrantyInput,
  validateWarrantyEditInput,
} from './warranty'
import type {
  BudgetItem,
  BudgetItemEditInput,
  NewBudgetItemInput,
  NewPhotoInput,
  NewScheduleItemInput,
  NewStageInput,
  NewWarrantyItemInput,
  PhotoRecord,
  Project,
  ProjectStatus,
  ScheduleItem,
  ScheduleItemEditInput,
  Stage,
  StageEditInput,
  StageStatus,
  WarrantyItemEditInput,
  WarrantyRecord,
} from './types'

export type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export interface DashboardState {
  loadState: LoadState
  error?: string
  project: Project | null
  stages: Stage[]
  photos: PhotoRecord[]
  budgets: BudgetItem[]
  schedules: ScheduleItem[]
  warranties: WarrantyRecord[]
}

type Action =
  | { type: 'load/start' }
  | {
      type: 'load/success'
      project: Project | null
      stages: Stage[]
      photos: PhotoRecord[]
      budgets: BudgetItem[]
      schedules: ScheduleItem[]
      warranties: WarrantyRecord[]
    }
  | { type: 'load/error'; message: string }
  | { type: 'project/upsert'; project: Project }
  | { type: 'stage/upsert'; stage: Stage }
  | { type: 'stage/delete'; id: string }
  | { type: 'photo/upsert'; photo: PhotoRecord }
  | { type: 'photo/delete'; id: string }
  | { type: 'budget/upsert'; budget: BudgetItem }
  | { type: 'budget/delete'; id: string }
  | { type: 'schedule/upsert'; schedule: ScheduleItem }
  | { type: 'schedule/delete'; id: string }
  | { type: 'warranty/upsert'; warranty: WarrantyRecord }
  | { type: 'warranty/delete'; id: string }

function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case 'load/start':
      return { ...state, loadState: 'loading', error: undefined }
    case 'load/success':
      return {
        loadState: 'ready',
        project: action.project,
        stages: action.stages,
        photos: action.photos,
        budgets: action.budgets,
        schedules: action.schedules,
        warranties: action.warranties,
        error: undefined,
      }
    case 'load/error':
      return { ...state, loadState: 'error', error: action.message }
    case 'project/upsert':
      return { ...state, project: action.project }
    case 'stage/upsert': {
      const others = state.stages.filter((s) => s.id !== action.stage.id)
      return { ...state, stages: [...others, action.stage] }
    }
    case 'stage/delete':
      return { ...state, stages: state.stages.filter((s) => s.id !== action.id) }
    case 'photo/upsert': {
      const others = state.photos.filter((p) => p.id !== action.photo.id)
      return { ...state, photos: [...others, action.photo] }
    }
    case 'photo/delete':
      return { ...state, photos: state.photos.filter((p) => p.id !== action.id) }
    case 'budget/upsert': {
      const others = state.budgets.filter((b) => b.id !== action.budget.id)
      return { ...state, budgets: [...others, action.budget] }
    }
    case 'budget/delete':
      return { ...state, budgets: state.budgets.filter((b) => b.id !== action.id) }
    case 'schedule/upsert': {
      const others = state.schedules.filter((s) => s.id !== action.schedule.id)
      return { ...state, schedules: [...others, action.schedule] }
    }
    case 'schedule/delete':
      return { ...state, schedules: state.schedules.filter((s) => s.id !== action.id) }
    case 'warranty/upsert': {
      const others = state.warranties.filter((w) => w.id !== action.warranty.id)
      return { ...state, warranties: [...others, action.warranty] }
    }
    case 'warranty/delete':
      return {
        ...state,
        warranties: state.warranties.filter((w) => w.id !== action.id),
      }
    default: {
      const _exhaustive: never = action
      void _exhaustive
      return state
    }
  }
}

export interface CreateStageArgs {
  input: NewStageInput
}

export interface UpdateStageArgs {
  id: string
  patch: StageEditInput
}

export interface CreatePhotoArgs {
  input: NewPhotoInput
}

export interface CreateBudgetArgs {
  input: NewBudgetItemInput
}

export interface UpdateBudgetArgs {
  id: string
  patch: BudgetItemEditInput
}

export interface CreateScheduleArgs {
  input: NewScheduleItemInput
}

export interface UpdateScheduleArgs {
  id: string
  patch: ScheduleItemEditInput
}

export interface CreateWarrantyArgs {
  input: NewWarrantyItemInput
}

export interface UpdateWarrantyArgs {
  id: string
  patch: WarrantyItemEditInput
}

export interface DashboardActions {
  createStage(args: CreateStageArgs): Promise<Stage>
  updateStage(args: UpdateStageArgs): Promise<Stage>
  deleteStage(id: string): Promise<void>
  updateProject(patch: Partial<Pick<Project, 'name' | 'address' | 'status' | 'plannedStart' | 'plannedEnd'>>): Promise<Project>
  createPhoto(args: CreatePhotoArgs): Promise<PhotoRecord>
  deletePhoto(id: string): Promise<void>
  createBudget(args: CreateBudgetArgs): Promise<BudgetItem>
  updateBudget(args: UpdateBudgetArgs): Promise<BudgetItem>
  deleteBudget(id: string): Promise<void>
  createSchedule(args: CreateScheduleArgs): Promise<ScheduleItem>
  updateSchedule(args: UpdateScheduleArgs): Promise<ScheduleItem>
  deleteSchedule(id: string): Promise<void>
  createWarranty(args: CreateWarrantyArgs): Promise<WarrantyRecord>
  updateWarranty(args: UpdateWarrantyArgs): Promise<WarrantyRecord>
  deleteWarranty(id: string): Promise<void>
}

export interface DashboardContextValue extends DashboardState, DashboardActions {}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export interface DashboardProviderProps {
  children: ReactNode
  /** Override `Date.now()` / `new Date()` — only used by tests. */
  clock?: () => Date
  /** Override the random ID generator — only used by tests. */
  idFactory?: () => string
}

function newId(idFactory?: () => string): string {
  if (idFactory) return idFactory()
  // crypto.randomUUID is available in modern browsers + Node 19+; fall back to
  // a timestamp + counter for environments that lack it (older test runners).
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function nowISO(clock?: () => Date): string {
  const d = clock ? clock() : new Date()
  return d.toISOString()
}

export function DashboardProvider({ children, clock, idFactory }: DashboardProviderProps) {
  const [state, dispatch] = useReducer(reducer, {
    loadState: 'idle',
    project: null,
    stages: [],
    photos: [],
    budgets: [],
    schedules: [],
    warranties: [],
  })

  // Load + seed on mount. The cancelled-flag pattern keeps this safe under
  // React 18 StrictMode (dev), where the effect runs, the cleanup runs, and
  // the effect runs again with a fresh closure. We must NOT gate this with a
  // `useRef(false)` guard: useRef persists across StrictMode mount/unmount,
  // so the second invocation would short-circuit and the dashboard would
  // stay stuck on "載入中…" in the real browser.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      dispatch({ type: 'load/start' })
      try {
        const [projects, stages, photos, budgets, schedules, warranties] = await Promise.all([
          getAllProjects(),
          getAllStages(),
          getAllPhotos(),
          getAllBudgets(),
          getAllSchedules(),
          getAllWarranties(),
        ])
        if (cancelled) return
        if (projects.length === 0) {
          // First run — seed the database.
          const seed = buildSeed({
            idFactory: idFactory ?? (() => newId(idFactory)),
            now: () => nowISO(clock),
          })
          await putProject(seed.project)
          for (const stage of seed.stages) {
            await putStage(stage)
          }
          if (cancelled) return
          dispatch({
            type: 'load/success',
            project: seed.project,
            stages: seed.stages,
            photos: [],
            budgets: [],
            schedules: [],
            warranties: [],
          })
        } else {
          const project = projects[0] ?? null
          dispatch({
            type: 'load/success',
            project,
            stages,
            photos,
            budgets,
            schedules,
            warranties,
          })
        }
      } catch (err) {
        if (cancelled) return
        dispatch({
          type: 'load/error',
          message: err instanceof Error ? err.message : String(err),
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clock, idFactory])

  const createStage = useCallback<DashboardActions['createStage']>(
    async ({ input }) => {
      // Resolve the project up-front so we can validate stage dates against
      // its planned range (PRD/SPEC.md §4.2 / AC-FR001-04).
      const project = state.project ?? (await getAllProjects())[0]
      if (!project) {
        throw new Error('尚無工程資料，無法新增階段')
      }
      const result = validateNewStageInput(input, {
        plannedStart: project.plannedStart,
        plannedEnd: project.plannedEnd,
      })
      if (!result.ok) {
        throw new StageValidationError(result.errors)
      }
      const allStages = state.stages.length > 0
        ? state.stages
        : await getAllStages()
      const now = nowISO(clock)
      const stage: Stage = {
        id: newId(idFactory),
        projectId: input.projectId || project.id,
        name: input.name.trim(),
        order: nextOrder(allStages),
        status: input.status,
        plannedStart: input.plannedStart,
        plannedEnd: input.plannedEnd,
        note: input.note?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      }
      // Apply auto-date rules at creation time too, so a stage created with
      // status=in_progress/completed from the start has its actual dates set.
      const resolved = resolveStatusDates(stage.status, stage, todayISO())
      if (resolved.actualStart) stage.actualStart = resolved.actualStart
      if (resolved.actualEnd) stage.actualEnd = resolved.actualEnd
      await putStage(stage)
      dispatch({ type: 'stage/upsert', stage })
      return stage
    },
    [state.project, state.stages, clock, idFactory],
  )

  const updateStage = useCallback<DashboardActions['updateStage']>(
    async ({ id, patch }) => {
      // Resolve the project up-front so we can validate the patch against its
      // planned range (PRD/SPEC.md §4.2 / AC-FR001-04).
      const project = state.project ?? (await getAllProjects())[0]
      if (!project) {
        throw new Error('尚無工程資料，無法更新階段')
      }
      const result = validateStageInput(patch, {
        plannedStart: project.plannedStart,
        plannedEnd: project.plannedEnd,
      })
      if (!result.ok) {
        throw new StageValidationError(result.errors)
      }
      const current = state.stages.find((s) => s.id === id)
      if (!current) throw new Error(`找不到階段：${id}`)
      const prev: Pick<Stage, 'actualStart' | 'actualEnd'> = {
        actualStart: current.actualStart,
        actualEnd: current.actualEnd,
      }
      const resolved = resolveStatusDates(patch.status, prev, todayISO())
      const updated: Stage = {
        ...current,
        name: patch.name.trim(),
        status: patch.status,
        plannedStart: patch.plannedStart,
        plannedEnd: patch.plannedEnd,
        note: patch.note?.trim() || undefined,
        actualStart: patch.status === 'completed' || patch.status === 'in_progress'
          ? (resolved.actualStart ?? current.actualStart)
          : current.actualStart,
        actualEnd: patch.status === 'completed'
          ? (resolved.actualEnd ?? current.actualEnd)
          : current.actualEnd,
        updatedAt: nowISO(clock),
      }
      if (updated.status === 'completed' && !updated.actualEnd) {
        throw new StageValidationError([
          { field: 'status', message: '完成階段必須有實際完成日期' },
        ])
      }
      await putStage(updated)
      dispatch({ type: 'stage/upsert', stage: updated })
      return updated
    },
    [state.project, state.stages, clock],
  )

  const deleteStage = useCallback<DashboardActions['deleteStage']>(
    async (id) => {
      await dbDeleteStage(id)
      dispatch({ type: 'stage/delete', id })
    },
    [],
  )

  const updateProject = useCallback<DashboardActions['updateProject']>(
    async (patch) => {
      const current = state.project
      if (!current) throw new Error('尚無工程資料')
      const next: Project = {
        ...current,
        ...patch,
        updatedAt: nowISO(clock),
      }
      await putProject(next)
      dispatch({ type: 'project/upsert', project: next })
      return next
    },
    [state.project, clock],
  )

  const createPhoto = useCallback<DashboardActions['createPhoto']>(
    async ({ input }) => {
      const project = state.project ?? (await getAllProjects())[0]
      if (!project) {
        throw new Error('尚無工程資料，無法新增照片')
      }
      const result = validatePhotoInput(input.file, {
        kind: input.kind,
        takenOn: input.takenOn,
        stageId: input.stageId,
      })
      if (!result.ok) {
        throw new PhotoValidationError(result.errors)
      }
      const file = input.file
      const caption = input.caption?.trim()
      const photo: PhotoRecord = {
        id: newId(idFactory),
        projectId: project.id,
        stageId: input.stageId,
        kind: input.kind,
        caption: caption && caption.length > 0 ? caption : undefined,
        takenOn: input.takenOn,
        fileName: file.name || 'photo',
        mimeType: file.type || 'image/*',
        blob: file,
        createdAt: nowISO(clock),
      }
      await putPhoto(photo)
      dispatch({ type: 'photo/upsert', photo })
      return photo
    },
    [state.project, clock, idFactory],
  )

  const deletePhoto = useCallback<DashboardActions['deletePhoto']>(
    async (id) => {
      await dbDeletePhoto(id)
      dispatch({ type: 'photo/delete', id })
    },
    [],
  )

  const createBudget = useCallback<DashboardActions['createBudget']>(
    async ({ input }) => {
      const project = state.project ?? (await getAllProjects())[0]
      if (!project) {
        throw new Error('尚無工程資料，無法新增預算')
      }
      // SPEC §4.5: name + category must be non-empty, amounts must be finite
      // and non-negative with at most two decimal places, paymentStatus must
      // be one of unpaid/partial/paid (FR-003 AC-FR003-02).
      const result = validateNewBudgetInput({ ...input, projectId: input.projectId || project.id })
      if (!result.ok) {
        throw new BudgetValidationError(result.errors)
      }
      const now = nowISO(clock)
      const budget: BudgetItem = {
        id: newId(idFactory),
        projectId: input.projectId || project.id,
        category: input.category.trim(),
        name: input.name.trim(),
        plannedAmount: input.plannedAmount,
        actualAmount: input.actualAmount,
        paymentStatus: input.paymentStatus,
        note: input.note?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      }
      await putBudget(budget)
      dispatch({ type: 'budget/upsert', budget })
      return budget
    },
    [state.project, clock, idFactory],
  )

  const updateBudget = useCallback<DashboardActions['updateBudget']>(
    async ({ id, patch }) => {
      const result = validateBudgetInput(patch)
      if (!result.ok) {
        throw new BudgetValidationError(result.errors)
      }
      const current = state.budgets.find((b) => b.id === id)
      if (!current) throw new Error(`找不到預算項目：${id}`)
      const updated: BudgetItem = {
        ...current,
        category: patch.category.trim(),
        name: patch.name.trim(),
        plannedAmount: patch.plannedAmount,
        actualAmount: patch.actualAmount,
        paymentStatus: patch.paymentStatus,
        note: patch.note?.trim() || undefined,
        updatedAt: nowISO(clock),
      }
      await putBudget(updated)
      dispatch({ type: 'budget/upsert', budget: updated })
      return updated
    },
    [state.budgets, clock],
  )

  const deleteBudget = useCallback<DashboardActions['deleteBudget']>(
    async (id) => {
      await dbDeleteBudget(id)
      dispatch({ type: 'budget/delete', id })
    },
    [],
  )

  const createSchedule = useCallback<DashboardActions['createSchedule']>(
    async ({ input }) => {
      const project = state.project ?? (await getAllProjects())[0]
      if (!project) {
        throw new Error('尚無工程資料，無法新增排程')
      }
      const projectId = input.projectId || project.id
      const allStages =
        state.stages.length > 0 ? state.stages : await getAllStages()
      const stagesForValidation = state.stages.length > 0
        ? state.stages
        : allStages
      const result = validateNewScheduleInput(
        { ...input, projectId },
        { stages: stagesForValidation },
      )
      if (!result.ok) {
        throw new ScheduleValidationError(result.errors)
      }
      const consistencyErrors = assertScheduleProjectConsistency(
        { projectId, stageId: input.stageId },
        { stages: stagesForValidation },
      )
      if (consistencyErrors.length > 0) {
        throw new ScheduleValidationError(consistencyErrors)
      }
      const now = nowISO(clock)
      const schedule: ScheduleItem = {
        id: newId(idFactory),
        projectId,
        stageId: input.stageId,
        workerName: input.workerName.trim(),
        phone: input.phone?.trim() || undefined,
        startOn: input.startOn,
        endOn: input.endOn,
        note: input.note?.trim() || undefined,
        reminderOn: input.reminderOn && input.reminderOn.length > 0
          ? input.reminderOn
          : undefined,
        completed: input.completed ?? false,
        createdAt: now,
        updatedAt: now,
      }
      await putSchedule(schedule)
      dispatch({ type: 'schedule/upsert', schedule })
      return schedule
    },
    [state.project, state.stages, clock, idFactory],
  )

  const updateSchedule = useCallback<DashboardActions['updateSchedule']>(
    async ({ id, patch }) => {
      const current = state.schedules.find((s) => s.id === id)
      if (!current) throw new Error(`找不到排程：${id}`)
      const stagesForValidation = state.stages.length > 0
        ? state.stages
        : await getAllStages()
      const result = validateScheduleInput(patch, { stages: stagesForValidation })
      if (!result.ok) {
        throw new ScheduleValidationError(result.errors)
      }
      const consistencyErrors = assertScheduleProjectConsistency(
        { projectId: current.projectId, stageId: patch.stageId },
        { stages: stagesForValidation },
      )
      if (consistencyErrors.length > 0) {
        throw new ScheduleValidationError(consistencyErrors)
      }
      const updated: ScheduleItem = {
        ...current,
        stageId: patch.stageId,
        workerName: patch.workerName.trim(),
        phone: patch.phone?.trim() || undefined,
        startOn: patch.startOn,
        endOn: patch.endOn,
        note: patch.note?.trim() || undefined,
        reminderOn: patch.reminderOn && patch.reminderOn.length > 0
          ? patch.reminderOn
          : undefined,
        completed: patch.completed,
        updatedAt: nowISO(clock),
      }
      await putSchedule(updated)
      dispatch({ type: 'schedule/upsert', schedule: updated })
      return updated
    },
    [state.schedules, state.stages, clock],
  )

  const deleteSchedule = useCallback<DashboardActions['deleteSchedule']>(
    async (id) => {
      await dbDeleteSchedule(id)
      dispatch({ type: 'schedule/delete', id })
    },
    [],
  )

  const createWarranty = useCallback<DashboardActions['createWarranty']>(
    async ({ input }) => {
      const project = state.project ?? (await getAllProjects())[0]
      if (!project) {
        throw new Error('尚無工程資料，無法新增保固')
      }
      const projectId = input.projectId || project.id
      const errors = validateNewWarrantyInput({ ...input, projectId })
      if (!isWarrantyValid(errors)) {
        throw new WarrantyValidationError(errors)
      }
      const now = nowISO(clock)
      const warranty: WarrantyRecord = {
        id: newId(idFactory),
        projectId,
        itemName: input.itemName.trim(),
        provider: input.provider.trim(),
        contact: input.contact?.trim() || undefined,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        note: input.note?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      }
      await putWarranty(warranty)
      dispatch({ type: 'warranty/upsert', warranty })
      return warranty
    },
    [state.project, clock, idFactory],
  )

  const updateWarranty = useCallback<DashboardActions['updateWarranty']>(
    async ({ id, patch }) => {
      const current = state.warranties.find((w) => w.id === id)
      if (!current) throw new Error(`找不到保固紀錄：${id}`)
      const errors = validateWarrantyEditInput(patch)
      if (!isWarrantyValid(errors)) {
        throw new WarrantyValidationError(errors)
      }
      const updated: WarrantyRecord = {
        ...current,
        itemName: patch.itemName.trim(),
        provider: patch.provider.trim(),
        contact: patch.contact?.trim() || undefined,
        startsOn: patch.startsOn,
        endsOn: patch.endsOn,
        note: patch.note?.trim() || undefined,
        updatedAt: nowISO(clock),
      }
      await putWarranty(updated)
      dispatch({ type: 'warranty/upsert', warranty: updated })
      return updated
    },
    [state.warranties, clock],
  )

  const deleteWarranty = useCallback<DashboardActions['deleteWarranty']>(
    async (id) => {
      await dbDeleteWarranty(id)
      dispatch({ type: 'warranty/delete', id })
    },
    [],
  )

  const sortedStages = useMemo(() => [...state.stages].sort(compareStageOrder), [state.stages])

  const value = useMemo<DashboardContextValue>(
    () => ({
      ...state,
      stages: sortedStages,
      createStage,
      updateStage,
      deleteStage,
      updateProject,
      createPhoto,
      deletePhoto,
      createBudget,
      updateBudget,
      deleteBudget,
      createSchedule,
      updateSchedule,
      deleteSchedule,
      createWarranty,
      updateWarranty,
      deleteWarranty,
    }),
    [
      state,
      sortedStages,
      createStage,
      updateStage,
      deleteStage,
      updateProject,
      createPhoto,
      deletePhoto,
      createBudget,
      updateBudget,
      deleteBudget,
      createSchedule,
      updateSchedule,
      deleteSchedule,
      createWarranty,
      updateWarranty,
      deleteWarranty,
    ],
  )

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used inside <DashboardProvider>')
  return ctx
}

export class StageValidationError extends Error {
  errors: { field: string; message: string }[]
  constructor(errors: { field: string; message: string }[]) {
    super(errors.map((e) => e.message).join('；'))
    this.name = 'StageValidationError'
    this.errors = errors
  }
}

export class PhotoValidationError extends Error {
  errors: { field: string; message: string }[]
  constructor(errors: { field: string; message: string }[]) {
    super(errors.map((e) => e.message).join('；'))
    this.name = 'PhotoValidationError'
    this.errors = errors
  }
}

export class BudgetValidationError extends Error {
  errors: { field: string; message: string }[]
  constructor(errors: { field: string; message: string }[]) {
    super(errors.map((e) => e.message).join('；'))
    this.name = 'BudgetValidationError'
    this.errors = errors
  }
}

export class ScheduleValidationError extends Error {
  errors: ValidationError[]
  constructor(errors: ValidationError[]) {
    super(errors.map((e) => e.message).join('；'))
    this.name = 'ScheduleValidationError'
    this.errors = errors
  }
}

export class WarrantyValidationError extends Error {
  errors: Record<string, string | undefined>
  constructor(errors: Record<string, string | undefined>) {
    super(
      Object.values(errors)
        .filter((m): m is string => Boolean(m))
        .join('；'),
    )
    this.name = 'WarrantyValidationError'
    this.errors = errors
  }
}

export const __seedStageCount = SEED_STAGE_NAMES.length

/** Helper used by tests to ensure no stages remain after a delete. */
export async function _deleteAllStagesForTests(): Promise<void> {
  await deleteStagesByProject('*')
  void getAllStages // keep import referenced for type completeness
}

export type { ProjectStatus, StageStatus }
