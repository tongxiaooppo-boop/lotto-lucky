# 樂透統計與選號工具

線上版:<https://tongxiaooppo-boop.github.io/lotto-lucky/>

今彩539、大樂透、威力彩、加州539(California Fantasy 5)的開獎查詢、統計分析與依統計組合選號(純前端,無需 build)。需求見 [docs/PRD.md](docs/PRD.md)。

> 樂透每期為獨立隨機事件,統計對下一期無預測力。本工具僅供娛樂與描述歷史,不保證提高中獎機率。

## 功能
- **開獎**:近 N 期或日期區間查詢、重號標示、從官網更新、手動輸入、匯入官方 CSV、本機資料備份。
- **統計**:次數、遺漏、冷熱、和值、奇偶大小、拖牌等多種統計;大樂透特別號、威力彩第二區也有對應統計。
- **選號**:固定號碼、包牌(539 類可自訂增加 3~10 號)、配方(來源含「尾號」「引用最後一期的加州539」)與一鍵策略(依回測成績排序,排名不代表更準)、多組產生、條件過濾;特別號/第二區可選統計來源(含加權隨機)與個數,並有回測組合按鈕。
- **回測**:單一策略、全策略比較、特別號/第二區來源比較(Web Worker 背景執行)。回測結論:沒有任何策略穩定優於純隨機。

## 資料出處
台灣彩券官網「歷史開獎號碼下載」:<https://www.taiwanlottery.com/lotto/history/result_download>。原始 CSV 放於 `history/`,以 `python tools/build_json.py` 整合為 `data/*.json`。

加州539:每日由 GitHub Actions 向加州彩券官網的開獎介面取得(只開放最近約 6 個月,且擋台灣 IP);2010-04 起的歷史來自 lottery.net,寫入前與官網重疊期間逐期比對。期別以開獎日期 YYYYMMDD 代替。

## 更新資料
- 網頁「開獎」分頁按「從官網更新」,新資料存在你的瀏覽器(標示「本機」)。
- 共用資料:GitHub Actions(`update-data.yml`)在週一到週六晚間自動抓取、驗證、commit。手動執行:`node tools/fetch_latest.mjs && python tools/build_json.py`。
- 加州539:`node tools/fetch_ca539.mjs`(只能在美國 IP 跑,即 GitHub Actions);歷史回補 `--backfill`,人工驗證 `--verify`(另比對 9800)。
- 官網 CSV 約每月更新一次,取得後放進 `history/` 再執行 `python tools/build_json.py`,同期別以官方 CSV 為準。

## 開發
- 驗證資料:`node tools/check_data.mjs`
- 重新產生回測組合:`node tools/preset_search.mjs`(主號,約數分鐘)、`node tools/preset_search_extra.mjs`(特別號/第二區,數秒)、一鍵策略排名 `node tools/strategy_rank.mjs`(數秒)
- 本機執行:雙擊 `start.bat`(或 `python -m http.server 8000`),開 http://localhost:8000
- 測試:`node tools/test_engine.mjs`、`test_stats`、`test_stats_more`、`test_recipes`、`test_strategies`、`test_backtest`、`test_official`、`test_presets`、`test_presets_extra`、`test_ca539`(皆在 `tools/`,不需連網)

## 授權
[MIT](LICENSE)。開獎資料版權屬台灣彩券,僅整理自官網公開資料,詳見「資料出處」。
