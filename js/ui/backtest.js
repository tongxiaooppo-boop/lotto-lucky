// 「回測」分頁:選策略與區間,與純隨機(理論值)對照。
import { h } from "./dom.js";
import { getDraws } from "../data/store.js";
import { STRATEGIES } from "../engine/recipes/strategies.js";
import { refGameName } from "../engine/recipes/index.js";
import { GAMES } from "../core/games.js";
import { pct, bar } from "./widgets.js";

// 先用 Worker;不支援、或 Worker 還沒回任何訊息就出錯(例如瀏覽器不支援模組 Worker、載入失敗)時,退回主執行緒(動態載入)。
function runJob(job, onProgress) {
  const inMain = () => import("../engine/backtest/job.js").then(m => m.runJob(job, onProgress));
  return new Promise((resolve, reject) => {
    let worker, heard = false;
    try { worker = new Worker(new URL("../engine/backtest/worker.js", import.meta.url), { type: "module" }); }
    catch { worker = null; }
    if (!worker) { inMain().then(resolve, reject); return; }
    worker.onmessage = e => {
      heard = true;
      if (e.data.type === "progress") onProgress(e.data.p);
      else { worker.terminate(); e.data.type === "done" ? resolve(e.data.result) : reject(new Error(e.data.message)); }
    };
    worker.onerror = e => {
      worker.terminate();
      if (!heard) { e.preventDefault?.(); inMain().then(resolve, reject); }
      else reject(new Error(e.message || "回測執行失敗"));
    };
    worker.postMessage(job);
  });
}

function verdict(r) {
  const diff = r.mean - r.expectedMean;
  if (r.p >= 0.05) return `平均命中 ${r.mean.toFixed(3)} 個,與純隨機的理論值 ${r.expectedMean.toFixed(3)} 沒有顯著差異(p = ${r.p.toFixed(3)})。這個策略沒有證據優於隨機。`;
  return `平均命中 ${r.mean.toFixed(3)} 個,${diff > 0 ? "高於" : "低於"}理論值 ${r.expectedMean.toFixed(3)}(p = ${r.p.toFixed(3)} < 0.05)。注意:試過多個策略時,偶然達標很常見,請看「全策略比較」的提醒。`;
}

export async function renderBacktest(root, game, ui) {
  const { draws } = await getDraws(game);
  const st = ((ui.bt ??= {})[game.name] ??= { strategy: "balanced", testCount: 300, scopeN: game.defaultScope, seed: "" });
  const body = h("div", { class: "view" });
  root.replaceChildren(body);

  const stratSel = h("select", { class: "input sel", onchange: e => { st.strategy = e.target.value; } },
    ...STRATEGIES.map(s => h("option", { value: s.id, selected: st.strategy === s.id }, s.label)),
    h("option", { value: "recipe", selected: st.strategy === "recipe" }, "目前配方(選號分頁)"));
  const num = (key, min) => h("input", { class: "input num", style: "width:96px", type: "number", min, value: st[key], onchange: e => { st[key] = Math.max(min, Math.trunc(+e.target.value) || min); } });
  const fill = h("i");
  const bar_ = h("div", { class: "pbar", style: "display:none" }, fill);
  const msg = h("div", { class: "hint" });
  const out = h("div", { class: "view" });
  let running = false;

  async function go(mode) {
    if (running) return;
    running = true; out.replaceChildren(); msg.textContent = "計算中…"; msg.className = "hint"; bar_.style.display = "block"; fill.style.width = "0";
    const pr = ui.pick?.[game.name];
    const job = {
      gameName: game.name, draws, mode, strategy: st.strategy,
      recipe: pr && { items: pr.items, tieBreak: pr.tieBreak },
      testCount: st.testCount, scopeN: st.scopeN, seed: st.seed !== "" && Number.isFinite(+st.seed) ? Math.trunc(+st.seed) : 1,
    };
    try {
      if (job.strategy === "recipe" && !job.recipe) throw new Error("請先到「選號」分頁設定配方");
      if (job.strategy === "recipe" && job.recipe.items.some(i => i.source === "ref_other")) {
        const ref = GAMES[refGameName(game)];
        job.refDraws = ref ? (await getDraws(ref)).draws.map(d => ({ date: d.date, numbers: d.numbers })) : null;
      }
      const res = await runJob(job, p => { fill.style.width = `${Math.round(p * 100)}%`; });
      msg.textContent = "";
      out.replaceChildren(...(res.mode === "extra" ? renderExtra(res.rows, game) : res.mode === "all" ? renderAll(res.rows) : renderOne(res.result, game)));
    } catch (e) { msg.textContent = e.message; msg.className = "hint bad"; }
    bar_.style.display = "none"; running = false;
  }

  body.append(
    h("div", { class: "label pink" }, `${game.name} 策略回測`),
    h("div", { class: "card" },
      h("div", { class: "hint", style: "margin:-6px 0 10px" }, "對每個測試期,只用「該期以前」的資料產生一注推薦,與實際開獎比對,再和純隨機的理論值比較。預期結論多半是「沒有差異」。"),
      h("div", { class: "field" }, h("label", {}, "策略"), stratSel),
      h("div", { class: "hint", style: "margin:-4px 0 8px" }, `「目前配方」回測時一律每注 ${game.count} 個、不含固定號碼:配方超過 ${game.count} 個(用了增加號碼)時依序截掉;條目自訂範圍取該期以前的完整歷史;「${refGameName(game)}(最新一期)」用該期開獎日之前最近一期的號碼。`),
      h("div", { class: "row" }, "測試最近", num("testCount", 10), "期;歷史窗口", num("scopeN", 10), "期;種子", h("input", { class: "input num", style: "width:96px", placeholder: "選填", value: st.seed, onchange: e => { st.seed = e.target.value.trim(); } })),
      h("div", { class: "row", style: "margin-top:12px" },
        h("button", { class: "btn yellow", onclick: () => go("one") }, "回測這個策略"),
        h("button", { class: "btn mint", onclick: () => go("all") }, "全策略比較"),
        game.extra && h("button", { class: "btn pink", onclick: () => go("extra") }, `${game.extra.label}來源比較`)),
      bar_, msg),
    out);
}

const card = (title, ...kids) => h("div", { class: "card white" }, h("h3", {}, title), ...kids);

function renderOne(r, game) {
  const maxR = Math.max(...r.hitDist.map(x => Math.max(x.ratio, x.theory)), 0.01);
  const tierNames = Object.keys(r.tiers);
  return [
    card("結果", h("div", { class: "report" }, verdict(r)),
      h("div", { class: "row", style: "margin-top:10px" }, [`測試 ${r.tests} 期`, `平均命中 ${r.mean.toFixed(3)}`, `95% 信賴區間 ${r.ci95[0].toFixed(3)} ~ ${r.ci95[1].toFixed(3)}`, `理論 ${r.expectedMean.toFixed(3)}`, `z = ${r.z.toFixed(2)}`].map(t => h("span", {}, t))),
      h("div", { class: "hint" }, `有任何中獎的期數:${r.anyPrize}(${pct(r.anyPrizeRate)})。信賴區間包含理論值,代表看不出與隨機的差別。`)),
    card("命中個數分布(實際 vs 隨機理論)", h("table", { class: "tbl" },
      h("thead", {}, h("tr", {}, ["命中", "期數", "實際", "理論"].map(t => h("th", {}, t)))),
      h("tbody", {}, r.hitDist.map(x => h("tr", {}, h("td", {}, x.k), h("td", {}, x.count), h("td", {}, pct(x.ratio, 2), bar(x.ratio, maxR)), h("td", {}, pct(x.theory, 2), bar(x.theory, maxR))))))),
    card("各中獎等級次數", tierNames.length
      ? h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ["獎項", "次數"].map(t => h("th", {}, t)))), h("tbody", {}, tierNames.map(n => h("tr", {}, h("td", {}, n), h("td", {}, r.tiers[n])))))
      : "測試期間沒有任何中獎",
      game.extra && !game.extra.pickable && h("div", { class: "hint" }, "大樂透:特別號不用選,這裡以「所選號碼是否含特別號」判定貳、肆、陸、柒獎。"),
      game.extra?.pickable && h("div", { class: "hint" }, "威力彩:第二區回測時一律隨機選 1 個。")),
  ];
}

function renderAll(rows) {
  const sig = rows.filter(r => r.p < 0.05).length;
  return [card("全策略比較(依平均命中排序)", h("table", { class: "tbl" },
    h("thead", {}, h("tr", {}, ["策略", "平均命中", "與理論差", "p 值", "中獎率"].map(t => h("th", {}, t)))),
    h("tbody", {}, rows.map(r => h("tr", {}, h("td", {}, r.label), h("td", {}, r.mean.toFixed(3)), h("td", {}, (r.mean - r.expectedMean >= 0 ? "+" : "") + (r.mean - r.expectedMean).toFixed(3)),
      h("td", {}, r.p.toFixed(3), r.p < 0.05 && h("span", { class: "tag", style: "margin-left:6px" }, "<0.05")), h("td", {}, pct(r.anyPrizeRate)))))),
    h("div", { class: "report" }, `${rows.length} 個策略中有 ${sig} 個 p < 0.05。同時比較 ${rows.length} 個策略時,即使全部都等同隨機,平均也會有約 ${(rows.length * 0.05).toFixed(1)} 個「看起來顯著」,所以單看 p < 0.05 不能當作策略有效的證據。`))];
}

function renderExtra(rows, game) {
  const sig = rows.filter(r => r.p < 0.05).length;
  return [card(`${game.extra.label}:各統計來源比較(每期選 1 個,看是否命中開出的${game.extra.label})`, h("table", { class: "tbl" },
    h("thead", {}, h("tr", {}, ["來源", "命中率", "隨機理論", "p 值"].map(t => h("th", {}, t)))),
    h("tbody", {}, rows.map(r => h("tr", {}, h("td", {}, r.label), h("td", {}, `${pct(r.rate, 2)}(${r.hits}/${r.tests})`), h("td", {}, pct(r.expected, 2)),
      h("td", {}, r.p.toFixed(3), r.p < 0.05 && h("span", { class: "tag", style: "margin-left:6px" }, "<0.05")))))),
    h("div", { class: "report" }, `${rows.length} 個來源中有 ${sig} 個 p < 0.05。每期只選 1 個號碼,命中是低機率事件,樣本變異很大;同時比較 ${rows.length} 個來源時,約有 ${(rows.length * 0.05).toFixed(1)} 個會因偶然而「看起來顯著」,不能當作有效的證據。`),
    !game.extra.pickable && h("div", { class: "hint" }, "大樂透的特別號是開獎附加號,投注時不用選,這裡只是比較哪種統計來源「猜」得比較準(結論多半是沒有差別)。"))];
}
