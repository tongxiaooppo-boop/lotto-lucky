// 策略回測(F5.3):對每個測試期,只用「該期以前」的資料產生推薦,再與實際開獎比對。
// 純函式;strategyFn(history, rng) → 主號陣列(history 為範圍內的開獎,舊→新)。
import { makeRng, pickSecond } from "../recipes/index.js";
import { hypergeom } from "../stats/index.js";
import { STRATEGIES } from "../recipes/strategies.js";

export const MIN_HISTORY = 30;

// 中獎等級(單注)。hits = 主號命中數;sp = 特別號/第二區是否命中。
export function prizeTier(gameKey, hits, sp) {
  if (gameKey === "539") return { 5: "頭獎", 4: "貳獎", 3: "參獎", 2: "肆獎" }[hits] ?? null;
  if (gameKey === "lotto649") {
    if (hits === 6) return "頭獎";
    if (hits === 5) return sp ? "貳獎" : "參獎";
    if (hits === 4) return sp ? "肆獎" : "伍獎";
    if (hits === 3) return sp ? "陸獎" : "普獎";
    if (hits === 2 && sp) return "柒獎";
    return null;
  }
  if (gameKey === "superlotto638") {
    if (hits === 6) return sp ? "頭獎" : "貳獎";
    if (hits === 5) return sp ? "參獎" : "肆獎";
    if (hits === 4) return sp ? "伍獎" : "陸獎";
    if (hits === 3) return sp ? "柒獎" : "玖獎";
    if (hits === 2 && sp) return "捌獎";
    if (hits === 1 && sp) return "普獎";
    return null;
  }
  throw new Error(`未知的遊戲:${gameKey}`);
}

// 超幾何分布的平均與變異數(抽 k 個、母體 N 個、其中 K 個是中獎號碼)
function hyperMoments(k, K, N) {
  const mean = k * K / N;
  return { mean, variance: k * (K / N) * (1 - K / N) * (N - k) / (N - 1) };
}
// 標準常態分布的雙尾 p 值(Abramowitz-Stegun 26.2.17,誤差 < 1e-7)
export function normalP(z) {
  const x = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * x);
  const q = 0.3989423 * Math.exp(-x * x / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return Math.min(1, 2 * q);
}

// 以單一策略回測。回傳統計摘要。
export function backtest(spec, draws, strategyFn, { scopeN = null, testCount = 300, seed = 1, onProgress } = {}) {
  const n = draws.length;
  const start = Math.max(MIN_HISTORY, n - testCount);
  const rng = makeRng(seed);
  const hitCount = Array(spec.count + 1).fill(0);
  const tiers = {};
  let sum = 0, sumSq = 0, tests = 0, anyPrize = 0;
  for (let i = start; i < n; i++) {
    const hist = draws.slice(scopeN ? Math.max(0, i - scopeN) : 0, i);   // 嚴格只用 i 以前的資料
    const actual = draws[i];
    const picks = strategyFn(hist, rng);
    let sp = false;
    if (spec.extra) {
      if (spec.extra.pickable) sp = pickSecond(spec, hist, "random", rng)[0] === actual.special;
      else sp = picks.includes(actual.special);   // 大樂透特別號:不用選,看所選號碼是否含特別號
    }
    const hits = picks.filter(v => actual.numbers.includes(v)).length;
    hitCount[hits]++; sum += hits; sumSq += hits * hits; tests++;
    const tier = prizeTier(spec.key, hits, sp);
    if (tier) { tiers[tier] = (tiers[tier] ?? 0) + 1; anyPrize++; }
    if (onProgress && (i - start) % 25 === 0) onProgress((i - start + 1) / (n - start));
  }
  const mean = sum / tests;
  const sd = Math.sqrt(Math.max(0, sumSq / tests - mean * mean));
  const se = sd / Math.sqrt(tests);
  const range = spec.max - spec.min + 1;
  const m = hyperMoments(spec.count, spec.count, range);
  const z = (mean - m.mean) / Math.sqrt(m.variance / tests);
  return {
    tests, mean, sd, ci95: [mean - 1.96 * se, mean + 1.96 * se],
    expectedMean: m.mean, z, p: normalP(z),
    hitDist: hitCount.map((count, k) => ({ k, count, ratio: count / tests, theory: hypergeom(k, spec.count, range) })),
    tiers, anyPrize, anyPrizeRate: anyPrize / tests,
  };
}

// 取得策略函式:id 為 STRATEGIES 的 id,或傳入自訂函式(如目前配方)。
export function strategyFn(spec, idOrFn) {
  if (typeof idOrFn === "function") return idOrFn;
  const s = STRATEGIES.find(x => x.id === idOrFn);
  if (!s) throw new Error(`未知的策略:${idOrFn}`);
  return (hist, rng) => s.run(spec, hist, { fixed: [], add: 0 }, rng).map(p => p.number);
}

// 全策略比較(含純隨機基準),依平均命中數排序。
export function compareAll(spec, draws, opts, onProgress) {
  const rows = [];
  STRATEGIES.forEach((s, idx) => {
    rows.push({ id: s.id, label: s.label, ...backtest(spec, draws, strategyFn(spec, s.id), opts) });
    onProgress?.((idx + 1) / STRATEGIES.length);
  });
  return rows.sort((a, b) => b.mean - a.mean);
}
