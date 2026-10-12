// 選號引擎:配方、一鍵策略、包牌展開。純函式;隨機一律經由傳入的 rng,可用種子重現。
import { numberStats, mainSeries, extraSeries, sumDistribution, parityAndSize } from "../stats/index.js";

export const SOURCES = [
  { id: "most_drawn", label: "最多次" },
  { id: "least_drawn", label: "最少次" },
  { id: "current_streak", label: "連莊(目前連莊最久)" },
  { id: "longest_gap", label: "遺漏最久" },
  { id: "gap_ratio", label: "遺漏比值高" },
  { id: "last_repeat", label: "上期重號" },
  { id: "hot_n", label: "近 N 期熱號", needsN: true },
  { id: "neighbor", label: "鄰號(上期號碼前後)" },
  { id: "random", label: "隨機" },
];
export const sourceLabel = id => SOURCES.find(s => s.id === id)?.label ?? id;

// 可重現亂數(mulberry32)
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function combinations(pool, k) {
  const out = [];
  const rec = (start, cur) => {
    if (cur.length === k) { out.push([...cur]); return; }
    for (let i = start; i <= pool.length - (k - cur.length); i++) { cur.push(pool[i]); rec(i + 1, cur); cur.pop(); }
  };
  if (k >= 0 && k <= pool.length) rec(0, []);
  return out;
}

// 依來源排出候選順序(同分依 tieBreak:"random" | "small")
function ranked(spec, draws, item, tieBreak, rng) {
  const ser = mainSeries(draws);
  const rows = numberStats(ser, spec.min, spec.max, spec.count);
  const latest = ser.at(-1) ?? [];
  const tie = new Map(rows.map(r => [r.number, tieBreak === "small" && item.source !== "random" ? r.number : rng()]));
  let cand = rows, key = () => 0;
  switch (item.source) {
    case "most_drawn": key = r => r.count; break;
    case "least_drawn": key = r => -r.count; break;
    case "current_streak": key = r => r.curStreak; break;
    case "longest_gap": key = r => r.curGap; break;
    case "gap_ratio": key = r => r.gapRatio ?? 0; break;
    case "hot_n": {
      const recent = ser.slice(-Math.max(1, item.n || 10));
      const c = new Map(rows.map(r => [r.number, recent.filter(s => s.includes(r.number)).length]));
      key = r => c.get(r.number); break;
    }
    case "last_repeat": cand = rows.filter(r => latest.includes(r.number)); break;
    case "neighbor": {
      const nb = new Set(latest.flatMap(v => [v - 1, v + 1]).filter(v => v >= spec.min && v <= spec.max));
      cand = rows.filter(r => nb.has(r.number)); break;
    }
    case "random": break;
    default: throw new Error(`未知的統計來源:${item.source}`);
  }
  return [...cand].sort((a, b) => key(b) - key(a) || tie.get(a.number) - tie.get(b.number)).map(r => r.number);
}

// 配方產生一組主號。回傳 [{number, source}](不含包牌展開)。
// recipe: {items:[{source,count,n?}], tieBreak, fillRandom, fixed:[], add}
export function generateByRecipe(spec, draws, recipe, rng) {
  const fixed = recipe.fixed ?? [];
  const need = spec.count + (recipe.add ?? 0);
  validateFixed(spec, fixed, need);
  const picks = fixed.map(number => ({ number, source: "固定號碼" }));
  const taken = new Set(fixed);
  const total = recipe.items.reduce((a, i) => a + i.count, 0);
  if (picks.length + total > need) throw new Error(`條目合計 ${total} 個,加上固定號碼已超過需要的 ${need} 個`);
  for (const item of recipe.items) {
    let got = 0;
    for (const number of ranked(spec, draws, item, recipe.tieBreak ?? "random", rng)) {
      if (got >= item.count) break;
      if (taken.has(number)) continue;   // F4.2 去重:已被取走的跳過,取下一個
      taken.add(number); picks.push({ number, source: sourceLabel(item.source) }); got++;
    }
  }
  if (picks.length < need) {
    if (!recipe.fillRandom) throw new Error(`目前只選到 ${picks.length} 個,還差 ${need - picks.length} 個(可勾選「剩餘以隨機補滿」)`);
    fillRandom(spec, picks, taken, need, rng, "隨機補");
  }
  return picks;
}

function fillRandom(spec, picks, taken, need, rng, source) {
  const rest = shuffle(Array.from({ length: spec.max - spec.min + 1 }, (_, i) => spec.min + i).filter(v => !taken.has(v)), rng);
  while (picks.length < need) { const number = rest.pop(); taken.add(number); picks.push({ number, source }); }
}

function validateFixed(spec, fixed, need) {
  if (new Set(fixed).size !== fixed.length) throw new Error("固定號碼不可重複");
  if (fixed.some(v => !Number.isInteger(v) || v < spec.min || v > spec.max)) throw new Error("固定號碼超出範圍");
  if (fixed.length > need) throw new Error(`固定號碼 ${fixed.length} 個,超過需要的 ${need} 個`);
}

// 一鍵策略:純隨機(F5.1i)
export function pureRandom(spec, fixed, add, rng) {
  const need = spec.count + add;
  validateFixed(spec, fixed, need);
  const picks = fixed.map(number => ({ number, source: "固定號碼" }));
  fillRandom(spec, picks, new Set(fixed), need, rng, "隨機");
  return picks;
}

// 一鍵策略:均衡型(F5.1a)。奇偶比、大小比取歷史常見的前幾種(累計 ≥ 75%),和值落在歷史 10%~90% 區間。
// 目的是避開極端組合,不是提高中獎率。先湊出 spec.count 個符合結構的號碼,再隨機補上「增加」的號碼。
export function balanced(spec, draws, fixed, add, rng) {
  const need = spec.count + add;
  validateFixed(spec, fixed, need);
  const ser = mainSeries(draws);
  const pz = parityAndSize(ser, spec.min, spec.max, spec.count);
  const common = rows => {
    const sorted = [...rows].sort((a, b) => b.ratio - a.ratio);
    const ok = new Set();
    let cum = 0;
    for (const r of sorted) { ok.add(r.k); cum += r.ratio; if (cum >= 0.75) break; }
    return ok;
  };
  const oddOk = common(pz.odd), bigOk = common(pz.big);
  const sd = sumDistribution(ser, 10);
  const mid = (spec.min + spec.max) / 2;
  const space = Array.from({ length: spec.max - spec.min + 1 }, (_, i) => spec.min + i).filter(v => !fixed.includes(v));
  const baseFixed = fixed.slice(0, spec.count);
  let base = null;
  for (let t = 0; t < 20000 && !base; t++) {
    const cand = [...baseFixed, ...shuffle(space, rng).slice(0, spec.count - baseFixed.length)];
    const odd = cand.filter(v => v % 2 === 1).length, big = cand.filter(v => v > mid).length;
    const sum = cand.reduce((a, b) => a + b, 0);
    if (oddOk.has(odd) && bigOk.has(big) && sum >= sd.p10 && sum <= sd.p90) base = cand;
  }
  if (!base) base = [...baseFixed, ...shuffle(space, rng).slice(0, spec.count - baseFixed.length)];
  const picks = [...fixed.slice(0, spec.count).map(number => ({ number, source: "固定號碼" })),
    ...base.filter(v => !fixed.includes(v)).map(number => ({ number, source: "均衡型" }))];
  const taken = new Set(picks.map(p => p.number));
  for (const number of fixed.slice(spec.count)) { picks.push({ number, source: "固定號碼" }); taken.add(number); }
  fillRandom(spec, picks, taken, need, rng, "隨機(增加)");
  return picks;
}

// 威力彩第二區:random 1 個 / hot 最多次 / cold 最少次 / all 全部
export function pickSecond(spec, draws, mode, rng) {
  const all = Array.from({ length: spec.extra.max - spec.extra.min + 1 }, (_, i) => spec.extra.min + i);
  if (mode === "all") return all;
  if (mode === "random") return [all[Math.floor(rng() * all.length)]];
  const rows = numberStats(extraSeries(draws), spec.extra.min, spec.extra.max, 1);
  const tie = new Map(all.map(v => [v, rng()]));
  const sorted = [...rows].sort((a, b) => (mode === "hot" ? b.count - a.count : a.count - b.count) || tie.get(a.number) - tie.get(b.number));
  return [sorted[0].number];
}

// 包牌展開:主號 pool 取 spec.count 個的所有組合,乘上第二區(威力彩)選項。
export function expandTickets(spec, pool, seconds) {
  const mains = combinations([...pool].sort((a, b) => a - b), spec.count);
  const tickets = [];
  for (const m of mains) for (const s of (seconds ?? [null])) tickets.push({ numbers: m, special: s });
  return tickets;
}
export const ticketCount = (spec, poolSize, secondCount = 1) => combinations(Array.from({ length: poolSize }, (_, i) => i), spec.count).length * secondCount;
