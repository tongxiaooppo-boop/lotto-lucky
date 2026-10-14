// 搜尋「回測表現較好的配方組合」,產生 js/core/presets.js(選號頁的一鍵套用按鈕)。
// 做法(避免只挑事後好看的數字):
//   1. 候選 = 單一統計來源,以及兩個來源的各種數量拆分(例如 追熱×3 + 遺漏比值×2)。
//   2. 用「前半段歷史」的回測平均命中挑出最好的幾個(訓練段)。
//   3. 再用「後半段歷史」重新驗證這幾個(測試段)——這才是不偏樂觀的成績。
// 用法:node tools/preset_search.mjs [--top 4] [--seeds 2] [--only 加州539]
//   --only:只重算指定遊戲,其餘遊戲沿用現有 js/core/presets.js(新增遊戲時用,避免動到既有結果)。
import { readFileSync, writeFileSync } from "node:fs";
import { GAMES } from "../js/core/games.js";
import { backtest, MIN_HISTORY } from "../js/engine/backtest/index.js";
import { generateByRecipe, BASE_SOURCES } from "../js/engine/recipes/index.js";
import { PRESETS as OLD } from "../js/core/presets.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? +process.argv[i + 1] : d; };
const TOP = arg("--top", 4), SEEDS = arg("--seeds", 2);
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const SRC = BASE_SOURCES.filter(s => s.id !== "random" && s.id !== "neighbor");   // 鄰號/隨機候選太少或無意義,不單獨成組
const label = s => ({ most_drawn: "最多次", least_drawn: "最少次", current_streak: "連莊", longest_gap: "遺漏最久", gap_ratio: "遺漏比值", last_repeat: "上期重號", hot_n: "近10期熱號" })[s] ?? s;

function candidates(count) {
  const out = [];
  const mk = src => ({ source: src, count: 0, ...(src === "hot_n" ? { n: 10 } : {}) });
  for (const s of SRC) out.push([{ ...mk(s.id), count }]);
  for (let i = 0; i < SRC.length; i++) for (let j = 0; j < SRC.length; j++) {
    if (i === j) continue;
    for (let a = 1; a < count; a++) out.push([{ ...mk(SRC[i].id), count: a }, { ...mk(SRC[j].id), count: count - a }]);
  }
  // 公開範例配方:最多次 ×2 + 最少次 ×2 + 連莊 ×1(PRD 範例),作為對照
  if (count === 5) out.push([{ source: "most_drawn", count: 2 }, { source: "least_drawn", count: 2 }, { source: "current_streak", count: 1 }]);
  return out;
}
const nameOf = items => items.map(i => `${label(i.source)}×${i.count}`).join(" + ");
const fnOf = (spec, items) => (hist, rng) => generateByRecipe(spec, hist, { items, tieBreak: "random", fillRandom: true, fixed: [], add: 0 }, rng).map(p => p.number);

const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
// p = 各種子 p 值的平均:不是嚴格的檢定 p 值(介面標示為「p≈…多個種子的平均,僅供參考」),只用來粗看差距是否明顯。
const pack = (rs) => ({ tests: rs[0].tests, mean: +avg(rs.map(r => r.mean)).toFixed(4), diff: +(avg(rs.map(r => r.mean)) - rs[0].expectedMean).toFixed(4), p: +avg(rs.map(r => r.p)).toFixed(3), anyPrizeRate: +avg(rs.map(r => r.anyPrizeRate)).toFixed(4) });

const out = {};
for (const spec of Object.values(GAMES)) {
  if (only && spec.name !== only) { out[spec.name] = { picks: OLD[spec.name] }; continue; }
  const draws = JSON.parse(readFileSync(new URL(`../data/${spec.name}.json`, import.meta.url), "utf-8"));
  const n = draws.length, mid = Math.floor((MIN_HISTORY + n) / 2);
  const cands = candidates(spec.count);
  const t0 = performance.now();
  const scored = cands.map(items => {
    const fn = fnOf(spec, items);
    const rs = Array.from({ length: SEEDS }, (_, s) => backtest(spec, draws.slice(0, mid), fn, { testCount: mid, scopeN: spec.defaultScope, seed: s + 1 }));
    return { items, name: nameOf(items), train: pack(rs) };
  }).sort((a, b) => b.train.mean - a.train.mean);
  const picks = scored.slice(0, TOP).map(c => {
    const fn = fnOf(spec, c.items);
    const rs = Array.from({ length: SEEDS }, (_, s) => backtest(spec, draws, fn, { testCount: n - mid, scopeN: spec.defaultScope, seed: s + 11 }));
    return { ...c, test: pack(rs) };
  });
  out[spec.name] = { trainTests: scored[0].train.tests, candidates: cands.length, picks };
  console.log(`\n== ${spec.name}:候選 ${cands.length} 個,訓練段 ${scored[0].train.tests} 期 → 測試段 ${picks[0].test.tests} 期(${((performance.now() - t0) / 1000).toFixed(0)}s)`);
  const base = scored.map(c => c.train.diff);
  console.log(`  訓練段全部候選的與理論差:平均 ${avg(base).toFixed(4)},最好 ${Math.max(...base).toFixed(4)},最差 ${Math.min(...base).toFixed(4)}`);
  picks.forEach(c => console.log(`  ${c.name.padEnd(24)} 訓練 ${c.train.diff >= 0 ? "+" : ""}${c.train.diff.toFixed(4)}(p=${c.train.p})  →  測試 ${c.test.diff >= 0 ? "+" : ""}${c.test.diff.toFixed(4)}(p=${c.test.p})`));
}

const body = `// 由 tools/preset_search.mjs 產生,請勿手改(重新產生:node tools/preset_search.mjs)。
// 選法:前半段歷史挑訓練表現最好的組合,後半段歷史重新驗證。diff = 平均命中 − 隨機理論值(單位:個/期)。
// 結論多半是「測試段回到 0 附近」:挑出來的最佳組合,事後表現通常不會延續。
export const PRESETS = ${JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.picks.map(c => ({ name: c.name, items: c.items, train: c.train, test: c.test }))])), null, 1)};
`;
writeFileSync(new URL("../js/core/presets.js", import.meta.url), body, "utf-8");
console.log("\n已寫入 js/core/presets.js");
