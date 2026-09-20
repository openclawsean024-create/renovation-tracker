// Photo section — owns the "新增照片" CTA, the upload modal, the filtered
// list and the preview/delete flows. Rendered inside <Dashboard>.
//
// SPEC §7.1 + AC-FR002-01~04. This component is intentionally thin — heavy
// lifting lives in PhotoForm / PhotoList / the store.

import { useCallback, useState } from 'react'
import { PhotoForm } from './PhotoForm'
import { PhotoList } from './PhotoList'
import { useDashboard, PhotoValidationError } from '../store'
import { sortPhotosByTakenOnDesc, summarizePhotos } from '../photos'
import type { PhotoKind } from '../types'

export function PhotoSection() {
  const { photos, stages, createPhoto, deletePhoto } = useDashboard()
  const [formOpen, setFormOpen] = useState(false)

  const sorted = sortPhotosByTakenOnDesc(photos)
  const summary = summarizePhotos(photos)

  const handleSubmit = useCallback<Parameters<typeof PhotoForm>[0]['onSubmit']>(
    async (args) => {
      await createPhoto({
        input: {
          file: args.file,
          kind: args.kind as PhotoKind,
          takenOn: args.takenOn,
          stageId: args.stageId,
          caption: args.caption,
        },
      })
      setFormOpen(false)
    },
    [createPhoto],
  )

  return (
    <section className="section" aria-labelledby="photo-section-heading">
      <div className="photo-section-header">
        <div>
          <h2 id="photo-section-heading">照片紀錄</h2>
          <p className="photo-section-sub">
            共 {summary.total} 張（施工前 {summary.before} · 施工中 {summary.progress} · 完工 {summary.after}）
          </p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => setFormOpen(true)}
          data-testid="add-photo"
          aria-label="新增照片"
        >
          新增照片
        </button>
      </div>

      <PhotoList
        photos={sorted}
        stages={stages}
        onDelete={(id) => deletePhoto(id).catch(() => undefined)}
      />

      <PhotoForm
        open={formOpen}
        stages={stages}
        onSubmit={async (args) => {
          try {
            await handleSubmit(args)
          } catch (err) {
            // Re-throw so the form keeps the error visible to the user.
            // PhotoValidationError is rendered inline by PhotoForm.
            if (err instanceof PhotoValidationError) throw err
            throw err
          }
        }}
        onCancel={() => setFormOpen(false)}
      />
    </section>
  )
}
