// Photo preview modal — shows the original image full-size along with its
// metadata. SPEC §7.1 / AC-FR002-04.

import { useEffect, useId, useState } from 'react'
import { Modal } from './Modal'
import { PHOTO_KIND_LABELS, type PhotoRecord, type Stage } from '../types'
import { displayDate } from '../dates'

export interface PhotoPreviewProps {
  photo: PhotoRecord | null
  stageName?: string
  onClose: () => void
}

export function PhotoPreview({ photo, stageName, onClose }: PhotoPreviewProps) {
  const reactId = useId()
  const titleId = `${reactId}-photo-title`
  const url = useBlobUrl(photo?.blob ?? null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (photo) {
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }
    return undefined
  }, [photo, onClose])

  if (!photo) return null

  return (
    <Modal
      open
      title={photo.fileName}
      onClose={onClose}
      labelledById={titleId}
      wide
    >
      <div className="photo-preview">
        {url ? (
          <img
            src={url}
            alt={`${PHOTO_KIND_LABELS[photo.kind]}照片：${photo.caption ?? photo.fileName}`}
            className="photo-preview-image"
            data-testid="photo-preview-image"
          />
        ) : (
          <p data-testid="photo-preview-missing">無法顯示預覽。</p>
        )}
        <dl className="photo-preview-meta">
          <div>
            <dt>分類</dt>
            <dd>{PHOTO_KIND_LABELS[photo.kind]}</dd>
          </div>
          <div>
            <dt>拍攝日期</dt>
            <dd>{displayDate(photo.takenOn)}</dd>
          </div>
          <div>
            <dt>階段</dt>
            <dd>{stageName ?? '（未指定）'}</dd>
          </div>
          {photo.caption && (
            <div>
              <dt>說明</dt>
              <dd>{photo.caption}</dd>
            </div>
          )}
        </dl>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>關閉</button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Create / cache an object URL for a blob. Revokes the URL when the blob
 * changes or the consumer unmounts. SPEC §4.4 requires that creating a
 * thumbnail must NOT mutate the original blob — URL.createObjectURL is a
 * read-only handle, and revokeObjectURL just drops our reference without
 * touching the Blob.
 */
function useBlobUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return undefined
    }
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      // jsdom + fake-indexeddb don't expose URL.createObjectURL for Blobs in
      // some configurations. The caller falls back to a placeholder.
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

// Helper to resolve a friendly stage name from a list. Kept here to avoid a
// circular import with Dashboard; trivial so no need for a util module.
export function resolveStageName(stages: Stage[], stageId: string | undefined): string | undefined {
  if (!stageId) return undefined
  return stages.find((s) => s.id === stageId)?.name
}
