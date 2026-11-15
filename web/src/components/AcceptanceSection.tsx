// FR-009 per-stage acceptance checklist — GOAL AC-003. Every stage owns a
// user-defined list of acceptance items that can be added, edited, deleted
// (with confirm) and toggled passed / not passed. Passing an item stamps the
// check date automatically. A completed stage that still has un-passed items
// gets a text warning; the warning never blocks saving.

import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { ConfirmDialog } from './ConfirmDialog'
import { AcceptanceValidationError, useDashboard } from '../store'
import { displayDate } from '../dates'
import {
  EMPTY_ACCEPTANCE_PROGRESS,
  acceptanceErrorFor,
  acceptanceItemsForStage,
  acceptanceWarningText,
  formatAcceptanceProgress,
  hasUnpassedCompletedWarning,
  summarizeAcceptance,
  summarizeAcceptanceByStage,
  validateAcceptanceInput,
  type AcceptanceFieldError,
} from '../acceptance'
import type { AcceptanceItem, AcceptanceItemEditInput, Stage } from '../types'

type FormState =
  | { mode: 'closed' }
  | { mode: 'create'; stage: Stage }
  | { mode: 'edit'; stage: Stage | undefined; item: AcceptanceItem }

export function AcceptanceSection() {
  const {
    stages,
    acceptanceItems,
    createAcceptanceItem,
    updateAcceptanceItem,
    deleteAcceptanceItem,
    toggleAcceptanceItem,
  } = useDashboard()
  const [form, setForm] = useState<FormState>({ mode: 'closed' })
  const [pendingDelete, setPendingDelete] = useState<AcceptanceItem | null>(null)

  const overall = useMemo(() => summarizeAcceptance(acceptanceItems), [acceptanceItems])
  const byStage = useMemo(() => summarizeAcceptanceByStage(acceptanceItems), [acceptanceItems])

  return (
    <section className="section" id="acceptance" aria-labelledby="acceptance-section-heading">
      <div className="record-section-header">
        <div>
          <h2 id="acceptance-section-heading">階段驗收</h2>
          <p className="record-section-sub" data-testid="acceptance-overall">
            {overall.total === 0
              ? '尚未建立驗收項目。為每個階段列出要逐項確認的內容。'
              : `全部階段 ${formatAcceptanceProgress(overall)}`}
          </p>
        </div>
      </div>

      {stages.length === 0 ? (
        <div className="empty-state" data-testid="acceptance-empty-state">
          <h3>尚無階段</h3>
          <p>先在「階段與工期」建立階段，再為階段新增驗收項目。</p>
        </div>
      ) : (
        <ol className="acceptance-stage-list">
          {stages.map((stage) => {
            const items = acceptanceItemsForStage(acceptanceItems, stage.id)
            const progress = byStage[stage.id] ?? EMPTY_ACCEPTANCE_PROGRESS
            const warn = hasUnpassedCompletedWarning(stage, progress)
            return (
              <li
                key={stage.id}
                className="acceptance-stage"
                data-testid={`acceptance-stage-${stage.id}`}
              >
                <div className="acceptance-stage-header">
                  <div className="record-row-header">
                    <h3 className="record-name">{stage.name}</h3>
                    <span
                      className="section-count"
                      data-testid={`acceptance-progress-${stage.id}`}
                    >
                      {formatAcceptanceProgress(progress)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn edit-control"
                    onClick={() => setForm({ mode: 'create', stage })}
                    aria-label={`新增 ${stage.name} 的驗收項目`}
                    data-testid={`add-acceptance-${stage.id}`}
                  >
                    新增驗收項目
                  </button>
                </div>
                {warn ? (
                  <p
                    className="record-alert"
                    role="alert"
                    data-testid={`acceptance-warning-${stage.id}`}
                  >
                    <span className="symbol" aria-hidden="true">⚠</span>
                    {acceptanceWarningText(progress)}
                  </p>
                ) : null}
                {items.length === 0 ? (
                  <p className="muted acceptance-empty" data-testid={`acceptance-empty-${stage.id}`}>
                    此階段尚無驗收項目。
                  </p>
                ) : (
                  <ul className="record-list acceptance-items">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="record-row"
                        data-testid={`acceptance-item-${item.id}`}
                        data-passed={item.passed ? 'true' : 'false'}
                      >
                        <div className="record-row-main">
                          <label className="form-checkbox acceptance-toggle">
                            <input
                              type="checkbox"
                              checked={item.passed}
                              onChange={() => {
                                toggleAcceptanceItem(item.id).catch(() => undefined)
                              }}
                              aria-label={`驗收通過：${item.name}`}
                              data-testid={`acceptance-toggle-${item.id}`}
                            />
                            <span className="record-name">{item.name}</span>
                            <span
                              className="status-pill"
                              data-tone={item.passed ? 'completed' : 'not_started'}
                            >
                              <span className="symbol" aria-hidden="true">
                                {item.passed ? '●' : '○'}
                              </span>
                              <span>{item.passed ? '已通過' : '未通過'}</span>
                            </span>
                          </label>
                          <div className="record-meta">
                            {item.checkedOn && (
                              <span data-testid={`acceptance-checked-on-${item.id}`}>
                                檢查日：{displayDate(item.checkedOn)}
                              </span>
                            )}
                            {item.note && <span>備註：{item.note}</span>}
                          </div>
                        </div>
                        <div className="record-actions edit-control">
                          <button
                            type="button"
                            className="btn"
                            onClick={() => setForm({ mode: 'edit', stage, item })}
                            aria-label={`編輯驗收項目 ${item.name}`}
                            data-testid={`acceptance-edit-${item.id}`}
                          >
                            編輯
                          </button>
                          <button
                            type="button"
                            className="btn danger"
                            onClick={() => setPendingDelete(item)}
                            aria-label={`刪除驗收項目 ${item.name}`}
                            data-testid={`acceptance-delete-${item.id}`}
                          >
                            刪除
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <AcceptanceForm
        open={form.mode !== 'closed'}
        mode={form.mode === 'edit' ? 'edit' : 'create'}
        stageName={form.mode === 'closed' ? '' : (form.stage?.name ?? '')}
        initialItem={form.mode === 'edit' ? form.item : undefined}
        onCancel={() => setForm({ mode: 'closed' })}
        onSubmit={async (patch) => {
          if (form.mode === 'create') {
            await createAcceptanceItem({
              input: { projectId: '', stageId: form.stage.id, ...patch },
            })
          } else if (form.mode === 'edit') {
            await updateAcceptanceItem({ id: form.item.id, patch })
          }
          setForm({ mode: 'closed' })
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="刪除驗收項目"
        description={
          pendingDelete
            ? `確定要刪除驗收項目「${pendingDelete.name}」嗎？此操作無法復原。`
            : ''
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return
          deleteAcceptanceItem(pendingDelete.id)
            .then(() => setPendingDelete(null))
            .catch(() => undefined)
        }}
      />
    </section>
  )
}

interface AcceptanceFormProps {
  open: boolean
  mode: 'create' | 'edit'
  stageName: string
  initialItem?: AcceptanceItem
  onCancel: () => void
  onSubmit: (patch: AcceptanceItemEditInput) => Promise<void>
}

function AcceptanceForm({
  open,
  mode,
  stageName,
  initialItem,
  onCancel,
  onSubmit,
}: AcceptanceFormProps) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<AcceptanceFieldError[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const formId = useId()
  const titleId = `${formId}-title`

  useEffect(() => {
    if (!open) return
    setName(initialItem?.name ?? '')
    setNote(initialItem?.note ?? '')
    setErrors([])
    setFormError(null)
    setSubmitting(false)
  }, [open, initialItem])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    const patch: AcceptanceItemEditInput = { name, note }
    const result = validateAcceptanceInput(patch)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors([])
    setFormError(null)
    setSubmitting(true)
    try {
      await onSubmit(patch)
    } catch (err) {
      if (err instanceof AcceptanceValidationError) {
        setFormError(err.message)
      } else {
        setFormError(err instanceof Error ? err.message : '儲存失敗')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const nameError = acceptanceErrorFor(errors, 'name')
  const heading = mode === 'create' ? '新增驗收項目' : '編輯驗收項目'

  return (
    <Modal
      open={open}
      title={stageName ? `${heading}（${stageName}）` : heading}
      onClose={onCancel}
      labelledById={titleId}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor={`${formId}-name`}>驗收項目</label>
            <input
              id={`${formId}-name`}
              data-testid="acceptance-name-input"
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(nameError)}
              required
            />
            {nameError && (
              <span className="error" role="alert" data-testid="acceptance-name-error">
                {nameError}
              </span>
            )}
          </div>
          <div className="field full">
            <label htmlFor={`${formId}-note`}>備註（選填）</label>
            <textarea
              id={`${formId}-note`}
              data-testid="acceptance-note-input"
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        {formError && (
          <div className="form-feedback" role="alert" data-testid="acceptance-form-error">
            {formError}
          </div>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="btn"
            onClick={onCancel}
            disabled={submitting}
            data-testid="acceptance-cancel"
          >
            取消
          </button>
          <button
            type="submit"
            className="btn primary"
            data-testid="acceptance-submit"
            disabled={submitting}
          >
            {submitting ? '儲存中…' : '儲存'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
