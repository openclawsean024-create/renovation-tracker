// Top-level dashboard. Owns the create/edit/delete UI orchestration.
//
// FR-004 share routing now lives in `AppShell.tsx`. By the time this
// component renders, AppShell has already decided we are in editable
// mode and has mounted the <DashboardProvider>. So we no longer need to
// peek at `window.location.hash` here — that responsibility has moved
// one level up so the read-only surface never accidentally triggers the
// provider's IndexedDB load effect (SPEC §9.1 + AC-FR004-02).

import { useCallback, useMemo, useState } from 'react'
import { useDashboard, StageValidationError } from '../store'
import { Summary } from './Summary'
import { StageRow } from './StageRow'
import { StageForm } from './StageForm'
import { ConfirmDialog } from './ConfirmDialog'
import { GanttChart } from './GanttChart'
import { ProjectStatusPill } from './StatusPill'
import { PhotoSection } from './PhotoSection'
import { BudgetSection } from './BudgetSection'
import { ScheduleSection } from './ScheduleSection'
import { WarrantySection } from './WarrantySection'
import { displayDate, todayISO } from '../dates'
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, type Project, type Stage } from '../types'
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

type FormState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; stage: Stage }

type ConfirmState =
  | { mode: 'closed' }
  | { mode: 'delete'; stage: Stage }

type ShareFeedback =
  | { tone: 'success'; message: string }
  | { tone: 'error'; message: string }
  | null

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
  const [form, setForm] = useState<FormState>({ mode: 'closed' })
  const [confirm, setConfirm] = useState<ConfirmState>({ mode: 'closed' })
  const [toast, setToast] = useState<string | null>(null)
  const [shareFeedback, setShareFeedback] = useState<ShareFeedback>(null)

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
    // Write the snapshot into the URL hash so a reload of the same tab keeps it.
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
    try {
      await clipboard(next)
      setShareFeedback({ tone: 'success', message: '已複製唯讀分享連結' })
    } catch (err) {
      // Link is still in the URL even if clipboard failed — user can copy
      // manually. Per SPEC §9 the message must be understandable.
      setShareFeedback({
        tone: 'error',
        message:
          err instanceof Error
            ? `連結已產生，但複製失敗：${err.message}`
            : '連結已產生，但複製失敗',
      })
    }
  }, [budgets, budgetSummary, clipboard, photos, project, stageSummary, stages, schedules, scheduleSummary, warranties, warrantySummary])

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

  function handleCreate(input: Parameters<typeof createStage>[0]['input']) {
    return createStage({ input }).then(() => {
      setForm({ mode: 'closed' })
      setToast('已新增階段')
    }).catch((err) => {
      if (err instanceof StageValidationError) throw err
      throw err
    })
  }

  function handleEdit(id: string, patch: Parameters<typeof updateStage>[0]['patch']) {
    return updateStage({ id, patch }).then(() => {
      setForm({ mode: 'closed' })
      setToast('已更新階段')
    })
  }

  function handleDelete() {
    if (confirm.mode !== 'delete') return
    return deleteStage(confirm.stage.id).then(() => {
      setConfirm({ mode: 'closed' })
      setToast('已刪除階段')
    })
  }

  return (
    <>
      <header className="app-header">
        <h1>裝修進度神器</h1>
        <div className="project-meta">
          <span className="project-name" data-testid="project-name">{project.name}</span>
          <ProjectStatusPill status={project.status} />
          <span>{displayDate(project.plannedStart)} ~ {displayDate(project.plannedEnd)}</span>
          <label style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-muted)' }}>切換狀態：</span>
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
          <div className="share-actions">
            <button
              type="button"
              className="btn"
              onClick={() => { void handleGenerateShare() }}
              disabled={!canShare}
              aria-label="產生唯讀分享連結"
              data-testid="generate-share"
            >
              產生唯讀分享連結
            </button>
            {shareFeedback && (
              <span
                className="share-toast"
                data-tone={shareFeedback.tone}
                data-testid="share-feedback"
                role="status"
              >
                {shareFeedback.message}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        <Summary />

        <section className="section" aria-labelledby="stage-list-heading">
          <h2 id="stage-list-heading">階段清單</h2>
          {empty ? (
            <EmptyState onAdd={() => setForm({ mode: 'create' })} />
          ) : (
            <>
              <ol className="stage-list">
                {stages.map((stage) => (
                  <StageRow
                    key={stage.id}
                    stage={stage}
                    onEdit={() => setForm({ mode: 'edit', stage })}
                    onDelete={() => setConfirm({ mode: 'delete', stage })}
                  />
                ))}
              </ol>
              <div style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => setForm({ mode: 'create' })}
                  data-testid="add-stage"
                >
                  新增階段
                </button>
              </div>
            </>
          )}
        </section>

        <PhotoSection />

        <BudgetSection />

        <ScheduleSection stages={stages} />

        <WarrantySection />

        <GanttChart project={project} stages={stages} />
      </main>

      <StageForm
        open={form.mode === 'create' || form.mode === 'edit'}
        mode={form.mode === 'edit' ? 'edit' : 'create'}
        projectId={project.id}
        projectPlannedStart={project.plannedStart}
        projectPlannedEnd={project.plannedEnd}
        initialStage={form.mode === 'edit' ? form.stage : undefined}
        onCancel={() => setForm({ mode: 'closed' })}
        onSubmitCreate={handleCreate}
        onSubmitEdit={handleEdit}
      />

      <ConfirmDialog
        open={confirm.mode === 'delete'}
        title="刪除階段"
        description={
          confirm.mode === 'delete'
            ? `確定要刪除「${confirm.stage.name}」嗎？此操作無法復原。`
            : ''
        }
        onCancel={() => setConfirm({ mode: 'closed' })}
        onConfirm={handleDelete}
      />

      {toast && (
        <div className="toast" role="status" onAnimationEnd={() => setToast(null)}>
          {toast}
        </div>
      )}
    </>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty-state" data-testid="empty-state">
      <h3>目前沒有任何階段</h3>
      <p>點選下方按鈕建立第一個階段，工程完成度會自動計算。</p>
      <div className="empty-cta">
        <button type="button" className="btn primary" onClick={onAdd} data-testid="add-stage-empty">
          新增階段
        </button>
      </div>
    </div>
  )
}