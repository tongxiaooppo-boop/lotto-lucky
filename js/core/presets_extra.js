// 由 tools/preset_search_extra.mjs 產生,請勿手改(重新產生:node tools/preset_search_extra.mjs)。
// 特別號/第二區的回測組合。diff = 命中率 − 隨機理論命中率;訓練段是事後挑的,測試段才不偏樂觀,通常回到 0 附近。
export const EXTRA_PRESETS = {
 "大樂透": [
  {
   "name": "加權隨機(依頻率)×1",
   "source": "weighted_freq",
   "k": 1,
   "train": {
    "tests": 1073,
    "rate": 0.0211,
    "expected": 0.0204,
    "diff": 0.0007,
    "p": 0.522
   },
   "test": {
    "tests": 1074,
    "rate": 0.0251,
    "expected": 0.0204,
    "diff": 0.0047,
    "p": 0.553
   }
  },
  {
   "name": "最少次×1",
   "source": "least_drawn",
   "k": 1,
   "train": {
    "tests": 1073,
    "rate": 0.0208,
    "expected": 0.0204,
    "diff": 0.0004,
    "p": 0.402
   },
   "test": {
    "tests": 1074,
    "rate": 0.0189,
    "expected": 0.0204,
    "diff": -0.0015,
    "p": 0.742
   }
  },
  {
   "name": "遺漏最久×1",
   "source": "longest_gap",
   "k": 1,
   "train": {
    "tests": 1073,
    "rate": 0.0208,
    "expected": 0.0204,
    "diff": 0.0004,
    "p": 0.402
   },
   "test": {
    "tests": 1074,
    "rate": 0.0189,
    "expected": 0.0204,
    "diff": -0.0015,
    "p": 0.742
   }
  }
 ],
 "威力彩": [
  {
   "name": "近 N 期熱號(近10期)×2",
   "source": "hot_n",
   "k": 2,
   "n": 10,
   "train": {
    "tests": 961,
    "rate": 0.2771,
    "expected": 0.25,
    "diff": 0.0271,
    "p": 0.065
   },
   "test": {
    "tests": 962,
    "rate": 0.2526,
    "expected": 0.25,
    "diff": 0.0026,
    "p": 0.839
   }
  },
  {
   "name": "近 N 期熱號(近10期)×1",
   "source": "hot_n",
   "k": 1,
   "n": 10,
   "train": {
    "tests": 961,
    "rate": 0.1439,
    "expected": 0.125,
    "diff": 0.0189,
    "p": 0.205
   },
   "test": {
    "tests": 962,
    "rate": 0.131,
    "expected": 0.125,
    "diff": 0.006,
    "p": 0.586
   }
  },
  {
   "name": "鄰號(上期號碼前後)×1",
   "source": "neighbor",
   "k": 1,
   "train": {
    "tests": 961,
    "rate": 0.1401,
    "expected": 0.125,
    "diff": 0.0151,
    "p": 0.298
   },
   "test": {
    "tests": 962,
    "rate": 0.1147,
    "expected": 0.125,
    "diff": -0.0103,
    "p": 0.581
   }
  }
 ]
};
