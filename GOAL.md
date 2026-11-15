# Goal — 裝修進度管理平台 M1

## Objective

在 local-first、只用假資料、不接金流／雲端／真實個資的前提下，把 decoration-tracker 的預算變更單、合約收款與驗收清單併入主 repo，補上照片進度回報、強化屋主端分享連結，並完成 README 與使用說明，讓設計公司能用單一工程完整示範「進度 → 照片 → 追加減 → 驗收 → 分享給屋主」流程。

規格依據：[`PRD/SPEC.md`](./PRD/SPEC.md) v5.0 §12（FR-007～FR-011）、§10.2（FR-004 缺口）、§13（合併清單）。

## Acceptance criteria

所有指令在 `web/` 目錄執行，除非另外註明。「新增測試」指 M1 開發時要新增的檔案；不得以刪除或放寬既有斷言的方式讓測試通過。

- **AC-001：預算變更單（FR-007，自 decoration-tracker 搬入）**
  可新增、編輯（僅 pending）、刪除（需確認）、核准、拒絕變更單，資料存於 IndexedDB 並在重新整理後保留；標題空白、金額為 0、非有限數字或超過兩位小數時顯示錯誤且不寫入；只有 approved 計入調整後總額；畫面標示「本機紀錄，非屋主線上簽核」。
  驗證：新增 `src/__tests__/changeOrders.test.ts`（驗證與加總規則）、`src/__tests__/changeOrders.db.test.ts`（IndexedDB round-trip）、`src/__tests__/Dashboard.changeOrders.test.tsx`（新增／核准／拒絕／取消刪除／重新掛載後持久化）；執行 `npm test -- changeOrders` exit 0。

- **AC-002：合約金額與收款概要（FR-008，自 decoration-tracker 搬入）**
  可編輯合約金額與已收金額（≥ 0、最多兩位小數），顯示原合約、已核准變更合計、調整後總額、已收、待收；待收為負時顯示「溢收」文字；資料與 FR-003 成本預算分開儲存。
  驗證：新增 `src/__tests__/contract.test.ts`（含核准／拒絕變更單對總額的影響、溢收、無效金額）與 Dashboard 互動測試；執行 `npm test -- contract` exit 0。

- **AC-003：階段驗收清單（FR-009，自 decoration-tracker 搬入）**
  每個階段可新增、編輯、刪除（需確認）驗收項目並切換通過；通過時自動記錄檢查日；階段列顯示「驗收 x/y」；`completed` 階段仍有未通過項目時顯示文字警示。
  驗證：新增 `src/__tests__/acceptance.test.ts`、`src/__tests__/acceptance.db.test.ts`、`src/__tests__/Dashboard.acceptance.test.tsx`；執行 `npm test -- acceptance` exit 0。

- **AC-004：照片進度回報（上市前要補：照片進度回報）**
  依階段 `order` 彙整照片：每階段顯示照片數、最新拍攝日、最新縮圖與說明；未關聯階段歸入「未分類」；無照片階段顯示「尚無照片」；不接任何雲端儲存。
  驗證：新增 `src/__tests__/photoReport.test.ts`（分組、排序、未分類、空階段）與 `src/__tests__/Dashboard.photoReport.test.tsx`；執行 `npm test -- photoReport` exit 0。

- **AC-005：屋主端分享連結強化（上市前要補：屋主端分享連結）**
  分享 snapshot 新增變更單（標題、金額、狀態）、合約收款概要、驗收進度與每階段照片數／最新拍攝日；預設**不含**工程地址、工班電話、保固聯絡方式，需在分享對話框明確勾選才放入，並顯示「連結未加密、無法撤銷」提示；仍不含 Blob 與 IndexedDB key；既有 version 1 連結仍可開啟，或顯示可理解的版本錯誤而不崩潰。
  驗證：擴充 `src/__tests__/share.test.ts`（新欄位 round-trip、預設遮蔽、勾選後才含個資、key／Blob 不外洩、舊版本 hash）與 `src/__tests__/Dashboard.share.test.tsx`（唯讀頁無編輯控制、顯示新區塊）；執行 `npm test -- share` exit 0。

- **AC-006：README 與使用說明（上市前要補：補 README 與使用說明）**
  `README.md` 含：產品說明、功能與狀態、本機啟動、驗證命令、資料存放（local-first，清除瀏覽器資料會遺失）、分享限制、假資料規則、文件索引；新增 `docs/USER-GUIDE.md`，含業者端與屋主端操作步驟；App 內有「使用說明」入口。
  驗證：在 repo 根目錄執行
  `for h in '## 功能' '## 本機啟動' '## 驗證' '## 資料存放' '## 分享限制' '## 假資料'; do grep -q "$h" README.md || echo "missing $h"; done` 無輸出；
  `grep -q '## 業者端' docs/USER-GUIDE.md && grep -q '## 屋主端' docs/USER-GUIDE.md` exit 0；
  新增測試確認 Dashboard 有 accessible name 為「使用說明」的連結或按鈕，`npm test -- help` exit 0。

- **AC-007：品質閘門與 CI**
  修正 `Dashboard.schedule.test.tsx` 3 個依賴系統時鐘的測試（以 `vi.useFakeTimers`／`vi.setSystemTime` 或注入 today），斷言內容不得減少；參考 decoration-tracker `eslint.config.js` 新增 `lint` script；修正 `.github/workflows/ci.yml`（workflow 可解析、`working-directory: web`、lockfile 路徑 `web/package-lock.json`）。
  驗證：`npm run lint && npm run typecheck && npm test && npm run build` 全部 exit 0；`git diff main -- web/src/__tests__/Dashboard.schedule.test.tsx | grep -c '^-.*expect('` 等於 0（或每一個被刪的 `expect(` 都有等價替代並在 PR 說明）；M1 PR 上 GitHub Actions 的 lint、test、build job 綠燈（`gh pr checks` 顯示 pass）。

- **AC-008：假資料與憑證安全**
  seed、測試、文件與截圖只使用明顯假資料；不搬入 decoration-tracker 的「林宅／林先生林太太」seed；repo 中無 `.env`、token 或金鑰。
  驗證：在 repo 根目錄執行
  `git grep -nE '林先生|林太太|ghp_|AKIA|sk-[A-Za-z0-9]{16}|BEGIN (RSA|EC|OPENSSH) PRIVATE KEY' -- . ':!PRD/SPEC.md' ':!GOAL.md' ':!SOP.md'` 無輸出；
  `git ls-files | grep -E '(^|/)\.env'` 無輸出。

- **AC-009：合併完成對照**
  `STATUS.md` 的合併清單中，M1 四項（變更單、合約收款、驗收清單、lint 設定）都標為「已搬入」並附對應測試檔名；FR 對照表更新為實際狀態；decoration-tracker 未被修改、封存或刪除。
  驗證：`grep -c '已搬入' STATUS.md` ≥ 4；`gh repo view openclawsean024-create/decoration-tracker --json isArchived --jq .isArchived` 輸出 `false`。

## Out of scope

- 真實金流、訂閱扣款、發票與任何計費實作（FR-016；M2 才以 mock／測試模式呈現方案）。
- 真實雲端照片儲存與同步（R2／S3 等）、後端 API、資料庫、登入與角色權限。
- 真實屋主個資、真實地址、真實電話與真實施工照片；所有資料以假資料或合成圖片處理。
- 伺服器端分享、撤銷、到期與屋主線上簽核（FR-015）。
- 多案件管理（FR-012，M2）、資料匯出（FR-017，M2）、Email／LINE 通知。
- Production deploy、Vercel／GitHub Pages 部署目標調整、Notion release 同步。
- 封存、改名或刪除 decoration-tracker。

## Exit gate

M1 完成前需由 Sean 覆審範圍與 UI，並由獨立驗收者在乾淨安裝後重跑 `npm ci && npm run lint && npm run typecheck && npm test && npm run build` 與瀏覽器 smoke（變更單核准、驗收勾選、照片進度回報、分享預設遮蔽個資、重新整理後持久化、375px 無頁面級水平捲軸），全部通過且 AC-001～AC-009 逐條有證據後，才可進入 M2 或任何外部整合。
