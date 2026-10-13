// 「開獎」分頁:近 N 期列表、手動輸入、CSV 匯入、本機資料匯出入。
import { h, toast, download } from "./dom.js";
import { getDraws, addToLocal, exportLocal, clearLocal, loadLocal } from "../data/store.js";
import { parseCsv, checkContinuity } from "../engine/draws.js";
import { fetchLatest } from "../data/official.js";

const COUNTS = [5, 10, 20, 50];
const MAX_RANGE = 500;
const fmt = n => String(n).padStart(2, "0");
const money = n => (n == null ? "-" : Number(n).toLocaleString("en-US"));

export async function renderDraws(root, game, ui) {
  const { draws, localPeriods } = await getDraws(game);
  const state = (ui.drawsState ??= { n: 10, extra: false, from: "", to: "" });
  const body = h("div", { class: "view" });
  root.replaceChildren(body);
  const refresh = () => renderDraws(root, game, ui);

  // ---- 近 N 期 ----
  const list = h("div");
  const rangeInfo = h("span", { class: "hint" });
  const drawList = () => {
    const idx = new Map(draws.map((d, i) => [d.period, i]));
    const ranged = state.from || state.to;
    const shown = ranged ? draws.filter(d => (!state.from || d.date >= state.from) && (!state.to || d.date <= state.to)) : draws;
    const rows = shown.slice(-(ranged ? MAX_RANGE : state.n)).reverse();
    rangeInfo.textContent = ranged ? `區間內 ${shown.length} 期` + (shown.length > MAX_RANGE ? `,僅顯示最近 ${MAX_RANGE} 期` : "") : "";
    list.replaceChildren(...rows.map(d => {
      const prev = draws[idx.get(d.period) - 1];
      const rep = new Set(prev ? prev.numbers : []);
      const balls = d.numbers.map(n => h("span", { class: "ball" + (rep.has(n) ? " rep" : "") }, fmt(n)));
      if (game.extra) balls.push(h("span", { class: "plus" }, "+"), h("span", { class: "ball sp", title: game.extra.label }, fmt(d.special)));
      return h("div", { class: "draw" },
        h("div", { class: "meta" }, h("b", {}, d.period), localPeriods.has(d.period) && h("span", { class: "tag" }, "本機"), h("div", {}, d.date)),
        h("div", { class: "balls" }, balls),
        state.extra && h("div", { class: "extra" }, `銷售額 ${money(d.sales)}　總獎金 ${money(d.prize)}`));
    }));
  };
  const chips = h("div", { class: "row" });
  const setN = n => { state.n = n; state.from = state.to = ""; drawChips(); drawList(); };
  const setRange = (k, v) => { state[k] = v; drawChips(); drawList(); };
  const drawChips = () => chips.replaceChildren(
    ...COUNTS.map(n => h("button", { class: "chip" + (state.n === n && !state.from && !state.to ? " on" : ""), onclick: () => setN(n) }, `${n} 期`)),
    h("input", { class: "input num", type: "number", min: 1, max: 500, placeholder: "自訂", onchange: e => { const v = Math.max(1, Math.min(500, Math.trunc(+e.target.value))); if (v) setN(v); } }),
    h("input", { class: "input", type: "date", value: state.from, "aria-label": "起日", onchange: e => setRange("from", e.target.value) }),
    h("span", {}, "~"),
    h("input", { class: "input", type: "date", value: state.to, "aria-label": "迄日", onchange: e => setRange("to", e.target.value) }),
    rangeInfo,
    h("button", { class: "chip mint" + (state.extra ? " on" : ""), onclick: () => { state.extra = !state.extra; drawChips(); drawList(); } }, "顯示銷售額/獎金"));
  drawChips(); drawList();
  const last = draws.at(-1);
  body.append(
    h("div", { class: "label" }, `${game.name} 近期開獎`),
    h("div", { class: "card" }, chips,
      h("div", { class: "hint" }, `共 ${draws.length} 期,最新:${last.period}(${last.date})。綠色號碼 = 與上一期重複` + (game.extra ? `;粉紅 = ${game.extra.label}。` : "。")),
      h("div", { style: "margin-top:12px" }, list)));

  // ---- 更新資料 ----
  const report = h("div");
  const showReport = (r, title) => {
    report.replaceChildren(h("div", { class: "report" },
      h("div", { class: "ok" }, `${title}:新增 ${r.added.length} 期,略過 ${r.skipped.length} 期(重複),失敗 ${r.failed.length} 筆`),
      ...r.failed.slice(0, 20).map(f => h("div", { class: "bad" }, `${f.period}:${f.reason}`)),
      r.failed.length > 20 && h("div", { class: "hint" }, `…另有 ${r.failed.length - 20} 筆`)));
    if (r.added.length) { toast(`新增 ${r.added.length} 期`); setTimeout(refresh, 1200); }
  };

  const syncBtn = h("button", { class: "btn yellow", onclick: async () => {
    syncBtn.disabled = true; syncBtn.textContent = "更新中…";
    try {
      const r = await fetchLatest(game, draws);
      const res = await addToLocal(game, r.draws);
      res.failed.push(...r.failed, ...r.conflicts.map(c => ({ period: c.period, reason: "官網資料與本地不同,已保留本地(請人工確認)" })));
      showReport(res, "官網更新");
      if (!res.added.length && !res.failed.length) toast("已是最新");
    } catch (err) { toast(`官網更新失敗:${err.message}(可改用手動輸入或匯入 CSV)`, true); }
    syncBtn.disabled = false; syncBtn.textContent = "從官網更新";
  } }, "從官網更新");
  const sync = game.source === "ca"
    ? h("div", { class: "card" }, h("h3", {}, "自動更新"),
      h("div", { class: "hint" }, "加州539 由 GitHub Actions 每天向加州彩券官網的開獎介面抓取後更新網站資料(官網擋台灣 IP,網頁本身無法直接抓)。急著補資料可用下方手動輸入或匯入 CSV。"))
    : h("div", { class: "card" }, h("h3", {}, "自動更新"),
      h("div", { class: "row" }, syncBtn),
      h("div", { class: "hint" }, "一鍵向台灣彩券官網抓取缺少的期數,存在這個瀏覽器(標示「本機」)。官網介面若改版會失敗,可改用下方手動輸入或匯入 CSV。"));

  const period = h("input", { class: "input", placeholder: game.periodPattern ? "20261013" : String(+last.period + 1) });
  const date = h("input", { class: "input", type: "date" });
  const numInputs = Array.from({ length: game.count }, (_, i) => h("input", { class: "input num", type: "number", min: game.min, max: game.max, placeholder: String(i + 1), "aria-label": `號碼${i + 1}` }));
  const spInput = game.extra && h("input", { class: "input num", type: "number", min: game.extra.min, max: game.extra.max, "aria-label": game.extra.label });
  const toNum = i => (i.value === "" ? NaN : +i.value);
  const manual = h("div", { class: "card" },
    h("h3", {}, "手動輸入一期"),
    h("div", { class: "grid2" },
      h("div", { class: "field" }, h("label", {}, game.periodHint ? `期別(${game.periodHint})` : "期別(9 位數)"), period),
      h("div", { class: "field" }, h("label", {}, "開獎日期"), date)),
    h("div", { class: "field" }, h("label", {}, `號碼(${game.count} 個,${game.min}-${game.max})`), h("div", { class: "row" }, numInputs)),
    game.extra && h("div", { class: "field" }, h("label", {}, `${game.extra.label}(${game.extra.min}-${game.extra.max})`), spInput),
    h("button", { class: "btn yellow", onclick: async () => {
      const d = { period: period.value.trim(), date: date.value, numbers: numInputs.map(toNum) };
      if (game.extra) d.special = toNum(spInput);
      showReport(await addToLocal(game, [d]), "手動輸入");
    } }, "新增"),
    h("div", { class: "hint" }, "手動輸入的資料只存在這個瀏覽器,不會寫回網站;可在下方匯出備份。"));

  const fileIn = h("input", { type: "file", accept: ".csv,text/csv", multiple: true, style: "display:none", onchange: async e => {
    const total = { added: [], skipped: [], failed: [] };
    for (const file of e.target.files) {
      const { draws: parsed, failed } = parseCsv(await file.text(), game);
      const r = await addToLocal(game, parsed);
      total.added.push(...r.added); total.skipped.push(...r.skipped);
      total.failed.push(...failed.map(x => ({ ...x, reason: `${file.name}:${x.reason}` })), ...r.failed);
    }
    e.target.value = "";
    showReport(total, "CSV 匯入");
  } });
  const jsonIn = h("input", { type: "file", accept: ".json,application/json", style: "display:none", onchange: async e => {
    try {
      const obj = JSON.parse(await e.target.files[0].text());
      if (obj.game !== game.name || !Array.isArray(obj.draws)) throw new Error(`不是 ${game.name} 的備份檔`);
      showReport(await addToLocal(game, obj.draws), "還原備份");
    } catch (err) { toast(err.message, true); }
    e.target.value = "";
  } });
  const nLocal = loadLocal(game).length;
  const io = h("div", { class: "card" },
    h("h3", {}, "匯入 / 備份"),
    h("div", { class: "row" },
      h("button", { class: "btn mint", onclick: () => fileIn.click() }, "匯入官方 CSV"),
      h("button", { class: "btn", onclick: () => jsonIn.click() }, "還原本機備份"),
      h("button", { class: "btn", onclick: () => (nLocal ? download(`${game.name}-本機資料.json`, exportLocal(game)) : toast("目前沒有本機資料", true)) }, `匯出本機資料(${nLocal})`),
      nLocal > 0 && h("button", { class: "btn pink sm", onclick: () => { if (confirm("清除這個遊戲的本機資料?(會先保留一份備份)")) { clearLocal(game); refresh(); } } }, "清除本機資料")),
    fileIn, jsonIn,
    h("div", { class: "hint" }, (game.source === "ca" ? "CSV 欄位須含:期別(開獎日期 YYYYMMDD)、開獎日期、獎號1~獎號5。" : "官方 CSV 下載:台灣彩券官網「歷史開獎號碼下載」。") + "匯入時以期別去重,已存在的期別會略過。"));

  const gaps = game.periodPattern ? [] : checkContinuity(draws);   // 加州539 以日期當期別,沒有連號可查
  const health = h("div", { class: "card white" }, h("h3", {}, "資料完整性"),
    game.periodPattern ? h("div", { class: "hint" }, "加州539 以開獎日期當期別,不做期別連號檢查;每天開獎,日期是否有缺漏可看「開獎」列表。")
    : gaps.length
      ? h("div", { class: "bad" }, `期別不連號,可能缺漏:${gaps.slice(0, 10).join("、")}${gaps.length > 10 ? ` …共 ${gaps.length} 處` : ""}`)
      : h("div", {}, "期別連號,無缺漏。"));

  body.append(h("div", { class: "label mint" }, "更新資料"), sync, manual, io, report, health);
}
