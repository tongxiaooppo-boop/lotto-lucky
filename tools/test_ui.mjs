// 網頁冒煙測試:用無頭 Chrome(DevTools 協定,不需要安裝任何套件)實際載入網站,逐一點過
// 四個遊戲 × 五個分頁、統計的每個區塊、選號與回測按鈕,確認沒有「發生錯誤」與任何 JS 例外。
// 也測:快速切換遊戲不會顯示錯的遊戲、本機資料的新增/刪除單期/復原上一次變更。
// 用法:node tools/test_ui.mjs(Chrome 路徑可用環境變數 CHROME_PATH 指定)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { GAMES } from "../js/core/games.js";

const ROOT = normalize(fileURLToPath(new URL("..", import.meta.url)));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- 靜態伺服器(加州539 的資料故意延遲,讓「快速切換」的競態每次都會發生) ----
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = normalize(join(ROOT, p));
  if (!f.startsWith(ROOT)) return res.writeHead(403).end();
  if (p.endsWith("加州539.json")) await sleep(600);
  try { const body = await readFile(f); res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" }).end(body); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

// ---- 啟動 Chrome ----
const chromePath = [process.env.CHROME_PATH, "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(p => p && existsSync(p));
if (!chromePath) { console.error("找不到 Chrome(可用 CHROME_PATH 指定)"); process.exit(1); }
const profile = mkdtempSync(join(tmpdir(), "lotto-ui-"));
const chrome = spawn(chromePath, ["--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run", "--no-default-browser-check", "--window-size=420,900",
  `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { stdio: "ignore" });
// Chrome 把實際使用的埠寫在 user-data-dir/DevToolsActivePort(Windows 不會印到 stderr)
let port = null;
for (let t0 = Date.now(); !port && Date.now() - t0 < 20000; await sleep(100)) {
  try { port = (await readFile(join(profile, "DevToolsActivePort"), "utf-8")).split("\n")[0].trim() || null; } catch {}
}
if (!port) { chrome.kill(); console.error("Chrome 啟動逾時"); process.exit(1); }
const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === "page");

// ---- DevTools 協定 ----
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0;
const pending = new Map(), errors = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); return; }
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console.error: " + m.params.args.map(a => a.value ?? a.description).join(" "));
  if (m.method === "Log.entryAdded" && m.params.entry.level === "error" && !/fonts\.(googleapis|gstatic)/.test(m.params.entry.url ?? "")) errors.push(`${m.params.entry.text} ${m.params.entry.url ?? ""}`);
};
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const ev = async expr => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const waitFor = async (expr, what, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await ev(expr)) return; await sleep(50); }
  throw new Error(`等待逾時:${what}`);
};
const js = v => JSON.stringify(v);
const click = (sel, text, prefix = false) => ev(`(() => { const b = [...document.querySelectorAll(${js(sel)})].find(b => ${prefix ? `b.textContent.trim().startsWith(${js(text)})` : `b.textContent.trim() === ${js(text)}`}); if (!b) return false; b.click(); return true; })()`);
const mustClick = async (sel, text, prefix) => { if (!(await click(sel, text, prefix))) throw new Error(`找不到按鈕:${text}`); };
const label = () => ev(`document.querySelector("#view .label")?.textContent ?? ""`);
const viewError = () => ev(`[...document.querySelectorAll("#view h3")].some(x => x.textContent === "發生錯誤" || x.textContent === "未知區塊")`);

let failures = 0;
const step = async (name, fn) => {
  const before = errors.length;
  try {
    await fn();
    if (await viewError()) throw new Error("畫面顯示「發生錯誤」:" + (await ev(`document.querySelector("#view p")?.textContent`)));
    if (errors.length > before) throw new Error(errors.slice(before).join("\n"));
    console.log(`  ok  ${name}`);
  } catch (e) { failures++; console.error(`  FAIL ${name}:${e.message}`); }
};

try {
  await send("Runtime.enable"); await send("Log.enable"); await send("Network.enable");
  await send("Network.setBlockedURLs", { urls: ["*fonts.googleapis.com*", "*fonts.gstatic.com*", "*taiwanlottery.com*"] });
  await send("Page.navigate", { url: base });
  await waitFor(`!!document.querySelector("#view .label")`, "首頁載入");
  await ev(`window.confirm = () => true`);

  const LABEL = { 開獎: g => `${g} 近期開獎`, 統計: g => `${g} 統計`, 選號: g => `${g} 選號`, 回測: g => `${g} 策略回測`, 說明: () => "說明" };
  const go = async (game, tab) => {
    await mustClick("#games .chip", game); await mustClick("#tabs .tab", tab);
    await waitFor(`document.querySelector("#view .label")?.textContent === ${js(LABEL[tab](game))}`, `${game}/${tab}`);
  };

  // 1. 快速切換:先點(延遲載入的)加州539,馬上再點大樂透 → 最後畫面必須是大樂透
  await step("快速切換遊戲不會顯示錯的遊戲", async () => {
    await ev(`(() => { const c = [...document.querySelectorAll("#games .chip")]; c.find(b => b.textContent === "加州539").click(); c.find(b => b.textContent === "大樂透").click(); })()`);
    await sleep(1500);
    const l = await label();
    if (l !== "大樂透 近期開獎") throw new Error(`畫面是「${l}」`);
  });

  // 2. 每個遊戲 × 每個分頁
  for (const game of Object.keys(GAMES)) {
    console.log(game);
    await step("開獎", () => go(game, "開獎"));
    await step("統計(所有區塊)", async () => {
      await go(game, "統計");
      const secs = await ev(`[...document.querySelectorAll("#view .chip.mint")].map(b => b.textContent)`);
      for (const s of secs) {
        await mustClick("#view .chip.mint", s);
        await waitFor(`document.querySelector("#view .chip.mint.on")?.textContent === ${js(s)}`, `區塊 ${s}`);
        if (GAMES[game].extra && await click("#view .chip.pink", GAMES[game].extra.label)) {
          await waitFor(`document.querySelector("#view .chip.pink.on")?.textContent === ${js(GAMES[game].extra.label)}`, `${s} 特別號`);
          await mustClick("#view .chip.pink", "主號");
          await waitFor(`document.querySelector("#view .chip.pink.on")?.textContent === "主號"`, `${s} 主號`);
        }
      }
    });
    await step("選號(依配方、純隨機)", async () => {
      await go(game, "選號");
      await mustClick("#view button", "依配方產生");
      await waitFor(`[...document.querySelectorAll("#view h3")].some(x => x.textContent.startsWith("結果"))`, "配方結果");
      await mustClick("#view button", "純隨機", true);
      await waitFor(`[...document.querySelectorAll("#view h3")].some(x => x.textContent === "結果:純隨機")`, "純隨機結果");
    });
    await step("回測(目前配方)", async () => {
      await go(game, "回測");
      await ev(`(() => { const s = document.querySelector("#view select"); s.value = "recipe"; s.dispatchEvent(new Event("change")); })()`);
      await mustClick("#view button", "回測這個策略");
      await waitFor(`[...document.querySelectorAll("#view h3")].some(x => x.textContent === "結果") || !!document.querySelector("#view .hint.bad")`, "回測結果", 60000);
      const bad = await ev(`document.querySelector("#view .hint.bad")?.textContent ?? ""`);
      if (bad) throw new Error(bad);
    });
    await step("說明", () => go(game, "說明"));
  }

  // 3. 本機資料:手動新增一期 → 刪除這一期 → 復原上一次變更
  await step("本機資料 新增/刪除/復原", async () => {
    await go("今彩539", "開獎");
    await ev(`(() => {
      const card = [...document.querySelectorAll("#view .card")].find(c => c.querySelector("h3")?.textContent === "手動輸入一期");
      const ins = card.querySelectorAll("input");
      ins[0].value = ins[0].placeholder; ins[1].value = "2099-12-31";
      [1, 2, 3, 4, 5].forEach((v, i) => { ins[2 + i].value = v; });
      [...card.querySelectorAll("button")].find(b => b.textContent === "新增").click();
    })()`);
    const tagged = `[...document.querySelectorAll("#view .draw .tag")].some(t => t.textContent === "本機")`;
    await waitFor(tagged, "新增後出現本機資料");
    await mustClick("#view .draw button", "刪除");
    await waitFor(`!${tagged}`, "刪除後本機資料消失");
    await mustClick("#view button", "復原上一次變更");
    await waitFor(tagged, "復原後本機資料回來");
    await ev(`localStorage.clear()`);
  });
} finally {
  ws.close(); chrome.kill(); server.close();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
console.log(failures ? `\n${failures} 項失敗` : "\n網頁冒煙測試全部通過");
process.exit(failures ? 1 : 0);
