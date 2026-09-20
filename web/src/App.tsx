// App entry — delegates to `AppShell`, which decides synchronously on
// first render whether we are in share mode (read-only) or editable mode.
// In share mode no <DashboardProvider> is mounted, so no IndexedDB call
// can leak into the read-only surface (SPEC §9.1 + AC-FR004-02).
//
// The `body.readonly` class is toggled inside <AppShell> itself so the
// CSS contract holds whether or not this wrapper is mounted (tests mount
// <AppShell /> directly to assert the readonly boundary).

import { AppShell } from './components/AppShell'

export default function App() {
  return (
    <div className="app-shell">
      <AppShell />
    </div>
  )
}
