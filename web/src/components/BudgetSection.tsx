// Budget section — summary header + create/edit modal + list. Rendered
// inside <Dashboard>. SPEC §8.1 + AC-FR003-01~04.

import { useCallback, useMemo, useState } from 'react'
import { BudgetForm } from './BudgetForm'
import { BudgetList } from './BudgetList'
import { useDashboard, BudgetValidationError } from '../store'
import {
  formatBudgetAmount,
  formatSignedAmount,
  listOverrunItems,
  summarizeBudget,
} from '../budget'
import type { BudgetItem, BudgetItemEditInput, NewBudgetItemInput } from '../types'

type FormState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; budget: BudgetItem }

export function BudgetSection() {
  const { budgets, createBudget, updateBudget, deleteBudget } = useDashboard()
  const [form, setForm] = useState<FormState>({ mode: 'closed' })

  const summary = useMemo(() => summarizeBudget(budgets), [budgets])
  const overrunItems = useMemo(() => listOverrunItems(budgets), [budgets])

  const suggestedCategory = useMemo(() => {
    // Most-recently-created category — small UX win when creating many items.
    if (budgets.length === 0) return ''
    return budgets[budgets.length - 1]?.category ?? ''
  }, [budgets])

  const handleCreate = useCallback(
    async (input: NewBudgetItemInput) => {
      await createBudget({ input })
      setForm({ mode: 'closed' })
    },
    [createBudget],
  )

  const handleEdit = useCallback(
    async (id: string, patch: BudgetItemEditInput) => {
      await updateBudget({ id, patch })
      setForm({ mode: 'closed' })
    },
    [updateBudget],
  )

  return (
    <section className="section" id="budget" aria-labelledby="budget-section-heading">
      <div className="budget-section-header">
        <div>
          <h2 id="budget-section-heading">預算追蹤</h2>
          <p className="budget-section-sub">
            共 {summary.total} 筆（未付款 {summary.paymentCounts.unpaid} · 部分付款 {summary.paymentCounts.partial} · 已付款 {summary.paymentCounts.paid}）
          </p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => setForm({ mode: 'create' })}
          data-testid="add-budget"
          aria-label="新增預算項目"
        >
          新增預算項目
        </button>
      </div>

      <BudgetSummaryView summary={summary} overrunItems={overrunItems} />

      <BudgetList
        budgets={budgets}
        onEdit={(id) => {
          const target = budgets.find((b) => b.id === id)
          if (target) setForm({ mode: 'edit', budget: target })
        }}
        onDelete={(id) => deleteBudget(id).catch(() => undefined)}
      />

      <BudgetForm
        open={form.mode === 'create' || form.mode === 'edit'}
        mode={form.mode === 'edit' ? 'edit' : 'create'}
        projectId=""
        defaultCategory={suggestedCategory}
        initialBudget={form.mode === 'edit' ? form.budget : undefined}
        onCancel={() => setForm({ mode: 'closed' })}
        onSubmitCreate={async (input) => {
          try {
            await handleCreate(input)
          } catch (err) {
            if (err instanceof BudgetValidationError) throw err
            throw err
          }
        }}
        onSubmitEdit={async (id, patch) => {
          try {
            await handleEdit(id, patch)
          } catch (err) {
            if (err instanceof BudgetValidationError) throw err
            throw err
          }
        }}
      />
    </section>
  )
}

interface BudgetSummaryViewProps {
  summary: ReturnType<typeof summarizeBudget>
  overrunItems: BudgetItem[]
}

function BudgetSummaryView({ summary, overrunItems }: BudgetSummaryViewProps) {
  return (
    <div
      className="budget-summary"
      data-testid="budget-summary"
      role="group"
      aria-label="預算總覽"
    >
      <div className="budget-summary-cell">
        <span className="label">總預算</span>
        <span className="value" data-testid="budget-summary-planned">
          {formatBudgetAmount(summary.totalPlanned)}
        </span>
      </div>
      <div className="budget-summary-cell">
        <span className="label">實際支出</span>
        <span
          className="value"
          data-testid="budget-summary-actual"
          data-tone={summary.isOverrun ? 'overrun' : 'normal'}
        >
          {formatBudgetAmount(summary.totalActual)}
        </span>
      </div>
      <div className="budget-summary-cell">
        <span className="label">剩餘金額</span>
        <span
          className="value"
          data-testid="budget-summary-remaining"
          data-tone={summary.remaining < 0 ? 'overrun' : summary.remaining > 0 ? 'positive' : 'neutral'}
        >
          {formatSignedAmount(summary.remaining)}
        </span>
      </div>
      <div className="budget-summary-cell">
        <span className="label">超支狀態</span>
        <span
          className="value"
          data-testid="budget-summary-overrun-status"
          data-tone={summary.isOverrun ? 'overrun' : 'neutral'}
        >
          {summary.isOverrun
            ? `超支 ${formatBudgetAmount(summary.totalOverrun)}`
            : '未超支'}
        </span>
      </div>

      {summary.isOverrun && overrunItems.length > 0 && (
        <div
          className="budget-overrun-alert"
          role="alert"
          data-testid="budget-overrun-alert"
          data-tone="overrun"
        >
          <span className="symbol" aria-hidden="true">⚠</span>
          <div>
            <p className="budget-overrun-title">預算總計已超支</p>
            <p className="budget-overrun-detail">
              超支 {formatBudgetAmount(summary.totalOverrun)}，共 {overrunItems.length} 個項目超過預算。
              {overrunItems.length <= 3 && (
                <>
                  {' '}
                  超支項目：
                  {overrunItems
                    .map((b) => `${b.category}／${b.name}`)
                    .join('、')}
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}