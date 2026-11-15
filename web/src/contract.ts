// FR-008 contract amount & receipts summary. See PRD/SPEC.md §12.2 and GOAL
// AC-002. Rewritten from decoration-tracker's `Project.total` / `Project.paid`
// as a standalone record: this is the amount billed to the homeowner and is
// deliberately kept apart from the FR-003 cost budget (`budget.ts`).

import { fractionDigitsOf } from './budget'
import { sumApprovedChangeOrders } from './changeOrders'
import {
  MAX_BUDGET_DECIMALS,
  roundBudgetAmount,
  type ChangeOrder,
  type ContractSummaryInput,
} from './types'

export interface ContractFieldError {
  field: 'contractAmount' | 'receivedAmount'
  message: string
}

export interface ContractValidationResult {
  ok: boolean
  errors: ContractFieldError[]
}

function validateAmount(
  field: ContractFieldError['field'],
  value: unknown,
  out: ContractFieldError[],
): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    out.push({ field, message: '金額必須是有限數字' })
    return
  }
  if (value < 0) {
    out.push({ field, message: '金額不可為負數' })
    return
  }
  if (fractionDigitsOf(value) > MAX_BUDGET_DECIMALS) {
    out.push({ field, message: '金額最多兩位小數' })
  }
}

/** Both amounts must be finite, >= 0 and have at most two decimals. */
export function validateContractInput(
  input: Partial<Pick<ContractSummaryInput, 'contractAmount' | 'receivedAmount'>>,
): ContractValidationResult {
  const errors: ContractFieldError[] = []
  validateAmount('contractAmount', input.contractAmount, errors)
  validateAmount('receivedAmount', input.receivedAmount, errors)
  return { ok: errors.length === 0, errors }
}

export function contractErrorFor(
  errors: ContractFieldError[],
  field: ContractFieldError['field'],
): string | undefined {
  return errors.find((e) => e.field === field)?.message
}

export interface ContractSummary {
  /** Original contract amount. */
  contractAmount: number
  /** Σ approved change orders (may be negative). */
  approvedChangeTotal: number
  /** contractAmount + approvedChangeTotal. */
  adjustedTotal: number
  receivedAmount: number
  /** adjustedTotal - receivedAmount. Negative means over-received (溢收). */
  outstanding: number
  isOverpaid: boolean
  /** receivedAmount - adjustedTotal when positive; otherwise 0. */
  overpaidAmount: number
}

/**
 * SPEC §12.2: adjustedTotal = contractAmount + Σ approved ChangeOrder.amount;
 * outstanding = adjustedTotal - receivedAmount. Pending and rejected change
 * orders never affect the totals. A missing contract record counts as 0 / 0.
 */
export function summarizeContract(
  contract: Pick<ContractSummaryInput, 'contractAmount' | 'receivedAmount'> | null | undefined,
  changeOrders: ReadonlyArray<Pick<ChangeOrder, 'amount' | 'status'>>,
): ContractSummary {
  const contractAmount = roundBudgetAmount(contract?.contractAmount ?? 0)
  const receivedAmount = roundBudgetAmount(contract?.receivedAmount ?? 0)
  const approvedChangeTotal = sumApprovedChangeOrders(changeOrders)
  const adjustedTotal = roundBudgetAmount(contractAmount + approvedChangeTotal)
  const outstanding = roundBudgetAmount(adjustedTotal - receivedAmount)
  const isOverpaid = outstanding < 0
  return {
    contractAmount,
    approvedChangeTotal,
    adjustedTotal,
    receivedAmount,
    outstanding,
    isOverpaid,
    overpaidAmount: isOverpaid ? roundBudgetAmount(-outstanding) : 0,
  }
}
