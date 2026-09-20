// Schedule create/edit form — modal body.
// Implements SPEC §4.6 (ScheduleItem) + FR-005 Required behavior 3.
// Validation errors are surfaced inline and via the dialog `aria-invalid`.

import { useEffect, useId, useMemo, useState } from 'react'
import type { ScheduleItemEditInput, Stage } from '../types'
import { errorFor, validateScheduleInput } from '../validation'
import type { ValidationError } from '../validation'

export interface ScheduleFormInitialValues {
  stageId?: string
  workerName: string
  phone?: string
  startOn: string
  endOn: string
  note?: string
  reminderOn?: string
  completed: boolean
}

export interface ScheduleFormProps {
  initial?: ScheduleFormInitialValues
  stages: ReadonlyArray<Stage>
  onSubmit(values: ScheduleFormInitialValues): void | Promise<void>
  onCancel(): void
  /** Used as the submit button label. */
  submitLabel?: string
  /** Optional title for the dialog (defaults: 新增 / 編輯). */
  title: string
}

function trimOrUndefined(v: string): string | undefined {
  const t = v.trim()
  return t.length === 0 ? undefined : t
}

export function ScheduleForm({
  initial,
  stages,
  onSubmit,
  onCancel,
  submitLabel = '儲存',
  title,
}: ScheduleFormProps) {
  const reactId = useId()
  const workerId = `${reactId}-worker`
  const phoneId = `${reactId}-phone`
  const stageId = `${reactId}-stage`
  const startId = `${reactId}-start`
  const endId = `${reactId}-end`
  const reminderId = `${reactId}-reminder`
  const noteId = `${reactId}-note`
  const completedId = `${reactId}-completed`

  const [workerName, setWorkerName] = useState(initial?.workerName ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [stageVal, setStageVal] = useState(initial?.stageId ?? '')
  const [startOn, setStartOn] = useState(initial?.startOn ?? '')
  const [endOn, setEndOn] = useState(initial?.endOn ?? '')
  const [reminderOn, setReminderOn] = useState(initial?.reminderOn ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [completed, setCompleted] = useState(initial?.completed ?? false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<ValidationError[]>([])

  useEffect(() => {
    setWorkerName(initial?.workerName ?? '')
    setPhone(initial?.phone ?? '')
    setStageVal(initial?.stageId ?? '')
    setStartOn(initial?.startOn ?? '')
    setEndOn(initial?.endOn ?? '')
    setReminderOn(initial?.reminderOn ?? '')
    setNote(initial?.note ?? '')
    setCompleted(initial?.completed ?? false)
    setErrors([])
  }, [initial])

  const stagesForValidation = useMemo<ReadonlyArray<{ id: string; projectId: string }>>(
    () => stages.map((s) => ({ id: s.id, projectId: s.projectId })),
    [stages],
  )

  function buildValues(): ScheduleFormInitialValues {
    return {
      stageId: trimOrUndefined(stageVal),
      workerName: workerName.trim(),
      phone: trimOrUndefined(phone),
      startOn: startOn.trim(),
      endOn: endOn.trim(),
      note: trimOrUndefined(note),
      reminderOn: trimOrUndefined(reminderOn),
      completed,
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const values = buildValues()
    const result = validateScheduleInput(values as ScheduleItemEditInput, {
      stages: stagesForValidation,
    })
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors([])
    setSubmitting(true)
    try {
      await onSubmit(values)
    } finally {
      setSubmitting(false)
    }
  }

  const workerErr = errorFor(errors, 'workerName')
  const startErr = errorFor(errors, 'startOn')
  const endErr = errorFor(errors, 'endOn')
  const reminderErr = errorFor(errors, 'reminderOn')
  const stageErr = errorFor(errors, 'stageId')

  return (
    <form onSubmit={handleSubmit} noValidate aria-labelledby={`${reactId}-title`}>
      <h3 id={`${reactId}-title`} className="sr-only">{title}</h3>
      <div className="form-grid">
        <label htmlFor={workerId}>
          <span>工班名稱</span>
          <input
            id={workerId}
            type="text"
            value={workerName}
            onChange={(e) => setWorkerName(e.target.value)}
            required
            aria-invalid={workerErr ? 'true' : 'false'}
            data-testid="schedule-worker-input"
            maxLength={60}
          />
          {workerErr && <small className="form-error" data-testid="schedule-worker-error">{workerErr}</small>}
        </label>

        <label htmlFor={phoneId}>
          <span>聯絡電話（選填）</span>
          <input
            id={phoneId}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            data-testid="schedule-phone-input"
            maxLength={40}
            inputMode="tel"
          />
        </label>

        <label htmlFor={stageId}>
          <span>關聯階段（選填）</span>
          <select
            id={stageId}
            value={stageVal}
            onChange={(e) => setStageVal(e.target.value)}
            aria-invalid={stageErr ? 'true' : 'false'}
            data-testid="schedule-stage-select"
          >
            <option value="">不指定</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {stageErr && <small className="form-error" data-testid="schedule-stage-error">{stageErr}</small>}
        </label>

        <label htmlFor={startId}>
          <span>開始日期</span>
          <input
            id={startId}
            type="date"
            value={startOn}
            onChange={(e) => setStartOn(e.target.value)}
            required
            aria-invalid={startErr ? 'true' : 'false'}
            data-testid="schedule-start-input"
          />
          {startErr && <small className="form-error" data-testid="schedule-start-error">{startErr}</small>}
        </label>

        <label htmlFor={endId}>
          <span>結束日期</span>
          <input
            id={endId}
            type="date"
            value={endOn}
            onChange={(e) => setEndOn(e.target.value)}
            required
            aria-invalid={endErr ? 'true' : 'false'}
            data-testid="schedule-end-input"
          />
          {endErr && <small className="form-error" data-testid="schedule-end-error">{endErr}</small>}
        </label>

        <label htmlFor={reminderId}>
          <span>提醒日期（選填）</span>
          <input
            id={reminderId}
            type="date"
            value={reminderOn}
            onChange={(e) => setReminderOn(e.target.value)}
            aria-invalid={reminderErr ? 'true' : 'false'}
            data-testid="schedule-reminder-input"
          />
          {reminderErr && <small className="form-error" data-testid="schedule-reminder-error">{reminderErr}</small>}
        </label>

        <label htmlFor={noteId} className="form-grid-full">
          <span>備註（選填）</span>
          <textarea
            id={noteId}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            data-testid="schedule-note-input"
            maxLength={300}
          />
        </label>

        <label htmlFor={completedId} className="form-checkbox">
          <input
            id={completedId}
            type="checkbox"
            checked={completed}
            onChange={(e) => setCompleted(e.target.checked)}
            data-testid="schedule-completed-input"
          />
          <span>已完成</span>
        </label>
      </div>

      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel} data-testid="schedule-cancel">
          取消
        </button>
        <button
          type="submit"
          className="btn primary"
          disabled={submitting}
          data-testid="schedule-submit"
        >
          {submitting ? '儲存中…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
