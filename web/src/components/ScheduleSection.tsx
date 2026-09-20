// Schedule section — add / edit / delete schedules, surface the in-page
// reminder banner, fire a one-shot local notification (best-effort).
//
// Implements FR-005 Required behavior 1～6 and AC-FR005-01～04 while leaving
// the read-only ReadOnlyView free of any IndexedDB / Notification API touch
// (SPEC §4.6 + §9.1 + §10). The read-only path is in ReadOnlyView.tsx and
// operates on the share snapshot, never on this component.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Modal } from './Modal'
import { ConfirmDialog } from './ConfirmDialog'
import { ScheduleForm, type ScheduleFormInitialValues } from './ScheduleForm'
import { ScheduleRow } from './ScheduleRow'
import { displayDate, todayISO } from '../dates'
import {
  filterReminders,
  sortSchedulesForDisplay,
} from '../schedule'
import { ScheduleValidationError, useDashboard } from '../store'
import type { ScheduleItem, Stage } from '../types'

/** Notification API surface we touch — wrapped so jsdom (no Notification)
 *  does not crash. We never `throw`; we just `return`. */
interface NotificationShim {
  permission: NotificationPermission | 'unsupported'
  requestPermission?: () => Promise<NotificationPermission>
  newNotification?: (title: string, options?: NotificationOptions) => void
}

function detectNotification(): NotificationShim {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return { permission: 'unsupported' }
  }
  return {
    permission: Notification.permission,
    requestPermission:
      'requestPermission' in Notification
        ? () => Notification.requestPermission()
        : undefined,
    newNotification: (title, options) => new Notification(title, options),
  }
}

export interface ScheduleSectionProps {
  stages: ReadonlyArray<Stage>
}

export function ScheduleSection({ stages }: ScheduleSectionProps) {
  const {
    schedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
  } = useDashboard()

  const [mode, setMode] = useState<'closed' | 'create' | 'edit'>('closed')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [topError, setTopError] = useState<string | null>(null)
  const reactId = useId()
  const headingId = `${reactId}-schedule-heading`

  const stageById = useMemo(() => {
    const m = new Map<string, Stage>()
    for (const s of stages) m.set(s.id, s)
    return m
  }, [stages])

  const today = todayISO()
  const sortedSchedules = useMemo(() => sortSchedulesForDisplay(schedules), [schedules])
  const reminders = useMemo(() => filterReminders(schedules, today), [schedules, today])

  // Best-effort one-shot notification when the page opens. We deliberately
  // do NOT require permission (FR-005 Required behavior 6: "permission
  // denied or API unavailable must not block or fabricate errors").
  const notifiedKeyRef = useRef<string>('')
  useEffect(() => {
    if (reminders.length === 0) return
    const sig = reminders.map((r) => r.id + ':' + r.reminderOn).join(',')
    if (notifiedKeyRef.current === sig) return
    notifiedKeyRef.current = sig
    const shim = detectNotification()
    if (shim.permission !== 'granted') return
    try {
      shim.newNotification?.('師傅排程提醒', {
        body:
          reminders.length === 1
            ? `即將到來：${reminders[0]!.workerName}`
            : `共有 ${reminders.length} 項排程即將到來`,
        tag: 'fr005-schedule-reminders',
      })
    } catch {
      /* swallow — best-effort */
    }
  }, [reminders])

  const editingSchedule = editingId
    ? schedules.find((s) => s.id === editingId) ?? null
    : null

  const closeModal = useCallback(() => {
    setMode('closed')
    setEditingId(null)
    setTopError(null)
  }, [])

  const handleCreate = useCallback(
    async (values: ScheduleFormInitialValues) => {
      try {
        await createSchedule({
          input: {
            projectId: '',
            stageId: values.stageId,
            workerName: values.workerName,
            phone: values.phone,
            startOn: values.startOn,
            endOn: values.endOn,
            note: values.note,
            reminderOn: values.reminderOn,
            completed: values.completed,
          },
        })
        closeModal()
      } catch (err) {
        if (err instanceof ScheduleValidationError) {
          setTopError(err.message)
          // Re-throw so the form can show its own inline errors.
          throw err
        }
        throw err
      }
    },
    [createSchedule, closeModal],
  )

  const handleEdit = useCallback(
    async (values: ScheduleFormInitialValues) => {
      if (!editingId) return
      try {
        await updateSchedule({
          id: editingId,
          patch: {
            stageId: values.stageId,
            workerName: values.workerName,
            phone: values.phone,
            startOn: values.startOn,
            endOn: values.endOn,
            note: values.note,
            reminderOn: values.reminderOn,
            completed: values.completed,
          },
        })
        closeModal()
      } catch (err) {
        if (err instanceof ScheduleValidationError) {
          setTopError(err.message)
          throw err
        }
        throw err
      }
    },
    [editingId, updateSchedule, closeModal],
  )

  const handleToggleComplete = useCallback(
    async (s: ScheduleItem) => {
      try {
        await updateSchedule({
          id: s.id,
          patch: {
            stageId: s.stageId,
            workerName: s.workerName,
            phone: s.phone,
            startOn: s.startOn,
            endOn: s.endOn,
            note: s.note,
            reminderOn: s.reminderOn,
            completed: !s.completed,
          },
        })
      } catch (err) {
        if (err instanceof ScheduleValidationError) {
          setTopError(err.message)
        }
      }
    },
    [updateSchedule],
  )

  const pendingDeleteSchedule = pendingDeleteId
    ? schedules.find((s) => s.id === pendingDeleteId) ?? null
    : null

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return
    await deleteSchedule(pendingDeleteId)
    setPendingDeleteId(null)
  }, [pendingDeleteId, deleteSchedule])

  const editingInitial: ScheduleFormInitialValues | undefined = editingSchedule
    ? {
        stageId: editingSchedule.stageId,
        workerName: editingSchedule.workerName,
        phone: editingSchedule.phone,
        startOn: editingSchedule.startOn,
        endOn: editingSchedule.endOn,
        note: editingSchedule.note,
        reminderOn: editingSchedule.reminderOn,
        completed: editingSchedule.completed,
      }
    : undefined

  const totalCount = schedules.length
  const completedCount = schedules.filter((s) => s.completed).length

  return (
    <article className="support-section schedule-section" id="schedule" aria-labelledby={headingId}>
      <header className="schedule-section-header">
        <h2 id={headingId}>師傅排程</h2>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            setTopError(null)
            setEditingId(null)
            setMode('create')
          }}
          data-testid="schedule-add-cta"
        >
          + 新增排程
        </button>
      </header>

      {topError && (
        <p className="form-error" role="alert" data-testid="schedule-top-error">
          {topError}
        </p>
      )}

      {schedules.length === 0 ? (
        <p className="empty-state" data-testid="schedule-empty">
          目前沒有排程，點「新增排程」開始記錄師傅的進場時間。
        </p>
      ) : (
        <>
          {reminders.length > 0 && (
            <aside className="schedule-reminder" data-testid="schedule-reminder">
              <p className="schedule-reminder-title">
                即將到來的提醒（{reminders.length}）
              </p>
              <ul className="schedule-reminder-list">
                {reminders.map((r) => {
                  const stageName = r.stageId ? stageById.get(r.stageId)?.name : undefined
                  return (
                    <li
                      key={r.id}
                      data-testid={`schedule-reminder-item-${r.id}`}
                    >
                      <span className="schedule-reminder-name">{r.workerName}</span>
                      {stageName && <span>・{stageName}</span>}
                      <span>・提醒日 {displayDate(r.reminderOn!)}</span>
                      <span>・工期 {displayDate(r.startOn)} ~ {displayDate(r.endOn)}</span>
                    </li>
                  )
                })}
              </ul>
            </aside>
          )}
          <p className="schedule-summary-text" data-testid="schedule-summary">
            共 {totalCount} 筆排程，已完成 {completedCount} 筆。
          </p>
          <ul className="schedule-list" data-testid="schedule-list">
            {sortedSchedules.map((s) => (
              <ScheduleRow
                key={s.id}
                schedule={s}
                today={today}
                stageById={stageById}
                onEdit={() => {
                  setTopError(null)
                  setEditingId(s.id)
                  setMode('edit')
                }}
                onDelete={() => setPendingDeleteId(s.id)}
                onToggleComplete={() => handleToggleComplete(s)}
              />
            ))}
          </ul>
        </>
      )}

      <Modal
        open={mode === 'create'}
        title="新增排程"
        onClose={closeModal}
        labelledById={`${reactId}-schedule-create-title`}
      >
        <ScheduleForm
          title="新增排程"
          stages={stages}
          onSubmit={handleCreate}
          onCancel={closeModal}
          submitLabel="新增"
        />
      </Modal>

      <Modal
        open={mode === 'edit' && !!editingSchedule}
        title="編輯排程"
        onClose={closeModal}
        labelledById={`${reactId}-schedule-edit-title`}
      >
        {editingInitial && (
          <ScheduleForm
            title="編輯排程"
            stages={stages}
            initial={editingInitial}
            onSubmit={handleEdit}
            onCancel={closeModal}
            submitLabel="儲存"
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!pendingDeleteSchedule}
        title="刪除排程"
        description={
          pendingDeleteSchedule
            ? `確定要刪除「${pendingDeleteSchedule.workerName}」嗎？此操作無法復原。`
            : ''
        }
        confirmLabel="確定刪除"
        cancelLabel="取消"
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </article>
  )
}
