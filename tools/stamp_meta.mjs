// 記錄每個遊戲「資料實際更新」的時間到 data/meta.json(網頁用台灣時間顯示)。
// 只在該遊戲的 data/*.json 有變動時才更新時間,所以沒有新資料時 meta.json 不會變、也不會多一個 commit。
// 沒有紀錄的遊戲,用該檔最後一次 commit 的時間補上。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { GAMES } from "../js/core/games.js";

const metaPath = new URL("../data/meta.json", import.meta.url);
const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf-8")) : {};
const git = (...args) => execFileSync("git", args, { encoding: "utf-8", cwd: new URL("..", import.meta.url) }).trim();
const before = JSON.stringify(meta);

for (const name of Object.keys(GAMES)) {
  const file = `data/${name}.json`;
  const dirty = git("status", "--porcelain", "--", file) !== "";
  if (dirty) meta[name] = { updatedAt: new Date().toISOString() };
  else if (!meta[name]) meta[name] = { updatedAt: git("log", "-1", "--format=%cI", "--", file) };
}

if (JSON.stringify(meta) !== before) {
  writeFileSync(metaPath, JSON.stringify(meta, null, 1) + "\n");
  console.log("data/meta.json 已更新", meta);
} else console.log("data/meta.json 無變動");
