// 開獎資料的驗證、CSV 解析與合併。純函式,不碰畫面與儲存。

export function normalizeDate(s) {
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(String(s).trim());
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${m[1]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// 回傳錯誤訊息陣列(空陣列表示通過)。
export function validateDraw(spec, draw) {
  const errs = [];
  if (!/^\d{9}$/.test(String(draw.period ?? ""))) errs.push("期別須為 9 位數字");
  if (!normalizeDate(draw.date)) errs.push("日期格式錯誤");
  const n = draw.numbers;
  if (!Array.isArray(n) || n.length !== spec.count) errs.push(`號碼須為 ${spec.count} 個`);
  else {
    if (n.some(x => !Number.isInteger(x) || x < spec.min || x > spec.max)) errs.push(`號碼須在 ${spec.min}-${spec.max}`);
    if (new Set(n).size !== n.length) errs.push("號碼不可重複");
  }
  if (spec.extra) {
    const s = draw.special;
    if (!Number.isInteger(s) || s < spec.extra.min || s > spec.extra.max) errs.push(`${spec.extra.label}須在 ${spec.extra.min}-${spec.extra.max}`);
    else if (spec.extra.distinct && Array.isArray(n) && n.includes(s)) errs.push(`${spec.extra.label}不可與主號重複`);
  } else if (draw.special != null) errs.push("此遊戲沒有特別號");
  return errs;
}

function splitCsvLine(line) {
  const out = [];
  let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

// 官方 CSV(欄位:遊戲名稱,期別,開獎日期,銷售總額,銷售注數,總獎金,獎號1…,特別號/第二區)。
export function parseCsv(text, spec) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter(l => l.trim());
  const draws = [], failed = [];
  if (!lines.length) return { draws, failed: [{ period: "-", reason: "檔案是空的" }] };
  const hdr = splitCsvLine(lines[0]);
  const col = name => hdr.indexOf(name);
  const need = ["期別", "開獎日期", ...Array.from({ length: spec.count }, (_, i) => `獎號${i + 1}`)];
  const missing = need.filter(h => col(h) < 0);
  if (missing.length) return { draws, failed: [{ period: "-", reason: `缺少欄位:${missing.join("、")}` }] };
  const gi = col("遊戲名稱");
  const extraCol = spec.extra ? col(spec.extra.label) : -1;
  if (spec.extra && extraCol < 0) return { draws, failed: [{ period: "-", reason: `缺少欄位:${spec.extra.label}` }] };
  for (const line of lines.slice(1)) {
    const c = splitCsvLine(line);
    const period = c[col("期別")];
    if (gi >= 0 && c[gi] && c[gi] !== spec.name) { failed.push({ period, reason: `不是${spec.name}的資料(${c[gi]})` }); continue; }
    const num = i => (c[i] === "" || c[i] == null ? NaN : Number(c[i]));
    const d = {
      period,
      date: normalizeDate(c[col("開獎日期")]) ?? c[col("開獎日期")],
      numbers: Array.from({ length: spec.count }, (_, i) => num(col(`獎號${i + 1}`))),
    };
    for (const [k, h] of [["sales", "銷售總額"], ["bets", "銷售注數"], ["prize", "總獎金"]]) {
      const v = col(h) >= 0 ? num(col(h)) : NaN;
      if (Number.isFinite(v)) d[k] = v;
    }
    if (spec.extra) d.special = num(extraCol);
    const errs = validateDraw(spec, d);
    if (errs.length) failed.push({ period, reason: errs.join(";") });
    else draws.push(d);
  }
  return { draws, failed };
}

// 合併:以期別去重,既有的優先(略過重複)。不修改輸入。
export function mergeDraws(spec, existing, incoming) {
  const have = new Set(existing.map(d => d.period));
  const added = [], skipped = [], failed = [];
  for (const d of incoming) {
    const errs = validateDraw(spec, d);
    if (errs.length) { failed.push({ period: d.period, reason: errs.join(";") }); continue; }
    if (have.has(d.period)) { skipped.push(d.period); continue; }
    have.add(d.period);
    added.push({ ...d, date: normalizeDate(d.date) });
  }
  const merged = [...existing, ...added].sort((a, b) => (a.date + a.period < b.date + b.period ? -1 : 1));
  return { merged, added, skipped, failed };
}

// 完整性檢查(F1.6):同一民國年內期別末 6 碼是否連號。回傳缺漏提示。
export function checkContinuity(draws) {
  const gaps = [];
  let prev = null;
  for (const d of draws) {
    const y = d.period.slice(0, 3), seq = +d.period.slice(3);
    if (prev && prev.y === y && seq !== prev.seq + 1) gaps.push(`${y}${String(prev.seq + 1).padStart(6, "0")}` + (seq - prev.seq > 2 ? ` ~ ${d.period.slice(0, 3)}${String(seq - 1).padStart(6, "0")}` : ""));
    prev = { y, seq };
  }
  return gaps;
}
