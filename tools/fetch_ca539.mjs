// 抓加州539(Fantasy 5)開獎,寫入 history/api/加州539_api.csv,之後由 build_json.py 併入 data/加州539.json。
// 每日更新:加州彩券官網的開獎介面(每天 1 次請求,只取最近 50 期)。官網只開放最近約 6 個月,且擋台灣 IP,
//   所以這支要在 GitHub Actions(美國)跑;在台灣本機會得到 403。
// 歷史回補(--backfill):lottery.net 年度存檔(2010-04 起)。寫入前會與官網重疊的那段逐期比對,有任何不一致就整批不寫入。
// 期別 = 開獎日期 YYYYMMDD(見 js/data/ca539.js)。
// 用法:
//   node tools/fetch_ca539.mjs                 每日更新
//   node tools/fetch_ca539.mjs --backfill      回補歷史(lottery.net 2010 年至今,每年 1 次請求)
//   node tools/fetch_ca539.mjs --dry           只檢查不寫檔
//   node tools/fetch_ca539.mjs --verify        另外用 9800 首頁依日期交叉比對(人工驗證用,不要放進每日排程)
// 與既有資料同期別但號碼不同 = 衝突:不寫入、結束碼 1,交給人工確認。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { GAMES } from "../js/core/games.js";
import { parseOfficial, parseLotteryNet, parse9800, crossCheck, diffAgainst } from "../js/data/ca539.js";
import { parseCsv } from "../js/engine/draws.js";

const spec = GAMES["加州539"];
const has = f => process.argv.includes(f);
const dry = has("--dry"), backfill = has("--backfill"), verify = has("--verify");
const root = new URL("../", import.meta.url);
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", Accept: "application/json, text/html" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// 10 = Fantasy 5。每頁上限 50(超過回 null),且只能取到最近約 180 期。
const OFFICIAL = page => `https://www.calottery.com/api/DrawGameApi/DrawGamePastDrawResults/10/${page}/50`;

async function get(url, decode = "utf-8", attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return new TextDecoder(decode).decode(await res.arrayBuffer());
    } catch (e) { last = e; if (i < attempts - 1) await sleep(1000 * 2 ** i); }
  }
  throw new Error(`${url} 連續 ${attempts} 次失敗:${last.message}`);
}

let bad = false;
// 每日更新只要第 1 頁;回補時把官網給得出來的頁數(約 4 頁、182 期)全抓,當作比對 lottery.net 的基準。
async function officialPage(page) {
  const text = await get(OFFICIAL(page));
  if (text.trim() === "null") throw new Error("官網回傳空值(介面改版?)");
  return parseOfficial(spec, JSON.parse(text));
}
const off = await officialPage(1);
if (backfill) {
  for (let p = 2; p <= 10; p++) {
    await sleep(1000);
    const r = await officialPage(p);
    if (!r.draws.length && !r.failed.length) break;
    off.draws.push(...r.draws); off.failed.push(...r.failed);
  }
}
for (const f of off.failed) { bad = true; console.error(`  官網資料失敗 ${f.period}:${f.reason}`); }
if (!off.draws.length) { bad = true; console.error("官網沒有任何開獎資料"); }
const latest = off.draws.map(d => d.date).sort().at(-1);
console.log(`官網: 取得 ${off.draws.length} 期,最新 ${latest}`);

let incoming = off.draws;
if (backfill) {
  const thisYear = new Date().getUTCFullYear();
  const hist = [];
  for (let y = 2010; y <= thisYear; y++) {
    const r = parseLotteryNet(spec, await get(`https://www.lottery.net/california/fantasy-5/numbers/${y}`));
    console.log(`lottery.net ${y}: ${r.draws.length} 期,解析失敗 ${r.failed.length}`);
    for (const f of r.failed) { bad = true; console.error(`  失敗 ${f}`); }
    if (!r.draws.length) { bad = true; console.error(`  ${y} 沒有解析到任何一期(網頁改版?)`); }
    hist.push(...r.draws);
    await sleep(800);
  }
  // 與官網重疊的日期必須逐期一致,否則整批不採用
  const cc = crossCheck(off.draws, hist);
  console.log(`與官網重疊比對: ${cc.checked} 期,不一致 ${cc.conflicts.length}`);
  if (cc.checked < 100) { bad = true; console.error(`重疊期數太少(${cc.checked}),無法確認 lottery.net 可信`); }
  for (const c of cc.conflicts) { bad = true; console.error(`  不一致 ${c.date}:官網 ${c.a} / lottery.net ${c.b}`); }
  // 官網優先;歷史只補官網沒有的日期
  const have = new Set(off.draws.map(d => d.period));
  incoming = [...hist.filter(d => !have.has(d.period)), ...off.draws];
}
const byPeriod = new Map();
for (const d of incoming) {
  const p = byPeriod.get(d.period);
  if (p && p.numbers.join() !== d.numbers.join()) { bad = true; console.error(`  同日期重複且號碼不同:${d.date}`); }
  byPeriod.set(d.period, d);
}
const all = [...byPeriod.values()].sort((a, b) => (a.date < b.date ? -1 : 1));

if (verify) {
  try {
    const n = parse9800(spec, await get("http://www.9800.com.tw/fantasy5/", "big5"));
    const b = crossCheck(all, n.draws);
    console.log(`交叉比對 9800: 比對 ${b.checked} 期,不一致 ${b.conflicts.length}`);
    for (const c of b.conflicts) { bad = true; console.error(`  不一致 ${c.date}:本次資料 ${c.a} / 9800 ${c.b}`); }
  } catch (e) { console.warn(`警告:9800 交叉驗證失敗:${e.message}`); }
}

const dataFile = new URL("data/加州539.json", root);
const existing = existsSync(dataFile) ? JSON.parse(readFileSync(dataFile, "utf-8")) : [];
const { fresh, conflicts } = diffAgainst(existing, all);
for (const c of conflicts) { bad = true; console.error(`  與既有資料衝突 ${c.period}:既有 ${c.existing} / 本次 ${c.fetched}`); }
console.log(`加州539: 共 ${all.length} 期,新增 ${fresh.length} 期,衝突 ${conflicts.length}`);
if (dry || bad || !fresh.length) process.exit(bad ? 1 : 0);

const header = ["遊戲名稱", "期別", "開獎日期", "銷售總額", "銷售注數", "總獎金", ...Array.from({ length: spec.count }, (_, i) => `獎號${i + 1}`)].join(",");
const row = d => [spec.name, d.period, d.date.replaceAll("-", "/"), "", "", "", ...d.numbers].join(",");
const dir = new URL("history/api/", root);
mkdirSync(dir, { recursive: true });
const file = new URL("加州539_api.csv", dir);
const prev = existsSync(file) ? parseCsv(readFileSync(file, "utf-8"), spec).draws : [];
const merged = new Map([...prev, ...fresh].map(d => [d.period, d]));
const out = [...merged.values()].sort((a, b) => (a.date + a.period < b.date + b.period ? -1 : 1));
writeFileSync(file, "﻿" + [header, ...out.map(row)].join("\n") + "\n", "utf-8");
console.log(`已寫入 加州539_api.csv(${out.length} 期)`);
