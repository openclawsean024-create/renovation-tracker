# MiniMax Implementation Brief — UI Polish Pass

## Mission

Implement the complete polish pass described in `PRD/UI-SPEC.md` for the existing Renovation Tracker MVP. The product is functionally complete; make the interface feel like an internationally credible, award-quality renovation operations dashboard without changing behavior.

## Required reading

Read `AGENTS.md`, `PRD/SPEC.md`, `PRD/UI-SPEC.md`, `web/src/components/Dashboard.tsx`, `web/src/components/ReadOnlyView.tsx`, and `web/src/index.css` before editing.

## Constraints

- Scope is visual polish and minimal semantic markup support only.
- Do not change IndexedDB schemas, store behavior, share serialization, validation, or FR-001–FR-006 behavior.
- Do not add dependencies, images, backend endpoints, auth, or external services.
- Preserve existing `data-testid` attributes and accessible labels.
- Prefer a coherent CSS/token refactor plus small JSX class/landmark additions over broad rewrites.
- Apply the same visual language to editable and readonly views, while keeping readonly restrictions intact.
- Do not use gradients, default browser-looking primary buttons, decorative filler, or color-only status indicators.
- Do not copy the attached reference's Rotech brand, marketing copy, landing-page navigation, or unsupported features. Translate its quality bar into this product's project-dashboard context.
- Do not use stock/generated decorative imagery or invented metrics; use existing project data, real photo content, or explicit empty states.
- Do not touch credentials or generated build output.

## Required outcomes

Implement every UI-001 through UI-014 criterion in `PRD/UI-SPEC.md`: a distinctive but restrained product identity; international-quality composition and typography; centralized tokens; professional responsive shell; clear project focal point and header/KPI/section/stage/domain/Gantt hierarchy; designed empty/loading/error/success/focus/hover/disabled/readonly states; 44px touch targets and keyboard focus; no page-level mobile overflow; preview/production hierarchy parity; preserved functional behavior and test hooks.

## Verification and report

Run from `web/` and include actual output plus exit codes:

    npm run typecheck
    npm test -- --run
    npm run build
    git diff --check

Report exact files changed, markup changes and reasons, how each UI-SPEC acceptance group was addressed, and remaining limitations. Do not claim visual acceptance based only on source inspection; Codex will independently run browser QA at 1440×900, 1024×768, and 390×844 and will send a concrete correction brief if anything fails.
