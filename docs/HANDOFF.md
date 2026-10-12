# 樂透工具 · 交接說明

> 更新:2026-10-12　最後 commit:`33dc8cf`　讀完這份就能接手,不需要看對話紀錄。

## 1. 現況
- **線上網站**:https://tongxiaooppo-boop.github.io/lotto-lucky/
- **repo**:https://github.com/tongxiaooppo-boop/lotto-lucky(public,MIT)
- **本機**:`D:\ok\lotto`。雙擊 `start.bat` 或 `python -m http.server 8000`,開 http://localhost:8000(不能直接雙擊 `index.html`,瀏覽器會擋 `fetch`)。
- **PRD(`docs/PRD.md`)M0~M5 全部完成**,細節見 §6 的未完成清單。
- 純前端,原生 JS ES 模組,**無 build**。部署 = GitHub Pages(`pages.yml` 只發布 `index.html css js data`)。

## 2. 功能(三個遊戲都有)
| 分頁 | 內容 |
|---|---|
| 開獎 | 近 N 期或日期區間(重號標綠、可顯示銷售額)、**從官網更新**、手動輸入、匯入官方 CSV、本機資料匯出/還原/清除、期別連號檢查 |
| 統計 | 範圍(全部/最近 N 期/日期區間;預設 539=300、大樂透/威力彩=100)。區塊:次數、連莊、遺漏、近期、重號、和值、奇偶大小、檢定(卡方)、冷熱(含 z-score)、隔期、鄰連號、區段、尾數、跨度、配對、重現、星期月份、銷售、拖牌、型態。大樂透「特別號」/威力彩「第二區」可切換,其中 13 個區塊適用 |
| 選號 | 固定號碼、增加號碼(包牌 +1/+2)、特別號/第二區選法與個數、**回測組合按鈕**、配方編輯器、10 種一鍵策略、多組不重複、條件過濾、多注覆蓋、儲存/匯出/匯入配方 |
| 回測 | 單一策略、全策略比較、特別號/第二區來源比較;Web Worker 背景執行 |
| 說明 | 定位聲明、資料出處、各統計白話解釋 |

## 3. 專案結構
```
index.html, css/style.css           漫畫風(參考 D:\ok\jioka2)
js/core/games.js                    三個遊戲的規格(號碼數、範圍、特別號、每注金額、預設期數)
js/core/presets.js                  回測組合按鈕(由 tools/preset_search.mjs 產生,勿手改)
js/core/presets_extra.js            特別號/第二區回測組合(由 tools/preset_search_extra.mjs 產生,勿手改)
js/data/store.js                    讀 data/*.json + localStorage(本機資料、備份)
js/data/official.js                 官網 JSON 介面抓取(瀏覽器與 Node 共用)+ 重試/退避
js/data/recipes.js                  儲存的配方(localStorage)
js/engine/draws.js                  驗證、CSV 解析、合併、連號檢查
js/engine/stats/index.js, more.js   所有統計(純函式)
js/engine/recipes/index.js          配方、均衡型、純隨機、包牌展開、特別號/第二區選號
js/engine/recipes/strategies.js     其餘一鍵策略、多注覆蓋、條件過濾、多組產生
js/engine/backtest/                 回測(index.js 引擎、job.js 入口、worker.js)
js/ui/                              各分頁(app/draws/stats/stats_more/pick/backtest/help/widgets/dom)
tools/                              build_json.py、fetch_latest.mjs、check_data.mjs、preset_search.mjs、test_*.mjs
history/                            原始 CSV(依年份)+ api/(官網介面抓取)
data/                               今彩539.json、大樂透.json、威力彩.json(build_json.py 產生)
.github/workflows/                  check.yml、pages.yml、update-data.yml
book/                               外部 5 個 repo 與分析(已 .gitignore,不會上傳)
```

## 4. 資料管線
- **官方 CSV**(台灣彩券官網「歷史開獎號碼下載」)約**每月才更新一次**,放進 `history/`。
- **官網 JSON 介面**(官網網頁背後使用,允許跨網域):`api.taiwanlottery.com/TLCAPIWeB/Lottery/{Daily539Result|Lotto649Result|SuperLotto638Result}`,含號碼、銷售額、總獎金。**未公開文件**,格式可能改版;使用條款未確認。
- 抓到的資料寫入 `history/api/<遊戲>_api.csv`(官方 CSV 格式)。
- `python tools/build_json.py`:先處理 `api/`、`manual/`,再處理官方 CSV,**同期別以官方 CSV 為準**,輸出 `data/*.json`。
- `node tools/fetch_latest.mjs`:與既有資料同期別但號碼不同 = 衝突,不寫入、結束碼 1(等人工確認)。`--dry` 只檢查不寫檔。
- **自動更新**:`update-data.yml` 每週一到六台灣 21:30(UTC 13:30),抓取 → 重建 JSON → 驗證 → commit → 觸發 `pages.yml`。有 `concurrency` 與 10 分鐘 timeout。手動:Actions 頁面 → update-data → Run workflow。
- 網頁「從官網更新」把新資料存在**使用者自己的瀏覽器**(標示「本機」),不會寫回 repo。

## 5. 測試與驗證
```bash
node tools/check_data.mjs          # 資料:號碼數/範圍/重複/期別重複/日期遞增
node tools/test_engine.mjs         # 驗證、CSV、合併
node tools/test_stats.mjs          # 核心統計(手算樣本 + 卡方 p 值)
node tools/test_stats_more.mjs     # 其餘統計
node tools/test_recipes.mjs        # 配方、包牌、特別號選號
node tools/test_strategies.mjs     # 一鍵策略、覆蓋、過濾
node tools/test_backtest.mjs       # 回測(含不洩漏未來資料、特別號回測)
node tools/test_official.mjs       # 官網抓取(假 fetch,不連網)
node tools/test_presets.mjs        # 回測組合按鈕
node tools/test_presets_extra.mjs  # 特別號/第二區回測組合
```
CI(`check.yml`)在每次 push 跑資料驗證與上述測試。UI 沒有自動化測試,我是用 headless Chrome 透過 CDP 腳本逐頁點過(腳本在暫存資料夾,**不在 repo**)。

## 6. 未完成 / 待決
**未做**
- 第二區/特別號沒有均衡型、冷熱混合等多號策略(只有 1~數個號碼,不適用);已有統計來源 + 兩種加權隨機。
- 沒有在真的手機、Safari、Firefox 上驗證過畫面(只用電腦版 Chrome 無頭模式 480px 寬截圖)。
- 自動更新**「有新資料時」自動 commit 並重新發布**那一段沒驗證過(只驗證到「沒有新資料」)。下一次有新開獎後去 Actions 頁面確認。
- 官網 CSV 與 API 的**使用條款未確認**。API 格式改版時抓取會失敗,手動輸入與 CSV 匯入是備援。

**可選的想法**
- 匯出 xlsx(來自 taiwan-lottery-dashboard 的做法,優先度低)。
- 保存「開出順序」`drawNumberAppear`(官方 CSV 沒有,統計價值低)。

## 7. 重要結論與決策(完整版見 `docs/decisions.md`)
- **回測結論:沒有任何策略穩定優於純隨機。** 全歷史(539 5,960 期、大樂透 2,147 期、威力彩 1,923 期)、2 種歷史窗口、3 個種子,共 180 次檢定、13 次 p<0.05,換種子即消失,校正多重比較後沒有一個成立。
- **回測組合按鈕**(主號與特別號/第二區皆有;第二區測試段 diff 全在 ±0.01 內,同樣無優勢):前半段歷史挑、後半段歷史驗證,介面上同時顯示兩段成績。測試段多半回到 0 附近;大樂透 4 個組合測試段約 +0.04~+0.05(最佳 p=0.042,但未校正且彼此相關),僅值得之後觀察。
- 定位:描述歷史 + 娛樂,所有選號頁面固定顯示免責聲明。不做「綜合評分」「高機率」之類說法。
- 大樂透特別號是開獎附加號,**投注時不用選**:選號頁只當「參考」,不計入注數/金額。威力彩第二區要選,可 1 個~全部 8 個(全包)。
- 每注金額:539 與大樂透 50 元、威力彩 100 元(**憑記憶設的,請核對**,在 `js/core/games.js`)。
- 外部 5 個 repo 的分析在 `book/analysis/`(`SUMMARY.md`):只採用重試退避、workflow 設定、z-score/拖牌/AC 值;不採用評分、強制輪替、付費牆、Google Sheet、HTML 爬蟲。
- commit 作者信箱已改成 GitHub noreply(`300864627+tongxiaooppo-boop@users.noreply.github.com`),本機 git config 也已設定。作者名稱仍是 `MaxChang`。改寫前的備份 bundle 在暫存資料夾(`lotto-backup-before-rewrite.bundle`)。

## 8. 環境與踩坑
- Windows,Node 24、Python、`gh`(已登入 `tongxiaooppo-boop`,有 `workflow` 權限)、Chrome 在 `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`。
- **Bash 工具遇到很長的多重 heredoc 指令會整段解析失敗而什麼都沒執行**:建立檔案請用 Write 工具,Bash 只放短指令。
- 中文檔名(`今彩539.json` 等)在 Windows 終端輸出會亂碼,是顯示問題不是資料問題;用 node/python 讀寫(UTF-8)即可。
- `history/` 內 `*.zip` 被 `.gitignore` 排除;`book/` 也被排除(內含他人 repo)。
- 重新產生回測組合:`node tools/preset_search.mjs`(539 約 4~5 分鐘)。
- 本機 8000 埠的預覽伺服器可能還在背景執行(`start.bat` 或 `python -m http.server 8000`)。

## 9. 接手後建議的第一步
1. 開線上網站,用手機看一遍四個分頁的版面(最大的未驗證風險)。
2. 下一個開獎日後,到 repo 的 Actions 頁面確認 `update-data` 是否成功 commit 並重新發布。
3. 決定要不要補 §6 的「未做」項目。
