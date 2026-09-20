# FR-002 MiniMax implementation task — 照片記錄

## Objective

在既有 FR-001 dashboard 上完成 FR-002 照片記錄，依 `PRD/SPEC.md` §4.4、§7 與 AC-FR002-01～05 實作。照片必須以 IndexedDB Blob 儲存，不能加入後端、R2/S3、登入或假的 upload API。

## Allowed scope

- `web/src/**`
- `web/package.json`、`web/package-lock.json`、`web/tsconfig.json`、`web/vite.config.ts`（只有確有必要時）
- FR-002 自動化測試與 test setup

不得修改 `PRD/SPEC.md` 或 `PRD/CHANGELOG.md` 以降低驗收標準；不得破壞 FR-001 已通過的行為。

## Required behavior

1. dashboard 有照片區塊與新增照片 CTA。
2. 新增表單支援 `image/*`、10 MB 上限、before/progress/after、日期、可選階段與說明。
3. IndexedDB 能 round-trip 儲存與讀回 Blob 及 metadata。
4. 清單有縮圖、分類篩選、依 takenOn 新到舊排序、預覽與刪除確認。
5. 空狀態、驗證錯誤、讀取錯誤與 accessibility label 完整。
6. 既有 FR-001 的 96 個測試與行為不得退化。

## Verification commands

在 `web/` 執行並回報實際結果：

```bash
npm run typecheck
npm run build
npm test -- --run
```

回報需列出修改檔案、完成的 AC、測試檔案與測試數、已知限制、每個命令的 exit code。若發現規格歧義，停止並提出問題，不得自行擴張範圍。
