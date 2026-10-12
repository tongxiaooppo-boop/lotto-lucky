// 官網抓取模組的離線測試(用假的 fetch,不連網)。
import assert from "node:assert/strict";
import { GAMES } from "../js/core/games.js";
import { normalizeRecord, fetchMonth, fetchJson, monthsToFetch, fetchLatest, taipeiToday } from "../js/data/official.js";

const g539 = GAMES["今彩539"], g649 = GAMES["大樂透"], gsl = GAMES["威力彩"];

// 欄位轉換(取自官網實際回應)
assert.deepEqual(normalizeRecord(g539, { period: 115000246, lotteryDate: "2026-10-10T00:00:00", drawNumberSize: [14, 21, 23, 32, 34], sellAmount: 38291600, totalAmount: 9367400 }),
  { period: "115000246", date: "2026-10-10", numbers: [14, 21, 23, 32, 34], sales: 38291600, bets: 765832, prize: 9367400 });
assert.deepEqual(normalizeRecord(g649, { period: 115000095, lotteryDate: "2026-10-09T00:00:00", drawNumberSize: [3, 9, 11, 25, 34, 41, 27], sellAmount: 172838800, totalAmount: 370100504 }),
  { period: "115000095", date: "2026-10-09", numbers: [3, 9, 11, 25, 34, 41], sales: 172838800, bets: 3456776, prize: 370100504, special: 27 });
assert.equal(normalizeRecord(gsl, { period: 115000081, lotteryDate: "2026-10-08T00:00:00", drawNumberSize: [4, 23, 27, 28, 29, 38, 5], sellAmount: 55267600 }).bets, 552676);
assert.throws(() => normalizeRecord(g539, { period: 1, lotteryDate: "2026-10-10T00:00:00", drawNumberSize: [1, 2, 3] }), /號碼數量/);

const noSleep = { sleep: async () => {} };
const reply = (list, extra = {}) => async () => ({ ok: true, status: 200, json: async () => ({ rtCode: 0, content: { totalSize: list.length, daily539Res: list, ...extra } }) });
const rec = (p, date, nums) => ({ period: p, lotteryDate: date + "T00:00:00", drawNumberSize: nums, sellAmount: 1000, totalAmount: 500 });

// fetchMonth:壞資料進 failed,好資料排序
{
  const r = await fetchMonth(g539, "2026-10", { fetchFn: reply([rec(115000002, "2026-10-02", [1, 2, 3, 4, 5]), rec(115000001, "2026-10-01", [1, 2, 3, 4, 5]), rec(115000003, "2026-10-03", [1, 2, 3, 4, 99])]), ...noSleep });
  assert.deepEqual(r.draws.map(d => d.period), ["115000001", "115000002"]); assert.equal(r.failed.length, 1);
}
// 格式改版 / 錯誤碼 / 非 200 要明確丟錯(重試用的 sleep 以假函式取代,測試不等待)
const jsonReply = obj => async () => ({ ok: true, status: 200, json: async () => obj });
await assert.rejects(fetchMonth(g539, "2026-10", { fetchFn: jsonReply({ rtCode: 0, content: {} }), ...noSleep }), /格式已變更/);
await assert.rejects(fetchMonth(g539, "2026-10", { fetchFn: jsonReply({ rtCode: 9, rtMsg: "x" }), ...noSleep }), /連續 3 次失敗:官網回報錯誤/);
await assert.rejects(fetchMonth(g539, "2026-10", { fetchFn: async () => ({ ok: false, status: 503 }), ...noSleep }), /連續 3 次失敗:官網回應 503/);
await assert.rejects(fetchMonth(g539, "2026-10", { fetchFn: jsonReply({ rtCode: 0, content: { totalSize: 150, daily539Res: [] } }), ...noSleep }), /超過一頁/);

// 重試:前 2 次失敗、第 3 次成功;退避 1s、2s;格式錯誤不重試
{
  let calls = 0; const waits = [];
  const flaky = async () => (++calls < 3 ? { ok: false, status: 503 } : { ok: true, status: 200, json: async () => ({ rtCode: 0, content: {} }) });
  const j = await fetchJson("u", { fetchFn: flaky, sleep: async ms => { waits.push(ms); } });
  assert.equal(j.rtCode, 0); assert.equal(calls, 3); assert.deepEqual(waits, [1000, 2000]);
  let c2 = 0;
  await assert.rejects(fetchMonth(g539, "2026-10", { fetchFn: async () => { c2++; return { ok: true, status: 200, json: async () => ({ rtCode: 0, content: {} }) }; }, ...noSleep }), /格式已變更/);
  assert.equal(c2, 1);
}

// 月份範圍
assert.deepEqual(monthsToFetch([{ date: "2026-09-30" }], "2026-10-12"), ["2026-09", "2026-10"]);
assert.deepEqual(monthsToFetch([{ date: "2025-11-05" }], "2026-01-02"), ["2025-11", "2025-12", "2026-01"]);
assert.equal(taipeiToday(new Date("2026-10-12T17:00:00Z")), "2026-10-13");   // UTC 17:00 = 台灣隔天 01:00

// fetchLatest:衝突偵測(同期別、號碼不同)
{
  const existing = [{ period: "115000001", date: "2026-10-01", numbers: [1, 2, 3, 4, 5] }, { period: "115000002", date: "2026-10-02", numbers: [1, 2, 3, 4, 5] }];
  const r = await fetchLatest(g539, existing, { today: "2026-10-05", delayMs: 0, ...noSleep, fetchFn: reply([rec(115000001, "2026-10-01", [1, 2, 3, 4, 5]), rec(115000002, "2026-10-02", [1, 2, 3, 4, 6]), rec(115000003, "2026-10-03", [7, 8, 9, 10, 11])]) });
  assert.equal(r.draws.length, 3); assert.deepEqual(r.conflicts.map(c => c.period), ["115000002"]);
}
console.log("official tests passed");
