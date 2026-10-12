// 「選號」分頁:號碼設定(固定號碼、增加號碼=包牌、威力彩第二區)、配方編輯器、一鍵策略、結果。
import { h, toast } from "./dom.js";
import { getDraws } from "../data/store.js";
import { applyScope } from "../engine/stats/index.js";
import { scopeOf } from "./stats.js";
import { SOURCES, makeRng, generateByRecipe, balanced, pureRandom, pickSecond, expandTickets, ticketCount } from "../engine/recipes/index.js";

const fmt = n => String(n).padStart(2, "0");
const SECOND_MODES = [["random", "隨機 1 個"], ["hot", "最熱 1 個"], ["cold", "最冷 1 個"], ["all", "全部(包全)"]];
const MAX_SHOWN = 60;

function defaultState(game) {
  return {
    add: 0, fixed: [], second: "random", tieBreak: "random", fillRandom: false, seed: "", result: null, error: "",
    items: game.count === 5
      ? [{ source: "most_drawn", count: 2 }, { source: "least_drawn", count: 2 }, { source: "current_streak", count: 1 }]
      : [{ source: "most_drawn", count: 2 }, { source: "least_drawn", count: 2 }, { source: "longest_gap", count: 2 }],
  };
}

export async function renderPick(root, game, ui) {
  const { draws: all } = await getDraws(game);
  const draws = applyScope(all, scopeOf(ui, game));
  const st = ((ui.pick ??= {})[game.name] ??= defaultState(game));
  const body = h("div", { class: "view" });
  root.replaceChildren(body);
  const rerender = () => renderPick(root, game, ui);

  const need = game.count + st.add - st.fixed.length;
  const have = st.items.reduce((a, i) => a + i.count, 0);
  const secondCount = game.extra?.pickable ? (st.second === "all" ? game.extra.max - game.extra.min + 1 : 1) : 1;
  const tickets = ticketCount(game, game.count + st.add, secondCount);

  // ---- 號碼設定 ----
  const addChips = [0, 1, 2].map(n => h("button", { class: "chip" + (st.add === n ? " on" : ""), onclick: () => { st.add = n; st.fixed = st.fixed.slice(0, game.count + n); st.result = null; rerender(); } }, n === 0 ? "不增加" : `增加 ${n} 號`));
  const fixedGrid = h("div", { class: "pickgrid" }, Array.from({ length: game.max - game.min + 1 }, (_, i) => game.min + i).map(v =>
    h("button", { class: "pg" + (st.fixed.includes(v) ? " on" : ""), onclick: () => {
      if (st.fixed.includes(v)) st.fixed = st.fixed.filter(x => x !== v);
      else if (st.fixed.length < game.count + st.add) st.fixed = [...st.fixed, v].sort((a, b) => a - b);
      else return toast(`固定號碼最多 ${game.count + st.add} 個`, true);
      rerender();
    } }, fmt(v))));
  const settings = h("div", { class: "card" },
    h("h3", {}, "號碼設定"),
    h("div", { class: "field" }, h("label", {}, `增加號碼(包牌):每注 ${game.count} 個,多選幾個就把所有組合都買`), h("div", { class: "row" }, addChips)),
    game.extra?.pickable && h("div", { class: "field" }, h("label", {}, `${game.extra.label}(${game.extra.min}-${game.extra.max})`),
      h("div", { class: "row" }, SECOND_MODES.map(([m, t]) => h("button", { class: "chip pink" + (st.second === m ? " on" : ""), onclick: () => { st.second = m; st.result = null; rerender(); } }, t)))),
    h("div", { class: "field" }, h("label", {}, `固定號碼(想一定要有的號碼,${st.fixed.length} 個)`), fixedGrid,
      st.fixed.length > 0 && h("button", { class: "btn sm", style: "margin-top:8px", onclick: () => { st.fixed = []; rerender(); } }, "清除固定號碼")),
    h("div", { class: "report" },
      `主號共 ${game.count + st.add} 個`, game.extra?.pickable && `,${game.extra.label} ${secondCount} 個`,
      h("b", {}, ` → ${tickets} 注,約 NT$ ${(tickets * game.price).toLocaleString()}`),
      h("div", { class: "hint" }, `每注 NT$ ${game.price}。包牌只是把號碼組合買齊,不會提高單注的中獎機率。`)));

  // ---- 配方 ----
  const itemRows = st.items.map((it, idx) => h("div", { class: "row item" },
    h("select", { class: "input sel", onchange: e => { it.source = e.target.value; rerender(); } }, SOURCES.map(s => h("option", { value: s.id, selected: s.id === it.source }, s.label))),
    "×",
    h("input", { class: "input num", type: "number", min: 1, max: 9, value: it.count, onchange: e => { it.count = Math.max(1, Math.min(9, Math.trunc(+e.target.value) || 1)); rerender(); } }),
    SOURCES.find(s => s.id === it.source).needsN && h("span", { class: "row", style: "gap:4px" }, "近", h("input", { class: "input num", type: "number", min: 1, value: it.n ?? 10, onchange: e => { it.n = Math.max(1, Math.trunc(+e.target.value) || 10); } }), "期"),
    h("button", { class: "btn sm pink", onclick: () => { st.items.splice(idx, 1); rerender(); } }, "刪")));
  const status = have === need ? "ok" : have > need ? "bad" : "";
  const recipe = h("div", { class: "card" },
    h("h3", {}, "配方選號"),
    h("div", { class: "hint", style: "margin:-6px 0 10px" }, `依統計來源取號,按順序;已被取走的號碼自動跳過。統計範圍沿用「統計」分頁的設定(目前 ${draws.length} 期)。`),
    ...itemRows,
    h("div", { class: "row", style: "margin:10px 0" },
      h("button", { class: "btn sm", onclick: () => { st.items.push({ source: "random", count: 1 }); rerender(); } }, "+ 新增條目"),
      h("b", { class: status }, `已選 ${have + st.fixed.length} / 需要 ${game.count + st.add}`)),
    h("div", { class: "row" },
      h("label", { class: "row", style: "gap:6px" }, h("input", { type: "checkbox", checked: st.fillRandom, onchange: e => { st.fillRandom = e.target.checked; } }), "不足時剩餘以隨機補滿"),
      h("label", { class: "row", style: "gap:6px" }, "同分:", h("select", { class: "input sel", onchange: e => { st.tieBreak = e.target.value; } },
        h("option", { value: "random", selected: st.tieBreak === "random" }, "隨機"), h("option", { value: "small", selected: st.tieBreak === "small" }, "較小號優先")))),
    h("div", { class: "row", style: "margin-top:10px" }, "亂數種子(可留空):", h("input", { class: "input", style: "width:130px", value: st.seed, placeholder: "留空=每次不同", onchange: e => { st.seed = e.target.value.trim(); } })),
    h("div", { style: "margin-top:12px" }, h("button", { class: "btn yellow", onclick: () => run("配方", (r, f) => generateByRecipe(game, draws, { items: st.items, tieBreak: st.tieBreak, fillRandom: st.fillRandom, fixed: f, add: st.add }, r)) }, "依配方產生")));

  // ---- 一鍵策略 ----
  const strategies = h("div", { class: "card" },
    h("h3", {}, "一鍵策略"),
    h("div", { class: "row" },
      h("button", { class: "btn mint", onclick: () => run("均衡型", (r, f) => balanced(game, draws, f, st.add, r)) }, "均衡型"),
      h("button", { class: "btn", onclick: () => run("純隨機(電腦選號)", (r, f) => pureRandom(game, f, st.add, r)) }, "純隨機")),
    h("div", { class: "hint" }, "均衡型:奇偶比、大小比取歷史常見的種類,和值落在歷史 10%~90% 區間,再隨機填號。目的是避開極端組合,不是提高中獎率。純隨機是基準線。"));

  // ---- 結果 ----
  const resultBox = h("div");
  const showResult = () => {
    const r = st.result;
    if (!r) { resultBox.replaceChildren(st.error && h("div", { class: "report bad" }, st.error)); return; }
    const shown = r.tickets.slice(0, MAX_SHOWN);
    resultBox.replaceChildren(h("div", { class: "card white" },
      h("h3", {}, `結果:${r.label}`),
      h("div", { class: "pool" }, r.picks.map(p => h("div", { class: "pickball" }, h("span", { class: "ball" }, fmt(p.number)), h("small", {}, p.source)))),
      r.seconds && h("div", { class: "row", style: "margin-top:10px" }, `${game.extra.label}:`, r.seconds.map(v => h("span", { class: "ball sp" }, fmt(v)))),
      h("div", { class: "report" }, h("b", {}, `共 ${r.tickets.length} 注,NT$ ${(r.tickets.length * game.price).toLocaleString()}`), r.tickets.length > 1 && " (包牌:所有組合都買)", h("div", { class: "hint" }, `亂數種子 ${r.seed}(填入種子可重現同一組)`)),
      r.tickets.length > 1 && h("details", {}, h("summary", {}, `查看各注(${r.tickets.length})`),
        h("div", { class: "tickets" }, shown.map(t => h("div", {}, t.numbers.map(fmt).join(" "), t.special != null ? `  +  ${fmt(t.special)}` : ""))),
        r.tickets.length > MAX_SHOWN && h("div", { class: "hint" }, `只顯示前 ${MAX_SHOWN} 注,可用「複製」取得全部。`)),
      h("div", { class: "row", style: "margin-top:10px" },
        h("button", { class: "btn sm", onclick: async () => { try { await navigator.clipboard.writeText(r.tickets.map(t => t.numbers.map(fmt).join(" ") + (t.special != null ? ` + ${fmt(t.special)}` : "")).join("\n")); toast("已複製"); } catch { toast("無法複製", true); } } }, "複製全部號碼")),
      h("div", { class: "hint" }, "提醒:樂透每期為獨立隨機事件,統計與策略對下一期無預測力,本工具僅供娛樂,不保證提高中獎機率。")));
  };

  function run(label, make) {
    st.error = "";
    const seed = st.seed !== "" && Number.isFinite(+st.seed) ? Math.trunc(+st.seed) : Math.floor(Math.random() * 1e9);
    const rng = makeRng(seed);
    try {
      if (!draws.length) throw new Error("統計範圍內沒有資料");
      const picks = make(rng, st.fixed);
      const seconds = game.extra?.pickable ? pickSecond(game, draws, st.second, rng) : null;
      const sorted = [...picks].sort((a, b) => a.number - b.number);
      st.result = { label, picks: sorted, seconds, seed, tickets: expandTickets(game, sorted.map(p => p.number), seconds) };
    } catch (e) { st.result = null; st.error = e.message; toast(e.message, true); }
    showResult();
    resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  showResult();

  body.append(h("div", { class: "label pink" }, `${game.name} 選號`), settings, recipe, strategies, resultBox);
}
