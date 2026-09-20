// Schedule domain helpers — pure functions with no DOM / IDB dependencies.
// Implements the FR-005 logic that can be exercised in isolation:
//   • date status (未開始 / 今日 / 進行中 / 已完成 / 逾期)
//   • startOn sort
//   • reminder filter (未完成且 reminderOn 已到期或未來 7 天內；逾期未完成也含)
//   • summary counters used by both the editable dashboard and the share
//     snapshot (SPEC §4.6 + AC-FR005-01～04)
//
// All date comparisons are done against `today` (an ISO `YYYY-MM-DD` string)
// so callers can pin time in tests.

import type { ScheduleDateStatus, ScheduleItem } from './types'

/** Inclusive day count, rounded toward zero. `dayDiff('2026-02-10','2026-02-07') = 3`. */
export function dayDiff(later: string, earlier: string): number {
  if (!isValidIsoDate(later) || !isValidIsoDate(earlier)) return Number.NaN
  const ms = Date.UTC(
    Number(later.slice(0, 4)),
    Number(later.slice(5, 7)) - 1,
    Number(later.slice(8, 10)),
  ) - Date.UTC(
    Number(earlier.slice(0, 4)),
    Number(earlier.slice(5, 7)) - 1,
    Number(earlier.slice(8, 10)),
  )
  return Math.round(ms / 86_400_000)
}

export function isValidIsoDate(value: string): boolean {
  if (typeof value !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const y = Number(value.slice(0, 4))
  const m = Number(value.slice(5, 7))
  const d = Number(value.slice(8, 10))
  const dt = new Date(Date.UTC(y, m - 1, d))
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() + 1 === m &&
    dt.getUTCDate() === d
  )
}

/** Returns true when `a` is on or before `b` (lexicographic compare is safe
 *  for `YYYY-MM-DD`). */
export function isoDateOnOrBefore(a: string, b: string): boolean {
  return a <= b
}

/** Comparator that orders ScheduleItems by `startOn` ascending, with
 *  `endOn` and `id` as deterministic tiebreakers so the UI never flips
 *  two same-start items on every render. */
export function compareScheduleStartOn(a: ScheduleItem, b: ScheduleItem): number {
  if (a.startOn !== b.startOn) return a.startOn < b.startOn ? -1 : 1
  if (a.endOn !== b.endOn) return a.endOn < b.endOn ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Returns a new array sorted by startOn asc. Does not mutate. */
export function sortSchedulesForDisplay(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort(compareScheduleStartOn)
}

/** Derives the date-driven status of a schedule item relative to `today`.
 *
 *  Rules (SPEC §4.6 + AC-FR005-01):
 *    • `completed` wins regardless of dates.
 *    • `endOn < today` → overdue.
 *    • `startOn > today` → not_started.
 *    • `startOn === today` → today.
 *    • otherwise → in_progress.
 */
export function scheduleDateStatus(
  item: ScheduleItem,
  today: string,
): ScheduleDateStatus {
  if (item.completed) return 'completed'
  if (dayDiff(today, item.endOn) > 0) return 'overdue'
  if (dayDiff(item.startOn, today) > 0) return 'not_started'
  if (item.startOn === today) return 'today'
  return 'in_progress'
}

/** Returns the in-window items the in-page reminder must surface
 *  (AC-FR005-01 / FR-005 Required behavior 5).
 *
 *  An item is in-window when ALL hold:
 *    • not completed
 *    • reminderOn is set
 *    • reminderOn <= today+7  (so overdue reminders show up too, since
 *      reminderOn <= startOn and startOn <= today+7 implies reminderOn<=today+7;
 *      we accept the looser definition so the reminder list never hides
 *      items whose reminder was overdue but the work window still stretches
 *      into the next week — matching the spec's plain-language intent.)
 *    • endOn >= today-1  (do not nag the user about a finished window)
 *
 *  The result is sorted by reminderOn asc.
 */
export function filterReminders(
  items: ScheduleItem[],
  today: string,
): ScheduleItem[] {
  return items
    .filter((it) => {
      if (it.completed) return false
      if (!it.reminderOn) return false
      if (!isValidIsoDate(it.reminderOn)) return false
      const horizon = 7
      const withinWindow =
        dayDiff(it.reminderOn, today) <= horizon // reminderOn <= today+7
      const notStale = dayDiff(today, it.endOn) <= 1 // endOn >= today-1
      return withinWindow && notStale
    })
    .sort((a, b) => {
      if (a.reminderOn !== b.reminderOn) {
        return a.reminderOn! < b.reminderOn! ? -1 : 1
      }
      return compareScheduleStartOn(a, b)
    })
}

/** Counts used by both Dashboard and the share snapshot (SPEC §4.6 + §9.1). */
export interface ScheduleSummary {
  total: number
  upcoming: number
  overdue: number
  completed: number
}

export function summarizeSchedules(
  items: ScheduleItem[],
  today: string,
): ScheduleSummary {
  let upcoming = 0
  let overdue = 0
  let completed = 0
  for (const it of items) {
    const status = scheduleDateStatus(it, today)
    if (status === 'completed') {
      completed++
    } else if (status === 'overdue') {
      overdue++
    } else {
      upcoming++
    }
  }
  return { total: items.length, upcoming, overdue, completed }
}

/** True when `stageId` (if provided) is a known stage in `stages`. */
export function stageBelongsToProject(
  stageId: string | undefined,
  projectId: string,
  stages: ReadonlyArray<{ id: string; projectId: string }>,
): boolean {
  if (!stageId) return true
  const st = stages.find((s) => s.id === stageId)
  return !!st && st.projectId === projectId
}
