// 統計引擎:純函式,輸入「依時間升冪的開獎陣列」,不碰畫面與儲存。
// series = 每期的號碼陣列(舊 → 新)。

// 範圍:{type:"all"} | {type:"last_n", n} | {type:"range", from, to}(日期 YYYY-MM-DD,含頭尾)
export function applyScope(draws, scope) {
  if (!scope || scope.type === "all") return draws;
  if (scope.type === "last_n") return draws.slice(-Math.max(0, scope.n));
  if (scope.type === "range") return draws.filter(d => (!scope.from || d.date >= scope.from) && (!scope.to || d.date <= scope.to));
  throw new Error(`未知的範圍類型:${scope.type}`);
}

export const mainSeries = draws => draws.map(d => d.numbers);
export const extraSeries = draws => draws.map(d => [d.special]);

// S1 次數/頻率、S2 連莊、S3 遺漏、S6 遺漏值總表。每個號碼一列。
// pick = 每期取幾個號碼(用於理論期望頻率:主號 count/範圍,特別號 1/範圍)。
export function numberStats(series, min, max, pick) {
  const n = series.length;
  const rows = [];
  for (let v = min; v <= max; v++) {
    let count = 0, streak = 0, maxStreak = 0, last = -1, maxGap = 0;
    for (let i = 0; i < n; i++) {
      if (series[i].includes(v)) {
        count++;
        streak++;
        if (streak > maxStreak) maxStreak = streak;
        maxGap = Math.max(maxGap, i - last - 1);
        last = i;
      } else streak = 0;
    }
    const curGap = last < 0 ? n : n - 1 - last;
    maxGap = Math.max(maxGap, curGap);
    const avgInterval = count ? n / count : null;
    rows.push({
      number: v, count,
      freq: n ? count / n : 0,
      expectedFreq: pick / (max - min + 1),
      curStreak: streak, maxStreak,
      curGap, maxGap, avgInterval,
      gapRatio: avgInterval ? curGap / avgInterval : null,
    });
  }
  return rows;
}

// S4 近 N 期未開出的號碼
export function absentInLast(series, min, max, n) {
  const recent = series.slice(-n);
  const seen = new Set(recent.flat());
  const out = [];
  for (let v = min; v <= max; v++) if (!seen.has(v)) out.push(v);
  return out;
}

// S5 最近一期開出,且近 n 期(含最近一期)出現 ≥ k 次者
export function latestAndFrequent(series, n, k) {
  if (!series.length) return [];
  const recent = series.slice(-n);
  return series.at(-1)
    .map(v => ({ number: v, times: recent.filter(s => s.includes(v)).length }))
    .filter(x => x.times >= k)
    .sort((a, b) => b.times - a.times || a.number - b.number);
}

// S8 重號:每期與上期重複個數的分布
export function repeatDistribution(series, pick) {
  const dist = Array(pick + 1).fill(0);
  for (let i = 1; i < series.length; i++) {
    const prev = new Set(series[i - 1]);
    dist[series[i].filter(v => prev.has(v)).length]++;
  }
  const total = Math.max(0, series.length - 1);
  return dist.map((count, k) => ({ k, count, ratio: total ? count / total : 0 }));
}

// 超幾何分布的理論值:每期 pick 個、從 range 個號碼中,與上期 pick 個重複 k 個的機率
export function hypergeom(k, pick, range) {
  return comb(pick, k) * comb(range - pick, pick - k) / comb(range, pick);
}
function comb(n, r) {
  if (r < 0 || r > n) return 0;
  let x = 1;
  for (let i = 1; i <= r; i++) x = x * (n - r + i) / i;
  return x;
}

// S11 和值分布
export function sumDistribution(series, binWidth) {
  const sums = series.map(s => s.reduce((a, b) => a + b, 0));
  const n = sums.length;
  if (!n) return { n, mean: 0, sd: 0, p10: 0, p90: 0, bins: [] };
  const mean = sums.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(sums.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const sorted = [...sums].sort((a, b) => a - b);
  const q = p => sorted[Math.min(n - 1, Math.floor(p * n))];
  const lo = Math.floor(sorted[0] / binWidth) * binWidth;
  const bins = [];
  for (let s = lo; s <= sorted[n - 1]; s += binWidth) bins.push({ from: s, to: s + binWidth - 1, count: 0 });
  for (const v of sums) bins[Math.floor((v - lo) / binWidth)].count++;
  return { n, mean, sd, p10: q(0.1), p90: q(0.9), min: sorted[0], max: sorted[n - 1], bins };
}

// S12 奇偶比 / 大小比分布。大 = 號碼 > 範圍中點(539:20 以上;大樂透 25 以上;威力彩 20 以上)。
export function parityAndSize(series, min, max, pick) {
  const mid = (min + max) / 2;
  const odd = Array(pick + 1).fill(0), big = Array(pick + 1).fill(0);
  for (const s of series) {
    odd[s.filter(v => v % 2 === 1).length]++;
    big[s.filter(v => v > mid).length]++;
  }
  const n = series.length;
  const rows = arr => arr.map((count, k) => ({ k, count, ratio: n ? count / n : 0 }));
  return { odd: rows(odd), big: rows(big), bigFrom: Math.floor(mid) + 1 };
}

// S21 卡方檢定:各號碼出現次數是否偏離均勻分布。
export function chiSquare(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  const k = counts.length;
  const expected = total / k;
  const chi2 = expected ? counts.reduce((a, c) => a + (c - expected) ** 2 / expected, 0) : 0;
  const df = k - 1;
  return { chi2, df, p: gammaQ(df / 2, chi2 / 2), expected, total };
}

// 正規化上不完全 gamma 函數 Q(a, x)(Numerical Recipes 作法)
function gammaQ(a, x) {
  if (x <= 0) return 1;
  const gln = lgamma(a);
  if (x < a + 1) {
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 0; n < 500; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-14) break; }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - gln);
  }
  let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, hh = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    hh *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return Math.exp(-x + a * Math.log(x) - gln) * hh;
}
function lgamma(z) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = z, x = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const cj of c) ser += cj / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
