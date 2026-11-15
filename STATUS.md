# Status — renovation-tracker（裝修進度管理平台）

- Repo：`openclawsean024-create/renovation-tracker`（預設分支 `main`，public）
- 基準 commit：`main` @ `9ceea39`（2026-09-23 `fix(ui): calibrate mobile viewport`）
- 狀態：🟡 **PRD／M1 GOAL 文件重建完成，M1 尚未開發**（2026-11-16）
- 規格：`PRD/SPEC.md` v5.0；目前里程碑：`GOAL.md`（M1）
- 技術棧：Vite 5 + React 18 + TypeScript strict + IndexedDB（local-first，無後端）

## M1 進度紀錄（分支 `feat/m1`）

每完成一條 AC 就在此補一列。指令皆在 `web/` 執行（Node v26.13.1）；「結果」為實際輸出摘要。

| AC | 狀態 | Commit | 驗證指令 | 結果 |
|---|---|---|---|---|
| AC-007 品質閘門與 CI | 本機通過；CI 綠燈待 PR 驗證 | `dc7f231` | `npm run lint && npm run typecheck && npm test && npm run build`；`git diff main -- web/src/__tests__/Dashboard.schedule.test.tsx \| grep -c '^-.*expect('` | lint 0 errors（僅 warnings）、typecheck exit 0、test 全數通過、build exit 0；被刪除的 `expect(` 行數 = 0。測試：`qualityGate.test.ts`、`Dashboard.schedule.test.tsx`（AC-007 標註） |
| AC-001 預算變更單 | 通過 | `8591cb9` | `npm test -- changeOrders` | exit 0；3 檔／41 tests 通過（`changeOrders.test.ts`、`changeOrders.db.test.ts`、`Dashboard.changeOrders.test.tsx`） |
| AC-002 合約金額與收款概要 | 通過 | `8591cb9` | `npm test -- contract` | exit 0；2 檔／29 tests 通過（`contract.test.ts`、`Dashboard.contract.test.tsx`）；另 `acceptance.db.test.ts` 含 AC-002 合約紀錄 round-trip |

## Notion 對應

| Notion「可產品化商品」欄位 | 值 | repo 對應 |
|---|---|---|
| 產品名稱 | 裝修進度管理平台 | 程式與 README 目前用「裝修進度神器」（名稱統一待 Sean 確認） |
| 優先順序 | P2 | — |
| 開發順位 | 第 7 個 | — |
| 主 repo | `openclawsean024-create/renovation-tracker` | 本 repo |
| 要併入的 repo | `openclawsean024-create/decoration-tracker` | 見下方合併清單；尚未搬移，該 repo 未修改 |
| 獲利潛力／模式 | 中／SaaS 訂閱 | `PRD/SPEC.md` §3；計費 M2 mock、M3 真實 |
| 目標客群 | 室內設計公司、裝修統包商與屋主 | `PRD/SPEC.md` §2 |
| 現況完成度 | 50 | 程式盤點：FR-001～FR-006 已實作（FR-004 部分），M1 新增 FR-007～FR-011 未實作 |
| 上市前要補 | README 與使用說明、照片進度回報、屋主端分享連結、計費 | 前三項 → M1 AC-006／AC-004／AC-005；計費 → M2（mock）／M3（真實） |
| 主要風險 | 裝修業數位化程度低，推廣需地推 | `PRD/SPEC.md` §17 |

## 本次增量（文件重建，未改程式）

- 改寫 `PRD/SPEC.md`（v5.0）、`AGENTS.md`；新增 `GOAL.md`、`SOP.md`、`STATUS.md`。
- 盤點主 repo 與 decoration-tracker 實際程式，建立合併清單與 README／程式不一致清單。
- 未修改任何功能程式碼、設定檔或測試；未 push 到 `main`。

## FR 對照（已實作／未實作）

| FR | 名稱 | 優先 | 狀態 | 所在 repo | 證據 |
|---|---|---|---|---|---|
| FR-001 | 工程進度看板 | P0 | 已實作 | renovation-tracker | `Dashboard.tsx`、`GanttChart.tsx`、`validation.ts`；`Dashboard.test.tsx`、`gantt.test.ts` 等 |
| FR-002 | 照片記錄 | P0 | 已實作 | renovation-tracker | `PhotoSection.tsx`、`photos.ts`；`photos*.test.ts`、`Dashboard.photos.test.tsx` |
| FR-003 | 預算追蹤 | P0 | 已實作 | renovation-tracker | `BudgetSection.tsx`、`budget.ts`；`budget*.test.ts`、`Dashboard.budget.test.tsx` |
| FR-004 | 屋主端唯讀分享連結 | P0 | 部分 | renovation-tracker | `share.ts`、`ReadOnlyView.tsx`；缺個資預設遮蔽、新功能摘要、撤銷 |
| FR-005 | 師傅排程與提醒 | P1 | 已實作（3 測試時間相依失敗） | renovation-tracker | `ScheduleSection.tsx`、`schedule.ts`；`Dashboard.schedule.test.tsx` |
| FR-006 | 保固紀錄 | P1 | 已實作 | renovation-tracker | `WarrantySection.tsx`、`warranty.ts`；`warranty*.test.ts` |
| FR-007 | 預算變更單與核准 | P0 | 部分（雛形） | decoration-tracker | `web/src/lib/db.ts`、`pages/BudgetPage.tsx`；M1 AC-001 |
| FR-008 | 合約金額與收款概要 | P1 | 部分（雛形） | decoration-tracker | `Project.total／paid`；M1 AC-002 |
| FR-009 | 階段驗收清單 | P0 | 部分（雛形） | decoration-tracker | `pages/AcceptancePage.tsx`；M1 AC-003 |
| FR-010 | 照片進度回報 | P0 | 未實作 | — | M1 AC-004 |
| FR-011 | README 與使用說明 | P0 | 未實作 | — | M1 AC-006 |
| FR-012 | 多案件管理 | P1 | 部分（雛形） | decoration-tracker | `pages/DashboardPage.tsx`；M2 |
| FR-013 | 帳號與角色權限 | P1 | 未實作 | — | M2 設計／M3 |
| FR-014 | 雲端同步與照片雲端儲存 | P1 | 未實作 | — | M2 mock／M3 |
| FR-015 | 伺服器端分享與屋主線上核准 | P1 | 未實作 | — | M3 |
| FR-016 | 計費與訂閱方案 | P1 | 未實作 | — | M2 mock／M3 |
| FR-017 | 資料匯出與備份 | P2 | 未實作 | — | M2 |
| FR-018 | 外部通知（Email／LINE） | P2 | 未實作 | — | M3 之後 |

## 合併清單進度（decoration-tracker → 本 repo）

| # | 項目 | 里程碑 | 狀態 | 對應測試 |
|---|---|---|---|---|
| 1 | 預算變更單（新增／核准／拒絕） | M1 | 未開始 | 待建：`changeOrders*.test.ts(x)` |
| 2 | 合約金額／已收／待收 | M1 | 未開始 | 待建：`contract.test.ts` |
| 3 | 驗收清單 | M1 | 未開始 | 待建：`acceptance*.test.ts(x)` |
| 4 | ESLint flat config → `lint` script | M1 | 未開始 | `npm run lint` |
| 5 | 多案件列表 UI | M2 | 未開始 | — |
| — | 時間軸／advanceStage、mock 照片、localStorage、靜態 dashboard.html、示範人名 seed、React 19／Tailwind 技術棧 | 不搬 | — | 理由見 `PRD/SPEC.md` §13.2 |

## Deterministic checks（2026-11-16，Node v26.13.1，`main` @ `9ceea39`）

| Command（於 `web/`） | Exit | 結果 |
|---|---:|---|
| `npm ci` | 0 | 安裝完成 |
| `npm run typecheck` | 0 | 通過 |
| `npm test` | 1 | 438 tests：435 通過、3 失敗（`Dashboard.schedule.test.tsx` 提醒相關，寫死 2026-09 日期且依賴系統時鐘） |
| `npm run build` | 0 | Vite build 完成 |
| `npm run lint` | 1 | script 不存在（尚未配置） |
| GitHub Actions `ci.yml` | — | 最近 3 次 run 皆失敗：workflow 檔解析失敗 |

decoration-tracker（只讀，未修改）：`npm ci` 0；`npm run lint` 0；`npm run build` 0，但產物只有轉址到靜態模板 `dashboard.html`，React app 未掛載；`npm test` 在 Node v26 下 24 失敗／4 通過（jsdom 下 `localStorage` 為 undefined），CI 使用 Node 20，結果未驗證；GitHub 上最近一次 CI run 失敗。

## 風險與待確認

- 產品名稱：Notion「裝修進度管理平台」vs 程式「裝修進度神器」。
- 部署目標：AGENTS 舊版寫 Vercel，CI 寫 GitHub Pages；正式網址未知。
- 定價：「NT$2,000–5,000／案」僅為 decoration-tracker GOAL 內的假設，未驗證。
- 屋主是否需付費、變更單核准是否需具法律效力（電子簽章）待確認。
- 分享 URL 目前可能帶出地址與保固聯絡方式（使用者有填時），URL 未加密且不可撤銷；M1 AC-005 處理。
- 測試資料中的電話使用 `0912345678`，建議 M1 改為更明顯的假號碼（如 `0900-000-000`）。
- decoration-tracker 封存與否由 Sean 決定，不在 agent session 執行。

## 下一步

1. Sean 覆審 `PRD/SPEC.md` 與 `GOAL.md`，確認待確認事項。
2. 依 GOAL AC-007 先修測試與 CI，讓品質閘門恢復綠燈。
3. 依 AC-001～AC-006 開發 M1，完成後更新本檔與 Notion。
