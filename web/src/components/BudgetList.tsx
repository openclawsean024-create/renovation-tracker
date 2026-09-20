// Budget list — owns the empty state, the rendered rows and the delete-confirm
// flow. Mirrors the responsibilities of PhotoList so the dashboard stays
// consistent. SPEC §8.1 + AC-FR003-01~04.

import { useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { BudgetRow } from './BudgetRow'
import type { BudgetItem } from '../types'
import { sortBudgetsForDisplay } from '../budget'

export interface BudgetListProps {
  budgets: BudgetItem[]
  onEdit: (id: string) => void
  onDelete: (id: string) => Promise<void> | void
}

export function BudgetList({ budgets, onEdit, onDelete }: BudgetListProps) {
  const [pendingDelete, setPendingDelete] = useState<BudgetItem | null>(null)

  if (budgets.length === 0) {
    return (
      <div className="empty-state" data-testid="budget-empty-state">
        <h3>尚未建立預算項目</h3>
        <p>點選上方「新增預算項目」建立第一筆紀錄，所有資料都會保存在本機。</p>
      </div>
    )
  }

  const sorted = sortBudgetsForDisplay(budgets)

  return (
    <div className="budget-list" data-testid="budget-list">
      <ul className="budget-rows">
        {sorted.map((budget) => (
          <BudgetRow
            key={budget.id}
            budget={budget}
            onEdit={() => onEdit(budget.id)}
            onDelete={() => setPendingDelete(budget)}
          />
        ))}
      </ul>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="刪除預算項目"
        description={
          pendingDelete
            ? `確定要刪除「${pendingDelete.category}／${pendingDelete.name}」嗎？此操作無法復原。`
            : ''
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return
          Promise.resolve(onDelete(pendingDelete.id))
            .then(() => setPendingDelete(null))
            .catch(() => undefined)
        }}
      />
    </div>
  )
}