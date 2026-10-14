// 從官網抓最新開獎,寫入 history/api/<遊戲>_api.csv(官方格式),之後由 build_json.py 併入 data/*.json。
// 與既有資料(官方 CSV / 補登)同期別但號碼不同時,視為衝突:該遊戲不寫入、結束碼 1,交給人工確認。
// 每個遊戲各自判斷:一個遊戲失敗/衝突/連線錯誤,不影響其他遊戲照常寫入(結束碼仍為 1,讓 Actions 通知)。
// 用法:node tools/fetch_latest.mjs [--dry]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { GAMES } from "../js/core/games.js";
import { fetchLatest } from "../js/data/official.js";
import { parseCsv } from "../js/engine/draws.js";

const dry = process.argv.includes("--dry");
const root = new URL("../", import.meta.url);
const dir = new URL("history/api/", root);
if (!dry) mkdirSync(dir, { recursive: true });

const header = spec => ["遊戲名稱", "期別", "開獎日期", "銷售總額", "銷售注數", "總獎金", ...Array.from({ length: spec.count }, (_, i) => `獎號${i + 1}`), ...(spec.extra ? [spec.extra.label] : [])].join(",");
const row = (spec, d) => [spec.name, d.period, d.date.replaceAll("-", "/"), d.sales ?? "", d.bets ?? "", d.prize ?? "", ...d.numbers, ...(spec.extra ? [d.special] : [])].join(",");

let bad = false;
for (const spec of Object.values(GAMES)) {
  if (spec.source === "ca") continue;   // 加州539 由 tools/fetch_ca539.mjs 處理(不同來源)
  try {
    if (!(await updateGame(spec))) bad = true;
  } catch (e) { bad = true; console.error(`${spec.name}: 抓取失敗:${e.message}`); }
}
process.exit(bad ? 1 : 0);

// 回傳 true = 正常(含沒有新資料);false = 有失敗或衝突(此遊戲不寫入)。
async function updateGame(spec) {
  const existing = JSON.parse(readFileSync(new URL(`data/${spec.name}.json`, root), "utf-8"));
  const r = await fetchLatest(spec, existing);
  const known = new Set(existing.map(d => d.period));
  const fresh = r.draws.filter(d => !known.has(d.period));
  console.log(`${spec.name}: 官網 ${r.draws.length} 期,新增 ${fresh.length} 期,失敗 ${r.failed.length},衝突 ${r.conflicts.length}`);
  for (const f of r.failed) console.error(`  失敗 ${f.period}:${f.reason}`);
  for (const c of r.conflicts) console.error(`  衝突 ${c.period}:既有 ${JSON.stringify(c.existing.numbers)}+${c.existing.special ?? "-"} / 官網 ${JSON.stringify(c.fetched.numbers)}+${c.fetched.special ?? "-"}`);
  const ok = !r.failed.length && !r.conflicts.length;
  if (dry || !ok || !fresh.length) return ok;
  // 與既有的 api CSV 合併(以期別去重,新抓的優先),避免之後只抓最近月份而遺失舊紀錄
  const file = new URL(`${spec.name}_api.csv`, dir);
  const prev = existsSync(file) ? parseCsv(readFileSync(file, "utf-8"), spec).draws : [];
  const merged = new Map([...prev, ...r.draws].map(d => [d.period, d]));
  const all = [...merged.values()].sort((a, b) => (a.date + a.period < b.date + b.period ? -1 : 1));
  writeFileSync(file, "﻿" + [header(spec), ...all.map(d => row(spec, d))].join("\n") + "\n", "utf-8");
  console.log(`  已寫入 ${decodeURIComponent(file.pathname.split("/").slice(-1)[0])}(${all.length} 期)`);
  return true;
}
