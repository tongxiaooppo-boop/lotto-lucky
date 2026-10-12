// 回測工作的共用入口(Worker 與主執行緒備援都呼叫它)。
import { GAMES } from "../../core/games.js";
import { backtest, strategyFn, compareAll } from "./index.js";
import { generateByRecipe } from "../recipes/index.js";

// job: {gameName, draws, mode:"one"|"all", strategy:id|"recipe", recipe?, testCount, scopeN, seed}
export function runJob(job, onProgress) {
  const spec = GAMES[job.gameName];
  if (!spec) throw new Error(`未知的遊戲:${job.gameName}`);
  const opts = { testCount: job.testCount, scopeN: job.scopeN, seed: job.seed, onProgress };
  if (job.mode === "all") return { mode: "all", rows: compareAll(spec, job.draws, { ...opts, onProgress: undefined }, onProgress) };
  const fn = job.strategy === "recipe"
    ? (hist, rng) => generateByRecipe(spec, hist, { ...job.recipe, fixed: [], add: 0, fillRandom: true }, rng).map(p => p.number)
    : strategyFn(spec, job.strategy);
  return { mode: "one", result: backtest(spec, job.draws, fn, opts) };
}
