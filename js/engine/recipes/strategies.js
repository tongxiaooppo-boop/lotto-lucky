// 一鍵策略(F5.1)、多注覆蓋(F5.2)、條件過濾(F4.9)與多組產生(F4.6)。純函式。
// 每個策略:run(spec, history, {fixed, add}, rng) → [{number, source}]。history = 範圍內的開獎(舊→新)。
import { numberStats, mainSeries, sumDistribution } from "../stats/index.js";
import { heatGroups, partnersOf } from "../stats/more.js";
import { generateByRecipe, balanced, pureRandom, shuffle, fitItems } from "./index.js";

const allNumbers = spec => Array.from({ length: spec.max - spec.min + 1 }, (_, i) => spec.min + i);

// 以固定號碼為底、從 candidates 依序補到 need 個;不足則以隨機補滿。
function complete(spec, fixed, ordered, need, source, rng) {
  const picks = fixed.map(number => ({ number, source: "固定號碼" }));
  const taken = new Set(fixed);
  for (const number of ordered) {
    if (picks.length >= need) break;
    if (!taken.has(number)) { taken.add(number); picks.push({ number, source }); }
  }
  for (const number of shuffle(allNumbers(spec).filter(v => !taken.has(v)), rng)) {
    if (picks.length >= need) break;
    taken.add(number); picks.push({ number, source: "隨機補" });
  }
  return picks;
}

// 把策略的條目依「還需要幾個」截斷(固定號碼會佔掉名額),不足的部分由 fillRandom 補滿。
const recipeStrategy = items => (spec, hist, { fixed, add }, rng) =>
  generateByRecipe(spec, hist, { items: fitItems(items(spec), spec.count + add - fixed.length), tieBreak: "random", fillRandom: true, fixed, add }, rng);

// 加權隨機(不放回):權重 w(number),Efraimidis-Spirakis 抽樣
function weightedOrder(spec, w, rng) {
  return allNumbers(spec).map(v => ({ v, k: Math.pow(rng(), 1 / Math.max(w(v), 1e-9)) })).sort((a, b) => b.k - a.k).map(x => x.v);
}

export const STRATEGIES = [
  { id: "balanced", label: "均衡型", run: (spec, hist, o, rng) => balanced(spec, hist, o.fixed, o.add, rng) },
  { id: "random", label: "純隨機", run: (spec, hist, o, rng) => pureRandom(spec, o.fixed, o.add, rng) },
  { id: "mix", label: "冷熱混合型", note: "熱、溫、冷號按固定比例(約 2:2:1)各取若干", run: (spec, hist, { fixed, add }, rng) => {
    const need = spec.count + add;
    const g = heatGroups(mainSeries(hist), spec.min, spec.max, Math.min(30, hist.length));
    const nCold = Math.max(1, Math.round(need * 0.2)), nHot = Math.ceil(need * 0.4), nWarm = need - nCold - nHot;
    const taken = new Set(fixed);
    const picks = fixed.map(number => ({ number, source: "固定號碼" }));
    for (const [rows, n, name] of [[g.hot, nHot, "熱號"], [g.warm, nWarm, "溫號"], [g.cold, nCold, "冷號"]]) {
      let got = 0;
      for (const r of shuffle(rows, rng)) { if (got >= n || picks.length >= need) break; if (!taken.has(r.number)) { taken.add(r.number); picks.push({ number: r.number, source: name }); got++; } }
    }
    return fill(spec, picks, taken, need, rng);
  } },
  { id: "rebound", label: "回補型", note: "偏好「目前遺漏 ÷ 平均間隔」比值高的號碼", run: recipeStrategy(spec => [{ source: "gap_ratio", count: spec.count }]) },
  { id: "chase", label: "追熱型", note: "偏好近 10 期次數最高的號碼", run: recipeStrategy(spec => [{ source: "hot_n", count: spec.count, n: 10 }]) },
  { id: "repeat_neighbor", label: "重號 + 鄰號型", note: "取上期 1 個重號,再取上期號碼的鄰號", run: recipeStrategy(spec => [{ source: "last_repeat", count: 1 }, { source: "neighbor", count: spec.count - 1 }]) },
  { id: "pairing", label: "配對型", note: "先選一個熱號,再補歷史上最常與它同期出現的號碼", run: (spec, hist, { fixed, add }, rng) => {
    const need = spec.count + add;
    const rows = numberStats(mainSeries(hist), spec.min, spec.max, spec.count);
    const top = [...rows].sort((a, b) => b.count - a.count).slice(0, 5);
    const anchor = (fixed[0] ?? shuffle(top, rng)[0].number);
    const partners = partnersOf(mainSeries(hist), spec.min, spec.max, anchor, need).map(p => p.number);
    const order = [anchor, ...partners];
    const picks = complete(spec, fixed, order, need, "配對", rng);
    const a = picks.find(p => p.number === anchor); if (a && a.source === "配對") a.source = "熱號(主)";
    return picks;
  } },
  { id: "weighted_freq", label: "加權隨機(依頻率)", note: "出現越多次權重越大的隨機抽樣", run: (spec, hist, { fixed, add }, rng) => {
    const c = new Map(numberStats(mainSeries(hist), spec.min, spec.max, spec.count).map(r => [r.number, r.count + 1]));
    return complete(spec, fixed, weightedOrder(spec, v => c.get(v), rng), spec.count + add, "加權(頻率)", rng);
  } },
  { id: "weighted_gap", label: "加權隨機(依遺漏)", note: "目前遺漏越長權重越大的隨機抽樣", run: (spec, hist, { fixed, add }, rng) => {
    const c = new Map(numberStats(mainSeries(hist), spec.min, spec.max, spec.count).map(r => [r.number, r.curGap + 1]));
    return complete(spec, fixed, weightedOrder(spec, v => c.get(v), rng), spec.count + add, "加權(遺漏)", rng);
  } },
  { id: "avoid_popular", label: "避熱門型", note: "避開生日號碼(1-31)與連號、等差等常見規律。中獎機率不變,但若中獎可減少與他人分獎的機會(彩金均分制)", run: (spec, hist, { fixed, add }, rng) => {
    const need = spec.count + add;
    const high = allNumbers(spec).filter(v => v > 31);
    const minHigh = Math.min(Math.ceil(spec.count / 2), high.length);
    for (let t = 0; t < 5000; t++) {
      const picks = complete(spec, fixed, [], need, "避熱門", rng);
      const nums = picks.map(p => p.number).sort((a, b) => a - b);
      const ok = nums.filter(v => v > 31).length >= minHigh && !nums.some((v, i) => i && v - nums[i - 1] === 1) && !isArithmetic(nums);
      if (ok) return picks;
    }
    return complete(spec, fixed, [], need, "避熱門", rng);
  } },
];
function isArithmetic(nums) {
  if (nums.length < 3) return false;
  const d = nums[1] - nums[0];
  return nums.every((v, i) => !i || v - nums[i - 1] === d);
}
function fill(spec, picks, taken, need, rng) {
  for (const number of shuffle(allNumbers(spec).filter(v => !taken.has(v)), rng)) { if (picks.length >= need) break; taken.add(number); picks.push({ number, source: "隨機補" }); }
  return picks;
}
export const strategyById = id => STRATEGIES.find(s => s.id === id);

// F5.2 多注覆蓋:產生 n 注,讓號碼盡量分散、減少重複(貪婪:每次優先取用次數最少的號碼)。
export function coverTickets(spec, n, rng) {
  const used = new Map(allNumbers(spec).map(v => [v, 0]));
  const tickets = [];
  for (let i = 0; i < n; i++) {
    const order = shuffle(allNumbers(spec), rng).sort((a, b) => used.get(a) - used.get(b));
    const nums = order.slice(0, spec.count).sort((a, b) => a - b);
    for (const v of nums) used.set(v, used.get(v) + 1);
    tickets.push(nums);
  }
  return { tickets, coverage: [...used.values()].filter(c => c > 0).length };
}

// F4.9 條件過濾:和值落在歷史 10%~90%、奇偶比不要 0:N 或 N:0。
export function passesFilter(spec, hist, numbers, filter) {
  if (!filter) return true;
  if (filter.parity) {
    const odd = numbers.filter(v => v % 2).length;
    if (odd === 0 || odd === numbers.length) return false;
  }
  if (filter.sum) {
    const sd = sumDistribution(mainSeries(hist), 10);
    const sum = numbers.reduce((a, b) => a + b, 0) * spec.count / numbers.length;
    if (sum < sd.p10 || sum > sd.p90) return false;
  }
  return true;
}

// F4.6 多組產生:呼叫 make(rng) 產生 sets 組,可要求彼此不重複、可套用條件過濾(不符就重抽)。
export function generateSets(spec, hist, make, rng, { sets = 1, distinct = false, filter = null, maxTries = 300 } = {}) {
  const out = [], seen = new Set();
  for (let i = 0; i < sets; i++) {
    let picks = null;
    for (let t = 0; t < maxTries; t++) {
      const cand = make(rng);
      const nums = cand.map(p => p.number).sort((a, b) => a - b);
      if (!passesFilter(spec, hist, nums, filter)) continue;
      if (distinct && seen.has(nums.join(" "))) continue;
      picks = cand; seen.add(nums.join(" ")); break;
    }
    if (!picks) throw new Error(`第 ${i + 1} 組在 ${maxTries} 次嘗試內找不到符合條件(過濾/不重複)的結果`);
    out.push(picks);
  }
  return out;
}
