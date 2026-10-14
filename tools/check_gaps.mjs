// 檢查 data/*.json 有沒有「漏掉的期數」:
//  - 台灣三遊戲:同一民國年內期別末 6 碼要連號(與網頁「資料完整性」同一套邏輯)。
//  - 加州539:每天開獎,日期不可跳號;已知 lottery.net 缺的 10 天(docs/decisions.md 2026-10-13)不算。
// 另外印出各遊戲最新一期距今幾天(只提示,不算失敗:排程延遲或休市不一定是錯)。
// 有新的缺漏 → 結束碼 1。用法:node tools/check_gaps.mjs
import { readFileSync } from "node:fs";
import { GAMES } from "../js/core/games.js";
import { checkContinuity } from "../js/engine/draws.js";

const CA_KNOWN_MISSING = new Set(["2011-04-18", "2011-08-12", "2011-08-13", "2011-08-27", "2011-10-15", "2012-05-12", "2012-05-13", "2012-06-30", "2015-01-03", "2015-05-03"]);
const DAY = 86400e3;
const addDay = date => new Date(Date.parse(date + "T00:00:00Z") + DAY).toISOString().slice(0, 10);

let bad = false;
for (const [name, spec] of Object.entries(GAMES)) {
  const draws = JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), "utf-8"));
  let gaps;
  if (spec.source === "ca") {
    gaps = [];
    for (let i = 1; i < draws.length; i++)
      for (let d = addDay(draws[i - 1].date); d < draws[i].date; d = addDay(d)) if (!CA_KNOWN_MISSING.has(d)) gaps.push(d);
  } else gaps = checkContinuity(draws);
  const age = Math.floor((Date.now() + 8 * 3600e3 - Date.parse(draws.at(-1).date + "T00:00:00Z")) / DAY);
  if (gaps.length) { bad = true; console.error(`[${name}] 缺漏 ${gaps.length} 處:${gaps.slice(0, 10).join("、")}${gaps.length > 10 ? " …" : ""}`); }
  console.log(`${name}: ${gaps.length ? "有缺漏" : "無缺漏"},最新 ${draws.at(-1).date}(約 ${age} 天前)`);
}
process.exit(bad ? 1 : 0);
