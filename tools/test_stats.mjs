import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GAMES } from "../js/core/games.js";
import * as S from "../js/engine/stats/index.js";

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// 範圍
const ds = [{ date: "2026-01-01" }, { date: "2026-01-02" }, { date: "2026-01-03" }];
assert.equal(S.applyScope(ds, { type: "last_n", n: 2 }).length, 2);
assert.equal(S.applyScope(ds, { type: "range", from: "2026-01-02", to: "2026-01-02" }).length, 1);
assert.equal(S.applyScope(ds, { type: "all" }).length, 3);

// S1~S3/S6(手算樣本)
const ns = S.numberStats([[1], [1], [2], [1]], 1, 2, 1);
assert.deepEqual([ns[0].count, ns[0].curStreak, ns[0].maxStreak, ns[0].curGap, ns[0].maxGap], [3, 1, 2, 0, 1]);
assert.deepEqual([ns[1].count, ns[1].curStreak, ns[1].maxStreak, ns[1].curGap, ns[1].maxGap], [1, 0, 1, 1, 2]);
near(ns[0].freq, 0.75); near(ns[0].expectedFreq, 0.5);
near(ns[1].avgInterval, 4); near(ns[1].gapRatio, 0.25);
assert.equal(S.numberStats([[1]], 1, 2, 1)[1].curGap, 1);       // 從未開出:遺漏 = 期數
assert.equal(S.numberStats([[1]], 1, 2, 1)[1].gapRatio, null);

// S4 / S5
assert.deepEqual(S.absentInLast([[1, 2], [3, 4], [5, 6]], 1, 8, 2), [1, 2, 7, 8]);
assert.deepEqual(S.latestAndFrequent([[1, 2], [2, 3], [2, 5]], 3, 2), [{ number: 2, times: 3 }]);

// S8
assert.deepEqual(S.repeatDistribution([[1, 2, 3], [2, 3, 4], [5, 6, 7]], 3).map(r => r.count), [1, 0, 1, 0]);
near([0, 1, 2, 3, 4, 5].reduce((a, k) => a + S.hypergeom(k, 5, 39), 0), 1);
near(S.hypergeom(0, 5, 39), 278256 / 575757);

// S11 / S12
const sd = S.sumDistribution([[1, 2], [3, 4], [5, 6]], 5);
assert.equal(sd.mean, 7); assert.deepEqual(sd.bins.map(b => b.count), [1, 1, 1]);
const pz = S.parityAndSize([[1, 2, 3]], 1, 6, 3);
assert.deepEqual([pz.odd[2].count, pz.big[0].count, pz.bigFrom], [1, 1, 4]);

// S21:查表值 chi2(1)=3.841→p≈0.05,chi2(10)=18.307→p≈0.05
assert.equal(S.chiSquare([5, 5, 5, 5]).p, 1);
const c = S.chiSquare([10, 0]);   // chi2 = 10, df=1
near(c.chi2, 10); near(c.p, 0.001565, 1e-5);
{ // 以 df=10、chi2=18.307 反推:構造 11 格,期望 100
  const counts = Array(11).fill(100); counts[0] += 20; counts[1] -= 20;   // chi2 = 800/100 = 8, df=10
  near(S.chiSquare(counts).chi2, 8); near(S.chiSquare(counts).p, 0.6288, 1e-3);
}

// 真實資料:規格一致 + 效能(全歷史 < 1 秒)
for (const g of Object.values(GAMES)) {
  const draws = JSON.parse(readFileSync(new URL(`../data/${g.name}.json`, import.meta.url), "utf-8"));
  const t = performance.now();
  const ser = S.mainSeries(draws);
  const rows = S.numberStats(ser, g.min, g.max, g.count);
  assert.equal(rows.reduce((a, r) => a + r.count, 0), draws.length * g.count);
  S.repeatDistribution(ser, g.count); S.sumDistribution(ser, 10); S.parityAndSize(ser, g.min, g.max, g.count);
  const chi = S.chiSquare(rows.map(r => r.count));
  if (g.extra) assert.equal(S.numberStats(S.extraSeries(draws), g.extra.min, g.extra.max, 1).reduce((a, r) => a + r.count, 0), draws.length);
  const ms = performance.now() - t;
  assert.ok(ms < 1000, `${g.name} 統計耗時 ${ms}ms`);
  console.log(`${g.name}: ${draws.length} 期,耗時 ${ms.toFixed(0)}ms,卡方 p=${chi.p.toFixed(3)}`);
}
console.log("stats tests passed");
