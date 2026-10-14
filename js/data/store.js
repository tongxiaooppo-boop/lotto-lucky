// 載入 data/*.json,並管理使用者本機資料(localStorage)。
import { mergeDraws } from "../engine/draws.js";

const KEY = g => `lotto.local.${g}`;
const safe = fn => { try { return fn(); } catch { return null; } };

const baseCache = {};
export async function loadBase(game) {
  if (!baseCache[game.name]) {
    // no-cache = 每次向伺服器確認是否有新版(沒變只回 304),避免顯示「已更新」但資料仍是瀏覽器快取的舊版
    const res = await fetch(`data/${encodeURIComponent(game.name)}.json`, { cache: "no-cache" });
    if (!res.ok) throw new Error(`讀取 ${game.name} 資料失敗(${res.status})`);
    baseCache[game.name] = await res.json();
  }
  return baseCache[game.name];
}

// 該遊戲資料最後一次實際更新的時間(台灣時間字串);讀不到回傳 null。
// meta.json 每次開網頁只讀一次(與 data/*.json 的快取一致),切換分頁不再重複連網。
let metaPromise = null;
const loadMeta = () => (metaPromise ??= fetch("data/meta.json", { cache: "no-cache" }).then(r => (r.ok ? r.json() : {})).catch(() => ({})));
export async function loadUpdatedAt(game) {
  try {
    const at = (await loadMeta())[game.name]?.updatedAt;
    if (!at) return null;
    return new Date(at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return null; }
}

export function loadLocal(game) {
  return safe(() => JSON.parse(localStorage.getItem(KEY(game.name)) || "[]")) || [];
}

// 寫入前先備份上一版(F1.5);失敗時不破壞既有資料。
export function saveLocal(game, draws) {
  const prev = safe(() => localStorage.getItem(KEY(game.name)));
  try {
    if (prev != null) localStorage.setItem(KEY(game.name) + ".bak", prev);
    localStorage.setItem(KEY(game.name), JSON.stringify(draws));
    return true;
  } catch {
    if (prev != null) safe(() => localStorage.setItem(KEY(game.name), prev));
    return false;
  }
}

// 回傳 { draws(新到舊合併後的升冪陣列), localPeriods:Set }
// 本機資料中已被網站資料收錄的期別(同期別以網站為準)會順手從本機移除,避免本機越積越多。
export async function getDraws(game) {
  const base = await loadBase(game);
  const inBase = new Set(base.map(d => d.period));
  let local = loadLocal(game);
  if (local.some(d => inBase.has(d.period))) {
    local = local.filter(d => !inBase.has(d.period));
    safe(() => localStorage.setItem(KEY(game.name), JSON.stringify(local)));   // 不動 .bak:「復原上一次變更」仍是使用者自己的上一次操作
  }
  const { merged } = mergeDraws(game, base, local);
  return { draws: merged, localPeriods: new Set(local.map(d => d.period)) };
}

// 把新資料併入「本機資料」(與官方資料重複的期別會略過)。
export async function addToLocal(game, incoming) {
  const base = await loadBase(game);
  const local = loadLocal(game);
  const { added, skipped, failed } = mergeDraws(game, [...base, ...local], incoming);
  if (added.length) {
    const next = mergeDraws(game, local, added).merged;
    if (!saveLocal(game, next)) return { added: [], skipped, failed: [...failed, { period: "-", reason: "瀏覽器儲存失敗,資料未變更" }] };
  }
  return { added, skipped, failed };
}

export function exportLocal(game) {
  return JSON.stringify({ game: game.name, draws: loadLocal(game) }, null, 1);
}

// 刪除本機資料中的單一期(例如手動輸入打錯期別)。
export function removeLocal(game, period) {
  return saveLocal(game, loadLocal(game).filter(d => d.period !== period));
}

// 上一次變更前的本機資料(每次寫入/清除前自動保留一份);沒有則回傳 null。
export function hasBackup(game) {
  return safe(() => localStorage.getItem(KEY(game.name) + ".bak")) != null;
}
// 復原上一次變更:把備份換回來(目前的資料變成備份,所以再按一次可以還原回來)。
export function restoreBackup(game) {
  const bak = safe(() => localStorage.getItem(KEY(game.name) + ".bak"));
  if (bak == null) return false;
  const list = safe(() => JSON.parse(bak));
  if (!Array.isArray(list)) return false;
  return saveLocal(game, list);
}

export function clearLocal(game) {
  const prev = safe(() => localStorage.getItem(KEY(game.name)));
  if (prev != null) safe(() => localStorage.setItem(KEY(game.name) + ".bak", prev));
  safe(() => localStorage.removeItem(KEY(game.name)));
}
