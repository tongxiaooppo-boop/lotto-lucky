// 遊戲規格設定:引擎一律由此驅動,不寫死 539 的數字。
// extra.pickable:玩家投注時是否要自己選這個號碼(威力彩第二區要選;大樂透特別號是開獎附加號,不用選)。
export const GAMES = {
  "今彩539": { key: "539", name: "今彩539", count: 5, min: 1, max: 39, extra: null, price: 50, startDate: "2007-01-01", defaultScope: 300 },
  "大樂透": { key: "lotto649", name: "大樂透", count: 6, min: 1, max: 49, extra: { label: "特別號", min: 1, max: 49, distinct: true, pickable: false }, price: 50, startDate: "2007-01-01", defaultScope: 100 },
  "威力彩": { key: "superlotto638", name: "威力彩", count: 6, min: 1, max: 38, extra: { label: "第二區", min: 1, max: 8, distinct: false, pickable: true }, price: 100, startDate: "2008-01-24", defaultScope: 100 },
};
