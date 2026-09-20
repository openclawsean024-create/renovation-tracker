// Dashboard — editable surface. Renders the new brand-row + nav-row + hero
// + summary + section pattern. Preserves every data-testid and ARIA label
// referenced by the integration suite (Dashboard.*.test.tsx).

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  useDashboard,
  StageValidationError,
  type UpdateStageArgs,
} from '../store'
import { ProjectStatusPill } from './StatusPill'
import { StageForm } from './StageForm'
import { ConfirmDialog } from './ConfirmDialog'
import { StageRow } from './StageRow'
import { GanttChart } from './GanttChart'
import { BudgetSection } from './BudgetSection'
import { PhotoSection } from './PhotoSection'
import { ScheduleSection } from './ScheduleSection'
import { WarrantySection } from './WarrantySection'
import { Modal } from './Modal'
import { displayDate, todayISO } from '../dates'
import { summarizeStages } from '../status'
import { summarizeBudget } from '../budget'
import { summarizeSchedules } from '../schedule'
import { summarizeWarranties } from '../warranty'
import { layoutGantt } from '../gantt'
import {
  SHARE_HASH_KEY,
  buildShareSnapshot,
  encodeShareSnapshot,
  stripShareUrl,
  type ShareSnapshot,
} from '../share'
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type Project,
  type Stage,
} from '../types'

type StageView = 'list' | 'chart'

const NAV_LINKS = [
  { id: 'overview', label: '總覽' },
  { id: 'timeline', label: '階段與工期' },
  { id: 'budget', label: '預算' },
  { id: 'photos', label: '現場照片' },
  { id: 'schedule', label: '近期工作' },
  { id: 'warranties', label: '保固' },
] as const

function NavLink({ id, label, active }: { id: string; label: string; active: boolean }) {
  return (
    <a
      className="nav-link"
      href={`#${id}`}
      aria-current={active ? 'location' : undefined}
    >
      {label}
    </a>
  )
}

type ClipboardWriter = (text: string) => Promise<void>

function defaultClipboardWriter(): ClipboardWriter {
  return async (text) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text)
      return
    }
    throw new Error('瀏覽器不支援複製功能')
  }
}

type ShareFeedback =
  | { tone: 'success'; message: string }
  | { tone: 'error'; message: string }
  | null

export function Dashboard({
  clipboard = defaultClipboardWriter(),
}: {
  /** Override the clipboard API — only used by tests for determinism. */
  clipboard?: ClipboardWriter
} = {}) {
  const {
    loadState,
    error,
    project,
    stages,
    photos,
    budgets,
    schedules,
    warranties,
    createStage,
    updateStage,
    deleteStage,
    updateProject,
  } = useDashboard()

  const [stageView, setStageView] = useState<StageView>('list')
  const [formMode, setFormMode] = useState<'closed' | 'create' | 'edit'>('closed')
  const [editingStage, setEditingStage] = useState<Stage | undefined>(undefined)
  const [pendingDeleteStage, setPendingDeleteStage] = useState<Stage | undefined>(undefined)
  const [shareFeedback, setShareFeedback] = useState<ShareFeedback>(null)
  const [shareDialogUrl, setShareDialogUrl] = useState<string>('')
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareDialogCopied, setShareDialogCopied] = useState(false)
  const [activeSection, setActiveSection] = useState<string>('overview')
  const mainRef = useRef<HTMLElement | null>(null)
  const shareDialogTitleId = useId()

  // Scroll-spy: highlight the nav link for the section nearest the top of the viewport.
  useEffect(() => {
    const main = mainRef.current
    if (!main) return
    const ids = NAV_LINKS.map((n) => n.id)
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el))
    if (sections.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]?.target?.id) {
          setActiveSection(visible[0].target.id)
        }
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.5, 1] },
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  const stageSummary = useMemo(() => summarizeStages(stages), [stages])
  const budgetSummary = useMemo(() => summarizeBudget(budgets), [budgets])
  const scheduleSummary = useMemo(
    () => summarizeSchedules(schedules, todayISO()),
    [schedules],
  )
  const warrantySummary = useMemo(
    () => summarizeWarranties(warranties, todayISO()),
    [warranties],
  )

  const canShare = loadState === 'ready' && project !== null

  const handleGenerateShare = useCallback(async () => {
    setShareFeedback(null)
    if (!project) {
      setShareFeedback({ tone: 'error', message: '尚未載入工程資料，無法產生分享連結' })
      return
    }
    const layout = layoutGantt(project, stages)
    const snapshot: ShareSnapshot = buildShareSnapshot({
      project,
      stages,
      stageSummary: {
        total: stageSummary.total,
        completed: stageSummary.completed,
        inProgress: stageSummary.inProgress,
        blocked: stageSummary.blocked,
        notStarted: stageSummary.notStarted,
        percentComplete: stageSummary.percentComplete,
      },
      gantt: {
        totalDays: layout.totalDays,
        days: layout.days,
        rows: layout.rows,
      },
      photos: photos.map((p) => ({
        id: p.id,
        kind: p.kind,
        ...(p.caption !== undefined ? { caption: p.caption } : {}),
        takenOn: p.takenOn,
        fileName: p.fileName,
        mimeType: p.mimeType,
      })),
      budgetSummary: {
        total: budgetSummary.total,
        totalPlanned: budgetSummary.totalPlanned,
        totalActual: budgetSummary.totalActual,
        remaining: budgetSummary.remaining,
        isOverrun: budgetSummary.isOverrun,
        totalOverrun: budgetSummary.totalOverrun,
        overrunItemCount: budgetSummary.overrunItemCount,
        paymentCounts: { ...budgetSummary.paymentCounts },
      },
      scheduleSummary: {
        total: scheduleSummary.total,
        upcoming: scheduleSummary.upcoming,
        overdue: scheduleSummary.overdue,
        completed: scheduleSummary.completed,
      },
      warrantySummary: {
        total: warrantySummary.total,
        expiringSoon: warrantySummary.expiringSoon,
        expired: warrantySummary.expired,
        active: warrantySummary.active,
      },
      warranties: warranties.map((w) => ({
        id: w.id,
        itemName: w.itemName,
        provider: w.provider,
        contact: w.contact,
        startsOn: w.startsOn,
        endsOn: w.endsOn,
        note: w.note,
      })),
    })
    const encoded = encodeShareSnapshot(snapshot)
    if (typeof window === 'undefined') {
      setShareFeedback({ tone: 'error', message: '瀏覽器環境不可用，無法產生連結' })
      return
    }
    const base = stripShareUrl(window.location.href)
    const next = `${base}#${SHARE_HASH_KEY}=${encoded}`
    try {
      window.history.replaceState(null, '', next)
    } catch (err) {
      setShareFeedback({
        tone: 'error',
        message: err instanceof Error ? `無法更新網址：${err.message}` : '無法更新網址',
      })
      return
    }
    setShareDialogUrl(next)
    setShareDialogOpen(true)
    setShareDialogCopied(false)
    try {
      await clipboard(next)
      setShareFeedback({ tone: 'success', message: '已複製唯讀分享連結' })
    } catch (err) {
      setShareFeedback({
        tone: 'error',
        message:
          err instanceof Error
            ? `連結已產生，但複製失敗：${err.message}`
            : '連結已產生，但複製失敗',
      })
    }
  }, [budgets, budgetSummary, clipboard, photos, project, stageSummary, stages, schedules, scheduleSummary, warranties, warrantySummary])

  const handleCloseShareDialog = useCallback(() => {
    setShareDialogOpen(false)
    setShareDialogCopied(false)
  }, [])

  const handleCopyShareDialogUrl = useCallback(async () => {
    if (!shareDialogUrl) return
    try {
      await clipboard(shareDialogUrl)
      setShareDialogCopied(true)
    } catch (err) {
      setShareFeedback({
        tone: 'error',
        message:
          err instanceof Error
            ? `連結已產生，但複製失敗：${err.message}`
            : '連結已產生，但複製失敗',
      })
      setShareDialogCopied(false)
    }
  }, [clipboard, shareDialogUrl])

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.plannedStart.localeCompare(b.plannedStart)),
    [stages],
  )

  const nextStage = useMemo(() => {
    const todo = sortedStages.find((s) => s.status !== 'completed')
    return todo ?? sortedStages[0]
  }, [sortedStages])

  function openCreateStage() {
    setEditingStage(undefined)
    setFormMode('create')
  }
  function openEditStage(stage: Stage) {
    setEditingStage(stage)
    setFormMode('edit')
  }
  function openDeleteStage(stage: Stage) {
    setPendingDeleteStage(stage)
  }

  function handleCreate(input: import('../types').NewStageInput) {
    return createStage({ input })
      .then(() => {
        setFormMode('closed')
      })
      .catch((err) => {
        if (err instanceof StageValidationError) throw err
        throw err
      })
  }

  function handleEdit(id: string, patch: UpdateStageArgs['patch']) {
    return updateStage({ id, patch }).then(() => {
      setFormMode('closed')
    })
  }

  function handleDelete() {
    if (!pendingDeleteStage) return
    return deleteStage(pendingDeleteStage.id).then(() => {
      setPendingDeleteStage(undefined)
    })
  }

  if (loadState === 'idle' || loadState === 'loading') {
    return (
      <main className="app-main" aria-busy="true">
        <p>載入中…</p>
      </main>
    )
  }
  if (loadState === 'error') {
    return (
      <main className="app-main" role="alert">
        <p>無法載入工程資料：{error ?? '未知錯誤'}</p>
      </main>
    )
  }
  if (!project) {
    return (
      <main className="app-main">
        <p>尚無工程資料。</p>
      </main>
    )
  }

  const empty = stages.length === 0
  const percent = stageSummary.percentComplete

  return (
    <>
      <a className="skip" href="#main">跳至主要內容</a>
      <header className="app-header">
        <div className="wrap">
          <div className="brand-row">
            <a className="brand" href="#overview" aria-label="裝修進度神器 工程總覽">
              <span className="brand-mark" aria-hidden="true">
                <svg className="icon" viewBox="0 0 28 28" aria-hidden="true">
                  <path d="M5 23V5h10v7H5m10 0 8 11M15 5h8v7h-8M5 23h7v-7H5" />
                </svg>
              </span>
              <span className="wordmark">
                裝修進度神器
                <small>RENOVATION TRACKER</small>
              </span>
            </a>
            <div className="header-note">
              <ProjectStatusPill status={project.status} />
              <span aria-hidden="true">·</span>
              <span>{displayDate(project.plannedStart)} ~ {displayDate(project.plannedEnd)}</span>
              <label className="status-switcher">
                <span>切換狀態：</span>
                <select
                  aria-label="切換工程狀態"
                  value={project.status}
                  onChange={(e) => {
                    void updateProject({ status: e.target.value as Project['status'] })
                  }}
                >
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <nav className="nav-row" aria-label="工程導覽">
            {NAV_LINKS.map((n) => (
              <NavLink key={n.id} id={n.id} label={n.label} active={activeSection === n.id} />
            ))}
          </nav>
        </div>
      </header>

      <main className="app-main wrap" id="main" ref={mainRef} tabIndex={-1}>
        <section id="overview" aria-labelledby="project-title">
          <div className="hero">
            <div className="project-intro">
              <div>
                <p className="eyebrow">工程總覽</p>
                <div className="project-title-row">
                  <h1 id="project-title" className="project-name" data-testid="project-name">{project.name}</h1>
                  <ProjectStatusPill status={project.status} />
                </div>
                <p className="muted">
                  {empty
                    ? '尚未建立任何階段。'
                    : `${sortedStages.length} 個階段已排定，${
                        stageSummary.completed > 0
                          ? `已完成 ${stageSummary.completed} 個。`
                          : '尚未有施工進度紀錄。'
                      }`}
                </p>
              </div>
              <div className="intro-bottom">
                <div className="project-dates">
                  <small>預計施工期間</small>
                  <p className="numeric">
                    <time dateTime={project.plannedStart}>{displayDate(project.plannedStart)}</time>
                    <span className="date-arrow" aria-hidden="true">→</span>
                    <time dateTime={project.plannedEnd}>{displayDate(project.plannedEnd)}</time>
                  </p>
                </div>
                <div className="share-actions">
                  <button
                    type="button"
                    className="btn primary edit-control"
                    onClick={() => { void handleGenerateShare() }}
                    disabled={!canShare}
                    aria-label="產生唯讀分享連結"
                    data-testid="generate-share"
                  >
                    產生唯讀分享連結
                  </button>
                  {shareFeedback ? (
                    <span
                      className="share-toast"
                      data-tone={shareFeedback.tone}
                      data-testid="share-feedback"
                      role="status"
                    >
                      {shareFeedback.message}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <aside className="next-step" aria-labelledby="next-title">
              <div>
                <div className="next-top">
                  <span className="eyebrow">下一個階段</span>
                  {nextStage ? (
                    <span
                      className="step-index"
                      aria-label={`第 ${sortedStages.indexOf(nextStage) + 1} 個，共 ${sortedStages.length} 個階段`}
                    >
                      {String(sortedStages.indexOf(nextStage) + 1).padStart(2, '0')} / {String(sortedStages.length).padStart(2, '0')}
                    </span>
                  ) : null}
                </div>
                {nextStage ? (
                  <>
                    <h2 id="next-title">{nextStage.name}</h2>
                    <p>
                      預計 {displayDate(nextStage.plannedStart)} 開始
                      {nextStage.note ? ` · ${nextStage.note}` : ''}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 id="next-title">尚未建立階段</h2>
                    <p>建立第一個階段，開始追蹤工程進度。</p>
                  </>
                )}
              </div>
              <div className="next-footer">
                {nextStage ? (
                  <button
                    type="button"
                    className="btn edit-control"
                    onClick={() => openEditStage(nextStage)}
                  >
                    更新階段
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn edit-control"
                    onClick={openCreateStage}
                  >
                    新增第一個階段
                  </button>
                )}
              </div>
            </aside>
          </div>

          <dl className="summary" aria-label="工程摘要">
            <div className="metric completion">
              <dt>工程完成度</dt>
              <dd>
                <span data-testid="percent-complete">{percent}%</span>
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
                <span data-testid="total-stages">{sortedStages.length}</span>
                <small>個</small>
              </dd>
            </div>
            <div className="metric">
              <dt>已完成</dt>
              <dd>
                <span data-testid="completed-stages">{stageSummary.completed}</span>
                <small>個</small>
              </dd>
            </div>
            <div className="metric">
              <dt>進行中</dt>
              <dd>
                <span data-testid="in-progress-stages">{stageSummary.inProgress}</span>
                <small>個</small>
              </dd>
            </div>
            <div className="metric">
              <dt>阻塞</dt>
              <dd>
                <span data-testid="blocked-stages">{stageSummary.blocked}</span>
                <small>個</small>
              </dd>
            </div>
            <div className="metric dates">
              <dt>計畫日期</dt>
              <dd>
                <span>
                  <small>開始</small>
                  <time dateTime={project.plannedStart}>{displayDate(project.plannedStart)}</time>
                </span>
                <span>
                  <small>完成</small>
                  <time dateTime={project.plannedEnd}>{displayDate(project.plannedEnd)}</time>
                </span>
              </dd>
            </div>
          </dl>
        </section>

        <section className="section stage-section" id="timeline" aria-labelledby="stages-title">
          <header className="section-header">
            <div>
              <div className="section-heading">
                <h2 id="stages-title">階段與工期</h2>
                <span className="section-count" data-testid="stage-section-count">
                  {sortedStages.length} 個階段
                </span>
              </div>
              <p>從拆除到驗收，每一步都有清楚的時間位置。</p>
            </div>
            <div className="section-tools">
              <div className="view-switch" role="tablist" aria-label="階段檢視方式">
                <button
                  type="button"
                  role="tab"
                  id="tab-list"
                  aria-controls="panel-list"
                  aria-selected={stageView === 'list'}
                  tabIndex={stageView === 'list' ? 0 : -1}
                  onClick={() => setStageView('list')}
                >
                  清單
                </button>
                <button
                  type="button"
                  role="tab"
                  id="tab-chart"
                  aria-controls="panel-chart"
                  aria-selected={stageView === 'chart'}
                  tabIndex={stageView === 'chart' ? 0 : -1}
                  onClick={() => setStageView('chart')}
                >
                  時間軸
                </button>
              </div>
              <button
                type="button"
                className="btn edit-control"
                onClick={openCreateStage}
                data-testid="add-stage"
              >
                新增階段
              </button>
            </div>
          </header>

          {stageView === 'chart' ? (
            <div id="panel-chart" role="tabpanel" aria-labelledby="tab-chart">
              <div className="board-intro">
                <strong data-testid="gantt-period">
                  {project.plannedStart.slice(0, 4)} 年 {Number(project.plannedStart.slice(5, 7))} 月起
                </strong>
                <span className="legend">預計施工期間</span>
              </div>
            </div>
          ) : (
            <div id="panel-list" role="tabpanel" aria-labelledby="tab-list">
              {empty ? (
                <div className="empty-state" data-testid="empty-state">
                  <h3>目前沒有任何階段</h3>
                  <p>點選下方按鈕建立第一個階段，工程完成度會自動計算。</p>
                  <div className="empty-cta">
                    <button
                      type="button"
                      className="btn primary edit-control"
                      onClick={openCreateStage}
                      data-testid="add-stage-empty"
                    >
                      新增階段
                    </button>
                  </div>
                </div>
              ) : (
                <ol className="stage-list" id="stage-list">
                  {sortedStages.map((stage, idx) => (
                    <StageRow
                      key={stage.id}
                      stage={stage}
                      index={idx}
                      onEdit={() => openEditStage(stage)}
                      onDelete={() => openDeleteStage(stage)}
                    />
                  ))}
                </ol>
              )}
              {!empty ? (
                <div className="board-foot">
                  <span>依施工順序排列 · 共 {sortedStages.length} 個階段</span>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section className="section" aria-labelledby="gantt-heading">
          <header className="section-header">
            <div className="section-heading">
              <h2 id="gantt-heading">工期圖</h2>
            </div>
          </header>
          <div className="timeline-scroll">
            <GanttChart project={project} stages={sortedStages} />
          </div>
        </section>

        <div className="records-heading">
          <h2>工程紀錄</h2>
          <p>費用、現場與交付資料，在這裡逐步累積。</p>
        </div>
        <div className="records-grid">
          <BudgetSection />
          <PhotoSection />
        </div>

        <section className="section support">
          <ScheduleSection stages={stages} />
          <WarrantySection />
        </section>

        <footer>
          <span className="footer-wordmark">裝修進度神器</span>
          <span>本機儲存 · 資料不會自動上傳</span>
        </footer>
      </main>

      <StageForm
        open={formMode === 'create' || formMode === 'edit'}
        mode={formMode === 'edit' ? 'edit' : 'create'}
        projectId={project.id}
        projectPlannedStart={project.plannedStart}
        projectPlannedEnd={project.plannedEnd}
        initialStage={formMode === 'edit' ? editingStage : undefined}
        onCancel={() => setFormMode('closed')}
        onSubmitCreate={handleCreate as unknown as Parameters<typeof StageForm>[0]['onSubmitCreate']}
        onSubmitEdit={handleEdit as unknown as Parameters<typeof StageForm>[0]['onSubmitEdit']}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteStage)}
        title="刪除階段"
        description={
          pendingDeleteStage
            ? `確定要刪除「${pendingDeleteStage.name}」嗎？此操作無法復原。`
            : ''
        }
        onCancel={() => setPendingDeleteStage(undefined)}
        onConfirm={handleDelete}
      />

      <Modal
        open={shareDialogOpen}
        title="唯讀分享"
        onClose={handleCloseShareDialog}
        labelledById={shareDialogTitleId}
      >
        <p className="muted share-dialog-intro">
          已產生當下的唯讀快照。可檢視以下資訊後複製連結。
        </p>
        <dl className="share-facts" data-testid="share-dialog">
          <div>
            <dt>工程名稱</dt>
            <dd data-testid="share-facts-project-name">{project.name}</dd>
          </div>
          <div>
            <dt>階段總數</dt>
            <dd data-testid="share-facts-stage-count">{sortedStages.length} 個</dd>
          </div>
          <div>
            <dt>已完成比例</dt>
            <dd data-testid="share-facts-completed-ratio">
              {stageSummary.completed} / {stageSummary.total}（{percent}%）
            </dd>
          </div>
          <div>
            <dt>建立日期</dt>
            <dd data-testid="share-facts-created-on">
              {displayDate(project.createdAt.slice(0, 10))}
            </dd>
          </div>
          <div>
            <dt>近期工作</dt>
            <dd data-testid="share-facts-schedule-count">{scheduleSummary.total} 個</dd>
          </div>
          <div>
            <dt>保固紀錄</dt>
            <dd data-testid="share-facts-warranty-count">{warrantySummary.total} 筆</dd>
          </div>
        </dl>
        <div className="field share-dialog-url-field">
          <label htmlFor={`${shareDialogTitleId}-url`}>分享連結</label>
          <input
            id={`${shareDialogTitleId}-url`}
            type="text"
            readOnly
            value={shareDialogUrl}
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => e.currentTarget.select()}
            data-testid="share-dialog-url"
          />
        </div>
        <div className="dialog-actions">
          <button
            type="button"
            className="btn"
            onClick={handleCloseShareDialog}
            data-testid="share-dialog-close"
          >
            關閉
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => { void handleCopyShareDialogUrl() }}
            data-testid="share-dialog-copy"
          >
            {shareDialogCopied ? '已複製' : '複製分享連結'}
          </button>
        </div>
      </Modal>
    </>
  )
}
