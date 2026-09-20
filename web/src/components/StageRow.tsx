// Single stage row in the list. Uses the polished stage-row grid.

import { StageStatusPill } from './StatusPill'
import { displayDate } from '../dates'
import type { Stage } from '../types'

export interface StageRowProps {
  stage: Stage
  /** Optional index in the sorted list (1-based). When provided, draws the
   * stage-number badge and shifts layout to the new section pattern. */
  index?: number
  onEdit: () => void
  onDelete: () => void
}

export function StageRow({ stage, index, onEdit, onDelete }: StageRowProps) {
  const showIndex = typeof index === 'number'
  return (
    <li className="stage-row" data-testid={`stage-row-${stage.id}`}>
      {showIndex ? (
        <span className="stage-number" aria-hidden="true">
          {String((index ?? 0) + 1).padStart(2, '0')}
        </span>
      ) : null}
      <p className="stage-name">{stage.name}</p>
      <div className="stage-meta">
        <StageStatusPill status={stage.status} />
        <span className="stage-period">
          計畫：{displayDate(stage.plannedStart)} ~ {displayDate(stage.plannedEnd)}
        </span>
        {stage.actualStart && <span>實際開始：{displayDate(stage.actualStart)}</span>}
        {stage.actualEnd && <span>實際完成：{displayDate(stage.actualEnd)}</span>}
        {stage.note && <span>備註：{stage.note}</span>}
      </div>
      <div className="stage-actions">
        <button type="button" className="btn" onClick={onEdit} aria-label={`編輯階段 ${stage.name}`}>
          編輯
        </button>
        <button
          type="button"
          className="btn danger"
          onClick={onDelete}
          aria-label={`刪除階段 ${stage.name}`}
        >
          刪除
        </button>
      </div>
    </li>
  )
}
