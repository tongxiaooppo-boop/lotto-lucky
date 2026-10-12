import assert from "node:assert/strict";
import { GAMES } from "../js/core/games.js";
import { validateDraw, parseCsv, mergeDraws, normalizeDate, checkContinuity } from "../js/engine/draws.js";

const g539 = GAMES["今彩539"], g649 = GAMES["大樂透"], gsl = GAMES["威力彩"];
const ok = { period: "115000100", date: "2026-10-01", numbers: [1, 2, 3, 4, 39] };

assert.equal(normalizeDate("2024/12/2"), "2024-12-02");
assert.equal(normalizeDate("2024-02-30"), null);
assert.deepEqual(validateDraw(g539, ok), []);
assert.ok(validateDraw(g539, { ...ok, numbers: [1, 2, 3, 4] }).length);          // 數量
assert.ok(validateDraw(g539, { ...ok, numbers: [1, 2, 3, 4, 40] }).length);      // 範圍
assert.ok(validateDraw(g539, { ...ok, numbers: [1, 1, 3, 4, 5] }).length);       // 重複
assert.ok(validateDraw(g539, { ...ok, special: 3 }).length);                     // 539 無特別號
assert.ok(validateDraw(g649, { ...ok, numbers: [1, 2, 3, 4, 5, 6], special: 6 }).length); // 特別號不可與主號重複
assert.deepEqual(validateDraw(gsl, { ...ok, numbers: [1, 2, 3, 4, 5, 6], special: 6 }), []); // 第二區可重複
assert.ok(validateDraw(gsl, { ...ok, numbers: [1, 2, 3, 4, 5, 6], special: 9 }).length);

const csv = "﻿遊戲名稱,期別,開獎日期,銷售總額,銷售注數,總獎金,獎號1,獎號2,獎號3,獎號4,獎號5\r\n" +
  "今彩539,115000001,2026/01/01,37033400,740668,8490100,15,16,18,29,36\r\n" +
  "今彩539,115000002,2026/1/2,1,2,3,17,18,25,36,40\r\n" +
  "大樂透,115000003,2026/01/03,1,2,3,1,2,3,4,5\r\n";
const p = parseCsv(csv, g539);
assert.equal(p.draws.length, 1);
assert.equal(p.draws[0].sales, 37033400);
assert.equal(p.failed.length, 2);
assert.equal(parseCsv("a,b\n1,2", g539).failed[0].reason.startsWith("缺少欄位"), true);

const existing = [{ ...ok, period: "115000001", date: "2026-01-01" }];
const r = mergeDraws(g539, existing, [{ ...ok, period: "115000001" }, { ...ok, period: "115000002", date: "2026-01-02" }, { ...ok, period: "x" }]);
assert.equal(r.added.length, 1); assert.deepEqual(r.skipped, ["115000001"]); assert.equal(r.failed.length, 1);
assert.equal(r.merged.length, 2); assert.equal(existing.length, 1); // 不修改輸入

assert.deepEqual(checkContinuity([{ period: "115000001" }, { period: "115000002" }, { period: "115000005" }, { period: "116000001" }]), ["115000003 ~ 115000004"]);
console.log("engine tests passed");
