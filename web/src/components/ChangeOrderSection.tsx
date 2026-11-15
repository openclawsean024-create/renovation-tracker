// FR-007 change orders (追加減) — GOAL AC-001. Add / edit (pending only) /
// delete (with confirm) / approve / reject. Only approved orders feed the
// adjusted contract total shown in <ContractSection>.
//
// "核准 / 拒絕" here is the contractor recording the homeowner's decision in
// this app. It is a local status record, not an e-signature, and the UI says
// so explicitly (SPEC §12.1, §17).

import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { ConfirmDialog } from './ConfirmDialog'
import { ChangeOrderValidationError, useDashboard } from '../store'
import { formatSignedAmount, parseAmountInput } from '../budget'
import { displayDate } from '../dates'
import {
  CHANGE_ORDER_LOCAL_NOTICE,
  canEditChangeOrder,
  changeOrderErrorFor,
  sortChangeOrdersForDisplay,
  summarizeChangeOrders,
  validateChangeOrderInput,
  type ChangeOrderFieldError,
} from '../changeOrders'
import {
  CHANGE_ORDER_STATUS_LABELS,
  type ChangeOrder,
  type ChangeOrderEditInput,
  type ChangeOrderStatus,
  type NewChangeOrderInput,
  type Stage,
} from '../types'

type FormState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; order: ChangeOrder }

const STATUS_SYMBOL: Record<ChangeOrderStatus, string> = {
  pending: '○',
  approved: '●',
  rejected: '✕',
}

const STATUS_TONE: Record<ChangeOrderStatus, string> = {
  pending: 'planning',
  approved: 'completed',
  rejected: 'blocked',
}

export function ChangeOrderStatusPill({
  status,
  testId,
}: {
  status: ChangeOrderStatus
  testId?: string
}) {
  return (
    <span
      className="status-pill"
      data-tone={STATUS_TONE[status]}
      data-status={status}
      data-testid={testId}
      aria-label={`變更單狀態：${CHANGE_ORDER_STATUS_LABELS[status]}`}
    >
      <span className="symbol" aria-hidden="true">{STATUS_SYMBOL[status]}</span>
      <span>{CHANGE_ORDER_STATUS_LABELS[status]}</span>
    </span>
  )
}

export function ChangeOrderSection() {
  const {
    changeOrders,
    stages,
    createChangeOrder,
    updateChangeOrder,
    deleteChangeOrder,
    decideChangeOrder,
  } = useDashboard()
  const [form, setForm] = useState<FormState>({ mode: 'closed' })
  const [pendingDelete, setPendingDelete] = useState<ChangeOrder | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const sorted = useMemo(() => sortChangeOrdersForDisplay(changeOrders), [changeOrders])
  const summary = useMemo(() => summarizeChangeOrders(changeOrders), [changeOrders])
  const stageNames = useMemo(() => {
    const m: Record<string, string> = {}
    for (const s of stages) m[s.id] = s.name
    return m
  }, [stages])

  function decide(order: ChangeOrder, decision: 'approved' | 'rejected') {
    setActionError(null)
    decideChangeOrder({ id: order.id, decision }).catch((err: unknown) => {
      setActionError(err instanceof Error ? err.message : '無法更新變更單狀態')
    })
  }

  return (
    <section className="section" id="change-orders" aria-labelledby="change-order-section-heading">
      <div className="record-section-header">
        <div>
          <h2 id="change-order-section-heading">預算變更單</h2>
          <p className="record-section-sub" data-testid="change-order-summary">
            共 {summary.total} 筆（待決定 {summary.counts.pending} · 已核准 {summary.counts.approved} · 已拒絕 {summary.counts.rejected}）
          </p>
        </div>
        <button
          type="button"
          className="btn primary edit-control"
          onClick={() => setForm({ mode: 'create' })}
          data-testid="add-change-order"
          aria-label="新增變更單"
        >
          新增變更單
        </button>
      </div>

      <p className="record-notice" data-testid="change-order-local-notice">
        <span className="symbol" aria-hidden="true">ⓘ</span>
        {CHANGE_ORDER_LOCAL_NOTICE}。核准／拒絕由業者在本機代為記錄屋主的決定，不是電子簽章，也不具契約效力。
      </p>

      {actionError ? (
        <p className="record-alert" role="alert" data-testid="change-order-action-error">
          {actionError}
        </p>
      ) : null}

      {sorted.length === 0 ? (
        <div className="empty-state" data-testid="change-order-empty-state">
          <h3>尚未建立變更單</h3>
          <p>有追加或追減時，點選「新增變更單」留下紀錄；核准後才會計入調整後總額。</p>
        </div>
      ) : (
        <ul className="record-list" data-testid="change-order-list">
          {sorted.map((order) => {
            const editable = canEditChangeOrder(order)
            const stageName = order.stageId ? stageNames[order.stageId] : undefined
            return (
              <li
                key={order.id}
                className="record-row"
                data-testid={`change-order-row-${order.id}`}
                data-status={order.status}
              >
                <div className="record-row-main">
                  <div className="record-row-header">
                    <p className="record-name">{order.title}</p>
                    <ChangeOrderStatusPill
                      status={order.status}
                      testId={`change-order-status-${order.id}`}
                    />
                    <span
                      className="record-amount"
                      data-testid={`change-order-amount-${order.id}`}
                      data-tone={order.amount < 0 ? 'decrease' : 'increase'}
                    >
                      {order.amount < 0 ? '追減 ' : '追加 '}
                      {formatSignedAmount(order.amount)}
                    </span>
                  </div>
                  <div className="record-meta">
                    {stageName && <span>關聯階段：{stageName}</span>}
                    {order.material && <span>材料：{order.material}</span>}
                    {order.decidedOn && (
                      <span data-testid={`change-order-decided-on-${order.id}`}>
                        {order.status === 'approved' ? '核准' : '拒絕'}紀錄日：{displayDate(order.decidedOn)}
                      </span>
                    )}
                    {order.note && <span>備註：{order.note}</span>}
                  </div>
                </div>
                <div className="record-actions edit-control">
                  {editable ? (
                    <>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => decide(order, 'approved')}
                        aria-label={`核准變更單 ${order.title}`}
                        data-testid={`change-order-approve-${order.id}`}
                      >
                        核准
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => decide(order, 'rejected')}
                        aria-label={`拒絕變更單 ${order.title}`}
                        data-testid={`change-order-reject-${order.id}`}
                      >
                        拒絕
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setForm({ mode: 'edit', order })}
                        aria-label={`編輯變更單 ${order.title}`}
                        data-testid={`change-order-edit-${order.id}`}
                      >
                        編輯
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => setPendingDelete(order)}
                    aria-label={`刪除變更單 ${order.title}`}
                    data-testid={`change-order-delete-${order.id}`}
                  >
                    刪除
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ChangeOrderForm
        open={form.mode !== 'closed'}
        mode={form.mode === 'edit' ? 'edit' : 'create'}
        stages={stages}
        initialOrder={form.mode === 'edit' ? form.order : undefined}
        onCancel={() => setForm({ mode: 'closed' })}
        onSubmitCreate={async (input) => {
          await createChangeOrder({ input })
          setForm({ mode: 'closed' })
        }}
        onSubmitEdit={async (id, patch) => {
          await updateChangeOrder({ id, patch })
          setForm({ mode: 'closed' })
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="刪除變更單"
        description={
          pendingDelete
            ? `確定要刪除變更單「${pendingDelete.title}」嗎？此操作無法復原。`
            : ''
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return
          deleteChangeOrder(pendingDelete.id)
            .then(() => setPendingDelete(null))
            .catch(() => undefined)
        }}
      />
    </section>
  )
}

interface ChangeOrderFormProps {
  open: boolean
  mode: 'create' | 'edit'
  stages: ReadonlyArray<Stage>
  initialOrder?: ChangeOrder
  onCancel: () => void
  onSubmitCreate: (input: NewChangeOrderInput) => Promise<void>
  onSubmitEdit: (id: string, patch: ChangeOrderEditInput) => Promise<void>
}

function ChangeOrderForm({
  open,
  mode,
  stages,
  initialOrder,
  onCancel,
  onSubmitCreate,
  onSubmitEdit,
}: ChangeOrderFormProps) {
  const [title, setTitle] = useState('')
  const [amountRaw, setAmountRaw] = useState('')
  const [stageId, setStageId] = useState('')
  const [material, setMaterial] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<ChangeOrderFieldError[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const formId = useId()
  const titleId = `${formId}-title`

  useEffect(() => {
    if (!open) return
    setTitle(initialOrder?.title ?? '')
    setAmountRaw(initialOrder ? String(initialOrder.amount) : '')
    setStageId(initialOrder?.stageId ?? '')
    setMaterial(initialOrder?.material ?? '')
    setNote(initialOrder?.note ?? '')
    setErrors([])
    setFormError(null)
    setSubmitting(false)
  }, [open, initialOrder])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    const patch: ChangeOrderEditInput = {
      title,
      amount: parseAmountInput(amountRaw),
      stageId: stageId.length > 0 ? stageId : undefined,
      material,
      note,
    }
    const result = validateChangeOrderInput(patch)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors([])
    setFormError(null)
    setSubmitting(true)
    try {
      if (mode === 'create') {
        await onSubmitCreate({ projectId: '', ...patch })
      } else if (initialOrder) {
        await onSubmitEdit(initialOrder.id, patch)
      }
    } catch (err) {
      if (err instanceof ChangeOrderValidationError) {
        setFormError(err.message)
      } else {
        setFormError(err instanceof Error ? err.message : '儲存失敗')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const titleError = changeOrderErrorFor(errors, 'title')
  const amountError = changeOrderErrorFor(errors, 'amount')

  return (
    <Modal
      open={open}
      title={mode === 'create' ? '新增變更單' : '編輯變更單'}
      onClose={onCancel}
      labelledById={titleId}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor={`${formId}-title-input`}>標題</label>
            <input
              id={`${formId}-title-input`}
              data-testid="change-order-title-input"
              name="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={Boolean(titleError)}
              required
            />
            {titleError && (
              <span className="error" role="alert" data-testid="change-order-title-error">
                {titleError}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor={`${formId}-amount`}>金額（追減請輸入負數）</label>
            <input
              id={`${formId}-amount`}
              data-testid="change-order-amount-input"
              name="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={amountRaw}
              onChange={(e) => setAmountRaw(e.target.value)}
              aria-invalid={Boolean(amountError)}
              required
            />
            {amountError && (
              <span className="error" role="alert" data-testid="change-order-amount-error">
                {amountError}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor={`${formId}-stage`}>關聯階段（選填）</label>
            <select
              id={`${formId}-stage`}
              data-testid="change-order-stage-select"
              name="stageId"
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
            >
              <option value="">未指定</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="field full">
            <label htmlFor={`${formId}-material`}>材料／規格（選填）</label>
            <input
              id={`${formId}-material`}
              data-testid="change-order-material-input"
              name="material"
              type="text"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
            />
          </div>
          <div className="field full">
            <label htmlFor={`${formId}-note`}>備註（選填）</label>
            <textarea
              id={`${formId}-note`}
              data-testid="change-order-note-input"
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <p className="field-hint">新增後狀態為「待決定」；核准後才計入調整後總額。{CHANGE_ORDER_LOCAL_NOTICE}。</p>
        {formError && (
          <div className="form-feedback" role="alert" data-testid="change-order-form-error">
            {formError}
          </div>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="btn"
            onClick={onCancel}
            disabled={submitting}
            data-testid="change-order-cancel"
          >
            取消
          </button>
          <button
            type="submit"
            className="btn primary"
            data-testid="change-order-submit"
            disabled={submitting}
          >
            {submitting ? '儲存中…' : '儲存'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
