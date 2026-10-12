import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GAMES } from "../js/core/games.js";
import * as M from "../js/engine/stats/more.js";

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);

const hg = M.heatGroups([[1], [1], [2], [3]], 1, 6, 4);
assert.deepEqual([hg.hot, hg.warm, hg.cold].map(g => g.map(r => r.number)), [[1, 2], [3, 4], [5, 6]]);

const lag = M.lagRepeatDistribution([[1, 2], [2, 3], [1, 3]], 2, 2);
assert.deepEqual(lag.map(r => r.count), [0, 1, 0]);

const nb = M.neighborStats([[1, 2, 5], [3, 6, 9]], 3);
assert.deepEqual(nb.consecutive.map(r => r.count), [1, 1, 0]);
assert.deepEqual(nb.neighbor.map(r => r.count), [0, 0, 1, 0]);

const sec = M.sectionStats([[1, 2, 7]], 1, 8, 4);
assert.deepEqual(sec.segments.map(s => s.total), [2, 0, 0, 1]);
assert.equal(sec.patterns[0].pattern, "2-0-0-1");

const tl = M.tailStats([[1, 11, 5]]);
assert.equal(tl.tails[1].count, 2); assert.deepEqual(tl.sameTail, [{ k: 1, count: 1, ratio: 1 }]);

const sp = M.spanStats([[1, 10], [3, 5]]);
near(sp.mean, 5.5); near(sp.avgGap, 5.5); assert.equal(sp.max, 9);

const ps = M.pairStats([[1, 2, 3], [1, 2, 4]], 1, 4);
assert.deepEqual(ps.top[0], { a: 1, b: 2, count: 2 });
assert.deepEqual(ps.never, [{ a: 3, b: 4, count: 0 }]);
assert.deepEqual(M.partnersOf([[1, 2, 3], [1, 2, 4]], 1, 4, 1, 1), [{ number: 2, count: 2 }]);

const cr = M.comboRepeats([{ period: "a", numbers: [1, 2, 3] }, { period: "b", numbers: [3, 2, 1] }, { period: "c", numbers: [4, 5, 6] }]);
assert.equal(cr.unique, 2); assert.deepEqual(cr.dups, [{ combo: "1 2 3", periods: ["a", "b"] }]);
assert.deepEqual(cr.has([6, 5, 4]), ["c"]); assert.deepEqual(cr.has([7, 8, 9]), []);

const gb = M.groupBias([{ date: "2026-10-12", numbers: [1, 2] }, { date: "2026-10-19", numbers: [1, 3] }, { date: "2026-10-13", numbers: [4, 5] }], 1, 5, M.weekdayOf);
assert.deepEqual(gb.map(g => [g.key, g.draws]), [[1, 2], [2, 1]]);
assert.deepEqual(gb[0].top[0], { number: 1, count: 2, freq: 1 });
assert.equal(M.monthOf({ date: "2026-10-12" }), 10);

const st = M.salesTrend([{ date: "2025-01-01", sales: 100, prize: 40 }, { date: "2025-01-02", sales: 300, prize: 60 }, { date: "2026-01-01" }]);
assert.deepEqual(st.rows, [{ year: "2025", draws: 2, sales: 400, prize: 100, avgSales: 200, avgPrize: 50 }]);

// 真實資料:不丟例外、總數一致、效能
for (const g of Object.values(GAMES)) {
  const draws = JSON.parse(readFileSync(new URL(`../data/${g.name}.json`, import.meta.url), "utf-8"));
  const ser = draws.map(d => d.numbers);
  const t = performance.now();
  M.heatGroups(ser, g.min, g.max, 50); M.lagRepeatDistribution(ser, g.count, 2); M.neighborStats(ser, g.count);
  assert.equal(M.sectionStats(ser, g.min, g.max).segments.reduce((a, s) => a + s.total, 0), draws.length * g.count);
  assert.equal(M.tailStats(ser).tails.reduce((a, s) => a + s.count, 0), draws.length * g.count);
  M.spanStats(ser); M.pairStats(ser, g.min, g.max); M.comboRepeats(draws);
  M.groupBias(draws, g.min, g.max, M.weekdayOf); M.salesTrend(draws);
  assert.ok(performance.now() - t < 1000);
}
console.log("stats(more) tests passed");
