// Photo upload form — modal that collects a file, kind, date, optional stage
// and optional caption. Calls the store action; reports validation errors
// inline. Used by Dashboard inside <DashboardProvider>.

import { useEffect, useId, useState, type ChangeEvent, type FormEvent } from 'react'
import { Modal } from './Modal'
import {
  PHOTO_KIND_LABELS,
  PHOTO_KINDS,
  type PhotoKind,
  type Stage,
} from '../types'
import { todayISO } from '../dates'

export interface PhotoFormProps {
  open: boolean
  stages: Stage[]
  defaultKind?: PhotoKind
  /** Called with a File + metadata. Throwing shows an error message. */
  onSubmit: (args: {
    file: File
    kind: PhotoKind
    takenOn: string
    stageId?: string
    caption?: string
  }) => Promise<void>
  onCancel: () => void
}

export function PhotoForm({
  open,
  stages,
  defaultKind = 'progress',
  onSubmit,
  onCancel,
}: PhotoFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [kind, setKind] = useState<PhotoKind>(defaultKind)
  const [takenOn, setTakenOn] = useState<string>(todayISO())
  const [stageId, setStageId] = useState<string>('')
  const [caption, setCaption] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const formId = useId()
  const titleId = `${formId}-title`
  const fileErrorId = `${formId}-file-error`

  useEffect(() => {
    if (!open) return
    setFile(null)
    setKind(defaultKind)
    setTakenOn(todayISO())
    setStageId('')
    setCaption('')
    setError(null)
    setSubmitting(false)
  }, [open, defaultKind])

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0] ?? null
    setFile(next)
    if (error) setError(null)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    if (!file) {
      setError('請選擇照片檔案')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        file,
        kind,
        takenOn,
        stageId: stageId.length > 0 ? stageId : undefined,
        caption: caption.trim().length > 0 ? caption.trim() : undefined,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '儲存失敗'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} title="新增照片" onClose={onCancel} labelledById={titleId}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor={`${formId}-file`}>照片檔案（image/*，≤ 10 MB）</label>
          <input
            id={`${formId}-file`}
            data-testid="photo-file-input"
            name="file"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            aria-describedby={fileErrorId}
            aria-invalid={Boolean(error)}
            required
          />
          {file && (
            <span className="muted" style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>
              已選擇：{file.name}（{(file.size / 1024).toFixed(1)} KB）
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor={`${formId}-kind`}>分類</label>
          <select
            id={`${formId}-kind`}
            data-testid="photo-kind-select"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as PhotoKind)}
          >
            {PHOTO_KINDS.map((k) => (
              <option key={k} value={k}>{PHOTO_KIND_LABELS[k]}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor={`${formId}-takenOn`}>拍攝日期</label>
          <input
            id={`${formId}-takenOn`}
            data-testid="photo-taken-on-input"
            name="takenOn"
            type="date"
            value={takenOn}
            onChange={(e) => setTakenOn(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor={`${formId}-stage`}>關聯階段（選填）</label>
          <select
            id={`${formId}-stage`}
            data-testid="photo-stage-select"
            name="stageId"
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
          >
            <option value="">（不指定）</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor={`${formId}-caption`}>說明（選填）</label>
          <textarea
            id={`${formId}-caption`}
            data-testid="photo-caption-input"
            name="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>

        <div id={fileErrorId} aria-live="polite">
          {error && <p className="error" role="alert" data-testid="photo-form-error">{error}</p>}
        </div>

        <div className="form-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={submitting}>取消</button>
          <button
            type="submit"
            className="btn primary"
            data-testid="photo-submit"
            disabled={submitting || !file}
          >
            {submitting ? '儲存中…' : '儲存'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
