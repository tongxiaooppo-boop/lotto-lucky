// 載入 data/*.json,並管理使用者本機資料(localStorage)。
import { mergeDraws } from "../engine/draws.js";

const KEY = g => `lotto.local.${g}`;
const safe = fn => { try { return fn(); } catch { return null; } };

const baseCache = {};
export async function loadBase(game) {
  if (!baseCache[game.name]) {
    const res = await fetch(`data/${encodeURIComponent(game.name)}.json`);
    if (!res.ok) throw new Error(`讀取 ${game.name} 資料失敗(${res.status})`);
    baseCache[game.name] = await res.json();
  }
  return baseCache[game.name];
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
export async function getDraws(game) {
  const base = await loadBase(game);
  const local = loadLocal(game);
  const { merged } = mergeDraws(game, base, local);
  const inBase = new Set(base.map(d => d.period));
  return { draws: merged, localPeriods: new Set(local.filter(d => !inBase.has(d.period)).map(d => d.period)) };
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

export function clearLocal(game) {
  const prev = safe(() => localStorage.getItem(KEY(game.name)));
  if (prev != null) safe(() => localStorage.setItem(KEY(game.name) + ".bak", prev));
  safe(() => localStorage.removeItem(KEY(game.name)));
}
