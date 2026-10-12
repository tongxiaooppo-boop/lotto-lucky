# 樂透統計與選號工具

今彩539、大樂透、威力彩的開獎查詢、統計分析與依統計組合選號(純前端,無需 build)。需求見 [docs/PRD.md](docs/PRD.md)。

> 樂透每期為獨立隨機事件,統計對下一期無預測力。本工具僅供娛樂與描述歷史,不保證提高中獎機率。

## 資料出處
台灣彩券官網「歷史開獎號碼下載」:<https://www.taiwanlottery.com/lotto/history/result_download>。原始 CSV 放於 `history/`,以 `python tools/build_json.py` 整合為 `data/*.json`。

## 開發
- 驗證資料:`node tools/check_data.mjs`
- 本機預覽:在專案根目錄啟動任一靜態伺服器(如 `python -m http.server`)。

## 授權
待定(見 PRD 第 10.5 節)。
