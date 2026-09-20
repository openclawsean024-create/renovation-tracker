// App entry — delegates to `AppShell`, which decides synchronously on
// first render whether we are in share mode (read-only) or editable mode.
// In share mode no <DashboardProvider> is mounted, so no IndexedDB call
// can leak into the read-only surface (SPEC §9.1 + AC-FR004-02).
//
// Also toggles `body.readonly` so the read-only surface can hide edit
// controls with CSS (`body.readonly .edit-control { display: none }`).

import { useEffect } from 'react'
import { AppShell } from './components/AppShell'

export default function App() {
  // Detect mode synchronously on first render and toggle the class so
  // CSS-driven hiding works without any provider dependency.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const sync = () => {
      const raw = window.location.hash
      const isShare = raw.length > 0
      document.body.classList.toggle('readonly', isShare)
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  return (
    <div className="app-shell">
      <AppShell />
    </div>
  )
}
