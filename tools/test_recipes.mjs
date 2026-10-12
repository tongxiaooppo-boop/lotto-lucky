import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GAMES } from "../js/core/games.js";
import * as R from "../js/engine/recipes/index.js";

const spec = { min: 1, max: 5, count: 2 };
const D = [[1, 2], [1, 3], [1, 4]].map((numbers, i) => ({ period: String(i), date: `2026-01-0${i + 1}`, numbers }));
const rng = R.makeRng(1);
const pick = (items, extra = {}) => R.generateByRecipe(spec, D, { items, tieBreak: "small", fillRandom: true, ...extra }, rng).map(p => p.number);

// 各來源(手算:次數 1:3 2:1 3:1 4:1 5:0;目前遺漏 1:0 2:2 3:1 4:0 5:3;最近一期 [1,4])
assert.deepEqual(pick([{ source: "most_drawn", count: 1 }, { source: "least_drawn", count: 1 }]), [1, 5]);
assert.deepEqual(pick([{ source: "least_drawn", count: 2 }]), [5, 2]);                // 同分較小號優先
assert.deepEqual(pick([{ source: "longest_gap", count: 2 }]), [5, 2]);
assert.deepEqual(pick([{ source: "current_streak", count: 1 }]).slice(0, 1), [1]);
assert.deepEqual(pick([{ source: "last_repeat", count: 2 }]), [1, 4]);
assert.deepEqual(pick([{ source: "neighbor", count: 2 }]).sort(), [2, 3]);           // 鄰號 {2,3,5} 同分取小
assert.deepEqual(pick([{ source: "hot_n", count: 1, n: 1 }]).slice(0, 1), [1]);
// F4.2 去重:最多次 ×2 → 1 之後取下一個(同分小號),不會重複
assert.deepEqual(pick([{ source: "most_drawn", count: 1 }, { source: "most_drawn", count: 1 }]), [1, 2]);

// F4.1:不足且不補 → 錯誤;補滿 → 來源標示「隨機補」
assert.throws(() => pick([{ source: "most_drawn", count: 1 }], { fillRandom: false }), /還差 1/);
const filled = R.generateByRecipe(spec, D, { items: [{ source: "most_drawn", count: 1 }], fillRandom: true }, R.makeRng(7));
assert.equal(filled.length, 2); assert.equal(filled[1].source, "隨機補"); assert.notEqual(filled[1].number, 1);
assert.throws(() => pick([{ source: "most_drawn", count: 3 }]), /超過/);

// 固定號碼 + 增加號碼
const withFixed = R.generateByRecipe(spec, D, { items: [{ source: "least_drawn", count: 2 }], tieBreak: "small", fixed: [3], add: 1 }, rng);
assert.deepEqual(withFixed.map(p => [p.number, p.source]), [[3, "固定號碼"], [5, "最少次"], [2, "最少次"]]);
assert.throws(() => R.generateByRecipe(spec, D, { items: [], fixed: [1, 1] }, rng), /重複/);
assert.throws(() => R.generateByRecipe(spec, D, { items: [], fixed: [9] }, rng), /超出/);

// 可重現:同種子同結果;不同種子通常不同
const a = R.pureRandom(GAMES["今彩539"], [], 0, R.makeRng(42)).map(p => p.number);
assert.deepEqual(a, R.pureRandom(GAMES["今彩539"], [], 0, R.makeRng(42)).map(p => p.number));
assert.equal(new Set(a).size, 5);

// 包牌:組合數
assert.equal(R.combinations([1, 2, 3, 4, 5, 6, 7], 5).length, 21);
const g539 = GAMES["今彩539"], g649 = GAMES["大樂透"], gsl = GAMES["威力彩"];
assert.equal(R.ticketCount(g539, 6), 6); assert.equal(R.ticketCount(g539, 7), 21);
assert.equal(R.ticketCount(g649, 7), 7); assert.equal(R.ticketCount(g649, 8), 28);
assert.equal(R.ticketCount(gsl, 7, 8), 56);   // 威力彩第一區 +1 號、第二區全包
assert.equal(R.expandTickets(gsl, [1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 7, 8]).length, 56);
const tk = R.expandTickets(g539, [5, 1, 2, 3, 4, 6], null);
assert.equal(tk.length, 6); assert.ok(tk.every(t => t.numbers.length === 5 && t.special === null));

// 真實資料:各遊戲的一鍵策略、配方輸出合法
for (const g of Object.values(GAMES)) {
  const draws = JSON.parse(readFileSync(new URL(`../data/${g.name}.json`, import.meta.url), "utf-8")).slice(-100);
  for (let s = 1; s <= 30; s++) {
    const r = R.makeRng(s);
    for (const add of [0, 1, 2]) {
      for (const picks of [R.balanced(g, draws, [], add, r), R.pureRandom(g, [], add, r), R.balanced(g, draws, [g.min], add, r)]) {
        const nums = picks.map(p => p.number);
        assert.equal(nums.length, g.count + add); assert.equal(new Set(nums).size, nums.length);
        assert.ok(nums.every(v => v >= g.min && v <= g.max));
      }
    }
  }
  const sec = g.extra?.pickable ? R.pickSecond(g, draws, "all", R.makeRng(1)) : null;
  if (sec) { assert.equal(sec.length, 8); assert.equal(R.pickSecond(g, draws, "hot", R.makeRng(1)).length, 1); }
}
// 均衡型:結構符合歷史常見範圍(奇偶/大小不極端)
{
  const draws = JSON.parse(readFileSync(new URL(`../data/今彩539.json`, import.meta.url), "utf-8")).slice(-300);
  for (let s = 1; s <= 50; s++) {
    const n = R.balanced(g539, draws, [], 0, R.makeRng(s)).map(p => p.number);
    const odd = n.filter(v => v % 2).length;
    assert.ok(odd >= 1 && odd <= 4, `奇偶比極端 ${n}`);
  }
}
console.log("recipes tests passed");
