// 以回測成績替一鍵策略排序,產生 js/core/strategy_rank.js(選號頁依此由上而下排列)。
// 每個遊戲:最近 N 期(預設 2000)逐期回測,多個種子平均;排序依「平均命中 − 隨機理論值」。
// 排名不代表更準:差距在統計上多半不顯著,且每次重跑都可能換名次。
// 用法:node tools/strategy_rank.mjs [--tests 2000] [--seeds 2] [--only 加州539]
//   --only:只重算指定遊戲,其餘遊戲沿用現有 js/core/strategy_rank.js(新增遊戲時用)。
import { readFileSync, writeFileSync } from "node:fs";
import { GAMES } from "../js/core/games.js";
import { backtest } from "../js/engine/backtest/index.js";
import { STRATEGIES } from "../js/engine/recipes/strategies.js";
import { STRATEGY_RANK as OLD } from "../js/core/strategy_rank.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? +process.argv[i + 1] : d; };
const TESTS = arg("--tests", 2000), SEEDS = arg("--seeds", 2);
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
// p = 各種子 p 值的平均:不是嚴格的檢定 p 值(介面標示為「p≈…多個種子的平均,僅供參考」),只用來粗看差距是否明顯。
const out = {};
for (const spec of Object.values(GAMES)) {
  if (only && spec.name !== only) { out[spec.name] = OLD[spec.name]; continue; }
  const draws = JSON.parse(readFileSync(new URL(`../data/${spec.name}.json`, import.meta.url), "utf-8"));
  const t0 = performance.now();
  const rows = STRATEGIES.map(s => {
    const fn = (hist, rng) => s.run(spec, hist, { fixed: [], add: 0 }, rng).map(p => p.number);
    const rs = Array.from({ length: SEEDS }, (_, i) => backtest(spec, draws, fn, { testCount: TESTS, scopeN: spec.defaultScope, seed: i + 1 }));
    return { id: s.id, tests: rs[0].tests, diff: +(avg(rs.map(r => r.mean)) - rs[0].expectedMean).toFixed(4), p: +avg(rs.map(r => r.p)).toFixed(3) };
  }).sort((a, b) => b.diff - a.diff);
  out[spec.name] = rows;
  console.log(`\n== ${spec.name}(${rows[0].tests} 期,${((performance.now() - t0) / 1000).toFixed(0)}s)`);
  rows.forEach(r => console.log(`  ${r.id.padEnd(16)} ${r.diff >= 0 ? "+" : ""}${r.diff.toFixed(4)}  p=${r.p}`));
}
writeFileSync(new URL("../js/core/strategy_rank.js", import.meta.url), `// 由 tools/strategy_rank.mjs 產生,請勿手改(重新產生:node tools/strategy_rank.mjs)。
// 一鍵策略的回測排名(由上而下)。diff = 平均命中 − 隨機理論值(個/期)。排名不代表更準,差距多半不顯著。
export const STRATEGY_RANK = ${JSON.stringify(out, null, 1)};
`, "utf-8");
console.log("\n已寫入 js/core/strategy_rank.js");
