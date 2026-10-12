// 「統計」分頁:範圍選擇列 + 各統計區塊(表格 + 長條圖)。
import { h } from "./dom.js";
import { getDraws } from "../data/store.js";
import * as S from "../engine/stats/index.js";
import { fmt, pct, ball, bar, sortableTable } from "./widgets.js";
import { renderMore, MORE_SECTIONS } from "./stats_more.js";

// 各遊戲的統計狀態(範圍等),「選號」分頁共用同一個範圍。
export function statsState(ui, game) {
  const st = (ui.stats ??= {});
  return (st[game.name] ??= { type: "last_n", n: game.defaultScope, from: "", to: "", section: "次數", target: "main", recentN: 10, recentK: 3 });
}
export function scopeOf(ui, game) {
  const sc = statsState(ui, game);
  return sc.type === "range" ? { type: "range", from: sc.from, to: sc.to } : sc.type === "all" ? { type: "all" } : { type: "last_n", n: sc.n };
}

const CORE_SECTIONS = ["次數", "連莊", "遺漏", "近期", "重號", "和值", "奇偶大小", "檢定"];

export async function renderStats(root, game, ui) {
  const { draws: all } = await getDraws(game);
  const sc = statsState(ui, game);
  const body = h("div", { class: "view" });
  root.replaceChildren(body);
  const rerender = () => renderStats(root, game, ui);

  const draws = S.applyScope(all, scopeOf(ui, game));

  // ---- 範圍列 ----
  const setType = t => { sc.type = t; rerender(); };
  const scopeBar = h("div", { class: "card" },
    h("div", { class: "row" },
      h("button", { class: "chip" + (sc.type === "all" ? " on" : ""), onclick: () => setType("all") }, "歷史全部"),
      h("button", { class: "chip" + (sc.type === "last_n" ? " on" : ""), onclick: () => setType("last_n") }, "最近 N 期"),
      h("button", { class: "chip" + (sc.type === "range" ? " on" : ""), onclick: () => setType("range") }, "日期區間")),
    sc.type === "last_n" && h("div", { class: "row", style: "margin-top:10px" },
      h("input", { class: "input num", type: "number", min: 1, value: sc.n, onchange: e => { sc.n = Math.max(1, Math.trunc(+e.target.value) || game.defaultScope); rerender(); } }), "期",
      [50, 100, 300, 1000].map(n => h("button", { class: "chip" + (sc.n === n ? " on" : ""), onclick: () => { sc.n = n; rerender(); } }, String(n)))),
    sc.type === "range" && h("div", { class: "row", style: "margin-top:10px" },
      h("input", { class: "input", style: "width:auto", type: "date", value: sc.from, onchange: e => { sc.from = e.target.value; rerender(); } }), "~",
      h("input", { class: "input", style: "width:auto", type: "date", value: sc.to, onchange: e => { sc.to = e.target.value; rerender(); } })),
    h("div", { class: "hint" }, draws.length
      ? `${game.name}:共 ${draws.length} 期(${draws[0].date} ~ ${draws.at(-1).date})。預設 ${game.defaultScope} 期。`
      : "此範圍內沒有資料。"));

  const secBar = h("div", { class: "row" }, [...CORE_SECTIONS, ...MORE_SECTIONS].map(s => h("button", { class: "chip mint" + (sc.section === s ? " on" : ""), onclick: () => { sc.section = s; rerender(); } }, s)));
  const targetBar = game.extra && ["次數", "連莊", "遺漏"].includes(sc.section) && h("div", { class: "row" },
    h("button", { class: "chip pink" + (sc.target === "main" ? " on" : ""), onclick: () => { sc.target = "main"; rerender(); } }, "主號"),
    h("button", { class: "chip pink" + (sc.target === "extra" ? " on" : ""), onclick: () => { sc.target = "extra"; rerender(); } }, game.extra.label));

  body.append(h("div", { class: "label" }, `${game.name} 統計`), scopeBar, secBar);
  if (targetBar) body.append(targetBar);
  if (!draws.length) return;

  const useExtra = Boolean(targetBar) && sc.target === "extra";
  const series = useExtra ? S.extraSeries(draws) : S.mainSeries(draws);
  const [min, max, pick] = useExtra ? [game.extra.min, game.extra.max, 1] : [game.min, game.max, game.count];
  const who = useExtra ? game.extra.label : "號碼";
  const card = (title, ...kids) => h("div", { class: "card white" }, h("h3", {}, title), ...kids);
  const mainSer = S.mainSeries(draws);

  if (sc.section === "次數") {
    const rows = S.numberStats(series, min, max, pick).map(r => ({ ...r, diff: r.freq - r.expectedFreq }));
    const byCount = [...rows].sort((a, b) => b.count - a.count || a.number - b.number);
    const maxF = Math.max(...rows.map(r => r.freq));
    body.append(card(`${who}開出次數(S1)`,
      h("div", { class: "hint" }, `理論期望頻率 ${pct(rows[0].expectedFreq, 2)}(每期每號碼被開出的機率)。點欄位標題可排序。`),
      h("div", { class: "row", style: "margin:8px 0" }, "最多:", byCount.slice(0, 3).map(r => ball(r.number, "rep")), "　最少:", byCount.slice(-3).reverse().map(r => ball(r.number, "sp"))),
      sortableTable([
        { key: "number", label: "號碼", render: r => ball(r.number) },
        { key: "count", label: "次數" },
        { key: "freq", label: "頻率", render: r => h("span", {}, pct(r.freq, 2), bar(r.freq, maxF)) },
        { key: "diff", label: "與理論差", render: r => (r.diff >= 0 ? "+" : "") + pct(r.diff, 2) },
      ], rows, "count")));
  } else if (sc.section === "連莊") {
    const rows = S.numberStats(series, min, max, pick);
    body.append(card(`${who}連莊(S2)`,
      h("div", { class: "hint" }, "連莊 = 連續幾期都被開出。「目前連莊」是到最近一期為止仍在持續的期數;「歷史最長」是此範圍內曾出現的最長紀錄。"),
      sortableTable([
        { key: "number", label: "號碼", render: r => ball(r.number) },
        { key: "curStreak", label: "目前連莊" },
        { key: "maxStreak", label: "歷史最長連莊" },
      ], rows, "curStreak")));
  } else if (sc.section === "遺漏") {
    const rows = S.numberStats(series, min, max, pick).map(r => ({ ...r, gapRatio: r.gapRatio }));
    body.append(card(`${who}遺漏值總表(S3 / S6)`,
      h("div", { class: "hint" }, "遺漏 = 距離上次開出隔了幾期(最近一期開出則為 0)。比值 = 目前遺漏 ÷ 平均間隔,> 2 標為「偏冷」。偏冷不代表快開出了,每期仍是獨立事件。"),
      sortableTable([
        { key: "number", label: "號碼", render: r => ball(r.number) },
        { key: "curGap", label: "目前遺漏" },
        { key: "avgInterval", label: "平均間隔", fmt: v => (v == null ? "-" : v.toFixed(1)) },
        { key: "maxGap", label: "歷史最大遺漏" },
        { key: "gapRatio", label: "比值", render: r => h("span", {}, r.gapRatio == null ? "-" : r.gapRatio.toFixed(2), r.gapRatio > 2 && h("span", { class: "tag", style: "margin-left:6px" }, "偏冷")) },
      ], rows, "curGap")));
  } else if (sc.section === "近期") {
    const nIn = h("input", { class: "input num", type: "number", min: 1, value: sc.recentN, onchange: e => { sc.recentN = Math.max(1, Math.trunc(+e.target.value) || 10); rerender(); } });
    const kIn = h("input", { class: "input num", type: "number", min: 1, value: sc.recentK, onchange: e => { sc.recentK = Math.max(1, Math.trunc(+e.target.value) || 3); rerender(); } });
    const absent = S.absentInLast(mainSer, game.min, game.max, sc.recentN);
    const hot = S.latestAndFrequent(mainSer, sc.recentN, sc.recentK);
    body.append(
      card("近期設定", h("div", { class: "row" }, "近", nIn, "期;S5 門檻 ≥", kIn, "次")),
      card(`近 ${sc.recentN} 期未開出的號碼(S4)`, h("div", { class: "balls" }, absent.length ? absent.map(n => ball(n)) : "沒有"), h("div", { class: "hint" }, `共 ${absent.length} 個。`)),
      card(`最近一期開出,且近 ${sc.recentN} 期出現 ≥ ${sc.recentK} 次(S5)`,
        h("div", { class: "balls" }, hot.length ? hot.map(x => h("span", { class: "row", style: "gap:4px" }, ball(x.number, "rep"), `×${x.times}`)) : "沒有符合的號碼"),
        h("div", { class: "hint" }, `最近一期:${draws.at(-1).period}(${draws.at(-1).date})。`)));
  } else if (sc.section === "重號") {
    const dist = S.repeatDistribution(mainSer, game.count);
    const range = game.max - game.min + 1;
    body.append(card("重號統計(S8)",
      h("div", { class: "hint" }, "每期與上一期重複的號碼個數。理論值是「完全隨機」時的超幾何分布機率,可對照實際是否接近。"),
      h("table", { class: "tbl" },
        h("thead", {}, h("tr", {}, ["重複個數", "期數", "實際比例", "理論比例"].map(t => h("th", {}, t)))),
        h("tbody", {}, dist.map(r => h("tr", {}, h("td", {}, r.k), h("td", {}, r.count), h("td", {}, pct(r.ratio), bar(r.ratio)), h("td", {}, pct(S.hypergeom(r.k, game.count, range)))))))));
  } else if (sc.section === "和值") {
    const sd = S.sumDistribution(mainSer, game.count <= 5 ? 10 : 20);
    const maxC = Math.max(...sd.bins.map(b => b.count));
    body.append(card("和值分布(S11)",
      h("div", { class: "row" }, [`平均 ${sd.mean.toFixed(1)}`, `標準差 ${sd.sd.toFixed(1)}`, `80% 的期數落在 ${sd.p10} ~ ${sd.p90}`, `範圍 ${sd.min} ~ ${sd.max}`].map(t => h("span", {}, t))),
      h("table", { class: "tbl", style: "margin-top:10px" },
        h("thead", {}, h("tr", {}, ["和值區間", "期數", "比例"].map(t => h("th", {}, t)))),
        h("tbody", {}, sd.bins.map(b => h("tr", {}, h("td", {}, `${b.from}-${b.to}`), h("td", {}, b.count), h("td", {}, pct(b.count / sd.n), bar(b.count, maxC))))))));
  } else if (sc.section === "奇偶大小") {
    const pz = S.parityAndSize(mainSer, game.min, game.max, game.count);
    const t = (title, rows, label) => card(title, h("table", { class: "tbl" },
      h("thead", {}, h("tr", {}, [label, "期數", "比例"].map(x => h("th", {}, x)))),
      h("tbody", {}, rows.map(r => h("tr", {}, h("td", {}, label(r.k)), h("td", {}, r.count), h("td", {}, pct(r.ratio), bar(r.ratio)))))));
    const oe = k => `${k} 奇 ${game.count - k} 偶`, bs = k => `${k} 大 ${game.count - k} 小`;
    body.append(
      card("奇偶比(S12)", h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ["奇偶比", "期數", "比例"].map(x => h("th", {}, x)))),
        h("tbody", {}, pz.odd.map(r => h("tr", {}, h("td", {}, oe(r.k)), h("td", {}, r.count), h("td", {}, pct(r.ratio), bar(r.ratio))))))),
      card("大小比(S12)", h("div", { class: "hint" }, `${pz.bigFrom} 以上為大。`), h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ["大小比", "期數", "比例"].map(x => h("th", {}, x)))),
        h("tbody", {}, pz.big.map(r => h("tr", {}, h("td", {}, bs(r.k)), h("td", {}, r.count), h("td", {}, pct(r.ratio), bar(r.ratio))))))));
  } else if (sc.section === "檢定") {
    const rows = S.numberStats(mainSer, game.min, game.max, game.count);
    const c = S.chiSquare(rows.map(r => r.count));
    const sig = c.p < 0.05;
    body.append(card("卡方檢定(S21)",
      h("div", { class: "row" }, h("span", {}, `χ² = ${c.chi2.toFixed(2)}`), h("span", {}, `自由度 = ${c.df}`), h("b", {}, `p = ${c.p.toFixed(4)}`)),
      h("div", { class: "report" }, sig
        ? `p < 0.05:此範圍內各號碼的出現次數與「完全均勻」有統計上的差異。不過同時看很多統計時,偶然達標很常見,且這不代表下一期可預測。`
        : `p ≥ 0.05:沒有證據顯示各號碼的出現次數偏離均勻分布,與「完全隨機」一致。所謂冷熱號只是隨機波動。`),
      h("div", { class: "hint" }, `檢驗虛無假設「每個號碼被開出的機率相同」。範圍內共 ${c.total} 個號碼次,每號碼期望 ${c.expected.toFixed(1)} 次。`)));
  }
  else body.append(...renderMore(sc.section, { game, draws, mainSer, sc, rerender, card }));
}
