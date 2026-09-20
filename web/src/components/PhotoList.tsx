// Photo list — kind filter, thumbnails, preview trigger, delete confirm.
// SPEC §7.1 + AC-FR002-03 / AC-FR002-04.
//
// The caller is responsible for memoising the sorted list so we don't
// re-sort on every render. Object URLs are created per-row and revoked on
// unmount / when the photo changes.

import { useEffect, useMemo, useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { PhotoPreview } from './PhotoPreview'
import {
  PHOTO_KIND_LABELS,
  PHOTO_KINDS,
  type PhotoKind,
  type PhotoRecord,
  type Stage,
} from '../types'
import { displayDate } from '../dates'

export type PhotoKindFilter = PhotoKind | 'all'

const FILTER_OPTIONS: { value: PhotoKindFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  ...PHOTO_KINDS.map((k) => ({ value: k as PhotoKindFilter, label: PHOTO_KIND_LABELS[k] })),
]

export interface PhotoListProps {
  photos: PhotoRecord[]
  stages: Stage[]
  onDelete: (id: string) => Promise<void> | void
}

export function PhotoList({ photos, stages, onDelete }: PhotoListProps) {
  const [filter, setFilter] = useState<PhotoKindFilter>('all')
  const [preview, setPreview] = useState<PhotoRecord | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PhotoRecord | null>(null)

  // Stable, human-friendly stage-name lookup.
  const stageNames = useMemo(() => {
    const m: Record<string, string> = {}
    for (const s of stages) m[s.id] = s.name
    return m
  }, [stages])

  const visible = useMemo(() => {
    return filter === 'all' ? photos : photos.filter((p) => p.kind === filter)
  }, [photos, filter])

  if (photos.length === 0) {
    return (
      <div className="empty-state" data-testid="photo-empty-state">
        <h3>目前沒有任何照片</h3>
        <p>點選上方「新增照片」建立第一張紀錄，所有照片都會保存在本機。</p>
      </div>
    )
  }

  return (
    <div className="photo-list-wrap" data-testid="photo-list">
      <div className="photo-filter-row">
        <label htmlFor="photo-kind-filter">分類篩選</label>
        <select
          id="photo-kind-filter"
          data-testid="photo-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as PhotoKindFilter)}
          aria-label="依分類篩選照片"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span className="photo-filter-count" data-testid="photo-filter-count">
          顯示 {visible.length} / {photos.length} 張
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="muted" data-testid="photo-filter-empty" style={{ color: 'var(--color-muted)' }}>
          這個分類目前沒有照片。
        </p>
      ) : (
        <ul className="photo-list">
          {visible.map((photo) => (
            <PhotoRow
              key={photo.id}
              photo={photo}
              stageName={photo.stageId ? stageNames[photo.stageId] : undefined}
              onPreview={() => setPreview(photo)}
              onDelete={() => setPendingDelete(photo)}
            />
          ))}
        </ul>
      )}

      <PhotoPreview
        photo={preview}
        stageName={preview?.stageId ? stageNames[preview.stageId] : undefined}
        onClose={() => setPreview(null)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="刪除照片"
        description={
          pendingDelete
            ? `確定要刪除「${pendingDelete.fileName}」嗎？此操作無法復原。`
            : ''
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return
          Promise.resolve(onDelete(pendingDelete.id))
            .then(() => setPendingDelete(null))
            .catch(() => undefined)
        }}
      />
    </div>
  )
}

interface PhotoRowProps {
  photo: PhotoRecord
  stageName: string | undefined
  onPreview: () => void
  onDelete: () => void
}

function PhotoRow({ photo, stageName, onPreview, onDelete }: PhotoRowProps) {
  const url = usePhotoUrl(photo.blob)
  const label = photo.caption?.length ? photo.caption : photo.fileName
  return (
    <li className="photo-card" data-testid={`photo-row-${photo.id}`}>
      <button
        type="button"
        className="photo-thumb-button"
        onClick={onPreview}
        aria-label={`放大檢視照片 ${label}`}
      >
        {url ? (
          <img
            src={url}
            alt=""
            className="photo-thumb"
            data-testid={`photo-thumb-${photo.id}`}
          />
        ) : (
          <div className="photo-thumb photo-thumb-missing" data-testid={`photo-thumb-missing-${photo.id}`}>
            無縮圖
          </div>
        )}
      </button>
      <div className="photo-meta">
        <p className="photo-name" title={photo.fileName}>{photo.fileName}</p>
        <div className="photo-tags">
          <span className="status-pill" data-tone={photo.kind}>
            <span className="symbol" aria-hidden="true">
              {photo.kind === 'before' ? '○' : photo.kind === 'after' ? '●' : '◐'}
            </span>
            <span>{PHOTO_KIND_LABELS[photo.kind]}</span>
          </span>
          <span className="photo-date">{displayDate(photo.takenOn)}</span>
          {stageName && <span className="photo-stage">階段：{stageName}</span>}
        </div>
        {photo.caption && <p className="photo-caption">{photo.caption}</p>}
      </div>
      <div className="photo-actions">
        <button
          type="button"
          className="btn"
          onClick={onPreview}
          aria-label={`預覽照片 ${photo.fileName}`}
        >
          預覽
        </button>
        <button
          type="button"
          className="btn danger"
          onClick={onDelete}
          aria-label={`刪除照片 ${photo.fileName}`}
          data-testid={`photo-delete-${photo.id}`}
        >
          刪除
        </button>
      </div>
    </li>
  )
}

/**
 * Create / cache an object URL for a blob. Revoked when the blob changes or
 * the row unmounts. SPEC §4.4 requires that creating a thumbnail must NOT
 * mutate the original blob — URL.createObjectURL is a read-only handle, and
 * revokeObjectURL just drops our reference without touching the Blob.
 */
function usePhotoUrl(blob: Blob): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      // jsdom + fake-indexeddb don't expose URL.createObjectURL for Blobs in
      // some configurations. Tests can still mount the row; the thumbnail
      // falls back to the "無縮圖" placeholder while the photo data itself
      // round-trips through IndexedDB.
      setUrl(null)
      return undefined
    }
    let revoked = false
    let next: string | null = null
    try {
      next = URL.createObjectURL(blob)
      setUrl(next)
    } catch {
      setUrl(null)
    }
    return () => {
      if (revoked) return
      revoked = true
      if (next && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(next)
      }
    }
  }, [blob])

  return url
}
