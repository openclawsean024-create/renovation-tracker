# CHANGELOG

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
