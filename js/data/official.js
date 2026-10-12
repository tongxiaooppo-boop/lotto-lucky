// 從台灣彩券官網的公開 JSON 介面取得開獎結果(瀏覽器與 Node 共用)。
// 注意:這是官網前端使用的未公開文件介面,格式可能改版;改版時抓取會失敗,手動輸入與 CSV 匯入仍可備援。
import { validateDraw } from "../engine/draws.js";

const BASE = "https://api.taiwanlottery.com/TLCAPIWeB/Lottery";
const ENDPOINTS = {
  "今彩539": { path: "Daily539Result", list: "daily539Res" },
  "大樂透": { path: "Lotto649Result", list: "lotto649Res" },
  "威力彩": { path: "SuperLotto638Result", list: "superLotto638Res" },
};

// 把官網的一筆資料轉成本專案的格式。drawNumberSize = 由小到大的號碼,大樂透/威力彩最後一個是特別號/第二區。
export function normalizeRecord(spec, r) {
  const nums = r.drawNumberSize;
  if (!Array.isArray(nums) || nums.length !== spec.count + (spec.extra ? 1 : 0)) throw new Error(`號碼數量不符(${nums?.length})`);
  const d = {
    period: String(r.period),
    date: String(r.lotteryDate).slice(0, 10),
    numbers: [...nums.slice(0, spec.count)].sort((a, b) => a - b),
  };
  if (Number.isFinite(r.sellAmount)) { d.sales = r.sellAmount; d.bets = Math.round(r.sellAmount / spec.price); }
  if (Number.isFinite(r.totalAmount)) d.prize = r.totalAmount;
  if (spec.extra) d.special = nums[spec.count];
  return d;
}

export async function fetchMonth(spec, month, fetchFn = fetch) {
  const ep = ENDPOINTS[spec.name];
  const url = `${BASE}/${ep.path}?period&month=${month}&endMonth=${month}&pageNum=1&pageSize=100`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`官網回應 ${res.status}`);
  const json = await res.json();
  if (json.rtCode !== 0) throw new Error(`官網回報錯誤:${json.rtMsg ?? json.rtCode}`);
  const list = json.content?.[ep.list];
  if (!Array.isArray(list)) throw new Error("官網資料格式已變更(找不到開獎清單)");
  if (json.content.totalSize > list.length) throw new Error(`${month} 資料超過一頁(${json.content.totalSize} 筆)`);
  const draws = [], failed = [];
  for (const r of list) {
    try {
      const d = normalizeRecord(spec, r);
      const errs = validateDraw(spec, d);
      if (errs.length) failed.push({ period: String(r.period), reason: errs.join(";") });
      else draws.push(d);
    } catch (e) { failed.push({ period: String(r.period), reason: e.message }); }
  }
  return { draws: draws.sort((a, b) => (a.date + a.period < b.date + b.period ? -1 : 1)), failed };
}

// 從 existing 最後一期所在的月份,抓到 today(YYYY-MM-DD,台灣日期)所在的月份。
export function monthsToFetch(existing, today) {
  const last = existing.at(-1)?.date ?? "2007-01-01";
  const out = [];
  let [y, m] = last.split("-").map(Number);
  const [ty, tm] = today.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

export const taipeiToday = (now = new Date()) => new Date(now.getTime() + 8 * 3600e3).toISOString().slice(0, 10);

// 抓取缺少的資料。回傳 {draws, failed, conflicts};conflicts = 與既有資料同期別但號碼不同(需人工確認)。
export async function fetchLatest(spec, existing, { today = taipeiToday(), fetchFn = fetch, delayMs = 400 } = {}) {
  const have = new Map(existing.map(d => [d.period, d]));
  const draws = [], failed = [], conflicts = [];
  for (const month of monthsToFetch(existing, today)) {
    const r = await fetchMonth(spec, month, fetchFn);
    failed.push(...r.failed);
    for (const d of r.draws) {
      const old = have.get(d.period);
      if (old) {
        const same = old.numbers.join() === d.numbers.join() && (old.special ?? null) === (d.special ?? null) && old.date === d.date;
        if (!same) conflicts.push({ period: d.period, existing: old, fetched: d });
      }
      draws.push(d);
    }
    if (delayMs) await new Promise(r => setTimeout(r, delayMs));
  }
  return { draws, failed, conflicts };
}
