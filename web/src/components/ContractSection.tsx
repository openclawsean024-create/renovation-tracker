// FR-008 contract amount & receipts summary (GOAL AC-002). Shows the original
// contract, Σ approved change orders, adjusted total, received and outstanding
// amounts, and lets the user edit the two base figures. This is the amount
// billed to the homeowner — it is stored apart from the FR-003 cost budget.

import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { ContractValidationError, useDashboard } from '../store'
import { formatBudgetAmount, formatSignedAmount, parseAmountInput } from '../budget'
import {
  contractErrorFor,
  summarizeContract,
  validateContractInput,
  type ContractFieldError,
} from '../contract'

export function ContractSection() {
  const { contract, changeOrders, updateContract } = useDashboard()
  const [formOpen, setFormOpen] = useState(false)
  const summary = useMemo(
    () => summarizeContract(contract, changeOrders),
    [contract, changeOrders],
  )

  return (
    <section className="section" id="contract" aria-labelledby="contract-section-heading">
      <div className="record-section-header">
        <div>
          <h2 id="contract-section-heading">合約與收款</h2>
          <p className="record-section-sub">
            對屋主的合約金額與收款概要，與上方成本預算分開記錄。
          </p>
        </div>
        <button
          type="button"
          className="btn primary edit-control"
          onClick={() => setFormOpen(true)}
          data-testid="edit-contract"
          aria-label="編輯合約與收款金額"
        >
          編輯合約金額
        </button>
      </div>

      <div
        className="budget-summary"
        data-testid="contract-summary"
        role="group"
        aria-label="合約收款概要"
      >
        <div className="budget-summary-cell">
          <span className="label">原合約</span>
          <span className="value" data-testid="contract-original">
            {formatBudgetAmount(summary.contractAmount)}
          </span>
        </div>
        <div className="budget-summary-cell">
          <span className="label">已核准變更合計</span>
          <span className="value" data-testid="contract-approved-changes">
            {formatSignedAmount(summary.approvedChangeTotal)}
          </span>
        </div>
        <div className="budget-summary-cell">
          <span className="label">調整後總額</span>
          <span className="value" data-testid="contract-adjusted-total">
            {formatBudgetAmount(summary.adjustedTotal)}
          </span>
        </div>
        <div className="budget-summary-cell">
          <span className="label">已收</span>
          <span className="value" data-testid="contract-received">
            {formatBudgetAmount(summary.receivedAmount)}
          </span>
        </div>
        <div className="budget-summary-cell">
          <span className="label">待收</span>
          <span
            className="value"
            data-testid="contract-outstanding"
            data-tone={summary.isOverpaid ? 'overrun' : 'normal'}
          >
            {formatSignedAmount(summary.outstanding).replace(/^\+/, '')}
          </span>
        </div>
      </div>

      {summary.isOverpaid ? (
        <p className="record-alert" role="alert" data-testid="contract-overpaid-note">
          <span className="symbol" aria-hidden="true">⚠</span>
          溢收 {formatBudgetAmount(summary.overpaidAmount)}：已收金額超過調整後總額，請確認收款紀錄。
        </p>
      ) : null}

      <p className="record-footnote">
        只有「已核准」的變更單會計入調整後總額；待決定與已拒絕的不計入。
      </p>

      <ContractForm
        open={formOpen}
        initialContractAmount={contract?.contractAmount ?? 0}
        initialReceivedAmount={contract?.receivedAmount ?? 0}
        onCancel={() => setFormOpen(false)}
        onSubmit={async (values) => {
          await updateContract(values)
          setFormOpen(false)
        }}
      />
    </section>
  )
}

interface ContractFormProps {
  open: boolean
  initialContractAmount: number
  initialReceivedAmount: number
  onCancel: () => void
  onSubmit: (values: { contractAmount: number; receivedAmount: number }) => Promise<void>
}

function ContractForm({
  open,
  initialContractAmount,
  initialReceivedAmount,
  onCancel,
  onSubmit,
}: ContractFormProps) {
  const [contractRaw, setContractRaw] = useState('')
  const [receivedRaw, setReceivedRaw] = useState('')
  const [errors, setErrors] = useState<ContractFieldError[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const formId = useId()
  const titleId = `${formId}-title`

  useEffect(() => {
    if (!open) return
    setContractRaw(String(initialContractAmount))
    setReceivedRaw(String(initialReceivedAmount))
    setErrors([])
    setFormError(null)
    setSubmitting(false)
  }, [open, initialContractAmount, initialReceivedAmount])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    const values = {
      contractAmount: parseAmountInput(contractRaw),
      receivedAmount: parseAmountInput(receivedRaw),
    }
    const result = validateContractInput(values)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors([])
    setFormError(null)
    setSubmitting(true)
    try {
      await onSubmit(values)
    } catch (err) {
      if (err instanceof ContractValidationError) {
        setErrors(err.errors as ContractFieldError[])
      } else {
        setFormError(err instanceof Error ? err.message : '儲存失敗')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const contractError = contractErrorFor(errors, 'contractAmount')
  const receivedError = contractErrorFor(errors, 'receivedAmount')

  return (
    <Modal open={open} title="編輯合約與收款金額" onClose={onCancel} labelledById={titleId}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <div className="field">
            <label htmlFor={`${formId}-contract`}>合約金額</label>
            <input
              id={`${formId}-contract`}
              data-testid="contract-amount-input"
              name="contractAmount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={contractRaw}
              onChange={(e) => setContractRaw(e.target.value)}
              aria-invalid={Boolean(contractError)}
              required
            />
            {contractError && (
              <span className="error" role="alert" data-testid="contract-amount-error">
                {contractError}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor={`${formId}-received`}>已收金額</label>
            <input
              id={`${formId}-received`}
              data-testid="contract-received-input"
              name="receivedAmount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={receivedRaw}
              onChange={(e) => setReceivedRaw(e.target.value)}
              aria-invalid={Boolean(receivedError)}
              required
            />
            {receivedError && (
              <span className="error" role="alert" data-testid="contract-received-error">
                {receivedError}
              </span>
            )}
          </div>
        </div>
        <p className="field-hint">金額需為 0 以上、最多兩位小數。已核准的變更單會自動加到調整後總額。</p>
        {formError && (
          <div className="form-feedback" role="alert" data-testid="contract-form-error">
            {formError}
          </div>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="btn"
            onClick={onCancel}
            disabled={submitting}
            data-testid="contract-cancel"
          >
            取消
          </button>
          <button
            type="submit"
            className="btn primary"
            data-testid="contract-submit"
            disabled={submitting}
          >
            {submitting ? '儲存中…' : '儲存'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
