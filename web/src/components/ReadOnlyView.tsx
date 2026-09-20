// FR-004 readonly view — renders a snapshot produced by `share.ts` without
// any editing controls. SPEC §9 + AC-FR004-02 / AC-FR004-03.
//
// Rewritten to mirror the new Dashboard shell / hero / summary / section
// pattern. Preserves every data-testid and ARIA label referenced by the
// share test suite.

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
  type StageStatus,
} from '../types'
import { formatBudgetAmount, formatSignedAmount } from '../budget'

export interface ReadOnlyViewProps {
  snapshot: ShareSnapshot
  /** Source URL shown to the viewer so they can see what they opened. */
  sourceUrl: string
}

const NAV_LINKS = [
  { id: 'overview', label: '總覽' },
  { id: 'timeline', label: '階段與工期' },
  { id: 'budget', label: '預算' },
  { id: 'photos', label: '現場照片' },
  { id: 'warranties', label: '保固' },
] as const

const STATUS_SYMBOL: Record<StageStatus, string> = {
  not_started: '○',
  in_progress: '◐',
  completed: '●',
  blocked: '⚠',
}

export function ReadOnlyView({ snapshot, sourceUrl }: ReadOnlyViewProps) {
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

  const warranties: ShareWarranty[] = snapshot.warranties ?? []
  const percent = snapshot.stageSummary.percentComplete

  return (
    <>
      <a className="skip" href="#main">跳至主要內容</a>
      <header className="app-header">
        <div className="wrap">
          <div className="brand-row">
            <span className="brand" aria-label="裝修進度神器 唯讀快照">
              <span className="brand-mark" aria-hidden="true">
                <svg className="icon" viewBox="0 0 28 28" aria-hidden="true">
                  <path d="M5 23V5h10v7H5m10 0 8 11M15 5h8v7h-8M5 23h7v-7H5" />
                </svg>
              </span>
              <span className="wordmark">
                裝修進度神器
                <small>RENOVATION TRACKER</small>
              </span>
            </span>
            <div className="header-note">
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
              <span aria-hidden="true">·</span>
              <span>{displayDate(snapshot.project.plannedStart)} ~ {displayDate(snapshot.project.plannedEnd)}</span>
            </div>
          </div>
          <nav className="nav-row" aria-label="工程導覽（唯讀）">
            {NAV_LINKS.map((n) => (
              <a key={n.id} className="nav-link" href={`#${n.id}`}>{n.label}</a>
            ))}
          </nav>
        </div>
      </header>

      <main className="app-main wrap" id="main">
        <section id="overview" aria-labelledby="readonly-title">
          <ReadOnlyBanner sourceUrl={sourceUrl} />

          <div className="hero">
            <div className="project-intro">
              <div>
                <p className="eyebrow">唯讀工程總覽</p>
                <div className="project-title-row">
                  <h1 id="readonly-title">
                    <span className="project-name" data-testid="readonly-project-name">
                      {snapshot.project.name}
                    </span>
                  </h1>
                </div>
                <p className="muted">
                  {snapshot.stages.length === 0
                    ? '此快照不含任何階段資料。'
                    : `${snapshot.stages.length} 個階段已排定，${
                        snapshot.stageSummary.completed > 0
                          ? `已完成 ${snapshot.stageSummary.completed} 個。`
                          : '尚未有施工進度紀錄。'
                      }`}
                </p>
              </div>
              <div className="intro-bottom">
                <div className="project-dates">
                  <small>預計施工期間</small>
                  <p className="numeric">
                    <time dateTime={snapshot.project.plannedStart}>{displayDate(snapshot.project.plannedStart)}</time>
                    <span className="date-arrow" aria-hidden="true">→</span>
                    <time dateTime={snapshot.project.plannedEnd}>{displayDate(snapshot.project.plannedEnd)}</time>
                  </p>
                </div>
                <span className="readonly-snapshot-meta" data-testid="readonly-generated-at">
                  快照產生時間：{formatGeneratedAt(snapshot.generatedAt)}
                </span>
              </div>
            </div>
          </div>

          <dl className="summary" aria-label="工程摘要">
            <div className="metric completion">
              <dt>工程完成度</dt>
              <dd>
                <span data-testid="readonly-percent-complete">{percent}%</span>
              </dd>
              <div
                className="progress"
                role="progressbar"
                aria-label={`工程完成度，${percent}%`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                {Array.from({ length: 10 }).map((_, i) => (
                  <span key={i} aria-hidden="true" />
                ))}
              </div>
            </div>
            <div className="metric">
              <dt>階段總數</dt>
              <dd>
                <span data-testid="readonly-total-stages">{snapshot.stageSummary.total}</span>
                <small>個</small>
              </dd>
            </div>
            <div className="metric">
              <dt>已完成</dt>
              <dd>
                <span data-testid="readonly-completed-stages">{snapshot.stageSummary.completed}</span>
                <small>個</small>
              </dd>
            </div>
            <div className="metric">
              <dt>進行中</dt>
              <dd>{snapshot.stageSummary.inProgress}<small>個</small></dd>
            </div>
            <div className="metric">
              <dt>阻塞</dt>
              <dd>{snapshot.stageSummary.blocked}<small>個</small></dd>
            </div>
            <div className="metric dates">
              <dt>計畫日期</dt>
              <dd>
                <span>
                  <small>開始</small>
                  <time dateTime={snapshot.project.plannedStart}>{displayDate(snapshot.project.plannedStart)}</time>
                </span>
                <span>
                  <small>完成</small>
                  <time dateTime={snapshot.project.plannedEnd}>{displayDate(snapshot.project.plannedEnd)}</time>
                </span>
              </dd>
            </div>
          </dl>
        </section>

        <section className="section" id="timeline" aria-labelledby="readonly-stage-heading">
          <header className="section-header">
            <div className="section-heading">
              <h2 id="readonly-stage-heading">階段清單</h2>
              <span className="section-count">{snapshot.stages.length} 個階段</span>
            </div>
          </header>
          {snapshot.stages.length === 0 ? (
            <div className="empty-state">
              <p data-testid="readonly-empty-stages">此快照沒有階段資料。</p>
            </div>
          ) : (
            <ol className="stage-list">
              {snapshot.stages.map((stage) => (
                <li
                  key={stage.id}
                  className="stage-row"
                  data-testid={`readonly-stage-row-${stage.id}`}
                >
                  <span className="stage-name">{stage.name}</span>
                  <div className="stage-meta">
                    <span
                      className="status-pill"
                      data-tone={stage.status}
                      aria-label={`階段狀態：${STAGE_STATUS_LABELS[stage.status]}`}
                    >
                      <span className="symbol" aria-hidden="true">{STATUS_SYMBOL[stage.status]}</span>
                      <span>{STAGE_STATUS_LABELS[stage.status]}</span>
                    </span>
                    <span className="stage-period">
                      計畫：{displayDate(stage.plannedStart)} ~ {displayDate(stage.plannedEnd)}
                    </span>
                    {stage.actualStart && <span>實際開始：{displayDate(stage.actualStart)}</span>}
                    {stage.actualEnd && <span>實際完成：{displayDate(stage.actualEnd)}</span>}
                    {stage.note && <span>備註：{stage.note}</span>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="section" aria-labelledby="readonly-gantt-heading">
          <header className="section-header">
            <div className="section-heading">
              <h2 id="readonly-gantt-heading">工期圖</h2>
            </div>
          </header>
          <ReadOnlyGantt project={projectForGantt} stages={stagesForGantt} />
        </section>

        <section className="section" id="photos" aria-labelledby="readonly-photo-heading">
          <header className="section-header">
            <div className="section-heading">
              <h2 id="readonly-photo-heading">照片紀錄</h2>
              <span className="section-count">{snapshot.photos.length} 張快照</span>
            </div>
          </header>
          <p className="readonly-section-note">
            快照只包含照片分類、日期與說明，不含原圖檔。
          </p>
          {snapshot.photos.length === 0 ? (
            <div className="empty-state">
              <p data-testid="readonly-photo-empty">此快照沒有照片資料。</p>
            </div>
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

        <section className="section" id="budget" aria-labelledby="readonly-budget-heading">
          <header className="section-header">
            <div className="section-heading">
              <h2 id="readonly-budget-heading">預算摘要</h2>
            </div>
          </header>
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

        <section className="section" id="warranties" aria-labelledby="readonly-warranty-heading">
          <header className="section-header">
            <div className="section-heading">
              <h2 id="readonly-warranty-heading">保固摘要</h2>
              <span className="section-count">{warranties.length} 筆保固</span>
            </div>
          </header>
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
            <div className="empty-state">
              <p data-testid="readonly-warranty-empty">目前沒有保固資料。</p>
            </div>
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

        <footer>
          <span className="footer-wordmark">裝修進度神器</span>
          <span>唯讀分享模式 · 資料不會自動更新</span>
        </footer>
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
      <div>
        <p className="readonly-banner-title">
          <span aria-hidden="true">🔒</span> 唯讀分享模式
        </p>
        <p className="readonly-banner-body">
          這是「{sourceUrl.length > 0 ? '分享連結' : 'URL 分享連結'}」產生的唯讀快照，
          不可新增、編輯或刪除資料，也不會寫入本機 IndexedDB。
        </p>
        <p className="readonly-banner-source" data-testid="readonly-source-url">{sourceUrl}</p>
      </div>
    </section>
  )
}

function ReadOnlyGantt({ project, stages }: { project: Project; stages: Stage[] }) {
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

  const months = useMemo(() => monthSpans(ganttLayout.days), [ganttLayout.days])
  const gridTemplate = useMemo(
    () => dayGridTemplate(ganttLayout.totalDays),
    [ganttLayout.totalDays],
  )

  if (ganttLayout.days.length === 0) {
    return <p>快照未包含有效的工程日期，無法顯示甘特圖。</p>
  }

  return (
    <>
      <p className="muted">
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
                const dow = new Date(`${iso}T00:00:00`).getDay()
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
              <div
                className="gantt-bar-row"
                key={row.stageId}
                data-testid={`readonly-gantt-row-${row.stageId}`}
              >
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
                    <span className="gantt-bar-label">{row.name}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function formatGeneratedAt(iso: string): string {
  if (typeof iso !== 'string' || iso.length === 0) return '—'
  const date = iso.slice(0, 10)
  const time = iso.slice(11, 16)
  if (!time) return date
  return `${date} ${time}`
}

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
