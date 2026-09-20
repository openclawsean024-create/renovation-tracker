// Single stage row in the list.

import { StageStatusPill } from './StatusPill'
import { displayDate } from '../dates'
import type { Stage } from '../types'

export interface StageRowProps {
  stage: Stage
  onEdit: () => void
  onDelete: () => void
}

export function StageRow({ stage, onEdit, onDelete }: StageRowProps) {
  return (
    <li className="stage-row" data-testid={`stage-row-${stage.id}`}>
      <div>
        <p className="stage-name">{stage.name}</p>
        <div className="stage-meta">
          <StageStatusPill status={stage.status} />
          <span>
            計畫：{displayDate(stage.plannedStart)} ~ {displayDate(stage.plannedEnd)}
          </span>
          {stage.actualStart && <span>實際開始：{displayDate(stage.actualStart)}</span>}
          {stage.actualEnd && <span>實際完成：{displayDate(stage.actualEnd)}</span>}
          {stage.note && <span>備註：{stage.note}</span>}
        </div>
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
