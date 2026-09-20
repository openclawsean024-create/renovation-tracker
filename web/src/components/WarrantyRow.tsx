// Single warranty row in the list (FR-006).
// Shows the item / provider / dates / contact / note, a status pill driven
// by local today, and edit / delete actions.

import { WarrantyStatusPill } from './StatusPill'
import { displayDate } from '../dates'
import {
  daysUntilEnd,
  isWarrantyExpiringSoon,
  warrantyDateStatus,
} from '../warranty'
import type { WarrantyRecord } from '../types'

export interface WarrantyRowProps {
  warranty: WarrantyRecord
  today: string
  onEdit: () => void
  onDelete: () => void
}

export function WarrantyRow({ warranty, today, onEdit, onDelete }: WarrantyRowProps) {
  const status = warrantyDateStatus(warranty, today)
  const expiringSoon = isWarrantyExpiringSoon(warranty, today)
  const remainingDays = daysUntilEnd(warranty, today)
  // Build the human-readable countdown only when there's something useful to
  // say. Avoids showing "NaN" when dates are corrupt.
  const countdown =
    status === 'active' && Number.isFinite(remainingDays)
      ? remainingDays === 0
        ? '今日到期'
        : remainingDays === 1
        ? '剩 1 天'
        : `剩 ${remainingDays} 天`
      : status === 'expired' && Number.isFinite(remainingDays)
      ? `已過期 ${Math.abs(remainingDays)} 天`
      : ''

  return (
    <li
      className="warranty-row"
      data-testid={`warranty-row-${warranty.id}`}
      data-status={status}
      data-expiring={expiringSoon ? 'true' : 'false'}
      aria-label={`保固 ${warranty.itemName}`}
    >
      <div className="warranty-row-main">
        <div className="warranty-row-header">
          <p className="warranty-name">{warranty.itemName}</p>
          <WarrantyStatusPill status={status} />
        </div>
        <div className="warranty-meta">
          <span>提供者：{warranty.provider}</span>
          {warranty.contact && <span>聯絡：{warranty.contact}</span>}
          <span>
            期間：{displayDate(warranty.startsOn)} ~ {displayDate(warranty.endsOn)}
          </span>
          {countdown && (
            <span
              className="warranty-countdown"
              data-testid={`warranty-countdown-${warranty.id}`}
            >
              {countdown}
            </span>
          )}
          {warranty.note && <span>備註：{warranty.note}</span>}
        </div>
      </div>
      <div className="warranty-actions">
        <button
          type="button"
          className="btn"
          onClick={onEdit}
          aria-label={`編輯保固 ${warranty.itemName}`}
          data-testid={`warranty-edit-${warranty.id}`}
        >
          編輯
        </button>
        <button
          type="button"
          className="btn danger"
          onClick={onDelete}
          aria-label={`刪除保固 ${warranty.itemName}`}
          data-testid={`warranty-delete-${warranty.id}`}
        >
          刪除
        </button>
      </div>
    </li>
  )
}