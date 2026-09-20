# UI Polish Pipeline — Planner Report

> 作者：Mavis (orchestrator / planner) · 日期：2026-09-20 · 對應 `PRD/UI-SPEC.md` v1.1 + `PRD/UI-POLISH-MINIMAX-TASK.md`

## 1. Mission scope

把現有 FR-001~006 已通過驗收的 React app，在**不動 behavior、不改 IndexedDB schema / store / share / validation 的前提下**，把視覺與互動系統對齊 `PRD/UI-SPEC.md` v1.1 的設計語言。Quality 對標 `prototype/ui-polish-preview-v3.html`，但 Rotech brand、marketing copy、假 metrics、stock image 一律不採用。

### 1.1 可動的範圍
- `web/src/index.css` — design tokens、utility classes、components rules、responsive media queries
- `web/src/components/*.tsx` — className 對齊、移除 inline style、新增語意 landmark（`<nav>`、`<aside>`、`<section>`、`<dl>` 等）
- `web/src/App.tsx` — skip link / main landmark
- 必要時新增小工具 component（例如 `Wordmark`, `NavRow`, `Hero`, `SummaryGrid`, `SectionCard`, `StatusPill` 強化）— 不引入新 package

### 1.2 不可動的範圍
- `web/src/db.ts`、`store.tsx`、`dates.ts`、`validation.ts`、`budget.ts`、`photos.ts`、`schedule.ts`、`warranty.ts`、`share.ts`、`status.ts`、`gantt.ts`、`seed.ts`、`types.ts` 的 export 行為
- 所有 `data-testid` attribute
- 所有 a11y label / aria-* 屬性
- `AppShell.tsx` 的 hash 路由與 share/edit 切換邏輯
- `package.json` / `tsconfig.json` / `vite.config.ts`

## 2. Gap analysis（目前 vs prototype v3）

### 2.1 Design tokens（`index.css` L7–L26）
| 舊 token | 新 token (UI-SPEC §3) | 差異 |
|---|---|---|
| `--color-bg: #f7f7f9` | `--bg: #f5f7fb` | 改值 |
| `--color-surface: #fff` | `--surface: #fff` | 改 name |
| `--color-text: #1f1f23` | `--ink: #172033` | 改值 + name |
| `--color-muted: #5a5a66` | `--muted: #667085` | 改值 + name |
| `--color-border: #d8dae0` | `--border: #e4e7ec` / `--border-strong: #cfd5df` | 拆兩個 |
| `--color-accent: #2754d6` | `--primary: #1f4d8f` | 改值 + name |
| （缺） | `--primary-hover: #173d73` | 新增 |
| （缺） | `--primary-soft: #eaf1fb` | 新增 |
| （缺） | `--accent: #c98727` / `--accent-soft: #fff5df` | 新增（amber，注意力） |
| `--color-warn: #b25b00` | `--warning: #9a6700` | 改值 + name |
| `--color-success: #1f7a3a` | `--success: #19704a` | 改值 + name |
| `--color-danger: #b3261e` | `--danger: #b42318` / `--danger-soft: #fff0ed` | 新增 soft |
| （缺） | `--navy: #172b47` / `--on-navy: #c4d1e2` / `--navy-border: #60748e` | 新增（Next Step panel 用） |
| （缺） | `--control-border: #8995a6` / `--focus: #1f4d8f` | 新增 |
| `--radius: 6px` | `--r-sm: 8px` / `--r-md: 12px` / `--r-lg: 16px` | 拆三層 |
| `--shadow-1` | `--shadow: 0 1px 2px rgb(23 32 51 / 3%)` | 改值 + name |
| （缺） | `--s1`…`--s10` (4-40px) | 新增 spacing scale |

### 2.2 App shell（`Dashboard.tsx` L246–291 + `ReadOnlyView.tsx` L77–101）
- 目前：`<header className="app-header"><h1>裝修進度神器</h1><div className="project-meta">...</div></header>` — 單行、無 nav
- 目標：`<header class="app-header"><div class="wrap"><div class="brand-row">{brand-mark + wordmark + header-note}</div><nav class="nav-row" aria-label="工程導覽">Overview / Timeline / Budget / Photos / Schedule / Warranties</nav></div></header>`
- 加 skip link（`<a class="skip" href="#main">跳至主要內容</a>`）
- Wordmark 顯示 "Renovation Tracker" + small "裝修進度管理"
- 新增 `<svg class="icon">` symbol sprite（`<use href="#i-overview" />` 等），沿用現有 icon 概念但換 SVG set

### 2.3 Hero + Next Step panel（`Dashboard.tsx` L293–335）
- 目前：直接 render `<Summary>` + 各 section
- 目標：`<section id="overview"><div class="hero"><div class="project-intro">{eyebrow + h1 + status pill + dates + share}</div><aside class="next-step" aria-label="下一步">…</aside></div><dl class="summary">6 metric cells</dl></section>`
- Next Step panel 用 navy bg（`--navy` / `--on-navy`）配 eyebrow / h2 / status / button

### 2.4 Summary grid（`Summary.tsx`）
- 目前 6 個 KPI 是垂直 stack 或一般 grid
- 目標：6-column desktop / 3-column tablet / 2-column mobile；`.metric.completion` 用 `background: var(--primary-soft)` 加 highlight；下方有 7 條小 segment 顯示 stage 完成進度（`.progress` with 7 spans）

### 2.5 Section pattern（`Dashboard.tsx` 內各 section + `PhotoSection/BudgetSection/...`）
- 新樣板：`<section class="section"><header class="section-header"><div class="section-heading"><h2>{title}</h2><span class="section-count">N 個</span></div><p>{description}</p></div><div class="section-tools">{tabs + btn}</div></header>{body}</section>`
- 加 view-switch tab（清單 / 時間軸）給 stages panel
- Budget / Photos 改用 `.records-grid` 兩欄並排（desktop）/ 單欄（mobile）
- Schedule / Warranty 改用 `.support > .support-section` 模式（icon + h2 + body + 動作）

### 2.6 Read-only view（`ReadOnlyView.tsx` + `ReadOnlyError.tsx`）
- 套用相同 shell / hero / summary / section 結構
- 共用同一份 CSS（讓 editable 與 readonly 視覺一致）
- 隱藏 `.edit-control`（`body.readonly .edit-control { display: none !important; }`）
- Read-only banner 用 `.readonly-banner` 樣式（primary border + primary-soft bg）
- Share dialog 改用 `.share-facts` 雙欄 dl 樣式

### 2.7 Gantt（`GanttChart.tsx` + `ReadOnlyGantt`）
- 改成 sticky label column + day grid + bars（類似 prototype v3 的 `.timeline-grid`）
- Gantt 內部可水平捲動，頁面不應 overflow
- bars 用 `.gantt-bar` 配 `--primary-soft` bg + `--primary` border

### 2.8 Dialog / Form
- 改用 `.form-grid` 兩欄 desktop / 單欄 mobile
- Field label 與 input 都要 min-height 44px（touch target）
- File input button 也要配 primary-soft 樣式
- Form feedback 改 `.form-feedback`（danger-soft bg + danger border）

### 2.9 Components 內 inline styles 清掉
目前 `Dashboard.tsx` 至少有 3 處 inline style (`<label style={{...}}>`, `<div style={{marginTop: '0.75rem'}}>`, `<p style={{marginTop: 0, color: 'var(--color-muted)'}}>` 等)。全部改 className。

## 3. UI-001 ~ UI-014 驗收 mapping

| AC | 對應工作 | 驗收證據 |
|---|---|---|
| UI-001 tokens / surfaces | §2.1 token migration、`<div class="wrap">` 全頁 max-width 1280 | 程式碼 diff + 瀏覽器實測 |
| UI-002 Desktop hierarchy | §2.2–2.3 brand/wordmark + nav-row + hero | 1440×900 screenshot |
| UI-003 Tablet | `@media (max-width: 1199px)` 規則 | 1024×768 screenshot |
| UI-004 Mobile | `@media (max-width: 767px)` 規則（hero 單欄、summary 兩欄、records-grid 單欄） | 390×844 screenshot |
| UI-005 Section consistency | §2.5 共用 `.section` pattern | 程式碼 + 視覺 |
| UI-006 State coverage | loading skeleton、error alert、empty CTA、success toast、focus-visible、disabled、readonly | 程式碼 + smoke |
| UI-007 Accessibility | 既有 accessibility.test.tsx + `:focus-visible` outline | `npm test` 全綠 |
| UI-008 Behavior preservation | FR-001~006 既有測試不退化 | `npm test -- --run` 全綠 |
| UI-009 Visual QA evidence | 本機 build + 1440×900 / 1024×768 / 390×844 三 viewport 截圖，無 console error | Integrator/QA browser smoke |
| UI-010 Scope discipline | 不加 dep、不加 backend、不動 schema | diff 檢視 |
| UI-011 International quality | 設計概念、品牌系統、typography rhythm | 視覺 + 文字 |
| UI-012 Reference fidelity | 對齊 prototype v3 品質，不抄 Rotech | 視覺 + 不抄清單 |
| UI-013 Content integrity | 不引入 stock image / 假 metrics / 假 logo | 程式碼 + 視覺 |
| UI-014 Prototype parity | preview 與 production 共用 tokens / 結構 | 對照 prototype v3 與 web render |

## 4. 執行 increment（worker 一次做完 + reviewers 一次跑完）

### Increment 1 — tokens 與 base utilities
1. `index.css` L7–L26 換成新 token set，加 spacing / radius / shadow / status colors
2. 替換全檔所有 `var(--color-*)` 為新名稱
3. 加 typography scale、`.btn` 三層（primary / quiet / icon-only）、`.icon` 樣式、`.skip`、`.sr-only`、`.eyebrow`、`.numeric`、`.muted`

### Increment 2 — App shell 與 hero
4. 新增 `<Wordmark>` 或 inline SVG symbol set（沿用 prototype v3 的 11 個 icon：mark、overview、timeline、budget、photo、calendar、shield、arrow、plus、share、edit、list、close、local）
5. 重寫 `Dashboard.tsx` 的 header 結構：brand-row + nav-row + skip link
6. 加 hero：project-intro + next-step navy panel
7. 加 summary `<dl class="summary">` 6 metric cells

### Increment 3 — Sections 共用化
8. 新增 / 重寫 `SectionCard` 公用 component（或 template）
9. 把 `StageSection` / `PhotoSection` / `BudgetSection` / `ScheduleSection` / `WarrantySection` / `GanttChart` 改用新 pattern
10. view-switch tab（list / chart）給 stages panel
11. records-grid + support 包 budget/photos/schedule/warranty

### Increment 4 — Read-only view
12. `ReadOnlyView.tsx` 改用與 Dashboard 相同的 shell/hero/section pattern
13. Read-only banner 共用 `.readonly-banner`
14. `body.readonly .edit-control { display: none }` 確保 readonly 沒編輯入口

### Increment 5 — Dialog / form / responsive / polish
15. `StageForm` / `BudgetForm` / `PhotoForm` / `ScheduleForm` / `WarrantyForm` / `ShareDialog` 共用 `.form-grid` / `.dialog-*`
16. 全部 inline style 清掉
17. `@media (max-width: 767px)` 與 `(max-width: 1199px)` 規則
18. `prefers-reduced-motion` / `forced-colors` 補強

## 5. 驗證 commands（Developer 必須跑 + 留 exit code）

```bash
cd web && \
  npm run typecheck && \
  npm test -- --run && \
  npm run build && \
  (cd .. && git diff --check)
```

≥1 個測試加 UI-001 / UI-002 / UI-007 / UI-009 的 snapshot 或 viewport assertion。

## 6. Risks & open questions

- **R1**：現有 `data-testid` 數量極多（每 row 一個），reviewer 必須逐個確認沒有消失。
- **R2**：`web/dist/` 可能被 build 重生；integrator commit 前必須先清乾淨。
- **R3**：v3 prototype 的 `<aside class="next-step">` 用 SVG 圖示 + step-index 文字，編輯版若 seed 為 planning 要不要顯示同樣「從第一個階段開始 · 01/07」？→ **保留 prototype 行為**。
- **R4**：icon 用 SVG `<symbol>` sprite，但 prototype 用 `i-overview` / `i-timeline` 等。舊 component 沒有用 sprite，直接 inline svg 或 emoji — 需把現有 svg iconography 對應到新 set。

## 7. Done 條件

所有 Increment 1~5 完成 + 5 條驗證 command 全綠 + 三 reviewer 都 `VERDICT: PASS` + git diff --check 0 error + 0 new dependency。
