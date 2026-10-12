// 驗證 data/*.json:號碼數量、範圍、不重複、期別不重複、日期遞增。
import { readFileSync } from "node:fs";
import { GAMES } from "../js/core/games.js";

let bad = 0;
const fail = (g, msg) => { console.error(`[${g}] ${msg}`); bad++; };
for (const [name, spec] of Object.entries(GAMES)) {
  const draws = JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), "utf-8"));
  const seen = new Set();
  let prev = "";
  for (const d of draws) {
    const id = d.period;
    if (seen.has(id)) fail(name, `期別重複 ${id}`);
    seen.add(id);
    if (d.date < prev) fail(name, `日期未遞增 ${id} ${d.date}`);
    prev = d.date;
    const n = d.numbers;
    if (n.length !== spec.count) fail(name, `${id} 號碼數量 ${n.length}`);
    if (new Set(n).size !== n.length) fail(name, `${id} 號碼重複`);
    if (n.some(x => !Number.isInteger(x) || x < spec.min || x > spec.max)) fail(name, `${id} 號碼超出範圍`);
    if (spec.extra) {
      const s = d.special;
      if (!Number.isInteger(s) || s < spec.extra.min || s > spec.extra.max) fail(name, `${id} ${spec.extra.label}超出範圍`);
      else if (spec.extra.distinct && n.includes(s)) fail(name, `${id} ${spec.extra.label}與主號重複`);
    } else if ("special" in d) fail(name, `${id} 不應有 special`);
  }
  console.log(`${name}: ${draws.length} 期 OK ${draws[0].date} ~ ${draws.at(-1).date}`);
}
process.exit(bad ? 1 : 0);
