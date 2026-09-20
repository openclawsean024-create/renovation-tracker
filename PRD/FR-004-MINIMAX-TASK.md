# FR-004 MiniMax implementation task — 唯讀分享

## Objective

在既有 FR-001～FR-003 dashboard 上完成 FR-004 唯讀分享，依 `PRD/SPEC.md` §9 與 AC-FR004-01～04 實作。分享必須是 versioned URL hash snapshot；不得加入後端、登入、token server、公開資料庫或把 Blob／IndexedDB key 放進連結。

## Allowed scope

- `web/src/**`
- `web/package.json`、`web/package-lock.json`、`web/tsconfig.json`、`web/vite.config.ts`（只有確有必要時）
- FR-004 自動化測試與 test setup

不得修改 `PRD/SPEC.md` 或 `PRD/CHANGELOG.md` 以降低驗收標準；不得破壞已通過的 FR-001～FR-003。

## Required behavior

1. dashboard 有「產生唯讀分享」入口，將目前工程的公開展示資料 encode 為帶版本欄位的 URL hash snapshot。
2. snapshot 至少包含工程名稱、日期、工程狀態、階段摘要／甘特圖資料、照片 metadata（不含 Blob）、預算摘要、排程摘要與保固摘要；目前未來模組可用空陣列／零摘要，但 schema 必須穩定。
3. 使用者可複製連結，並有可理解的成功／失敗文字結果；剪貼簿 API 不可用時不能崩潰。
4. 開啟有效 snapshot 進入唯讀模式：顯示明確 banner，所有新增／編輯／刪除／狀態切換 CTA 不顯示或 disabled，且不得寫入本機 IndexedDB。
5. 無效、未知版本或解析失敗 hash 顯示錯誤空狀態，不得讓應用程式崩潰。
6. 既有三個 FR 的行為與測試不得退化。

## Verification commands

在 `web/` 執行並回報實際結果：

```bash
npm run typecheck
npm run build
npm test -- --run
```

回報需列出修改檔案、完成的 AC、測試數、每個命令的 exit code、已知限制與未完成事項。若規格有歧義，停止並提出問題，不得自行擴張範圍。
