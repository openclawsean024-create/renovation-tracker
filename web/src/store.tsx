// Centralised application store backed by IndexedDB. Single project / many
// stages for FR-001, plus photo records (Blob) for FR-002, budget items for
// FR-003, schedule items for FR-005, warranties for FR-006 and — since M1 —
// change orders (FR-007), contract figures (FR-008) and per-stage acceptance
// items (FR-009). Exposes a small action surface via the useDashboard hook.

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
  deleteAcceptanceItem as dbDeleteAcceptanceItem,
  deleteAcceptanceItemsByStage,
  deleteBudget as dbDeleteBudget,
  deleteChangeOrder as dbDeleteChangeOrder,
  deletePhoto as dbDeletePhoto,
  deleteSchedule as dbDeleteSchedule,
  deleteStage as dbDeleteStage,
  deleteStagesByProject,
  deleteWarranty as dbDeleteWarranty,
  getAllAcceptanceItems,
  getAllBudgets,
  getAllChangeOrders,
  getAllContracts,
  getAllPhotos,
  getAllProjects,
  getAllSchedules,
  getAllStages,
  getAllWarranties,
  putAcceptanceItem,
  putBudget,
  putChangeOrder,
  putContract,
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
import { formatLocalISO, todayISO } from './dates'
import {
  canEditChangeOrder,
  decideChangeOrder as applyChangeOrderDecision,
  validateChangeOrderInput,
  validateNewChangeOrderInput,
} from './changeOrders'
import { validateContractInput } from './contract'
import {
  toggleAcceptancePassed,
  validateAcceptanceInput,
  validateNewAcceptanceInput,
} from './acceptance'
import { validatePhotoInput } from './photos'
import { validateBudgetInput, validateNewBudgetInput } from './budget'
import {
  isWarrantyValid,
  validateNewWarrantyInput,
  validateWarrantyEditInput,
} from './warranty'
import type {
  AcceptanceItem,
  AcceptanceItemEditInput,
  BudgetItem,
  BudgetItemEditInput,
  ChangeOrder,
  ChangeOrderEditInput,
  ContractRecord,
  NewAcceptanceItemInput,
  NewBudgetItemInput,
  NewChangeOrderInput,
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
  /** FR-007 change orders (追加減). */
  changeOrders: ChangeOrder[]
  /** FR-008 contract figures; `null` until the user saves them once. */
  contract: ContractRecord | null
  /** FR-009 per-stage acceptance items. */
  acceptanceItems: AcceptanceItem[]
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
      changeOrders: ChangeOrder[]
      contract: ContractRecord | null
      acceptanceItems: AcceptanceItem[]
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
  | { type: 'changeOrder/upsert'; order: ChangeOrder }
  | { type: 'changeOrder/delete'; id: string }
  | { type: 'contract/upsert'; contract: ContractRecord }
  | { type: 'acceptance/upsert'; item: AcceptanceItem }
  | { type: 'acceptance/delete'; id: string }
  | { type: 'acceptance/deleteByStage'; stageId: string }

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
        changeOrders: action.changeOrders,
        contract: action.contract,
        acceptanceItems: action.acceptanceItems,
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
    case 'changeOrder/upsert': {
      const others = state.changeOrders.filter((c) => c.id !== action.order.id)
      return { ...state, changeOrders: [...others, action.order] }
    }
    case 'changeOrder/delete':
      return {
        ...state,
        changeOrders: state.changeOrders.filter((c) => c.id !== action.id),
      }
    case 'contract/upsert':
      return { ...state, contract: action.contract }
    case 'acceptance/upsert': {
      const others = state.acceptanceItems.filter((a) => a.id !== action.item.id)
      return { ...state, acceptanceItems: [...others, action.item] }
    }
    case 'acceptance/delete':
      return {
        ...state,
        acceptanceItems: state.acceptanceItems.filter((a) => a.id !== action.id),
      }
    case 'acceptance/deleteByStage':
      return {
        ...state,
        acceptanceItems: state.acceptanceItems.filter((a) => a.stageId !== action.stageId),
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

export interface CreateChangeOrderArgs {
  input: NewChangeOrderInput
}

export interface UpdateChangeOrderArgs {
  id: string
  patch: ChangeOrderEditInput
}

export interface DecideChangeOrderArgs {
  id: string
  decision: 'approved' | 'rejected'
}

export interface UpdateContractArgs {
  contractAmount: number
  receivedAmount: number
}

export interface CreateAcceptanceItemArgs {
  input: NewAcceptanceItemInput
}

export interface UpdateAcceptanceItemArgs {
  id: string
  patch: AcceptanceItemEditInput
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
  createChangeOrder(args: CreateChangeOrderArgs): Promise<ChangeOrder>
  /** Only `pending` orders can be edited (SPEC §12.1). */
  updateChangeOrder(args: UpdateChangeOrderArgs): Promise<ChangeOrder>
  deleteChangeOrder(id: string): Promise<void>
  /** Record the approve / reject decision — an in-app status only. */
  decideChangeOrder(args: DecideChangeOrderArgs): Promise<ChangeOrder>
  updateContract(args: UpdateContractArgs): Promise<ContractRecord>
  createAcceptanceItem(args: CreateAcceptanceItemArgs): Promise<AcceptanceItem>
  updateAcceptanceItem(args: UpdateAcceptanceItemArgs): Promise<AcceptanceItem>
  deleteAcceptanceItem(id: string): Promise<void>
  /** Flip `passed`; turning it on stamps `checkedOn` with today. */
  toggleAcceptanceItem(id: string): Promise<AcceptanceItem>
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

/** Local `YYYY-MM-DD` for "today", honouring the injected test clock. */
function todayFromClock(clock?: () => Date): string {
  return clock ? formatLocalISO(clock()) : todayISO()
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
    changeOrders: [],
    contract: null,
    acceptanceItems: [],
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
            changeOrders: [],
            contract: null,
            acceptanceItems: [],
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
            changeOrders,
            contract: project
              ? (contracts.find((c) => c.projectId === project.id) ?? null)
              : null,
            acceptanceItems,
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
      // FR-009: acceptance items cannot outlive their stage.
      await deleteAcceptanceItemsByStage(id)
      dispatch({ type: 'stage/delete', id })
      dispatch({ type: 'acceptance/deleteByStage', stageId: id })
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
      // Clearing the address removes the field entirely, so nothing about it
      // is stored or shared (AC-005).
      if ('address' in patch && !patch.address) delete next.address
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

  // ---------- FR-007 change orders ----------

  const createChangeOrder = useCallback<DashboardActions['createChangeOrder']>(
    async ({ input }) => {
      const project = state.project ?? (await getAllProjects())[0]
      if (!project) {
        throw new Error('尚無工程資料，無法新增變更單')
      }
      const projectId = input.projectId || project.id
      const result = validateNewChangeOrderInput({ ...input, projectId })
      if (!result.ok) {
        throw new ChangeOrderValidationError(result.errors)
      }
      const now = nowISO(clock)
      const order: ChangeOrder = {
        id: newId(idFactory),
        projectId,
        stageId: input.stageId,
        title: input.title.trim(),
        amount: input.amount,
        material: input.material?.trim() || undefined,
        note: input.note?.trim() || undefined,
        // SPEC §12.1: every new order starts as pending.
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      }
      await putChangeOrder(order)
      dispatch({ type: 'changeOrder/upsert', order })
      return order
    },
    [state.project, clock, idFactory],
  )

  const updateChangeOrder = useCallback<DashboardActions['updateChangeOrder']>(
    async ({ id, patch }) => {
      const current = state.changeOrders.find((c) => c.id === id)
      if (!current) throw new Error(`找不到變更單：${id}`)
      if (!canEditChangeOrder(current)) {
        throw new ChangeOrderValidationError([
          { field: 'status', message: '已決定的變更單不可再編輯' },
        ])
      }
      const result = validateChangeOrderInput(patch)
      if (!result.ok) {
        throw new ChangeOrderValidationError(result.errors)
      }
      const updated: ChangeOrder = {
        ...current,
        stageId: patch.stageId,
        title: patch.title.trim(),
        amount: patch.amount,
        material: patch.material?.trim() || undefined,
        note: patch.note?.trim() || undefined,
        updatedAt: nowISO(clock),
      }
      await putChangeOrder(updated)
      dispatch({ type: 'changeOrder/upsert', order: updated })
      return updated
    },
    [state.changeOrders, clock],
  )

  const deleteChangeOrder = useCallback<DashboardActions['deleteChangeOrder']>(
    async (id) => {
      await dbDeleteChangeOrder(id)
      dispatch({ type: 'changeOrder/delete', id })
    },
    [],
  )

  const decideChangeOrder = useCallback<DashboardActions['decideChangeOrder']>(
    async ({ id, decision }) => {
      const current = state.changeOrders.find((c) => c.id === id)
      if (!current) throw new Error(`找不到變更單：${id}`)
      const updated = applyChangeOrderDecision(
        current,
        decision,
        todayFromClock(clock),
        nowISO(clock),
      )
      await putChangeOrder(updated)
      dispatch({ type: 'changeOrder/upsert', order: updated })
      return updated
    },
    [state.changeOrders, clock],
  )

  // ---------- FR-008 contract & receipts ----------

  const updateContract = useCallback<DashboardActions['updateContract']>(
    async ({ contractAmount, receivedAmount }) => {
      const project = state.project ?? (await getAllProjects())[0]
      if (!project) {
        throw new Error('尚無工程資料，無法儲存合約金額')
      }
      const result = validateContractInput({ contractAmount, receivedAmount })
      if (!result.ok) {
        throw new ContractValidationError(result.errors)
      }
      const contract: ContractRecord = {
        projectId: project.id,
        contractAmount,
        receivedAmount,
        updatedAt: nowISO(clock),
      }
      await putContract(contract)
      dispatch({ type: 'contract/upsert', contract })
      return contract
    },
    [state.project, clock],
  )

  // ---------- FR-009 acceptance checklist ----------

  const createAcceptanceItem = useCallback<DashboardActions['createAcceptanceItem']>(
    async ({ input }) => {
      const project = state.project ?? (await getAllProjects())[0]
      if (!project) {
        throw new Error('尚無工程資料，無法新增驗收項目')
      }
      const projectId = input.projectId || project.id
      const stages = state.stages.length > 0 ? state.stages : await getAllStages()
      const result = validateNewAcceptanceInput({ ...input, projectId }, { stages })
      if (!result.ok) {
        throw new AcceptanceValidationError(result.errors)
      }
      const now = nowISO(clock)
      const item: AcceptanceItem = {
        id: newId(idFactory),
        projectId,
        stageId: input.stageId,
        name: input.name.trim(),
        passed: false,
        note: input.note?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      }
      await putAcceptanceItem(item)
      dispatch({ type: 'acceptance/upsert', item })
      return item
    },
    [state.project, state.stages, clock, idFactory],
  )

  const updateAcceptanceItem = useCallback<DashboardActions['updateAcceptanceItem']>(
    async ({ id, patch }) => {
      const current = state.acceptanceItems.find((a) => a.id === id)
      if (!current) throw new Error(`找不到驗收項目：${id}`)
      const result = validateAcceptanceInput(patch)
      if (!result.ok) {
        throw new AcceptanceValidationError(result.errors)
      }
      const updated: AcceptanceItem = {
        ...current,
        name: patch.name.trim(),
        note: patch.note?.trim() || undefined,
        updatedAt: nowISO(clock),
      }
      await putAcceptanceItem(updated)
      dispatch({ type: 'acceptance/upsert', item: updated })
      return updated
    },
    [state.acceptanceItems, clock],
  )

  const deleteAcceptanceItem = useCallback<DashboardActions['deleteAcceptanceItem']>(
    async (id) => {
      await dbDeleteAcceptanceItem(id)
      dispatch({ type: 'acceptance/delete', id })
    },
    [],
  )

  const toggleAcceptanceItem = useCallback<DashboardActions['toggleAcceptanceItem']>(
    async (id) => {
      const current = state.acceptanceItems.find((a) => a.id === id)
      if (!current) throw new Error(`找不到驗收項目：${id}`)
      const updated = toggleAcceptancePassed(current, todayFromClock(clock), nowISO(clock))
      await putAcceptanceItem(updated)
      dispatch({ type: 'acceptance/upsert', item: updated })
      return updated
    },
    [state.acceptanceItems, clock],
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
      createChangeOrder,
      updateChangeOrder,
      deleteChangeOrder,
      decideChangeOrder,
      updateContract,
      createAcceptanceItem,
      updateAcceptanceItem,
      deleteAcceptanceItem,
      toggleAcceptanceItem,
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
      createChangeOrder,
      updateChangeOrder,
      deleteChangeOrder,
      decideChangeOrder,
      updateContract,
      createAcceptanceItem,
      updateAcceptanceItem,
      deleteAcceptanceItem,
      toggleAcceptanceItem,
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

export class ChangeOrderValidationError extends Error {
  errors: { field: string; message: string }[]
  constructor(errors: { field: string; message: string }[]) {
    super(errors.map((e) => e.message).join('；'))
    this.name = 'ChangeOrderValidationError'
    this.errors = errors
  }
}

export class ContractValidationError extends Error {
  errors: { field: string; message: string }[]
  constructor(errors: { field: string; message: string }[]) {
    super(errors.map((e) => e.message).join('；'))
    this.name = 'ContractValidationError'
    this.errors = errors
  }
}

export class AcceptanceValidationError extends Error {
  errors: { field: string; message: string }[]
  constructor(errors: { field: string; message: string }[]) {
    super(errors.map((e) => e.message).join('；'))
    this.name = 'AcceptanceValidationError'
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
