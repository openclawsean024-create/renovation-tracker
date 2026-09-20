// App-level routing component for FR-004.
//
// SPEC §9.1 + AC-FR004-02: the read-only share surface MUST NOT touch
// IndexedDB. Previously `App.tsx` always wrapped <Dashboard> in
// <DashboardProvider>; the provider's load effect runs on mount and reads
// IndexedDB unconditionally, so even a share-mode URL would trigger one
// IndexedDB read on first render. That violates the read-only contract.
//
// This component makes the share-mode decision SYNCHRONOUSLY on first
// render — before any provider mounts — and only mounts the
// <DashboardProvider> in editable mode. Share mode (valid or invalid)
// renders ReadOnlyView / ReadOnlyError with NO provider in the tree, so
// no IndexedDB call is ever made.
//
// Backward compatibility:
// - Tests that wrap <Dashboard> in an outer <DashboardProvider> still
//   work because Dashboard is still a valid editable-only component.
// - Share tests now mount this component instead so the read-only
//   guarantee is exercised end-to-end (the provider is genuinely absent).
//
// Hashchange transitions:
// - editable → share: provider unmounts, ReadOnlyView/ReadOnlyError renders.
// - share (valid OR invalid) → editable: provider mounts, Dashboard renders.

import { useCallback, useEffect, useState } from 'react'
import { DashboardProvider } from '../store'
import { Dashboard } from './Dashboard'
import { ReadOnlyView } from './ReadOnlyView'
import { ReadOnlyError } from './ReadOnlyError'
import {
  decodeShareHash,
  hasShareHash,
  type ShareDecodeError,
  type ShareSnapshot,
} from '../share'

/**
 * The mode the app is currently in. Computed synchronously from
 * `window.location.hash` so the very first render is already in the
 * correct mode — no chance of an intermediate render where the
 * DashboardProvider briefly loads IndexedDB before the share detector
 * fires.
 */
export type AppMode =
  | { kind: 'share'; snapshot: ShareSnapshot }
  | { kind: 'share-error'; error: ShareDecodeError }
  | { kind: 'editable' }

function readModeFromLocation(): AppMode {
  if (typeof window === 'undefined') return { kind: 'editable' }
  const raw = window.location.hash
  if (!hasShareHash(raw)) return { kind: 'editable' }
  const result = decodeShareHash(raw)
  if (result.ok) return { kind: 'share', snapshot: result.snapshot }
  return { kind: 'share-error', error: result.error }
}

function currentShareUrl(): string {
  if (typeof window === 'undefined') return ''
  return window.location.href
}

export interface AppShellProps {
  /**
   * Override the initial mode. Only used by tests so they can deterministically
   * exercise the share-vs-editable decision without manipulating
   * `window.location` from outside the component.
   */
  initialMode?: AppMode
}

/**
 * Test-only escape hatch: when an `initialMode` prop is supplied, the
 * component still renders correctly but ignores the location hash and the
 * hashchange listener so the test can drive navigation by changing the
 * prop directly. Production code never passes this prop.
 */
export function AppShell({ initialMode }: AppShellProps = {}) {
  // `useState` initializer is called only once, so the decision is
  // synchronous on first render. No useEffect, no provider mount, no
  // IndexedDB read before we know whether we are in share mode.
  const [mode, setMode] = useState<AppMode>(() => initialMode ?? readModeFromLocation())

  const onHashChange = useCallback(() => {
    setMode(readModeFromLocation())
  }, [])

  useEffect(() => {
    if (initialMode) return undefined
    if (typeof window === 'undefined') return undefined
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [initialMode, onHashChange])

  // Mirror the mode into `body.readonly` so CSS-driven hiding works whether
  // or not the caller mounted <App /> around this component. The check uses
  // `hasShareHash` (not a raw hash-length test) so that ordinary section
  // anchors such as `#timeline` and `#budget` never flip the body into
  // readonly styling.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const isShare = mode.kind === 'share' || mode.kind === 'share-error'
    document.body.classList.toggle('readonly', isShare)
  }, [mode])

  if (mode.kind === 'share') {
    return <ReadOnlyView snapshot={mode.snapshot} sourceUrl={currentShareUrl()} />
  }
  if (mode.kind === 'share-error') {
    return <ReadOnlyError error={mode.error} />
  }
  // editable: only NOW do we mount the IndexedDB-touching provider.
  return (
    <DashboardProvider>
      <Dashboard />
    </DashboardProvider>
  )
}
