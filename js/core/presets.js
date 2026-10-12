// 由 tools/preset_search.mjs 產生,請勿手改(重新產生:node tools/preset_search.mjs)。
// 選法:前半段歷史挑訓練表現最好的組合,後半段歷史重新驗證。diff = 平均命中 − 隨機理論值(單位:個/期)。
// 結論多半是「測試段回到 0 附近」:挑出來的最佳組合,事後表現通常不會延續。
export const PRESETS = {
 "今彩539": [
  {
   "name": "最多次×5",
   "items": [
    {
     "source": "most_drawn",
     "count": 5
    }
   ],
   "train": {
    "tests": 2980,
    "mean": 0.6607,
    "diff": 0.0197,
    "p": 0.128,
    "anyPrizeRate": 0.1206
   },
   "test": {
    "tests": 2980,
    "mean": 0.6399,
    "diff": -0.0011,
    "p": 0.933,
    "anyPrizeRate": 0.1097
   }
  },
  {
   "name": "上期重號×1 + 近10期熱號×4",
   "items": [
    {
     "source": "last_repeat",
     "count": 1
    },
    {
     "source": "hot_n",
     "count": 4,
     "n": 10
    }
   ],
   "train": {
    "tests": 2980,
    "mean": 0.6601,
    "diff": 0.019,
    "p": 0.142,
    "anyPrizeRate": 0.1181
   },
   "test": {
    "tests": 2980,
    "mean": 0.6634,
    "diff": 0.0224,
    "p": 0.085,
    "anyPrizeRate": 0.1237
   }
  },
  {
   "name": "上期重號×2 + 近10期熱號×3",
   "items": [
    {
     "source": "last_repeat",
     "count": 2
    },
    {
     "source": "hot_n",
     "count": 3,
     "n": 10
    }
   ],
   "train": {
    "tests": 2980,
    "mean": 0.6589,
    "diff": 0.0179,
    "p": 0.183,
    "anyPrizeRate": 0.1201
   },
   "test": {
    "tests": 2980,
    "mean": 0.6599,
    "diff": 0.0189,
    "p": 0.186,
    "anyPrizeRate": 0.1233
   }
  },
  {
   "name": "近10期熱號×5",
   "items": [
    {
     "source": "hot_n",
     "count": 5,
     "n": 10
    }
   ],
   "train": {
    "tests": 2980,
    "mean": 0.6582,
    "diff": 0.0172,
    "p": 0.204,
    "anyPrizeRate": 0.1188
   },
   "test": {
    "tests": 2980,
    "mean": 0.6554,
    "diff": 0.0143,
    "p": 0.281,
    "anyPrizeRate": 0.1195
   }
  }
 ],
 "大樂透": [
  {
   "name": "連莊×4 + 遺漏比值×2",
   "items": [
    {
     "source": "current_streak",
     "count": 4
    },
    {
     "source": "gap_ratio",
     "count": 2
    }
   ],
   "train": {
    "tests": 1073,
    "mean": 0.7703,
    "diff": 0.0356,
    "p": 0.18,
    "anyPrizeRate": 0.0382
   },
   "test": {
    "tests": 1074,
    "mean": 0.7826,
    "diff": 0.0479,
    "p": 0.042,
    "anyPrizeRate": 0.0345
   }
  },
  {
   "name": "上期重號×4 + 遺漏比值×2",
   "items": [
    {
     "source": "last_repeat",
     "count": 4
    },
    {
     "source": "gap_ratio",
     "count": 2
    }
   ],
   "train": {
    "tests": 1073,
    "mean": 0.7647,
    "diff": 0.03,
    "p": 0.216,
    "anyPrizeRate": 0.0368
   },
   "test": {
    "tests": 1074,
    "mean": 0.7784,
    "diff": 0.0437,
    "p": 0.06,
    "anyPrizeRate": 0.0326
   }
  },
  {
   "name": "最少次×4 + 遺漏比值×2",
   "items": [
    {
     "source": "least_drawn",
     "count": 4
    },
    {
     "source": "gap_ratio",
     "count": 2
    }
   ],
   "train": {
    "tests": 1073,
    "mean": 0.7642,
    "diff": 0.0295,
    "p": 0.204,
    "anyPrizeRate": 0.0405
   },
   "test": {
    "tests": 1074,
    "mean": 0.7765,
    "diff": 0.0418,
    "p": 0.077,
    "anyPrizeRate": 0.0377
   }
  },
  {
   "name": "連莊×1 + 最多次×5",
   "items": [
    {
     "source": "current_streak",
     "count": 1
    },
    {
     "source": "most_drawn",
     "count": 5
    }
   ],
   "train": {
    "tests": 1073,
    "mean": 0.7633,
    "diff": 0.0286,
    "p": 0.279,
    "anyPrizeRate": 0.0354
   },
   "test": {
    "tests": 1074,
    "mean": 0.7747,
    "diff": 0.04,
    "p": 0.097,
    "anyPrizeRate": 0.0335
   }
  }
 ],
 "威力彩": [
  {
   "name": "遺漏比值×4 + 近10期熱號×2",
   "items": [
    {
     "source": "gap_ratio",
     "count": 4
    },
    {
     "source": "hot_n",
     "count": 2,
     "n": 10
    }
   ],
   "train": {
    "tests": 961,
    "mean": 0.9953,
    "diff": 0.0479,
    "p": 0.078,
    "anyPrizeRate": 0.1233
   },
   "test": {
    "tests": 962,
    "mean": 0.9439,
    "diff": -0.0035,
    "p": 0.847,
    "anyPrizeRate": 0.1123
   }
  },
  {
   "name": "遺漏比值×4 + 遺漏最久×2",
   "items": [
    {
     "source": "gap_ratio",
     "count": 4
    },
    {
     "source": "longest_gap",
     "count": 2
    }
   ],
   "train": {
    "tests": 961,
    "mean": 0.9927,
    "diff": 0.0453,
    "p": 0.091,
    "anyPrizeRate": 0.1243
   },
   "test": {
    "tests": 962,
    "mean": 0.9402,
    "diff": -0.0071,
    "p": 0.794,
    "anyPrizeRate": 0.1154
   }
  },
  {
   "name": "近10期熱號×2 + 遺漏比值×4",
   "items": [
    {
     "source": "hot_n",
     "count": 2,
     "n": 10
    },
    {
     "source": "gap_ratio",
     "count": 4
    }
   ],
   "train": {
    "tests": 961,
    "mean": 0.9906,
    "diff": 0.0433,
    "p": 0.116,
    "anyPrizeRate": 0.1228
   },
   "test": {
    "tests": 962,
    "mean": 0.9371,
    "diff": -0.0103,
    "p": 0.702,
    "anyPrizeRate": 0.1138
   }
  },
  {
   "name": "遺漏比值×5 + 遺漏最久×1",
   "items": [
    {
     "source": "gap_ratio",
     "count": 5
    },
    {
     "source": "longest_gap",
     "count": 1
    }
   ],
   "train": {
    "tests": 961,
    "mean": 0.9891,
    "diff": 0.0417,
    "p": 0.123,
    "anyPrizeRate": 0.1254
   },
   "test": {
    "tests": 962,
    "mean": 0.948,
    "diff": 0.0007,
    "p": 0.907,
    "anyPrizeRate": 0.1143
   }
  }
 ]
};
