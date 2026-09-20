# AGENTS.md — Renovation Tracker 開發合約

本檔是 `renovation-tracker` 專案的開發流程與驗收規則。workspace 層級的通用規則仍以父層 [`../AGENTS.md`](../AGENTS.md) 為準；本檔補充本專案特有的執行方式。

## Single Source of Truth

- `PRD/SPEC.md` 是產品範圍、功能需求與 acceptance criteria 的唯一規格來源。
- `PRD/FR-00x-MINIMAX-TASK.md` 是交給 MiniMax 的單一 milestone implementation brief。
- 任何程式碼改動都必須能對應到 `SPEC.md` 的 FR/AC 或明確的工程驗收問題。

## 代理協作流程

每個 milestone 必須依序完成，不可跳過獨立驗收：

1. **Planner / Codex**：把 PRD 補成可執行規格，明確寫出 data model、UI 行為、錯誤處理、測試與 acceptance criteria。
2. **Developer / MiniMax**：只依照當前 `FR-00x-MINIMAX-TASK.md` 實作，不擴大範圍；完成後回報改動與驗證結果。
3. **Deterministic checks / Codex**：Codex 不採信「測試已通過」的口頭回報，必須在 host workspace 重新執行 typecheck、test、build 與必要的 browser smoke test。
4. **QA / Codex**：逐條對照 acceptance criteria，檢查資料持久化、空狀態、錯誤狀態、readonly/share 邊界與 accessibility。
5. **回派修正**：若任何檢查失敗，Codex 必須提供可重現的 command、實際輸出、exit code 與具體修正要求；MiniMax 修正後重新完整驗收。
6. **Integrator**：只有當當前 milestone 通過獨立驗收，才可進入下一個 milestone；完成全部 FR 後才可 commit、push 與 deploy。

## 驗收證據

- Agent 自己聲稱通過不算證據；必須留下 command output 與 exit code。
- 最低驗證命令（在 `web/` 執行）：

  ```bash
  npm install
  npm run typecheck
  npm test -- --run
  npm run build
  ```

- UI 需求除自動化測試外，必須做瀏覽器 smoke test；至少涵蓋建立、編輯、刪除/取消、重新整理後持久化，以及 readonly share 的權限邊界。
- 不可刪除或跳過 failing test 來讓 CI 變綠；diagnostic test 完成後必須移除。

## Git、push 與 deployment

- commit message 使用 `<type>(scope): <FR/AC 或說明>`，例如 `feat(mvp): complete FR-001 through FR-006`。
- 不在 agent session 內 merge PR、刪 branch、修改 branch protection 或 rotate secrets。
- 只有在 Sean 明確要求、milestone 已完成獨立驗收、部署目標已確認時，才可執行 Vercel deploy。
- 本專案 Vercel 設定：Root Directory=`web`、Framework=`Vite`、Build Command=`npm run build`、Output Directory=`dist`、Install Command=`npm install`。
- 每次 push 後必須確認 local HEAD 與 GitHub `main` 相同；每次 production deploy 必須把該 commit SHA 寫入 deployment metadata。
- 每次 GitHub push 或 Vercel deploy 都必須同步更新 canonical Notion Project DB：`進度`／HEAD SHA、GitHub URL、Vercel URL、狀態與 Next Action 必須反映同一個 release；Notion 同步完成並驗證前，該 release 不算完成。
- Release 順序固定為：獨立驗收 → commit → push → deploy → 更新 Notion → 驗證 GitHub／Vercel／Notion SHA；若 Notion connector 不可用，必須標記 release pending，不得開始下一個 milestone。
- 不得 commit credentials、tokens、`.env`、`.env.local` 或 connection strings。Vercel 本機目錄與環境檔必須保持 ignored。

## 目前產品邊界

- MVP 採 local-first IndexedDB；未經 SPEC 明確授權，不新增 backend、auth、cloud sync、R2/S3 或第三方資料服務。
- Share 頁面必須 readonly，不能洩漏內部 IndexedDB key、原始 record id 或 photo blob。
- 任何涉及 DB migration、auth、payments、secrets 或 infra deletion 的改動，都必須額外取得 risk approval 與人審。
