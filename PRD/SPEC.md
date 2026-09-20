# 裝修進度神器 — 可執行產品規格

> 版本：v4.0 · 日期：2026-09-20
> 本文件是實作與驗收的 single source of truth。任何未在本文件定義的行為，實作者不得自行擴大產品範圍；需要改變契約時，先更新本文件與 acceptance criteria。

## 1. 產品定位與目標

室內裝修進行中，屋主、設計師與工班需要看到同一份工程進度、照片、預算與保固紀錄。本產品先以 local-first MVP 建立工程進度看板，再逐階段加入照片、預算、分享、排程與保固功能。

### 1.1 使用者

- **屋主**：查看自己的裝修工程進度與紀錄。
- **設計師**：建立工程、管理階段、更新進度。
- **工班**：查看被分派的階段，後續可上傳進度照片。

### 1.2 Product principles

- 進度資料要比聊天訊息更可靠：每個階段都有明確狀態與日期。
- local-first：在沒有後端或網路時，核心看板仍可使用。
- 所有重要狀態都要有可視化文字，不只依賴顏色。
- 第一階段優先完成可測試、可持續擴充的資料與 UI 契約，不先假造後端功能。

## 2. 技術與執行邊界

- 前端：Vite + React + TypeScript strict。
- 路由：沿用現有 `react-router-dom`；若單頁足以滿足需求，不得為了形式新增不必要路由。
- 儲存：FR-001 使用 IndexedDB；不得把主要工程資料只放在 React state、URL 或未持久化的記憶體。
- 後端：本地 MVP 不建立 API、資料庫或登入系統；所有核心資料以 IndexedDB 儲存。
- 檔案儲存：照片檔案以 IndexedDB Blob 儲存，提供可替換的 storage adapter；本階段不接 R2/S3，避免沒有後端時假造雲端同步。
- 分享：使用 URL hash 的唯讀 snapshot，不宣稱具有伺服器端撤銷、權限控管或即時同步能力。
- 提醒：使用瀏覽器本地提醒與頁面內 due/upcoming 清單；瀏覽器不允許通知時仍必須有頁面內提示。
- 測試：沿用 Vitest；可加入 React Testing Library/jsdom，但 `npm test -- --run` 必須可在乾淨安裝後執行。
- 瀏覽器：支援最新兩個版本的 Chrome、Safari、Edge；桌面與 375px 寬度以上的 mobile layout 不得出現頁面級水平捲軸。甘特圖可在自己的容器內水平捲動，以保留每日欄位可讀性。

## 3. Roadmap 與階段邊界

### Phase 1 — FR-001 工程進度看板

完成單一本機工作區中的示範工程、階段管理、狀態更新、日期視覺化、IndexedDB 持久化與測試。

### Phase 2 — FR-002 照片記錄

支援照片分類（before / progress / after）、階段關聯、說明、日期、縮圖與時間軸；照片 Blob 儲存在 IndexedDB，離線可讀取。

### Phase 3 — FR-003 預算追蹤

支援預算項目、分類、預算金額、實際金額、付款狀態、備註、合計與超支警示。

### Phase 4 — FR-004 唯讀分享

可從目前工程產生不含帳號的唯讀 URL hash snapshot；訪客只能查看分享當下的資料，不能寫回來源工程。

### Phase 5 — FR-005 師傅排程與提醒

支援工班／聯絡人、排程日期、關聯階段、聯絡方式與本地提醒；以頁面內提醒為保底，瀏覽器通知為 best-effort enhancement。

### Phase 6 — FR-006 保固紀錄

支援完工項目、保固起訖日、廠商／工班、聯絡方式、備註與即將到期／已過期狀態。

## 4. Domain model（Phase 1）

### 4.1 Project

```ts
type ProjectStatus = 'planning' | 'in_progress' | 'completed'

interface Project {
  id: string
  name: string
  address?: string
  status: ProjectStatus
  plannedStart: string // ISO date: YYYY-MM-DD
  plannedEnd: string   // ISO date: YYYY-MM-DD
  createdAt: string     // ISO datetime
  updatedAt: string     // ISO datetime
}
```

規則：`name` 不得為空；`plannedStart` 不得晚於 `plannedEnd`；新建工程預設 `planning`，當存在至少一個 `in_progress` 或 `completed` 階段時可由 UI 更新為 `in_progress`。

### 4.2 Stage

```ts
type StageStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked'

interface Stage {
  id: string
  projectId: string
  name: string
  order: number
  status: StageStatus
  plannedStart: string // ISO date: YYYY-MM-DD
  plannedEnd: string   // ISO date: YYYY-MM-DD
  actualStart?: string
  actualEnd?: string
  note?: string
  createdAt: string     // ISO datetime
  updatedAt: string     // ISO datetime
}
```

規則：`name` 不得為空；同一工程中的 `order` 必須唯一；`plannedStart` 不得晚於 `plannedEnd`；階段的計畫開始與結束日都必須落在所屬工程的 `plannedStart`～`plannedEnd`（含首尾）內；`completed` 階段必須有 `actualEnd`；切換成 `in_progress` 且沒有 `actualStart` 時，系統自動填入當天日期；切換成 `completed` 且沒有 `actualEnd` 時，系統自動填入當天日期；`blocked` 不得自動改變日期。

### 4.3 Seed data

第一次開啟且 IndexedDB 沒有資料時，建立一個示範工程「我的裝修工程」，並建立以下七個階段，依序排列：

1. 拆除
2. 水電
3. 泥作
4. 木作
5. 油漆
6. 安裝
7. 驗收

示範日期可以由實作者選定，但所有階段必須落在工程日期範圍內，且測試不得依賴當天日期造成不穩定。

### 4.4 PhotoRecord（FR-002）

```ts
type PhotoKind = 'before' | 'progress' | 'after'

interface PhotoRecord {
  id: string
  projectId: string
  stageId?: string
  kind: PhotoKind
  caption?: string
  takenOn: string // YYYY-MM-DD
  fileName: string
  mimeType: string
  blob: Blob
  createdAt: string
}
```

規則：只接受 `image/*`；單檔上限 10 MB；`caption` 可空；`takenOn` 必須是有效本地日期；刪除照片必須確認；縮圖不得改變原始 Blob。

### 4.5 BudgetItem（FR-003）

```ts
type PaymentStatus = 'unpaid' | 'partial' | 'paid'

interface BudgetItem {
  id: string
  projectId: string
  category: string
  name: string
  plannedAmount: number
  actualAmount: number
  paymentStatus: PaymentStatus
  note?: string
  createdAt: string
  updatedAt: string
}
```

規則：名稱與分類不得為空；金額為大於等於 0 的有限數字，最多兩位小數；`actualAmount > plannedAmount` 視為該項目超支；總實際金額超過總預算時顯示工程層級警示。

### 4.6 ScheduleItem（FR-005）

```ts
interface ScheduleItem {
  id: string
  projectId: string
  stageId?: string
  workerName: string
  phone?: string
  startOn: string
  endOn: string
  note?: string
  reminderOn?: string
  completed: boolean
  createdAt: string
  updatedAt: string
}
```

規則：工班名稱不得為空；開始日不得晚於結束日；若有 `stageId` 必須屬於同一工程；`reminderOn` 不得晚於 `startOn`；完成狀態可切換且持久化。

### 4.7 WarrantyRecord（FR-006）

```ts
interface WarrantyRecord {
  id: string
  projectId: string
  itemName: string
  provider: string
  contact?: string
  startsOn: string
  endsOn: string
  note?: string
  createdAt: string
  updatedAt: string
}
```

規則：項目、提供者不得為空；起始日不得晚於結束日；依本地今天顯示 `尚未開始`、`有效中` 或 `已過期`；刪除必須確認。

## 5. FR-001 工程進度看板

### 5.1 頁面與主要區塊

FR-001 的主要畫面為工程 dashboard，至少包含：

- 頁首：產品名稱、目前工程名稱、工程狀態。
- 工程摘要：工程日期範圍、階段總數、已完成數、進行中數、阻塞數、完成百分比。
- 階段清單：階段名稱、狀態、預計開始／結束日、備註、操作入口。
- 甘特圖：以日期為橫軸、以階段為列；每個階段顯示計畫期間。
- 新增階段按鈕與空資料狀態。

### 5.2 使用者操作

- 可以新增階段。
- 可以編輯階段名稱、狀態、計畫日期與備註。
- 可以刪除階段；刪除前必須有確認，取消不得改變資料。
- 可以依階段的 `order` 顯示；本 milestone 不要求拖曳排序。
- 可以切換工程狀態；狀態選項只能是 `planning`、`in_progress`、`completed`。
- 每次成功寫入後，摘要、清單與甘特圖必須立即反映新資料。
- 重新整理頁面後，資料仍必須存在。

### 5.3 完成百分比

```text
completedStageCount / totalStageCount * 100
```

四捨五入到整數；沒有階段時顯示 `0%`。不得用階段天數加權。

### 5.4 甘特圖計算

- 時間軸起點為工程 `plannedStart`，終點為工程 `plannedEnd`。
- 每一天是一個等寬欄位；跨越 N 天的階段 bar 寬度為 N 個欄位。
- 階段 bar 的左界對應 `plannedStart`，右界包含 `plannedEnd` 當天。
- 日期格式與時區使用本地日期字串 `YYYY-MM-DD`，不得因 UTC 轉換而前後偏移一天。
- 甘特圖需能顯示跨月日期；不可只用月份文字而失去日資訊。

## 6. Acceptance criteria（FR-001）

### AC-FR001-01 初始資料

**Given** 使用者第一次開啟且 IndexedDB 沒有工程資料
**When** dashboard 完成載入
**Then** 顯示「我的裝修工程」與七個 seed stages，摘要顯示總階段數 7、完成百分比 0%。

### AC-FR001-02 階段清單

**Given** 工程存在多個階段
**When** 使用者查看 dashboard
**Then** 每個階段都顯示名稱、狀態、計畫開始日與結束日，並依 `order` 排列。

### AC-FR001-03 新增階段

**Given** 使用者開啟新增階段表單
**When** 輸入有效名稱與日期並儲存
**Then** 新階段出現在清單與甘特圖，`order` 接在最後，摘要總數增加 1，且重新整理後仍存在。

### AC-FR001-04 表單驗證

**Given** 新增或編輯階段
**When** 名稱為空、開始日晚於結束日，或任一計畫日期超出工程日期範圍
**Then** 顯示可理解的錯誤文字、不可儲存，原有資料不變。

### AC-FR001-05 更新狀態

**Given** 使用者把階段狀態改為 `in_progress` 或 `completed`
**When** 儲存成功
**Then** 狀態文字、摘要計數、完成百分比與持久化資料同步更新；自動日期規則依 §4.2 執行。

### AC-FR001-06 甘特圖對齊

**Given** 階段的計畫日期落在工程日期範圍內
**When** 使用者查看甘特圖
**Then** bar 起點、終點與日期欄位符合 §5.4，且至少以自動化測試驗證跨月與單日階段。

### AC-FR001-07 編輯與刪除

**Given** 使用者編輯或刪除既有階段
**When** 操作完成並重新整理頁面
**Then** 編輯內容持久化；確認刪除才移除資料，取消刪除則資料完全不變。

### AC-FR001-08 空狀態

**Given** 工程沒有任何階段
**When** 使用者查看 dashboard
**Then** 顯示清楚的空狀態、`0%` 完成度與新增階段 CTA；頁面不得顯示 NaN、Infinity 或破損甘特圖。

### AC-FR001-09 Responsive 與可及性

**Given** viewport 寬度為 375px 或更寬
**When** 使用者查看與操作 dashboard
**Then** 主要操作可使用、不出現頁面級水平捲軸；甘特圖若超出 viewport，只能在甘特圖自己的容器內捲動；狀態不可只靠顏色辨識；互動元素有可理解的 accessible name。

### AC-FR001-10 離線持久化

**Given** 工程資料已儲存於 IndexedDB
**When** 使用者重新整理頁面，或在無網路狀態下重新開啟應用程式
**Then** 工程與階段資料仍可讀取與編輯；FR-001 不得依賴遠端 API 才能運作。

### AC-FR001-11 測試與品質閘門

**Given** 實作完成
**When** 在 `web/` 執行以下命令
**Then** 所有命令通過，且測試至少覆蓋 seed data、表單驗證、狀態摘要、甘特日期計算、持久化與刪除確認：

```bash
npm run typecheck
npm run build
npm test -- --run
```

## 7. FR-002 照片記錄

### 7.1 使用者操作

- dashboard 顯示照片區塊與「新增照片」CTA。
- 上傳表單必填照片、分類與日期，可選工程階段與說明。
- 照片清單可依分類篩選，顯示縮圖、檔名、日期、階段與說明。
- 點擊照片可開啟預覽；刪除前必須確認，取消不得改變資料。
- 依 `takenOn` 由新到舊顯示時間軸；沒有照片時顯示空狀態。

### 7.2 Acceptance criteria

#### AC-FR002-01 上傳與驗證

**Given** 使用者開啟新增照片表單
**When** 選擇 `image/*` 且檔案小於等於 10 MB，填入分類與有效日期後儲存
**Then** 照片 metadata 與 Blob 寫入 IndexedDB，清單顯示新照片與縮圖。

#### AC-FR002-02 無效檔案

**Given** 使用者選擇非圖片或超過 10 MB 的檔案
**When** 嘗試儲存
**Then** 顯示可理解的錯誤、不得寫入資料，既有照片不變。

#### AC-FR002-03 篩選與時間軸

**Given** 工程有不同分類與日期的照片
**When** 切換分類篩選或重新整理
**Then** 只顯示符合條件的照片，且時間軸排序與持久化資料一致。

#### AC-FR002-04 預覽與刪除

**Given** 使用者查看照片清單
**When** 開啟預覽、取消刪除或確認刪除
**Then** 預覽顯示原圖；取消保留資料；確認後照片、縮圖與 metadata 一併移除。

#### AC-FR002-05 測試

自動化測試必須覆蓋檔案驗證、IndexedDB Blob round-trip、分類篩選、排序與刪除確認。

## 8. FR-003 預算追蹤

### 8.1 使用者操作

- dashboard 顯示預算總額、實際支出、剩餘金額與超支狀態。
- 可新增、編輯、刪除預算項目；刪除必須確認。
- 預算項目可填分類、名稱、預算金額、實際金額、付款狀態與備註。
- 金額以目前使用者本地格式顯示，內部以 number 儲存，不得以浮點字串累加造成明顯誤差。
- 空清單顯示 `尚未建立預算項目` 與 CTA。

### 8.2 Acceptance criteria

#### AC-FR003-01 CRUD 與持久化

**Given** 使用者輸入有效預算項目
**When** 儲存並重新整理
**Then** 項目、合計與付款狀態持久化且畫面一致。

#### AC-FR003-02 金額驗證

**Given** 名稱／分類為空、金額為負數、非有限數字或超過兩位小數
**When** 嘗試儲存
**Then** 顯示欄位錯誤且不寫入資料。

#### AC-FR003-03 超支警示

**Given** 單項實際金額超過預算，或所有實際金額合計超過預算合計
**When** 查看預算區塊
**Then** 顯示文字化的超支警示、超支金額與對應項目。

#### AC-FR003-04 測試

自動化測試必須覆蓋合計、剩餘、付款狀態、金額驗證、超支與刪除確認。

## 9. FR-004 唯讀分享

### 9.1 分享契約

- 「產生唯讀分享」把目前工程的公開展示資料序列化為 versioned URL hash snapshot。
- snapshot 至少包含工程名稱、日期、工程狀態、階段摘要、甘特圖資料、照片 metadata（不含 Blob）、預算摘要、排程摘要與保固摘要。
- snapshot 不包含任何可編輯 token、私人檔案 Blob 或未來可推測的 IndexedDB key。
- 開啟含有效 snapshot 的 URL 時進入唯讀模式，所有新增、編輯、刪除與狀態切換操作都不顯示或不可用。
- 無效、過期格式或解析失敗的 snapshot 顯示錯誤空狀態，不得讓應用程式崩潰。

### 9.2 Acceptance criteria

#### AC-FR004-01 產生連結

**Given** 使用者在工程 dashboard
**When** 點擊產生分享連結並複製
**Then** 產生可重開的 URL，並提供複製成功或失敗的文字結果。

#### AC-FR004-02 唯讀呈現

**Given** 使用者開啟有效分享 URL
**When** 查看頁面
**Then** 可看到 snapshot 內容、明確的唯讀標示，且不能改變來源工程或本機 IndexedDB。

#### AC-FR004-03 內容與錯誤

**Given** snapshot 含照片 metadata、預算與排程摘要，或內容損壞
**When** 載入 snapshot
**Then** 有效資料完整顯示；損壞資料顯示可理解錯誤，不出現未捕捉例外。

#### AC-FR004-04 測試

自動化測試必須覆蓋 encode/decode round-trip、版本欄位、唯讀 guard 與無效 hash。

## 10. FR-005 師傅排程與提醒

### 10.1 使用者操作

- 可新增、編輯、刪除工班排程；刪除必須確認。
- 表單可選關聯階段，顯示工班名稱、電話、開始／結束日、提醒日、備註與完成狀態。
- 排程清單依開始日排序，顯示 `未開始`、`今日`、`進行中`、`已完成` 或 `逾期`。
- 提醒區塊列出 reminderOn 已到期或未來 7 天內的項目；頁面內提醒不依賴瀏覽器權限。
- 若使用者授權 Notification API，可在本地頁面開啟時發送一次通知；拒絕授權不得阻塞核心功能。

### 10.2 Acceptance criteria

#### AC-FR005-01 CRUD 與關聯

**Given** 使用者輸入有效排程
**When** 儲存並重新整理
**Then** 排程持久化、依日期排序，且關聯階段名稱正確顯示。

#### AC-FR005-02 日期與欄位驗證

**Given** 工班名稱為空、開始日晚於結束日、提醒日晚於開始日或關聯階段不存在
**When** 嘗試儲存
**Then** 顯示可理解錯誤且不寫入資料。

#### AC-FR005-03 提醒

**Given** 有到期或 7 天內的未完成排程
**When** 查看 dashboard
**Then** 顯示頁面內提醒；完成排程後不再列為待辦提醒。

#### AC-FR005-04 測試

自動化測試必須覆蓋排序、日期狀態、驗證、關聯與提醒篩選。

## 11. FR-006 保固紀錄

### 11.1 使用者操作

- 可新增、編輯、刪除保固紀錄；刪除必須確認。
- 顯示項目、提供者、聯絡方式、保固起訖日與備註。
- 依結束日排序，顯示 `尚未開始`、`有效中` 或 `已過期`。
- 顯示 30 天內到期的文字化警示；沒有紀錄時顯示空狀態與 CTA。

### 11.2 Acceptance criteria

#### AC-FR006-01 CRUD 與持久化

**Given** 使用者輸入有效保固紀錄
**When** 儲存並重新整理
**Then** 紀錄與計算出的狀態持久化且畫面一致。

#### AC-FR006-02 驗證與狀態

**Given** 項目／提供者為空或起始日晚於結束日
**When** 嘗試儲存
**Then** 顯示錯誤且不寫入；有效紀錄依本地今天正確顯示狀態。

#### AC-FR006-03 到期提醒與刪除

**Given** 有 30 天內到期或已過期紀錄
**When** 查看保固區塊、取消刪除或確認刪除
**Then** 顯示對應警示；取消保留資料；確認才移除資料。

#### AC-FR006-04 測試

自動化測試必須覆蓋日期狀態、30 天警示、驗證、排序與刪除確認。

## 12. 全產品 MVP non-goals

本規格完成前不得自行擴大到以下範圍：

- 登入、註冊、OAuth、角色權限、多人協作與伺服器端資料同步。
- R2/S3、Email、推播服務、行事曆雙向同步、付款與第三方 SaaS。
- 真正伺服器端分享、撤銷、存取權限與即時協作；FR-004 僅是 URL hash snapshot。
- 甘特圖拖曳調整、依賴關係、關鍵路徑與自動排程。
- 多工程切換、工程建立／刪除與帳號層級資料管理；沿用單一示範工程 workspace。

## 13. MiniMax implementation contract

每個 milestone task 必須引用本文件的 AC 編號。實作者：

- 只修改該 milestone 所需的 `web/` 程式碼、測試與必要設定，不得改寫規格以降低標準。
- 不得引入未經說明的後端、第三方 SaaS、假 API 或硬編輯器資料；本產品 MVP 使用 IndexedDB 與明確的 local adapter。
- 必須保留 strict TypeScript，補足 domain logic、持久化、UI interaction、錯誤狀態與 accessibility 測試。
- 每次回報列出修改檔案、完成的 AC、每個驗證命令的實際 exit code／摘要、已知限制與未完成項目。
- 若遇到規格矛盾或需要產品決策，先停下提出問題，不得自行猜測後擴大範圍。
- 每個 milestone 完成後，必須由獨立驗收者重跑 deterministic checks 與瀏覽器 smoke flow；未通過就退回同一 milestone 修正。

## 14. 完整產品 Definition of Done

只有以下條件全部成立，才可宣稱本地 MVP 開發完成：

1. FR-001～FR-006 所有 acceptance criteria、domain tests、UI interaction tests 都通過。
2. `npm run typecheck`、`npm run build`、`npm test -- --run` 在 `web/` 通過，且 `git diff --check` 通過。
3. 瀏覽器 smoke test 覆蓋新增／編輯／刪除確認／重新整理持久化、照片預覽、預算超支、分享唯讀、排程提醒、保固到期。
4. 375px 以上 viewport 沒有頁面級水平捲軸；主要互動元素具有可理解 accessible name；錯誤與空狀態可見。
5. 不存在未標示的假功能、console error、NaN/Infinity 或將資料寫入錯誤工程的情況。

Production deploy、HTTP 200 smoke 與 GitHub/Vercel/Notion 三向同步屬於 Integrator／人工作業，不在本開發 agent session 內執行；未完成前不得宣稱已上線。
