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

function renderChrome() {
  document.getElementById("games").replaceChildren(...Object.values(GAMES).map(g =>
    h("button", { class: "chip" + (g === ui.game ? " on" : ""), onclick: () => { ui.game = g; try { localStorage.setItem("lotto.game", g.name); } catch {} render(); } }, g.name)));
  document.getElementById("tabs").replaceChildren(...TABS.map(t =>
    h("button", { class: "tab" + (t === ui.tab ? " on" : ""), onclick: () => { ui.tab = t; render(); } }, t)));
}

function placeholder(name, msg) {
  return h("div", { class: "card" }, h("h3", {}, name), h("p", {}, msg));
}

async function render() {
  renderChrome();
  try {
    if (ui.tab === "開獎") await renderDraws(view, ui.game, ui);
    else if (ui.tab === "統計") await renderStats(view, ui.game, ui);
    else if (ui.tab === "選號") await renderPick(view, ui.game, ui);
    else if (ui.tab === "回測") await renderBacktest(view, ui.game, ui);
    else if (ui.tab === "說明") renderHelp(view);
  } catch (e) {
    view.replaceChildren(placeholder("發生錯誤", e.message));
    toast(e.message, true);
  }
}
render();
