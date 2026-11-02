# Pomodoro Timer 健康檢查報告

日期：2026-11-02｜分支：`chore/health-check`｜基準 commit：`2c80bbe`

標記說明：**[verified]** = 有工具輸出或測試結果佐證；**[sourced]** = 引用外部文件；**[estimate]** = 推估；**[uncertain]** = 未能確認。

---

## 1. 技術堆疊摘要 [verified]

| 項目 | 內容 |
| --- | --- |
| 類型 | 純靜態 web app（`index.html` + `index.js` + `index.css`），無 bundler、無 build 步驟 |
| 前端框架 | Vue 3（Composition API，`setup()`），由 `https://unpkg.com/vue@3/dist/vue.global.prod.js` 以 CDN 載入，**未釘版本、無 SRI** |
| Vendored 程式庫 | `progressbar.min.js`（ProgressBar.js 1.0.0）、`vue.min.js`（Vue 2.6.14，**已不再被引用**） |
| 樣式 | `index.scss` 由 WebStorm file watcher 編譯成已 commit 的 `index.css`（`.idea/watcherTasks.xml`）；repo 內無 `sass` |
| 套件管理 | pnpm 10.28.0，`pnpm-lock.yaml` lockfileVersion 9.0 |
| Lint／Format | ESLint 9.30.0（flat config）、Prettier 3.6.2 |
| Dev server | http-server 14.1.1 |
| 測試 | 無測試框架；`pnpm test` → `validate-simple.sh`（grep 檔案存在性與函式名稱） |
| CI／部署 | 無 `.github/`；`CNAME` → `tomato.kouni.io`（推定為 GitHub Pages [estimate]）；Dependabot PR 曾被合併，但 repo 內無 `dependabot.yml` |
| Runtime | `engines.node >=18`；本次環境 Node v22.23.4 |
| 第三方請求 | Google Fonts（googleapis）、unpkg；**無 analytics／tracking script** |

## 2. 基準線（Phase 1）[verified]

| 檢查 | 指令 | 結果 |
| --- | --- | --- |
| 現有測試 | `pnpm test` | 13 ✓／0 ✗，exit 0（腳本本身永不回傳非零，見 M1） |
| Lint | `pnpm exec eslint index.js` | 通過（0 問題） |
| Lint（全 repo） | `pnpm exec eslint index.js eslint.config.js scripts/validate.js` | 2 errors：`eslint.config.js`、`scripts/validate.js` 因全域 `sourceType: "script"` 無法解析 `import` |
| Format | `pnpm exec prettier --check "*.{js,html,css,scss,json}"` | 通過 |
| Build | 無 build 步驟 | N/A |
| 弱點掃描 | `pnpm audit` | 25 筆：0 critical／13 high／11 moderate／1 low，全部為 devDependencies 的 transitive 套件 |
| 過期套件 | `pnpm outdated` | prettier 3.6.2→3.9.10；@eslint/js 9.30.0→10.0.1；eslint 9.30.0→10.14.0；eslint-config-prettier 9.1.0→10.1.8；globals 15.15.0→17.14.0 |

`pnpm audit` 基準線依套件歸納：

| 嚴重度 | 套件（已安裝版本） | 筆數 | 路徑 | 修補版本 |
| --- | --- | --- | --- | --- |
| high | minimatch 3.1.2 | 3 | eslint > minimatch | >=3.1.3 |
| high | brace-expansion | 5 | eslint > minimatch | >=1.1.16 |
| high | flatted | 2 | eslint > file-entry-cache | >=3.4.0 |
| high | js-yaml | 3 | eslint > @eslint/eslintrc | >=4.3.0 |
| moderate | qs 6.14.0 | 4 | http-server > union | >=6.14.1 |
| moderate | minimatch | 1 | eslint | >=11.0.1 |
| moderate | brace-expansion | 2 | eslint > minimatch | >=1.1.13 |
| moderate | ajv | 1 | eslint | >=6.14.0 |
| moderate | follow-redirects | 1 | http-server > http-proxy | >=1.16.0 |
| moderate | js-yaml | 1 | eslint > @eslint/eslintrc | >=4.2.0 |
| moderate | @humanfs/node | 1 | eslint | >=0.16.8 |
| low | qs | 1 | http-server > union | >=6.14.2 |

這些套件都不會被送到瀏覽器（純 dev 工具鏈），實際攻擊面是開發者機器與 CI，而非終端使用者。

## 3. 稽核發現（Phase 2）

### 3.1 總覽

| ID | 嚴重度 | 類別 | 標題 | 處置 |
| --- | --- | --- | --- | --- |
| H1 | High | 供應鏈 | Vue 由 CDN 浮動載入，未釘版本、無 SRI | Phase 5 修正 |
| H2 | High | 弱點元件 | vendored ProgressBar.js 1.0.0 有 Prototype Pollution 公告 | Phase 4 升級 |
| H3 | High | 計時器 | 回合結束音效／通知只在 `remaining === 0` 的 tick 觸發，背景分頁節流時會漏掉 | Phase 5 修正 |
| H4 | High | 相容性 | `Notification.permission` 在 setup 無保護存取，無 Notification API 的瀏覧器整個 app 無法掛載 | Phase 5 修正 |
| H5 | High | 效能／成本 | 4 個 25–28 MB 音樂檔在啟動時以 `new Audio()` 急切建立 | Phase 5 修正 |
| H6 | High | 無障礙 | 所有按鈕 `:focus { outline: none }`；設定分頁與任務勾選不可用鍵盤操作 | outline Phase 5 修正；其餘提案 |
| M1 | Medium | 測試基礎 | `pnpm test` 永不失敗；三套驗證腳本重複；`test` 會透過 `lint --fix` 改寫原始碼 | Phase 3 補強 |
| M2 | Medium | 持久化 | `parseInt(localStorage…)` 無 NaN 防護；`tasks` 未驗證型別；17 個散落 key、無 schema 版本 | 提案 |
| M3 | Medium | Bug | `musicState()` 內 `const musicTiming` 遮蔽同名 ref，改讀 DOM `<select>`；元素不存在時會 TypeError | 提案 |
| M4 | Medium | 架構 | Vue app 內大量命令式 DOM 操作（30+ `querySelector`），狀態存在兩處 | 提案（L） |
| M5 | Medium | 安全標頭 | 無 CSP；靜態託管無法設 header，但可用 `<meta http-equiv>` | 提案 |
| M6 | Medium | 通知 UX | 頁面載入即請求通知權限且發測試通知；無使用者手勢 | 提案 |
| M7 | Medium | 錯誤處理 | `Audio.play()` 的 Promise rejection 未處理；`sound.work`／`sound.break` 檔名對調 | 提案 |
| M8 | Medium | 建置可重現性 | `index.css` 為 IDE 編譯產物，CI 無法重建 | 提案 |
| M9 | Medium | 相依弱點 | devDependencies 25 筆公告（見 §2） | Phase 4 升級 |
| L1 | Low | 死碼 | `vue.min.js`（Vue 2.6.14）、`scripts/validate.js`、`validate.sh`、`index.css.map`、`.idea/`、`toggleDarkMode` no-op | 提案（需刪檔，未執行） |
| L2 | Low | 重複邏輯 | `shouldPlayMusic` 判斷式重複 4 次；todo 容器高度邏輯重複 3 次 | 提案 |
| L3 | Low | Lint 設定 | 全域 `sourceType: "script"` 使 config 自身無法被 lint；`"type": "module"` 與 classic script 矛盾 | Phase 3 順手修正 |
| L4 | Low | HTML／a11y | inline `oninput`、`v-for` 以 index 當 key、`prefers-reduced-motion` 未處理（31 個動畫宣告）、manifest 空名稱、typo | 提案 |
| L5 | Low | 隱私 | Google Fonts 由 googleapis 載入，訪客 IP 外流 | 提案 |

**Critical：無。** 未發現硬編碼密鑰、`innerHTML`／`eval`／`v-html` 等 XSS sink、或 analytics script [verified：grep]。

### 3.2 詳細說明

#### H1 — Vue CDN 未釘版本、無 SRI [verified]
- 證據：`index.html:538` `<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js">`。
- 影響：`vue@3` 是浮動 dist-tag，每次 Vue 發新 3.x 版（含 3.6 的 Vapor/alien-signals 重寫）app 程式碼即在使用者端被替換，無審查；CDN 或 unpkg 帳號遭入侵時可直接注入腳本。這是本專案唯一的遠端程式碼來源。
- 建議：釘到 `vue@3.5.44`（registry `dist-tags.latest`，2026-11-02 查詢）並加上 `integrity` + `crossorigin="anonymous"`。SRI hash 以 npm tarball 內 `dist/vue.global.prod.js` 計算（unpkg 直接提供 tarball 內容）；本環境 proxy 封鎖 unpkg，**未能對線上 bytes 二次比對 [uncertain]**，部署後請在瀏覽器 console 確認無 integrity 錯誤。

#### H2 — ProgressBar.js 1.0.0 Prototype Pollution [verified]
- 證據：`progressbar.min.js:1` 標頭 `// ProgressBar.js 1.0.0`；npm advisory API 回傳 GHSA-89qm-hm2x-mxm3（high，CVSS 8.2，`<1.1.1`）。
- 影響：實際可利用性低（`index.js:1150` 的 options 全由開發者寫死，無使用者輸入進入 `extend()`），但這是會被任何 SCA 工具標紅的已知弱點元件。
- 建議：以 npm `progressbar.js@1.1.1` 的 `dist/progressbar.min.js` 覆蓋。使用到的 API（`Path`、`set`、`animate`、`stop`）在 1.x 內未變。

#### H3 — 背景分頁節流下漏掉回合結束事件 [verified 程式碼；節流行為 sourced]
- 證據：`index.js:395-425`。每秒 `setInterval` 以時間戳算剩餘秒數（這部分正確，無累積漂移），但：
  - `index.js:412` `if (newDate - nowDate === 0) soundEffect(...)` — 音效與通知只在剛好等於 0 的那一個 tick 觸發；
  - `index.js:416` `if (newDate - nowDate < 0)` 才做回合轉換。
- 影響：Chrome 88+ 對隱藏分頁超過 5 分鐘的鏈式 timer 施行 intensive throttling，喚醒對齊到每分鐘一次（[sourced] https://developer.chrome.com/blog/timer-throttling-in-chrome-88 ）。25 分鐘工作回合放在背景，`=== 0` 的 tick 約有 59/60 的機率被跳過 [estimate]：**沒有音效、沒有通知**（這正是 Pomodoro 在背景時唯一有用的輸出），下一回合最多延遲 59 秒開始。Safari／Firefox 的節流政策不同，但同樣不保證每秒 tick。
- 建議：以 `remaining <= 0` 作為單一結束條件，在同一 tick 內播放音效並轉換回合。顯示上少掉一個 `00:00` 的 tick，但轉換時間從「晚 1 秒」變成準時。

#### H4 — `Notification` 未定義時整個 app 崩潰 [verified]
- 證據：`index.js:98` `const notificationPermission = ref(Notification.permission);` 在 `setup()` 內無任何 guard；`requestNotificationPermission` 與 `onMounted` 有 `"Notification" in window` 檢查，但 setup 這行先執行。
- 影響：iOS Safari（非加入主畫面的 PWA）、部分 WebView 不提供 `Notification`（[sourced] MDN Notification browser compat），`setup()` 丟出 ReferenceError，Vue 無法掛載，畫面停留在 `v-cloak` 空白。
- 建議：`ref("Notification" in window ? Notification.permission : "denied")`。

#### H5 — 啟動時急切建立 107 MB 音樂資源 [verified 大小；下載量 estimate]
- 證據：`index.js:91-96` 建立 `nature/rain/cafe/music` 四個 `new Audio()`；`du -h assets/*.mp3`：25 M、27 M、28 M、28 M（合計 107 M）。預設 `isMusic = false`，多數使用者永遠不會播放。
- 影響：`HTMLMediaElement.preload` 預設為 `auto`（瀏覽器可自行決定預抓量，Chrome 通常會抓取相當大的 range [uncertain 精確量]）。每次冷啟動都可能消耗數十 MB 頻寬與 GitHub Pages 流量。
- 建議：對四個音樂物件設定 `preload = "none"`；首次播放延遲由 `nature` 既有的淡入遮蔽。音效檔（16–32 KB）維持不變。

#### H6 — 鍵盤焦點不可見、部分控制項無法鍵盤操作 [verified]
- 證據：`index.scss:55-57`（`button:focus { outline: none }`）、`index.scss:91-93`（`button.button:focus`）；`index.html:154,160,166` 設定分頁為 `<li @click>`；`index.html:506` 任務勾選為 `<div @click>`；計時數字與回合名稱無 `aria-live`。
- 影響：WCAG 2.4.7（Focus Visible）與 2.1.1（Keyboard）失敗；螢幕閱讀器不會得知回合切換。
- 建議：`outline: none` 改為 `:focus:not(:focus-visible)`，保留鍵盤焦點環、不影響滑鼠點擊外觀（低風險，Phase 5 執行）。`<li>`／`<div>` 改 `<button>` 與加上 `aria-live="polite"` 屬 UI 變更，列為提案 S。

#### M1 — 測試基礎設施名存實亡 [verified]
- `validate-simple.sh:14-23` 定義了 `check()` 計數器但從未使用，所有檢查只 `echo` ✓／✗，腳本結尾無 `exit`；`pnpm test` 永遠 exit 0。
- `validate.sh`（264 行）與 `scripts/validate.js`（414 行）功能重複且無任何地方引用。
- `package.json` `lint` 帶 `--fix`，被 `validate-simple.sh:66` 呼叫 → 執行測試會改寫 `index.js`。
- 建議：以 Node 內建 `node:test` 建立真正的單元測試（Phase 3），`test` 改指向它。

#### M2 — 持久化缺乏防禦 [verified]
- `index.js:1004-1017`：`parseInt(localStorage.getItem("workRange"))` 等 6 處無 NaN fallback。任何一個 key 損壞（手動改、擴充套件、舊版寫入）→ `minutes = NaN` → `totalTime = NaN` → `newDate = NaN` → `countDownTimer` 的 `< 0` 永遠 false，計時器永不結束。
- `index.js:1077-1083`：`tasks` 有 try/catch 但未檢查是否為陣列；`JSON.parse("{}")` 會讓 `tasks.value.length` 為 undefined、`push` 丟錯。
- 17 個獨立 key、以字串儲存布林，無 schema 版本；`musicInBreaks → musicTiming` 的遷移碼（`index.js:1031-1041`）已顯示維護成本。
- 建議（提案 S）：讀取時 `Number.isFinite()` 檢查並回落預設值；`Array.isArray(tasks)`。

#### M3 — 變數遮蔽讀到 DOM 而非狀態 [verified]
- `index.js:224` `const musicTiming = document.querySelector("#music-timing");` 遮蔽 `index.js:80` 的 `musicTiming` ref；`index.js:243-249` 的 `musicTiming.value === "work"` 實際讀的是 `<select>.value`。只因 `v-model` 同步而「碰巧正確」；`if (musicTiming)` guard（`index.js:230`）不涵蓋 243 行，元素不存在時 TypeError。
- 建議：改名 DOM 變數（例如 `musicTimingEl`）。

#### M4 — 命令式 DOM 操作與 Vue 狀態並存 [verified]
- `index.js` 內 30+ 個 `document.querySelector*`：回合指示器 class（`index.js:430-438`）、play/pause 分支讀 DOM class 而非 `playState`（`index.js:579-583`）、任務完成 class（`index.js:828-860`）、側欄位置以 inline style（`index.js:908-968`）、音樂控制項 disabled 狀態（`index.js:220-275`）。
- 影響：真相來源有兩份；`v-for` 以 index 當 key，刪除任務時 Vue 重用節點而 class 殘留，`removeTask`（`index.js:815-820`）以「翻轉兩次 completed 再呼叫 `completeTask`」繞過，脆弱且難測。
- 提案 L：改為宣告式 `:class`／`:style`／`:disabled` 綁定，`removeTask` 直接 `splice`。

#### M5 — 無 CSP [verified 程式碼；線上 header unverified]
- `index.html` 無 `<meta http-equiv="Content-Security-Policy">`；本環境 proxy 封鎖 `tomato.kouni.io`，無法確認線上 header [unverified]。GitHub Pages 本身不提供自訂 header。
- 阻礙：`index.html:530` inline `oninput` handler 與多處 inline `style` 需要 `'unsafe-inline'`。
- 提案 S：先移除 inline handler（改 `@input`），再加 meta CSP：`default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; media-src 'self'`。

#### M6 — 載入即請求通知權限 [verified]
- `index.js:1160-1163`：`onMounted` 內 `Notification.permission === "default"` 即呼叫 `requestNotificationPermission()`；`index.js:131-150` 成功後再發一則測試通知。
- Chrome／Firefox 對無使用者手勢的請求啟用 quiet UI 或直接忽略 [sourced：Chrome 80 quieter permission UI]；建議只在設定頁 toggle（已有 `handleNotificationToggle`）時請求。提案 S。

#### M7 — 音訊錯誤處理與命名 [verified]
- `index.js:191`、`index.js:271` `.play()` 回傳 Promise，autoplay policy 拒絕時產生 unhandled rejection。
- `index.js:87-88`：`sound.work = audio_break.mp3`、`sound.break = audio_work.mp3`，`getSoundEffectType()` 回傳的是「剛結束的回合」而非「要播的音效」，命名反向但行為一致。提案 S：`.play().catch(() => {})` 與重新命名。

#### M8 — CSS 建置不可重現 [verified]
- `index.css` + `index.css.map` 為 WebStorm watcher 產物；repo 無 `sass`。任何 SCSS 修改都必須在 IDE 內完成，CI 無法驗證 CSS 與 SCSS 一致。提案 S：新增 `sass` devDependency 與 `build:css` script（需新增相依，本次未執行）。

#### L1–L5 [verified]
- L1：`vue.min.js` 自 `00b32c2`（升級 Vue 3）起未被引用，Vue 2 已於 2023-12-31 EOL [sourced]；`scripts/validate.js`、`validate.sh`、`index.css.map`、`.idea/`（含 `deployment.xml` 的 Hostinger 部署對映，無憑證）。刪檔需確認，未執行。
- L2：`shouldPlayMusic` 於 `index.js:243,290,599,1118` 重複；todo 容器媒體查詢邏輯於 `index.js:864-903,1297-1341` 重複三次。
- L3：`eslint.config.js:9` 全域 `sourceType: "script"`；`package.json:7` `"type": "module"`。
- L4：`index.html:530` inline handler；`index.html:505` `:key="index"`；`index.scss` 31 處 animation/transition、0 處 `prefers-reduced-motion`；`site.webmanifest` `name`／`short_name` 為空；`index.html:75` "waisting"。
- L5：`index.html:10-17` Google Fonts。

### 3.3 已驗證無問題的項目 [verified]
- 計時器核心以 `Date.now()` 時間戳計算剩餘時間（`index.js:396-400`），無 `setInterval` 累積漂移；暫停／恢復重算 `newDate`（`index.js:586-588`）正確。
- 無 service worker，因此無快取範圍／陳舊資產問題；manifest 存在但僅供安裝圖示。
- Vue 模板一律使用 `{{ }}` 文字插值，使用者輸入（任務文字）不會進入 HTML sink。
- 無 CI 設定，故無 token 權限問題；無 `.env`。
