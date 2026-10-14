// 選號引擎:配方、一鍵策略、包牌展開。純函式;隨機一律經由傳入的 rng,可用種子重現。
import { numberStats, mainSeries, extraSeries, sumDistribution, parityAndSize, applyScope } from "../stats/index.js";

// 基本來源:只看這個遊戲自己的統計。回測組合搜尋與特別號/第二區選號只用這一組。
export const BASE_SOURCES = [
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
// 選號規則的進階來源(僅主號配方):
//  tail_digit:指定尾數(0-9),只從該尾數的號碼挑(03/13/23/33…),再依 item.by 排序取號(預設最多次)。
//  ref_other:引用另一個遊戲「最後一期」的號碼當候選(台灣遊戲引用加州539,加州539 引用今彩539);超出本遊戲號碼範圍的略過。
export const TAIL_ORDERS = [
  { id: "most_drawn", label: "最多次" }, { id: "least_drawn", label: "最少次" },
  { id: "longest_gap", label: "遺漏最久" }, { id: "random", label: "隨機" },
];
export const SOURCES = [
  ...BASE_SOURCES,
  { id: "tail_digit", label: "尾號?", needsDigit: true },
  { id: "ref_other", label: "加州539(最新一期)", needsRef: true },
];
// 特別號/第二區專用來源:主號配方的來源 + 兩種加權隨機(號碼少,等同其他遊戲的「加權隨機」策略)。
export const EXTRA_SOURCES = [
  ...BASE_SOURCES,
  { id: "weighted_freq", label: "加權隨機(依頻率)" },
  { id: "weighted_gap", label: "加權隨機(依遺漏)" },
];
export const sourceLabel = id => SOURCES.find(s => s.id === id)?.label ?? id;
// 引用來源的名稱依目前遊戲而定:加州539 分頁引用的是今彩539。
export const refGameName = spec => (spec.key === "ca539" ? "今彩539" : "加州539");
export const sourceLabelFor = (id, spec) => (id === "ref_other" ? `${refGameName(spec)}(最新一期)` : sourceLabel(id));

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
// ctx.ref:ref_other 用,另一個遊戲最後一期的號碼陣列。
function ranked(spec, draws, item, tieBreak, rng, ctx = {}) {
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
    case "tail_digit": {
      const digit = Number.isInteger(item.digit) ? item.digit : 0;
      if (digit < 0 || digit > 9) throw new Error(`尾數必須是 0-9(目前 ${item.digit})`);
      cand = rows.filter(r => r.number % 10 === digit);
      if (!cand.length) throw new Error(`號碼範圍 ${spec.min}-${spec.max} 內沒有尾數 ${digit} 的號碼`);
      const by = item.by ?? "most_drawn";
      if (by === "most_drawn") key = r => r.count;
      else if (by === "least_drawn") key = r => -r.count;
      else if (by === "longest_gap") key = r => r.curGap;
      else if (by !== "random") throw new Error(`未知的尾號排序:${by}`);
      break;
    }
    case "ref_other": {
      if (!Array.isArray(ctx.ref) || !ctx.ref.length) throw new Error(`沒有可引用的${refGameName(spec)}資料`);
      const set = new Set(ctx.ref);
      cand = rows.filter(r => set.has(r.number));
      if (!cand.length) throw new Error(`${refGameName(spec)}最後一期的號碼都不在 ${spec.min}-${spec.max} 範圍內`);
      break;
    }
    case "random": break;
    default: throw new Error(`未知的統計來源:${item.source}`);
  }
  return [...cand].sort((a, b) => key(b) - key(a) || tie.get(a.number) - tie.get(b.number)).map(r => r.number);
}

// 結果卡片上每個號碼的來源標籤:引用來源依遊戲顯示對方名稱,尾號顯示實際尾數。
const pickLabel = (spec, item) => (item.source === "tail_digit" ? `尾號${item.digit ?? 0}` : sourceLabelFor(item.source, spec));

// 把配方條目依序截斷到 slots 個名額(固定號碼或「每注只選 count 個」會佔掉名額),不足的之後由 fillRandom 補滿。
export function fitItems(items, slots) {
  let remaining = Math.max(0, slots);
  const out = [];
  for (const it of items) {
    const count = Math.min(it.count, remaining);
    if (count > 0) { out.push({ ...it, count }); remaining -= count; }
  }
  return out;
}

// 配方產生一組主號。回傳 [{number, source}](不含包牌展開)。
// recipe: {items:[{source,count,n?,digit?,by?,scope?}], tieBreak, fillRandom, fixed:[], add, ref?:號碼陣列(ref_other 用),
//          full?:不受全域範圍限制的完整歷史(條目自訂範圍「歷史全部 / 近 N 期」從這裡取;沒給就用 draws)}
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
    const scoped = item.scope ? applyScope(recipe.full ?? draws, item.scope) : draws;   // F4.4 條目自訂範圍(不受全域範圍限制)
    for (const number of ranked(spec, scoped, item, recipe.tieBreak ?? "random", rng, { ref: recipe.ref })) {
      if (got >= item.count) break;
      if (taken.has(number)) continue;   // F4.2 去重:已被取走的跳過,取下一個
      taken.add(number); picks.push({ number, source: pickLabel(spec, item) }); got++;
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

// 特別號/第二區的「視圖」:把每期的 special 當成一個只開 1 個號碼的遊戲,就能重用所有統計來源與配方。
export function extraView(spec, draws, k = 1) {
  return {
    spec2: { ...spec, min: spec.extra.min, max: spec.extra.max, count: k },
    draws2: draws.map(d => ({ ...d, numbers: [d.special] })),
  };
}

// 依統計來源選 k 個特別號/第二區。opts: {source="random", k=1, n(近 N 期熱號用), tieBreak="random"}。
// k 達到全部號碼數時直接回傳全部(包全)。
export function pickExtra(spec, draws, opts, rng) {
  const { source = "random", k = 1, n, tieBreak = "random" } = opts ?? {};
  const range = spec.extra.max - spec.extra.min + 1;
  if (!Number.isInteger(k) || k < 1) throw new RangeError("k 必須是 >= 1 的整數");
  if (k >= range) return Array.from({ length: range }, (_, i) => spec.extra.min + i);
  const { spec2, draws2 } = extraView(spec, draws, k);
  if (source === "weighted_freq" || source === "weighted_gap") {
    const rows = numberStats(mainSeries(draws2), spec2.min, spec2.max, 1);
    const w = new Map(rows.map(r => [r.number, source === "weighted_freq" ? r.count + 1 : r.curGap + 1]));
    // Efraimidis-Spirakis 不放回加權抽樣
    return rows.map(r => ({ v: r.number, key: Math.pow(rng(), 1 / w.get(r.number)) }))
      .sort((a, b) => b.key - a.key).slice(0, k).map(x => x.v).sort((a, b) => a - b);
  }
  const items = [{ source, count: k, ...(n ? { n } : {}) }];
  return generateByRecipe(spec2, draws2, { items, tieBreak, fillRandom: true }, rng).map(p => p.number).sort((a, b) => a - b);
}

// 威力彩第二區(相容舊寫法):"random" / "hot"(最多次)/ "cold"(最少次)/ "all"(全部),或傳入 pickExtra 的選項物件。
export function pickSecond(spec, draws, mode, rng) {
  if (typeof mode === "object" && mode) return pickExtra(spec, draws, mode, rng);
  const range = spec.extra.max - spec.extra.min + 1;
  if (mode === "all") return pickExtra(spec, draws, { k: range }, rng);
  const source = { random: "random", hot: "most_drawn", cold: "least_drawn" }[mode];
  if (!source) throw new Error(`未知的第二區模式:${mode}`);
  return pickExtra(spec, draws, { source, k: 1 }, rng);
}

// 包牌展開:主號 pool 取 spec.count 個的所有組合,乘上第二區(威力彩)選項。
export function expandTickets(spec, pool, seconds) {
  const mains = combinations([...pool].sort((a, b) => a - b), spec.count);
  const tickets = [];
  for (const m of mains) for (const s of (seconds ?? [null])) tickets.push({ numbers: m, special: s });
  return tickets;
}
export const ticketCount = (spec, poolSize, secondCount = 1) => combinations(Array.from({ length: poolSize }, (_, i) => i), spec.count).length * secondCount;
