// 驗證 js/core/presets.js:每個按鈕的配方合法,且能實際產生合法號碼。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GAMES } from "../js/core/games.js";
import { PRESETS } from "../js/core/presets.js";
import { SOURCES, makeRng, generateByRecipe } from "../js/engine/recipes/index.js";

const ids = new Set(SOURCES.map(s => s.id));
for (const g of Object.values(GAMES)) {
  const list = PRESETS[g.name] ?? [];
  assert.ok(list.length > 0, `${g.name} 沒有回測組合`);
  const draws = JSON.parse(readFileSync(new URL(`../data/${g.name}.json`, import.meta.url), "utf-8")).slice(-300);
  for (const p of list) {
    assert.equal(p.items.reduce((a, i) => a + i.count, 0), g.count, `${g.name}/${p.name} 條目數量須等於 ${g.count}`);
    assert.ok(p.items.every(i => ids.has(i.source)), `${p.name} 有未知來源`);
    assert.ok(Number.isFinite(p.train.diff) && Number.isFinite(p.test.diff) && p.test.p >= 0 && p.test.p <= 1);
    for (const [fixed, add] of [[[], 0], [[g.min], 0], [[], 2], [[g.min, g.min + 1], 1]]) {
      const need = g.count + add;
      let remaining = Math.max(0, need - fixed.length);
      const items = [];
      for (const it of p.items) { const count = Math.min(it.count, remaining); if (count > 0) { items.push({ ...it, count }); remaining -= count; } }   // 與 UI 的 applyPreset 相同的截斷
      const picks = generateByRecipe(g, draws, { items, tieBreak: "random", fillRandom: true, fixed, add }, makeRng(7)).map(x => x.number);
      assert.equal(picks.length, need); assert.equal(new Set(picks).size, need);
    }
  }
}
// 一鍵策略回測排名:每個遊戲的 id 與 STRATEGIES 完全對應,且由高到低排序
import { STRATEGY_RANK } from "../js/core/strategy_rank.js";
import { STRATEGIES } from "../js/engine/recipes/strategies.js";
for (const g of Object.values(GAMES)) {
  const rows = STRATEGY_RANK[g.name];
  assert.deepEqual(rows.map(r => r.id).sort(), STRATEGIES.map(s => s.id).sort(), `${g.name} 策略排名與策略清單不一致`);
  assert.ok(rows.every((r, i) => !i || rows[i - 1].diff >= r.diff && r.p >= 0 && r.p <= 1));
}
console.log("presets tests passed");
