// 其餘統計(S7、S9、S10、S13~S16、S18~S20)。純函式。series = 每期號碼陣列(舊→新)。
import { numberStats } from "./index.js";

// S7 冷熱分群:依近 n 期次數排序,前 1/3 熱、中 1/3 溫、後 1/3 冷(同次數依號碼小者在前)。
export function heatGroups(series, min, max, n) {
  const recent = series.slice(-n);
  const rows = numberStats(recent, min, max, 1).map(r => ({ number: r.number, count: r.count }))
    .sort((a, b) => b.count - a.count || a.number - b.number);
  const t = Math.ceil(rows.length / 3);
  return { hot: rows.slice(0, t), warm: rows.slice(t, 2 * t), cold: rows.slice(2 * t), n: recent.length };
}

// S9 隔期號:與前 lag 期重複個數的分布(lag=1 即 S8 重號)。
export function lagRepeatDistribution(series, pick, lag) {
  const dist = Array(pick + 1).fill(0);
  for (let i = lag; i < series.length; i++) {
    const prev = new Set(series[i - lag]);
    dist[series[i].filter(v => prev.has(v)).length]++;
  }
  const total = Math.max(0, series.length - lag);
  return dist.map((count, k) => ({ k, count, ratio: total ? count / total : 0 }));
}

// S10 鄰號與連號
export function neighborStats(series, pick) {
  const consec = Array(pick).fill(0);          // 一期內「相鄰兩號」組數的分布
  for (const s of series) {
    const a = [...s].sort((x, y) => x - y);
    let pairs = 0;
    for (let i = 1; i < a.length; i++) if (a[i] - a[i - 1] === 1) pairs++;
    consec[pairs]++;
  }
  const nbDist = Array(pick + 1).fill(0);      // 一期中有幾個號碼是「上期號碼的前後號」
  for (let i = 1; i < series.length; i++) {
    const nb = new Set(series[i - 1].flatMap(v => [v - 1, v + 1]));
    nbDist[series[i].filter(v => nb.has(v)).length]++;
  }
  const n = series.length;
  const rows = (arr, total) => arr.map((count, k) => ({ k, count, ratio: total ? count / total : 0 }));
  return { consecutive: rows(consec, n), neighbor: rows(nbDist, Math.max(0, n - 1)) };
}

// S13 區段分布:把範圍切成 parts 段。
export function sectionStats(series, min, max, parts = 4) {
  const width = Math.ceil((max - min + 1) / parts);
  const segs = Array.from({ length: parts }, (_, i) => ({ from: min + i * width, to: Math.min(max, min + (i + 1) * width - 1), total: 0 }));
  const idx = v => Math.floor((v - min) / width);
  const patterns = new Map();
  for (const s of series) {
    const c = Array(parts).fill(0);
    for (const v of s) { c[idx(v)]++; segs[idx(v)].total++; }
    const key = c.join("-");
    patterns.set(key, (patterns.get(key) ?? 0) + 1);
  }
  const n = series.length;
  const pick = series[0]?.length ?? 0;
  return {
    segments: segs.map(s => ({ ...s, avgPerDraw: n ? s.total / n : 0, expected: pick * (s.to - s.from + 1) / (max - min + 1) })),
    patterns: [...patterns].map(([pattern, count]) => ({ pattern, count, ratio: count / n })).sort((a, b) => b.count - a.count),
  };
}

// S14 尾數分布
export function tailStats(series) {
  const total = Array(10).fill(0);
  const groups = new Map();   // 一期內「有同尾數的組數」分布
  for (const s of series) {
    const c = Array(10).fill(0);
    for (const v of s) { total[v % 10]++; c[v % 10]++; }
    const g = c.filter(x => x >= 2).length;
    groups.set(g, (groups.get(g) ?? 0) + 1);
  }
  const n = series.length, sum = total.reduce((a, b) => a + b, 0);
  return {
    tails: total.map((count, tail) => ({ tail, count, ratio: sum ? count / sum : 0 })),
    sameTail: [...groups].map(([k, count]) => ({ k, count, ratio: n ? count / n : 0 })).sort((a, b) => a.k - b.k),
  };
}

// S15 跨度與平均間距
export function spanStats(series, binWidth = 5) {
  const spans = series.map(s => Math.max(...s) - Math.min(...s));
  const n = spans.length;
  if (!n) return { n, mean: 0, avgGap: 0, bins: [] };
  const pick = series[0].length;
  const mean = spans.reduce((a, b) => a + b, 0) / n;
  const sorted = [...spans].sort((a, b) => a - b);
  const lo = Math.floor(sorted[0] / binWidth) * binWidth;
  const bins = [];
  for (let s = lo; s <= sorted[n - 1]; s += binWidth) bins.push({ from: s, to: s + binWidth - 1, count: 0 });
  for (const v of spans) bins[Math.floor((v - lo) / binWidth)].count++;
  return { n, mean, avgGap: mean / (pick - 1), min: sorted[0], max: sorted[n - 1], p10: sorted[Math.floor(0.1 * n)], p90: sorted[Math.min(n - 1, Math.floor(0.9 * n))], bins };
}

// S16 號碼配對:兩兩同期出現次數。
export function pairStats(series, min, max) {
  const size = max - min + 1;
  const m = Array.from({ length: size }, () => Array(size).fill(0));
  for (const s of series) for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
    const a = s[i] - min, b = s[j] - min;
    m[a][b]++; m[b][a]++;
  }
  const list = [];
  for (let a = 0; a < size; a++) for (let b = a + 1; b < size; b++) list.push({ a: a + min, b: b + min, count: m[a][b] });
  const byCount = [...list].sort((x, y) => y.count - x.count || x.a - y.a || x.b - y.b);
  const pick = series[0]?.length ?? 0;
  const expected = series.length * pick * (pick - 1) / (size * (size - 1));
  return { matrix: m, min, top: byCount.slice(0, 10), bottom: byCount.slice(-10).reverse(), never: list.filter(x => x.count === 0), expected, maxCount: byCount[0]?.count ?? 0 };
}
// 某號碼最常一起出現的號碼(F5.1f 配對型用)
export function partnersOf(series, min, max, number, top = 5) {
  const c = new Map();
  for (const s of series) if (s.includes(number)) for (const v of s) if (v !== number) c.set(v, (c.get(v) ?? 0) + 1);
  return [...c].map(([n, count]) => ({ number: n, count })).sort((a, b) => b.count - a.count || a.number - b.number).slice(0, top);
}

// S18 組合重現:歷史上是否出現過完全相同的號碼組合。
export function comboRepeats(draws) {
  const m = new Map();
  for (const d of draws) {
    const key = [...d.numbers].sort((a, b) => a - b).join(" ");
    (m.get(key) ?? m.set(key, []).get(key)).push(d.period);
  }
  const dups = [...m].filter(([, p]) => p.length > 1).map(([combo, periods]) => ({ combo, periods }));
  return { unique: m.size, total: draws.length, dups, has: numbers => (m.get([...numbers].sort((a, b) => a - b).join(" ")) ?? []) };
}

// S19 星期 / 月份偏態:各分組內,號碼的出現頻率。
export function groupBias(draws, min, max, groupOf) {
  const groups = new Map();
  for (const d of draws) {
    const g = groupOf(d);
    const e = groups.get(g) ?? groups.set(g, { key: g, draws: 0, counts: new Map() }).get(g);
    e.draws++;
    for (const v of d.numbers) e.counts.set(v, (e.counts.get(v) ?? 0) + 1);
  }
  const pick = draws[0]?.numbers.length ?? 0;
  const expectedFreq = pick / (max - min + 1);
  return [...groups.values()].sort((a, b) => a.key - b.key).map(e => {
    const rows = Array.from({ length: max - min + 1 }, (_, i) => ({ number: min + i, count: e.counts.get(min + i) ?? 0 }))
      .map(r => ({ ...r, freq: r.count / e.draws })).sort((a, b) => b.count - a.count || a.number - b.number);
    return { key: e.key, draws: e.draws, expectedFreq, top: rows.slice(0, 3), bottom: rows.slice(-3).reverse() };
  });
}
export const weekdayOf = d => new Date(d.date + "T00:00:00Z").getUTCDay();
export const monthOf = d => +d.date.slice(5, 7);

// S20 銷售額與獎金趨勢(依年份)。沒有銷售欄位的期數(手動補登)會略過。
export function salesTrend(draws) {
  const years = new Map();
  for (const d of draws) {
    if (d.sales == null) continue;
    const y = d.date.slice(0, 4);
    const e = years.get(y) ?? years.set(y, { year: y, draws: 0, sales: 0, prize: 0 }).get(y);
    e.draws++; e.sales += d.sales; e.prize += d.prize ?? 0;
  }
  const rows = [...years.values()].map(e => ({ ...e, avgSales: e.sales / e.draws, avgPrize: e.prize / e.draws }));
  const top = draws.filter(d => d.sales != null).sort((a, b) => b.sales - a.sales).slice(0, 10);
  return { rows, top };
}

// ── 以下三項由 808888-main 的 indicators.ts/util.ts 擷取改寫(見 book/analysis/) ──

// 冷熱 z-score:z = (次數 − 期望) / 標準差,|z| > 1 才算熱/冷。「沒有號碼超標」也是合法答案。
export function hotColdZ(series, min, max, pick, window = 30) {
  if (!(max > min) || !(pick > 0) || pick > max - min + 1) throw new RangeError("號碼範圍或 pick 不合法");
  const win = window > 0 && window < series.length ? series.slice(-window) : series;
  const W = win.length;
  const p = pick / (max - min + 1);
  const expected = W * p;
  const sd = Math.sqrt(W * p * (1 - p)) || 1;
  const count = new Map();
  for (const draw of win) for (const v of draw) count.set(v, (count.get(v) ?? 0) + 1);
  const rows = [];
  for (let v = min; v <= max; v++) {
    const c = count.get(v) ?? 0;
    const z = (c - expected) / sd;
    rows.push({ number: v, count: c, expected, z, tag: z > 1 ? "hot" : z < -1 ? "cold" : "normal" });
  }
  return rows;
}

// 拖牌:號碼 a 在第 t 期開出後,b 在第 t+1 期跟著開出的條件機率。lift = 條件機率 ÷ 隨機期望(≈1 代表無關)。
export function dragFor(series, min, max, a, pick, topK = 6) {
  if (!Number.isInteger(a) || a < min || a > max) throw new RangeError("a 不在號碼範圍內");
  const expectedRate = pick / (max - min + 1);
  let aCount = 0;
  const bCount = new Map();
  for (let t = 0; t < series.length - 1; t++) {
    if (!series[t].includes(a)) continue;
    aCount++;
    for (const b of series[t + 1]) bCount.set(b, (bCount.get(b) ?? 0) + 1);
  }
  const top = [];
  for (const [b, count] of bCount) {
    if (b === a) continue;
    const rate = count / aCount;
    top.push({ b, count, rate, lift: rate / expectedRate });
  }
  top.sort((x, y) => y.count - x.count || x.b - y.b);
  return { a, aCount, expectedRate, top: top.slice(0, topK) };
}

// AC 值(算術複雜度)= 兩兩差值的不同值個數 − (號碼數 − 1);質數個數(1 不是質數)。
export function acValue(nums) {
  if (nums.length < 2) throw new RangeError("至少需要 2 個號碼");
  const diffs = new Set();
  for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) diffs.add(Math.abs(nums[i] - nums[j]));
  return diffs.size - (nums.length - 1);
}
const isPrime = n => { if (!Number.isInteger(n) || n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
export const primeCount = nums => nums.filter(isPrime).length;

export function patternFeatures(series) {
  const dist = (vals) => {
    const m = new Map();
    for (const v of vals) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m].sort((a, b) => a[0] - b[0]).map(([k, count]) => ({ k, count, ratio: count / vals.length }));
  };
  return { ac: dist(series.map(acValue)), primes: dist(series.map(primeCount)) };
}
