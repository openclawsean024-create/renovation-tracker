// Warranty section — add / edit / delete warranty records, surface the
// in-page text warnings for "30 days expiring soon" and "expired" statuses.
// Implements FR-006 Required behavior 1～6 and AC-FR006-01～04. The
// read-only counterpart lives in ReadOnlyView.tsx and operates on the share
// snapshot only — never on this component.

import { useCallback, useId, useMemo, useState } from 'react'
import { Modal } from './Modal'
import { ConfirmDialog } from './ConfirmDialog'
import { WarrantyForm, type WarrantyFormInitialValues } from './WarrantyForm'
import { WarrantyRow } from './WarrantyRow'
import { todayISO } from '../dates'
import {
  hasWarrantyExpired,
  hasWarrantyExpiringSoon,
  sortWarrantiesForDisplay,
  summarizeWarranties,
} from '../warranty'
import { WarrantyValidationError, useDashboard } from '../store'
import type { WarrantyRecord } from '../types'

export function WarrantySection() {
  const {
    warranties,
    createWarranty,
    updateWarranty,
    deleteWarranty,
  } = useDashboard()

  const [mode, setMode] = useState<'closed' | 'create' | 'edit'>('closed')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [topError, setTopError] = useState<string | null>(null)
  const reactId = useId()
  const headingId = `${reactId}-warranty-heading`

  const today = todayISO()
  const sortedWarranties = useMemo(
    () => sortWarrantiesForDisplay(warranties),
    [warranties],
  )
  const summary = useMemo(
    () => summarizeWarranties(warranties, today),
    [warranties, today],
  )
  // SPEC §11.1 / AC-FR006-03: text warnings when a warranty is expiring
  // within 30 days OR already expired. The two helpers guard the alerts so
  // empty datasets don't surface banners.
  const showExpiringSoon = hasWarrantyExpiringSoon(warranties, today)
  const showExpired = hasWarrantyExpired(warranties, today)

  const editingWarranty = editingId
    ? warranties.find((w) => w.id === editingId) ?? null
    : null

  const closeModal = useCallback(() => {
    setMode('closed')
    setEditingId(null)
    setTopError(null)
  }, [])

  const handleCreate = useCallback(
    async (values: WarrantyFormInitialValues) => {
      try {
        await createWarranty({
          input: {
            projectId: '',
            itemName: values.itemName,
            provider: values.provider,
            contact: values.contact,
            startsOn: values.startsOn,
            endsOn: values.endsOn,
            note: values.note,
          },
        })
        closeModal()
      } catch (err) {
        if (err instanceof WarrantyValidationError) {
          setTopError(err.message)
          // Re-throw so the form can keep its inline errors.
          throw err
        }
        throw err
      }
    },
    [createWarranty, closeModal],
  )

  const handleEdit = useCallback(
    async (values: WarrantyFormInitialValues) => {
      if (!editingId) return
      try {
        await updateWarranty({
          id: editingId,
          patch: {
            itemName: values.itemName,
            provider: values.provider,
            contact: values.contact,
            startsOn: values.startsOn,
            endsOn: values.endsOn,
            note: values.note,
          },
        })
        closeModal()
      } catch (err) {
        if (err instanceof WarrantyValidationError) {
          setTopError(err.message)
          throw err
        }
        throw err
      }
    },
    [editingId, updateWarranty, closeModal],
  )

  const pendingDeleteWarranty = pendingDeleteId
    ? warranties.find((w) => w.id === pendingDeleteId) ?? null
    : null

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return
    await deleteWarranty(pendingDeleteId)
    setPendingDeleteId(null)
  }, [pendingDeleteId, deleteWarranty])

  const editingInitial: WarrantyFormInitialValues | undefined = editingWarranty
    ? {
        itemName: editingWarranty.itemName,
        provider: editingWarranty.provider,
        contact: editingWarranty.contact,
        startsOn: editingWarranty.startsOn,
        endsOn: editingWarranty.endsOn,
        note: editingWarranty.note,
      }
    : undefined

  // Collect the items that actually trigger each alert so we can list them
  // inside the banner — helps users locate the offending records without
  // scrolling through the whole list.
  const expiringItems = sortedWarranties.filter(
    (w) =>
      hasWarrantyExpiringSoon([w], today) ||
      // Surface already-expired items in the expiring-soon list too when the
      // expired-only banner is hidden (defensive — keep parity with §11).
      warrantyMatchesExpired(w, today),
  )
  const expiredItems = sortedWarranties.filter((w) =>
    warrantyMatchesExpired(w, today),
  )

  return (
    <article className="support-section warranty-section" aria-labelledby={headingId}>
      <header className="warranty-section-header">
        <h2 id={headingId}>保固紀錄</h2>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            setTopError(null)
            setEditingId(null)
            setMode('create')
          }}
          data-testid="warranty-add-cta"
        >
          + 新增保固
        </button>
      </header>

      {topError && (
        <p className="form-error" role="alert" data-testid="warranty-top-error">
          {topError}
        </p>
      )}

      {warranties.length === 0 ? (
        <p className="empty-state" data-testid="warranty-empty">
          目前沒有保固紀錄，點「新增保固」開始記錄完工項目與保固期限。
        </p>
      ) : (
        <>
          {showExpiringSoon && (
            <aside
              className="warranty-alert warranty-alert-expiring"
              role="status"
              data-testid="warranty-alert-expiring"
            >
              <p className="warranty-alert-title">
                30 天內到期的保固（{summary.expiringSoon + summary.expired}）
              </p>
              <ul className="warranty-alert-list">
                {expiringItems.map((w: WarrantyRecord) => (
                  <li
                    key={w.id}
                    data-testid={`warranty-alert-expiring-item-${w.id}`}
                  >
                    <span className="warranty-alert-name">{w.itemName}</span>
                    <span>・{w.provider}</span>
                    <span>・到期 {w.endsOn}</span>
                  </li>
                ))}
              </ul>
            </aside>
          )}
          {showExpired && (
            <aside
              className="warranty-alert warranty-alert-expired"
              role="status"
              data-testid="warranty-alert-expired"
            >
              <p className="warranty-alert-title">
                已過期的保固（{summary.expired}）
              </p>
              <ul className="warranty-alert-list">
                {expiredItems.map((w: WarrantyRecord) => (
                  <li
                    key={w.id}
                    data-testid={`warranty-alert-expired-item-${w.id}`}
                  >
                    <span className="warranty-alert-name">{w.itemName}</span>
                    <span>・{w.provider}</span>
                    <span>・到期 {w.endsOn}</span>
                  </li>
                ))}
              </ul>
            </aside>
          )}
          <p className="warranty-summary-text" data-testid="warranty-summary">
            共 {summary.total} 筆保固，有效中 {summary.active} 筆、已過期{' '}
            {summary.expired} 筆、尚未開始 {summary.notStarted} 筆。
          </p>
          <ul className="warranty-list" data-testid="warranty-list">
            {sortedWarranties.map((w) => (
              <WarrantyRow
                key={w.id}
                warranty={w}
                today={today}
                onEdit={() => {
                  setTopError(null)
                  setEditingId(w.id)
                  setMode('edit')
                }}
                onDelete={() => setPendingDeleteId(w.id)}
              />
            ))}
          </ul>
        </>
      )}

      <Modal
        open={mode === 'create'}
        title="新增保固"
        onClose={closeModal}
        labelledById={`${reactId}-warranty-create-title`}
      >
        <WarrantyForm
          title="新增保固"
          onSubmit={handleCreate}
          onCancel={closeModal}
          submitLabel="新增"
        />
      </Modal>

      <Modal
        open={mode === 'edit' && !!editingWarranty}
        title="編輯保固"
        onClose={closeModal}
        labelledById={`${reactId}-warranty-edit-title`}
      >
        {editingInitial && (
          <WarrantyForm
            title="編輯保固"
            initial={editingInitial}
            onSubmit={handleEdit}
            onCancel={closeModal}
            submitLabel="儲存"
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!pendingDeleteWarranty}
        title="刪除保固"
        description={
          pendingDeleteWarranty
            ? `確定要刪除「${pendingDeleteWarranty.itemName}」嗎？此操作無法復原。`
            : ''
        }
        confirmLabel="確定刪除"
        cancelLabel="取消"
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </article>
  )
}

// Helper: mirrors `warrantyDateStatus(item, today) === 'expired'`. Imported
// lazily so the file stays small but the helper reads cleanly.
function warrantyMatchesExpired(
  item: Pick<WarrantyRecord, 'startsOn' | 'endsOn'>,
  today: string,
): boolean {
  return (
    hasWarrantyExpired([item], today) ||
    // Fallback — covers the case where the per-item check returns false but
    // the item still reads as expired relative to today (defensive).
    isExpiredByDate(item.endsOn, today)
  )
}

function isExpiredByDate(endsOn: string, today: string): boolean {
  // Local ISO compare — both are YYYY-MM-DD, no timezone shift.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return false
  }
  return endsOn < today
}