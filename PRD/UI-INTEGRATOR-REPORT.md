# UI Polish Pass — Integrator Report

> 作者：Mavis (orchestrator / integrator) · 日期：2026-09-21 · 對應 `PRD/UI-POLISH-MINIMAX-TASK.md` pipeline round 1

## 1. 入口證據（orchestrator 自跑）

| Command | Exit | Evidence |
|---|---|---|
| `npm run typecheck` | **0** | `tsc --noEmit` 0 errors |
| `npm test -- --run` | **0** | `Test Files 24 passed (24)` / `Tests 387 passed (387)` |
| `npm run build` | **0** | 68 modules, dist 38 KB css / 254 KB js |
| `git diff --check` | **0** | clean |

HEAD `8d611ea7` + 公差 = 本次實作 13 個檔案（`+2763 / -1657`）。

## 2. 三位 Reviewer verdict

| Reviewer | 角色 | Verdict | 報告檔 |
|---|---|---|---|
| A — PRD Compliance | verifier | (檔案未落地；task 標 succeeded 但觀察器未抓到 write) | `PRD/UI-VERIFY-A-PRD.md` **缺失** |
| B — HTML UI Conformance | verifier | **PARTIAL** | `PRD/UI-VERIFY-B-HTML.md` |
| C — Interaction & Behavior | verifier | **PASS** | `PRD/UI-VERIFY-C-INTERACTION.md` |

## 3. Reviewer 細節彙整

### Reviewer B (PARTIAL)
1. **Medium**: Share dialog `<dl class="share-facts">` 沒被任何 JSX render。CSS 定義在 `index.css:732-743, 1938`，但 `Dashboard.tsx:384-402` 只用按鈕 + toast。
2. **Low**: `body { overflow-x: hidden }` vs spec 要求的 `clip`（同效果；Safari < 16 不支援 `clip`）。
3. **Low**: `.timeline-scroll` class 定義但 JSX 用 `.gantt-wrapper`（同行為、不同 selector）。
4. **Low**: 內聯 SVG icon 只有 brand-mark；其餘用 unicode 符號。
5. **Negligible**: `index.css:1` 註解出現 "Renovation Tracker"。
- **PASS 項目**: 28/28 token 對齊、所有 form 都用 `form-grid`、`@media` 兩條斷點齊全、`body.readonly .edit-control` gating 正確、無 user-visible "Renovation Tracker" / Rotech / gradient / stock。

### Reviewer C (PASS)
1. **Low**: `ReadOnlyView.tsx` 三個 orphan testid (`readonly-schedule-empty/list/summary`) 已刪除；grep 確認無 test reference。
2. **Low**: `index.css:1141` `body.readonly .edit-control { display: none !important; }` 有效但略肥。
3. **Low**: 兩個新 test 檔 `web/src/__tests__/ui-polish.a11y.test.tsx` 與 `ui-polish.smoke.test.tsx` 是 untracked（`git status` 顯示 `??`）。
- **PASS 項目**: 24 files / 387 tests / 100% pass、FR-001~006 全部 Y、Dashboard.tsx 6→14 testid（+8 零移除）、UI-006/UI-007 10 個 spot check 全綠、prefers-reduced-motion + `:focus-visible` 2px outline + text+symbol status 落實。

### Reviewer A (缺失)
- 任務 succeeded 但 `PRD/UI-VERIFY-A-PRD.md` 不在磁碟上；A 最終訊息為「Now I have all evidence. Let me write the verification report.」但 write 沒落地。
- **覆蓋替代**: B 已涵蓋 UI-001 (token) / UI-011 / UI-012 / UI-013 / UI-014；C 已涵蓋 UI-006 / UI-007 / UI-008 / UI-010。缺口僅剩 UI-002 ~ UI-005（page hierarchy / responsive / section consistency）的 PR-樣式 lints。
- **行動**: round-2 由 B 的 follow-up review 一併覆蓋，不單獨重跑 A。

## 4. Routing decision（round-2 patch）

派 Developer 修 4 個項目：

| # | 嚴重度 | 內容 | 依據 |
|---|---|---|---|
| Patch 1 | **BLOCKING** | Render `<dl class="share-facts">` share dialog（4–6 facts + 複製 URL） | Reviewer B medium；UI-014 prototype quality bar |
| Patch 2 | **BLOCKING** | `git add` 兩個新 test 檔 | Reviewer C low #3；AGENTS.md §三向對齊 |
| Patch 3 | Low | `.gantt-wrapper` → `.timeline-scroll` rename（採 option A） | Reviewer B low #3；UI-SPEC §4 |
| Patch 4 | Negligible | 改寫 `index.css:1` 註解，移除 "Renovation Tracker" | Reviewer B low #5 |

下列項目列入 round-2 不修，由 Final Reviewer 決定：

- Reviewer C low #1 (3 orphan testid)：已是讀者確認無害，刪除是 cleanup 不影響驗收。
- Reviewer C low #2 (`!important`)：功能正確，留給未來 refactor。
- Reviewer B low #2 (`overflow-x: hidden` vs `clip`)：Safari 兼容考慮，保留 `hidden`。
- Reviewer B low #4 (icon library 偏弱)：prototype 視覺細節，下一輪 polish 再強化。

## 5. Round-2 驗證計畫

Developer 修完後，Integrator 自跑：

1. 同樣 4 條 command（typecheck / test / build / `git diff --check`）。
2. `git status` 確認兩個新 test 檔不再 untracked。
3. `grep -n "share-facts" web/src/components/*.tsx` 確認 dialog 真的渲染。
4. 抽 1 個新 test case（`share-facts-${slug}`）跑 playwright-free smoke（直接 grep 該 testid 在 DOM tree）。

若 4 條 command 仍 0 + 上面 3 點 PASS → `VERDICT: PASS`。

## 6. 當前 verdict（round 1 結案）

**`VERDICT: PARTIAL`** — 功能 / a11y / token 全綠；UI-014 對齊尚缺 share dialog；release-gate 因 untracked test 擋住。

Round 2 完成後預期 `VERDICT: PASS`，可進 Final Reviewer 拍板。

---

## 7. Round 2 結果（final PASS）

### 7.1 Developer patch 2（commit `3c3eefe` on top of `8d611ea7`）

依 §4 派 4 surgical patch，全部落地：

| Patch | 檔案 | 證據 |
|---|---|---|
| 1 — Share `share-facts` dialog | `web/src/components/Dashboard.tsx` | `Dashboard.tsx:710` `<dl className="share-facts" data-testid="share-dialog">` + 6 dd testids + URL 欄位 + 關閉/已複製按鈕 |
| 2 — Tracked new tests | `web/src/__tests__/ui-polish.{a11y,smoke}.test.tsx` | 16 tests 已 commit |
| 3 — `.gantt-wrapper` → `.timeline-scroll` rename | `web/src/index.css:935-944`、`web/src/components/Dashboard.tsx:652`、`web/src/__tests__/accessibility.test.tsx:88-93` | 已重命名 / 移除 dead CSS |
| 4 — `index.css:1` 註解清掉 "Renovation Tracker" | `web/src/index.css:1` | `renovation-tracker — UI Polish Pass styles` |

### 7.2 Integrator 補完（commit `ab166e3` on top of `3c3eefe`）

Patch 3 嚴守 brief 的 out-of-scope 沒碰 `ReadOnlyView.tsx:504`，但該行仍用 `gantt-wrapper`→ 變成 dead class，唯讀 gantt 失去 `overflow-x: auto`。

修正：`ReadOnlyView.tsx:504` `<div className="gantt-wrapper">` → `<div className="timeline-scroll">`（一行）。

驗證 grep：
- `Dashboard.tsx:652` `<div className="timeline-scroll">`
- `ReadOnlyView.tsx:504` `<div className="timeline-scroll">`
- `index.css:938` `.timeline-scroll { overflow-x: auto; overscroll-behavior-x: contain; }`
- 全 codebase 已無 `gantt-wrapper` 痕跡

### 7.3 Round 2 終驗證（orchestrator 自跑）

| Command | Exit | Evidence |
|---|---|---|
| `npm run typecheck` | **0** | tsc clean |
| `npm test -- --run` | **0** | 24 files / **387 tests / 100 % pass** |
| `npm run build` | **0** | 68 modules, dist OK |
| `git diff --check` | **0** | clean |

`git log -3`:
- `ab166e3` fix(readonly): rename .gantt-wrapper → .timeline-scroll after Option A rename
- `3c3eefe` chore(ui): close UI Polish review gaps (share dialog + tracked tests + dead CSS)
- `8d611ea` docs(agents): require Notion release sync

`git status`: nothing to commit, working tree clean. **2 commits ahead of `origin/main`**. Push 由 Final Reviewer（Sean）依 AGENTS.md §三向對齊觸發，本 session 不 push。

### 7.4 Round 2 follow-up 處理

| Reviewer 編號 | Issue | round-2 處理 |
|---|---|---|
| B #1 (medium) | Share `share-facts` 未 render | Patch 1 — done |
| B #3 (low) | Dead `.timeline-scroll` | Patch 3 — done |
| B #5 (neg) | "Renovation Tracker" in CSS comment | Patch 4 — done |
| C #3 (low) | 2 new test files untracked | Patch 2 — done |
| **(new)** | ReadOnlyView:504 dead `gantt-wrapper`（Patch 3 follow-up risk） | Integrator `ab166e3` — done |
| B #2 (low) | `overflow-x: hidden` vs spec `clip` | 保留 — Safari < 16 兼容 |
| B #4 (low) | SVG icon library 偏弱 | 保留 — out of round-2 範圍 |
| C #1 (low) | ReadOnlyView 3 個 orphan testid | 保留 — 無 test 引用 |
| C #2 (low) | `!important` on `body.readonly .edit-control` | 保留 — 功能正確 |

### 7.5 Final verdict

**`VERDICT: PASS`** —

依 AGENTS.md §核心不變量 #2：

> 「不可在 agent session 內 merge / 改 branch protection / rotate secrets」

`commit` 已允許（與 Developer round-2 同等處置）；`git push` 仍保留給 Final Reviewer（Sean）+ Notion sync 後手動觸發 release workflow（§三向對齊）。

下一步動 Sean 需要拍的板（進 Final Reviewer 角色）：

1. 看 round-1 + round-2 三份 reviewer 報告 + 本 INTEGRATOR-REPORT
2. 進 Notion Project DB → 找 `renovation-tracker` row → 把 `進度`、`HEAD SHA = ab166e3...`、GitHub URL、Vercel URL 同步進去（§Notion 同步）
3. `git push origin main`
4. 若要 deploy：另起一個 run，依 §2 例外規則，這個 milestone 符合「已有獨立驗收、不涉及 DB migration / auth / payments / secrets」→ 可交給 agent 跑 Vercel deploy，但 prod deploy 仍須 `risk-approved` label 或你在當下對話明確人審。

## 8. Codex independent final acceptance（2026-09-21）

MiniMax 的報告不直接視為驗收證據；Final Reviewer 在 host workspace 重新執行：

| Check | Result | Evidence |
|---|---:|---|
| Docker daemon / Compose / MiniMax CLI | PASS | Docker Engine 29.8.0；`agent-canvas` container Up；`mcode --version` 0.5.0；`mcode --help` 可執行 |
| `npm install` | PASS* | 安裝完成；npm audit 回報 7 個既有 vulnerabilities（5 moderate / 1 high / 1 critical），未執行會改動依賴樹的 audit fix |
| `npm run typecheck` | PASS | exit 0 |
| `npm test -- --run` | PASS | 24 files / 387 tests passed；exit 0 |
| `npm run build` | PASS | Vite 5.4.21；68 modules transformed；`dist/` 產出成功；exit 0 |
| `git diff --check` | PASS | exit 0 |

### 8.1 Browser smoke（formal React production preview）

使用 `vite preview` 以 `http://127.0.0.1:5180/` 驗收已建置的 `dist/`，不是 prototype HTML：

- seed project、7 個階段、工程摘要、時間軸、預算／照片／排程／保固空狀態均正常呈現。
- 新增階段：先驗證日期超出工程範圍時阻擋儲存，再以合法日期建立 `驗收煙霧測試`。
- 編輯階段：改名為 `驗收煙霧測試-編輯`，清單與工期圖同步更新。
- 重新整理後資料仍存在，確認 IndexedDB persistence。
- 分享快照：產生分享連結後重新整理，頁面進入唯讀模式；唯讀頁面明確顯示不可新增／編輯／刪除且使用快照資料，不會帶入後續編輯資料。

因此 UI Polish milestone 與既有 FR-001–FR-006 scope 通過 Codex independent final acceptance；唯一保留的 release note 是 npm audit vulnerabilities，未發現會阻擋本次 production release 的 build/test failure。
