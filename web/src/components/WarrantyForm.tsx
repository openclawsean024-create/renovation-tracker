// Warranty create/edit form — modal body.
// Implements SPEC §4.7 (WarrantyRecord) + FR-006 Required behavior 3.
// Field-level errors mirror the validation in `warranty.ts`.

import { useEffect, useId, useState } from 'react'
import {
  emptyWarrantyErrors,
  isWarrantyValid,
  validateNewWarrantyInput,
  validateWarrantyEditInput,
  type WarrantyValidationErrors,
} from '../warranty'
import type { NewWarrantyItemInput, WarrantyItemEditInput } from '../types'

export interface WarrantyFormInitialValues {
  itemName: string
  provider: string
  contact?: string
  startsOn: string
  endsOn: string
  note?: string
}

export interface WarrantyFormProps {
  initial?: WarrantyFormInitialValues
  onSubmit(values: WarrantyFormInitialValues): void | Promise<void>
  onCancel(): void
  submitLabel?: string
  title: string
}

function trimOrUndefined(v: string): string | undefined {
  const t = v.trim()
  return t.length === 0 ? undefined : t
}

export function WarrantyForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = '儲存',
  title,
}: WarrantyFormProps) {
  const reactId = useId()
  const itemId = `${reactId}-item`
  const providerId = `${reactId}-provider`
  const contactId = `${reactId}-contact`
  const startId = `${reactId}-start`
  const endId = `${reactId}-end`
  const noteId = `${reactId}-note`

  const [itemName, setItemName] = useState(initial?.itemName ?? '')
  const [provider, setProvider] = useState(initial?.provider ?? '')
  const [contact, setContact] = useState(initial?.contact ?? '')
  const [startsOn, setStartsOn] = useState(initial?.startsOn ?? '')
  const [endsOn, setEndsOn] = useState(initial?.endsOn ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<WarrantyValidationErrors>(emptyWarrantyErrors())

  useEffect(() => {
    setItemName(initial?.itemName ?? '')
    setProvider(initial?.provider ?? '')
    setContact(initial?.contact ?? '')
    setStartsOn(initial?.startsOn ?? '')
    setEndsOn(initial?.endsOn ?? '')
    setNote(initial?.note ?? '')
    setErrors(emptyWarrantyErrors())
  }, [initial])

  function buildValues(): WarrantyFormInitialValues {
    return {
      itemName: itemName.trim(),
      provider: provider.trim(),
      contact: trimOrUndefined(contact),
      startsOn: startsOn.trim(),
      endsOn: endsOn.trim(),
      note: trimOrUndefined(note),
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const values = buildValues()
    // Reuse the same validator used by the store. Edit uses the same draft
    // shape as `NewWarrantyItemInput` minus `projectId`, so we route by mode.
    const validated: WarrantyValidationErrors = initial
      ? validateWarrantyEditInput(values as WarrantyItemEditInput)
      : validateNewWarrantyInput({
          ...values,
          projectId: '',
        } as NewWarrantyItemInput)
    if (!isWarrantyValid(validated)) {
      setErrors(validated)
      return
    }
    setErrors(emptyWarrantyErrors())
    setSubmitting(true)
    try {
      await onSubmit(values)
    } finally {
      setSubmitting(false)
    }
  }

  const itemErr = errors.itemName
  const providerErr = errors.provider
  const startsErr = errors.startsOn
  const endsErr = errors.endsOn

  return (
    <form onSubmit={handleSubmit} noValidate aria-labelledby={`${reactId}-title`}>
      <h3 id={`${reactId}-title`} className="sr-only">{title}</h3>
      <div className="form-grid">
        <label htmlFor={itemId}>
          <span>項目</span>
          <input
            id={itemId}
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            required
            aria-invalid={itemErr ? 'true' : 'false'}
            data-testid="warranty-item-input"
            maxLength={60}
          />
          {itemErr && (
            <small className="form-error" data-testid="warranty-item-error">{itemErr}</small>
          )}
        </label>

        <label htmlFor={providerId}>
          <span>提供者</span>
          <input
            id={providerId}
            type="text"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            required
            aria-invalid={providerErr ? 'true' : 'false'}
            data-testid="warranty-provider-input"
            maxLength={60}
          />
          {providerErr && (
            <small className="form-error" data-testid="warranty-provider-error">
              {providerErr}
            </small>
          )}
        </label>

        <label htmlFor={contactId} className="form-grid-full">
          <span>聯絡方式（選填）</span>
          <input
            id={contactId}
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            data-testid="warranty-contact-input"
            maxLength={120}
          />
        </label>

        <label htmlFor={startId}>
          <span>保固開始日</span>
          <input
            id={startId}
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            required
            aria-invalid={startsErr ? 'true' : 'false'}
            data-testid="warranty-starts-input"
          />
          {startsErr && (
            <small className="form-error" data-testid="warranty-starts-error">
              {startsErr}
            </small>
          )}
        </label>

        <label htmlFor={endId}>
          <span>保固結束日</span>
          <input
            id={endId}
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
            required
            aria-invalid={endsErr ? 'true' : 'false'}
            data-testid="warranty-ends-input"
          />
          {endsErr && (
            <small className="form-error" data-testid="warranty-ends-error">
              {endsErr}
            </small>
          )}
        </label>

        <label htmlFor={noteId} className="form-grid-full">
          <span>備註（選填）</span>
          <textarea
            id={noteId}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            data-testid="warranty-note-input"
            maxLength={300}
          />
        </label>
      </div>

      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel} data-testid="warranty-cancel">
          取消
        </button>
        <button
          type="submit"
          className="btn primary"
          disabled={submitting}
          data-testid="warranty-submit"
        >
          {submitting ? '儲存中…' : submitLabel}
        </button>
      </div>
    </form>
  )
}