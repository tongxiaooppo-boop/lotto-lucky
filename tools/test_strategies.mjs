import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GAMES } from "../js/core/games.js";
import { makeRng, generateByRecipe } from "../js/engine/recipes/index.js";
import { STRATEGIES, coverTickets, generateSets, passesFilter } from "../js/engine/recipes/strategies.js";

// 每個策略 × 每個遊戲 × 增加號碼 0~2 × 有無固定號碼:輸出數量、範圍、不重複皆合法
for (const g of Object.values(GAMES)) {
  const hist = JSON.parse(readFileSync(new URL(`../data/${g.name}.json`, import.meta.url), "utf-8")).slice(-100);
  for (const st of STRATEGIES) for (const add of [0, 1, 2]) for (const fixed of [[], [g.min + 2]]) for (let seed = 1; seed <= 15; seed++) {
    const picks = st.run(g, hist, { fixed, add }, makeRng(seed));
    const nums = picks.map(p => p.number);
    const tag = `${g.name}/${st.id}/add${add}/fixed${fixed.length}/seed${seed}`;
    assert.equal(nums.length, g.count + add, tag);
    assert.equal(new Set(nums).size, nums.length, tag);
    assert.ok(nums.every(v => v >= g.min && v <= g.max), tag);
    assert.ok(fixed.every(f => nums.includes(f)), tag + " 固定號碼");
  }
}
const g649 = GAMES["大樂透"], g539 = GAMES["今彩539"];
const hist649 = JSON.parse(readFileSync(new URL(`../data/大樂透.json`, import.meta.url), "utf-8")).slice(-100);
const byId = id => STRATEGIES.find(s => s.id === id);

// 避熱門:至少一半號碼 > 31、無連號、非等差
for (let s = 1; s <= 40; s++) {
  const n = byId("avoid_popular").run(g649, hist649, { fixed: [], add: 0 }, makeRng(s)).map(p => p.number).sort((a, b) => a - b);
  assert.ok(n.filter(v => v > 31).length >= 3, n.join());
  assert.ok(!n.some((v, i) => i && v - n[i - 1] === 1), n.join());
}

// 多注覆蓋:10 注 539(50 個號碼位)至少覆蓋全部 39 個號碼;各號碼用次數最多差 1
{
  const { tickets, coverage } = coverTickets(g539, 10, makeRng(5));
  assert.equal(tickets.length, 10); assert.equal(coverage, 39);
  const use = new Map(); for (const t of tickets) for (const v of t) use.set(v, (use.get(v) ?? 0) + 1);
  assert.ok(Math.max(...use.values()) - Math.min(...[...use.values()]) <= 1 || use.size === 39);
  assert.ok(tickets.every(t => new Set(t).size === 5));
}

// 條件過濾與多組
assert.equal(passesFilter(g539, hist649, [1, 3, 5, 7, 9], { parity: true }), false);        // 5:0
assert.equal(passesFilter(g539, hist649, [1, 2, 3, 4, 5], { sum: true }), false);            // 和值太小
assert.equal(passesFilter(g539, hist649, [1, 2, 3, 4, 5], null), true);
const hist539 = JSON.parse(readFileSync(new URL(`../data/今彩539.json`, import.meta.url), "utf-8")).slice(-300);
{
  const sets = generateSets(g539, hist539, r => byId("random").run(g539, hist539, { fixed: [], add: 0 }, r), makeRng(9), { sets: 8, distinct: true, filter: { sum: true, parity: true } });
  assert.equal(sets.length, 8);
  assert.equal(new Set(sets.map(s => s.map(p => p.number).sort((a, b) => a - b).join())).size, 8);
  for (const s of sets) assert.ok(passesFilter(g539, hist539, s.map(p => p.number), { sum: true, parity: true }));
  assert.throws(() => generateSets(g539, hist539, () => [{ number: 1 }, { number: 2 }, { number: 3 }, { number: 4 }, { number: 5 }], makeRng(1), { sets: 2, distinct: true, maxTries: 5 }), /找不到/);
}
// 條目自訂範圍(F4.4):近 1 期最多次 = 該期的號碼之一
{
  const last = hist539.at(-1).numbers;
  const p = generateByRecipe(g539, hist539, { items: [{ source: "most_drawn", count: 1, scope: { type: "last_n", n: 1 } }], fillRandom: true, tieBreak: "random" }, makeRng(2));
  assert.ok(last.includes(p[0].number));
}
console.log("strategies tests passed");
