# FR-003 MiniMax implementation task — 預算追蹤

## Objective

在既有 FR-001／FR-002 dashboard 上完成 FR-003 預算追蹤，依 `PRD/SPEC.md` §4.5、§8 與 AC-FR003-01～04 實作。資料必須以 IndexedDB 儲存，不得加入後端、付款服務或假 API。

## Allowed scope

- `web/src/**`
- `web/package.json`、`web/package-lock.json`、`web/tsconfig.json`、`web/vite.config.ts`（只有確有必要時）
- FR-003 自動化測試與 test setup

不得修改 `PRD/SPEC.md` 或 `PRD/CHANGELOG.md` 以降低驗收標準；不得破壞已通過的 FR-001／FR-002。

## Required behavior

1. dashboard 有預算區塊、總預算、實際支出、剩餘金額、超支金額／文字警示與空狀態。
2. 可新增、編輯、刪除預算項目；刪除前必須有確認，取消不得改變資料。
3. 表單支援分類、名稱、預算金額、實際金額、付款狀態與備註。
4. 名稱／分類必填；金額必須是大於等於 0 的有限數字，最多兩位小數；合計不可因浮點誤差失真。
5. 既有照片區塊與 FR-001 行為不得退化。

## Verification commands

在 `web/` 執行並回報實際結果：

```bash
npm run typecheck
npm run build
npm test -- --run
```

回報需列出修改檔案、完成的 AC、測試數、每個命令的 exit code、已知限制與未完成事項。若規格有歧義，停止並提出問題，不得自行擴張範圍。
