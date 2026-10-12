// 儲存的配方(F4.8):存在瀏覽器本機,可匯出/匯入 JSON 分享。
const KEY = "lotto.recipes";
const safe = fn => { try { return fn(); } catch { return null; } };

export function loadRecipes() {
  const list = safe(() => JSON.parse(localStorage.getItem(KEY) || "[]"));
  return Array.isArray(list) ? list : [];
}

function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; }
}

// 配方格式見 PRD 第 6 節。同遊戲同名稱會覆蓋。
export function saveRecipe(recipe) {
  if (!recipe.name?.trim()) throw new Error("請輸入配方名稱");
  const list = loadRecipes().filter(r => !(r.game === recipe.game && r.name === recipe.name));
  list.push(recipe);
  if (!write(list)) throw new Error("瀏覽器儲存失敗");
}

export function deleteRecipe(game, name) {
  write(loadRecipes().filter(r => !(r.game === game && r.name === name)));
}

export const exportRecipes = () => JSON.stringify({ recipes: loadRecipes() }, null, 1);

// 匯入:格式不符的項目略過;回傳匯入筆數。
export function importRecipes(text) {
  const obj = JSON.parse(text);
  const incoming = (Array.isArray(obj) ? obj : obj.recipes ?? []).filter(r =>
    r && typeof r.name === "string" && typeof r.game === "string" && Array.isArray(r.items) &&
    r.items.every(i => typeof i.source === "string" && Number.isInteger(i.count) && i.count > 0));
  const list = loadRecipes();
  for (const r of incoming) {
    const i = list.findIndex(x => x.game === r.game && x.name === r.name);
    if (i >= 0) list[i] = r; else list.push(r);
  }
  if (!write(list)) throw new Error("瀏覽器儲存失敗");
  return incoming.length;
}
