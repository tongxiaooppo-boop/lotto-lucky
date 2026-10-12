// 驗證 js/core/presets_extra.js:每個按鈕的來源合法、個數合理,且能實際選出合法的特別號/第二區。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GAMES } from "../js/core/games.js";
import { EXTRA_PRESETS } from "../js/core/presets_extra.js";
import { EXTRA_SOURCES, makeRng, pickExtra } from "../js/engine/recipes/index.js";

const ids = new Set(EXTRA_SOURCES.map(s => s.id));
for (const g of Object.values(GAMES).filter(x => x.extra)) {
  const list = EXTRA_PRESETS[g.name] ?? [];
  assert.ok(list.length > 0, `${g.name} 沒有特別號/第二區回測組合`);
  const draws = JSON.parse(readFileSync(new URL(`../data/${g.name}.json`, import.meta.url), "utf-8")).slice(-300);
  const range = g.extra.max - g.extra.min + 1;
  for (const p of list) {
    assert.ok(ids.has(p.source), `${p.name} 有未知來源`);
    assert.ok(Number.isInteger(p.k) && p.k >= 1 && p.k <= range && (g.extra.pickable || p.k === 1), `${p.name} 個數不合法`);
    assert.ok(Number.isFinite(p.train.diff) && Number.isFinite(p.test.diff) && p.test.p >= 0 && p.test.p <= 1);
    const picks = pickExtra(g, draws, { source: p.source, k: p.k, n: p.n }, makeRng(7));
    assert.equal(picks.length, p.k); assert.equal(new Set(picks).size, p.k);
    assert.ok(picks.every(v => v >= g.extra.min && v <= g.extra.max));
  }
}
console.log("presets_extra tests passed");
