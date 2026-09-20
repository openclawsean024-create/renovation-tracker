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
