# MiniMax Share-Nav Fix Report — AC-FR004 Readonly Boundary

> Author: MiniMax Developer
> Date: 2026-09-20
> Scope: section-anchor + share-hash interaction (production bug filed by Sean)
> Working branch: `main` (uncommitted changes — no commit/push performed)

## 1. Problem statement

Two production defects were reported on the FR-004 readonly share surface:

1. **Clicking a section anchor in the editable dashboard (`#timeline`, `#budget`, `#photos`, `#schedule`, `#warranties`, `#overview`) could render the `readonly-error` "missing-hash" state** instead of the normal editable dashboard. The original `App.tsx` and `AppShell.tsx` used `if (raw.length > 0)` / `if (!raw)` to decide whether to enter share mode, so every non-empty hash — including a bare section anchor — was treated as a share attempt.
2. **Generating a share link while the current URL had a section anchor could produce a double-hash URL** such as `#timeline#share=…`. The `stripShareHash` helper only filtered out the `share=` param; a bare page anchor was preserved and then concatenated with the new `share=` param, yielding an invalid URL with two `#` characters.

Additionally, readonly navigation between sections did not preserve the share payload, so clicking a section anchor in the readonly view silently dropped the snapshot.

## 2. Required behavior (acceptance bar)

| # | Requirement |
|---|---|
| R1 | Ordinary section anchors (`#timeline`, `#budget`, `#photos`, `#schedule`, `#warranties`, `#overview`) remain in **editable** mode and never show the share-error state. |
| R2 | Valid share URLs (`#share=…`) remain in **readonly** mode (AC-FR004-02). |
| R3 | Readonly navigation between sections preserves the share payload: every readonly nav link must be `#share=…&<anchor>`. |
| R4 | Generating a share URL while the current URL has a section anchor produces exactly one valid `#share=…` fragment — never `#timeline#share=…`. |
| R5 | Malformed/invalid share hashes still show the friendly `readonly-error` state (AC-FR004-03). |
| R6 | The `body.readonly` CSS class is set in every readonly situation (including `share-error`), so the CSS-driven hiding contract holds. |
| R7 | No existing test is weakened or removed; new tests are added on top. |

## 3. Files changed

```
web/src/App.tsx                            |  20 +---
web/src/__tests__/Dashboard.share.test.tsx | 143 ++++++++++++++++++++++++++++-
web/src/__tests__/share.test.ts            | 123 ++++++++++++++++++++++++-
web/src/components/AppShell.tsx            |  16 +++-
web/src/components/ReadOnlyView.tsx        |  14 ++-
web/src/share.ts                           |  20 +++-
6 files changed, 310 insertions(+), 26 deletions(-)
```

### 3.1 `web/src/share.ts`

- Added the exported helper `hasShareHash(hash)` which returns `true` only when at least one `&`-separated hash param starts with `${SHARE_HASH_KEY}=`. Section anchors (no `=`) and look-alike keys (`#shares=…`, `#myshare=…`) correctly return `false`.
- Tightened `stripShareHash` so it now also drops hash params that have no `=` (bare page anchors like `timeline`, `budget`). The result is that `buildShareUrl(snapshot, { href: 'https://x/app#timeline' })` returns `https://x/app#share=…` — exactly one `#`.

### 3.2 `web/src/components/AppShell.tsx`

- `readModeFromLocation()` now consults `hasShareHash(raw)` instead of `if (!raw)`. A bare section anchor no longer routes into the share decoder, so the decoder can never produce a `missing-hash` error for `#timeline`.
- Moved the `body.readonly` class toggle from `App.tsx` into `AppShell` itself (in a `useEffect` that mirrors `mode`). The class is set whenever `mode.kind === 'share'` **or** `mode.kind === 'share-error'`, satisfying R6 and making the CSS contract hold even when tests mount `<AppShell />` directly without `<App />`.

### 3.3 `web/src/App.tsx`

- Removed the now-redundant `useEffect` that toggled `body.readonly`. `App` is now a thin wrapper around `<AppShell />` so the readonly boundary lives in exactly one place.

### 3.4 `web/src/components/ReadOnlyView.tsx`

- Added `readonlyNavHref(anchor, sourceUrl)`. It extracts the existing `share=…` fragment from `sourceUrl` (if present) and produces `#share=…&<anchor>`; if there is no share payload (defensive fallback), it returns `#<anchor>`. Every readonly nav link now uses this builder so R3 holds.

## 4. New regression tests (R7 — additive only)

### `web/src/__tests__/share.test.ts`

- `stripShareUrl` — added two cases: page anchor before the share param, page anchor after the share param. Both must drop the anchor entirely.
- `hasShareHash — distinguishes section anchors from share hashes` (new describe block, 7 cases): empty/null/undefined, every documented section anchor (`#timeline`, `#budget`, `#photos`, `#schedule`, `#warranties`, `#overview`), hashes without `=`, valid share hashes, share hashes combined with section anchors (both orderings), look-alike keys (`#shares=`, `#myshare=`), and the bare `#share=` (lenient — decoder remains the authority on payload validity).
- `buildShareUrl — produces a clean share URL regardless of current hash` (new describe block, 4 cases): bare section anchor, every documented section anchor, section anchor + unrelated `keep=1` key, replacing an existing share hash.

### `web/src/__tests__/Dashboard.share.test.tsx`

- `keeps ordinary section anchors in editable mode` (orchestrator): `#timeline` → editable dashboard, no `readonly-error`, no `readonly` body class, nav link href is `#timeline`.
- `keeps every documented section anchor in editable mode` (MiniMax addition): loops `overview`, `timeline`, `budget`, `photos`, `warranties` and asserts each one keeps the editable dashboard and clears the readonly body class.
- `preserves the share payload on every readonly nav link` (MiniMax addition): asserts every one of the 5 readonly nav links matches `^#share=[^&]+&<anchor>$`.
- `stays in readonly mode when the hash already has a section anchor appended` (MiniMax addition): opens `#share=<encoded>&budget` and verifies the readonly banner appears (not `readonly-error`) and the body carries the `readonly` class.
- `malformed share hashes still show the friendly error, not the editable dashboard` (MiniMax addition): `#share=@@@@@@` must produce the `readonly-error` state with `readonly` body class — R5 regression guard.
- `enters readonly mode when the URL has a valid share hash` (orchestrator): extended with an assertion that the timeline nav link href is `#share=…&timeline`, plus a follow-up navigation to that href that confirms the readonly banner persists.

## 5. Verification — exact command results

All commands executed from `/projects/renovation-tracker/web/`.

### 5.1 `npm run typecheck`

```
> renovation-tracker-web@0.1.0 typecheck
> tsc --noEmit

(exit code 0, no output)
```

### 5.2 `npm test -- --run`

```
 RUN  v2.1.9 /projects/renovation-tracker/web

 ✓ src/__tests__/share.test.ts (40 tests) 15ms
 ✓ src/__tests__/budget.test.ts (46 tests) 36ms
 ✓ src/__tests__/warranty.test.ts (41 tests) 38ms
 ✓ src/__tests__/Dashboard.photos.test.tsx (12 tests) 1213ms
 ✓ src/__tests__/Dashboard.share.test.tsx (21 tests) 1341ms
 ✓ src/__tests__/Dashboard.test.tsx (13 tests) 2164ms
 ✓ src/__tests__/Dashboard.budget.test.tsx (17 tests) 2190ms
 ✓ src/__tests__/Dashboard.schedule.test.tsx (13 tests) 2476ms
 ✓ src/__tests__/Dashboard.warranty.test.tsx (16 tests) 3075ms
 ✓ src/__tests__/budgets.db.test.ts (12 tests) 20ms
 ✓ src/__tests__/warranties.db.test.ts (12 tests) 23ms
 ✓ src/__tests__/validation.test.ts (30 tests) 9ms
 ✓ src/__tests__/schedule.test.ts (22 tests) 6ms
 ✓ src/__tests__/photos.test.ts (27 tests) 10ms
 ✓ src/__tests__/gantt.test.ts (8 tests) 7ms
 ✓ src/__tests__/db.test.ts (8 tests) 22ms
 ✓ src/__tests__/ui-polish.a11y.test.tsx (12 tests) 376ms
 ✓ src/__tests__/schedules.db.test.ts (7 tests) 14ms
 ✓ src/__tests__/photos.db.test.ts (8 tests) 22ms
 ✓ src/__tests__/seed.test.ts (9 tests) 6ms
 ✓ src/__tests__/dates.test.ts (17 tests) 6ms
 ✓ src/__tests__/status.test.ts (7 tests) 3ms
 ✓ src/__tests__/accessibility.test.tsx (4 tests) 460ms
 ✓ src/__tests__/ui-polish.smoke.test.tsx (4 tests) 432ms

 Test Files  24 passed (24)
      Tests  406 passed (406)
   Duration  24.24s
```

Exit code: **0**. 406 / 406 pass (was 389 before — added 17 regression tests).

### 5.3 `npm run build`

```
> renovation-tracker-web@0.1.0 build
> tsc --noEmit && vite build

vite v5.4.21 building for production...
✓ 68 modules transformed.
dist/index.html                   0.33 kB │ gzip:  0.28 kB
dist/assets/index-D3pgPq8O.css   38.15 kB │ gzip:  7.20 kB
dist/assets/index-unjx40Zd.js   257.07 kB │ gzip: 75.26 kB
✓ built in 1.26s
```

Exit code: **0**.

### 5.4 `git diff --check` (from repo root)

```
(no output)
```

Exit code: **0**. No whitespace/merge conflict warnings.

## 6. Mapping to required behavior

| Req | Where it is enforced | Test coverage |
|---|---|---|
| R1 — section anchors stay editable | `AppShell.readModeFromLocation` + `share.hasShareHash` | `keeps ordinary section anchors in editable mode`, `keeps every documented section anchor in editable mode`, `hasShareHash` returns false for `#timeline`/`#budget`/`#photos`/`#schedule`/`#warranties`/`#overview`. |
| R2 — valid share stays readonly | `AppShell.readModeFromLocation` + `decodeShareHash` | `enters readonly mode when the URL has a valid share hash`, `stays in readonly mode when the hash already has a section anchor appended`. |
| R3 — readonly nav preserves payload | `ReadOnlyView.readonlyNavHref` | `preserves the share payload on every readonly nav link` (asserts every one of 5 nav links matches `^#share=[^&]+&<anchor>$`). |
| R4 — section anchor + share = single `#` | `share.stripShareHash` + `share.buildShareUrl` | `stripShareUrl removes a page anchor when rebuilding a share URL` (orchestrator), `stripShareUrl strips a page anchor that appears before/after the share param` (MiniMax), `buildShareUrl produces a clean share URL when the current URL is a bare section anchor`, `buildShareUrl produces a clean share URL for every documented section anchor`. |
| R5 — malformed share still errors | `AppShell.readModeFromLocation` + `decodeShareHash` | `malformed share hashes still show the friendly error, not the editable dashboard`, plus the pre-existing `shows a friendly error state for an invalid share hash (AC-FR004-03)`. |
| R6 — `body.readonly` set in every readonly case | `AppShell` `useEffect` mirroring `mode.kind` | `keeps ordinary section anchors in editable mode` asserts class absent, `stays in readonly mode when the hash already has a section anchor appended` and `malformed share hashes still show the friendly error` assert class present. |
| R7 — no existing test weakened | All previous assertions preserved; new tests are additive. | Diff stat shows 310 insertions vs 26 deletions, the deletions are net refactors (duplicate body-class toggle moved). |

## 7. Final verdict

**Pass.** All four required commands exit 0; all 406 tests pass; no existing test was weakened; 17 new regression tests cover the section-anchor + share-hash boundary, the double-hash URL generation path, the readonly nav payload preservation, and the `body.readonly` CSS contract. The orchestrator's provisional edits were reviewed critically — one architectural improvement was applied: the `body.readonly` toggle was hoisted from `App.tsx` into `AppShell.tsx` so the CSS contract holds whether or not `<App />` is mounted.

## 8. Independent Codex verification

Codex independently ran the browser smoke against the rebuilt local preview at `http://127.0.0.1:5181/` on 2026-09-21:

- Opened `#timeline`: editable dashboard rendered, with no `readonly-error` and no `body.readonly` boundary.
- Generated a share link from `#timeline`: the resulting URL contained exactly one `#share=` fragment and no `#timeline#share` double hash.
- Reopened the generated URL: the readonly snapshot rendered successfully.
- Clicked readonly `預算`, `現場照片`, and `保固` links: each URL retained the same share payload and appended the section anchor; the readonly surface remained visible.
- Opened `#share=@@@@@@`: the friendly share-error state rendered and did not fall back to editable mode.

## 9. Release notes

1. **Browser smoke verification completed.** See §8 for the independent local-preview evidence.
2. **Notion / Vercel / GitHub actions explicitly out of scope for MiniMax.** MiniMax made no commit, push, deploy, Notion sync, or secret change. After independent verification, the standard release sequence (commit → push → SHA-pinned Vercel deploy → canonical Notion update → SHA verification) applies unchanged.
3. **No DB migration / auth / payment / secret touched.** All changes are confined to the readonly/share boundary surface; no `db.ts`, `store.tsx`, or persistence layer was modified.
4. **`hasShareHash` is intentionally lenient on bare `#share=`.** The function returns `true` for `#share=` so the decoder remains the single authority on payload validity (it rejects empty encoded values as `malformed`). This is pinned by a test so future refactors do not silently change the contract.
