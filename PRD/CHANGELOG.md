# CHANGELOG

## v5.0-M1 / 2026-11-16（分支 `feat/m1`，尚未合併）

- AC-007：修正 `Dashboard.schedule.test.tsx` 3 個時間相依測試（固定假時鐘）、新增 ESLint flat config 與 `lint` script、重寫 `.github/workflows/ci.yml`。
- FR-007／AC-001：預算變更單（新增、編輯、刪除、核准、拒絕），只有已核准計入調整後總額。
- FR-008／AC-002：合約金額與收款概要（原合約、已核准變更合計、調整後總額、已收、待收、溢收提示）。
- FR-009／AC-003：每階段可自訂的驗收清單，通過時自動記錄檢查日。
- FR-010／AC-004：依階段彙整的照片進度回報。
- FR-004／AC-005：分享 snapshot v2，納入上述摘要；地址與聯絡方式預設不分享。
- FR-011／AC-006：README、`docs/USER-GUIDE.md` 與 App 內「使用說明」。
- IndexedDB schema v5 → v6（僅新增 `changeOrders`、`contracts`、`acceptanceItems` 三個 store）。
- 以上功能自 decoration-tracker 依 `PRD/SPEC.md` §13 重寫，未搬入其 localStorage、seed、時間軸、mock 照片、靜態模板頁或 React 19／Tailwind 技術棧。

## v4.0 / 2026-09-20

- 將 FR-002～FR-006 補成可執行的 local-first MVP 規格，加入 domain model、使用者流程、acceptance criteria、測試要求與完整 Definition of Done。
- 明確定義 IndexedDB Blob 照片、URL hash 唯讀分享、本地提醒與非目標，避免實作者自行假造後端或雲端同步。
- FR-001 通過獨立驗收：96 個測試、瀏覽器 CRUD／持久化／Responsive／a11y smoke。
- FR-002 通過獨立驗收：143 個測試、瀏覽器合成照片上傳／篩選／預覽／重新整理持久化。
- FR-003 通過獨立驗收：218 個測試、瀏覽器預算 CRUD／浮點金額／超支警示／刪除取消與 production preview smoke。
- FR-004 通過獨立驗收：260 個測試、production share URL／唯讀模式／無效 hash／首 render IndexedDB 隔離與 key leakage guard。
- FR-005 通過獨立驗收：302 個測試、瀏覽器排程新增／完成切換／持久化資料呈現／刪除取消與含排程摘要的唯讀分享 smoke；另修正 AC-FR001-08 的非同步驗收等待競態。
- FR-006 通過獨立驗收：371 個測試、瀏覽器保固新增／有效中與 30 天警示／編輯／過期狀態／刪除取消與保固摘要唯讀分享 smoke。

## v3.1 / 2026-09-20

- 將 `PRD/SPEC.md` 補成可執行規格，加入 Phase 1 FR-001 的 domain model、UI 契約、acceptance criteria、non-goals 與測試閘門。
- 建立 MiniMax implementation contract，要求實作回報實際測試輸出與已知限制。

## v3.0.2 / 2026-09-19

- v3.0.2 scaffold initial commit
