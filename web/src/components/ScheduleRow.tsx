// Single schedule row in the list (FR-005).

import { ScheduleStatusPill } from './StatusPill'
import { displayDate } from '../dates'
import { scheduleDateStatus } from '../schedule'
import type { ScheduleItem, Stage } from '../types'

export interface ScheduleRowProps {
  schedule: ScheduleItem
  today: string
  /** Optional stage lookup so the row can show the stage name next to the
   *  date range when a stageId is set. */
  stageById?: ReadonlyMap<string, Stage>
  onEdit: () => void
  onDelete: () => void
  onToggleComplete: () => void
}

export function ScheduleRow({
  schedule,
  today,
  stageById,
  onEdit,
  onDelete,
  onToggleComplete,
}: ScheduleRowProps) {
  const status = scheduleDateStatus(schedule, today)
  const stageName = schedule.stageId && stageById
    ? stageById.get(schedule.stageId)?.name
    : undefined
  const dimmed = schedule.completed
  return (
    <li
      className="schedule-row"
      data-testid={`schedule-row-${schedule.id}`}
      data-completed={schedule.completed ? 'true' : 'false'}
      aria-label={`排程 ${schedule.workerName}`}
    >
      <div className="schedule-row-main">
        <div className="schedule-row-header">
          <p className="schedule-name">
            <input
              type="checkbox"
              checked={schedule.completed}
              onChange={onToggleComplete}
              aria-label={`標記 ${schedule.workerName} 為${schedule.completed ? '未' : '已'}完成`}
              data-testid={`schedule-complete-toggle-${schedule.id}`}
            />
            <span className={dimmed ? 'completed' : undefined}>{schedule.workerName}</span>
          </p>
          <ScheduleStatusPill status={status} />
        </div>
        <div className="schedule-meta">
          <span>工期：{displayDate(schedule.startOn)} ~ {displayDate(schedule.endOn)}</span>
          {stageName && <span>關聯階段：{stageName}</span>}
          {schedule.phone && <span>電話：{schedule.phone}</span>}
          {schedule.reminderOn && (
            <span>提醒日：{displayDate(schedule.reminderOn)}</span>
          )}
          {schedule.note && <span>備註：{schedule.note}</span>}
        </div>
      </div>
      <div className="schedule-actions">
        <button
          type="button"
          className="btn"
          onClick={onEdit}
          aria-label={`編輯排程 ${schedule.workerName}`}
          data-testid={`schedule-edit-${schedule.id}`}
        >
          編輯
        </button>
        <button
          type="button"
          className="btn danger"
          onClick={onDelete}
          aria-label={`刪除排程 ${schedule.workerName}`}
          data-testid={`schedule-delete-${schedule.id}`}
        >
          刪除
        </button>
      </div>
    </li>
  )
}
