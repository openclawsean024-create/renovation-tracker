// FR-010 photo progress report — GOAL AC-004. Groups the FR-002 photos by
// stage (stage order) and shows, per stage: photo count, latest shooting
// date, and the latest photo's thumbnail + caption. Photos without a stage go
// into 「未分類」; stages without photos show 「尚無照片」.
//
// Read-only view over data that already lives in IndexedDB — nothing is
// uploaded anywhere and no cloud storage is involved.

import { useMemo } from 'react'
import { useDashboard } from '../store'
import { displayDate } from '../dates'
import {
  PHOTO_REPORT_EMPTY_LABEL,
  buildPhotoReport,
  formatPhotoReportCount,
  type PhotoReportGroup,
} from '../photoReport'
import { usePhotoUrl } from './usePhotoUrl'
import type { PhotoRecord } from '../types'

export function PhotoReportSection() {
  const { stages, photos } = useDashboard()
  const report = useMemo(() => buildPhotoReport(stages, photos), [stages, photos])
  const groups =
    report.unassigned.count > 0 ? [...report.stages, report.unassigned] : report.stages

  return (
    <section className="section" id="photo-report" aria-labelledby="photo-report-heading">
      <div className="record-section-header">
        <div>
          <h2 id="photo-report-heading">照片進度回報</h2>
          <p className="record-section-sub" data-testid="photo-report-summary">
            依階段彙整 {report.totalPhotos} 張照片；照片僅存於本機，不會上傳。
          </p>
        </div>
      </div>
      {groups.length === 0 ? (
        <div className="empty-state" data-testid="photo-report-empty-state">
          <h3>尚無可彙整的階段</h3>
          <p>建立階段並在「照片紀錄」上傳照片後，這裡會依階段顯示最新進度。</p>
        </div>
      ) : (
        <ol className="photo-report-list" data-testid="photo-report">
          {groups.map((group) => (
            <PhotoReportRow key={group.key} group={group} />
          ))}
        </ol>
      )}
    </section>
  )
}

function PhotoReportRow({ group }: { group: PhotoReportGroup<PhotoRecord> }) {
  const latest = group.latestPhoto
  const url = usePhotoUrl(latest?.blob)
  const caption = latest?.caption?.length ? latest.caption : latest?.fileName
  return (
    <li
      className="photo-report-row"
      data-testid={`photo-report-group-${group.key}`}
      data-empty={group.count === 0 ? 'true' : 'false'}
    >
      <div className="photo-report-thumb-wrap">
        {latest && url ? (
          <img
            src={url}
            alt={`${group.stageName} 最新照片：${caption ?? ''}`}
            className="photo-report-thumb"
            data-testid={`photo-report-thumb-${group.key}`}
          />
        ) : (
          <div
            className="photo-report-thumb photo-thumb-missing"
            data-testid={`photo-report-thumb-missing-${group.key}`}
            aria-hidden="true"
          >
            {latest ? '無縮圖' : '—'}
          </div>
        )}
      </div>
      <div className="record-row-main">
        <div className="record-row-header">
          <h3 className="record-name">{group.stageName}</h3>
          <span className="section-count" data-testid={`photo-report-count-${group.key}`}>
            {formatPhotoReportCount(group.count)}
          </span>
        </div>
        {latest ? (
          <div className="record-meta">
            <span data-testid={`photo-report-latest-${group.key}`}>
              最新拍攝日：{displayDate(group.latestTakenOn)}
            </span>
            <span data-testid={`photo-report-caption-${group.key}`}>最新說明：{caption}</span>
          </div>
        ) : (
          <p className="muted" data-testid={`photo-report-none-${group.key}`}>
            {PHOTO_REPORT_EMPTY_LABEL}
          </p>
        )}
      </div>
    </li>
  )
}
