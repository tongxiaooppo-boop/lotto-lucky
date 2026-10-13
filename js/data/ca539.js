// 加州539(California Fantasy 5)資料解析。純函式,不連網;抓取由 tools/fetch_ca539.mjs 負責。
// 每日更新:加州彩券官網的開獎介面(只開放最近約 6 個月,官網擋台灣 IP,所以由 GitHub Actions 在美國執行)。
// 歷史回補:lottery.net 年度存檔(2010-04 起),寫入前必須與官網重疊的那段逐期一致。9800 樂透堂只供人工驗證。
// 期別 = 開獎日期去掉連字號(YYYYMMDD):官方期號(Draw Number)只能取到近 6 個月,更早的沒有,所以統一用日期,新舊資料才對得起來。
import { validateDraw } from "../engine/draws.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// "October 12, 2026" → "2026-10-12";格式不符回傳 null
export function parseEnglishDate(s) {
  const m = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(String(s).trim());
  const mo = m ? MONTHS.indexOf(m[1]) : -1;
  if (mo < 0) return null;
  return `${m[3]}-${String(mo + 1).padStart(2, "0")}-${String(+m[2]).padStart(2, "0")}`;
}

export const periodOf = date => date.replaceAll("-", "");
function check(spec, d) {
  const draw = { period: periodOf(d.date), date: d.date, numbers: d.numbers };
  const errs = validateDraw(spec, draw);
  return errs.length ? { error: `${d.date}:${errs.join(";")}` } : { draw };
}
const sorted = a => [...a].sort((x, y) => x - y);

// 官網介面 JSON(DrawGamePastDrawResults)→ { draws, failed, total }。
// 每期:DrawDate("2026-10-12T07:00:00",加州開獎日期)、WinningNumbers {"0":{Number:"2"},…}。(DrawNumber 官方期號不使用,見檔頭。)
export function parseOfficial(spec, json) {
  const list = json?.PreviousDraws;
  if (!Array.isArray(list)) throw new Error("官網資料格式已變更(找不到 PreviousDraws)");
  const draws = [], failed = [];
  for (const r of list) {
    const nums = Object.values(r.WinningNumbers ?? {}).filter(n => !n.IsSpecial).map(n => Number(n.Number));
    const date = String(r.DrawDate ?? "").slice(0, 10);
    const res = check(spec, { date, numbers: sorted(nums) });
    if (res.error) failed.push({ period: date, reason: res.error }); else draws.push(res.draw);
  }
  return { draws, failed, total: json.TotalPreviousDraws };
}

// ---- 以下只供人工交叉驗證(以日期比對) ----

// lottery.net 年度頁 → { draws, failed }。凡是含日期欄 <td class="colour"> 的 <tr> 都算一列(列的 class 不固定)。
export function parseLotteryNet(spec, html) {
  const draws = [], failed = [];
  const rows = html.split(/<tr[\s>]/i).slice(1).filter(r => /<td class="colour/i.test(r));
  for (const row of rows) {
    const body = row.split(/<\/tr>/i)[0];
    const dm = /<td class="colour[^"]*">\s*([^<]+?)\s*<\/td>/i.exec(body);
    const date = dm ? parseEnglishDate(dm[1]) : null;
    const nums = [...body.matchAll(/<li class="ball[^"]*">\s*(\d+)\s*<\/li>/gi)].map(m => +m[1]);
    if (!date) { failed.push(`無法解析日期:${dm?.[1] ?? "(找不到)"}`); continue; }
    const r = check(spec, { date, numbers: sorted(nums) });
    if (r.error) failed.push(r.error); else draws.push(r.draw);
  }
  return { draws, failed };
}

// 9800 樂透堂加州天天樂首頁 → { draws, failed }。每列:期次、日期 YYYY-MM-DD、「02 09 11 17 18」。
export function parse9800(spec, html) {
  const draws = [], failed = [];
  const re = /<TD[^>]*>\s*\d+\s*<\/TD>\s*<TD[^>]*>\s*(\d{4}-\d{2}-\d{2})\s*<\/TD>\s*<TD[^>]*>(?:<[^>]+>)*\s*((?:\d{1,2}\s+){4}\d{1,2})\s*(?:<[^>]+>)*\s*<\/TD>/gi;
  for (const m of html.matchAll(re)) {
    const r = check(spec, { date: m[1], numbers: sorted(m[2].trim().split(/\s+/).map(Number)) });
    if (r.error) failed.push(r.error); else draws.push(r.draw);
  }
  return { draws, failed };
}

const same = (a, b) => a.numbers.length === b.numbers.length && a.numbers.every((v, i) => v === b.numbers[i]);

// 兩份資料依日期互相比對。回傳 { checked, conflicts:[{date, a, b}] }。
export function crossCheck(listA, listB) {
  const byDate = new Map(listB.map(d => [d.date, d]));
  const conflicts = [];
  let checked = 0;
  for (const a of listA) {
    const b = byDate.get(a.date);
    if (!b) continue;
    checked++;
    if (!same(a, b)) conflicts.push({ date: a.date, a: a.numbers, b: b.numbers });
  }
  return { checked, conflicts };
}

// 與既有資料(data/加州539.json)比對:同期別號碼不同 = 衝突。回傳 { fresh, conflicts }。
export function diffAgainst(existing, incoming) {
  const known = new Map(existing.map(d => [d.period, d]));
  const fresh = [], conflicts = [];
  for (const d of incoming) {
    const e = known.get(d.period);
    if (!e) fresh.push(d);
    else if (!same(e, d)) conflicts.push({ period: d.period, existing: e.numbers, fetched: d.numbers });
  }
  return { fresh, conflicts };
}
