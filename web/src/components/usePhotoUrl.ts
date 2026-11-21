// Shared object-URL hook for photo thumbnails (FR-002 list, FR-010 report).
//
// Creates an object URL for a Blob and revokes it when the blob changes or
// the consumer unmounts. SPEC §4.4 requires that creating a thumbnail must
// NOT mutate the original blob — URL.createObjectURL is a read-only handle,
// and revokeObjectURL just drops our reference without touching the Blob.

import { useEffect, useState } from 'react'

export function usePhotoUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      // jsdom + fake-indexeddb don't expose URL.createObjectURL for Blobs in
      // some configurations. Consumers fall back to a "無縮圖" placeholder
      // while the photo data itself round-trips through IndexedDB.
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
