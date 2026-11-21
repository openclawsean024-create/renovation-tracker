# 裝修進度管理平台 — 產品規格（PRD）

> 版本：v5.1（M1 實作後同步功能狀態；需求內容與 v5.0 相同）· 日期：2026-11-16
> 主 repo：`openclawsean024-create/renovation-tracker`（預設分支 `main`）
> 併入來源：`openclawsean024-create/decoration-tracker`（只讀，見 §13 合併清單）
> 商業依據：Notion 資料庫「可產品化商品」（產品名稱「裝修進度管理平台」、P2、開發順位第 7）。
> 本文件是產品範圍、功能需求與驗收的 single source of truth。v4.0 中仍正確的 FR-001～FR-006 domain model 與 acceptance criteria 保留於 §6～§11。
> 功能狀態以 2026-11-16 實際讀取程式碼與執行測試為準，README 或舊文件與程式不一致時以程式為準（見 §14）。

---

## 1. 問題

室內裝修期間，屋主、設計公司與工班之間的資訊多半散落在 LINE 群組、紙本與 Excel：

- 屋主不知道工程進行到哪個階段、下一步是什麼，只能反覆詢問。
- 施工照片在群組中被訊息淹沒，事後難以依階段回查。
- 追加減（預算變更）多為口頭同意，沒有留下核准紀錄，完工結算容易起爭議。
- 驗收常只憑師傅口頭說明，沒有逐項清單。
- 保固起訖與廠商聯絡方式在完工後散失。

本產品要讓設計公司與統包商以一份可信的工程紀錄（階段、照片、預算與變更、驗收、保固）管理案件，並以分享連結讓屋主隨時查看。

## 2. 目標客群

| 客群 | 角色 | 主要任務 | 付費者 |
|---|---|---|---|
| 室內設計公司 | 主要使用者（Primary） | 建立案件、維護階段與進度、上傳照片、發出變更單、分享給屋主 | 是（SaaS 訂閱） |
| 裝修統包商 | 主要使用者（Primary） | 同上，並管理工班排程與保固 | 是（SaaS 訂閱） |
| 屋主 | 次要使用者（Secondary） | 透過分享連結查看進度、照片、預算變更與驗收；核准或拒絕變更 | 否（由業者付費，待確認） |
| 工班／師傅 | 協作者 | 查看被分派的階段與排程，回報進度照片（M2 之後） | 否 |

## 3. 獲利模式

- **模式**：SaaS 訂閱（Notion「可產品化商品」記載）；獲利潛力：中。
- **計費對象**：設計公司／統包商（B2B），屋主端免費查看（待 Sean 確認）。
- **計價單位候選**：每帳號月費、或依進行中案件數計價。decoration-tracker 的 `GOAL.md` 曾寫「NT$2,000–5,000／案」，此為內部假設，未經市場驗證，**價格待確認**。
- **計費實作時程**：M1 不做計費；M2 以 mock／測試模式建立方案與用量限制；M3 才接真實金流，且需 risk approval 與人審（見 §12）。

## 4. 競品與差異

> 以下競品名稱為業界常見類別，功能、價格與市場規模均**待確認**，本文件不引用未查證數字。

| 類別 | 代表 | 對方強項（待確認） | 本產品差異 |
|---|---|---|---|
| 現況替代方案 | LINE 群組 + Excel／紙本 | 零成本、屋主熟悉 | 依階段結構化紀錄、變更單核准留痕、驗收清單 |
| 國際營建／住宅工程管理 SaaS | 例如 Procore、Buildertrend（待確認功能與價格） | 功能完整、多角色、雲端協作 | 繁中、針對台灣住宅裝修流程（拆除／水電／泥作／木作／油漆）、輕量、屋主分享免登入 |
| 台灣本地裝修管理工具 | 待確認（尚未調查） | 待確認 | 待確認 |
| 通用專案管理工具 | 例如 Trello、Notion（待確認是否有裝修模板） | 彈性高 | 內建裝修 domain：甘特、預算超支、變更單、保固到期 |

差異化主張（待驗證）：**「裝修進度像包裹追蹤一樣清楚」**——屋主只開一個連結就能看懂進度、照片與待核准的追加減。

## 5. 功能需求總表

狀態定義：**已實作**＝主 repo 程式與測試存在且通過；**部分**＝有部分程式或只存在於 decoration-tracker 雛形；**未實作**＝無程式。

| FR | 名稱 | 優先 | 狀態 | 所在 repo | 里程碑 | 說明 |
|---|---|---|---|---|---|---|
| FR-001 | 工程進度看板（階段 CRUD、狀態、摘要、甘特圖） | P0 | 已實作 | renovation-tracker | 既有 | §6 |
| FR-002 | 照片記錄（上傳、分類、階段關聯、預覽、刪除） | P0 | 已實作 | renovation-tracker（decoration-tracker 僅有 mock SVG 版） | 既有 | §7 |
| FR-003 | 預算追蹤（預算項目、實際金額、付款狀態、超支） | P0 | 已實作 | renovation-tracker | 既有 | §8 |
| FR-004 | 屋主端唯讀分享連結（URL hash snapshot） | P0 | 已實作（M1 強化；撤銷／到期屬 FR-015） | renovation-tracker | M1 強化／M2 伺服器端 | §10；M1 已改為預設不含地址與聯絡方式，並納入變更單、收款、驗收與照片回報摘要；仍無撤銷 |
| FR-005 | 師傅排程與提醒 | P1 | 已實作（時間相依測試已於 M1 以固定時鐘修正） | renovation-tracker | M1 修測試 | §11 |
| FR-006 | 保固紀錄 | P1 | 已實作 | renovation-tracker | 既有 | §11 |
| FR-007 | 預算變更單（追加減）與屋主核准／拒絕 | P0 | 已實作（M1；核准為本機紀錄，屋主線上核准屬 FR-015） | renovation-tracker（自 decoration-tracker 雛形重寫） | M1 | §12.1 |
| FR-008 | 合約金額與收款概要（總額／已收／待收） | P1 | 已實作（M1） | renovation-tracker（自 decoration-tracker 雛形重寫） | M1 | §12.2 |
| FR-009 | 階段驗收清單 | P0 | 已實作（M1） | renovation-tracker（自 decoration-tracker 雛形重寫） | M1 | §12.3 |
| FR-010 | 照片進度回報（依階段彙整照片與最新進度） | P0 | 已實作（M1；未預留 `PhotoStorageAdapter`，M2 再評估） | renovation-tracker | M1 | §12.4 |
| FR-011 | README 與使用說明 | P0 | 已實作（M1） | renovation-tracker | M1 | §12.5 |
| FR-012 | 多案件管理（案件列表、建立、封存） | P1 | 部分 | decoration-tracker（列表 UI 只讀 seed，無建立） | M2 | 主 repo 目前為單一示範工程 |
| FR-013 | 帳號與角色權限（業者／工班／屋主） | P1 | 未實作 | — | M2 設計、M3 上線 | 需 risk approval |
| FR-014 | 雲端同步與照片雲端儲存 | P1 | 未實作 | — | M2 mock adapter、M3 真實 | 需 risk approval |
| FR-015 | 伺服器端分享（可撤銷、可設到期、屋主線上核准） | P1 | 未實作 | — | M3 | 依 FR-013、FR-014 |
| FR-016 | 計費與訂閱方案 | P1 | 未實作 | — | M2 mock、M3 真實金流 | 需 risk approval |
| FR-017 | 資料匯出與備份（JSON／PDF 報告） | P2 | 未實作 | — | M2 | |
| FR-018 | 外部通知（Email／LINE） | P2 | 未實作 | — | M3 之後 | 需 risk approval |

## 6. 技術與執行邊界（主 repo 現況）

- 前端：Vite 5 + React 18 + TypeScript strict（`web/`）。`react-router-dom` 已列為依賴，但目前畫面以單頁 + 區段錨點（`#overview`、`#timeline`、`#photos`、`#budget`、`#schedule`、`#warranties`）與 `#share=` hash 運作。
- 儲存：IndexedDB（DB 名稱 `renovation-tracker`，schema v6：projects、stages、photos、budgets、schedules、warranties，M1 新增 changeOrders、contracts、acceptanceItems；v5 → v6 僅新增 store）。照片以 Blob 存於 IndexedDB。
- 後端：無。M1 不新增 API、資料庫、登入或第三方服務。
- 分享：URL hash 的 versioned snapshot（`SHARE_SNAPSHOT_VERSION = 2`，仍可開啟 version 1 連結），不含 Blob 與 IndexedDB key；不具伺服器端撤銷、權限或即時同步能力。
- 提醒：頁面內提醒為保底，瀏覽器 Notification 為 best-effort。
- 測試：Vitest + Testing Library + jsdom + fake-indexeddb；`src/__tests__/` 於 M1 後共 39 個測試檔（v5.0 盤點時為 25 個）。
- 瀏覽器：最新兩版 Chrome、Safari、Edge；375px 以上不得出現頁面級水平捲軸，甘特圖可在自身容器內水平捲動。

### 6.1 Domain model（既有，保留）

```ts
type ProjectStatus = 'planning' | 'in_progress' | 'completed'
interface Project {
  id: string; name: string; address?: string; status: ProjectStatus
  plannedStart: string; plannedEnd: string // YYYY-MM-DD
  createdAt: string; updatedAt: string
}

type StageStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked'
interface Stage {
  id: string; projectId: string; name: string; order: number; status: StageStatus
  plannedStart: string; plannedEnd: string; actualStart?: string; actualEnd?: string
  note?: string; createdAt: string; updatedAt: string
}

type PhotoKind = 'before' | 'progress' | 'after'
interface PhotoRecord {
  id: string; projectId: string; stageId?: string; kind: PhotoKind; caption?: string
  takenOn: string; fileName: string; mimeType: string; blob: Blob; createdAt: string
}

type PaymentStatus = 'unpaid' | 'partial' | 'paid'
interface BudgetItem {
  id: string; projectId: string; category: string; name: string
  plannedAmount: number; actualAmount: number; paymentStatus: PaymentStatus
  note?: string; createdAt: string; updatedAt: string
}

interface ScheduleItem {
  id: string; projectId: string; stageId?: string; workerName: string; phone?: string
  startOn: string; endOn: string; note?: string; reminderOn?: string; completed: boolean
  createdAt: string; updatedAt: string
}

interface WarrantyRecord {
  id: string; projectId: string; itemName: string; provider: string; contact?: string
  startsOn: string; endsOn: string; note?: string; createdAt: string; updatedAt: string
}
```

規則（摘要，完整規則見各 FR 章節）：

- Project：`name` 不得為空；`plannedStart` 不得晚於 `plannedEnd`；狀態只能是 `planning`／`in_progress`／`completed`。
- Stage：`name` 不得為空；同工程 `order` 唯一；計畫日期須落在工程日期範圍內；切到 `in_progress` 且無 `actualStart` 時自動填今天；切到 `completed` 且無 `actualEnd` 時自動填今天；`blocked` 不改日期。
- Seed：首次開啟且無資料時建立示範工程「我的裝修工程」與七個階段（拆除、水電、泥作、木作、油漆、安裝、驗收），日期由固定參考日 `2026-01-05` 推算，不依賴系統時鐘。

## 7. FR-001 工程進度看板（已實作）

- Dashboard 顯示產品名稱、工程名稱、工程狀態、日期範圍、階段總數／已完成／進行中／阻塞、完成百分比。
- 階段清單與甘特圖兩種檢視；可新增、編輯、刪除（刪除需確認，取消不變更資料）。
- 完成百分比＝`completedStageCount / totalStageCount * 100` 四捨五入；無階段時為 `0%`；不以天數加權。
- 甘特圖：每日一欄，起訖含首尾；使用本地日期字串，不得因 UTC 偏移一天；可跨月。
- 驗收（AC-FR001-01～11，v4.0 原文保留於 git 歷史 `9ceea39:PRD/SPEC.md`）：初始資料、清單排序、新增、表單驗證、狀態更新與自動日期、甘特對齊、編輯刪除、空狀態、responsive 與 a11y、離線持久化、品質閘門。
- 對應測試：`Dashboard.test.tsx`、`validation.test.ts`、`gantt.test.ts`、`dates.test.ts`、`seed.test.ts`、`db.test.ts`、`status.test.ts`、`accessibility.test.tsx`、`Dashboard.navigation.test.tsx`。

## 8. FR-002 照片記錄（已實作）

- 只接受 `image/*`，單檔上限 10 MB；分類 before／progress／after；可關聯階段、說明、拍攝日。
- 依 `takenOn` 新到舊顯示；可依分類篩選；可預覽原圖；刪除需確認。
- 驗收：AC-FR002-01 上傳與驗證、02 無效檔案、03 篩選與時間軸、04 預覽與刪除、05 測試。
- 對應測試：`photos.test.ts`、`photos.db.test.ts`、`Dashboard.photos.test.tsx`。

## 9. FR-003 預算追蹤（已實作）

- 預算項目 CRUD：分類、名稱、預算金額、實際金額、付款狀態、備註；刪除需確認。
- 金額為 ≥ 0 的有限數字、最多兩位小數；顯示總預算、實際支出、剩餘與超支警示（單項與總額）。
- 驗收：AC-FR003-01 CRUD 與持久化、02 金額驗證、03 超支警示、04 測試。
- 對應測試：`budget.test.ts`、`budgets.db.test.ts`、`Dashboard.budget.test.tsx`。
- 注意：FR-003 是「業者自己的成本預算」，與 FR-008「對屋主的合約金額與收款」是不同概念，M1 實作時不得混用同一資料表。

## 10. FR-004 屋主端唯讀分享連結（部分）

### 10.1 已實作

- 「產生唯讀分享」將工程序列化為 versioned URL hash（`#share=`），含工程、階段、甘特、照片 metadata（不含 Blob）、預算摘要、排程摘要、保固清單與摘要。
- snapshot 以 `stage-N`、`photo-N`、`warranty-N` 取代 IndexedDB key；開啟分享 URL 時不掛載 IndexedDB provider，所有編輯控制不可用。
- 無效、未知版本或損壞的 hash 顯示錯誤狀態，不崩潰。
- 對應測試：`share.test.ts`、`Dashboard.share.test.tsx`。

### 10.2 缺口（M1 補）

> M1 實作狀態（2026-11-16）：前兩項已補（GOAL AC-005）；第三項仍屬 FR-015，未實作也未宣稱具備。

- snapshot 若工程有 `address` 會一併放入 URL；保固 `contact` 也會放入 URL。URL hash 未加密，任何拿到連結的人都能讀取 → M1 改為**預設不含地址與聯絡方式**，需使用者明確勾選才放入。
- snapshot 未含 FR-007 變更單、FR-008 收款概要、FR-009 驗收清單、FR-010 照片進度回報摘要。
- 無撤銷、到期與屋主線上核准能力 → 屬 FR-015（M3），M1 不得宣稱具備。

## 11. FR-005 師傅排程與提醒、FR-006 保固紀錄（已實作）

- FR-005：工班名稱、電話、起訖日、關聯階段、提醒日、備註、完成狀態；依開始日排序並顯示未開始／今日／進行中／已完成／逾期；頁面內提醒列出到期或 7 天內未完成項目；Notification API 為 best-effort。對應測試：`schedule.test.ts`、`schedules.db.test.ts`、`Dashboard.schedule.test.tsx`。
  - **已知問題（M1 已修正，AC-007）**：`Dashboard.schedule.test.tsx` 有 3 個測試寫死 `2026-09-25`～`2026-09-30` 的提醒日期並依賴系統時鐘，2026-11-16 執行時失敗。M1 須以 fake timers 或注入 today 修正，不得刪除或放寬斷言。
- FR-006：項目、提供者、聯絡方式、保固起訖、備註；依結束日排序，顯示尚未開始／有效中／已過期；30 天內到期警示。對應測試：`warranty.test.ts`、`warranties.db.test.ts`、`Dashboard.warranty.test.tsx`。

## 12. M1 新增功能規格

### 12.1 FR-007 預算變更單（追加減）與核准

```ts
type ChangeOrderStatus = 'pending' | 'approved' | 'rejected'
interface ChangeOrder {
  id: string; projectId: string; stageId?: string
  title: string          // 不得為空
  amount: number         // 可為負數（追減），有限數字、最多兩位小數、不得為 0
  material?: string; note?: string
  status: ChangeOrderStatus   // 新建一律 pending
  decidedOn?: string          // 核准或拒絕當天（YYYY-MM-DD）
  createdAt: string; updatedAt: string
}
```

- 新增、編輯（僅 pending 可編輯）、刪除（需確認）、核准、拒絕；已決定的變更單不可再改金額。
- 只有 `approved` 計入合約調整後總額；`pending` 與 `rejected` 不計入（修正 decoration-tracker 雛形「新增時就直接加進總額」的行為）。
- M1 中「核准／拒絕」由業者在本機代為記錄屋主決定，畫面須標示「本機紀錄，非屋主線上簽核」；屋主線上核准屬 FR-015。

### 12.2 FR-008 合約金額與收款概要

```ts
interface ContractSummaryInput {
  projectId: string
  contractAmount: number   // ≥ 0，最多兩位小數
  receivedAmount: number   // ≥ 0，最多兩位小數
}
// 計算值：adjustedTotal = contractAmount + Σ approved ChangeOrder.amount
//         outstanding  = adjustedTotal - receivedAmount（可為負＝溢收，需文字提示）
```

- 可編輯合約金額與已收金額；顯示原合約、已核准變更合計、調整後總額、已收、待收。
- 收款紀錄明細（分期）不在 M1，M2 再評估。

### 12.3 FR-009 階段驗收清單

```ts
interface AcceptanceItem {
  id: string; projectId: string; stageId: string
  name: string           // 不得為空
  passed: boolean
  checkedOn?: string     // passed 切換為 true 時自動填當天
  note?: string; createdAt: string; updatedAt: string
}
```

- 每個階段可新增、編輯、刪除（需確認）驗收項目並切換通過／未通過。
- 階段列與摘要顯示「驗收 x/y」；階段標記 `completed` 但仍有未通過項目時顯示文字警示（不阻擋儲存）。

### 12.4 FR-010 照片進度回報

- 依階段（`order` 排序）彙整 FR-002 照片：每階段顯示照片數、最新拍攝日、最新一張縮圖與說明；未關聯階段的照片歸入「未分類」；無照片階段顯示「尚無照片」。
- 分享 snapshot 只放每階段的照片數與最新拍攝日（metadata），不放 Blob；分享頁須說明「照片原圖僅存於業者裝置，雲端照片分享規劃於後續版本」。
- 不接任何雲端儲存；為 M2 預留 `PhotoStorageAdapter` 介面時只允許本機 IndexedDB 與測試用 mock 實作。

### 12.5 FR-011 README 與使用說明

- `README.md`：產品一句話說明、功能清單與狀態、本機啟動、驗證命令、資料存放位置（local-first、清除瀏覽器資料會遺失）、分享連結限制、假資料規則、文件索引。
- `docs/USER-GUIDE.md`：業者端（建立階段、上傳照片、預算、變更單、驗收、排程、保固、產生分享）與屋主端（開啟連結、看懂各區塊、限制說明）操作步驟。
- App 內提供「使用說明」入口（連到使用說明內容或對應區段）。

## 13. 合併清單（decoration-tracker → renovation-tracker）

decoration-tracker 實際程式（2026-11-16 讀取 `main` @ `26cff11`）：Vite 6 + React 19 + React Router 7 + Tailwind v4；資料存於 localStorage（`decoration-tracker:db`）與 IndexedDB（`decoration-photos`）；四頁：Dashboard（訂單列表＋7 階段進度條）、Photos（新增 mock SVG）、Budget（總額／已收／待收＋變更單核准拒絕）、Acceptance（4 項驗收 toggle）。

### 13.1 要搬進主 repo（主 repo 尚無）

| # | 來源模組 | 搬入方式 | 對應 FR | 里程碑 |
|---|---|---|---|---|
| 1 | `lib/db.ts` 的 `BudgetChange`、`addBudgetChange`、`approveBudget`、`rejectBudget` + `pages/BudgetPage.tsx` 變更清單 | 以主 repo 的 IndexedDB／store／validation 慣例重寫，不沿用 localStorage；補金額驗證與「只有核准才計入總額」規則 | FR-007 | M1 |
| 2 | `Project.total`／`Project.paid` 與 BudgetPage 的「總額／已收／待收」 | 重寫為獨立的合約收款資料（與 FR-003 成本預算分開） | FR-008 | M1 |
| 3 | `AcceptanceItem` + `toggleAcceptance` + `pages/AcceptancePage.tsx` | 改為「每階段可增刪的驗收項目」，加上檢查日與備註 | FR-009 | M1 |
| 4 | `web/eslint.config.js`（ESLint v9 flat config + typescript-eslint） | 參考後在主 repo 補 `lint` script（主 repo CI 已呼叫 `npm run lint` 但 script 不存在） | 品質閘門 | M1 |
| 5 | `pages/DashboardPage.tsx` 訂單列表（多案件卡片、客戶名、金額、進度條） | 作為多案件管理的 UI 參考；需先改主 repo 單一工程架構 | FR-012 | M2 |

### 13.2 不搬

| 來源 | 原因 |
|---|---|
| 7 階段時間軸、`advanceStage`、`progressOf` | 主 repo FR-001 已有完整階段 CRUD、狀態與甘特；且 `progressOf` 把「目前階段」也算成已完成（`completedStages.length + 1`），進度會高估 |
| `lib/photoStore.ts`、`pages/PhotosPage.tsx` | 只能新增寫死的 SVG data URL，無真實上傳；主 repo FR-002 已有 Blob 上傳、驗證、分類與預覽 |
| `lib/db.ts` localStorage 持久化 | 主 repo 以 IndexedDB 為唯一儲存層，不並存兩套 |
| `web/public/dashboard.html` | 通用 Tailwind CDN 模板（任務清單、客戶管理、登出等假 KPI），與裝修 domain 無關；且 `web/index.html` 只 meta-refresh 到此檔，React app 實際未被掛載 |
| Seed「林宅／林先生林太太」、品牌材質名稱 | 疑似擬真人名與品牌，不搬；主 repo 一律使用明顯假資料 |
| React 19／Router 7／Tailwind v4 技術棧、`gh-pages` deploy script、`vite base: '/decoration-tracker/'` | 與主 repo（React 18、純 CSS tokens）衝突；部署目標待確認，不在 M1 變更 |
| `tests/e2e.test.tsx` | 已被 vitest config 排除（jsdom hang），且測對象是不搬的頁面 |
| decoration-tracker 的 `GOAL.md`、`PRD/SPEC.md` | 內容已吸收進本文件；其中「全綠」「已 shipped」等宣稱與程式不符（§14） |

### 13.3 合併後處置

- M1 完成後由 Sean 決定 decoration-tracker 是否封存；封存、改名、刪除不在任何 agent session 內執行。

## 14. 文件與程式不一致（以程式為準）

| repo | 文件宣稱 | 實際程式／執行結果 |
|---|---|---|
| renovation-tracker | `README.md` 標題「裝修進度神器」、v3.0.2 scaffold | 已實作 FR-001～FR-006，README 未反映；產品名稱與 Notion「裝修進度管理平台」不一致（待確認） |
| renovation-tracker | `AGENTS.md`：部署到 Vercel | `.github/workflows/ci.yml` 是 GitHub Pages deploy；workflow 檔解析失敗，最近 3 次 run 皆 0 秒失敗；且在 repo 根目錄執行 `npm ci`（`package.json` 在 `web/`）並呼叫不存在的 `npm run lint` |
| renovation-tracker | CHANGELOG：FR-006 通過，371 測試 | 目前 438 個測試，435 通過、3 失敗（時間相依，§11） |
| decoration-tracker | SPEC：FR-001～FR-008 shipped、CI 4 jobs 全綠 | 最近一次 CI run 失敗；`index.html` 只轉址到靜態模板，React app 未掛載 |
| decoration-tracker | GOAL：「6 階段時間軸」 | 程式為 7 階段（設計／拆除／水電／泥作／木工／油漆／傢飾） |
| decoration-tracker | SPEC：28 tests | 本機 Node v26.13.1 執行 24 失敗／4 通過（jsdom 下 `localStorage` 為 undefined）；CI 使用 Node 20，結果未驗證 |

## 15. 非功能需求

| 維度 | 需求 |
|---|---|
| 離線 | 核心看板、照片、預算、變更單、驗收在無網路時可讀寫（IndexedDB） |
| 效能 | 100 張照片、50 個階段時 dashboard 首次互動 < 2 秒（目標值，待量測基線） |
| 響應式 | 375px 以上無頁面級水平捲軸；甘特圖於自身容器捲動 |
| 可及性 | 狀態不只靠顏色；互動元素有 accessible name；表單錯誤以文字呈現 |
| 可靠性 | 不得出現 NaN／Infinity；金額不以浮點字串累加 |
| 安全 | 不在 repo 提交憑證；分享 URL 不含 IndexedDB key 與 Blob |
| 可測試性 | domain 邏輯有 unit test，UI 流程有 Testing Library 互動測試；測試不得依賴系統時鐘 |
| 相容性 | 最新兩版 Chrome、Safari、Edge |

## 16. 資料與個資處理

| 資料 | 敏感度 | M1 處理 | 後續 |
|---|---|---|---|
| 屋主地址（`Project.address`） | 個資 | 只存本機 IndexedDB；分享預設不含，需勾選才放入 URL；UI 提示「連結未加密」 | M3 伺服器端存放需加密與存取控制 |
| 屋主姓名／稱呼 | 個資 | M1 不新增此欄位；示範資料使用「示範屋主」 | M2 多案件時再設計欄位與遮罩 |
| 工班電話、保固聯絡方式 | 個資 | 只存本機；分享預設不含 | 同上 |
| 施工照片 | 可能含地址門牌、住戶與鄰居人像、室內格局；EXIF 可能含 GPS 位置 | 只存本機 Blob；分享不含 Blob；不接雲端 | M2／M3 上傳雲端前必須移除 EXIF GPS、提供刪除、定義保存期限 |
| 金額（合約、收款、變更單） | 商業敏感 | 只存本機 | M3 需備份與稽核紀錄 |

- 開發、測試、seed、文件、截圖一律使用明顯假資料（例：`示範屋主`、`測試市示範路 1 號`、`0900-000-000`、`demo@example.com`）。
- 清除瀏覽器資料會刪除所有紀錄；M1 須在 README 與使用說明中明示。

## 17. 法規與風險

| 項目 | 說明 | 處理 |
|---|---|---|
| 個人資料保護法 | 蒐集屋主地址、電話與含人像照片屬個資蒐集、處理與利用 | M3 上線前需隱私權政策、告知與同意、刪除請求流程；細節待法務確認 |
| 消費者保護相關規範 | 若對屋主（消費者）收費或提供訂閱 | 目前規劃只向業者收費；如改變需法務確認 |
| 電子簽章效力 | 變更單「核准」若要作為契約依據 | M1 明示「本機紀錄、非電子簽章」；是否需法律效力待確認 |
| 金流 | 訂閱扣款與發票 | M3 才接，需 risk approval 與人審；M1/M2 不接真實金流 |
| 市場風險 | 裝修業數位化程度低，推廣需地推（Notion 記載） | M3 規劃小規模試點與地推；屋主分享免登入以降低門檻 |
| 技術風險 | local-first 資料只在單一裝置，換裝置或清快取即遺失 | M1 文件明示；M2 提供匯出／備份；M3 雲端同步 |
| 分享外洩 | URL hash 可被轉傳且無法撤銷 | M1 預設遮蔽個資欄位；M3 伺服器端可撤銷分享 |

## 18. 里程碑

### M1 — 單案本地 MVP 收斂與合併（本次 GOAL）

- 搬入 decoration-tracker 的變更單（FR-007）、合約收款（FR-008）、階段驗收（FR-009），以主 repo 架構重寫。
- 新增照片進度回報（FR-010）、強化屋主分享（FR-004 缺口：個資預設遮蔽、納入新功能摘要）。
- README 與使用說明（FR-011）。
- 修正時間相依測試、補 lint、修 CI workflow。
- 全程 local-first、假資料，不接金流、雲端、真實個資。

### M2 — 多案件與上線前架構（mock 模式）

- 多案件管理（FR-012）、資料匯出／備份（FR-017）。
- 帳號／角色與後端資料模型設計（FR-013 設計文件 + threat model），雲端照片與同步以 mock adapter 驗證（FR-014）。
- 計費方案與用量限制以測試模式呈現（FR-016 mock），不收真實款項。
- 小規模訪談驗證定價與付費意願（待 Sean 安排）。

### M3 — 上市

- 真實後端、登入與角色權限（FR-013）、雲端照片（FR-014）、伺服器端分享與屋主線上核准（FR-015）、真實金流（FR-016）——均需 risk approval 與人審。
- 隱私權政策、服務條款、地推試點。

## 19. 成功指標

> 目標值待 Sean 確認；以下先定義量測方式。

| 階段 | 指標 | 量測方式 | 目標 |
|---|---|---|---|
| M1 | GOAL.md 全部 AC 通過 | `cd web && npm run lint && npm run typecheck && npm test && npm run build` exit 0 + PR CI 綠燈 | 100% |
| M1 | 合併清單「要搬」M1 項目完成 | STATUS.md 對照表 | 4/4 |
| M2 | 試用業者數 | 訪談與試用名單 | 待確認 |
| M2 | 每案件每週照片進度回報次數 | 本機匯出統計（不回傳） | 待確認 |
| M3 | 付費轉換率、月留存率 | 計費系統 | 待確認 |
| M3 | 屋主分享連結開啟率 | 伺服器端分享紀錄 | 待確認 |

## 20. 全產品 non-goals（M1 期間）

- 登入、註冊、OAuth、角色權限、多人協作與伺服器端資料同步。
- R2／S3 等雲端儲存、Email、LINE、推播、行事曆雙向同步、付款與第三方 SaaS。
- 伺服器端分享、撤銷、存取權限與即時協作。
- 甘特圖拖曳、依賴關係、關鍵路徑與自動排程。
- 多工程切換、工程建立／刪除（M2）。

## 21. 變更紀錄

- v5.1（2026-11-16）：M1 實作後同步 §5 功能狀態、§6 技術現況（schema v6、分享 version 2、測試檔數）、§10.2 與 §11 的缺口註記。需求、AC 與里程碑內容未變更。
- v5.0（2026-11-16）：PRD 重建。補問題、客群、獲利模式、競品、FR 總表（含狀態與所在 repo）、個資與法規、M1～M3、成功指標與 decoration-tracker 合併清單；保留 v4.0 FR-001～FR-006 規格摘要。
- v4.0（2026-09-20）：FR-002～FR-006 可執行規格（見 `PRD/CHANGELOG.md`）。
