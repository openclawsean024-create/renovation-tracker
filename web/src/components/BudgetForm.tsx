// Budget item form — used for both create and edit. Mirrors the patterns
// used by StageForm / PhotoForm so the dashboard has a consistent modal UX.
// SPEC §4.5 + AC-FR003-02.

import { useEffect, useId, useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUSES,
  type BudgetItem,
  type BudgetItemEditInput,
  type NewBudgetItemInput,
  type PaymentStatus,
} from '../types'
import {
  errorFor,
  parseAmountInput,
  validateBudgetInput,
  type BudgetFieldError,
} from '../budget'

export interface BudgetFormProps {
  open: boolean
  mode: 'create' | 'edit'
  projectId: string
  initialBudget?: BudgetItem
  /** Pre-populated suggested category — usually the most-recently-used value. */
  defaultCategory?: string
  onCancel: () => void
  onSubmitCreate: (input: NewBudgetItemInput) => Promise<void>
  onSubmitEdit: (id: string, patch: BudgetItemEditInput) => Promise<void>
}

const PAYMENT_LABEL_FOR_HELP: Record<PaymentStatus, string> = {
  unpaid: '尚未付款',
  partial: '已付一部分',
  paid: '已全部付清',
}

export function BudgetForm({
  open,
  mode,
  projectId,
  initialBudget,
  defaultCategory,
  onCancel,
  onSubmitCreate,
  onSubmitEdit,
}: BudgetFormProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [plannedRaw, setPlannedRaw] = useState('')
  const [actualRaw, setActualRaw] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<BudgetFieldError[]>([])
  const [submitting, setSubmitting] = useState(false)

  const formId = useId()
  const titleId = `${formId}-title`
  const errorRegionId = `${formId}-errors`

  useEffect(() => {
    if (!open) return
    setName(initialBudget?.name ?? '')
    setCategory(initialBudget?.category ?? defaultCategory ?? '')
    setPlannedRaw(initialBudget ? String(initialBudget.plannedAmount) : '')
    setActualRaw(initialBudget ? String(initialBudget.actualAmount) : '')
    setPaymentStatus(initialBudget?.paymentStatus ?? 'unpaid')
    setNote(initialBudget?.note ?? '')
    setErrors([])
    setSubmitting(false)
  }, [open, initialBudget, defaultCategory])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    const plannedAmount = parseAmountInput(plannedRaw)
    const actualAmount = parseAmountInput(actualRaw)
    const patch = {
      name,
      category,
      plannedAmount,
      actualAmount,
      paymentStatus,
      note,
    }
    const result = validateBudgetInput(patch)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors([])
    setSubmitting(true)
    try {
      if (mode === 'create') {
        await onSubmitCreate({ projectId, ...patch })
      } else if (initialBudget) {
        await onSubmitEdit(initialBudget.id, patch)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '儲存失敗'
      setErrors([{ field: 'name', message: msg }])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? '新增預算項目' : '編輯預算項目'}
      onClose={onCancel}
      labelledById={titleId}
    >
      <form onSubmit={handleSubmit} noValidate aria-describedby={errorRegionId}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor={`${formId}-category`}>分類</label>
            <input
              id={`${formId}-category`}
              data-testid="budget-category-input"
              name="category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-invalid={Boolean(errorFor(errors, 'category'))}
              required
            />
            {errorFor(errors, 'category') && (
              <span className="error" role="alert" data-testid="budget-category-error">
                {errorFor(errors, 'category')}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor={`${formId}-name`}>名稱</label>
            <input
              id={`${formId}-name`}
              data-testid="budget-name-input"
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(errorFor(errors, 'name'))}
              required
            />
            {errorFor(errors, 'name') && (
              <span className="error" role="alert" data-testid="budget-name-error">
                {errorFor(errors, 'name')}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor={`${formId}-planned`}>預算金額</label>
            <input
              id={`${formId}-planned`}
              data-testid="budget-planned-input"
              name="plannedAmount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={plannedRaw}
              onChange={(e) => setPlannedRaw(e.target.value)}
              aria-invalid={Boolean(errorFor(errors, 'plannedAmount'))}
              required
            />
            {errorFor(errors, 'plannedAmount') && (
              <span className="error" role="alert" data-testid="budget-planned-error">
                {errorFor(errors, 'plannedAmount')}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor={`${formId}-actual`}>實際金額</label>
            <input
              id={`${formId}-actual`}
              data-testid="budget-actual-input"
              name="actualAmount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={actualRaw}
              onChange={(e) => setActualRaw(e.target.value)}
              aria-invalid={Boolean(errorFor(errors, 'actualAmount'))}
              required
            />
            {errorFor(errors, 'actualAmount') && (
              <span className="error" role="alert" data-testid="budget-actual-error">
                {errorFor(errors, 'actualAmount')}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor={`${formId}-payment`}>付款狀態</label>
            <select
              id={`${formId}-payment`}
              data-testid="budget-payment-select"
              name="paymentStatus"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
            >
              {PAYMENT_STATUSES.map((p) => (
                <option key={p} value={p}>
                  {PAYMENT_STATUS_LABELS[p]}（{PAYMENT_LABEL_FOR_HELP[p]}）
                </option>
              ))}
            </select>
            {errorFor(errors, 'paymentStatus') && (
              <span className="error" role="alert" data-testid="budget-payment-error">
                {errorFor(errors, 'paymentStatus')}
              </span>
            )}
          </div>

          <div className="field full">
            <label htmlFor={`${formId}-note`}>備註（選填）</label>
            <textarea
              id={`${formId}-note`}
              data-testid="budget-note-input"
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div id={errorRegionId} aria-live="polite">
          {errors.length > 0 && (
            <div className="form-feedback" role="alert" data-testid="budget-form-error">
              {errors.map((e) => e.message).join('；')}
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={submitting}>
            取消
          </button>
          <button
            type="submit"
            className="btn primary"
            data-testid="budget-submit"
            disabled={submitting}
          >
            {submitting ? '儲存中…' : '儲存'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
