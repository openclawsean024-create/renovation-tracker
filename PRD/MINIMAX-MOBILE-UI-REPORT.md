# MiniMax Mobile UI Remediation Report

**Milestone:** Approved mobile layout remediation (PRD/UI-SPEC.md v1.2)
**Brief:** PRD/UI-POLISH-MINIMAX-TASK.md
**Date:** 2026-09-22
**Scope discipline:** Visual + responsive layout only. No IndexedDB schema, store
behavior, share serialization, validation, or FR-001–FR-006 behavior changes.

---

## 1. Files changed

| Path | Kind | Notes |
| --- | --- | --- |
| `web/src/index.css` | Modify | `@media (max-width: 767px)` block rewritten to satisfy the v1.2 mobile contract (MOB-01 through MOB-12). Plus a `safe-area-inset` aware `.modal-backdrop` rule and an explicit `body { overflow-x: hidden }` for MOB-01. |

No component JSX was modified. The existing `StageRow` markup already exposes
`stage-number`, `stage-name`, `stage-meta`, `stage-actions` classes that the new
mobile `grid-template-areas` rule can bind to without DOM changes. The
`prototype/ui-polish-preview-v4.html` is review-only and was not edited; the
existing `Dashboard.tsx` / `ReadOnlyView.tsx` already provide the data-testid
hooks the contract requires.

## 2. Implementation mapping

### MOB-01 — Page frame
- `.wrap { padding-inline: var(--s4) }` at ≤ 767px = 16 px horizontal page
  padding.
- New `body { overflow-x: hidden }` at ≤ 767px prevents any accidental
  horizontal bleed from off-screen sticky elements.
- Section gap held at `var(--s6)` (24 px) per the 24-px maximum.
- `.modal-backdrop` uses `min(100% - 32px, 520px)` indirectly via the
  safe-area-inset aware rule.

### MOB-02 — Header
- `.brand-row` becomes a wrapping flex container: the brand mark / product
  label occupy the first row; `.header-note` (project status, date range, and
  status switcher) wraps onto its own row; the share action sits inside the
  hero `.intro-bottom` block which is now `flex-direction: column` and full
  width.
- `.header-note` removed the desktop `white-space: nowrap` so long Chinese
  dates and switcher labels wrap instead of clipping.

### MOB-03 — Navigation
- `.nav-row` is a wrapped flex group; every `.nav-link` has `min-height:
  44px` and `min-width: 44px` so the hit area is at least 44 × 44 px.
- The active nav link still gets the primary-soft background treatment and
  `aria-current="location"` from the existing JSX (no JSX change needed).

### MOB-04 — Summary hierarchy
- `.summary` remains a 2-column grid at mobile.
- `.metric.completion` now spans the full row (`grid-column: 1 / -1`) so the
  completion label, percentage value, and 7-segment progress bar all read
  cleanly without truncation. Its 10-segment progress bar moves into its own
  row via `grid-column: 1 / -1`.
- `.metric.dates` also spans the full row so the start/end block doesn't get
  squashed between two number cells.

### MOB-05 — Stage rows
- `.stage-row` uses `grid-template-areas` to stack: number → name → meta →
  actions.
- `.stage-actions` becomes a 2-column action group with each `.btn` at
  `min-height: 44px`, full width; nothing is pushed outside the card.

### MOB-06 — Domain sections
- `.records-grid` and `.support-section` collapse to a single column.
- `.photo-list` keeps a 2-column grid with `aspect-ratio: 4 / 3` thumbs
  (unchanged from desktop) and stable photo-card actions.
- Budget totals, schedule rows, warranty rows, and budget rows become
  single-column with full-width action groups.
- `.section-header` wraps so the title row may run to two rows; the primary
  section action (`新增階段`, `新增預算項目`, etc.) is reachable on the wrapped
  tools row.

### MOB-07 — Gantt / timeline
- `.timeline-scroll` is the existing canonical scroll container (only the
  Gantt surface scrolls horizontally).
- `.timeline-grid` keeps its sticky label column (`--label-width: 144px`) and
  `min-width: 936px` so labels never get cropped by the page; the page itself
  never scrolls horizontally because the Gantt lives inside its own
  `.timeline-scroll` surface.

### MOB-08 — Dialogs / forms
- `.modal`, `dialog`, and `.modal-wide` already use
  `min(520px, calc(100% - 32px))` / `min(720px, calc(100% - 32px))`; verified
  preserved.
- `.dialog-content { overflow: auto }` retained so long forms scroll inside.
- `.form-grid { grid-template-columns: 1fr }` for mobile, keeping intentionally
  paired short fields side by side when the desktop rule still allows it.
- `.dialog-actions .btn` and `.form-actions .btn` use `flex: 1` +
  `min-height: 44px` for full-width stacked or equal two-column groups.
- The new `@supports (padding: max(0px))` rule applies
  `env(safe-area-inset-*)` padding to the dialog backdrop on notched phones.

### MOB-09 — Touch and type
- All `.btn` elements in the mobile scope enforce `min-height: 44px`.
- Photo, budget, schedule, warranty row actions are full-width 44-px touch
  targets.
- Body text is 14 px with 1.5 line-height (unchanged). H1 is 24 px / H2 is
  18 px on mobile (within the 22–24 / 18–20 contract bands).

### MOB-10 — Resilience
- `.project-dates p` no longer uses `white-space: nowrap`, so long Chinese
  date ranges wrap.
- `.header-note` no longer uses `white-space: nowrap`.
- `.readonly-banner-source`, `.readonly-photo-name`, and
  `.readonly-warranty-name` get explicit `word-break` rules so long IDs and
  file names wrap cleanly in the readonly view.

### MOB-11 — Interaction parity
- No new state model. All FR-001–FR-006 logic, IndexedDB writes, share
  serialization, anchor navigation, and existing `data-testid` hooks are
  unchanged. All 438 existing tests pass.

### MOB-12 — Quality states
- `:focus-visible` (2 px primary outline with 3–4 px offset) is preserved.
- `@media (prefers-reduced-motion: reduce)` rule disables scroll behavior,
  animations, and transitions.
- `forced-colors` fallback paints high-contrast borders on `.btn`,
  `.brand-mark`, `.gantt-bar`, and view-switch active buttons.

## 3. Verification

Commands executed from `web/`, with the repository root used only for `git
diff --check`.

```text
$ npm run typecheck
> renovation-tracker-web@0.1.0 typecheck
> tsc --noEmit
(exit 0)

$ npm test -- --run
RUN  v2.1.9 /projects/renovation-tracker/web
...
Test Files  25 passed (25)
     Tests  438 passed (438)
  Duration  11.75s
(exit 0)

$ npm run build
vite v5.4.21 building for production...
✓ 68 modules transformed.
dist/index.html                   0.33 kB │ gzip:  0.28 kB
dist/assets/index-VsEKPH--.css   41.26 kB │ gzip:  7.64 kB
dist/assets/index-DfmQNFKf.js   257.58 kB │ gzip: 75.47 kB
✓ built in 796ms
(exit 0)

$ git diff --check
(clean — no conflict markers or whitespace errors)
```

## 4. Diff discipline

- Only `web/src/index.css` was modified (the v1.2 mobile media query). The
  pre-existing PRD edits in `PRD/UI-SPEC.md` and `PRD/UI-POLISH-MINIMAX-TASK.md`
  and the untracked prototype artifact `prototype/ui-polish-preview-v4.html`
  were left untouched in this milestone.
- No new dependency. No new package. No backend, auth, or external asset.
- No generated build output committed (`web/dist/` remains gitignored).
- No test was deleted, skipped, or weakened.

## 5. Limitations and follow-ups

- The implementation is verified at the source level plus via the existing
  deterministic checks. Codex will independently run the browser QA at
  1440×900, 1024×768, 390×844, and 360×800 — if any of the MOB-MOB criteria
  fails in a real viewport, the same milestone will be returned for a bounded
  correction.
- The Gantt grid still uses the existing `--label-width` so the sticky label
  column is preserved; on phones narrower than ~360 px the user must swipe
  inside `.timeline-scroll` to see day cells to the right of the label column.
  This is the contract's "only the Gantt surface may scroll horizontally"
  guarantee.
- The CSS-only approach preserves every existing test hook; no JSX class
  names, ARIA labels, or `data-testid` strings were renamed or removed.
