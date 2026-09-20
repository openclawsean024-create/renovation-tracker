// FR-004 readonly view — renders a snapshot produced by `share.ts` without
// any editing controls. SPEC §9 + AC-FR004-02 / AC-FR004-03.

import { useMemo } from 'react'
import { displayDate, monthSpans } from '../dates'
import { dayGridTemplate } from '../gantt'
import type { ShareSnapshot, ShareWarranty } from '../share'
import {
  PHOTO_KIND_LABELS,
  PROJECT_STATUS_LABELS,
  STAGE_STATUS_LABELS,
  WARRANTY_DATE_STATUS_LABELS,
  type Project,
  type Stage,
} from '../types'
import { formatBudgetAmount, formatSignedAmount } from '../budget'

export interface ReadOnlyViewProps {
  snapshot: ShareSnapshot
  /** Source URL shown to the viewer so they can see what they opened. */
  sourceUrl: string
}

export function ReadOnlyView({ snapshot, sourceUrl }: ReadOnlyViewProps) {
  // The readonly view is purely a renderer for an immutable share snapshot.
  // Every `id` field that reaches this component is a SNAPSHOT-LOCAL
  // reference (e.g. `stage-1`, `photo-1`) — never the originating
  // IndexedDB key. SPEC §9.1 forbids exposing IndexedDB keys through the
  // share URL, so we must never reference a real `Project.id` /
  // `Stage.id` / `PhotoRecord.id` here. We synthesise dummy values that
  // satisfy the type contract but carry no source provenance.
  const projectForGantt: Project = useMemo(
    () => ({
      id: 'snapshot-project',
      name: snapshot.project.name,
      ...(snapshot.project.address !== undefined
        ? { address: snapshot.project.address }
        : {}),
      status: snapshot.project.status,
      plannedStart: snapshot.project.plannedStart,
      plannedEnd: snapshot.project.plannedEnd,
      createdAt: snapshot.project.createdAt,
      updatedAt: snapshot.project.updatedAt,
    }),
    [snapshot],
  )
  const stagesForGantt: Stage[] = useMemo(
    () =>
      // `s.id` here is the snapshot-local stage ref (`stage-N`), already
      // assigned by `buildShareSnapshot`. We deliberately do not substitute
      // any other id — the gantt row matcher relies on the row.stageId
      // (also a snapshot-local ref) to find the matching stage.
      snapshot.stages.map((s) => ({
        id: s.id,
        projectId: 'snapshot-project',
        name: s.name,
        order: s.order,
        status: s.status,
        plannedStart: s.plannedStart,
        plannedEnd: s.plannedEnd,
        ...(s.actualStart !== undefined ? { actualStart: s.actualStart } : {}),
        ...(s.actualEnd !== undefined ? { actualEnd: s.actualEnd } : {}),
        ...(s.note !== undefined ? { note: s.note } : {}),
        createdAt: snapshot.project.createdAt,
        updatedAt: snapshot.project.updatedAt,
      })),
    [snapshot],
  )

  // Warranty list rendered in the readonly section. The items are taken
  // verbatim from the snapshot (already mapped to snapshot-local refs and
  // frozen against the generation day), so we never recompute status here.
  const warranties: ShareWarranty[] = snapshot.warranties ?? []

  return (
    <>
      <header className="app-header">
        <h1>裝修進度神器</h1>
        <div className="project-meta">
          <span className="project-name" data-testid="readonly-project-name">
            {snapshot.project.name}
          </span>
          <span
            className="status-pill"
            data-tone={snapshot.project.status}
            aria-label={`工程狀態：${PROJECT_STATUS_LABELS[snapshot.project.status]}`}
          >
            <span className="symbol" aria-hidden="true">
              {snapshot.project.status === 'completed' ? '●'
                : snapshot.project.status === 'in_progress' ? '◐' : '○'}
            </span>
            <span>{PROJECT_STATUS_LABELS[snapshot.project.status]}</span>
          </span>
          <span>
            {displayDate(snapshot.project.plannedStart)} ~ {displayDate(snapshot.project.plannedEnd)}
          </span>
          <span className="readonly-snapshot-meta" data-testid="readonly-generated-at">
            快照產生時間：{formatGeneratedAt(snapshot.generatedAt)}
          </span>
        </div>
      </header>

      <main className="app-main">
        <ReadOnlyBanner sourceUrl={sourceUrl} />

        <section className="section" aria-labelledby="readonly-summary-heading">
          <h2 id="readonly-summary-heading">工程摘要</h2>
          <div className="summary-grid">
            <div className="summary-cell">
              <span className="label">日期範圍</span>
              <span className="value">
                {displayDate(snapshot.project.plannedStart)} ~ {displayDate(snapshot.project.plannedEnd)}
              </span>
            </div>
            <div className="summary-cell">
              <span className="label">階段總數</span>
              <span className="value" data-testid="readonly-total-stages">{snapshot.stageSummary.total}</span>
            </div>
            <div className="summary-cell">
              <span className="label">已完成</span>
              <span className="value" data-testid="readonly-completed-stages">{snapshot.stageSummary.completed}</span>
            </div>
            <div className="summary-cell">
              <span className="label">進行中</span>
              <span className="value">{snapshot.stageSummary.inProgress}</span>
            </div>
            <div className="summary-cell">
              <span className="label">阻塞</span>
              <span className="value">{snapshot.stageSummary.blocked}</span>
            </div>
            <div className="summary-cell">
              <span className="label">完成百分比</span>
              <span className="value" data-testid="readonly-percent-complete">{snapshot.stageSummary.percentComplete}%</span>
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="readonly-stage-heading">
          <h2 id="readonly-stage-heading">階段清單</h2>
          {snapshot.stages.length === 0 ? (
            <p data-testid="readonly-empty-stages">此快照沒有階段資料。</p>
          ) : (
            <ol className="stage-list">
              {snapshot.stages.map((stage) => (
                <li
                  key={stage.id}
                  className="stage-row"
                  data-testid={`readonly-stage-row-${stage.id}`}
                >
                  <div>
                    <p className="stage-name">{stage.name}</p>
                    <div className="stage-meta">
                      <span className="status-pill" data-tone={stage.status}>
                        <span className="symbol" aria-hidden="true">
                          {stage.status === 'completed' ? '●'
                            : stage.status === 'in_progress' ? '◐'
                            : stage.status === 'blocked' ? '⚠' : '○'}
                        </span>
                        <span>{STAGE_STATUS_LABELS[stage.status]}</span>
                      </span>
                      <span>
                        計畫：{displayDate(stage.plannedStart)} ~ {displayDate(stage.plannedEnd)}
                      </span>
                      {stage.actualStart && <span>實際開始：{displayDate(stage.actualStart)}</span>}
                      {stage.actualEnd && <span>實際完成：{displayDate(stage.actualEnd)}</span>}
                      {stage.note && <span>備註：{stage.note}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <ReadOnlyGantt project={projectForGantt} stages={stagesForGantt} />

        <section className="section" aria-labelledby="readonly-photo-heading">
          <h2 id="readonly-photo-heading">照片紀錄</h2>
          <p className="readonly-section-note">
            快照只包含照片分類、日期與說明，不含原圖檔。
          </p>
          {snapshot.photos.length === 0 ? (
            <p data-testid="readonly-photo-empty">此快照沒有照片資料。</p>
          ) : (
            <ul className="readonly-photo-list" data-testid="readonly-photo-list">
              {snapshot.photos.map((photo) => (
                <li
                  key={photo.id}
                  className="readonly-photo-item"
                  data-testid={`readonly-photo-${photo.id}`}
                >
                  <div className="readonly-photo-row">
                    <span className="readonly-photo-name">{photo.fileName}</span>
                    <span className="readonly-photo-kind">
                      {PHOTO_KIND_LABELS[photo.kind]}
                    </span>
                    <span className="readonly-photo-date">{displayDate(photo.takenOn)}</span>
                  </div>
                  {photo.caption && (
                    <p className="readonly-photo-caption">{photo.caption}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="section" aria-labelledby="readonly-budget-heading">
          <h2 id="readonly-budget-heading">預算摘要</h2>
          <div className="budget-summary" data-testid="readonly-budget-summary">
            <div className="budget-summary-cell">
              <span className="label">總預算</span>
              <span className="value">{formatBudgetAmount(snapshot.budgetSummary.totalPlanned)}</span>
            </div>
            <div className="budget-summary-cell">
              <span className="label">實際支出</span>
              <span
                className="value"
                data-tone={snapshot.budgetSummary.isOverrun ? 'overrun' : 'normal'}
              >
                {formatBudgetAmount(snapshot.budgetSummary.totalActual)}
              </span>
            </div>
            <div className="budget-summary-cell">
              <span className="label">剩餘金額</span>
              <span
                className="value"
                data-tone={snapshot.budgetSummary.remaining < 0 ? 'overrun' : snapshot.budgetSummary.remaining > 0 ? 'positive' : 'neutral'}
              >
                {formatSignedAmount(snapshot.budgetSummary.remaining)}
              </span>
            </div>
            <div className="budget-summary-cell">
              <span className="label">超支狀態</span>
              <span
                className="value"
                data-tone={snapshot.budgetSummary.isOverrun ? 'overrun' : 'neutral'}
              >
                {snapshot.budgetSummary.isOverrun
                  ? `超支 ${formatBudgetAmount(snapshot.budgetSummary.totalOverrun)}`
                  : '未超支'}
              </span>
            </div>
            <div className="budget-summary-cell">
              <span className="label">付款狀態</span>
              <span className="value">
                未付款 {snapshot.budgetSummary.paymentCounts.unpaid} ·
                部分付款 {snapshot.budgetSummary.paymentCounts.partial} ·
                已付款 {snapshot.budgetSummary.paymentCounts.paid}
              </span>
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="readonly-schedule-heading">
          <h2 id="readonly-schedule-heading">排程摘要</h2>
          <p className="readonly-summary-line" data-testid="readonly-schedule-summary">
            <strong>共 {snapshot.scheduleSummary.total} 筆</strong>
            {snapshot.scheduleSummary.total > 0 && (
              <>
                {' '}· 未開始／進行中 {snapshot.scheduleSummary.upcoming} ·
                逾期 {snapshot.scheduleSummary.overdue} ·
                已完成 {snapshot.scheduleSummary.completed}
              </>
            )}
          </p>
          {snapshot.scheduleSummary.total === 0 ? (
            <p data-testid="readonly-schedule-empty">目前沒有排程資料。</p>
          ) : (
            <ul className="readonly-schedule-list" data-testid="readonly-schedule-list">
              <li className="readonly-schedule-list-note">
                排程明細因 FR-005 仍以本機為準，未包含於分享快照中；如需查看請回到原工程查看。
              </li>
            </ul>
          )}
        </section>

        <section className="section" aria-labelledby="readonly-warranty-heading">
          <h2 id="readonly-warranty-heading">保固摘要</h2>
          <p className="readonly-summary-line" data-testid="readonly-warranty-summary">
            <strong>共 {snapshot.warrantySummary.total} 筆</strong>
            {snapshot.warrantySummary.total > 0 && (
              <>
                {' '}· 有效中 {snapshot.warrantySummary.active} ·
                30 天內到期 {snapshot.warrantySummary.expiringSoon} ·
                已過期 {snapshot.warrantySummary.expired}
              </>
            )}
          </p>
          {warranties.length === 0 ? (
            <p data-testid="readonly-warranty-empty">目前沒有保固資料。</p>
          ) : (
            <ul className="readonly-warranty-list" data-testid="readonly-warranty-list">
              {warranties.map((w) => (
                <li
                  key={w.id}
                  className="readonly-warranty-item"
                  data-testid={`readonly-warranty-${w.id}`}
                >
                  <div className="readonly-warranty-row">
                    <span className="readonly-warranty-name">{w.itemName}</span>
                    <span
                      className="status-pill"
                      data-tone={`warranty-${w.status}`}
                      aria-label={`保固狀態：${WARRANTY_DATE_STATUS_LABELS[w.status]}`}
                    >
                      <span className="symbol" aria-hidden="true">
                        {w.status === 'active' ? '◐' : w.status === 'expired' ? '⚠' : '○'}
                      </span>
                      <span>{WARRANTY_DATE_STATUS_LABELS[w.status]}</span>
                    </span>
                  </div>
                  <div className="readonly-warranty-meta">
                    <span>提供者：{w.provider}</span>
                    {w.contact && <span>聯絡：{w.contact}</span>}
                    <span>期間：{displayDate(w.startsOn)} ~ {displayDate(w.endsOn)}</span>
                    <span className="readonly-warranty-countdown">
                      {warrantyCountdown(w)}
                    </span>
                    {w.note && <span>備註：{w.note}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  )
}

function ReadOnlyBanner({ sourceUrl }: { sourceUrl: string }) {
  return (
    <section
      className="readonly-banner"
      role="status"
      aria-live="polite"
      data-testid="readonly-banner"
    >
      <p className="readonly-banner-title">
        <span aria-hidden="true">🔒</span> 唯讀分享模式
      </p>
      <p className="readonly-banner-body">
        這是「{sourceUrl.length > 0 ? '分享連結' : 'URL 分享連結'}」產生的唯讀快照，
        不可新增、編輯或刪除資料，也不會寫入本機 IndexedDB。
      </p>
      <p className="readonly-banner-source" data-testid="readonly-source-url">{sourceUrl}</p>
    </section>
  )
}

function ReadOnlyGantt({ project, stages }: { project: Project; stages: Stage[] }) {
  const layout = useMemo(() => {
    // Reuse the production layout helper but without importing layoutGantt to
    // avoid pulling the whole gantt module into the readonly tree (it isn't
    // strictly necessary — we just need the layout grid).
    void project
    void stages
    return null
  }, [project, stages])

  // We re-implement the gantt layout directly to keep the readonly view
  // self-contained — it shares the exact same visual contract as
  // `GanttChart` (SPEC §5.4) but does not touch the production component.
  const ganttLayout = useMemo(() => {
    const days: string[] = []
    const cur = new Date(
      parseInt(project.plannedStart.slice(0, 4), 10),
      parseInt(project.plannedStart.slice(5, 7), 10) - 1,
      parseInt(project.plannedStart.slice(8, 10), 10),
    )
    const end = new Date(
      parseInt(project.plannedEnd.slice(0, 4), 10),
      parseInt(project.plannedEnd.slice(5, 7), 10) - 1,
      parseInt(project.plannedEnd.slice(8, 10), 10),
    )
    while (cur.getTime() <= end.getTime()) {
      const y = cur.getFullYear()
      const m = String(cur.getMonth() + 1).padStart(2, '0')
      const d = String(cur.getDate()).padStart(2, '0')
      days.push(`${y}-${m}-${d}`)
      cur.setDate(cur.getDate() + 1)
    }
    const rows = stages.map((stage) => {
      const startIdx = days.indexOf(stage.plannedStart)
      const endIdx = days.indexOf(stage.plannedEnd)
      const safeStart = startIdx >= 0 ? startIdx : 0
      const safeEnd = endIdx >= 0 ? endIdx : days.length - 1
      return {
        stageId: stage.id,
        name: stage.name,
        startIndex: safeStart,
        endIndex: safeEnd,
        span: Math.max(safeEnd - safeStart + 1, 1),
        withinWindow:
          stage.plannedStart >= project.plannedStart &&
          stage.plannedEnd <= project.plannedEnd,
      }
    })
    return { days, rows, totalDays: days.length }
  }, [project.plannedStart, project.plannedEnd, stages])
  void layout

  const months = useMemo(() => monthSpans(ganttLayout.days), [ganttLayout.days])
  const gridTemplate = useMemo(
    () => dayGridTemplate(ganttLayout.totalDays),
    [ganttLayout.totalDays],
  )

  if (ganttLayout.days.length === 0) {
    return (
      <section className="section" aria-labelledby="readonly-gantt-heading">
        <h2 id="readonly-gantt-heading">甘特圖</h2>
        <p>快照未包含有效的工程日期，無法顯示甘特圖。</p>
      </section>
    )
  }

  return (
    <section className="section" aria-labelledby="readonly-gantt-heading">
      <h2 id="readonly-gantt-heading">甘特圖</h2>
      <p
        className="muted"
        style={{ marginTop: 0, color: 'var(--color-muted)' }}
      >
        範圍：{displayDate(project.plannedStart)} ~ {displayDate(project.plannedEnd)}
        （共 {ganttLayout.totalDays} 天）
      </p>
      <div className="gantt-wrapper">
        <div className="gantt">
          <div className="gantt-header-row" aria-hidden="true">
            <div />
            <div className="gantt-month-row" style={{ gridTemplateColumns: gridTemplate }}>
              {months.map((m) => (
                <div
                  key={m.label}
                  className="gantt-month-cell"
                  style={{ gridColumn: `${m.from + 1} / span ${m.to - m.from + 1}` }}
                >
                  {m.label.replace('-', '/')}
                </div>
              ))}
            </div>
          </div>
          <div className="gantt-header-row" aria-hidden="true">
            <div />
            <div className="gantt-track" style={{ gridTemplateColumns: gridTemplate }}>
              {ganttLayout.days.map((iso, idx) => {
                const dow = new Date(
                  `${iso}T00:00:00`,
                ).getDay()
                const isMonthStart = idx === 0 || iso.endsWith('-01')
                const isWeekend = dow === 0 || dow === 6
                const dayNumber = iso.slice(8, 10)
                return (
                  <div
                    key={iso}
                    className={[
                      'gantt-day',
                      isMonthStart ? 'month-start' : '',
                      isWeekend ? 'weekend' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {dayNumber}
                  </div>
                )
              })}
            </div>
          </div>
          {ganttLayout.rows.map((row) => {
            const stage = stages.find((s) => s.id === row.stageId)
            const tone = stage?.status ?? 'not_started'
            return (
              <div className="gantt-bar-row" key={row.stageId} data-testid={`readonly-gantt-row-${row.stageId}`}>
                <div className="stage-label">{row.name}</div>
                <div className="gantt-bar-track">
                  <div
                    className="gantt-bar"
                    data-tone={tone}
                    data-start-index={row.startIndex}
                    data-end-index={row.endIndex}
                    data-span={row.span}
                    style={{
                      left: `${(row.startIndex / ganttLayout.totalDays) * 100}%`,
                      width: `${(row.span / ganttLayout.totalDays) * 100}%`,
                    }}
                    aria-label={`${row.name}：第 ${row.startIndex + 1} 天到第 ${row.endIndex + 1} 天，共 ${row.span} 天`}
                  >
                    <span style={{ marginLeft: 4 }}>{row.name}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function formatGeneratedAt(iso: string): string {
  // Display-only — never feed back into date math.
  if (typeof iso !== 'string' || iso.length === 0) return '—'
  // Strip seconds for a tighter UI; ISO 8601 strings sort lexically.
  const date = iso.slice(0, 10)
  const time = iso.slice(11, 16)
  if (!time) return date
  return `${date} ${time}`
}

/** Build the same human-readable countdown text we show in the dashboard
 *  row. Uses `daysRemaining` (captured at snapshot time) so the readonly
 *  view does not recompute against local today — recipients see the
 *  snapshot as-of `generatedAt`. */
function warrantyCountdown(w: ShareWarranty): string {
  if (!Number.isFinite(w.daysRemaining)) return ''
  const n = w.daysRemaining
  if (w.status === 'active') {
    if (n === 0) return '今日到期'
    if (n === 1) return '剩 1 天'
    return `剩 ${n} 天`
  }
  if (w.status === 'expired') {
    return `已過期 ${Math.abs(n)} 天`
  }
  return ''
}