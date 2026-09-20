// Single budget row — renders category, name, planned/actual, payment
// status pill, note, and the per-item overrun badge. Color is always paired
// with a Chinese label (PRD/SPEC.md §1.2 + AC-FR003-03).

import { PAYMENT_STATUS_LABELS, type BudgetItem } from '../types'
import {
  formatBudgetAmount,
  formatSignedAmount,
  isItemOverrun,
  itemOverrunAmount,
} from '../budget'

export interface BudgetRowProps {
  budget: BudgetItem
  onEdit: () => void
  onDelete: () => void
}

export function BudgetRow({ budget, onEdit, onDelete }: BudgetRowProps) {
  const overrun = isItemOverrun(budget)
  const overrunAmount = itemOverrunAmount(budget)
  return (
    <li className="budget-row" data-testid={`budget-row-${budget.id}`}>
      <div className="budget-row-main">
        <div className="budget-row-meta">
          <span className="budget-category" data-testid={`budget-category-${budget.id}`}>
            {budget.category}
          </span>
          <span className="budget-name">{budget.name}</span>
          {overrun && (
            <span
              className="budget-overrun-badge"
              data-testid={`budget-overrun-badge-${budget.id}`}
              data-tone="overrun"
            >
              <span className="symbol" aria-hidden="true">⚠</span>
              <span>超支 {formatBudgetAmount(overrunAmount)}</span>
            </span>
          )}
        </div>
        {budget.note && <p className="budget-note">{budget.note}</p>}
      </div>
      <div className="budget-row-numbers">
        <div className="budget-cell">
          <span className="budget-cell-label">預算</span>
          <span className="budget-cell-value" data-testid={`budget-planned-${budget.id}`}>
            {formatBudgetAmount(budget.plannedAmount)}
          </span>
        </div>
        <div className="budget-cell">
          <span className="budget-cell-label">實際</span>
          <span
            className="budget-cell-value"
            data-testid={`budget-actual-${budget.id}`}
            data-tone={overrun ? 'overrun' : 'normal'}
          >
            {formatBudgetAmount(budget.actualAmount)}
          </span>
        </div>
        <div className="budget-cell">
          <span className="budget-cell-label">差額</span>
          <span
            className="budget-cell-value"
            data-testid={`budget-diff-${budget.id}`}
            data-tone={overrun ? 'overrun' : budget.actualAmount < budget.plannedAmount ? 'positive' : 'neutral'}
          >
            {formatSignedAmount(budget.plannedAmount - budget.actualAmount)}
          </span>
        </div>
        <span
          className="status-pill"
          data-tone={budget.paymentStatus}
          aria-label={`付款狀態：${PAYMENT_STATUS_LABELS[budget.paymentStatus]}`}
          data-testid={`budget-status-${budget.id}`}
        >
          <span className="symbol" aria-hidden="true">
            {budget.paymentStatus === 'paid' ? '●' : budget.paymentStatus === 'partial' ? '◐' : '○'}
          </span>
          <span>{PAYMENT_STATUS_LABELS[budget.paymentStatus]}</span>
        </span>
      </div>
      <div className="budget-row-actions">
        <button
          type="button"
          className="btn"
          onClick={onEdit}
          aria-label={`編輯預算項目 ${budget.name}`}
          data-testid={`budget-edit-${budget.id}`}
        >
          編輯
        </button>
        <button
          type="button"
          className="btn danger"
          onClick={onDelete}
          aria-label={`刪除預算項目 ${budget.name}`}
          data-testid={`budget-delete-${budget.id}`}
        >
          刪除
        </button>
      </div>
    </li>
  )
}