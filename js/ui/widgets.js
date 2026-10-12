// 統計/選號共用的小元件。
import { h } from "./dom.js";

export const fmt = n => String(n).padStart(2, "0");
export const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";
export const ball = (n, cls = "") => h("span", { class: "ball " + cls }, fmt(n));

export function bar(ratio, max = 1) {
  return h("span", { class: "bar" }, h("i", { style: `width:${Math.max(0, Math.min(100, (ratio / max) * 100)).toFixed(1)}%` }));
}

// 可點欄位標題排序的表格。cols: {key, label, fmt?, bar?}
export function sortableTable(cols, rows, sortKey, desc = true) {
  const wrap = h("div", { class: "table-wrap" });
  const state = { key: sortKey, desc };
  const draw = () => {
    const sorted = [...rows].sort((a, b) => {
      const x = a[state.key] ?? -Infinity, y = b[state.key] ?? -Infinity;
      return (state.desc ? y - x : x - y) || a.number - b.number;
    });
    wrap.replaceChildren(h("table", { class: "tbl" },
      h("thead", {}, h("tr", {}, cols.map(c => h("th", { onclick: () => { state.desc = state.key === c.key ? !state.desc : true; state.key = c.key; draw(); } },
        c.label, state.key === c.key ? (state.desc ? " ▼" : " ▲") : "")))),
      h("tbody", {}, sorted.map(r => h("tr", {}, cols.map(c => h("td", {}, c.render ? c.render(r) : c.fmt ? c.fmt(r[c.key]) : r[c.key] ?? "-")))))));
  };
  draw();
  return wrap;
}

