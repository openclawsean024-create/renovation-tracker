# Status — renovation-tracker（裝修進度管理平台）

- Repo：`openclawsean024-create/renovation-tracker`（預設分支 `main`，public）
- 基準 commit：`main` @ `9ceea39`；M1 開發分支 `feat/m1`（自 `chore/prd-rebuild` @ `344da4d` 開出）
- 狀態：🟡 **M1（AC-001～AC-009）完成，Exit gate 全數通過；Codex 安全審查的 13 項已修正並推送、CI 綠燈；待額度恢復後補跑修正後的例行審查，再合併**：本機品質閘門、PR CI、獨立驗收，以及 Sean 覆審（合併清單、範圍與 UI）（2026-11-16）。PR `openclawsean024-create/renovation-tracker#2` 尚未合併；合併、部署、Notion 同步與 decoration-tracker 封存由 Sean 決定。
- 尚未做：merge、push 到 `main`、production deploy、Notion 同步、封存 decoration-tracker — 皆不在 agent session 內執行。
- 規格：`PRD/SPEC.md` v5.1；目前里程碑：`GOAL.md`（M1）
- 技術棧：Vite 5 + React 18 + TypeScript strict + IndexedDB（local-first，無後端）

## M1 進度紀錄（分支 `feat/m1`）

每完成一條 AC 就在此補一列。指令皆在 `web/` 執行（Node v26.13.1），除非註明在 repo 根目錄；「結果」為實際輸出摘要。完整品質閘門的最終結果見下方「Deterministic checks」。

| AC | 狀態 | Commit | 驗證指令 | 結果 |
|---|---|---|---|---|
| AC-001 預算變更單 | 通過 | `8591cb9` | `npm test -- changeOrders` | exit 0；3 檔／41 tests 通過（`changeOrders.test.ts`、`changeOrders.db.test.ts`、`Dashboard.changeOrders.test.tsx`） |
| AC-002 合約金額與收款概要 | 通過 | `8591cb9` | `npm test -- contract` | exit 0；2 檔／29 tests 通過（`contract.test.ts`、`Dashboard.contract.test.tsx`）；另 `acceptance.db.test.ts` 含 AC-002 合約紀錄 round-trip 與「與 FR-003 預算分開儲存」 |
| AC-003 階段驗收清單 | 通過 | 功能 `8591cb9`、互動測試 `d3519e3` | `npm test -- acceptance` | exit 0；3 檔／28 tests 通過（`acceptance.test.ts`、`acceptance.db.test.ts`、`Dashboard.acceptance.test.tsx`） |
| AC-004 照片進度回報 | 通過 | 功能 `8591cb9`、互動測試 `d3519e3` | `npm test -- photoReport` | exit 0；2 檔／15 tests 通過（`photoReport.test.ts`、`Dashboard.photoReport.test.tsx`）；不接任何雲端儲存（測試確認不發出 `fetch`） |
| AC-005 屋主端分享連結強化 | 通過 | `bc0d87b` | `npm test -- share` | exit 0；2 檔／105 tests 通過（`share.test.ts`、`Dashboard.share.test.tsx` 的 AC-005 區塊；既有 FR-004 測試未刪改斷言） |
| AC-006 README 與使用說明 | 通過 | `c47ffb1` | repo 根目錄：GOAL AC-006 的兩條 `grep`；`web/`：`npm test -- help` | README 標題檢查無輸出；`docs/USER-GUIDE.md` 檢查 exit 0；`npm test -- help` exit 0，1 檔／6 tests 通過（`Dashboard.help.test.tsx`） |
| AC-007 品質閘門與 CI | 通過（本機與 PR 的 GitHub Actions 皆綠燈） | `dc7f231` | `npm run lint && npm run typecheck && npm test && npm run build`；repo 根目錄：`git diff main -- web/src/__tests__/Dashboard.schedule.test.tsx \| grep -c '^-.*expect('` | lint 0 errors、typecheck exit 0、test 全數通過、build exit 0；被刪除的 `expect(` 行數 = 0。測試：`qualityGate.test.ts`、`Dashboard.schedule.test.tsx`（標 AC-007 的測試） |
| AC-008 假資料與憑證安全 | 通過 | `dc7f231`（電話）、`bc0d87b`（地址）、`c47ffb1`（掃描測試） | repo 根目錄：GOAL AC-008 的 `git grep` 與 `git ls-files \| grep -E '(^\|/)\.env'`；`web/`：`npm test -- fakeData` | 兩條指令皆無輸出；`fakeData.test.ts` 7 tests 通過。測試電話改為 `0900-000-000`、測試地址改為 `測試市示範路 1 號` |
| AC-009 合併完成對照 | 通過 | `6fb29e6` | repo 根目錄：`grep -c '已搬入' STATUS.md`；`gh repo view openclawsean024-create/decoration-tracker --json isArchived --jq .isArchived`；`web/`：`npm test -- mergeChecklist` | `grep -c` ≥ 4；`isArchived` 輸出 `false`（2026-11-16 查詢，`pushedAt` 仍為 2026-09-06，本 session 未對該 repo 做任何寫入）；`mergeChecklist.test.ts` 7 tests 通過 |

## Notion 對應

| Notion「可產品化商品」欄位 | 值 | repo 對應 |
|---|---|---|
| 產品名稱 | 裝修進度管理平台 | README 與文件沿用 GOAL.md 的「裝修進度管理平台」；App 畫面仍顯示「裝修進度神器」（名稱統一待 Sean 確認，M1 未更動畫面名稱） |
| 優先順序 | P2 | — |
| 開發順位 | 第 7 個 | — |
| 主 repo | `openclawsean024-create/renovation-tracker` | 本 repo |
| 要併入的 repo | `openclawsean024-create/decoration-tracker` | 見下方合併清單；M1 四項已搬入（重寫），該 repo 未修改、未封存 |
| 獲利潛力／模式 | 中／SaaS 訂閱 | `PRD/SPEC.md` §3；計費 M2 mock、M3 真實 |
| 目標客群 | 室內設計公司、裝修統包商與屋主 | `PRD/SPEC.md` §2 |
| 現況完成度 | 50（Notion 記載，未更新） | 程式盤點：FR-001～FR-011 已實作於 `feat/m1`（未合併）；Notion 數值待 release 時由 Sean 同步 |
| 上市前要補 | README 與使用說明、照片進度回報、屋主端分享連結、計費 | 前三項已於 M1 完成（AC-006／AC-004／AC-005）；計費未做 → M2（mock）／M3（真實） |
| 主要風險 | 裝修業數位化程度低，推廣需地推 | `PRD/SPEC.md` §17 |

## 本次增量（M1，分支 `feat/m1`）

- 品質閘門（AC-007）：固定假時鐘修正 3 個排程提醒測試、新增 ESLint flat config 與 `lint` script、重寫 CI workflow。
- 自 decoration-tracker 重寫搬入：預算變更單（FR-007）、合約金額與收款概要（FR-008）、階段驗收清單（FR-009）。
- 新增照片進度回報（FR-010）、分享 snapshot v2 與個資預設遮蔽（FR-004 缺口）、README／使用說明／App 內「使用說明」（FR-011）。
- IndexedDB schema v5 → v6：只新增 `changeOrders`、`contracts`、`acceptanceItems` 三個 object store，既有 store 與資料不變（`changeOrders.db.test.ts` 含 v5 → v6 升級測試）。
- 未做：計費、真實金流、雲端照片儲存、多案件列表、後端、登入、部署。

### 需 Sean 人審（AGENTS.md §4 第 7、8 點）

- **DB schema migration v5 → v6**：依本次任務指示以 IndexedDB 重寫 M1 功能而新增三個 store；屬 additive 變更，但仍列為需人審項目。
- **UI 變更**：`PRD/UI-SPEC.md` 已更新為 v1.4（M1 sections），未另做 prototype；新區塊的版面與文案請於 PR 覆審時確認。
- **CI deploy job**：原 workflow 的 GitHub Pages deploy job 保留定義但以 `if: ${{ false }}` 停用，避免修好語法後在合併到 `main` 時自動觸發從未執行過的 production deploy（部署目標待確認）。

### M1 實作上的取捨（供覆審）

- 導覽列維持原本六個連結（`Dashboard.navigation.test.tsx` 鎖定該清單），新區塊以同頁捲動到達；是否加入導覽待 UI 覆審決定。
- 變更單一旦核准或拒絕就不能再編輯或改狀態（SPEC §12.1「已決定的變更單不可再改金額」）；記錯需刪除重建。
- 分享 snapshot 只帶變更單的標題、金額、狀態與決定日；材料與備註不放入連結。
- 勾選「包含聯絡方式」時，連結才會帶出有填電話的工班（名稱＋電話）與保固聯絡方式。
- 工程地址目前沒有編輯 UI（M1 未新增）；沒有地址時分享對話框的地址選項為停用狀態。
- 未預留 `PhotoStorageAdapter` 介面（SPEC §12.4 為「預留時」的限制條件，非 M1 AC），留待 M2。
- seed 仍只建立示範工程與七個階段，未加入示範變更單／驗收項目。

## FR 對照（已實作／未實作）

| FR | 名稱 | 優先 | 狀態 | 所在 repo | 證據 |
|---|---|---|---|---|---|
| FR-001 | 工程進度看板 | P0 | 已實作 | renovation-tracker | `Dashboard.tsx`、`GanttChart.tsx`、`validation.ts`；`Dashboard.test.tsx`、`gantt.test.ts` 等 |
| FR-002 | 照片記錄 | P0 | 已實作 | renovation-tracker | `PhotoSection.tsx`、`photos.ts`；`photos*.test.ts`、`Dashboard.photos.test.tsx` |
| FR-003 | 預算追蹤 | P0 | 已實作 | renovation-tracker | `BudgetSection.tsx`、`budget.ts`；`budget*.test.ts`、`Dashboard.budget.test.tsx` |
| FR-004 | 屋主端唯讀分享連結 | P0 | 已實作（M1 強化；撤銷／到期屬 FR-015，未實作） | renovation-tracker | `share.ts`（snapshot v2）、`ReadOnlyView.tsx`、分享對話框個資勾選；`share.test.ts`、`Dashboard.share.test.tsx` |
| FR-005 | 師傅排程與提醒 | P1 | 已實作（時間相依測試已修正） | renovation-tracker | `ScheduleSection.tsx`、`schedule.ts`；`Dashboard.schedule.test.tsx` |
| FR-006 | 保固紀錄 | P1 | 已實作 | renovation-tracker | `WarrantySection.tsx`、`warranty.ts`；`warranty*.test.ts` |
| FR-007 | 預算變更單與核准 | P0 | 已實作（M1；核准為本機狀態紀錄，非電子簽章） | renovation-tracker | `changeOrders.ts`、`ChangeOrderSection.tsx`；`changeOrders*.test.ts(x)`；AC-001 |
| FR-008 | 合約金額與收款概要 | P1 | 已實作（M1） | renovation-tracker | `contract.ts`、`ContractSection.tsx`；`contract.test.ts`、`Dashboard.contract.test.tsx`；AC-002 |
| FR-009 | 階段驗收清單 | P0 | 已實作（M1） | renovation-tracker | `acceptance.ts`、`AcceptanceSection.tsx`、`StageRow.tsx`；`acceptance*.test.ts(x)`；AC-003 |
| FR-010 | 照片進度回報 | P0 | 已實作（M1） | renovation-tracker | `photoReport.ts`、`PhotoReportSection.tsx`；`photoReport.test.ts`、`Dashboard.photoReport.test.tsx`；AC-004 |
| FR-011 | README 與使用說明 | P0 | 已實作（M1） | renovation-tracker | `README.md`、`docs/USER-GUIDE.md`、`HelpDialog.tsx`；`Dashboard.help.test.tsx`；AC-006 |
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
| 1 | 預算變更單（新增／核准／拒絕） | M1 | 已搬入（以 IndexedDB／store／validation 重寫） | `changeOrders.test.ts`、`changeOrders.db.test.ts`、`Dashboard.changeOrders.test.tsx` |
| 2 | 合約金額／已收／待收 | M1 | 已搬入（獨立 `contracts` store，與 FR-003 預算分開） | `contract.test.ts`、`Dashboard.contract.test.tsx`、`acceptance.db.test.ts` |
| 3 | 驗收清單 | M1 | 已搬入（改為每階段可增刪，含檢查日與備註） | `acceptance.test.ts`、`acceptance.db.test.ts`、`Dashboard.acceptance.test.tsx` |
| 4 | ESLint flat config → `lint` script | M1 | 已搬入（`web/eslint.config.js`，依 React 18／Vitest 調整） | `qualityGate.test.ts`；`npm run lint` |
| 5 | 多案件列表 UI | M2 | 未開始 | — |
| — | 時間軸／advanceStage、mock 照片、localStorage、靜態 dashboard.html、示範人名 seed、React 19／Tailwind 技術棧 | 不搬 | 未搬（`mergeChecklist.test.ts` 檢查） | 理由見 `PRD/SPEC.md` §13.2 |

## Deterministic checks（2026-11-16，Node v26.13.1，`feat/m1`）

| Command（於 `web/`） | Exit | 結果 |
|---|---:|---|
| `npm ci` | 0 | 乾淨安裝完成 |
| `npm run lint` | 0 | `eslint .`：0 errors、5 warnings（`react-refresh/only-export-components`） |
| `npm run typecheck` | 0 | `tsc --noEmit` 通過 |
| `npm test` | 0 | 40 檔／625 tests 全數通過（M1 前為 25 檔／438 tests，其中 3 失敗） |
| `npm run build` | 0 | `tsc --noEmit && vite build` 完成（JS 302.80 kB／gzip 86.53 kB、CSS 45.15 kB） |
| GitHub Actions `ci.yml`（PR `openclawsean024-create/renovation-tracker#2`） | — | run `43756028967`（commit `9604dc5`，`pull_request` 事件，Node 22）：`lint`、`test`、`build` 皆 success，`deploy` skipped（停用）；`gh pr checks 2` 顯示三項 pass。M1 前最近 3 次 run 皆為 workflow 解析失敗。之後的 commit 以 PR 頁面的 checks 為準 |

GOAL 指定的根目錄檢查：

| Command（於 repo 根目錄） | 結果 |
|---|---|
| AC-006：README 六個標題的 `for … grep -q` | 無輸出（全部存在） |
| AC-006：`grep -q '## 業者端' docs/USER-GUIDE.md && grep -q '## 屋主端' docs/USER-GUIDE.md` | exit 0 |
| AC-007：`git diff main -- web/src/__tests__/Dashboard.schedule.test.tsx \| grep -c '^-.*expect('` | `0` |
| AC-008：`git grep -nE '…' -- . ':!PRD/SPEC.md' ':!GOAL.md' ':!SOP.md'` | 無輸出 |
| AC-008：`git ls-files \| grep -E '(^\|/)\.env'` | 無輸出 |
| AC-009：`grep -c '已搬入' STATUS.md` | `6`（≥ 4） |
| AC-009：`gh repo view openclawsean024-create/decoration-tracker --json isArchived --jq .isArchived` | `false` |
| `git diff --check` | 無輸出 |

既有測試檔的變更（皆未刪除或放寬斷言）：`Dashboard.schedule.test.tsx` 只新增固定時鐘與一個 AC-007 測試；`share.test.ts`、`Dashboard.share.test.tsx` 只新增 AC-005 區塊；其餘被改動的 11 行都是把測試資料中的電話 `0912345678` 換成 `0900-000-000`、地名換成 `測試市示範路 1 號`（AC-008），其中 3 行 `expect(` 的期望值隨輸入值同步替換，斷言強度不變。

基準（`main` @ `9ceea39`，M1 之前）：`npm test` 438 tests 中 3 失敗、`npm run lint` script 不存在、GitHub Actions workflow 無法解析。

decoration-tracker（只讀，未修改）：本 session 僅以 `gh api`／`gh repo view` 讀取其 `eslint.config.js`、`package.json`、`src/lib/db.ts` 作為重寫參考；未 clone、未 push、未封存。

## M1 Exit gate — Sean 覆審

| 項目 | 狀態 | 紀錄 |
|---|---|---|
| 合併清單（decoration-tracker → 本 repo） | 通過 | 2026-11-16 Sean 在 Claude Code session 中回覆：「合併清單覆審通過」 |
| 範圍與 UI（含 `PRD/UI-SPEC.md` v1.4、新增的工程地址欄位、schema v6、停用的 deploy job） | 通過 | 2026-11-16 Sean 在 Claude Code session 中回覆：「UI also approved」 |

## M1 Exit gate — 獨立驗收（2026-11-16）

由一個未參與開發、沒有開發脈絡的獨立驗收 agent 執行；只讀、未修改任何 repo。**Sean 的範圍與 UI 覆審不在此範圍內，仍待執行。**

- 驗收對象：`feat/m1` @ `11897e1`，全新 clone、`web/` 無既有 `node_modules`；Node v26.13.1（CI 為 Node 22，已在 PR 上綠燈）。
- 乾淨安裝重跑：`npm ci`、`npm run lint`（0 errors／4 warnings）、`npm run typecheck`、`npm test`（39 檔／620 tests）、`npm run build` 全部 exit 0。GOAL AC-006～AC-009 的根目錄指令結果與開發端一致。
- 測試抽查（AC-001、AC-003、AC-005）：斷言對應 AC 要求，不是空斷言。`git diff main -- web/src/__tests__` 無刪除測試、無 `.skip`／`.only`，3 個被替換的 `expect(` 都有一對一等價替代。

| 瀏覽器 smoke（內建瀏覽器、`npm run dev`） | 結果 | 觀察 |
|---|---|---|
| 變更單核准／拒絕 | PASS | 待決定時合計 0；核准後 +12,000；拒絕的 30,000 不計入；合約 1,000,000／已收 400,000 時調整後 1,012,000、待收 612,000；「本機紀錄，非屋主線上簽核」可見 |
| 驗收勾選 | PASS | 勾選後出現檢查日，區塊與階段列皆「驗收 1/2」；階段改已完成後兩處出現未通過警示 |
| 照片進度回報 | 空狀態 PASS；上傳部分驗證 | 空階段顯示「尚無照片」；工具無法操作原生檔案選擇器，改以 JS 把合成 PNG 放入表單的 file input 後，該階段顯示「1 張」與最新拍攝日 |
| 分享預設遮蔽個資 | PASS（地址未驗證） | 兩個選項預設未勾、警示可見；預設 payload 不含電話與聯絡方式，勾選後才含；唯讀頁 button／input 皆 0；三種竄改 hash 都顯示錯誤頁 |
| 重新整理後持久化 | PASS | 合約、變更單狀態與紀錄日、驗收與檢查日都保留 |
| 375px | PASS | 編輯頁與唯讀頁 `scrollWidth = clientWidth = 375`；逐元素檢查無未裁切溢出；變更單表單與分享對話框按鈕可點 |
| Console | PASS | 0 errors |

驗收者回報的缺陷與疑點（未修正，列給 Sean 覆審決定）：

1. **中（已修正）**：唯讀頁橫幅以純文字印出整條分享連結（約 4,750 字元），手機上要捲過約三個螢幕才看到內容。此橫幅為 M1 前既有行為（既有測試 `readonly-source-url` 鎖定），但 M1 加入更多區塊後連結變長，影響變明顯。修正：橫幅只顯示頁面網址加「（分享快照）」；375px 下橫幅高度由 2,488px 降為 117px（`Dashboard.address.test.tsx`）。
2. **中（已修正）**：「包含工程地址」在實際 App 中無法勾選：seed 工程沒有地址，M1 也沒有輸入地址的 UI，因此只有單元測試覆蓋。修正：工程總覽新增「填寫／編輯工程地址」（只存本機，清空即刪除欄位）；瀏覽器實測填寫後分享對話框的地址選項可勾、預設未勾，預設連結與唯讀頁都不含地址（`Dashboard.address.test.tsx`）。新增的地址區塊請一併於 UI 覆審確認。
3. **低**：分享快照的「快照產生時間」與分享對話框「建立日期」使用 UTC 且未標時區，台灣時間 00:00–08:00 產生的連結會差一天（既有行為）。
4. **低**：竄改的連結錯誤頁會露出瀏覽器原始英文例外訊息（既有行為）。
5. **低**：照片沒填說明時，照片進度回報以檔名代替說明，檔名可能含不想顯示的資訊。
6. **資訊**：`npm audit` 回報 17 個弱點（含 2 critical），未確認是否只影響 dev 相依。

## Codex 交叉審查（2026-11-22）

### 第 1 次：安全審查（astra, high）

- 範圍：`git diff 344da4d..c845d04`（M1 全部程式改動）。
- 帳號／模型：Zook 帳號「Waifdance」、`gpt-6.2-astra`、思考強度 high，約 134,922 token（Codex 預設帳號額度 0%，依規則跳過）。
- 結果：3 high、7 medium、3 low，全部判定為真問題並已修正（commit `d34cdfd`、`7e939e0`、`753b7c0`），每項都補了在舊程式上會失敗的測試。

| 嚴重度 | 問題 | 修正 | 測試 |
|---|---|---|---|
| High | 過期分頁可覆寫已核准的變更單或改回 pending | 編輯／決定改為在同一個 IndexedDB transaction 內讀取並檢查已存資料 | `staleTabs.test.tsx` |
| High | 取消個資勾選時網址列更新失敗，對話框仍可複製含個資的連結 | 勾選框與可複製連結一起更新；網址列失敗只顯示提示 | `Dashboard.shareDialog.test.tsx` |
| High | 載入時讀入其他工程的變更單與驗收；兩分頁可同時 seed 出兩個工程 | 只載入所選工程的資料；首次 seed 改為原子操作 | `staleTabs.test.tsx` |
| Medium | 過期分頁更新工程狀態會把已清除的地址寫回 | 工程更新合併進已存資料（transaction） | `staleTabs.test.tsx` |
| Medium | `0.0000001` 被當成 0 位小數；`1e307` 使總額變 Infinity | 小數位數先處理科學記號；金額上限 1e12 | 變更單／合約 domain 與表單測試 |
| Medium | v2 連結可在「不含聯絡方式」標示下夾帶個資 | v2 個資標示須與內容一致，否則顯示錯誤頁 | `shareDecode.hardening.test.ts` |
| Medium | 解碼器接受 0 金額、負合約、小數照片數、通過數大於總數、對不上的總額 | 金額、整數、`passed ≤ total`、總額一致性檢查 | `shareDecode.hardening.test.ts` |
| Medium | 超長工程期間的連結會讓唯讀頁凍結（v1 既有） | 解碼時限制約 10 年並驗證日期；甘特圖也加保護 | `shareDecode.hardening.test.ts` |
| Medium | 舊分頁持有 v5 時 v6 開啟直接失敗且被快取 | 等待舊分頁關閉、顯示提示、失敗不快取 | `changeOrders.db.test.ts` |
| Medium | 刪階段與刪驗收項目分兩個 transaction；過期分頁可對已刪階段新增項目 | 同一 transaction 刪除；新增時在 transaction 內檢查階段 | `staleTabs.test.tsx` |
| Low | 頁面已有 `#keep=1` 時產生的連結會開成編輯模式 | 改用 `buildShareUrl` | `Dashboard.shareDialog.test.tsx` |
| Low | 驗收勾選與刪除失敗時錯誤被吞掉 | 顯示錯誤並保留資料 | `Dashboard.writeErrors.test.tsx` |
| Low | CI 測試只比對整檔文字；v1 測試用現行 encoder 產生 fixture | 依 job 檢查指令與 deploy 停用；改用固定 v1 hash | `qualityGate.test.ts`、`shareDecode.hardening.test.ts` |

修正後本機（Node v26.13.1，`web/`）：`npm run lint` exit 0（0 errors、5 warnings）、`npm run typecheck` exit 0、`npm test` 44 檔／666 tests 全過、`npm run build` exit 0。

### 第 2 次：修正後的例行審查（sol, medium）— 未執行

- 2026-11-22 嘗試執行，所有 Codex 帳號額度低於 20%（預設帳號 0%、「Waifdance」19%），腳本結束碼 3，審查沒有執行。額度恢復後需補跑。

### 推送與 CI

- 2026-11-22 改用 `openclawsean024-create` 登入後推送成功。PR #2 的 GitHub Actions run `44926668704`（commit `7b74251`）：`lint`、`test`、`build` 皆 success，`deploy` skipped（停用）。

## 待確認事項（沿用 GOAL.md 寫法，本次未自行決定）

| 事項 | SPEC／GOAL 的寫法 | M1 的處理 |
|---|---|---|
| 產品名稱 | Notion／GOAL「裝修進度管理平台」vs 程式「裝修進度神器」，待確認 | README、使用說明、STATUS 沿用 GOAL 的「裝修進度管理平台」；App 畫面文字未更動（既有測試鎖定「裝修進度神器」）。待 Sean 決定後再統一 |
| 部署目標 | Vercel 或 GitHub Pages 待確認；GOAL 將部署目標調整列為 Out of scope | 未部署、未調整目標；CI 的 deploy job 保留但停用。正式網址未知 |
| 定價 | 「NT$2,000–5,000／案」僅為未驗證假設；M1 不做計費 | 未實作任何計費、方案或價格顯示 |
| 成功指標目標值 | SPEC §19：M2／M3 目標值待確認 | 未設定任何目標值；M1 指標僅為「AC 全數通過」與「合併清單 4/4」 |
| 屋主是否付費、變更單核准是否需法律效力 | 待確認；M1 明示「本機紀錄、非電子簽章」 | 畫面、README、使用說明皆標示為本機狀態紀錄，未實作電子簽章，也未宣稱法律效力 |
| decoration-tracker 封存與否 | 由 Sean 決定，不在 agent session 執行 | 未封存、未修改 |

## 風險與已知限制

- 資料僅存於單一裝置的 IndexedDB；清除瀏覽器資料即遺失，M1 無匯出／備份（FR-017，M2）。
- 分享 URL 未加密、不可撤銷、不會過期；M1 以「預設不含地址與聯絡方式」降低外洩面，撤銷需 FR-015。
- 分享 URL 長度隨資料量成長（階段、照片 metadata、變更單都在 hash 內）；未量測瀏覽器或通訊軟體的長度上限。
- M1 Exit gate 的獨立驗收已執行（見上方「M1 Exit gate — 獨立驗收」）。先前的開發者自測（2026-11-16，`npm run dev`，非獨立驗收）：新增並核准變更單 → 調整後總額 +12,000；新增驗收項目並勾選 → 檢查日自動填入、階段列顯示「驗收 1/1」；重新整理後資料仍在；分享對話框兩個個資選項預設未勾、產生的 snapshot 為 version 2 且不含地址；以該連結開啟唯讀頁，按鈕與輸入欄位數為 0；375×812 視窗下 `scrollWidth === clientWidth`，M1 區塊無元素超出右緣。
- 自測時發現並已修正：分享對話框加入個資選項後高度超過 768px 視窗，`.modal` 原為 `overflow: hidden` 導致「複製分享連結」被裁掉；已改為垂直捲動（`Dashboard.share.test.tsx` 有對應檢查）。
- 既有問題（非 M1 造成，未處理）：`.modal` 的 `padding` 為 0，所有對話框內容貼齊邊框；屬 UI polish 範圍，請於 UI 覆審時決定。
- `npm run lint` 目前有 4 個 `react-refresh/only-export-components` warning（既有 `store.tsx`、`PhotoPreview.tsx` 的匯出方式），不影響 exit code。

## 下一步

1. ~~Sean 覆審 M1 PR~~：已通過（2026-11-16，合併清單、範圍與 UI）。合併 PR #2 由 Sean 執行。
2. ~~由獨立驗收者執行 GOAL Exit gate~~：已完成（2026-11-16）；驗收者回報的兩個中度缺陷已修正，低度項目留待覆審決定。
3. 確認待確認事項（產品名稱、部署目標）；合併與 release 後同步 Notion。M2 與任何外部整合在 Exit gate 通過前不開始。
