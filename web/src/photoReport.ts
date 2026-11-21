// FR-010 photo progress report. See PRD/SPEC.md §12.4 and GOAL AC-004.
//
// Groups the FR-002 photo records by stage (stage `order` ascending) and
// reports, per stage: photo count, latest shooting date and the latest photo.
// Photos without a stage — or pointing at a stage that no longer exists — go
// into a trailing 「未分類」 group. Pure: no DOM, no IndexedDB, no network, and
// nothing here talks to any cloud storage.

import type { Stage } from './types'

export const PHOTO_REPORT_UNASSIGNED_LABEL = '未分類'
export const PHOTO_REPORT_EMPTY_LABEL = '尚無照片'

/** The minimum a photo needs to take part in the report. */
export interface PhotoReportPhoto {
  id: string
  stageId?: string
  takenOn: string
  createdAt: string
}

export interface PhotoReportGroup<P extends PhotoReportPhoto> {
  /** Stable key — the stage id, or `unassigned`. */
  key: string
  /** `null` for the 未分類 group. */
  stageId: string | null
  stageName: string
  count: number
  /** `YYYY-MM-DD` of the most recent photo; undefined when there is none. */
  latestTakenOn?: string
  /** The most recent photo (takenOn desc, then createdAt desc, then id asc). */
  latestPhoto?: P
}

export interface PhotoReport<P extends PhotoReportPhoto> {
  /** One entry per stage, ordered by `Stage.order` — including empty stages. */
  stages: PhotoReportGroup<P>[]
  /** Photos with no (or an unknown) stage. Always present; `count` may be 0. */
  unassigned: PhotoReportGroup<P>
  totalPhotos: number
}

function isNewer<P extends PhotoReportPhoto>(candidate: P, current: P): boolean {
  if (candidate.takenOn !== current.takenOn) return candidate.takenOn > current.takenOn
  if (candidate.createdAt !== current.createdAt) return candidate.createdAt > current.createdAt
  return candidate.id < current.id
}

function addPhoto<P extends PhotoReportPhoto>(group: PhotoReportGroup<P>, photo: P): void {
  group.count += 1
  if (!group.latestPhoto || isNewer(photo, group.latestPhoto)) {
    group.latestPhoto = photo
    group.latestTakenOn = photo.takenOn
  }
}

export function buildPhotoReport<P extends PhotoReportPhoto>(
  stages: ReadonlyArray<Pick<Stage, 'id' | 'name' | 'order'>>,
  photos: ReadonlyArray<P>,
): PhotoReport<P> {
  const ordered = stages
    .slice()
    .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.id < b.id ? -1 : 1))
  const groups: PhotoReportGroup<P>[] = ordered.map((stage) => ({
    key: stage.id,
    stageId: stage.id,
    stageName: stage.name,
    count: 0,
  }))
  const byStageId = new Map(groups.map((g) => [g.stageId as string, g]))
  const unassigned: PhotoReportGroup<P> = {
    key: 'unassigned',
    stageId: null,
    stageName: PHOTO_REPORT_UNASSIGNED_LABEL,
    count: 0,
  }
  for (const photo of photos) {
    const group = photo.stageId ? byStageId.get(photo.stageId) : undefined
    addPhoto(group ?? unassigned, photo)
  }
  return { stages: groups, unassigned, totalPhotos: photos.length }
}

/** `3 張` / `尚無照片` — the per-stage count label. */
export function formatPhotoReportCount(count: number): string {
  return count > 0 ? `${count} 張` : PHOTO_REPORT_EMPTY_LABEL
}
