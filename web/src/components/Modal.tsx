// Modal shell — used by both the stage form and delete confirmation.

import { useEffect, useRef, type ReactNode } from 'react'

export interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  labelledById?: string
  /** Use a wider layout — e.g. for photo preview. */
  wide?: boolean
}

export function Modal({ open, title, onClose, children, labelledById, wide }: ModalProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledById}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={wide ? 'modal modal-wide' : 'modal'} ref={ref}>
        <h2 id={labelledById}>{title}</h2>
        {children}
      </div>
    </div>
  )
}
