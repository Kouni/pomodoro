# Pomodoro Timer 健康檢查報告

日期：2026-11-02｜分支：`chore/health-check`｜基準 commit：`2c80bbe`

標記說明：**[verified]** = 有工具輸出或測試結果佐證；**[sourced]** = 引用外部文件；**[estimate]** = 推估；**[uncertain]** = 未能確認。

---

## 1. 技術堆疊摘要 [verified]

| 項目            | 內容                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 類型            | 純靜態 web app（`index.html` + `index.js` + `index.css`），無 bundler、無 build 步驟                                                |
| 前端框架        | Vue 3（Composition API，`setup()`），由 `https://unpkg.com/vue@3/dist/vue.global.prod.js` 以 CDN 載入，**未釘版本、無 SRI**         |
| Vendored 程式庫 | `progressbar.min.js`（ProgressBar.js 1.0.0）、`vue.min.js`（Vue 2.6.14，**已不再被引用**）                                          |
| 樣式            | `index.scss` 由 WebStorm file watcher 編譯成已 commit 的 `index.css`（`.idea/watcherTasks.xml`）；repo 內無 `sass`                  |
| 套件管理        | pnpm 10.28.0，`pnpm-lock.yaml` lockfileVersion 9.0                                                                                  |
| Lint／Format    | ESLint 9.30.0（flat config）、Prettier 3.6.2                                                                                        |
| Dev server      | http-server 14.1.1                                                                                                                  |
| 測試            | 無測試框架；`pnpm test` → `validate-simple.sh`（grep 檔案存在性與函式名稱）                                                         |
| CI／部署        | 無 `.github/`；`CNAME` → `tomato.kouni.io`（推定為 GitHub Pages [estimate]）；Dependabot PR 曾被合併，但 repo 內無 `dependabot.yml` |
| Runtime         | `engines.node >=18`；本次環境 Node v22.23.4                                                                                         |
| 第三方請求      | Google Fonts（googleapis）、unpkg；**無 analytics／tracking script**                                                                |

## 2. 基準線（Phase 1）[verified]

| 檢查            | 指令                                                             | 結果                                                                                                                                 |
| --------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 現有測試        | `pnpm test`                                                      | 13 ✓／0 ✗，exit 0（腳本本身永不回傳非零，見 M1）                                                                                     |
| Lint            | `pnpm exec eslint index.js`                                      | 通過（0 問題）                                                                                                                       |
| Lint（全 repo） | `pnpm exec eslint index.js eslint.config.js scripts/validate.js` | 2 errors：`eslint.config.js`、`scripts/validate.js` 因全域 `sourceType: "script"` 無法解析 `import`                                  |
| Format          | `pnpm exec prettier --check "*.{js,html,css,scss,json}"`         | 通過                                                                                                                                 |
| Build           | 無 build 步驟                                                    | N/A                                                                                                                                  |
| 弱點掃描        | `pnpm audit`                                                     | 25 筆：0 critical／13 high／11 moderate／1 low，全部為 devDependencies 的 transitive 套件                                            |
| 過期套件        | `pnpm outdated`                                                  | prettier 3.6.2→3.9.10；@eslint/js 9.30.0→10.0.1；eslint 9.30.0→10.14.0；eslint-config-prettier 9.1.0→10.1.8；globals 15.15.0→17.14.0 |

`pnpm audit` 基準線依套件歸納：

| 嚴重度   | 套件（已安裝版本） | 筆數 | 路徑                      | 修補版本 |
| -------- | ------------------ | ---- | ------------------------- | -------- |
| high     | minimatch 3.1.2    | 3    | eslint > minimatch        | >=3.1.3  |
| high     | brace-expansion    | 5    | eslint > minimatch        | >=1.1.16 |
| high     | flatted            | 2    | eslint > file-entry-cache | >=3.4.0  |
| high     | js-yaml            | 3    | eslint > @eslint/eslintrc | >=4.3.0  |
| moderate | qs 6.14.0          | 4    | http-server > union       | >=6.14.1 |
| moderate | minimatch          | 1    | eslint                    | >=11.0.1 |
| moderate | brace-expansion    | 2    | eslint > minimatch        | >=1.1.13 |
| moderate | ajv                | 1    | eslint                    | >=6.14.0 |
| moderate | follow-redirects   | 1    | http-server > http-proxy  | >=1.16.0 |
| moderate | js-yaml            | 1    | eslint > @eslint/eslintrc | >=4.2.0  |
| moderate | @humanfs/node      | 1    | eslint                    | >=0.16.8 |
| low      | qs                 | 1    | http-server > union       | >=6.14.2 |

這些套件都不會被送到瀏覽器（純 dev 工具鏈），實際攻擊面是開發者機器與 CI，而非終端使用者。

## 3. 稽核發現（Phase 2）

### 3.1 總覽

| ID                                                                                                                     | 嚴重度 | 類別         | 標題                                                                                                                                                | 處置                                                                                |
| ---------------------------------------------------------------------------------------------------------------------- | ------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| H1                                                                                                                     | High   | 供應鏈       | Vue 由 CDN 浮動載入，未釘版本、無 SRI                                                                                                               | 已修 `39a4d5e`                                                                      |
| H2                                                                                                                     | High   | 弱點元件     | vendored ProgressBar.js 1.0.0 有 Prototype Pollution 公告                                                                                           | 已升級 `99e699e`                                                                    |
| H3                                                                                                                     | High   | 計時器       | 回合結束音效／通知只在 `remaining === 0` 的 tick 觸發，背景分頁節流時會漏掉                                                                         | 已修 `5065475`                                                                      |
| H4                                                                                                                     | High   | 相容性       | `Notification.permission` 在 setup 無保護存取，無 Notification API 的瀏覽器整個 app 無法掛載                                                        | 已修 `5b7c912`                                                                      |
| H5                                                                                                                     | High   | 效能／成本   | 4 個 25–28 MB 音樂檔在啟動時以 `new Audio()` 急切建立                                                                                               | 已修 `6799999`                                                                      |
| H6                                                                                                                     | High   | 無障礙       | 所有按鈕 `:focus { outline: none }`；設定分頁與任務勾選不可用鍵盤操作                                                                               | focus ring 已修（`af75b85`）；`<li>`/`<div>` 改 button 為提案 S                     |
| M1                                                                                                                     | Medium | 測試基礎     | `pnpm test` 永不失敗；三套驗證腳本重複；`test` 會透過 `lint --fix` 改寫原始碼                                                                       | 已修：真測試 `53dab28`／`9fc36d3`；重複腳本已刪、`validate-simple.sh` 會失敗（§13） |
| M2                                                                                                                     | Medium | 持久化       | `parseInt(localStorage…)` 無 NaN 防護；`tasks` 未驗證型別；17 個散落 key、無 schema 版本                                                            | 已修：數值／選項／陣列防護（§13）；key 結構未改                                     |
| M3                                                                                                                     | Medium | Bug          | `musicState()` 內 `const musicTiming` 遮蔽同名 ref，改讀 DOM `<select>`；元素不存在時會 TypeError                                                   | 已修：DOM 程式碼隨 M4 移除（§13）                                                   |
| M4                                                                                                                     | Medium | 架構         | Vue app 內大量命令式 DOM 操作（30+ `querySelector`），狀態存在兩處                                                                                  | 已修：三個 refactor commit（§13）                                                   |
| M5                                                                                                                     | Medium | 安全標頭     | 無 CSP；靜態託管無法設 header，但可用 `<meta http-equiv>`                                                                                           | 已修：meta CSP（§13）                                                               |
| M6                                                                                                                     | Medium | 通知 UX      | 頁面載入即請求通知權限且發測試通知；無使用者手勢                                                                                                    | 已修：首次按 play 才請求（§13）                                                     |
| M7                                                                                                                     | Medium | 錯誤處理     | `Audio.play()` 的 Promise rejection 未處理；`sound.work`／`sound.break` 檔名對調                                                                    | 已修（§13）                                                                         |
| M8                                                                                                                     | Medium | 建置可重現性 | `index.css` 為 IDE 編譯產物，CI 無法重建                                                                                                            | 已修：sass `build:css` + CI 同步檢查（§13）                                         |
| M9                                                                                                                     | Medium | 相依弱點     | devDependencies 25 筆公告（見 §2）                                                                                                                  | 25 → 1（minimatch，blocked，見 §7）                                                 |
| L1                                                                                                                     | Low    | 死碼         | `vue.min.js`（Vue 2.6.14）、`scripts/validate.js`、`validate.sh`、`index.css.map`、`.idea/`、`toggleDarkMode` no-op                                 | 已修，`.idea/` 除外（§13）                                                          |
| L2                                                                                                                     | Low    | 重複邏輯     | `shouldPlayMusic` 判斷式重複 4 次；todo 容器高度邏輯重複 3 次                                                                                       | 已修（M4）                                                                          |
| L3                                                                                                                     | Low    | Lint 設定    | 全域 `sourceType: "script"` 使 config 自身無法被 lint；`"type": "module"` 與 classic script 矛盾；`eslint-config-prettier` 已安裝卻未在 config 套用 | 已修：`eslint-config-prettier` 套用、stylistic 規則移除 `92ce500`                   |
| L4                                                                                                                     | Low    | HTML／a11y   | inline `oninput`、`v-for` 以 index 當 key、`prefers-reduced-motion` 未處理（31 個動畫宣告）、manifest 空名稱、typo                                  | 已修（§13）                                                                         |
| L5                                                                                                                     | Low    | 隱私         | Google Fonts 由 googleapis 載入，訪客 IP 外流                                                                                                       | 已修：自架 Roboto `6330dd1`                                                         |
| **Critical：無。** 未發現硬編碼密鑰、`innerHTML`／`eval`／`v-html` 等 XSS sink、或 analytics script [verified：grep]。 |

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

---

## 4. 測試（Phase 3）[verified]

**做法**：零新相依。以 Node 22 內建 `node:test` + `node:assert` 執行；`tests/harness.js` 用 `new Function` 載入真實的 `index.js`，注入極簡 fake 的 `Vue`（`ref`/`computed`/`watch`/`onMounted`/`nextTick`/`createApp`）、DOM、`Audio`、`Notification`、`ProgressBar.Path`、`localStorage`，並以 `setup()` 的回傳值作為測試 seam；時間用 `t.mock.timers`（含 `Date`）控制。這是特性測試（characterization），鎖定的是**當下行為**，Phase 5 修正時再一併改期望值。

| 檔案                        | 測試數 | 涵蓋                                                                                                                                                                                                                                       |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/timer.test.js`       | 14     | 初始狀態、`timerFormat`、開始／tick／以時鐘而非 tick 計時、回合結束與轉換、背景節流情境、快轉走完 work→short→work→long→finish、快轉強制開始、暫停／恢復、重置、`autoBreak`／`autoPomodoro`／`autoTodoEmpty` 三個旗標、infinite 模式        |
| `tests/settings.test.js`    | 13     | `changeRound`／`changeInfinite`／`changeCountdown`、三組 `resetDefault`、通知 toggle 允許／拒絕／API 不存在、音訊物件建立與 `preload`、音樂 timing（work-only／breaks-only）、`addTask` 正規化／優先／上限 8、`completeTask`／`removeTask` |
| `tests/persistence.test.js` | 9      | 首次啟動寫入全部預設 key（字串型別）、完整還原、`musicInBreaks` 遷移、缺 key 預設值、`roundRange=0` 修復、`infinite` 還原 999、壞 JSON 回落、watcher 寫回、placeholder 不被持久化                                                          |

`package.json` 的 `test` 改為 `node --test "tests/**/*.test.js"`；原 `validate` 腳本保留可單獨執行。測試目錄命名為 `tests/`（`.gitignore` 內有來自範本的 `test/` 規則）。

Phase 3 結果：36 tests／36 pass（commit `53dab28`）。測試在修正前全數通過，證明 harness 忠實反映了既有行為。

## 5. 相依升級（Phase 4）[verified]

每組一個 commit，升級後皆重跑 lint + tests + prettier；無 build 步驟故無 build 驗證。

| Commit    | 群組                                 | 變更                                                                                                                               | 升級造成的破壞與處置                                                                                                                                                                                                                                                                                                                                           |
| --------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `260c1df` | patch／minor（`pnpm update`）        | eslint 9.30.0→9.39.5、@eslint/js 9.30.0→9.39.5、eslint-config-prettier 9.1.0→9.1.2、prettier 3.6.2→3.9.10；transitive 全部重新解析 | Prettier 3.9 改變 HTML 屬性值內的換行 → `index.html` 的 inline `oninput` 被重排（純空白）；同 commit 套用。audit 25 → 1                                                                                                                                                                                                                                        |
| `b627e3b` | major：eslint 10 + @eslint/js 10     | 9.39.5→10.14.0／10.0.1；`engines.node` ≥18 → ≥20.19.0                                                                              | 遷移指南 [sourced eslint.org/docs/latest/use/migrate-to-10.0.0]：移除 eslintrc（本專案已是 flat config）、Node ≥20.19／22.13／24、recommended 新增規則。實測 recommended diff：+`no-unassigned-vars`、+`no-useless-assignment`、+`preserve-caught-error`。`no-useless-assignment` 命中 `index.js:460` `let autoStart = true`（所有分支都會先指派）→ 移除初始值 |
| `7d6854c` | major：globals 15→17（經 16）        | 15.15.0→17.14.0                                                                                                                    | 無 changelog 於 tarball、GitHub release 在本 session 存取範圍外 [uncertain]；改以實測 key diff：`globals.browser` 移除 8 個 AudioWorklet 作用域名稱（本專案未用）、新增 86 個；`globals.node` 只新增 7 個。lint 輸出不變                                                                                                                                       |
| `6e95a50` | major：eslint-config-prettier 9→10   | 9.1.2→10.1.8                                                                                                                       | 實測匯出形狀不變（`{ rules }`），178 → 358 條規則，只新增 `@stylistic/*` 項目、無移除。注意此套件目前根本未在 `eslint.config.js` 套用（L3）                                                                                                                                                                                                                    |
| `99e699e` | vendored：ProgressBar.js 1.0.0→1.1.1 | 以 npm tarball `progressbar.js@1.1.1` 的 `dist/progressbar.min.js` 覆蓋（sha256 相同）                                             | 修 GHSA-89qm-hm2x-mxm3。1.1.1 是大幅重建（改用 lodash merge、新增 `Square`），故以 Node 端 smoke test 比對兩版 `Path` 原型方法集合與 `set(1)`/`set(0.5)` 的 `stroke-dashoffset` 結果：完全一致                                                                                                                                                                 |

升級後 `pnpm outdated`：無項目。

## 6. 修正（Phase 5）[verified]

| Commit    | 發現       | 變更                                                                                                                                                      | 測試                                                                                                      |
| --------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `39a4d5e` | H1         | `index.html` script 改為 `vue@3.5.44` + `integrity="sha384-tORx0bXmMnTC28EYQe1coaGZKSQupXQEYDBNex8xkzJ9iqUoNy9Y+VFBhVxi4kUr"` + `crossorigin="anonymous"` | N/A（HTML）。hash 來自 npm tarball；**部署後請開 console 確認無 integrity 錯誤**                          |
| `5065475` | H3         | `countDownTimer` 以 `remaining <= 0` 為唯一結束條件，同一 tick 播放音效並轉換                                                                             | 「回合結束」測試改為同 tick 轉換；「節流」測試改為斷言音效有播                                            |
| `5b7c912` | H4         | `notificationPermission = ref("Notification" in window ? Notification.permission : "denied")`                                                             | 「無 Notification API」測試由 `throws` 改為可掛載且 toggle 會自動關閉                                     |
| `6799999` | H5         | 四個音樂 `Audio` 設 `preload = "none"`                                                                                                                    | 新增斷言：音樂 `preload === "none"`、音效維持 `"auto"`                                                    |
| `af75b85` | H6（部分） | `index.scss` 與 `index.css` 末尾加一條 `:focus-visible` 規則（`!important` 壓過 id 巢狀的 `outline: none`）                                               | 無 CSS 測試；目測規則。副作用：`index.css` 的 `sourceMappingURL` 註解不再是最後一行（map 本就已過期，L1） |

## 7. 基準 vs 最終 [verified]

| 項目                                | 基準（`2c80bbe`）                  | 最終（`af75b85`）           |
| ----------------------------------- | ---------------------------------- | --------------------------- |
| 單元測試                            | 0（無框架）                        | 36／36 pass                 |
| `pnpm test`                         | shell grep，永遠 exit 0            | `node --test`，真實失敗語意 |
| ESLint（index.js + tests + config） | index.js 通過；config 自身無法解析 | 0 problems（ESLint 10）     |
| Prettier                            | 通過                               | 通過（Prettier 3.9）        |
| `pnpm run validate`                 | 13 ✓                               | 15 ✓、無 ✗／⚠               |
| `pnpm audit`                        | 25（13 high／11 moderate／1 low）  | 1 moderate                  |
| `pnpm outdated`                     | 5 套件落後                         | 0                           |
| Vue 載入                            | 浮動 `vue@3`，無 SRI               | `vue@3.5.44` + SRI          |
| ProgressBar.js                      | 1.0.0（GHSA high）                 | 1.1.1                       |
| 背景分頁回合結束                    | 多數情況無音效／通知               | 下一次喚醒即觸發            |
| 無 Notification API 的瀏覽器        | 空白頁                             | 正常運作、通知關閉          |
| 首次載入音訊下載                    | 最多 ~107 MB [estimate]            | 僅音效 ~72 KB               |
| 鍵盤焦點                            | 不可見                             | `:focus-visible` 外框       |

最終 commit 的實際指令輸出摘要：

```
$ pnpm test
# tests 36
# suites 0
# pass 36
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3092.869951

$ pnpm exec eslint index.js tests eslint.config.js
(no output — 0 problems)

$ pnpm exec prettier --check "*.{js,html,css,scss,json}" "tests/*.js"
All matched files use Prettier code style!

$ pnpm run validate
15 ✓, 0 ✗, 0 ⚠

$ pnpm audit
1 vulnerabilities found
Severity: 1 moderate

$ pnpm outdated
(empty)
```

Build：本專案無 build 步驟（靜態檔案直接部署），故「build 成功」以 lint + prettier + 測試取代。

### 7.1 剩餘弱點（blocked）

| 套件             | 公告                                                    | 嚴重度   | 路徑                                                                     | 原因                                                                                                                       |
| ---------------- | ------------------------------------------------------- | -------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| minimatch 10.2.x | GHSA-g3hv-75wg-m249（globparts 放大 DoS，修補 ≥11.0.1） | moderate | `eslint@10.14.0 > minimatch ^10.2.6`、`@eslint/config-array > minimatch` | **已於 §12.6 以 targeted override 解決**：eslint 10 最新版仍釘 `^10`，Dependabot 的 security update 因此在每次 push 後失敗 |

Critical／High：0 剩餘；override 後 `pnpm audit` 為 **No known vulnerabilities**。

## 8. 提案（未實作）

| 編號 | 來源        | 提案                                                                                                                                                                                         | 工作量               | 風險／備註                                                                |
| ---- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------- |
| P1   | M4、L2      | 將所有命令式 DOM 操作改為 Vue 宣告式綁定（`:class`／`:style`／`:disabled`），`removeTask` 直接 `splice`，任務 `key` 改用穩定 id，`shouldPlayMusic` 抽成單一 computed                         | L                    | 行為變動面大，需先有本次測試當安全網；是後續所有 UI 修正的前提            |
| P2   | M2          | `loadFromStorage` 以 `Number.isFinite` 回落預設、`Array.isArray(tasks)`；長期改為單一版本化 JSON blob（`settings.v2`）並保留一次性遷移                                                       | S（防護）／M（blob） | 低風險；blob 化需處理舊 key 清理                                          |
| P3   | H6 其餘、L4 | 設定分頁 `<li>` → `<button>`、任務勾選 `<div>` → `<button aria-pressed>`、計時器與回合名稱加 `aria-live="polite"`、`@media (prefers-reduced-motion: reduce)` 關閉 31 處動畫                  | S                    | 需同時改 SCSS 與已編譯 CSS（見 P6）                                       |
| P4   | M5、L4      | 移除 inline `oninput`（改 `@input` 方法）後加 `<meta http-equiv="Content-Security-Policy">`；若同時自架 fonts（L5）可把 `style-src`／`font-src` 收斂到 `'self'`                              | S                    | GitHub Pages 無法設 header，meta CSP 不支援 `frame-ancestors`／report-uri |
| P5   | M6、M7      | 通知權限只在設定 toggle 時請求、移除測試通知；`.play().catch(() => {})`；`sound.work`／`sound.break` 依語意改名                                                                              | S                    | 純行為修正                                                                |
| P6   | M8、L1      | 新增 `sass` devDependency + `build:css` script，刪除 `index.css.map`、`.idea/`、`vue.min.js`（Vue 2.6.14）、`validate.sh`、`scripts/validate.js`；`validate-simple.sh` 不再呼叫 `lint --fix` | S                    | 需新增相依與刪檔，本次依規範未執行                                        |
| P7   | L3          | 在 `eslint.config.js` 末尾套用 `eslint-config-prettier`，移除與 Prettier 衝突的 `indent`／`quotes`／`semi` 等 stylistic 規則（本次寫測試時已踩到 ternary 縮排衝突一次）                      | S                    | —                                                                         |
| P8   | —           | 加 GitHub Actions：`pnpm install --frozen-lockfile && pnpm test && pnpm exec eslint . && pnpm exec prettier --check .`；`permissions: contents: read`                                        | S                    | CI 設定變更，需確認                                                       |
| P9   | M3          | `musicState()` 內 DOM 變數改名 `musicTimingEl`，並補 null guard                                                                                                                              | S                    | 一行改名                                                                  |

## 9. 未執行事項與邊界

- 未刪除任何檔案（規範要求先確認）：`vue.min.js`、`validate.sh`、`scripts/validate.js`、`index.css.map`、`.idea/`。
- 未新增任何 npm 相依；測試完全使用 Node 內建模組。
- 未修改 CI／部署設定（本 repo 原本也沒有）、`.env*`（不存在）、lockfile 皆由 pnpm 產生。
- `.gitignore` 內範本留下的 `test/` 規則未動，測試放在 `tests/`。
- 本環境 proxy 封鎖 `unpkg.com` 與 `tomato.kouni.io`：SRI hash 來自 npm tarball（unpkg 直接提供 tarball 內容，理論上 byte 相同），線上 header 未能查核。

## 10. Commit 清單（`main..chore/health-check`）

```
7728bdd docs: add health-check report with stack inventory, baseline and audit findings
53dab28 test: add characterization tests for timer, settings and persistence
260c1df chore(deps): update devDependencies within semver ranges
b627e3b chore(deps): upgrade eslint and @eslint/js to v10
7d6854c chore(deps): upgrade globals to v17
6e95a50 chore(deps): upgrade eslint-config-prettier to v10
99e699e chore(deps): upgrade vendored ProgressBar.js 1.0.0 -> 1.1.1
39a4d5e fix(security): pin Vue CDN to 3.5.44 with Subresource Integrity
5065475 fix(timer): fire the end-of-round cue whenever the deadline has passed
5b7c912 fix: do not crash on browsers without the Notification API
6799999 fix(perf): stop preloading the four 25-28 MB music tracks on page load
af75b85 fix(a11y): restore a visible keyboard focus ring
```

---

## 11. UI 實測（Playwright + Chromium headless）[verified]

**環境**：`http-server` 本地提供檔案；unpkg 請求以 Playwright route 回填 npm tarball 內的 `vue.global.prod.js`（附 CORS header，讓 SRI 能驗證）；Google Fonts 以空 CSS stub；`page.clock` 控制 `Date`／timers；注入 axe-core 4.14.0。腳本位於 session scratchpad，**未納入 repo**（需新增 `playwright` devDependency，待確認）。視口：1280×800、1024×480、375×667、320×568。

### 11.1 通過項目

| 項目                   | 結果                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 掛載／首屏             | `v-cloak` 移除、`25:00`、4 個圓點、深色主題；0 console error、0 page error                                                                                                     |
| **SRI（H1）**          | 正向：Vue 3.5.44 以 `integrity` 載入成功。負向：回填內容多一個註解 → Chromium 報 `Failed to find a valid digest in the 'integrity' attribute`，`window.Vue` 未定義，app 不掛載 |
| **H5**                 | 首載只請求 3 個音效檔（206 Partial，共 67 KB）；4 個音樂檔 `preload=none`、無請求                                                                                              |
| **H3**                 | 1 分鐘回合：第 60 秒即播放音效並切換到下一回合（同一 tick），標題同步變成 😴                                                                                                   |
| 回合流程               | work → short → work → long → finished；圓點 `process`/`active` 正確；完成後顯示 `00:00`、標題還原、play 鍵回到 ▶；再按 play 從 round 1 重來                                    |
| 暫停／恢復／重置／快轉 | 暫停 10 秒不走、標題顯示 ⏸️、進度條 `stop`；恢復後每秒遞減；重置回 `01:00` 並清空圓點；快轉進入下一回合                                                                        |
| 設定面板               | 開關、三個分頁切換、滑桿即時更新標籤、音樂 toggle 啟用／停用 6 個控制項、深色模式切換 class、各組 Reset                                                                        |
| 音訊行為               | nature 淡入 30 ms × 75 步到 0.75；切曲目時前一首暫停；暫停計時器時音樂暫停、恢復時續播；`timing=work` 進入休息時停止；所有 `play()` 在 headless 皆 resolve                     |
| 待辦                   | 正規化、`!` 優先、勾選、第 9 筆被擋並顯示 3 秒訊息、刪除後完成狀態保留                                                                                                         |
| 持久化                 | reload 後設定、任務與完成狀態還原（17 個 key）                                                                                                                                 |
| **H6 focus ring**      | Tab 到按鈕時 `outline: solid 2px`、`:focus-visible` 命中                                                                                                                       |
| RWD                    | 四種視口皆無水平／垂直溢出；按鈕在視口內                                                                                                                                       |
| Vue dev build          | 以 `vue.global.js` 跑完整流程：**0 `[Vue warn]`**                                                                                                                              |
| axe 深色主題           | 無 color-contrast 違規                                                                                                                                                         |

### 11.2 新發現

| ID  | 嚴重度                          | 標題                                                                | 證據                                                                                                                                                                                                                                                                                                                                                 | 建議修法                                                                                                                                                                           | 工作量 |
| --- | ------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| U1  | Medium（已修 `dc2c584`）        | **鍵盤 Tab 進入關閉中的待辦側欄會把整個 app 左移 350 px、露出白底** | 第 22 次 Tab 聚焦 `#add-task`：`body.scrollLeft = 350`，`#main-container` 的 rect 變成 `-350..930`（截圖 `15-tab-scroll.png`）。側欄只是 `right: -350px` 移出視口，仍可聚焦；`html { overflow: hidden }` 擋不住 focus 引發的程式化捲動。左側設定側欄不會觸發（scrollLeft 無法為負），但其滑桿同樣可被 Tab 到（第 6 次 Tab：`x=-248, visible=false`） | 兩個 `.container` 加 `inert` 屬性，`openTab` 移除、`removeOverlay` 加回（約 4 行）；同時解決螢幕閱讀器讀到隱藏控制項                                                               | S      |
| U2  | Critical（axe，已修 `36d1846`） | 表單控制項與按鈕缺可讀名稱                                          | `button-name`：`#play`（內容只有 `<div>`）；`label` ×13：4 時間滑桿、2 音量滑桿、6 toggle、textarea；`select-name`：`#music-timing`；`list`：設定 nav `<ul>` 直接包含 `<hr>`；`landmark-one-main`／`region`                                                                                                                                          | `aria-label`／`<label for>`、`<main>`、把 `<hr>` 移出 `<ul>`                                                                                                                       | S      |
| U3  | Medium（已修 `e39107b`）        | 設定分頁與任務勾選完全無法用鍵盤操作                                | `nav li` 與 `.tick-container` 皆 `tabindex=-1`、無 `role`；22 個 Tab 停留點不含它們（H6 剩餘部分）                                                                                                                                                                                                                                                   | 改 `<button>`（分頁加 `role=tab`／`aria-selected`）                                                                                                                                | S      |
| U4  | Low（已修 `93f71d5`）           | `prefers-reduced-motion` 未處理                                     | `emulateMedia({ reducedMotion: "reduce" })` 後計時中仍有動畫在跑                                                                                                                                                                                                                                                                                     | `@media (prefers-reduced-motion: reduce)` 關閉進度條／按鈕動畫                                                                                                                     | S      |
| U5  | 誤報（見 §13.2）                | 淺色模式「Reset to Default」對比不足                                | axe `color-contrast`（serious）：`#add_page .default.underline`（截圖 `06-settings-add-light.png`）                                                                                                                                                                                                                                                  | 淺色主題給該按鈕較深的顏色                                                                                                                                                         | S      |
| U6  | Low（已修 `83273de`）           | Rounds=10 時圓點折成 3 行                                           | desktop／mobile 皆 3 行；與計時器、按鈕未重疊（截圖 `16-rounds10-desktop.png`）                                                                                                                                                                                                                                                                      | 縮小圓點間距或限制單行                                                                                                                                                             | S      |
| U7  | Low（已修 `19dd386`）           | `theme-color` 與預設主題不一致；body 背景透明                       | `meta theme-color=#ffffff` 而預設深色；`body` 背景 `rgba(0,0,0,0)` → 任何位移（如 U1）都露白                                                                                                                                                                                                                                                         | 依主題動態設定 `theme-color`；`body` 背景跟隨主題                                                                                                                                  | S      |
| U8  | Low（已修 `6330dd1`）           | 首載資源                                                            | 本地未壓縮：17 requests／393 KB，前四名 Vue 167 KB、`index.js` 48 KB、`progressbar.min.js` 41 KB、`index.css` 37 KB；兩個 Google Fonts stylesheet 為 render-blocking 且無 `preconnect`；DCL 141 ms（本地）                                                                                                                                           | `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`、合併為單一 fonts 請求、兩個 `<script>` 加 `defer`（保序）；GitHub Pages 會 gzip，實際傳輸約 1/3 [estimate] | S      |
| U10 | Low（已修 `b550d91`）           | 設定側欄固定 320 px + 20 px 內距，視口 < 340 px 時被裁切            | e2e `responsive.spec.js` 在 320×568 量到 panel 右緣 340 > 320；375 px 以上正常                                                                                                                                                                                                                                                                       | `.container { max-width: calc(100vw - 40px) }` 並讓 `#page-container > div` 跟隨寬度                                                                                               | S      |
| U9  | Info                            | 通知無法在 headless 驗證                                            | `grantPermissions(["notifications"])` 後 `Notification.permission` 仍為 `denied`（about:blank 亦然），屬環境限制                                                                                                                                                                                                                                     | 通知路徑目前只由單元測試覆蓋 [unverified in browser]                                                                                                                               | —      |

### 11.3 截圖

`scratchpad/ui/`：`01-load-dark`、`02-short-break`、`03-finished`、`04/05/06-settings-*`、`07-light-mode`、`08/09-todo*`、`10-focus`、`11/12/13-{mobile,short,tiny}*`、`14-infinite`、`15-tab-scroll`、`16-rounds10-*`。

---

## 12. 後續工作：U1–U3 修正、e2e 套件、Node 26、CI [verified]

### 12.1 修正

| Commit    | 發現 | 變更                                                                                                                                                                                                                                                                               | 驗證                                                                                      |
| --------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `dc2c584` | U1   | 兩個側欄 `.container` 加 `inert`，`openTab` 解除、`removeOverlay` 恢復                                                                                                                                                                                                             | unit：inert 切換；e2e：12 次 Tab 都不進入 `[inert]`、都在視口內、`body.scrollLeft` 恆為 0 |
| `36d1846` | U2   | 13 個控制項 + select + textarea 加 `aria-label`；`#play` 依狀態為「Start timer」／「Pause timer」；`role="main"`、兩側欄 `role="complementary"`；分頁圖示 alt 改為區段名稱                                                                                                         | e2e：axe 在深色主頁／設定／待辦、淺色主頁／設定（contrast 除外，U5）皆 0 違規             |
| `e39107b` | U3   | 設定分頁改為 `role="tablist"` 內的 `<button role="tab">`，`aria-selected` 由新 ref `activeTab` 驅動；任務勾選 `div` 加 `role="button" tabindex="0" aria-pressed` 與 Enter／Space；`index.scss`／`index.css` 選擇器 `ul/li → .tabs/[role="tab"]`，focus ring 涵蓋 `[role="button"]` | unit：`activeTab`；e2e：Tab 到分頁按鈕後 Enter 切換、Space／Enter 勾選任務                |

勾選維持 `div` 而非真正的 `<button>`，因為 `.task button` 的樣式規則專屬於右側的移除鍵，改成 button 會互相污染（見 `e39107b` 訊息）。

### 12.2 e2e 套件（`9fc36d3`）

- `@playwright/test` 1.64.1、`axe-core` 4.14.0、`vue` 3.5.44（devDependency，提供與 CDN 同版的 `vue.global.prod.js` 給 fixture 回填；瀏覽器仍對該 bytes 驗 SRI）。
- `tests/e2e/fixtures.js`：回填 unpkg、stub Google Fonts、記錄所有 `Audio`、**任何 console／page error 直接讓測試失敗**（`allowErrors` 可逐 describe 放行，只用於 SRI 竄改案例）。
- 26 個測試／6 個 spec：`smoke`（掛載、音樂不預載、SRI 正負向、landmark）、`timer`（faked clock 走完整回合、暫停／恢復／重置／快轉、autoBreak 關閉）、`settings`（分頁 aria-selected、滑桿、音樂控制、深色模式、reload 持久化）、`todo`（CRUD、鍵盤勾選、8 筆上限、reload 持久化）、`a11y`（axe ×5 狀態、Tab 不進側欄、鍵盤切分頁、focus ring）、`responsive`（375／320／1024×480）。
- 時間推進用 `clock.fastForward`：每個 timer 只觸發一次，正是節流分頁的行為，且 1 分鐘的跳躍只需毫秒（`runFor` 會逐幀重播進度條動畫，單一測試即超過 30 s）。
- 另加 `tests/sri.test.js`：`index.html` 的 Vue 版本與 `integrity` 必須等於 `node_modules/vue` 的版本與 sha384，版本漂移會在 `pnpm test` 失敗。
- 本機沙箱以 `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium` 指向預裝瀏覽器；CI 用 `playwright install --with-deps chromium`。

### 12.3 Node 26 與相依（`80d5607`）

- `.nvmrc` = `26.13.0`（registry 上 `node` 套件 2026-11-02 的最新 26.x）；`engines.node` = `>=26.13.0 <27`；`packageManager` = `pnpm@10.28.0`。
- 在 Node 26.13.0 實跑：unit 39／39、e2e 26／26、ESLint 0、Prettier 通過；Node 22.23 亦通過。
- `pnpm outdated`：無；`pnpm audit`：仍為 1 moderate（minimatch 經 eslint，§7.1）。

### 12.4 CI（`e8ebe98`）

`.github/workflows/ci.yml`：push 到 `main` 與 pull request 觸發；`permissions: contents: read`；Node 來自 `.nvmrc`、pnpm 來自 `packageManager`、`--frozen-lockfile`；依序 ESLint → Prettier → unit → `playwright install --with-deps chromium` → e2e；失敗時上傳 Playwright HTML report。部署仍由 GitHub Pages 的 `pages-build-deployment`（deploy from branch）負責，未更動。

### 12.5 最終驗證指令輸出（Node 26.13.0）

```
$ node --version
v26.13.0
$ pnpm test
ℹ tests 39 / ℹ pass 39 / ℹ fail 0
$ pnpm exec playwright test
26 passed (24.6s)
$ pnpm exec eslint index.js tests eslint.config.js playwright.config.js
(0 problems)
$ pnpm exec prettier --check "*.{js,html,css,scss,json}" "tests/**/*.js"
All matched files use Prettier code style!
$ pnpm outdated
(empty)
```

### 12.6 Dependabot security update 失敗（override 解決）[verified]

- **現象**：`main@0bfcdda` 推上後，Actions 內 `npm_and_yarn in /. for minimatch - Update #1675092915` 失敗；CI、CodeQL、Pages 三者皆成功。
- **根因**（job log）：`security_update_not_possible` — `latest-resolvable-version: 10.2.6`、`lowest-non-vulnerable-version: 11.0.1`。eslint 10.14.0 與 `@eslint/config-array` 0.23.5 都釘 `minimatch ^10`，Dependabot 無法在不改 eslint 的前提下升到 11，因此每次 push 都會重試並失敗。
- **處置**：`package.json` 加 `pnpm.overrides`：`"eslint>minimatch": "^11.0.1"`、`"@eslint/config-array>minimatch": "^11.0.1"`（只覆蓋這兩條路徑，不影響未來其他需要 minimatch 3/9 的套件）。可行性依據：兩個消費者都是 `require("minimatch")`，minimatch 11.0.4 仍提供 CJS 入口（`main: ./dist/commonjs/index.js`），engines `20 || >=22`。
- **驗證**：`pnpm audit` → No known vulnerabilities；Node 22.23 與 26.13：ESLint 0 問題（ignores／glob 皆經 minimatch）、unit 39／39、e2e 26／26；`pnpm install --frozen-lockfile` 通過。
- **殘餘風險**：這是跨 major 的 override，eslint 若未來依賴 minimatch 10 特有行為會在 lint 階段顯現；eslint 官方升到 minimatch 11 後即可移除 override。

---

## 13. 第三輪：剩餘發現全部處理 [verified]

本輪 14 個 commit（`21eaf32..`），每個都在 Node 22.23 與 26.13 跑過 ESLint／Prettier／unit／e2e；最終：unit 47／47、e2e 28／28、`pnpm audit` 無弱點、`pnpm outdated` 空、`build:css` 產出與 commit 一致。

| Commit    | 項目                           | 變更                                                                                                                                                                                                                                                                                                                                                       |
| --------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `7f3bdd9` | M8                             | `sass` devDependency + `build:css`（sass → prettier）；`index.css` 改為編譯產物（與舊 IDE 產出只有規則順序差異，cascade 不變）；刪 `index.css.map`；CI 加 `build:css && git diff --exit-code`                                                                                                                                                              |
| `6330dd1` | L5／U8                         | 自架 Roboto：一個 43 KB variable woff2（latin，100–700，Apache-2.0，`assets/fonts/README.md`）、`font-display: swap`；移除兩個 render-blocking 的 Google Fonts 連結（其中 PT Sans 從未實際渲染）；smoke 測試斷言唯一第三方請求是釘版的 Vue                                                                                                                 |
| `92ce500` | L3                             | `eslint-config-prettier` 置於最後、移除與 Prettier 重複的 stylistic 規則                                                                                                                                                                                                                                                                                   |
| `93f71d5` | U4                             | `@media (prefers-reduced-motion: reduce)` 讓所有 animation／transition 趨近 0（含 `btnHover` mixin 的 `!important` transition）；進度弧改為每 tick `set()` 而非 tween                                                                                                                                                                                      |
| `19dd386` | U5／U7                         | `html` 背景隨主題（預設深色 `#121212`，`.light-theme` 為 `#f43147`）；`applyTheme()` 同步根元素 class、`#main-container` class 與 `theme-color` meta；淺色 Reset 按鈕改 `#d32f2f`（4.98:1），深色維持原色；axe 淺色模式不再排除 contrast                                                                                                                   |
| `83273de` | U6                             | 圓點容器上限 123→260 px（短視口 99→230 px），10 個圓點單行                                                                                                                                                                                                                                                                                                 |
| `b550d91` | U10                            | 兩個側欄 `max-width: calc(100vw - 40px)`，設定分頁寬度改 100%                                                                                                                                                                                                                                                                                              |
| `02b22c8` | M2／M6／M7／L4                 | `loadFromStorage` 數值 `Number.isFinite` 回落、`musicPref`／`musicTiming` 白名單、`tasks` 必須為陣列；`playSafely()` 吞掉 autoplay 拒絕；音效 key 改為 `breakStart`／`workStart`／`finish`；通知權限改在首次按 play（使用者手勢）請求，移除測試通知；刪 `toggleDarkMode` no-op、typo、manifest 名稱                                                        |
| `b594978` | M5／L4                         | meta CSP：`script-src 'self' https://unpkg.com 'unsafe-eval'`（Vue 瀏覽器端模板編譯需要）、`style-src 'self' 'unsafe-inline'`、img／font／media／connect `'self'`、`object-src 'none'`、`base-uri 'self'`；移除 textarea 的 inline `oninput`（它本來就是死碼：`white-space: pre` + Enter 送出，永遠單行）；e2e 以同源 route 注入 axe，CSP 在測試中保持生效 |
| `69b2dbc` | L1／M1                         | 刪 `vue.min.js`、`validate.sh`、`scripts/validate.js`；`validate-simple.sh` 重寫為會失敗的檢查（含 `index.css` 同步）                                                                                                                                                                                                                                      |
| `59b04d7` | M4（任務）                     | 任務帶穩定 `id` 作 `v-for` key（舊存檔載入時補 id）；completed／priority／tick／remove 動畫／「已滿」狀態全部是模板綁定；移除掛載時重貼 class 的迴圈與「翻轉兩次 completed」的 workaround；移除鍵有 aria-label                                                                                                                                             |
| `69cd237` | M4（計時器）／M3／L2           | `dotClass(i)` + `finished` ref 取代所有對圓點的 DOM 操作；`playFunc` 依 `playState` 分支而非讀自己的 CSS class；`shouldPlayMusic()` 取代 4 份重複判斷（順帶消除 `musicState` 的變數遮蔽）                                                                                                                                                                  |
| `0cbc4a0` | M4（側欄／分頁／音樂控制）／L2 | `settingsOpen`／`todoOpen` 驅動 `.open` class、overlay 與 `inert`；分頁偏移改 computed style；音樂控制項 `:disabled`／`:class` 綁 `isMusic`，`<select>` inline style 移入 SCSS；bottom 的兩份 window 監聽合併為一個 resize listener                                                                                                                        |

**量化**：`index.js` 1342 → 1083 行；`document.querySelector*` 呼叫 30+ → 2 處（`applyTheme()` 作用於掛載模板之外的 `<html>`／meta，`adaptTodoContainer()` 的高度計算）；`index.html` 不再有 inline event handler。

### 13.1 刻意保留

- `.idea/`：仍在 repo。從 git 移除會在作者 `git pull` 時刪掉本機的 WebStorm 專案設定（含 Hostinger 部署對映），這要由作者自行決定；`.gitignore` 已涵蓋大部分敏感 IDE 檔。
- 任務勾選仍是 `div[role=button]` 而非 `<button>`：`.task button` 的樣式規則專屬移除鍵。
- CSP 的 `'unsafe-eval'`：Vue 在瀏覽器內編譯 in-DOM 模板必須用 `new Function`。要拿掉需要引入建置步驟預編譯模板（Vite + SFC），屬另一個專案。
- U9：headless 無法驗證通知；程式路徑由 unit 測試覆蓋。

### 13.2 U5 修正：原為誤報

CI 上 `axe finds no violations in light mode` 失敗、本機通過。追查後：淺色模式下 Reset 按鈕的顏色來自 `#settings-container .container #page-container button.default { color: #141414; transition: color 0.2s }`（specificity 高於 `.underline`），對白底對比約 16:1。axe 回報 contrast 不足是因為在切換主題後 200 ms 的顏色 transition 期間取樣（CI runner 較快，每次都撞到；本機剛好錯過）。處置：`19dd386` 中對 `.underline` 的顏色調整還原（它對這顆按鈕從未生效），e2e 在量測前先等按鈕顏色到達 `rgb(20, 20, 20)`。U5 不是真實的對比問題。

---

## 14. 回報：「第二輪自己停著」複查 [verified]

### 14.1 重現嘗試（真實時鐘、headless Chromium 153）

| 情境（work／short／long 皆 1 分鐘）              | 結果                                                          |
| ------------------------------------------------ | ------------------------------------------------------------- |
| normal，rounds=2，跑完整 4 個 round（250 s）     | work → short → work → long → finished，每個轉場準時、自動開始 |
| normal + 通知權限 granted（stub `Notification`） | 第二輪自動開始，通知發出 1 則                                 |
| infinite + 音樂（nature，timing=both）           | 第二輪自動開始，音樂持續                                      |
| normal + 音樂 timing=breaks                      | 休息時音樂開始、工作時停止，轉場正常                          |
| infinite（用 checkbox 點選）rounds=4             | 第二輪休息、第三輪工作，正常                                  |
| **infinite（用 checkbox 點選）rounds=1**         | **round 2 沒有休息，直接重來工作（B1）**                      |

沒有任何組合出現「第二輪停著」。

### 14.2 找到的 bug：B1（`3abaa8a`）

`<input type="checkbox" v-model="infinite" @input="changeInfinite">`：checkbox 的 v-model 在 `change` 事件更新，但 `@input` 先觸發，`changeInfinite()` 讀到舊的 `infinite`，走到「關閉 infinite」分支把 `totalRound` 設成 `roundRange*2` 而非 999。結果：infinite 模式在 `roundRange*2` 的 round 直接重來（跳過長休息），rounds=1 時完全沒有休息。修法：改用 `@change`（v-model 的監聽先註冊、先執行）。e2e 新增假時鐘測試（點 checkbox 後 work／short 交替三輪）與真實時鐘測試。

### 14.3 你看到的「停著」最可能的成因

程式上只有兩類路徑會讓第二輪不動：

1. **設定**：第三個設定分頁的「Auto-start breaks」為關（第二輪＝休息不自動開始）、或「Auto-start pomodoros」為關／「Don't start auto-pomodoro if To Do List is empty」為開且清單空（第二個工作回合不自動開始）。這些值存在 `localStorage`，和 infinite 無關，符合「不管是不是 infinite」。確認方式：第三分頁按「Reset to Default」再試一次。
2. **轉場副作用丟例外**：舊流程在 `clearInterval` 之後、`countDownTimer()` 之前依序執行音效、通知、音樂、進度弧動畫；任一個在特定瀏覽器丟例外（例如 Android Chrome 的 `new Notification()` 是 Illegal constructor、`Audio.volume` 超出範圍的 IndexSizeError、tween 例外），interval 就不會重建，畫面停在下一輪的 `01:00`。headless 重現不了，但這個失敗模式現在已被結構性排除：所有副作用經 `safely()`（例外交給 `reportError`），`countDownTimer()` 先於動畫執行；unit 測試以會丟例外的 `Audio.play()` 驗證轉場仍完成。

若 Reset to Default 後仍停住，請提供瀏覽器名稱／版本與 DevTools console 的錯誤訊息，就能直接定位。

### 14.4 為何原本的測試沒抓到

- 所有 e2e 都用 Playwright 假時鐘 `fastForward`，真實 `setInterval`、ProgressBar 的 tween、音訊 cue 從未在轉場時真的執行；unit 測試的 ProgressBar／Audio 都是 fake。現已加 `tests/e2e/realclock.spec.js`：兩個測試以真實時間走過 1 分鐘回合的轉場（normal 與 infinite），斷言轉場在 59–63 秒之間、下一輪在 12 秒內倒數到 `00:5x`。
- B1 需要「用滑鼠點 checkbox」才會發生（事件順序），unit 測試直接設 `infinite.value` 看不到，舊 e2e 只檢查圓點隱藏。
- 只在 Chromium 測。CI 現在同時跑 Chromium、Firefox、WebKit。

### 14.5 本輪 commit

| Commit                | 內容                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1 + safely           | `@input` → `@change`；`safely()` 包住 `soundEffect`／`handleMusicForBreak`／工作回合音樂／`animateBar`；`countDownTimer()` 先於 `animateBar`；unit：丟例外的 cue 不中斷轉場；e2e：infinite checkbox 交替三輪 |
| real clock + browsers | `tests/e2e/realclock.spec.js`（2 tests，約 130 s）；`playwright.config.js` 在 CI 加 firefox／webkit；CI 安裝三個瀏覽器                                                                                       |

### 14.6 跨瀏覽器 CI 第一次跑出的問題：WebKit 不理會 `preload="none"`

Chromium／Firefox 全綠，WebKit 的 smoke 測試失敗：Safari 在 `Audio` 元素一拿到 `src` 就開始請求，不論 `preload` 是在之前或之後設定（`d5832f1` 先設 `preload` 再設 `src` 仍失敗）。最終做法（`8795807`）：建立元素時不給 `src`，URL 放在 `dataset.src`，`musicOn()` 第一次播放前才指定；沒有 `src` 的元素在任何引擎都不會發請求。unit 測試改以 `dataset.src` 查找（`d735ca7`）。這表示 H5 在此之前對 Safari 使用者其實沒有生效。

### 14.7 分支清理

所有 commit 以 fast-forward 併入 `main` 後，`chore/health-check` 已從遠端與本機刪除；`claude/trusting-ramanujan-rbf2fe` 是本次 session 的工作分支（內容等於舊的 `main`），未動。

### 14.8 結案：「第二輪停著」＝ 清單空的 auto-start 守門員

使用者回報停住時按鈕是 ▶、Auto-start pomodoros 開、待辦清單空：這是「Don't start auto-pomodoro if To Do List is empty」開關生效。原本的語意是「清單空時，每一個後續番茄鐘都不自動開始」，一個 4 輪 session 會在第二個番茄鐘無聲停住，畫面除了 ▶ 之外沒有任何提示——不合理。

修正（語意變更）：

- 守門員只在**開始 session** 時檢查：開關開且清單空時，▶ 不會開始，並在計時器內顯示「The to-do list is empty. Add a task to start a pomodoro.」；session 一旦開始，中途不再因清單空而停下，4 輪就是 4 輪。
- 其他 armed 狀態（Auto-start pomodoros／breaks 關）在計時器內顯示原因，分頁標題改為 ⏸️ Paused，不再被誤認為當機。
- unit／e2e 各加三個情境；真實時鐘測試維持。

### 14.9 回歸測試（避免再發生）

| 問題                                      | 測試                                                                                                                                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4 輪 session 在第二個番茄鐘停住（守門員） | unit `a four-round session runs every round even when the to-do list empties`；e2e `a four-round session with the empty-list guard runs to the end`（8 個 round 逐一斷言「正在倒數」、最後自動結束、新 session 才被擋） |
| 守門員語意                                | unit `the empty-to-do guard only blocks starting a session`；e2e `the empty-to-do guard blocks only the start of a session`                                                                                             |
| armed 狀態無提示                          | unit `an armed break…`／`an armed work round…`；e2e `with auto-start breaks off…` 斷言 `role=status` 文字與 ⏸️ 標題                                                                                                     |
| infinite checkbox 讀到舊值（B1）          | e2e `infinite mode toggled from the checkbox…`（假時鐘）＋ `real clock: infinite mode…`（真實時鐘，三瀏覽器）                                                                                                           |
| 轉場副作用讓 interval 消失                | unit `a throwing audio cue does not stop the round transition`                                                                                                                                                          |
| 真實時間下的轉場                          | e2e `realclock.spec.js` ×2（Chromium／Firefox／WebKit）                                                                                                                                                                 |
| Safari 載入時抓音樂檔                     | e2e smoke（三瀏覽器）斷言音樂元素無 `src`、無 mp3 請求                                                                                                                                                                  |

### 14.10 真實時鐘測試加速

真實時鐘測試原本每個 130 秒，三個瀏覽器佔 CI 六分鐘以上，再加測試就跑不完。`index.js` 加入 `MINUTE`：只有在 `localhost`／`127.0.0.1` 且 URL 帶 `?minute=N` 時，一「分鐘」才等於 N 秒；正式站固定 60（unit 測試鎖住這個 gating）。真實時鐘測試改開 `index.html?minute=3`，真實的 `setInterval`／tween／音效照常執行，三個測試（轉場與自動開始、infinite、暫停／恢復跨轉場）合計約 20 秒。

## 15. 重構：Vite 8 + SFC + PWA（方案 B）[verified unless marked]

### 15.1 結論

選型評估後採方案 B：維持 Vue 3，改為 Vite 8 建置的單檔元件（SFC）專案，加上 PWA（可安裝、離線可用）、Web Worker 計時、Service Worker 通知與 Wake Lock；所有套件升到最新；功能與畫面以既有 e2e、真實時鐘測試與前後截圖逐像素比對驗收。未換框架（Svelte／Solid 等）：本應用的瓶頸不在 runtime，而在載入來源（CDN 第二個 origin）與背景分頁的計時器節流，這兩項方案 B 都解掉，且不需重寫業務邏輯。

### 15.2 目錄結構

```text
index.html              Vite 入口（CSP、icons）
vite.config.js          plugin-vue、vite-plugin-pwa（manifest、Workbox 預快取）
src/main.js             mount App.vue、註冊 service worker
src/App.vue             原 index.html 的 template 原樣搬入 + composables 組裝
src/composables/        useTimer、useSettings、useTodo、useAudio、useNotifications、
                        useTicker、useWakeLock、useTheme、useUi
src/lib/                純函式：time.js、storage.js
src/workers/ticker.js   每秒一個 tick 的 Web Worker
src/styles/main.scss    原 index.scss；index.css 不再進 repo
public/                 原樣複製：audio/、fonts/、icons/、sw-notify.js、CNAME
tests/unit/             composables 測試（harness.js 以假物件組裝真實 composables）
tests/e2e/              Playwright，對 vite preview 的正式建置執行
```

舊的 `index.js`（約 900 行、全域 `Vue.createApp` + in-DOM template）、`progressbar.min.js`（改用 npm 套件 `progressbar.js`）、`index.css`、`assets/favicon/site.webmanifest`（由 plugin 產生 `manifest.webmanifest`）刪除。`localStorage` 的 key 與格式不變，使用者設定與待辦清單在升級後保留（persistence unit 測試鎖住）。

### 15.3 使用者有感的變更

| 項目           | 之前                                                   | 現在                                                                                                     |
| -------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 載入來源       | 兩個 origin（GitHub Pages + unpkg CDN），`unsafe-eval` | 單一 origin，CSP `script-src 'self'`，無 SRI／CDN 失效風險                                               |
| 第二次開啟     | 每次都走網路                                           | App shell 與三段提示音效預快取，離線可開、可計時；音樂第一次播放後快取（CacheFirst，支援 range request） |
| 安裝           | 無                                                     | manifest + service worker，可「加入主畫面」以獨立視窗執行                                                |
| 背景分頁計時   | 頁面 `setInterval` 被節流，靠切回時以牆鐘重算          | Web Worker 每秒 tick（不受分頁節流）+ `visibilitychange` 重算，兩者皆以牆鐘為準                          |
| 背景通知       | `new Notification()`，Android Chrome 不支援            | 優先走 `registration.showNotification()`，點擊通知回到 app（`public/sw-notify.js`）                      |
| 回合進行中螢幕 | 可能自動熄滅                                           | `navigator.wakeLock` 於倒數時持有、暫停／結束釋放、切回分頁重新取得（不支援的瀏覽器靜默略過）            |
| 更新           | 靠瀏覽器快取策略                                       | service worker `autoUpdate`：下次開啟即取得新版                                                          |

### 15.4 數據（measured，本機建置）

首次載入需下載的 HTML／JS／CSS（不含音訊、字型、icons，兩版相同）：

| 檔案               | 之前 raw / gzip      | 現在 raw / gzip                            |
| ------------------ | -------------------- | ------------------------------------------ |
| index.html         | 27,201 / 3,670       | 1,783 / 701                                |
| 應用程式 JS        | 40,281 / 8,461       | 137,632 / 47,545（含 Vue、progressbar.js） |
| Vue（CDN）         | 170,605 / 61,997     | —                                          |
| progressbar.min.js | 42,369 / 12,685      | —                                          |
| CSS                | 39,877 / 5,523       | 30,572 / 4,679                             |
| 合計               | 320,333 / **92,336** | 170,159 / **52,925**                       |

gzip 後少 39,411 bytes（−43%），HTTP 請求 5 → 3，且省掉對 unpkg 的 DNS／TLS 握手（行動網路上估計 100–300 ms，estimate）。之後才載入：`ticker` worker 174 B、workbox-window 5,653 B、`sw.js` 3,098 B、manifest 445 B。預快取 29 個項目（app shell、icons、字型、三段音效 break／work／finish）。

### 15.5 驗收

- unit：51 passed（`tests/unit`，Node 26.13.0）。
- e2e：33 passed（Chromium，本機）；含三個真實時鐘測試與新的 PWA 測試（manifest、service worker scope）。Firefox／WebKit 在 CI 執行，結果見 15.6。
- 截圖比對（Chromium headless，deviceScaleFactor 2，`prefers-reduced-motion`）：舊版以 `main` 的靜態檔案（Vue 以本機副本頂替 CDN）、新版以 `vite preview dist/`，PIL 逐像素比對（任一通道差 > 8 視為不同）：

| 場景             | 尺寸      | 不同像素 |
| ---------------- | --------- | -------- |
| desktop-dark     | 2560×1600 | 0        |
| desktop-light    | 2560×1600 | 0        |
| desktop-settings | 2560×1600 | 0        |
| desktop-todo     | 2560×1600 | 0        |
| mobile-dark      | 780×1688  | 0        |

### 15.6 CI／CD 與切換

- `ci.yml`：lint、prettier、unit、`vite build`、Playwright（Chromium／Firefox／WebKit）；改為每個 branch 的 push 都跑（本 session 的 GitHub App 無 `actions: write`，無法 `workflow_dispatch`，先前的 `pages-build-deployment` 亦非本 session 可觸發）。
- `deploy.yml`：push 到 `main` 時 build `dist/` 並以 `actions/deploy-pages` 發布；`configure-pages` 帶 `enablement: true`。
- 零停機切換順序：(1) 你在 repo Settings → Pages 把 Source 從「Deploy from a branch」改為「GitHub Actions」——舊版頁面此時仍持續提供；(2) 我把 `refactor/vite-pwa` fast-forward 到 `main`，`deploy.yml` 建置並發布新版；(3) 驗證 tomato.kouni.io。若 (2) 失敗，線上仍是舊版，修好再推一次即可。**不可**反過來先 merge 再切 Source：legacy builder 會把原始碼目錄當網站，`/src/main.js` 無法執行，站會壞到切換完成為止。

CI 結果：run #16（`da357f8`）全綠，Chromium／Firefox／WebKit 各 33 個 e2e、unit 51、lint、prettier、build，3 分 41 秒。第一次跑（#15）在 webServer 等待逾時：runner 上 `localhost` 先解析成 `::1`，`vite preview` 只聽 IPv6，Playwright 探測 `127.0.0.1` 永遠不通；修法是 `preview` script 加 `--host 127.0.0.1`（本機 Firefox／WebKit 無法安裝：網路政策擋 `cdn.playwright.dev`，所以這兩個引擎只在 CI 驗證）。runner 另有警告：`checkout@v4`／`setup-node@v4`／`upload-artifact@v4`／`pnpm/action-setup@v4` 以 Node 20 為目標、被強制跑在 Node 24，目前可用，下次整理 CI 時升 major。

### 15.7 未驗證／風險

- `actions/checkout@v4`、`setup-node@v4`、`configure-pages@v5`、`upload-pages-artifact@v3`、`deploy-pages@v4` 的版本沿用既有 CI 慣例，未查證是否有新 major [unverified]。
- `github-pages` environment 若有「僅允許 main」的 deployment branch 規則，不影響此切換（只從 `main` 部署）。
- PWA 安裝、Wake Lock、Service Worker 通知只在 headless Chromium 以 API 層驗證（e2e `serviceWorkers: "allow"`），未在實體手機測試；Safari 的 Wake Lock 需 16.4+，Firefox 不支援 Wake Lock（靜默略過）。
- 音樂快取 CacheFirst 以 `maxEntries: 8` 限制，四首 25–28 MB 的 mp3 全聽過一遍會佔約 110 MB 的 Cache Storage；瀏覽器配額不足時 Workbox 會略過快取，不影響播放。
