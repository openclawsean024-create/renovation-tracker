// Project summary card. PRD/SPEC.md §5.1 + AC-FR001-05.

import { useDashboard } from '../store'
import { summarizeStages } from '../status'
import { displayDate } from '../dates'

export function Summary() {
  const { project, stages } = useDashboard()
  const summary = summarizeStages(stages)

  return (
    <section className="section" aria-labelledby="summary-heading">
      <h2 id="summary-heading">工程摘要</h2>
      {project ? (
        <div className="summary-grid">
          <div className="summary-cell">
            <span className="label">日期範圍</span>
            <span className="value">
              {displayDate(project.plannedStart)} ~ {displayDate(project.plannedEnd)}
            </span>
          </div>
          <div className="summary-cell">
            <span className="label">階段總數</span>
            <span className="value" data-testid="total-stages">{summary.total}</span>
          </div>
          <div className="summary-cell">
            <span className="label">已完成</span>
            <span className="value" data-testid="completed-stages">{summary.completed}</span>
          </div>
          <div className="summary-cell">
            <span className="label">進行中</span>
            <span className="value" data-testid="in-progress-stages">{summary.inProgress}</span>
          </div>
          <div className="summary-cell">
            <span className="label">阻塞</span>
            <span className="value" data-testid="blocked-stages">{summary.blocked}</span>
          </div>
          <div className="summary-cell">
            <span className="label">完成百分比</span>
            <span className="value" data-testid="percent-complete">{summary.percentComplete}%</span>
          </div>
        </div>
      ) : (
        <p>尚無工程資料。</p>
      )}
    </section>
  )
}
