// Stage form — used for both create and edit. Calls the store actions.

import { useEffect, useId, useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import {
  STAGE_STATUSES,
  STAGE_STATUS_LABELS,
  type NewStageInput,
  type Stage,
  type StageEditInput,
  type StageStatus,
} from '../types'
import { errorFor, validateStageInput, type ValidationError } from '../validation'
import { todayISO } from '../dates'

export interface StageFormProps {
  open: boolean
  mode: 'create' | 'edit'
  projectId: string
  /** Project planned range — when supplied, the form enforces it locally so
   * the user sees per-field errors before the store rejects the write.
   * See PRD/SPEC.md §4.2 / AC-FR001-04. */
  projectPlannedStart?: string
  projectPlannedEnd?: string
  initialStage?: Stage
  onCancel: () => void
  onSubmitCreate: (input: NewStageInput) => Promise<void>
  onSubmitEdit: (id: string, patch: StageEditInput) => Promise<void>
}

export function StageForm({
  open,
  mode,
  projectId,
  projectPlannedStart,
  projectPlannedEnd,
  initialStage,
  onCancel,
  onSubmitCreate,
  onSubmitEdit,
}: StageFormProps) {
  const [name, setName] = useState('')
  const [status, setStatus] = useState<StageStatus>('not_started')
  const [plannedStart, setPlannedStart] = useState<string>(todayISO())
  const [plannedEnd, setPlannedEnd] = useState<string>(todayISO())
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [submitting, setSubmitting] = useState(false)

  const formId = useId()
  const titleId = `${formId}-title`

  // Sync local state whenever the modal is (re)opened.
  useEffect(() => {
    if (!open) return
    setName(initialStage?.name ?? '')
    setStatus(initialStage?.status ?? 'not_started')
    setPlannedStart(initialStage?.plannedStart ?? todayISO())
    setPlannedEnd(initialStage?.plannedEnd ?? todayISO())
    setNote(initialStage?.note ?? '')
    setErrors([])
    setSubmitting(false)
  }, [open, initialStage])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    const patch = { name, status, plannedStart, plannedEnd, note }
    // Pass the project's planned range to local validation so out-of-project
    // dates surface as per-field errors immediately (AC-FR001-04). The store
    // re-validates with the same bounds as defense in depth.
    const bounds =
      projectPlannedStart && projectPlannedEnd
        ? { plannedStart: projectPlannedStart, plannedEnd: projectPlannedEnd }
        : undefined
    const result = validateStageInput(patch, bounds)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors([])
    setSubmitting(true)
    try {
      if (mode === 'create') {
        await onSubmitCreate({ projectId, ...patch })
      } else if (initialStage) {
        await onSubmitEdit(initialStage.id, patch)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '儲存失敗'
      setErrors([{ field: 'name', message: msg }])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} title={mode === 'create' ? '新增階段' : '編輯階段'} onClose={onCancel} labelledById={titleId}>
      <form onSubmit={handleSubmit} noValidate aria-describedby={`${formId}-errors`}>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor={`${formId}-name`}>階段名稱</label>
            <input
              id={`${formId}-name`}
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(errorFor(errors, 'name'))}
              required
            />
            {errorFor(errors, 'name') && (
              <span className="error" role="alert">{errorFor(errors, 'name')}</span>
            )}
          </div>

          <div className="field">
            <label htmlFor={`${formId}-status`}>狀態</label>
            <select
              id={`${formId}-status`}
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as StageStatus)}
            >
              {STAGE_STATUSES.map((s) => (
                <option key={s} value={s}>{STAGE_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor={`${formId}-plannedStart`}>預計開始</label>
            <input
              id={`${formId}-plannedStart`}
              name="plannedStart"
              type="date"
              value={plannedStart}
              onChange={(e) => setPlannedStart(e.target.value)}
              aria-invalid={Boolean(errorFor(errors, 'plannedStart'))}
              required
            />
            {errorFor(errors, 'plannedStart') && (
              <span className="error" role="alert">{errorFor(errors, 'plannedStart')}</span>
            )}
          </div>

          <div className="field">
            <label htmlFor={`${formId}-plannedEnd`}>預計結束</label>
            <input
              id={`${formId}-plannedEnd`}
              name="plannedEnd"
              type="date"
              value={plannedEnd}
              onChange={(e) => setPlannedEnd(e.target.value)}
              aria-invalid={Boolean(errorFor(errors, 'plannedEnd'))}
              required
            />
            {errorFor(errors, 'plannedEnd') && (
              <span className="error" role="alert">{errorFor(errors, 'plannedEnd')}</span>
            )}
          </div>

          <div className="field full">
            <label htmlFor={`${formId}-note`}>備註</label>
            <textarea
              id={`${formId}-note`}
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div id={`${formId}-errors`} aria-live="polite">
          {errors.length > 0 && (
            <div className="form-feedback" role="alert">{errors.map((e) => e.message).join('；')}</div>
          )}
        </div>

        <div className="form-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={submitting}>取消</button>
          <button type="submit" className="btn primary" disabled={submitting}>
            {submitting ? '儲存中…' : '儲存'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
