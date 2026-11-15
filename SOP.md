# 裝修進度管理平台 — 開發 SOP

## 規格對齊狀態（2026-11-16）

- ✅ `PRD/SPEC.md` v5.1（M1 實作後同步功能狀態；含 FR 總表、個資處理、M1～M3、合併清單）。
- ✅ `GOAL.md` 只定義 M1（AC-001～AC-009）。
- ✅ M1 已於分支 `feat/m1` 實作，各 AC 的 commit 與驗證結果見 `STATUS.md`「M1 進度紀錄」。
- ✅ `.github/workflows/ci.yml` 已於 AC-007 重寫：可解析、在 `web/` 執行、lockfile 為 `web/package-lock.json`，lint／typecheck／test／build 任一失敗即失敗。deploy job 保留但停用（部署目標待確認）。
- ⚠️ M1 Exit gate（Sean 覆審範圍與 UI、獨立驗收者乾淨安裝重跑與瀏覽器 smoke）尚未執行。

## 驗證 SOP

所有指令在 `web/` 執行。下表依 `web/package.json` 的 `scripts` 查證。

```bash
cd web
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

| 類型 | 指令 | 狀態 | 2026-11-16 實測（Node v26.13.1） |
|---|---|---|---|
| 安裝 | `npm ci` | 可用（有 `package-lock.json`） | exit 0 |
| Typecheck | `npm run typecheck`（`tsc --noEmit`） | 可用 | exit 0 |
| Unit／元件測試 | `npm test`（`vitest run`） | 可用 | `feat/m1`：39 檔／620 tests 全數通過 → exit 0（M1 前 `main`：25 檔／438 tests，3 失敗） |
| 單一測試檔 | `npm test -- <檔名關鍵字>`，例如 `npm test -- share` | 可用 | — |
| Build | `npm run build`（`tsc --noEmit && vite build`） | 可用 | exit 0 |
| 本機開發 | `npm run dev` | 可用 | 未於本次執行 |
| 預覽 build | `npm run preview` | 可用 | 未於本次執行 |
| Lint | `npm run lint`（`eslint .`，`web/eslint.config.js`） | 可用（M1 AC-007 新增） | exit 0（0 errors、4 warnings） |
| Format | — | **尚未配置** | — |
| E2E（瀏覽器） | — | **尚未配置**（目前以人工瀏覽器 smoke 補足） | — |
| Integration | — | **尚未配置** | — |

注意：

- `npm test -- --run` 也可用（`vitest run --run`，舊文件寫法），與 `npm test` 等價。
- `Dashboard.schedule.test.tsx` 原本有 3 個測試寫死 `2026-09-25`～`2026-09-30` 並依賴系統時鐘；M1（AC-007）已用 `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime` 固定為 2026-09-20，未刪除或放寬任何斷言。新增測試如需「今天」，請注入 `clock` 或使用同樣的固定時鐘。
- 各 AC 的單項指令：`npm test -- changeOrders`、`contract`、`acceptance`、`photoReport`、`share`、`help`、`fakeData`、`mergeChecklist`、`qualityGate`。
- 尚未配置的指令不得在回報中寫成「通過」。

## 文件與安全檢查（repo 根目錄）

```bash
git diff --check
git ls-files | grep -E '(^|/)\.env'          # 應無輸出
git grep -nE 'ghp_|AKIA|BEGIN (RSA|EC|OPENSSH) PRIVATE KEY' -- . ':!SOP.md' ':!GOAL.md'   # 應無輸出
```

## 瀏覽器 smoke（人工，M1 Exit gate）

1. `cd web && npm run dev`，開啟顯示的 localhost 網址。
2. 新增／編輯／刪除（含取消）階段、照片、預算、排程、保固；重新整理確認持久化。
3. M1 完成後另驗：變更單核准／拒絕、驗收勾選、照片進度回報、分享對話框預設不含地址與聯絡方式。
4. 產生分享連結，在新分頁開啟，確認唯讀且無編輯控制；竄改 hash 後顯示錯誤而非崩潰。
5. 視窗寬度 375px 確認無頁面級水平捲軸。

## 故意不做（M1）

- ❌ 真實金流、計費、發票。
- ❌ 真實雲端照片儲存與同步、後端、登入。
- ❌ 真實屋主個資與施工照片。
- ❌ Production deploy（部署目標 Vercel 或 GitHub Pages 待確認）。
