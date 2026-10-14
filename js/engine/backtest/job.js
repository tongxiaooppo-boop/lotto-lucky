// 回測工作的共用入口(Worker 與主執行緒備援都呼叫它)。
import { GAMES } from "../../core/games.js";
import { backtest, strategyFn, compareAll, compareExtra } from "./index.js";
import { generateByRecipe, fitItems, refGameName } from "../recipes/index.js";

// 「目前配方」的回測函式。回測一律每注 spec.count 個、不含固定號碼:
//  - 條目合計超過 spec.count(選號頁用了「增加號碼」)時,依序截斷,不足由隨機補滿。
//  - 條目自訂範圍從「該期以前的完整歷史」取,不受回測歷史窗口限制(與選號頁一致)。
//  - 「引用另一遊戲最後一期」用被預測那期開獎日「之前」(不含當天)最近一期的號碼,避免用到未來資料;
//    refDraws 需由呼叫端提供(另一遊戲的 [{date, numbers}],舊→新)。該日期之前沒有資料的期數,略過這個條目、由隨機補。
export function recipeFn(spec, recipe, refDraws = null) {
  const items = fitItems(recipe.items, spec.count);
  const needsRef = items.some(i => i.source === "ref_other");
  if (needsRef && !refDraws?.length) throw new Error(`配方含「${refGameName(spec)}(最新一期)」,但沒有${refGameName(spec)}資料可回測`);
  const needsFull = items.some(i => i.scope);
  const refAt = date => {
    let lo = 0, hi = refDraws.length;   // 找第一個 date >= 目標日期的位置,前一筆就是「之前最近一期」
    while (lo < hi) { const m = (lo + hi) >> 1; if (refDraws[m].date < date) lo = m + 1; else hi = m; }
    return lo ? refDraws[lo - 1].numbers : null;
  };
  return (hist, rng, ctx) => {
    const ref = needsRef ? refAt(ctx.date) : undefined;
    const use = needsRef && !ref ? items.filter(i => i.source !== "ref_other") : items;
    return generateByRecipe(spec, hist, { items: use, tieBreak: recipe.tieBreak, fillRandom: true, fixed: [], add: 0, ref, full: needsFull ? ctx.before() : undefined }, rng).map(p => p.number);
  };
}

// job: {gameName, draws, mode:"one"|"all"|"extra", strategy:id|"recipe", recipe?, refDraws?, testCount, scopeN, seed}
export function runJob(job, onProgress) {
  const spec = GAMES[job.gameName];
  if (!spec) throw new Error(`未知的遊戲:${job.gameName}`);
  const opts = { testCount: job.testCount, scopeN: job.scopeN, seed: job.seed, onProgress };
  if (job.mode === "extra") return { mode: "extra", rows: compareExtra(spec, job.draws, { testCount: job.testCount, scopeN: job.scopeN, seed: job.seed, k: job.k ?? 1 }, onProgress) };
  if (job.mode === "all") return { mode: "all", rows: compareAll(spec, job.draws, { ...opts, onProgress: undefined }, onProgress) };
  const fn = job.strategy === "recipe" ? recipeFn(spec, job.recipe, job.refDraws) : strategyFn(spec, job.strategy);
  return { mode: "one", result: backtest(spec, job.draws, fn, opts) };
}
