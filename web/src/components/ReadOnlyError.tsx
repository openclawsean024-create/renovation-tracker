// FR-004 read-only error view — shown when a `#share=...` URL hash carries
// a snapshot the page cannot decode (SPEC §9.1 + AC-FR004-03).
//
// Extracted out of the Dashboard component so the App-level routing layer
// (see `AppShell.tsx`) can render the error WITHOUT mounting the
// <DashboardProvider>. That guarantee is required by SPEC §9.1 — the read-
// only surface must never reach into IndexedDB, so its first render must
// never invoke the provider's load effect.
//
// The "返回編輯模式" button dispatches a hashchange event after clearing
// the hash. The hashchange listener in `AppShell` then re-renders the
// app in editable mode (which mounts the DashboardProvider).

import { useCallback } from 'react'
import { stripShareUrl } from '../share'

export interface ReadOnlyErrorProps {
  error: { code: string; message: string }
}

export function ReadOnlyError({ error }: ReadOnlyErrorProps) {
  const handleClear = useCallback(() => {
    if (typeof window === 'undefined') return
    const stripped = stripShareUrl(window.location.href)
    window.history.replaceState(null, '', stripped)
    window.location.hash = ''
    // Force a hashchange event so AppShell re-runs the detector and
    // switches to editable mode (which then mounts the DashboardProvider).
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }, [])
  return (
    <>
      <header className="app-header">
        <h1>裝修進度神器</h1>
      </header>
      <main className="app-main">
        <section className="section readonly-banner" role="alert" data-testid="readonly-error">
          <p className="readonly-banner-title">
            <span aria-hidden="true">⚠</span> 分享連結無法開啟
          </p>
          <p className="readonly-banner-body" data-testid="readonly-error-message">
            {error.message}（{error.code}）
          </p>
          <p className="readonly-banner-body">
            本機 IndexedDB 未被讀取或寫入，可以回到編輯模式繼續使用。
          </p>
          <div className="form-actions" style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn"
              onClick={handleClear}
              data-testid="readonly-error-clear"
            >
              返回編輯模式
            </button>
          </div>
        </section>
      </main>
    </>
  )
}