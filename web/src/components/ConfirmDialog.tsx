// Confirmation dialog used for delete (AC-FR001-07).

import { useId } from 'react'
import { Modal } from './Modal'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '確定刪除',
  cancelLabel = '取消',
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const reactId = useId()
  const titleId = `${reactId}-confirm-title`
  return (
    <Modal open={open} title={title} onClose={onCancel} labelledById={titleId}>
      <p>{description}</p>
      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className="btn danger" onClick={onConfirm} data-testid="confirm-delete">
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
