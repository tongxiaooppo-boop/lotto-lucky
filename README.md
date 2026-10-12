# 樂透統計與選號工具

線上版:<https://tongxiaooppo-boop.github.io/lotto-lucky/>

今彩539、大樂透、威力彩的開獎查詢、統計分析與依統計組合選號(純前端,無需 build)。需求見 [docs/PRD.md](docs/PRD.md)。

> 樂透每期為獨立隨機事件,統計對下一期無預測力。本工具僅供娛樂與描述歷史,不保證提高中獎機率。

## 功能
- **開獎**:近 N 期或日期區間查詢、重號標示、從官網更新、手動輸入、匯入官方 CSV、本機資料備份。
- **統計**:次數、遺漏、冷熱、和值、奇偶大小、拖牌等多種統計;大樂透特別號、威力彩第二區也有對應統計。
- **選號**:固定號碼、包牌、配方與一鍵策略、多組產生、條件過濾;特別號/第二區可選統計來源(含加權隨機)與個數,並有回測組合按鈕。
- **回測**:單一策略、全策略比較、特別號/第二區來源比較(Web Worker 背景執行)。回測結論:沒有任何策略穩定優於純隨機。

## 資料出處
台灣彩券官網「歷史開獎號碼下載」:<https://www.taiwanlottery.com/lotto/history/result_download>。原始 CSV 放於 `history/`,以 `python tools/build_json.py` 整合為 `data/*.json`。

## 更新資料
- 網頁「開獎」分頁按「從官網更新」,新資料存在你的瀏覽器(標示「本機」)。
- 共用資料:GitHub Actions(`update-data.yml`)在週一到週六晚間自動抓取、驗證、commit。手動執行:`node tools/fetch_latest.mjs && python tools/build_json.py`。
- 官網 CSV 約每月更新一次,取得後放進 `history/` 再執行 `python tools/build_json.py`,同期別以官方 CSV 為準。

## 開發
- 驗證資料:`node tools/check_data.mjs`
- 重新產生回測組合:`node tools/preset_search.mjs`(主號,約數分鐘)、`node tools/preset_search_extra.mjs`(特別號/第二區,數秒)
- 本機執行:雙擊 `start.bat`(或 `python -m http.server 8000`),開 http://localhost:8000
- 測試:`node tools/test_engine.mjs`、`test_stats`、`test_stats_more`、`test_recipes`、`test_strategies`、`test_backtest`、`test_official`、`test_presets`、`test_presets_extra`(皆在 `tools/`,不需連網)

## 授權
[MIT](LICENSE)。開獎資料版權屬台灣彩券,僅整理自官網公開資料,詳見「資料出處」。
