# FR-006 MiniMax implementation task — 保固紀錄

## Objective

在既有 FR-001～FR-005 dashboard 上完成 FR-006 保固紀錄，依 `PRD/SPEC.md` §4.7、§11 與 AC-FR006-01～04 實作。資料必須以 IndexedDB 儲存；日期狀態與到期警示由本地日期計算，不加入後端或第三方服務。

## Allowed scope

- `web/src/**`
- `web/package.json`、`web/package-lock.json`、`web/tsconfig.json`、`web/vite.config.ts`（只有確有必要時）
- FR-006 自動化測試與 test setup

不得修改 `PRD/SPEC.md` 或 `PRD/CHANGELOG.md` 以降低驗收標準；不得破壞已通過的 FR-001～FR-005，尤其是 AppShell 的唯讀 provider isolation、排程摘要與既有 IndexedDB migration。

## Required behavior

1. dashboard 有保固區塊、空狀態與新增保固 CTA。
2. 可新增、編輯、刪除保固紀錄；刪除前必須確認，取消不得改變資料。
3. 表單支援項目、提供者、聯絡方式、保固開始日、結束日與備註。
4. 清單依結束日排序，顯示尚未開始／有效中／已過期文字狀態。
5. 有紀錄在本地今天起 30 天內到期時顯示文字化警示；已過期紀錄也要顯示狀態。
6. 有效 share URL 的 ReadOnlyView 顯示保固摘要但不顯示任何編輯 CTA，且不觸碰 IndexedDB。

## Verification commands

在 `web/` 執行並回報實際結果：

```bash
npm run typecheck
npm run build
npm test -- --run
```

回報需列出修改檔案、完成的 AC、測試數、每個命令的 exit code、已知限制與未完成事項。若規格有歧義，停止並提出問題，不得自行擴張範圍。
