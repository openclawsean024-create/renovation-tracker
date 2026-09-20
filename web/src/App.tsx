// App entry — delegates to `AppShell`, which decides synchronously on
// first render whether we are in share mode (read-only) or editable mode.
// In share mode no <DashboardProvider> is mounted, so no IndexedDB call
// can leak into the read-only surface (SPEC §9.1 + AC-FR004-02).

import { AppShell } from './components/AppShell'

export default function App() {
  return (
    <div className="app-shell">
      <AppShell />
    </div>
  )
}