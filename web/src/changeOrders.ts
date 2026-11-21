// FR-007 change-order (追加減) domain helpers. See PRD/SPEC.md §12.1 and
// GOAL AC-001. Rewritten from decoration-tracker's browser-storage prototype
// (`addBudgetChange` / `approveBudget` / `rejectBudget`) on top of this repo's
// validation conventions. Two deliberate differences from that prototype:
//   - only `approved` orders count towards the adjusted total (the prototype
//     added the amount as soon as the order was created);
//   - amounts are validated (finite, non-zero, at most two decimals).
//
// The approve / reject decision is an in-app status record made by the
// contractor on the homeowner's behalf. It is not an e-signature.

import { fractionDigitsOf } from './budget'
import {
  CHANGE_ORDER_STATUSES,
  MAX_BUDGET_DECIMALS,
  MAX_MONEY_AMOUNT,
  roundBudgetAmount,
  type ChangeOrder,
  type ChangeOrderEditInput,
  type ChangeOrderStatus,
  type NewChangeOrderInput,
} from './types'

/** Shown wherever a decision is recorded or displayed (SPEC §12.1). */
export const CHANGE_ORDER_LOCAL_NOTICE = '本機紀錄，非屋主線上簽核'

export interface ChangeOrderFieldError {
  field: 'title' | 'amount' | 'stageId' | 'status'
  message: string
}

export interface ChangeOrderValidationResult {
  ok: boolean
  errors: ChangeOrderFieldError[]
}

export function isChangeOrderStatus(
  value: string | null | undefined,
): value is ChangeOrderStatus {
  return (CHANGE_ORDER_STATUSES as readonly string[]).includes(value ?? '')
}

/**
 * SPEC §12.1 rules shared by create and edit:
 *  - `title` must be non-empty after trim;
 *  - `amount` must be a finite, non-zero number with at most two decimals
 *    (negative = 追減 is allowed);
 *  - `stageId`, when provided, must not be an empty string.
 */
export function validateChangeOrderInput(
  input: Partial<NewChangeOrderInput & ChangeOrderEditInput>,
): ChangeOrderValidationResult {
  const errors: ChangeOrderFieldError[] = []

  if ((input.title ?? '').trim().length === 0) {
    errors.push({ field: 'title', message: '變更單標題不可為空' })
  }

  const amount = input.amount
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    errors.push({ field: 'amount', message: '金額必須是有限數字' })
  } else if (amount === 0) {
    errors.push({ field: 'amount', message: '金額不可為 0' })
  } else if (Math.abs(amount) >= MAX_MONEY_AMOUNT) {
    errors.push({ field: 'amount', message: '金額超出可記錄範圍' })
  } else if (fractionDigitsOf(amount) > MAX_BUDGET_DECIMALS) {
    errors.push({ field: 'amount', message: '金額最多兩位小數' })
  }

  if (input.stageId !== undefined && input.stageId.length === 0) {
    errors.push({ field: 'stageId', message: '關聯階段不可為空字串' })
  }

  return { ok: errors.length === 0, errors }
}

/** Create-time validation: additionally requires a non-empty `projectId`. */
export function validateNewChangeOrderInput(
  input: Partial<NewChangeOrderInput>,
): ChangeOrderValidationResult {
  const result = validateChangeOrderInput(input)
  if (input.projectId === undefined || input.projectId.length === 0) {
    result.errors.push({ field: 'title', message: '缺少工程 ID' })
    return { ok: false, errors: result.errors }
  }
  return result
}

/** Look up the first error for a field (form helper). */
export function changeOrderErrorFor(
  errors: ChangeOrderFieldError[],
  field: ChangeOrderFieldError['field'],
): string | undefined {
  return errors.find((e) => e.field === field)?.message
}

/** Only pending orders may be edited or decided (SPEC §12.1). */
export function canEditChangeOrder(order: Pick<ChangeOrder, 'status'>): boolean {
  return order.status === 'pending'
}

export const canDecideChangeOrder = canEditChangeOrder

/**
 * Record an approve / reject decision. Pure: returns a new order and never
 * mutates the input. Throws when the order has already been decided so a
 * decided amount can never be silently re-decided.
 */
export function decideChangeOrder(
  order: ChangeOrder,
  decision: 'approved' | 'rejected',
  today: string,
  nowIso: string,
): ChangeOrder {
  if (!canDecideChangeOrder(order)) {
    throw new Error('已決定的變更單不可再變更')
  }
  return { ...order, status: decision, decidedOn: today, updatedAt: nowIso }
}

/** Σ amount over approved orders, rounded once at the boundary. */
export function sumApprovedChangeOrders(
  orders: ReadonlyArray<Pick<ChangeOrder, 'amount' | 'status'>>,
): number {
  let raw = 0
  for (const order of orders) {
    if (order.status === 'approved') raw += order.amount
  }
  return roundBudgetAmount(raw)
}

export interface ChangeOrderSummary {
  total: number
  counts: Record<ChangeOrderStatus, number>
  /** Σ approved amounts — the only figure that changes the contract total. */
  approvedTotal: number
  /** Σ pending amounts — informational only, never added to the total. */
  pendingTotal: number
}

export function summarizeChangeOrders(
  orders: ReadonlyArray<Pick<ChangeOrder, 'amount' | 'status'>>,
): ChangeOrderSummary {
  const counts: Record<ChangeOrderStatus, number> = { pending: 0, approved: 0, rejected: 0 }
  let pendingRaw = 0
  for (const order of orders) {
    counts[order.status] += 1
    if (order.status === 'pending') pendingRaw += order.amount
  }
  return {
    total: orders.length,
    counts,
    approvedTotal: sumApprovedChangeOrders(orders),
    pendingTotal: roundBudgetAmount(pendingRaw),
  }
}

/** Display order: oldest first (createdAt asc, id asc as tie-breaker). */
export function compareChangeOrders(a: ChangeOrder, b: ChangeOrder): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function sortChangeOrdersForDisplay(orders: ReadonlyArray<ChangeOrder>): ChangeOrder[] {
  return orders.slice().sort(compareChangeOrders)
}
