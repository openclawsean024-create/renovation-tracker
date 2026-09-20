// Gantt chart visualisation. PRD/SPEC.md §5.4.

import { useMemo } from 'react'
import { layoutGantt, dayGridTemplate } from '../gantt'
import { displayDate, monthSpans } from '../dates'
import type { Project, Stage } from '../types'

export interface GanttChartProps {
  project: Project
  stages: Stage[]
}

export function GanttChart({ project, stages }: GanttChartProps) {
  const layout = useMemo(() => layoutGantt(project, stages), [project, stages])
  const months = useMemo(() => monthSpans(layout.days), [layout.days])
  const gridTemplate = useMemo(() => dayGridTemplate(layout.totalDays), [layout.totalDays])
  const dayTpl = { gridTemplateColumns: gridTemplate }
  void dayTpl

  if (layout.days.length === 0) {
    return (
      <section className="section" aria-labelledby="gantt-heading">
        <h2 id="gantt-heading">甘特圖</h2>
        <p>工程尚未設定日期範圍，無法顯示甘特圖。</p>
      </section>
    )
  }

  const dayLabel = (iso: string): string => {
    const parts = iso.split('-')
    return parts[2] ?? ''
  }

  const monthLabel = (key: string): string => {
    const [y, m] = key.split('-')
    return `${y}/${m}`
  }

  return (
    <section className="section" aria-labelledby="gantt-heading">
      <h2 id="gantt-heading">甘特圖</h2>
      <p className="muted" style={{ marginTop: 0, color: 'var(--color-muted)' }}>
        範圍：{displayDate(project.plannedStart)} ~ {displayDate(project.plannedEnd)}
        （共 {layout.totalDays} 天）
      </p>
      <div className="gantt-wrapper">
        <div className="gantt">
          {/* Month header */}
          <div className="gantt-header-row" aria-hidden="true">
            <div />
            <div className="gantt-month-row" style={dayTpl}>
              {months.map((m) => (
                <div
                  key={m.label}
                  className="gantt-month-cell"
                  style={{ gridColumn: `${m.from + 1} / span ${m.to - m.from + 1}` }}
                >
                  {monthLabel(m.label)}
                </div>
              ))}
            </div>
          </div>
          {/* Day header */}
          <div className="gantt-header-row" aria-hidden="true">
            <div />
            <div className="gantt-track" style={dayTpl}>
              {layout.days.map((iso, idx) => {
                const d = new Date(iso + 'T00:00:00')
                const dow = d.getDay()
                const isMonthStart = idx === 0 || iso.endsWith('-01')
                const isWeekend = dow === 0 || dow === 6
                return (
                  <div
                    key={iso}
                    className={['gantt-day', isMonthStart ? 'month-start' : '', isWeekend ? 'weekend' : ''].filter(Boolean).join(' ')}
                  >
                    {dayLabel(iso)}
                  </div>
                )
              })}
            </div>
          </div>
          {/* Bars */}
          {layout.rows.map((row) => (
            <div className="gantt-bar-row" key={row.stageId} data-testid={`gantt-row-${row.stageId}`}>
              <div className="stage-label">{row.name}</div>
              <div className="gantt-bar-track">
                {(() => {
                  const stage = stages.find((s) => s.id === row.stageId)
                  const tone = stage?.status ?? 'not_started'
                  return (
                    <div
                      className="gantt-bar"
                      data-tone={tone}
                      data-start-index={row.startIndex}
                      data-end-index={row.endIndex}
                      data-span={row.span}
                      style={{
                        left: `${(row.startIndex / layout.totalDays) * 100}%`,
                        width: `${(row.span / layout.totalDays) * 100}%`,
                      }}
                      aria-label={`${row.name}：第 ${row.startIndex + 1} 天到第 ${row.endIndex + 1} 天，共 ${row.span} 天`}
                    >
                      <span style={{ marginLeft: 4 }}>{row.name}</span>
                    </div>
                  )
                })()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
