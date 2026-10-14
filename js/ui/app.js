import { GAMES } from "../core/games.js";
import { h, toast } from "./dom.js";
import { renderDraws } from "./draws.js";
import { renderStats } from "./stats.js";
import { renderPick } from "./pick.js";
import { renderBacktest } from "./backtest.js";
import { renderHelp } from "./help.js";

const TABS = ["開獎", "統計", "選號", "回測", "說明"];
const ui = { game: GAMES["今彩539"], tab: "開獎" };
try { const g = localStorage.getItem("lotto.game"); if (GAMES[g]) ui.game = GAMES[g]; } catch {}

const view = document.getElementById("view");
// 手機版:任何表格寬度超過畫面時,在表格自己的容器內橫向捲動,不撐開整個頁面。
const wrapTables = () => view.querySelectorAll("table:not(.wrapped)").forEach(t => {
  if (t.parentElement.classList.contains("table-wrap")) { t.classList.add("wrapped"); return; }
  const w = h("div", { class: "table-wrap" });
  t.classList.add("wrapped"); t.replaceWith(w); w.append(t);
});
new MutationObserver(wrapTables).observe(view, { childList: true, subtree: true });

function renderChrome() {
  document.getElementById("games").replaceChildren(...Object.values(GAMES).map(g =>
    h("button", { class: "chip" + (g === ui.game ? " on" : ""), onclick: () => { ui.game = g; try { localStorage.setItem("lotto.game", g.name); } catch {} render(); } }, g.name)));
  document.getElementById("tabs").replaceChildren(...TABS.map(t =>
    h("button", { class: "tab" + (t === ui.tab ? " on" : ""), onclick: () => { ui.tab = t; render(); } }, t)));
}

function placeholder(name, msg) {
  return h("div", { class: "card" }, h("h3", {}, name), h("p", {}, msg));
}

// 快速切換遊戲/分頁時,較慢的舊載入不可蓋掉新畫面:每次 render 給分頁一個「只有自己仍是最新一次才會寫入畫面」的 root。
// (分頁內部的重畫與延遲刷新也走同一個 root,切走之後就不會再改到畫面。)
let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  const live = () => seq === renderSeq;
  const root = { replaceChildren: (...nodes) => { if (live()) view.replaceChildren(...nodes); } };
  renderChrome();
  try {
    if (ui.tab === "開獎") await renderDraws(root, ui.game, ui);
    else if (ui.tab === "統計") await renderStats(root, ui.game, ui);
    else if (ui.tab === "選號") await renderPick(root, ui.game, ui);
    else if (ui.tab === "回測") await renderBacktest(root, ui.game, ui);
    else if (ui.tab === "說明") renderHelp(root);
  } catch (e) {
    if (!live()) return;
    view.replaceChildren(placeholder("發生錯誤", e.message));
    toast(e.message, true);
  }
}
render();
