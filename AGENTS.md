# AGENTS.md — 裝修進度管理平台（renovation-tracker）開發合約

本檔是 `renovation-tracker` 的開發流程與驗收規則。workspace 層級的通用規則仍以父層 `../AGENTS.md` 為準；本檔補充本專案特有的規則。

## 1. 權威文件

| 文件 | 用途 |
|---|---|
| `PRD/SPEC.md` | 產品範圍、FR、非功能需求、個資處理、里程碑與合併清單的 single source of truth |
| `GOAL.md` | 目前里程碑（M1）的 Objective、AC、Out of scope、Exit gate |
| `SOP.md` | 實際可執行的驗證指令 |
| `STATUS.md` | 目前狀態、FR 對照、Notion 對應 |
| `PRD/UI-SPEC.md` | UI 視覺語言與響應式規格；UI 改動必須先遵循 |
| `PRD/FR-00x-MINIMAX-TASK.md`、`PRD/*-REPORT.md` | 歷次實作 brief 與驗收報告（歷史紀錄，不是現行規格） |
| `prototype/ui-polish-preview-v*.html` | UI review artifact；自包含、不修改正式 React |

任何程式碼改動都必須能對應到 `PRD/SPEC.md` 的 FR 或 `GOAL.md` 的 AC。規格要變更時，先改 SPEC／GOAL，再改程式。

## 2. 專案結構

```text
renovation-tracker/
├── AGENTS.md / GOAL.md / SOP.md / STATUS.md / README.md
├── PRD/                     # SPEC、UI-SPEC、CHANGELOG、歷次 MiniMax brief 與驗收報告
├── prototype/               # UI 原型 HTML（review 用）
├── .github/workflows/ci.yml # CI（目前 workflow 檔解析失敗，見 STATUS.md）
└── web/                     # 唯一的應用程式（npm 專案根目錄）
    ├── index.html
    ├── renovation-tracker.html   # 自包含互動預覽頁（非 React 入口）
    ├── vite.config.ts            # 含 vitest 設定（jsdom、src/test/setup.ts）
    └── src/
        ├── main.tsx / App.tsx    # App → AppShell（決定編輯模式或 #share= 唯讀模式）
        ├── components/           # Dashboard、各 Section／Form／Row、GanttChart、ReadOnlyView、Modal 等
        ├── store.tsx             # DashboardProvider：React context + IndexedDB 寫入
        ├── db.ts                 # IndexedDB（DB `renovation-tracker` schema v5）
        ├── types.ts              # Domain types 與 enum 常數
        ├── seed.ts               # 首次開啟的示範工程（固定參考日 2026-01-05）
        ├── validation.ts / budget.ts / photos.ts / schedule.ts / warranty.ts / status.ts
        ├── dates.ts / gantt.ts   # 本地日期與甘特計算
        ├── share.ts              # 唯讀分享 snapshot encode/decode（version 1）
        └── __tests__/            # Vitest + Testing Library 測試（25 檔）
```

## 3. 技術棧

- Vite 5、React 18、TypeScript 5（strict）、純 CSS（`src/index.css` design tokens）。
- 儲存：IndexedDB（照片 Blob 也存在 IndexedDB），無後端。
- 測試：Vitest 2、@testing-library/react、jsdom、fake-indexeddb。
- `react-router-dom` 已安裝但目前未使用路由；不得為了形式新增路由。
- Node：CI 設定為 22；本機最近一次驗證使用 v26.13.1。

## 4. 開發規則

1. **只用假資料**：seed、測試、文件、截圖與 PR 內容只能使用明顯的假資料，例如 `示範屋主`、`測試市示範路 1 號`、`0900-000-000`、`demo@example.com`。不得放入真實屋主姓名、地址、電話、施工照片或客戶資料。
2. **不得提交憑證**：不得 commit credentials、tokens、`.env`、`.env.local`、connection strings 或部署平台本機目錄。發現疑似憑證時停止並回報檔案路徑，不得複製內容。
3. **測試不可為了通過而刪改斷言**：不得刪除、`skip`、`only` 或放寬既有斷言讓測試變綠；時間相依測試要用 `vi.useFakeTimers()`／`vi.setSystemTime()` 或注入 today 修正。診斷用的暫時測試完成後要移除。
4. **local-first 邊界**：未經 SPEC 明確授權，不新增 backend、auth、雲端同步、R2／S3、金流或第三方資料服務。M1 一律 mock 或本機。
5. **分享邊界**：分享頁必須唯讀，不得洩漏 IndexedDB key、原始 record id 或照片 Blob；地址與聯絡方式預設不得放入分享 URL（GOAL AC-005）。
6. **併入規則**：decoration-tracker 只讀；要搬的功能依 `PRD/SPEC.md` §13 以本 repo 的 IndexedDB／store／validation 慣例重寫，不複製 localStorage 實作或其 seed 人名。
7. **需人審的變更**：DB schema migration、auth、payments、secrets、infra 刪除、部署目標變更，必須取得 risk approval 與 Sean 人審。
8. **UI 變更**：先更新 `PRD/UI-SPEC.md`，必要時先做 prototype 給 Sean 確認，再實作 React。

## 5. 代理協作流程

1. Planner：先把需求補進 SPEC／GOAL，寫清楚 AC 與驗證方式。
2. Developer：只改該 AC 所需的 `web/` 程式、測試與必要設定。
3. Deterministic checks：獨立重跑 `SOP.md` 的指令，不採信口頭回報；保留 command、輸出摘要與 exit code。
4. QA：逐條對照 AC，檢查持久化、空狀態、錯誤狀態、唯讀分享邊界與 accessibility，並做瀏覽器 smoke。
5. 失敗時回派：提供可重現的 command、實際輸出、exit code 與修正要求。

## 6. Git、push 與部署

- commit message：`<type>(scope): <FR/AC 或說明>`，例如 `feat(change-order): AC-001 add change orders`。
- 不在 agent session 內 merge PR、刪 branch、`git push --force`、修改 branch protection 或 rotate secrets；不直接 push 到 `main`。
- 部署目標待確認：舊版 AGENTS 記載 Vercel（Root `web`、Build `npm run build`、Output `dist`），但 `.github/workflows/ci.yml` 是 GitHub Pages deploy。確認前不得執行任何 production deploy。
- 每次 release（push 到 `main` 或部署）必須同步 Notion「可產品化商品」中本產品（裝修進度管理平台）的狀態；未同步前該 release 不算完成。
