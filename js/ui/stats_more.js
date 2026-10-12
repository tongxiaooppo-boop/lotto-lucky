// 統計分頁的其餘區塊(S7、S9、S10、S13~S16、S18~S20)。回傳要附加的卡片陣列。
import { h } from "./dom.js";
import * as M from "../engine/stats/more.js";
import { hypergeom } from "../engine/stats/index.js";
import { pct, ball, bar } from "./widgets.js";

export const MORE_SECTIONS = ["冷熱", "隔期", "鄰連號", "區段", "尾數", "跨度", "配對", "重現", "星期月份", "銷售", "拖牌", "型態"];

const distTable = (head, rows, label, extra) => h("table", { class: "tbl" },
  h("thead", {}, h("tr", {}, [head, "期數", "比例", ...(extra ? [extra.head] : [])].map(t => h("th", {}, t)))),
  h("tbody", {}, rows.map(r => h("tr", {}, h("td", {}, label(r)), h("td", {}, r.count), h("td", {}, pct(r.ratio), bar(r.ratio)), ...(extra ? [h("td", {}, extra.cell(r))] : [])))));

// 冷熱 z-score:|z| > 1 才算熱/冷(擷取自 808888 的 hotCold)。
function zCard(card, game, mainSer, n) {
  const rows = M.hotColdZ(mainSer, game.min, game.max, game.count, n);
  const hot = rows.filter(r => r.tag === "hot"), cold = rows.filter(r => r.tag === "cold");
  const group = (rs, cls) => h("div", { class: "balls" }, rs.length ? rs.map(r => h("span", { class: "pickball" }, ball(r.number, cls), h("small", {}, `z=${r.z.toFixed(1)}`))) : "沒有");
  return card("冷熱 z-score", h("div", { class: "hint" }, `近 ${Math.min(n, mainSer.length)} 期,每號碼期望 ${rows[0].expected.toFixed(1)} 次。z = (次數 − 期望) ÷ 標準差,|z| > 1 才算顯著偏熱/偏冷;完全隨機時也會有約三成的號碼落在這個範圍,所以多半只是波動。`),
    h("div", { class: "field" }, h("label", {}, `偏熱(${hot.length})`), group(hot, "rep")),
    h("div", { class: "field" }, h("label", {}, `偏冷(${cold.length})`), group(cold, "sp")));
}

export function renderMore(section, { game, draws, mainSer, sc, rerender, card }) {
  const range = game.max - game.min + 1;
  if (section === "冷熱") {
    const nIn = h("input", { class: "input num", type: "number", min: 3, value: sc.heatN ?? 30, onchange: e => { sc.heatN = Math.max(3, Math.trunc(+e.target.value) || 30); rerender(); } });
    const g = M.heatGroups(mainSer, game.min, game.max, sc.heatN ?? 30);
    const grp = (title, rows, cls) => h("div", { class: "field" }, h("label", {}, `${title}(${rows.length} 個)`),
      h("div", { class: "balls" }, rows.map(r => h("span", { class: "pickball" }, ball(r.number, cls), h("small", {}, `${r.count} 次`)))));
    return [card("冷熱分群(S7)", h("div", { class: "row" }, "依近", nIn, "期次數分三組"), grp("熱號", g.hot, "rep"), grp("溫號", g.warm, ""), grp("冷號", g.cold, "sp"),
      h("div", { class: "hint" }, "依次數排名各分三分之一,只是描述近期分布,不代表接下來的走勢。")),
      zCard(card, game, mainSer, sc.heatN ?? 30)];
  }
  if (section === "隔期") {
    return [card("隔期號(S9)", h("div", { class: "hint" }, "與前 2、3 期重複的個數分布(隔 1 期即「重號」)。理論值為完全隨機時的機率。"),
      ...[2, 3].map(lag => h("div", { class: "field" }, h("label", {}, `與前 ${lag} 期重複`),
        distTable("重複個數", M.lagRepeatDistribution(mainSer, game.count, lag), r => r.k, { head: "理論", cell: r => pct(hypergeom(r.k, game.count, range)) }))))];
  }
  if (section === "鄰連號") {
    const n = M.neighborStats(mainSer, game.count);
    return [
      card("連號(S10)", h("div", { class: "hint" }, "一期內「相鄰兩號」(如 07、08)的組數分布。"), distTable("連號組數", n.consecutive, r => r.k)),
      card("鄰號(S10)", h("div", { class: "hint" }, "一期中有幾個號碼是上一期號碼的前後號(±1)。"), distTable("鄰號個數", n.neighbor, r => r.k))];
  }
  if (section === "區段") {
    const s = M.sectionStats(mainSer, game.min, game.max, 4);
    return [
      card("區段分布(S13)", h("div", { class: "hint" }, "號碼範圍切成 4 段,平均每期開出幾個。期望值 = 每期號碼數 × 該段佔比。"),
        h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ["區段", "總次數", "平均/期", "期望/期"].map(t => h("th", {}, t)))),
          h("tbody", {}, s.segments.map(x => h("tr", {}, h("td", {}, `${x.from}-${x.to}`), h("td", {}, x.total), h("td", {}, x.avgPerDraw.toFixed(2), bar(x.avgPerDraw, game.count / 2)), h("td", {}, x.expected.toFixed(2))))))),
      card("最常見的區段組合", h("div", { class: "hint" }, "例如「1-2-1-1」= 四段各開出 1、2、1、1 個。"),
        distTable("組合", s.patterns.slice(0, 10), r => r.pattern))];
  }
  if (section === "尾數") {
    const t = M.tailStats(mainSer);
    return [
      card("尾數分布(S14)", h("div", { class: "hint" }, "個位數 0-9 的出現次數。"), h("table", { class: "tbl" },
        h("thead", {}, h("tr", {}, ["尾數", "次數", "比例"].map(x => h("th", {}, x)))),
        h("tbody", {}, t.tails.map(r => h("tr", {}, h("td", {}, r.tail), h("td", {}, r.count), h("td", {}, pct(r.ratio), bar(r.ratio, 0.15))))))),
      card("同尾數組數(S14)", h("div", { class: "hint" }, "一期內有幾組號碼的尾數相同(如 13、23 同尾 3)。"), distTable("同尾數組數", t.sameTail, r => r.k))];
  }
  if (section === "跨度") {
    const sp = M.spanStats(mainSer);
    const maxC = Math.max(...sp.bins.map(b => b.count));
    return [card("跨度與平均間距(S15)", h("div", { class: "row" }, [`平均跨度 ${sp.mean.toFixed(1)}`, `平均間距 ${sp.avgGap.toFixed(1)}`, `80% 落在 ${sp.p10} ~ ${sp.p90}`].map(t => h("span", {}, t))),
      h("div", { class: "hint" }, "跨度 = 最大號 − 最小號;平均間距 = 跨度 ÷ (號碼數 − 1)。"),
      h("table", { class: "tbl", style: "margin-top:10px" }, h("thead", {}, h("tr", {}, ["跨度", "期數", "比例"].map(t => h("th", {}, t)))),
        h("tbody", {}, sp.bins.map(b => h("tr", {}, h("td", {}, `${b.from}-${b.to}`), h("td", {}, b.count), h("td", {}, pct(b.count / sp.n), bar(b.count, maxC)))))))];
  }
  if (section === "配對") {
    const p = M.pairStats(mainSer, game.min, game.max);
    const size = game.max - game.min + 1;
    const cells = [];
    for (let a = 0; a < size; a++) for (let b = 0; b < size; b++) {
      const v = p.matrix[a][b];
      cells.push(h("i", { class: "hm" + (a === b ? " diag" : ""), title: a === b ? "" : `${a + game.min} & ${b + game.min}:${v} 次`, style: a === b ? "" : `opacity:${(0.12 + 0.88 * (p.maxCount ? v / p.maxCount : 0)).toFixed(2)}` }));
    }
    const list = rows => h("div", { class: "row" }, rows.map(r => h("span", { class: "row", style: "gap:3px" }, ball(r.a), ball(r.b), `×${r.count}`)));
    return [
      card("配對熱力圖(S16)", h("div", { class: "hint" }, `顏色越深 = 同期出現越多次。長按/滑過格子可看次數。完全隨機時每對平均約 ${p.expected.toFixed(1)} 次。`),
        h("div", { class: "heat", style: `grid-template-columns: repeat(${size}, 1fr)` }, cells)),
      card("最常同期出現的配對", list(p.top)),
      card(p.never.length ? `從未同期出現的配對(${p.never.length} 組)` : "最少同期出現的配對", list(p.never.length ? p.never.slice(0, 20) : p.bottom),
        p.never.length > 20 && h("div", { class: "hint" }, `只列前 20 組。`))];
  }
  if (section === "重現") {
    const c = M.comboRepeats(draws);
    const inputs = Array.from({ length: game.count }, (_, i) => h("input", { class: "input num", type: "number", min: game.min, max: game.max, placeholder: String(i + 1) }));
    const out = h("div", { class: "report" }, "輸入一組號碼可查詢歷史(僅限目前統計範圍)");
    return [
      card("組合重現檢查(S18)", h("div", {}, `範圍內 ${c.total} 期,不同組合 ${c.unique} 種。`, c.dups.length ? h("b", { class: "bad" }, ` 有 ${c.dups.length} 組重複出現`) : h("b", { class: "ok" }, " 沒有任何組合重複出現")),
        ...c.dups.slice(0, 10).map(d => h("div", { class: "hint" }, `${d.combo}:${d.periods.join("、")}`)),
        h("div", { class: "row", style: "margin-top:10px" }, inputs, h("button", { class: "btn sm yellow", onclick: () => {
          const nums = inputs.map(i => +i.value);
          if (nums.some(v => !Number.isInteger(v) || v < game.min || v > game.max) || new Set(nums).size !== game.count) { out.textContent = `請輸入 ${game.count} 個不重複、${game.min}-${game.max} 的號碼`; return; }
          const hit = c.has(nums);
          out.textContent = hit.length ? `這組號碼曾在 ${hit.join("、")} 開出` : "此範圍內沒有開出過這組號碼";
        } }, "查詢")), out)];
  }
  if (section === "星期月份") {
    const mk = (title, groupOf, label) => card(title, h("table", { class: "tbl" },
      h("thead", {}, h("tr", {}, ["分組", "期數", "出現最多(頻率)", "出現最少"].map(t => h("th", {}, t)))),
      h("tbody", {}, M.groupBias(draws, game.min, game.max, groupOf).map(g => h("tr", {}, h("td", {}, label(g.key)), h("td", {}, g.draws),
        h("td", {}, g.top.map(r => `${String(r.number).padStart(2, "0")}(${pct(r.freq, 0)})`).join(" ")),
        h("td", {}, g.bottom.map(r => `${String(r.number).padStart(2, "0")}(${pct(r.freq, 0)})`).join(" ")))))),
      h("div", { class: "hint" }, "每個分組期數有限,頻率差異多半是隨機波動;理論期望頻率約 " + pct(game.count / (game.max - game.min + 1), 0) + "。"));
    return [mk("依開獎星期(S19)", M.weekdayOf, k => "日一二三四五六"[k] ? `週${"日一二三四五六"[k]}` : k), mk("依開獎月份(S19)", M.monthOf, k => `${k} 月`)];
  }
  if (section === "銷售") {
    const t = M.salesTrend(draws);
    const maxS = Math.max(...t.rows.map(r => r.avgSales), 1);
    return [
      card("銷售額與獎金趨勢(S20)", h("div", { class: "hint" }, "依年份的平均每期銷售額與總獎金(目前統計範圍;手動補登的期數沒有銷售資料,不計入)。官方資料沒有「頭獎累積期數」,所以看不到累積期的銷量變化,只能看每期總獎金高低。"),
        t.rows.length ? h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ["年", "期數", "平均銷售額", "平均總獎金"].map(x => h("th", {}, x)))),
          h("tbody", {}, t.rows.map(r => h("tr", {}, h("td", {}, r.year), h("td", {}, r.draws), h("td", {}, Math.round(r.avgSales).toLocaleString(), bar(r.avgSales, maxS)), h("td", {}, Math.round(r.avgPrize).toLocaleString()))))) : "此範圍沒有銷售資料"),
      card("單期銷售額最高的 10 期", h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ["期別", "日期", "銷售額", "總獎金"].map(x => h("th", {}, x)))),
        h("tbody", {}, t.top.map(d => h("tr", {}, h("td", {}, d.period), h("td", {}, d.date), h("td", {}, d.sales.toLocaleString()), h("td", {}, (d.prize ?? 0).toLocaleString()))))))];
  }
  if (section === "拖牌") {
    const sel = h("select", { class: "input sel", onchange: e => { sc.dragA = +e.target.value; rerender(); } },
      Array.from({ length: game.max - game.min + 1 }, (_, i) => game.min + i).map(v => h("option", { value: v, selected: (sc.dragA ?? game.min) === v }, String(v).padStart(2, "0"))));
    const r = M.dragFor(mainSer, game.min, game.max, sc.dragA ?? game.min, game.count, 8);
    return [card("拖牌(跨期轉移)", h("div", { class: "hint" }, "號碼 a 在某一期開出後,下一期哪些號碼跟著開出。lift = 條件機率 ÷ 隨機期望,接近 1 代表兩者無關。多看幾個 a 就會發現 lift 都在 1 附近上下波動,這正是「沒有預測力」的樣子。"),
      h("div", { class: "row" }, "號碼 a:", sel, h("span", {}, `開出過 ${r.aCount} 次,隨機期望 ${pct(r.expectedRate)}`)),
      h("table", { class: "tbl", style: "margin-top:10px" }, h("thead", {}, h("tr", {}, ["下一期出現", "次數", "條件機率", "lift"].map(t => h("th", {}, t)))),
        h("tbody", {}, r.top.map(x => h("tr", {}, h("td", {}, ball(x.b)), h("td", {}, x.count), h("td", {}, pct(x.rate), bar(x.rate, r.expectedRate * 1.6)), h("td", {}, x.lift.toFixed(2)))))))];
  }
  if (section === "型態") {
    const pf = M.patternFeatures(mainSer);
    return [
      card("AC 值(算術複雜度)", h("div", { class: "hint" }, "AC = 號碼兩兩差值的「不同值個數」−(號碼數 − 1)。越大代表號碼間距越不規律;全部等差的組合 AC 最小。"), distTable("AC 值", pf.ac, r => r.k)),
      card("質數個數", h("div", { class: "hint" }, "一期開出幾個質數(1 不算)。"), distTable("質數個數", pf.primes, r => r.k))];
  }
  return [card("未知區塊", section)];
}
