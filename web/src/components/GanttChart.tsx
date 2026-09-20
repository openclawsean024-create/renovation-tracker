// Gantt chart visualisation. PRD/SPEC.md §5.4 + UI-SPEC §3 timeline-grid.
//
// New design:
//   - sticky label column on the left
//   - day grid with 33+ cells (one per day, weekend highlighted)
//   - month header row spanning the days
//   - bar is a <button> (interactive, hits 44px hit area, color + symbol)

import { useMemo } from 'react'
import { layoutGantt } from '../gantt'
import { displayDate, monthSpans } from '../dates'
import type { Project, Stage, StageStatus } from '../types'

export interface GanttChartProps {
  project: Project
  stages: Stage[]
  /** When supplied, overrides the layout with a fixed start/days range. */
  range?: { start: string; days: number }
}

const STATUS_SYMBOL: Record<StageStatus, string> = {
  not_started: '○',
  in_progress: '◐',
  completed: '●',
  blocked: '✕',
}

const STATUS_LABEL: Record<StageStatus, string> = {
  not_started: '尚未開始',
  in_progress: '進行中',
  completed: '已完成',
  blocked: '阻塞',
}

function addDays(iso: string, n: number): string {
  const ms = new Date(iso).getTime() + n * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

function dayOfWeek(iso: string): number {
  // Sunday = 0 ... Saturday = 6
  return new Date(`${iso}T00:00:00Z`).getUTCDay()
}

function formatMonthLabel(ym: string): string {
  // "2026-09" -> "2026 年 9 月"
  const [y, m] = ym.split('-')
  if (!y || !m) return ym
  return `${y} 年 ${Number(m)} 月`
}

export function GanttChart({ project, stages, range }: GanttChartProps) {
  const layout = useMemo(() => layoutGantt(project, stages), [project, stages])

  const totalDays = range ? range.days : layout.totalDays
  const startDate = range ? range.start : layout.days[0]

  if (totalDays <= 0 || !startDate) {
    return (
      <section className="section" aria-labelledby="gantt-heading">
        <h2 id="gantt-heading">甘特圖</h2>
        <p>工程尚未設定日期範圍，無法顯示甘特圖。</p>
      </section>
    )
  }

  const months = useMemo(() => monthSpans(Array.from({ length: totalDays }, (_, i) => addDays(startDate, i))), [startDate, totalDays])
  const labelColWidth = 1 // grid column 1 is the sticky label column

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.plannedStart.localeCompare(b.plannedStart)),
    [stages],
  )

  // For each stage, compute grid column range from day offset within the visible window.
  const dayList = useMemo(
    () => Array.from({ length: totalDays }, (_, i) => addDays(startDate, i)),
    [startDate, totalDays],
  )

  const startMs = new Date(startDate).getTime()

  function dayOffset(iso: string): number {
    return Math.round((new Date(iso).getTime() - startMs) / 86_400_000)
  }

  return (
    <div
      className="timeline-grid"
      role="grid"
      aria-label={`${project.name} 工期圖`}
    >
      <div className="timeline-corner">工程階段</div>
      {months.map((m, i) => {
        const colFrom = m.from + labelColWidth + 1 // +1 for 1-based
        const span = m.to - m.from + 1
        return (
          <div
            key={`m-${i}`}
            className="month"
            style={{ gridColumn: `${colFrom} / span ${span}`, gridRow: 1 }}
          >
            {formatMonthLabel(m.label)}
          </div>
        )
      })}
      {dayList.map((iso, i) => {
        const dow = dayOfWeek(iso)
        const isWeekend = dow === 0 || dow === 6
        return (
          <div
            key={`d-${i}`}
            className={`day${isWeekend ? ' weekend' : ''}`}
            style={{ gridColumn: `${i + 2}`, gridRow: 2 }}
            aria-hidden="true"
          >
            {Number(iso.slice(8, 10))}
          </div>
        )
      })}

      {sortedStages.map((stage, idx) => {
        const startCol = dayOffset(stage.plannedStart) + 2 // grid is 1-based + label col
        const endOffset = dayOffset(stage.plannedEnd)
        const startIndex = dayOffset(stage.plannedStart)
        const span = Math.max(1, endOffset - startIndex + 1)
        const isFirst = idx === 0
        return (
          <button
            key={`bar-${stage.id}`}
            type="button"
            className={`gantt-hit${isFirst ? ' first' : ''}`}
            data-testid={`gantt-row-${stage.id}`}
            data-tone={stage.status}
            aria-label={`${stage.name}：第 ${startIndex + 1} 天到第 ${endOffset + 1} 天，共 ${span} 天`}
            style={{
              gridColumn: `${startCol} / span ${span}`,
              gridRow: idx + 3,
            }}
          >
            <span className="gantt-bar" aria-hidden="true">
              {STATUS_SYMBOL[stage.status]} {stage.name}
            </span>
          </button>
        )
      })}

      {sortedStages.map((stage, idx) => (
        <div
          key={`lbl-${stage.id}`}
          className="chart-label"
          style={{ gridRow: idx + 3 }}
          data-testid={`gantt-label-${stage.id}`}
        >
          <span className="stage-number" aria-hidden="true">{String(idx + 1).padStart(2, '0')}</span>
          <strong>{stage.name}</strong>
          <span className={`status ${stage.status === 'not_started' ? 'planning' : stage.status === 'in_progress' ? 'in_progress' : stage.status === 'completed' ? 'completed' : 'blocked'}`}>
            <span className="symbol" aria-hidden="true">{STATUS_SYMBOL[stage.status]}</span>
            {STATUS_LABEL[stage.status]}
          </span>
        </div>
      ))}
    </div>
  )
}
