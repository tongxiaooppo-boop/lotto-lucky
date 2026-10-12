import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GAMES } from "../js/core/games.js";
import { makeRng } from "../js/engine/recipes/index.js";
import { backtest, backtestExtra, compareExtra, strategyFn, prizeTier, normalP, compareAll, MIN_HISTORY } from "../js/engine/backtest/index.js";

const near = (a, b, e) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
const load = g => JSON.parse(readFileSync(new URL(`../data/${g.name}.json`, import.meta.url), "utf-8"));

// 中獎等級對照(官方規則)
assert.equal(prizeTier("539", 5, false), "頭獎"); assert.equal(prizeTier("539", 2, false), "肆獎"); assert.equal(prizeTier("539", 1, false), null);
assert.equal(prizeTier("lotto649", 5, true), "貳獎"); assert.equal(prizeTier("lotto649", 3, false), "普獎"); assert.equal(prizeTier("lotto649", 2, true), "柒獎"); assert.equal(prizeTier("lotto649", 2, false), null);
assert.equal(prizeTier("superlotto638", 6, true), "頭獎"); assert.equal(prizeTier("superlotto638", 6, false), "貳獎");
assert.equal(prizeTier("superlotto638", 3, false), "玖獎"); assert.equal(prizeTier("superlotto638", 1, true), "普獎"); assert.equal(prizeTier("superlotto638", 1, false), null);
// 常態雙尾 p
near(normalP(1.96), 0.05, 1e-3); near(normalP(0), 1, 1e-6); near(normalP(-2.576), 0.01, 1e-3);

// 不得使用未來資料:策略拿到的歷史,最後一期必須嚴格早於被預測的那一期
const g = GAMES["今彩539"], draws = load(g);
{
  let calls = 0;
  const seen = [];
  const r = backtest(g, draws, (hist, rng) => { calls++; seen.push(hist.at(-1).period); return [1, 2, 3, 4, 5]; }, { testCount: 50 });
  assert.equal(r.tests, 50); assert.equal(calls, 50);
  const start = draws.length - 50;
  seen.forEach((p, i) => assert.equal(p, draws[start + i - 1].period));
}
// scopeN 限制歷史長度;歷史不足 MIN_HISTORY 不測
{
  const lens = [];
  backtest(g, draws, hist => { lens.push(hist.length); return [1, 2, 3, 4, 5]; }, { testCount: 20, scopeN: 100 });
  assert.ok(lens.every(l => l === 100));
  const tiny = backtest(g, draws.slice(0, 40), () => [1, 2, 3, 4, 5], { testCount: 1000 });
  assert.equal(tiny.tests, 40 - MIN_HISTORY);
}
// 已知答案:永遠選 1~5 的命中分布,與手算一致
{
  const r = backtest(g, draws, () => [1, 2, 3, 4, 5], { testCount: 200 });
  const slice = draws.slice(-200).map(d => d.numbers.filter(v => v <= 5).length);
  near(r.mean, slice.reduce((a, b) => a + b, 0) / 200, 1e-12);
  assert.equal(r.hitDist.reduce((a, x) => a + x.count, 0), 200);
}
// 純隨機的平均命中應接近理論值(5×5/39 ≈ 0.641),且可重現
for (const game of Object.values(GAMES)) {
  const d = load(game);
  const r = backtest(game, d, strategyFn(game, "random"), { testCount: 1500, seed: 11 });
  near(r.expectedMean, game.count * game.count / (game.max - game.min + 1), 1e-9);
  assert.ok(Math.abs(r.z) < 4, `${game.name} 純隨機 z=${r.z}`);
  const again = backtest(game, d, strategyFn(game, "random"), { testCount: 1500, seed: 11 });
  assert.deepEqual(again.hitDist, r.hitDist);
  console.log(`${game.name}: 純隨機 平均命中 ${r.mean.toFixed(3)} (理論 ${r.expectedMean.toFixed(3)}) z=${r.z.toFixed(2)} p=${r.p.toFixed(3)} 中獎率 ${(r.anyPrizeRate * 100).toFixed(1)}%`);
}
// 全策略比較能跑完、策略數與排序正確
{
  const t = performance.now();
  const rows = compareAll(g, draws, { testCount: 200, scopeN: 300, seed: 3 });
  assert.ok(rows.length >= 10); assert.ok(rows.every((x, i) => !i || rows[i - 1].mean >= x.mean));
  console.log(`全策略比較 ${rows.length} 個 × 200 期:${(performance.now() - t).toFixed(0)}ms`);
}

// 特別號/第二區單獨回測:手算樣本 + 真實資料(純隨機命中率應貼近 1/號碼數)
{
  const sl = GAMES["威力彩"];
  const fake = Array.from({ length: 60 }, (_, i) => ({ period: String(i), date: "2026-01-01", numbers: [1, 2, 3, 4, 5, 6], special: 3 }));   // 第二區永遠是 3
  const r = backtestExtra(sl, fake, "most_drawn", { testCount: 20 });
  assert.equal(r.tests, 20); assert.equal(r.hits, 20); assert.equal(r.rate, 1); near(r.expected, 1 / 8, 1e-12); assert.ok(r.p < 1e-6);
  assert.equal(backtestExtra(sl, fake, "most_drawn", { testCount: 20, k: 8 }).p, 1);                // 全包必中,與理論相同 → 無差異
  assert.throws(() => backtestExtra(GAMES["今彩539"], fake, "random"), /沒有特別號/);
  for (const g of [GAMES["大樂透"], sl]) {
    const d = load(g);
    const rr = backtestExtra(g, d, "random", { testCount: 1500, seed: 5 });
    assert.ok(Math.abs(rr.z) < 4, `${g.name} 特別號純隨機 z=${rr.z}`);
    const rows = compareExtra(g, d, { testCount: 300, scopeN: 100, seed: 2 });
    assert.ok(rows.length >= 8 && rows.every((x, i) => !i || rows[i - 1].rate >= x.rate));
    console.log(`${g.name} 特別號/第二區:純隨機命中率 ${(rr.rate * 100).toFixed(2)}%(理論 ${(rr.expected * 100).toFixed(2)}%),z=${rr.z.toFixed(2)};各來源比較最高 ${rows[0].label} ${(rows[0].rate * 100).toFixed(1)}%`);
  }
}
console.log("backtest tests passed");
