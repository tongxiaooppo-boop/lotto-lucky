// 遊戲規格設定:引擎一律由此驅動,不寫死 539 的數字。
// currency:金額顯示的幣別(預設 NT$)。periodPattern:期別格式(預設 9 位數);加州539 沒有可取得的完整官方期號,以開獎日期 YYYYMMDD 當期別。
// source:"ca" = 每日由 GitHub Actions 抓加州彩券官網介面(擋台灣 IP、也不允許瀏覽器跨網域),網頁不提供「從官網更新」。
// extra.pickable:玩家投注時是否要自己選這個號碼(威力彩第二區要選;大樂透特別號是開獎附加號,不用選)。
export const GAMES = {
  "今彩539": { key: "539", name: "今彩539", count: 5, min: 1, max: 39, extra: null, price: 50, startDate: "2007-01-01", defaultScope: 300 },
  "大樂透": { key: "lotto649", name: "大樂透", count: 6, min: 1, max: 49, extra: { label: "特別號", min: 1, max: 49, distinct: true, pickable: false }, price: 50, startDate: "2007-01-01", defaultScope: 100 },
  "威力彩": { key: "superlotto638", name: "威力彩", count: 6, min: 1, max: 38, extra: { label: "第二區", min: 1, max: 8, distinct: false, pickable: true }, price: 100, startDate: "2008-01-24", defaultScope: 100 },
  "加州539": { key: "ca539", name: "加州539", count: 5, min: 1, max: 39, extra: null, price: 1, currency: "US$", startDate: "2010-04-06", defaultScope: 300, periodPattern: "^\\d{8}$", periodHint: "開獎日期 YYYYMMDD(美國加州日期),例如 20261012", source: "ca" },
};
