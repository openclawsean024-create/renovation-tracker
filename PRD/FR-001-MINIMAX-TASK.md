# MiniMax implementation task — FR-001

## Role

你是本 milestone 的 Developer。請依照 `PRD/SPEC.md` 實作 FR-001 工程進度看板；ChatGPT/Codex 會在你回報後檢查 diff、驗收條件與 deterministic checks。

## Objective

在現有 `web/` Vite + React + TypeScript scaffold 中完成 Phase 1 FR-001：

- local-first 單一本機工程 dashboard
- Project / Stage domain model
- IndexedDB 持久化
- seed project 與七個預設階段
- 階段清單、摘要、狀態更新、新增、編輯、刪除確認
- 日期甘特圖與跨月／單日日期計算
- responsive 與基本可及性
- 覆蓋核心行為的自動化測試

## Authoritative specification

以 `PRD/SPEC.md` 為唯一規格來源，尤其是：

- §2 技術與執行邊界
- §4 Domain model
- §5 FR-001 工程進度看板
- §6 AC-FR001-01 ～ AC-FR001-11
- §7 Phase 1 non-goals
- §8 MiniMax implementation contract

不得自行降低 acceptance criteria，也不得把尚未納入本 milestone 的 FR-002～FR-006 假裝完成。

## Allowed scope

- 修改 `web/src/**`、`web/package.json`、必要的 `web/vite.config.ts` 或測試設定。
- 新增測試檔案與必要的前端測試依賴。
- 不修改 `PRD/SPEC.md` 來放寬要求；若規格矛盾，先在回報中指出。

## Explicit non-goals

- 不建立後端、API、登入、OAuth、雲端資料庫或真正分享 URL。
- 不接 R2/S3、不做照片、預算、通知、排程或保固功能。
- 不使用硬編在 React state 的假持久化取代 IndexedDB。
- 不新增會誤導使用者的 FR-002～FR-006 placeholder 按鈕。

## Required verification

在 `web/` 執行並保留實際輸出：

```bash
npm run typecheck
npm run build
npm test -- --run
```

測試至少要覆蓋 seed data、表單驗證、狀態摘要、甘特日期計算、IndexedDB 持久化與刪除確認。不要只回報「測試通過」而不提供命令與結果。

## Handoff report

完成後請回報：

1. 修改檔案清單。
2. 每個 AC-FR001 編號的完成狀態與證據。
3. 實際執行的驗證命令、輸出摘要與 exit code。
4. 尚未完成、取捨或需要產品決策的項目。
