# 決策紀錄

- 2026-10-12:官網歷史開獎 CSV 約每月更新一次,資料會落後。F1.3 自動更新不能只靠該 CSV,需另找即時來源(待查)或靠手動輸入近期期數,月初再用官方 CSV 校正。

- 2026-10-12:自動更新改用官網公開 JSON 介面(見 PRD 第 9 節),不靠每月才更新的 CSV。抓取邏輯用 JS 寫(`js/data/official.js`),瀏覽器「從官網更新」與 `tools/fetch_latest.mjs`(Actions 用)共用同一份,取代 PRD 原訂的 `fetch_latest.py`。
- 2026-10-12:API 抓到的資料寫入 `history/api/<遊戲>_api.csv`(官方 CSV 格式),`build_json.py` 先處理 api/manual 再處理官方 CSV,同期別以官方 CSV 為準。與既有資料同期別但號碼不同時視為衝突,Actions 不 commit、等人工確認。
- 2026-10-12:大樂透特別號是開獎附加號,投注時不選,所以「第二區/特別號配方」只對威力彩第二區有意義。
- 2026-10-12:回測的統計檢定以超幾何分布的理論平均與變異數做 z 檢定,並在全策略比較時提醒多重比較問題。

- 2026-10-12:參考 5 個外部 repo(`book/`,分析在 `book/analysis/`)後,只採用:抓取重試與指數退避、workflow 的 `concurrency`/`timeout-minutes`、冷熱 z-score、拖牌、AC 值/質數個數。不採用:綜合評分、強制輪替、事後回推獎項、付費牆/LINE/金流、Google Sheet 與 HTML 爬蟲。`book/` 加入 `.gitignore`(內含他人 repo)。
- 2026-10-12:選號頁的「回測組合」按鈕由 `tools/preset_search.mjs` 產生(前半段歷史挑、後半段歷史驗證),介面上同時顯示訓練段與測試段成績,避免把事後挑出的好成績呈現成優勢。
