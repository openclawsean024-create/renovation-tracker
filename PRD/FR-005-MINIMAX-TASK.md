# FR-005 MiniMax implementation task — 師傅排程與提醒

## Objective

在既有 FR-001～FR-004 dashboard 上完成 FR-005 師傅排程與提醒，依 `PRD/SPEC.md` §4.6、§10 與 AC-FR005-01～04 實作。資料必須以 IndexedDB 儲存；提醒是頁面內提醒，Notification API 只能是 best-effort enhancement，不得加入推播服務、Email 或假 API。

## Allowed scope

- `web/src/**`
- `web/package.json`、`web/package-lock.json`、`web/tsconfig.json`、`web/vite.config.ts`（只有確有必要時）
- FR-005 自動化測試與 test setup

不得修改 `PRD/SPEC.md` 或 `PRD/CHANGELOG.md` 以降低驗收標準；不得破壞已通過的 FR-001～FR-004，尤其是 AppShell 的唯讀 provider isolation。

## Required behavior

1. dashboard 有排程區塊、空狀態與新增排程 CTA。
2. 可新增、編輯、刪除排程；刪除前必須確認，取消不得改變資料。
3. 表單支援工班名稱、電話、可選關聯階段、開始日、結束日、提醒日、備註與完成狀態。
4. 清單依開始日排序，顯示未開始／今日／進行中／已完成／逾期文字狀態。
5. 未完成且 reminderOn 已到期或未來 7 天內的排程顯示頁面內提醒；完成後不再列入待辦。
6. 若使用者授權 Notification API，可在本地頁面開啟時發一次通知；權限拒絕或 API 不存在不得阻塞或製造錯誤。
7. 有效 share URL 的 ReadOnlyView 顯示排程摘要但不顯示任何編輯 CTA，且不觸碰 IndexedDB。

## Verification commands

在 `web/` 執行並回報實際結果：

```bash
npm run typecheck
npm run build
npm test -- --run
```

回報需列出修改檔案、完成的 AC、測試數、每個命令的 exit code、已知限制與未完成事項。若規格有歧義，停止並提出問題，不得自行擴張範圍。
