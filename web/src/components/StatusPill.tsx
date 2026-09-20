// Status pill — always shows a symbol AND a label so color is not the only
// differentiator (PRD/SPEC.md §1.2 + AC-FR001-09).

import type {
  ProjectStatus,
  ScheduleDateStatus,
  WarrantyDateStatus,
} from '../types'
import {
  PROJECT_STATUS_LABELS,
  SCHEDULE_DATE_STATUS_LABELS,
  WARRANTY_DATE_STATUS_LABELS,
} from '../types'

export interface StatusPillProps {
  status: ProjectStatus
}

export function ProjectStatusPill({ status }: StatusPillProps) {
  const symbol = status === 'completed' ? '●' : status === 'in_progress' ? '◐' : '○'
  return (
    <span className="status-pill" data-tone={status} aria-label={`工程狀態：${PROJECT_STATUS_LABELS[status]}`}>
      <span className="symbol" aria-hidden="true">{symbol}</span>
      <span>{PROJECT_STATUS_LABELS[status]}</span>
    </span>
  )
}

export interface StageStatusPillProps {
  status: import('../types').StageStatus
}

export function StageStatusPill({ status }: StageStatusPillProps) {
  const symbol = status === 'completed' ? '●' : status === 'in_progress' ? '◐' : status === 'blocked' ? '⚠' : '○'
  return (
    <span className="status-pill" data-tone={status} aria-label={`階段狀態：${statusLabel(status)}`}>
      <span className="symbol" aria-hidden="true">{symbol}</span>
      <span>{statusLabel(status)}</span>
    </span>
  )
}

function statusLabel(status: import('../types').StageStatus): string {
  switch (status) {
    case 'not_started': return '未開始'
    case 'in_progress': return '進行中'
    case 'completed': return '已完成'
    case 'blocked': return '阻塞'
    default: {
      const _exhaustive: never = status
      void _exhaustive
      return status
    }
  }
}

/** Pill for a schedule's date status (FR-005). Mirrors the shape of the
 *  stage pill so screen readers always announce label + symbol. */
export interface ScheduleStatusPillProps {
  status: ScheduleDateStatus
}

export function ScheduleStatusPill({ status }: ScheduleStatusPillProps) {
  const symbol =
    status === 'completed'
      ? '●'
      : status === 'in_progress'
      ? '◐'
      : status === 'today'
      ? '◉'
      : status === 'overdue'
      ? '⚠'
      : '○'
  return (
    <span className="status-pill" data-tone={status} aria-label={`排程狀態：${SCHEDULE_DATE_STATUS_LABELS[status]}`}>
      <span className="symbol" aria-hidden="true">{symbol}</span>
      <span>{SCHEDULE_DATE_STATUS_LABELS[status]}</span>
    </span>
  )
}

/** Pill for a warranty's date status (FR-006). The `data-tone` attribute
 *  drives color/border styling; the symbol + label keep the pill accessible
 *  per SPEC §1.2. */
export interface WarrantyStatusPillProps {
  status: WarrantyDateStatus
}

export function WarrantyStatusPill({ status }: WarrantyStatusPillProps) {
  const symbol = status === 'active' ? '◐' : status === 'expired' ? '⚠' : '○'
  const label = WARRANTY_DATE_STATUS_LABELS[status]
  return (
    <span
      className="status-pill"
      data-tone={`warranty-${status}`}
      data-testid={`warranty-status`}
      aria-label={`保固狀態：${label}`}
    >
      <span className="symbol" aria-hidden="true">{symbol}</span>
      <span>{label}</span>
    </span>
  )
}
