// 「選號」分頁:號碼設定(固定號碼、增加號碼=包牌、威力彩第二區)、配方編輯器、一鍵策略、多組、儲存配方、結果。
import { h, toast, download } from "./dom.js";
import { getDraws } from "../data/store.js";
import { applyScope } from "../engine/stats/index.js";
import { scopeOf, statsState } from "./stats.js";
import { SOURCES, EXTRA_SOURCES, makeRng, generateByRecipe, pickExtra, expandTickets, ticketCount } from "../engine/recipes/index.js";
import { STRATEGIES, strategyById, generateSets, coverTickets } from "../engine/recipes/strategies.js";
import { PRESETS } from "../core/presets.js";
import { loadRecipes, saveRecipe, deleteRecipe, exportRecipes, importRecipes } from "../data/recipes.js";

const fmt = n => String(n).padStart(2, "0");
const MAX_SHOWN = 60;

function defaultState(game) {
  return {
    add: 0, fixed: [], extraSource: "random", extraK: 1, extraN: 10, tieBreak: "random", fillRandom: false, seed: "",
    sets: 1, distinct: true, fSum: false, fParity: false, coverN: 5, name: "",
    results: [], cover: null, error: "",
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
  const rerenderKeepResult = () => renderPick(root, game, ui);   // st.results 存在 ui 狀態,重畫後仍會顯示
  const clear = () => { st.results = []; st.cover = null; st.error = ""; };

  const need = game.count + st.add - st.fixed.length;
  const have = st.items.reduce((a, i) => a + i.count, 0);
  const extraRange = game.extra ? game.extra.max - game.extra.min + 1 : 0;
  const secondCount = game.extra?.pickable ? Math.min(st.extraK, extraRange) : 1;
  const tickets = ticketCount(game, game.count + st.add, secondCount);

  // ---- 號碼設定 ----
  const addChips = [0, 1, 2].map(n => h("button", { class: "chip" + (st.add === n ? " on" : ""), onclick: () => { st.add = n; st.fixed = st.fixed.slice(0, game.count + n); clear(); rerender(); } }, n === 0 ? "不增加" : `增加 ${n} 號`));
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
    game.extra && h("div", { class: "field" },
      h("label", {}, game.extra.pickable ? `${game.extra.label}(${game.extra.min}-${game.extra.max}):選法與個數` : `${game.extra.label}參考(${game.extra.min}-${game.extra.max}):投注時不用選,僅供參考`),
      h("div", { class: "row" },
        h("select", { class: "input sel", onchange: e => { st.extraSource = e.target.value; clear(); rerender(); } }, SOURCES.map(s => h("option", { value: s.id, selected: s.id === st.extraSource }, s.label))),
        EXTRA_SOURCES.find(s => s.id === st.extraSource)?.needsN && h("span", { class: "row", style: "gap:4px" }, "近", h("input", { class: "input num", type: "number", min: 1, value: st.extraN, onchange: e => { st.extraN = Math.max(1, Math.trunc(+e.target.value) || 10); } }), "期")),
      game.extra.pickable && h("div", { class: "row", style: "margin-top:6px" }, "個數:",
        [1, 2, 3].map(k => h("button", { class: "chip pink" + (st.extraK === k ? " on" : ""), onclick: () => { st.extraK = k; clear(); rerender(); } }, String(k))),
        h("button", { class: "chip pink" + (st.extraK >= extraRange ? " on" : ""), onclick: () => { st.extraK = extraRange; clear(); rerender(); } }, `全部(${extraRange})`))),
    h("div", { class: "field" }, h("label", {}, `固定號碼(想一定要有的號碼,${st.fixed.length} 個)`), fixedGrid,
      st.fixed.length > 0 && h("button", { class: "btn sm", style: "margin-top:8px", onclick: () => { st.fixed = []; rerender(); } }, "清除固定號碼")),
    h("div", { class: "report" },
      `每組主號 ${game.count + st.add} 個`, game.extra?.pickable && `,${game.extra.label} ${secondCount} 個`,
      h("b", {}, ` → ${tickets} 注,約 NT$ ${(tickets * game.price).toLocaleString()}`),
      h("div", { class: "hint" }, `每注 NT$ ${game.price}。包牌只是把號碼組合買齊,不會提高單注的中獎機率。`)));

  // ---- 回測組合(一鍵套用) ----
  const signed = x => (x >= 0 ? "+" : "") + x.toFixed(3);
  const applyPreset = p => {
    // 固定號碼與「增加號碼」會改變需要的名額:依序截斷條目,不足的由隨機補滿
    let remaining = Math.max(0, game.count + st.add - st.fixed.length);
    st.items = [];
    for (const it of p.items) { const count = Math.min(it.count, remaining); if (count > 0) { st.items.push({ ...structuredClone(it), count }); remaining -= count; } }
    st.tieBreak = "random"; st.fillRandom = true; st.name = p.name;
    run(p.name, (r, f) => generateByRecipe(game, draws, { items: st.items, tieBreak: "random", fillRandom: true, fixed: f, add: st.add }, r));
    rerenderKeepResult();
  };
  const presets = PRESETS[game.name] ?? [];
  const presetCard = presets.length ? h("div", { class: "card" },
    h("h3", {}, "回測組合(一鍵套用)"),
    h("div", { class: "hint", style: "margin:-6px 0 10px" }, "從上百種配方組合中,用「前半段歷史」挑出回測平均命中最高的幾個,再用「後半段歷史」重新驗證。按下去會套用到下方配方並立刻產生號碼。"),
    ...presets.map(p => h("div", { class: "preset" },
      h("button", { class: "btn sm mint", onclick: () => applyPreset(p) }, p.name),
      h("div", { class: "hint" }, `訓練段 ${signed(p.train.diff)} → 測試段 ${signed(p.test.diff)}(p=${p.test.p.toFixed(2)}),單位:平均命中個數 − 隨機理論值`))),
    h("div", { class: "report" }, "怎麼看:訓練段的好成績是「事後挑出來的」;沒參與挑選的測試段通常會回到 0 附近,代表這些組合沒有可靠的優勢,按鈕只是方便你快速套用,不是更準的組合。")) : null;

  // ---- 配方 ----
  const scopeSel = it => h("select", { class: "input sel", onchange: e => {
    const v = e.target.value;
    it.scope = v === "global" ? undefined : v === "all" ? { type: "all" } : { type: "last_n", n: it.scope?.n ?? 20 };
    rerender();
  } }, h("option", { value: "global", selected: !it.scope }, "沿用全域範圍"), h("option", { value: "all", selected: it.scope?.type === "all" }, "歷史全部"), h("option", { value: "last_n", selected: it.scope?.type === "last_n" }, "近 N 期"));
  const itemRows = st.items.map((it, idx) => h("div", { class: "item" },
    h("div", { class: "row" },
      h("select", { class: "input sel", onchange: e => { it.source = e.target.value; rerender(); } }, SOURCES.map(s => h("option", { value: s.id, selected: s.id === it.source }, s.label))),
      "×", h("input", { class: "input num", type: "number", min: 1, max: 9, value: it.count, onchange: e => { it.count = Math.max(1, Math.min(9, Math.trunc(+e.target.value) || 1)); rerender(); } }),
      SOURCES.find(s => s.id === it.source).needsN && h("span", { class: "row", style: "gap:4px" }, "近", h("input", { class: "input num", type: "number", min: 1, value: it.n ?? 10, onchange: e => { it.n = Math.max(1, Math.trunc(+e.target.value) || 10); } }), "期"),
      h("button", { class: "btn sm pink", onclick: () => { st.items.splice(idx, 1); rerender(); } }, "刪")),
    h("div", { class: "row", style: "margin-top:4px" }, "範圍:", scopeSel(it),
      it.scope?.type === "last_n" && h("input", { class: "input num", type: "number", min: 1, value: it.scope.n, onchange: e => { it.scope.n = Math.max(1, Math.trunc(+e.target.value) || 20); } }))));
  const status = have + st.fixed.length === game.count + st.add ? "ok" : have + st.fixed.length > game.count + st.add ? "bad" : "";
  const filterOff = st.add > 0;
  const recipeCard = h("div", { class: "card" },
    h("h3", {}, "配方選號"),
    h("div", { class: "hint", style: "margin:-6px 0 10px" }, `依統計來源取號,按順序;已被取走的號碼自動跳過。全域範圍沿用「統計」分頁的設定(目前 ${draws.length} 期)。`),
    ...itemRows,
    h("div", { class: "row", style: "margin:10px 0" },
      h("button", { class: "btn sm", onclick: () => { st.items.push({ source: "random", count: 1 }); rerender(); } }, "+ 新增條目"),
      h("b", { class: status }, `已選 ${have + st.fixed.length} / 需要 ${game.count + st.add}`)),
    h("div", { class: "row" },
      h("label", { class: "row", style: "gap:6px" }, h("input", { type: "checkbox", checked: st.fillRandom, onchange: e => { st.fillRandom = e.target.checked; } }), "不足時剩餘以隨機補滿"),
      h("label", { class: "row", style: "gap:6px" }, "同分:", h("select", { class: "input sel", onchange: e => { st.tieBreak = e.target.value; } },
        h("option", { value: "random", selected: st.tieBreak === "random" }, "隨機"), h("option", { value: "small", selected: st.tieBreak === "small" }, "較小號優先")))),
    h("div", { style: "margin-top:12px" }, h("button", { class: "btn yellow", onclick: () => run("配方", (r, f) => generateByRecipe(game, draws, { items: st.items, tieBreak: st.tieBreak, fillRandom: st.fillRandom, fixed: f, add: st.add }, r)) }, "依配方產生")));

  // ---- 產生選項(組數、過濾、種子) ----
  const options = h("div", { class: "card" },
    h("h3", {}, "產生選項"),
    h("div", { class: "row" }, "一次產生", h("input", { class: "input num", type: "number", min: 1, max: 20, value: st.sets, onchange: e => { st.sets = Math.max(1, Math.min(20, Math.trunc(+e.target.value) || 1)); } }), "組",
      h("label", { class: "row", style: "gap:6px" }, h("input", { type: "checkbox", checked: st.distinct, onchange: e => { st.distinct = e.target.checked; } }), "彼此不重複")),
    h("div", { class: "row", style: "margin-top:8px" },
      h("label", { class: "row", style: "gap:6px" }, h("input", { type: "checkbox", checked: st.fSum, disabled: filterOff, onchange: e => { st.fSum = e.target.checked; } }), "和值落在歷史 80% 區間"),
      h("label", { class: "row", style: "gap:6px" }, h("input", { type: "checkbox", checked: st.fParity, disabled: filterOff, onchange: e => { st.fParity = e.target.checked; } }), "奇偶比不要全奇/全偶")),
    filterOff && h("div", { class: "hint" }, "條件過濾僅在「不增加號碼」時可用。"),
    h("div", { class: "row", style: "margin-top:8px" }, "亂數種子(可留空):", h("input", { class: "input", style: "width:130px", value: st.seed, placeholder: "留空=每次不同", onchange: e => { st.seed = e.target.value.trim(); } })));

  // ---- 一鍵策略 ----
  const coverIn = h("input", { class: "input num", type: "number", min: 2, max: 50, value: st.coverN, onchange: e => { st.coverN = Math.max(2, Math.min(50, Math.trunc(+e.target.value) || 5)); } });
  const strategies = h("div", { class: "card" },
    h("h3", {}, "一鍵策略"),
    h("div", { class: "row" }, STRATEGIES.map(s => h("button", { class: "btn sm" + (s.id === "balanced" ? " mint" : ""), title: s.note ?? "", onclick: () => run(s.label, (r, f) => s.run(game, draws, { fixed: f, add: st.add }, r)) }, s.label))),
    h("div", { class: "hint" }, "均衡型:奇偶比、大小比取歷史常見種類,和值落在歷史 10%~90% 區間,再隨機填號,目的是避開極端組合而非提高中獎率。純隨機是基準線。長按/滑過按鈕可看各策略說明。"),
    h("div", { class: "row", style: "margin-top:10px" }, "多注覆蓋:", coverIn, "注",
      h("button", { class: "btn sm yellow", onclick: () => {
        const c = coverTickets(game, st.coverN, makeRng(st.seed !== "" && Number.isFinite(+st.seed) ? Math.trunc(+st.seed) : Math.floor(Math.random() * 1e9)));
        st.results = []; st.cover = c; showResults();
      } }, "產生")),
    h("div", { class: "hint" }, "盡量讓各注號碼分散、少重複,擴大覆蓋的號碼範圍(不提高單注中獎機率)。"));

  // ---- 儲存的配方 ----
  const jsonIn = h("input", { type: "file", accept: ".json,application/json", style: "display:none", onchange: async e => {
    try { toast(`匯入 ${importRecipes(await e.target.files[0].text())} 個配方`); rerender(); } catch (err) { toast("匯入失敗:" + err.message, true); }
    e.target.value = "";
  } });
  const saved = loadRecipes().filter(r => r.game === game.name);
  const savedCard = h("div", { class: "card" },
    h("h3", {}, "儲存的配方"),
    h("div", { class: "row" }, h("input", { class: "input", style: "flex:1;min-width:120px", placeholder: "配方名稱(例如:冷熱各半)", value: st.name, onchange: e => { st.name = e.target.value; } }),
      h("button", { class: "btn sm yellow", onclick: () => {
        try {
          saveRecipe({ name: st.name, game: game.name, scope: scopeOf(ui, game), items: st.items, tie_break: st.tieBreak, fill_random: st.fillRandom });
          toast("已儲存"); rerender();
        } catch (err) { toast(err.message, true); }
      } }, "儲存目前配方")),
    saved.length ? h("div", { style: "margin-top:10px" }, saved.map(r => h("div", { class: "row", style: "margin-bottom:6px" },
      h("b", {}, r.name), h("span", { class: "hint" }, r.items.map(i => `${SOURCES.find(s => s.id === i.source)?.label ?? i.source}×${i.count}`).join(" + ")),
      h("button", { class: "btn sm mint", onclick: () => {
        st.items = structuredClone(r.items); st.tieBreak = r.tie_break ?? "random"; st.fillRandom = !!r.fill_random; st.name = r.name;
        if (r.scope) { const sc = statsState(ui, game); sc.type = r.scope.type; if (r.scope.n) sc.n = r.scope.n; if (r.scope.from != null) sc.from = r.scope.from; if (r.scope.to != null) sc.to = r.scope.to; }
        clear(); rerender();
      } }, "套用"),
      h("button", { class: "btn sm pink", onclick: () => { deleteRecipe(game.name, r.name); rerender(); } }, "刪")))) : h("div", { class: "hint" }, "還沒有儲存的配方。儲存在這個瀏覽器,可匯出分享給朋友。"),
    h("div", { class: "row", style: "margin-top:8px" },
      h("button", { class: "btn sm", onclick: () => download("配方.json", exportRecipes()) }, "匯出全部配方"),
      h("button", { class: "btn sm", onclick: () => jsonIn.click() }, "匯入配方"), jsonIn));

  // ---- 結果 ----
  const resultBox = h("div", { class: "view" });
  const copyText = ts => ts.map(t => t.numbers.map(fmt).join(" ") + (t.special != null ? ` + ${fmt(t.special)}` : "")).join("\n");
  const copyBtn = ts => h("button", { class: "btn sm", onclick: async () => { try { await navigator.clipboard.writeText(copyText(ts)); toast("已複製"); } catch { toast("無法複製", true); } } }, "複製號碼");
  const disclaimer = h("div", { class: "hint" }, "提醒:樂透每期為獨立隨機事件,統計與策略對下一期無預測力,本工具僅供娛樂,不保證提高中獎機率。");
  function showResults() {
    const nodes = [];
    if (st.error) nodes.push(h("div", { class: "report bad" }, st.error));
    if (st.results.length) {
      const allT = st.results.flatMap(r => r.tickets);
      if (st.results.length > 1) nodes.push(h("div", { class: "report" }, h("b", {}, `共 ${st.results.length} 組、${allT.length} 注,NT$ ${(allT.length * game.price).toLocaleString()}`), " ", copyBtn(allT)));
      st.results.forEach((r, i) => {
        const shown = r.tickets.slice(0, MAX_SHOWN);
        nodes.push(h("div", { class: "card white" },
          h("h3", {}, st.results.length > 1 ? `第 ${i + 1} 組(${r.label})` : `結果:${r.label}`),
          h("div", { class: "pool" }, r.picks.map(p => h("div", { class: "pickball" }, h("span", { class: "ball" }, fmt(p.number)), h("small", {}, p.source)))),
          r.seconds && h("div", { class: "row", style: "margin-top:10px" }, `${game.extra.label}:`, r.seconds.map(v => h("span", { class: "ball sp" }, fmt(v)))),
          r.reference && h("div", { class: "row", style: "margin-top:10px" }, `${game.extra.label}參考(不用投注):`, r.reference.map(v => h("span", { class: "ball sp" }, fmt(v)))),
          h("div", { class: "report" }, h("b", {}, `${r.tickets.length} 注,NT$ ${(r.tickets.length * game.price).toLocaleString()}`), r.tickets.length > 1 && "(包牌:所有組合都買)", h("div", { class: "hint" }, `種子 ${r.seed}(填入可重現)`)),
          r.tickets.length > 1 && h("details", {}, h("summary", {}, `查看各注(${r.tickets.length})`),
            h("div", { class: "tickets" }, shown.map(t => h("div", {}, t.numbers.map(fmt).join(" "), t.special != null ? `  +  ${fmt(t.special)}` : ""))),
            r.tickets.length > MAX_SHOWN && h("div", { class: "hint" }, `只顯示前 ${MAX_SHOWN} 注,可用「複製」取得全部。`)),
          st.results.length === 1 && h("div", { style: "margin-top:8px" }, copyBtn(r.tickets))));
      });
    }
    if (st.cover) {
      const ts = st.cover.tickets.map(numbers => ({ numbers, special: null }));
      nodes.push(h("div", { class: "card white" }, h("h3", {}, `多注覆蓋:${ts.length} 注`),
        h("div", { class: "report" }, `共覆蓋 ${st.cover.coverage} / ${game.max - game.min + 1} 個號碼,NT$ ${(ts.length * game.price).toLocaleString()}`),
        h("div", { class: "tickets" }, ts.map(t => h("div", {}, t.numbers.map(fmt).join(" ")))),
        game.extra?.pickable && h("div", { class: "hint" }, `${game.extra.label}請自行另選。`), h("div", { style: "margin-top:8px" }, copyBtn(ts))));
    }
    if (nodes.length) nodes.push(disclaimer);
    resultBox.replaceChildren(...nodes);
  }

  function run(label, make) {
    st.error = ""; st.cover = null;
    const base = st.seed !== "" && Number.isFinite(+st.seed) ? Math.trunc(+st.seed) : Math.floor(Math.random() * 1e9);
    const rng = makeRng(base);
    try {
      if (!draws.length) throw new Error("統計範圍內沒有資料");
      const filter = !filterOff && (st.fSum || st.fParity) ? { sum: st.fSum, parity: st.fParity } : null;
      const sets = generateSets(game, draws, r => make(r, st.fixed), rng, { sets: st.sets, distinct: st.distinct, filter });
      st.results = sets.map((picks, i) => {
        const sorted = [...picks].sort((a, b) => a.number - b.number);
        const extra = game.extra ? pickExtra(game, draws, { source: st.extraSource, k: game.extra.pickable ? st.extraK : 1, n: st.extraN }, rng) : null;
        const seconds = game.extra?.pickable ? extra : null;
        return { label, picks: sorted, seconds, reference: game.extra && !game.extra.pickable ? extra : null, seed: base, tickets: expandTickets(game, sorted.map(p => p.number), seconds) };
      });
    } catch (e) { st.results = []; st.error = e.message; toast(e.message, true); }
    showResults();
    resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  showResults();

  body.append(h("div", { class: "label pink" }, `${game.name} 選號`), settings, ...(presetCard ? [presetCard] : []), recipeCard, strategies, options, resultBox, savedCard);
}
