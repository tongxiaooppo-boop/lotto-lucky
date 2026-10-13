// 加州539:資料解析、交叉比對、期別驗證,以及選號的「尾號」「引用最後一期」來源與 +n 包牌。不連網。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GAMES } from "../js/core/games.js";
import { validateDraw } from "../js/engine/draws.js";
import { parseOfficial, parseLotteryNet, parse9800, parseEnglishDate, crossCheck, diffAgainst } from "../js/data/ca539.js";
import { generateByRecipe, makeRng, expandTickets, ticketCount, SOURCES, EXTRA_SOURCES, BASE_SOURCES, sourceLabelFor } from "../js/engine/recipes/index.js";

const spec = GAMES["加州539"];
assert.equal(spec.count, 5); assert.equal(spec.max, 39); assert.equal(spec.extra, null);

// ---- 期別與驗證 ----
assert.deepEqual(validateDraw(spec, { period: "20261012", date: "2026-10-12", numbers: [2, 9, 11, 17, 18] }), []);
assert.ok(validateDraw(spec, { period: "115000001", date: "2026-10-12", numbers: [2, 9, 11, 17, 18] }).length, "9 位數期別對加州539 不合格");
assert.ok(validateDraw(spec, { period: "20261012", date: "2026-10-12", numbers: [2, 9, 11, 17, 40] }).length, "號碼超出 1-39");
assert.deepEqual(validateDraw(GAMES["今彩539"], { period: "115000001", date: "2026-10-12", numbers: [2, 9, 11, 17, 18] }), [], "台灣遊戲的期別規則不變");

// ---- 官網 JSON ----
const rec = (date, nums) => ({ DrawNumber: 1, DrawDate: `${date}T07:00:00`, WinningNumbers: Object.fromEntries(nums.map((n, i) => [String(i), { Number: String(n), IsSpecial: false, Name: null }])) });
const off = parseOfficial(spec, { TotalPreviousDraws: 3, PreviousDraws: [rec("2026-10-12", [18, 2, 9, 17, 11]), rec("2026-10-11", [8, 18, 26, 27, 36]), rec("2026-10-10", [2, 5, 10, 14, 99])] });
assert.equal(off.draws.length, 2); assert.equal(off.failed.length, 1, "號碼 99 超出範圍");
assert.deepEqual(off.draws[0], { period: "20261012", date: "2026-10-12", numbers: [2, 9, 11, 17, 18] }, "號碼排序、期別=日期");
assert.throws(() => parseOfficial(spec, { foo: 1 }), /格式已變更/);

// ---- lottery.net(列的 class 不固定:winRow 或沒有 class)----
const row = (cls, d, nums) => `<tr ${cls}><td class="colour noBefore">${d}</td><td><ul class="balls">${nums.map(n => `<li class="ball ca-fantasy-5 ball">${n}</li>`).join("")}</ul></td><td>1</td></tr>`;
const html = `<table><tr><th>x</th></tr>${row('class="winRow"', "October 12, 2026", [2, 9, 11, 17, 18])}${row("", "October 11, 2026", [8, 18, 26, 27, 36])}${row("", "October 10, 2026", [1, 2, 3])}</table>`;
const ln = parseLotteryNet(spec, html);
assert.equal(ln.draws.length, 2, "兩種列都要解析"); assert.equal(ln.failed.length, 1, "只有 3 個號碼");
assert.equal(parseEnglishDate("January 3, 2026"), "2026-01-03"); assert.equal(parseEnglishDate("Foo 3, 2026"), null);

// ---- 9800 ----
const h9800 = `<TR><TD align=center>012028</TD>\n<TD noWrap align=center>2026-10-12</TD>\n<TD noWrap align=center><b><FONT color=red>02 09 11 17 18</FONT></B></TD></TR>
<TR><TD align=center>012027</TD><TD noWrap align=center>2026-10-11</TD><TD noWrap align=center><b><font color="#006600">08 18 26 27 36</FONT></B></TD></TR>`;
const n9800 = parse9800(spec, h9800);
assert.equal(n9800.draws.length, 2); assert.deepEqual(n9800.draws[0].numbers, [2, 9, 11, 17, 18]);

// ---- 交叉比對與衝突偵測 ----
assert.deepEqual(crossCheck(off.draws, ln.draws), { checked: 2, conflicts: [] });
const alt = [{ ...ln.draws[0], numbers: [1, 9, 11, 17, 18] }];
assert.equal(crossCheck(off.draws, alt).conflicts.length, 1);
const d = diffAgainst([off.draws[0]], [off.draws[0], { period: "20261011", date: "2026-10-11", numbers: [8, 18, 26, 27, 36] }, { ...off.draws[0], numbers: [3, 9, 11, 17, 18] }]);
assert.equal(d.fresh.length, 1); assert.equal(d.conflicts.length, 1);

// ---- 選號來源:尾號 ----
const draws = JSON.parse(readFileSync(new URL("../data/加州539.json", import.meta.url), "utf-8")).slice(-300);
for (const digit of [0, 3, 9]) {
  const picks = generateByRecipe(spec, draws, { items: [{ source: "tail_digit", digit, count: 3 }], tieBreak: "random", fillRandom: true, fixed: [], add: 0 }, makeRng(7));
  const tail = picks.filter(p => p.source === `尾號${digit}`);
  assert.equal(tail.length, 3); assert.ok(tail.every(p => p.number % 10 === digit), `尾數 ${digit}`);
}
// 依最多次排序:取到的是該尾數中次數最高的(同次數取較小號)
{
  const cnt = new Map(); for (const x of draws) for (const n of x.numbers) cnt.set(n, (cnt.get(n) ?? 0) + 1);
  const best = [3, 13, 23, 33].sort((a, b) => (cnt.get(b) ?? 0) - (cnt.get(a) ?? 0) || a - b)[0];
  const p = generateByRecipe(spec, draws, { items: [{ source: "tail_digit", digit: 3, by: "most_drawn", count: 1 }], tieBreak: "small", fillRandom: true, fixed: [], add: 0 }, makeRng(1));
  assert.equal(p[0].number, best);
}
assert.throws(() => generateByRecipe(spec, draws, { items: [{ source: "tail_digit", digit: 10, count: 1 }], fillRandom: true, fixed: [], add: 0 }, makeRng(1)), /尾數必須是 0-9/);
// 號碼範圍 1-38 的威力彩:尾數 9 只有 9/19/29(沒有 39)
{
  const sl = GAMES["威力彩"], slDraws = JSON.parse(readFileSync(new URL("../data/威力彩.json", import.meta.url), "utf-8")).slice(-200);
  const p = generateByRecipe(sl, slDraws, { items: [{ source: "tail_digit", digit: 9, count: 3 }], fillRandom: true, fixed: [], add: 0 }, makeRng(2)).filter(x => x.number % 10 === 9);
  assert.deepEqual(p.map(x => x.number).sort((a, b) => a - b), [9, 19, 29]);
}

// ---- 選號來源:引用最後一期 ----
const ref = [2, 9, 11, 17, 18];
const r1 = generateByRecipe(GAMES["今彩539"], draws, { items: [{ source: "ref_other", count: 3 }], tieBreak: "small", fillRandom: true, fixed: [], add: 0, ref }, makeRng(5));
assert.deepEqual(r1.slice(0, 3).map(p => p.number), [2, 9, 11], "同分依較小號優先");
assert.ok(r1.slice(0, 3).every(p => ref.includes(p.number)));
assert.ok(r1.slice(0, 3).every(p => p.source === "加州539(最新一期)"));
assert.ok(generateByRecipe(spec, draws, { items: [{ source: "ref_other", count: 2 }], tieBreak: "small", fillRandom: true, fixed: [], add: 0, ref }, makeRng(5)).slice(0, 2).every(p => p.source === "今彩539(最新一期)"), "加州539 分頁的標籤是今彩539");
assert.equal(new Set(r1.map(p => p.number)).size, 5, "不重複");
// 超出範圍的略過:威力彩 1-38 引用含 39 的號碼
const r2 = generateByRecipe(GAMES["威力彩"], JSON.parse(readFileSync(new URL("../data/威力彩.json", import.meta.url), "utf-8")).slice(-100), { items: [{ source: "ref_other", count: 2 }], tieBreak: "small", fillRandom: true, fixed: [], add: 0, ref: [39, 5, 20] }, makeRng(3));
assert.deepEqual(r2.slice(0, 2).map(p => p.number), [5, 20]);
assert.throws(() => generateByRecipe(spec, draws, { items: [{ source: "ref_other", count: 1 }], fillRandom: true, fixed: [], add: 0 }, makeRng(1)), /沒有可引用/);
assert.throws(() => generateByRecipe(spec, draws, { items: [{ source: "ref_other", count: 1 }], fillRandom: true, fixed: [], add: 0, ref: [] }, makeRng(1)), /沒有可引用/);
assert.equal(sourceLabelFor("ref_other", GAMES["今彩539"]), "加州539(最新一期)"); assert.equal(sourceLabelFor("ref_other", spec), "今彩539(最新一期)");

// 新來源只給主號配方:特別號/第二區與回測組合搜尋都不含
for (const id of ["tail_digit", "ref_other"]) {
  assert.ok(SOURCES.some(s => s.id === id)); assert.ok(!EXTRA_SOURCES.some(s => s.id === id)); assert.ok(!BASE_SOURCES.some(s => s.id === id));
}

// ---- +n 包牌(539 類增加 3~10 號)----
for (const [add, expect] of [[3, 56], [5, 252], [10, 3003]]) {
  assert.equal(ticketCount(spec, 5 + add), expect, `C(${5 + add},5)`);
  const pool = Array.from({ length: 5 + add }, (_, i) => i + 1);
  const t = expandTickets(spec, pool, null);
  assert.equal(t.length, expect); assert.equal(new Set(t.map(x => x.numbers.join())).size, expect, "各注不重複");
}
const big = generateByRecipe(spec, draws, { items: [{ source: "most_drawn", count: 6 }, { source: "tail_digit", digit: 5, count: 4 }], tieBreak: "random", fillRandom: true, fixed: [], add: 10, ref }, makeRng(9));
assert.equal(big.length, 15); assert.equal(new Set(big.map(p => p.number)).size, 15);

console.log("ca539 tests passed");
