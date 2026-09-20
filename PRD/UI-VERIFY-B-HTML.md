# Reviewer B — HTML UI Conformance Report

**Project**: `renovation-tracker`
**Scope**: Confirm `web/src/` matches the design quality bar of `prototype/ui-polish-preview-v3.html` without literal copy.
**Verdict**: **VERDICT: PARTIAL**

Two structural divergences + one CSS literal mismatch. Zero fundamental gaps. Token parity, all six hero/summary regions, all form grids, all media queries, and the readonly/edit-control gating are correct.

---

## Triage (5 commands)

| # | Command | Exit | Note |
|---|---|---|---|
| 1 | `npm run typecheck` | `0` | `tsc --noEmit` clean. |
| 2 | `git diff --stat web/` | `0` | 13 files, +2763 / -1657 — `index.css` biggest delta (2610 changes). |
| 3 | `grep "Renovation Tracker\|Rotech\|gradient\|stock"` | `0` | Only hit is the CSS file-header comment `/* Renovation Tracker — UI Polish Pass styles */` (`index.css:1`). No production wordmark, no gradient, no stock text. |
| 4 | `grep "@media" web/src/index.css` | `0` | 5 hits: `1600px`, `1199px`, `767px`, `prefers-reduced-motion`, `forced-colors`. |
| 5 | `grep "brand-row\|nav-row\|…"` | `0` | 71 hits — every prototype hook name has a CSS rule. |

---

## Table 1 — Token parity (`prototype → production`)

All tokens declared in `prototype/ui-polish-preview-v3.html:11-20` reproduced verbatim in `web/src/index.css:7-52`. No drift.

| Token | Prototype (`v3.html`) | Production (`index.css`) | Match |
|---|---|---|---|
| `--bg` | `#f5f7fb` | `#f5f7fb` (line 9) | Y |
| `--surface` | `#fff` | `#ffffff` (line 10) | Y (visual identical) |
| `--subtle` | `#f8fafc` | `#f8fafc` (line 11) | Y |
| `--ink` | `#172033` | `#172033` (line 12) | Y |
| `--muted` | `#667085` | `#667085` (line 13) | Y |
| `--border` | `#e4e7ec` | `#e4e7ec` (line 14) | Y |
| `--border-strong` | `#cfd5df` | `#cfd5df` (line 15) | Y |
| `--primary` | `#1f4d8f` | `#1f4d8f` (line 18) | Y |
| `--primary-hover` | `#173d73` | `#173d73` (line 19) | Y |
| `--primary-soft` | `#eaf1fb` | `#eaf1fb` (line 20) | Y |
| `--accent` | `#c98727` | `#c98727` (line 21) | Y |
| `--accent-soft` | `#fff5df` | `#fff5df` (line 22) | Y |
| `--success` | `#19704a` | `#19704a` (line 23) | Y |
| `--success-soft` | `#edf7f1` | `#edf7f1` (line 24) | Y |
| `--warning` | `#9a6700` | `#9a6700` (line 25) | Y |
| `--danger` | `#b42318` | `#b42318` (line 26) | Y |
| `--danger-soft` | `#fff0ed` | `#fff0ed` (line 27) | Y |
| `--navy` | `#172b47` | `#172b47` (line 30) | Y |
| `--on-navy` | `#c4d1e2` | `#c4d1e2` (line 31) | Y |
| `--navy-border` | `#60748e` | `#60748e` (line 32) | Y |
| `--control-border` | `#8995a6` | `#8995a6` (line 35) | Y |
| `--focus` | `#1f4d8f` | `#1f4d8f` (line 36) | Y |
| `--r-sm` | `8px` | `8px` (line 39) | Y |
| `--r-md` | `12px` | `12px` (line 40) | Y |
| `--r-lg` | `16px` | `16px` (line 41) | Y |
| `--s1`..`--s10` | `4/8/12/16/20/24/32/40` | identical (lines 42-49) | Y |
| `--shadow` | `0 1px 2px rgb(23 32 51 / 3%)` | identical (line 52) | Y |
| font-family | `system-ui, -apple-system, "Segoe UI", "PingFang TC", "Microsoft JhengHei", sans-serif` | identical (lines 70-71) | Y |

**Additional aliases** (lines 55-68): legacy `--color-*` and `--radius` aliases preserved so pre-existing components (`StageRow`, `StatusPill`, etc.) don't regress — a defensive layering choice, not a token drift.

**Verdict — Table 1**: **PASS** (28/28 tokens identical).

---

## Table 2 — Structural parity

| # | Prototype region | Production location | Match |
|---|---|---|---|
| 1 | `.app-header > .wrap > .brand-row + .nav-row` with `<nav aria-label="工程導覽">` | `Dashboard.tsx:315-355` (brand-row + nav-row + aria-label="工程導覽"), `ReadOnlyView.tsx:87-115` (aria-label="工程導覽（唯讀）") | Y |
| 2 | `.skip` link → `#main` | `Dashboard.tsx:312` `<a className="skip" href="#main">跳至主要內容</a>`, `ReadOnlyView.tsx:84` | Y |
| 3 | `<section id="overview">` containing `.hero > .project-intro + .next-step` | `Dashboard.tsx:356-456` (`<section id="overview">` → `.hero` → `.project-intro` + `<aside className="next-step">`); `ReadOnlyView.tsx:124-205` mirrors | Y |
| 4 | `<dl class="summary">` with 6 `.metric` cells (one with `.completion`) | `Dashboard.tsx:458-518` 6 metrics (`completion`, total, completed, in-progress, blocked, `dates`); `ReadOnlyView.tsx:164-205` 6 metrics | Y |
| 5 | `<section class="section">` w/ `.section-header > .section-heading + .section-tools` for stages / gantt | `Dashboard.tsx:521-565` (stage section), `Dashboard.tsx:616-625` (gantt section) | Y |
| 6 | `.view-switch` tabs (list/chart) for stages | `Dashboard.tsx:533-556` (role="tablist" + 2 role="tab" buttons, aria-selected, tabIndex roving); `ReadOnlyView.tsx` omits view-switch (read-only shows chart only — acceptable scope) | Y (Dashboard) / Δ (ReadOnlyView, acceptable for read-only) |
| 7 | `.records-grid` wrapping budget + photos (desktop two-col) | `Dashboard.tsx:631-634` `<div className="records-grid"><BudgetSection /><PhotoSection /></div>`; CSS `index.css:1110-1118` defines 2-col grid | Y |
| 8 | `.support > .support-section` wrapping schedule + warranty | `Dashboard.tsx:636-639` `<section className="section support"><ScheduleSection /><WarrantySection /></section>`; `ScheduleSection.tsx:217` + `WarrantySection.tsx:152` each render `<article className="support-section …">` | Y |
| 9 | `<dl class="share-facts">` in share dialog | **Not rendered in JSX**. CSS defined (`index.css:732-743, 1938`) but no `share-facts` usage. Production uses inline share button + toast (`Dashboard.tsx:384-402`) — the dialog with facts-table was dropped because share output is just a URL string. | **Δ** |
| 10 | `<aside class="readonly-banner">` in read-only mode | `ReadOnlyView.tsx:430` `<section className="readonly-banner" role="status" aria-live="polite">` rendered by `ReadOnlyBanner` component; `ReadOnlyError.tsx:38-44` uses the related sub-classes | Y |
| 11 | `<form class="form-grid">` (2-col desktop, 1-col mobile) in every form | `StageForm.tsx:100`, `BudgetForm.tsx:117`, `PhotoForm.tsx:94`, `ScheduleForm.tsx:124`, `WarrantyForm.tsx:114` — 5/5 forms use `form-grid`. CSS `index.css:747-752` (2-col) + `1935` (`@media (max-width: 767px)` collapses to 1-col). Sub-pattern `form-grid-full` and `.field.full` for full-width rows | Y |
| 12 | `.timeline-scroll` containing `.timeline-grid` for Gantt | Production uses `.gantt-wrapper` (`Dashboard.tsx:622`) wrapping `<GanttChart>` which renders `<div className="timeline-grid">` (`GanttChart.tsx:89`). `.gantt-wrapper` (`index.css:933-936`) has `overflow-x: auto; overscroll-behavior-x: contain` — same behavior as the prototype's `.timeline-scroll`. Class `.timeline-scroll` is also defined in CSS (`index.css:938-944`) but unused in JSX (kept for spec coverage). | Δ (renamed selector, identical overflow behavior) |

**Verdict — Table 2**: **PARTIAL**. 10/12 pass; #9 `share-facts` not rendered; #12 selector renamed to `.gantt-wrapper`.

---

## Table 3 — No-copy verification (grep evidence)

### Must NOT contain (user-visible)

| Token | Production hits | Verdict |
|---|---|---|
| `Renovation Tracker` (as wordmark) | 0 user-visible. Only `index.css:1` file-header comment and `web/src/test/setup.ts:2` + `web/src/__tests__/Dashboard.schedule.test.tsx:2` test setup comments. | ✅ Clean |
| `Rotech` | 0 hits across `web/src/` | ✅ Clean |
| `linear-gradient` / `radial-gradient` / `conic-gradient` | 0 hits in `index.css` | ✅ Clean |
| Stock image / fake testimonial / fake metric copy | 0 hits for `unsplash / placeholder image / testimonial / fake metric`. Photo storage uses real user-uploaded Blobs via IndexedDB; photo-empty uses CSS dashed box (`index.css:163`), not a stock placeholder. | ✅ Clean |

### MUST contain

| Requirement | Production evidence | Verdict |
|---|---|---|
| `裝修進度神器` wordmark | `Dashboard.tsx:323`, `ReadOnlyView.tsx:95` (`<span className="wordmark">裝修進度神器</span>`); footer wordmark at `Dashboard.tsx:642`, `ReadOnlyView.tsx:419`; brand aria-label at `Dashboard.tsx:316`, `ReadOnlyView.tsx:88` | ✅ |
| system-ui CJK-safe font stack | `index.css:70-71`: `system-ui, -apple-system, "Segoe UI", "PingFang TC", "Microsoft JhengHei", sans-serif` | ✅ |
| Icon library (inline SVG or symbol) | Inline SVG `<svg className="icon" viewBox="0 0 28 28">` at `Dashboard.tsx:318` (brand mark) + `ReadOnlyView.tsx:90` (brand mark). Plus unicode symbols for status (✓/⟳/!) and arrow `→` at `ReadOnlyView.tsx:153`. `.icon` CSS class (`index.css:151-162`) ready for additional SVGs. | ✅ |

**Verdict — Table 3**: **PASS**.

---

## Hard checks

| # | Check | Evidence | Pass |
|---|---|---|---|
| H1 | `@media (max-width: 1199px)` | `index.css:1787` | ✅ |
| H2 | `@media (max-width: 767px)` | `index.css:1816` | ✅ |
| H3 | `body.readonly .edit-control { display: none }` | `index.css:1141` (`display: none !important;`) + `index.css:1142` (gantt-hit pointer-events disabled) | ✅ |
| H4 | `prefers-reduced-motion: reduce` | `index.css:1951-1958` (`animation: none !important; transition: none !important;` + `scroll-behavior: auto`) | ✅ |
| H5 | `:focus-visible` rule with 2px outline | `index.css:113-117` (`outline: 2px solid var(--focus); outline-offset: 4px;`) | ✅ |
| H6 | `body { overflow-x: clip }` (or equivalent) | `index.css:90` uses `overflow-x: hidden;` — functionally equivalent for page-level horizontal-overflow prevention; not the literal `clip` value the brief asked for. | ⚠️ Δ (substitute value, same intent) |
| H7 | Gantt has its own `overflow-x: auto` | `index.css:934` `.gantt-wrapper { overflow-x: auto; overscroll-behavior-x: contain; }` | ✅ |

**Verdict — Hard checks**: **6/7 PASS, 1 Δ** (`overflow-x: hidden` instead of `clip`; both prevent horizontal overflow on the body).

---

## Top 5 issues (severity-ordered)

1. **Share dialog `share-facts` region missing** — `index.css:732-743, 1938` defines `<dl class="share-facts">` styling but no JSX renders it. Prototype shows a dialog with snapshot facts; production generates a URL + toast instead.
   - **Severity**: Medium (functional share works, but one prototype region not reproduced).
   - **File:line** — `Dashboard.tsx:384-402` (only share button + toast; no dialog with facts).
   - **Fix**: Either render a `<dialog>` containing `<dl className="share-facts">` with project name / stage count / date range on share success, OR remove the unused `.share-facts` CSS rules (lines 732-743, 1938) to avoid dead CSS.

2. **`overflow-x: hidden` instead of `overflow-x: clip` on body** — `index.css:90`.
   - **Severity**: Low (both prevent page-level horizontal overflow; `clip` is the spec literal, `hidden` is the more compatible substitute).
   - **Fix**: Change `overflow-x: hidden;` → `overflow-x: clip;` on `body` (line 90). Note: Safari < 16 does not support `clip`, so consider feature-querying or keep `hidden` if Safari 15- is in the target matrix.

3. **`.timeline-scroll` class defined but unused in JSX** — `index.css:938-944` defines the class; production uses `.gantt-wrapper` (`index.css:933-936`) instead. Same overflow behavior, different selector.
   - **Severity**: Low (cosmetic, no functional impact).
   - **Fix**: Either rename `.gantt-wrapper` to `.timeline-scroll` for spec parity, or delete `.timeline-scroll` rules to remove dead CSS.

4. **Inline icon library minimal** — Only the brand-mark uses inline SVG (`Dashboard.tsx:318`, `ReadOnlyView.tsx:90`). Prototype uses inline SVG for many UI affordances (calendar, photo, share, etc.); production falls back to unicode symbols (emoji `🔒`, `→`) and text labels.
   - **Severity**: Low (icons are visible and ARIA-labeled, but visually less consistent than prototype).
   - **Fix**: Add a small inline-SVG sprite (e.g., `<svg><defs><symbol id="icon-…">…</symbol></defs></svg>` block in `App.tsx`) and reference via `<use href="#icon-…">` for stage status / share / etc., if richer iconography is desired.

5. **CSS file-header comment mentions "Renovation Tracker"** — `index.css:1`.
   - **Severity**: Negligible (file comment, not user-visible; grep `Renovation Tracker` hits only this comment + test-setup comments).
   - **Fix**: None required. Document is internal; only flagged because the no-copy grep matched it.

---

## Summary

- **Token parity**: 28/28 tokens identical.
- **Structural parity**: 10/12 regions present; `share-facts` dialog not rendered; `.timeline-scroll` renamed to `.gantt-wrapper`.
- **No-copy**: clean — no user-visible "Renovation Tracker" / "Rotech" / gradient / stock placeholder.
- **Hard checks**: 6/7 verbatim, 1 substitute value (`overflow-x: hidden` vs `clip` — same effect).
- **TypeScript**: clean (`tsc --noEmit` exit 0).
- **Functional scope**: share button + toast (no dialog) is a deliberate divergence from the prototype, not a bug; documented in `PRD/UI-HANDOFF.md`.

**Final verdict**: **PARTIAL** — production matches the design quality bar in tokens, layout, and accessibility, with two named divergences (`share-facts` dialog absent, `.timeline-scroll` selector renamed) and one literal substitution (`overflow-x: hidden` vs `clip`). No fundamental structural gap, no forbidden copy, no broken responsive behavior. To reach PASS, address Issue #1 (render or remove `share-facts`) and either rename `.gantt-wrapper` → `.timeline-scroll` or remove the unused class.
