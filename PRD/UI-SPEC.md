# Renovation Tracker UI Specification

**Version:** 1.3
**Status:** Mobile viewport regression correction pending
**Scope:** Visual and interaction polish for the existing FR-001–FR-006 MVP

## 1. Purpose

The current product is functionally complete, but its interface still reads like a prototype: generic cards, weak hierarchy, excessive desktop whitespace, and inconsistent control emphasis. This specification defines a restrained, professional visual system for a renovation project operations dashboard.

The result should feel calm, trustworthy, and useful on a job site: important progress is scannable in seconds, actions are obvious without being loud, and empty sections explain what the user can do next.

## 2. Product and technical boundaries

### Must preserve

- All existing behavior and data models in `PRD/SPEC.md`.
- FR-001 project dashboard and stage management.
- FR-002 photo upload, preview, deletion, and persistence.
- FR-003 budget entry, editing, deletion, totals, and persistence.
- FR-004 readonly share behavior and permission boundary.
- FR-005 schedule and reminder behavior.
- FR-006 warranty behavior.
- Existing `data-testid` hooks and accessible labels.
- The production document must declare a device-width viewport (`width=device-width, initial-scale=1`) so mobile browsers do not scale the desktop canvas down to an unreadable thumbnail.
- Local-first IndexedDB architecture; no backend, auth, cloud sync, or new external service.

### Explicitly out of scope

- New product features or database fields.
- Rewriting state management or component architecture.
- New icon, chart, CSS, or UI dependency packages.
- Replacing existing forms with a different interaction model.
- A second visual theme or dark mode.

## 3. Visual direction

### Design keywords

**現場營運控制台 / calm utility / editorial clarity.** Use strong typographic hierarchy, generous but intentional spacing, warm-neutral surfaces, deep navy for primary actions, and amber only for attention or schedule emphasis. Avoid gradients, glassmorphism, excessive rounded pills, neon colors, decorative illustrations, and default browser-looking controls.

### International-quality reference translation

The supplied UI prompt is a reference for quality and art direction, not a request to copy the Rotech brand, marketing copy, or navigation literally. Its useful requirements are adapted to this product as follows:

- **Original art direction:** the page must have a recognizable Renovation Tracker identity, a deliberate visual concept, and a memorable project overview composition. It must not look like a generic admin template assembled from unrelated cards.
- **Awwwards-level craft:** quality is judged by composition, typography, spacing rhythm, visual storytelling, interaction feedback, and responsive details—not by adding decoration. Every visible element needs a product reason.
- **Brand system:** define a compact wordmark/product label treatment, primary/secondary color roles, status language, button hierarchy, border/radius/shadow rules, and a consistent icon strategy. Do not introduce Rotech or any unrelated brand asset.
- **Product navigation:** this is an operational dashboard, not a landing page. Keep one clear project shell, and if contextual navigation is introduced it may point only to existing areas such as Overview, Timeline, Budget, Photos, and Warranties. Do not invent marketing pages or fake navigation destinations.
- **Visual storytelling:** the hero area is the current project and its progress, dates, next action, and status—not an oversized slogan. Existing project photos may be used as content; do not add stock images, generated decorative imagery, or fake testimonials.
- **Content language:** retain the product's Traditional Chinese labels and data semantics, while ensuring the typography, spacing, number formatting, and controls also work for English expansion. Do not sprinkle English UI copy merely to appear international.
- **Responsive adaptation:** treat desktop, tablet, and mobile as intentionally composed layouts. Do not simply shrink the desktop grid; recompose the header, KPI hierarchy, section actions, row actions, timeline, and dialogs for touch.
- **Accessibility as premium quality:** readable contrast, keyboard focus, semantic landmarks, reduced-motion support, descriptive labels, and non-color status cues are mandatory parts of the visual bar.
- **Self-contained preview:** the review prototype may be one standalone HTML file with its CSS and small local interactions in the same file, with no remote fetches or CDN dependency. The production app remains the existing Vite/React architecture; this requirement does not authorize a production rewrite into one HTML file.

### Anti-template and anti-scaffold rules

- Do not use a repeated six-card dashboard pattern as the only composition; the project status and current action must have a clear focal point.
- Do not make every section an identical visual box with the same padding and no hierarchy. Shared tokens are required, but section-specific information density and emphasis should remain intentional.
- Do not use placeholder filler copy, invented metrics, fake brand logos, or decorative UI that has no corresponding product data.
- Do not use excessive badges, pills, gradients, glass effects, oversized empty hero space, or animation to disguise weak information architecture.
- Do not make the design depend on a particular viewport screenshot; layout must remain usable between the required breakpoints.

### Design tokens

Define these tokens in `web/src/index.css` and use them consistently; do not scatter replacement hex values through component rules.

- Background: `#f5f7fb`
- Surface: `#ffffff`
- Subtle surface: `#f8fafc`
- Ink: `#172033`
- Muted: `#667085`
- Border: `#e4e7ec`; strong border: `#cfd5df`
- Primary: `#1f4d8f`; primary hover: `#173d73`; primary soft: `#eaf1fb`
- Accent: `#c98727`; accent soft: `#fff5df`
- Success: `#19704a`; warning: `#9a6700`; danger: `#b42318`, each with a soft companion background
- Radius: 8px small, 12px medium, 16px large
- Card shadow: subtle 1px border-compatible shadow, not floating glass
- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40px

Use the existing CJK-safe system font stack. Body text is 14–16px with line-height 1.5. Section titles are 18–20px, page title 28–32px on desktop and 22–24px on mobile. Numeric KPI values are 24–32px.

## 4. Page structure

### App shell

- Page background is the warm-neutral background; content is not a centered narrow prototype column.
- Desktop content uses `max-width: 1280px` and 32px horizontal padding. At 1024px use 24px; at 767px and below use 16px.
- The top header is a distinct surface with a subtle bottom border, not a floating card.
- Header has project identity on the left and status/action controls on the right. The share action remains the most prominent action.
- Never leave a large unexplained blank right side at desktop widths; grids use available content width.

### Header hierarchy

The visual order is: (1) product label and project name, (2) project status and date range, (3) share action. Status remains understandable by text, not color alone. Existing status behavior must not change.

### Summary / KPI area

- Use a responsive grid for the existing six summary values.
- Completion is the visual anchor through a restrained accent edge or stronger surface, never a loud gradient.
- Every value has a short label, clear number, and supporting unit/context when available.
- Equal-height desktop cells; two-column grid on mobile.
- Do not alter summary calculations.

### Section cards

Every major area (stages, photos, budget, schedule, warranties, Gantt) follows one pattern:

- White surface, large radius, subtle card shadow, 24px desktop padding and 16px mobile padding.
- Header with title, one-line supporting description where useful, and section action aligned right.
- Consistent 24px vertical gap between sections.
- Section action is primary only when it creates the main object; edit/delete are compact secondary actions.
- Empty states explain what is missing and provide one next-step action where one exists.

### Domain sections

- **Stages:** progress/status rail or indicator, stage name, dates/metadata, and actions. Completed/current/pending/blocked states use text plus shape/border treatment. Delete is a quiet destructive action.
- **Photos:** responsive thumbnail grid with consistent aspect ratio, metadata/actions, and a useful empty state. Preserve preview behavior.
- **Budget:** totals are prominent; line items align currency columns; over-budget states use semantic warning/danger treatment.
- **Schedule:** overdue, due-soon, completed, and normal states differ by label/icon/weight as well as color. Dates remain scannable.
- **Warranties:** active/expired states are explicit; empty state explains the purpose of warranty records.
- **Gantt:** timeline remains legible with a clear label column where possible. On narrow screens, horizontal scroll is allowed only inside the Gantt surface.

## 5. Interaction and component states

All existing controls must have designed default, hover, active, keyboard focus, disabled, and destructive states.

- Use `:focus-visible` with a 2px high-contrast outline and offset.
- Minimum interactive target is 44×44px on touch layouts; compact desktop controls may use 36px height only when the hit area remains accessible.
- Buttons have one clear label and do not depend on color alone.
- Existing dialogs retain behavior, have a clear title and close/cancel action, and remain keyboard usable.
- Loading uses a restrained skeleton or progress treatment rather than a blank page.
- Errors use a visible alert panel with plain-language recovery guidance.
- Success feedback is brief and placed near the action or in the existing toast region.
- Empty state copy tells the user what is missing and what action will populate it.

## 6. Responsive behavior

### Desktop: >= 1200px

- Full header layout with identity, metadata, status, and share action on one or two balanced rows.
- KPI grid uses six columns where space permits.
- Domain sections use full available width; use two columns only when it improves scanability without making forms cramped.

### Tablet: 768–1199px

- Header may wrap into two rows.
- KPI grid uses three columns.
- Forms use two columns only for short, related fields.
- No clipped buttons or page-level horizontal overflow.

### Mobile: <= 767px

- Header stacks identity, metadata, then actions.
- KPI grid uses two columns; section cards use 16px padding.
- Row actions wrap or become a full-width group; all actions remain comfortable touch targets.
- Long lists scroll within their surface only when necessary; the document itself must not overflow horizontally.
- Dialogs fit the viewport with safe margins and scroll internally when long.

### Mobile remediation contract (v1.2)

The mobile layout is a deliberate composition, not a desktop grid reduced by CSS. The implementation and prototype must satisfy the following concrete contract at both **390×844** and **360×800** unless a criterion explicitly says otherwise:

- **MOB-01 Page frame:** use 16px horizontal page padding, a maximum 24px section gap, and no page-level horizontal overflow. The body scrollbar must not be required to reveal clipped content.
- **MOB-02 Header:** the product mark and project identity occupy the first row; status/date metadata occupies the next row; share and other header actions form a full-width or two-column action group below. No header action may be visually clipped or depend on hover.
- **MOB-03 Navigation:** section navigation is either a single-line touch-scroll rail or a wrapped control group. Each item has at least a 44×44px hit area, the active item is visible without requiring a desktop-width viewport, and navigation never causes document overflow.
- **MOB-04 Summary hierarchy:** preserve all existing summary values and calculations. Render them as a two-column grid with equal-width cells; the completion value spans the full row when needed to retain a readable label, value, and progress treatment. Do not reduce values to icon-only tiles.
- **MOB-05 Stages:** each stage is a vertical block with name/status first, dates and supporting metadata second, and edit/delete actions last. Actions are a full-width or two-column group with a 44px minimum target; no action may be pushed outside the card.
- **MOB-06 Domain sections:** budget, photos, schedule, and warranties use one-column composition. Section titles and the primary section action may wrap to two rows, but the action remains visible and reachable. Photo tiles use a two-column grid with a stable aspect ratio; text and controls must not overlap thumbnails.
- **MOB-07 Gantt/timeline:** only the Gantt surface may scroll horizontally. Keep the task-label column visible or clearly repeated while the time grid scrolls. Never create a page-level horizontal scrollbar and never shrink timeline labels below readable text size.
- **MOB-08 Forms and dialogs:** form fields become one column except for intentionally paired short fields. Dialog width is `min(100% - 32px, 520px)`, content scrolls inside the dialog when necessary, the title and close control remain reachable, and primary/cancel actions become a full-width stacked or equal two-column group.
- **MOB-09 Touch and type:** all mobile interactive controls have a 44×44px minimum hit area, body text is at least 14px with 1.5 line-height, page headings are 22–24px, and critical status is communicated with text/icon plus color—not color alone.
- **MOB-10 Resilience:** long Chinese labels, long project names, empty states, validation errors, and readonly/share mode must wrap cleanly. No `white-space: nowrap` rule may clip user content; intentional navigation/timeline scrolling must be limited to its own surface.
- **MOB-11 Interaction parity:** the mobile composition preserves FR-001–FR-006 behavior, IndexedDB persistence, readonly share restrictions, anchor navigation, and existing test hooks. Responsive work must not introduce a second state model.
- **MOB-12 Quality states:** the prototype and implementation show at least one populated state, one empty state, one error/validation state, and one dialog state at mobile width. Focus-visible styling and reduced-motion behavior remain present.
- **MOB-13 Viewport calibration:** `web/index.html` includes a standards-compliant device-width viewport declaration with `initial-scale=1`; at 390px and 360px CSS viewport widths the app renders its mobile breakpoint rather than a scaled desktop canvas. Do not use a global transform, browser-specific zoom hack, or user-scalable restriction to achieve this.

### Mobile visual prototype requirements

Before MiniMax changes production React/CSS, the Planner must produce and Sean must review a standalone visual prototype at `prototype/ui-polish-preview-v4.html`.

- The prototype must use the actual Renovation Tracker information architecture and Traditional Chinese product semantics, with representative seed data matching the current app rather than invented marketing content.
- It must visibly cover Overview, Timeline, Budget, Photos, Warranties, and the Gantt/timeline surface, including the mobile states in MOB-01–MOB-12.
- It must be self-contained HTML/CSS/JavaScript with no CDN, remote fetch, external font, or external image dependency. Small local interactions may be included to demonstrate navigation, a dialog, and the inner Gantt scroll.
- It must include a desktop fallback so the mobile composition can be compared with the existing desktop visual direction; this does not authorize production implementation before approval.
- The prototype review is a hard human gate. MiniMax must not begin the mobile production implementation until Sean explicitly approves the prototype or requests a bounded revision.

## 7. Accessibility and quality bar

- Maintain semantic heading order and form labels.
- Meet WCAG AA contrast: 4.5:1 normal text, 3:1 large text and UI boundaries.
- Every meaningful status is available as text or an accessible label.
- Keyboard users can reach actions, see focus, use dialogs, and dismiss transient UI where applicable.
- Do not remove outlines without a replacement focus treatment.
- Respect `prefers-reduced-motion`; animation is subtle and non-essential.

## 8. Acceptance criteria

- **UI-001 Visual system:** tokens, typography, surfaces, radii, shadows, and semantic colors are centralized and consistently applied; no default-looking primary controls remain.
- **UI-002 Desktop hierarchy:** at 1440×900, available width is used, header/KPI/section hierarchy is obvious, and prototype-scale whitespace is removed.
- **UI-003 Tablet layout:** at 1024×768, content is readable, controls are not clipped, and there is no page-level horizontal overflow.
- **UI-004 Mobile layout:** at 390×844, header, KPI cards, sections, forms, and actions stack cleanly; touch targets and text remain usable.
- **UI-005 Section consistency:** stages, photos, budget, schedule, warranties, and Gantt use the same card/header/empty-state language while preserving domain information.
- **UI-006 State coverage:** loading, error, empty, success, focus, hover, disabled, overdue/expired, and readonly states are understandable.
- **UI-007 Accessibility:** existing accessibility tests pass; focus-visible, labels, semantic headings, and non-color status cues are present.
- **UI-008 Behavior preservation:** all FR-001–FR-006 tests pass; IndexedDB persistence, share generation, and readonly restrictions are unchanged.
- **UI-009 Visual QA evidence:** local build is inspected in a real browser at 1440×900, 1024×768, and 390×844 with no console errors or page overflow.
- **UI-010 Scope discipline:** no new dependency, backend, migration, secret, generated artifact, or unrelated refactor is introduced.
- **UI-011 International quality:** the result has a coherent product identity, deliberate focal point, consistent typography/spacing/icon language, and does not read as a generic admin template or scaffold.
- **UI-012 Reference fidelity with product integrity:** the reference prompt's original visual quality, responsive, accessibility, and self-contained-preview principles are represented, while unrelated Rotech branding, marketing pages, fake content, and unsupported features are absent.
- **UI-013 Content and asset integrity:** all prominent metrics and imagery are traceable to existing project data or clearly marked empty states; no stock/generated decorative image is required for the interface to feel complete.
- **UI-014 Prototype parity:** the reviewed standalone preview and the production implementation share the same hierarchy, tokens, responsive behavior, and interaction priorities; the preview is not a disconnected artboard.
- **UI-MOB-001 Mobile frame:** at 390×844 and 360×800, there is no page-level horizontal overflow, clipped content, or unreachable action.
- **UI-MOB-002 Mobile shell:** header, navigation, summary, and section actions follow MOB-02–MOB-04 with visible active navigation and 44px touch targets.
- **UI-MOB-003 Mobile domain composition:** stages, budget, photos, schedule, warranties, and empty states follow MOB-05–MOB-06 without overlapping content.
- **UI-MOB-004 Mobile timeline:** Gantt/timeline horizontal scrolling is contained within its surface and labels remain understandable per MOB-07.
- **UI-MOB-005 Mobile dialogs:** create/edit dialogs meet MOB-08, including internal scrolling, safe margins, labels, validation feedback, and reachable actions.
- **UI-MOB-006 Mobile resilience:** long labels, readonly/share mode, focus-visible state, reduced motion, and error/empty states meet MOB-09–MOB-12.
- **UI-MOB-007 Prototype gate:** `prototype/ui-polish-preview-v4.html` is reviewed and explicitly approved by Sean before MiniMax implementation begins.
- **UI-MOB-008 Viewport calibration:** on an actual mobile browser, the document width equals the device CSS width, text is readable without pinch-zoom, and the mobile breakpoint is active; the viewport meta declaration is present in `web/index.html`.

## 9. Verification and definition of done

From `web/`, run `npm run typecheck`, `npm test -- --run`, `npm run build`, and `git diff --check`. Exercise at least one existing create/edit/delete flow and refresh to confirm persistence. The milestone is done only when MiniMax reports changed files and actual command output, Codex independently passes deterministic and browser checks at 1440×900, 1024×768, 390×844, and 360×800, and all UI-001–UI-014 plus UI-MOB-001–UI-MOB-008 criteria pass. Release then follows the project `AGENTS.md` sequence: commit, push, SHA-pinned Vercel deploy, canonical Notion update, and three-way SHA verification.
