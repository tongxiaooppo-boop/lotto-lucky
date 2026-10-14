// 搜尋特別號/第二區「回測命中率較好的來源」,產生 js/core/presets_extra.js(選號頁的一鍵套用按鈕)。
// 做法與 preset_search.mjs 相同:前半段歷史挑最好的幾個(訓練段),後半段重新驗證(測試段)。
// 命中 = 選出的 k 個號碼包含實際開出的特別號/第二區;diff = 命中率 − 隨機理論命中率 k/號碼數。
// 用法:node tools/preset_search_extra.mjs [--top 3] [--seeds 3]
import { readFileSync, writeFileSync } from "node:fs";
import { GAMES } from "../js/core/games.js";
import { backtestExtra, MIN_HISTORY } from "../js/engine/backtest/index.js";
import { EXTRA_SOURCES } from "../js/engine/recipes/index.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? +process.argv[i + 1] : d; };
const TOP = arg("--top", 3), SEEDS = arg("--seeds", 3);
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const SRC = EXTRA_SOURCES.filter(s => s.id !== "random");
const name = (s, k) => `${s.label}${s.needsN ? "(近10期)" : ""}×${k}`;

// p = 各種子 p 值的平均:不是嚴格的檢定 p 值(介面標示為「p≈…多個種子的平均,僅供參考」),只用來粗看差距是否明顯。
const pack = rs => ({ tests: rs[0].tests, rate: +avg(rs.map(r => r.rate)).toFixed(4), expected: +rs[0].expected.toFixed(4), diff: +(avg(rs.map(r => r.rate)) - rs[0].expected).toFixed(4), p: +avg(rs.map(r => r.p)).toFixed(3) });
const out = {};
for (const spec of Object.values(GAMES).filter(g => g.extra)) {
  const draws = JSON.parse(readFileSync(new URL(`../data/${spec.name}.json`, import.meta.url), "utf-8"));
  const n = draws.length, mid = Math.floor((MIN_HISTORY + n) / 2);
  const ks = spec.extra.pickable ? [1, 2, 3] : [1];
  const cands = SRC.flatMap(s => ks.map(k => ({ source: s.id, k, ...(s.needsN ? { n: 10 } : {}), name: name(s, k) })));
  const run = (hist, c, testCount, seed0) => pack(Array.from({ length: SEEDS }, (_, i) => backtestExtra(spec, hist, c.source, { k: c.k, n: c.n, scopeN: spec.defaultScope, testCount, seed: seed0 + i })));
  // 不同 k 的理論命中率不同,以 z 分數(以 diff / 理論標準差)排序才公平;這裡用 diff 相對標準誤
  const scored = cands.map(c => ({ ...c, train: run(draws.slice(0, mid), c, mid, 1) }))
    .map(c => ({ ...c, zt: c.train.diff / Math.sqrt(c.train.expected * (1 - c.train.expected) / c.train.tests) }))
    .sort((a, b) => b.zt - a.zt);
  const picks = scored.slice(0, TOP).map(c => ({ name: c.name, source: c.source, k: c.k, ...(c.n ? { n: c.n } : {}), train: c.train, test: run(draws, c, n - mid, 11) }));
  out[spec.name] = picks;
  console.log(`\n== ${spec.name} ${spec.extra.label}:候選 ${cands.length} 個,訓練 ${scored[0].train.tests} 期 → 測試 ${picks[0].test.tests} 期`);
  console.log(`  訓練段全部候選 diff 平均 ${avg(scored.map(c => c.train.diff)).toFixed(4)}`);
  picks.forEach(c => console.log(`  ${c.name.padEnd(22)} 訓練 ${c.train.diff >= 0 ? "+" : ""}${c.train.diff.toFixed(4)}(p=${c.train.p}) → 測試 ${c.test.diff >= 0 ? "+" : ""}${c.test.diff.toFixed(4)}(p=${c.test.p})`));
}
const body = `// 由 tools/preset_search_extra.mjs 產生,請勿手改(重新產生:node tools/preset_search_extra.mjs)。
// 特別號/第二區的回測組合。diff = 命中率 − 隨機理論命中率;訓練段是事後挑的,測試段才不偏樂觀,通常回到 0 附近。
export const EXTRA_PRESETS = ${JSON.stringify(out, null, 1)};
`;
writeFileSync(new URL("../js/core/presets_extra.js", import.meta.url), body, "utf-8");
console.log("\n已寫入 js/core/presets_extra.js");
