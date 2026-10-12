// 由 tools/strategy_rank.mjs 產生,請勿手改(重新產生:node tools/strategy_rank.mjs)。
// 一鍵策略的回測排名(由上而下)。diff = 平均命中 − 隨機理論值(個/期)。排名不代表更準,差距多半不顯著。
export const STRATEGY_RANK = {
 "今彩539": [
  {
   "id": "chase",
   "tests": 2000,
   "diff": 0.0147,
   "p": 0.401
  },
  {
   "id": "repeat_neighbor",
   "tests": 2000,
   "diff": 0.012,
   "p": 0.515
  },
  {
   "id": "avoid_popular",
   "tests": 2000,
   "diff": 0.005,
   "p": 0.763
  },
  {
   "id": "mix",
   "tests": 2000,
   "diff": 0.0035,
   "p": 0.827
  },
  {
   "id": "balanced",
   "tests": 2000,
   "diff": 0.0025,
   "p": 0.639
  },
  {
   "id": "pairing",
   "tests": 2000,
   "diff": -0.0015,
   "p": 0.593
  },
  {
   "id": "random",
   "tests": 2000,
   "diff": -0.004,
   "p": 0.691
  },
  {
   "id": "weighted_gap",
   "tests": 2000,
   "diff": -0.0068,
   "p": 0.669
  },
  {
   "id": "rebound",
   "tests": 2000,
   "diff": -0.0128,
   "p": 0.419
  },
  {
   "id": "weighted_freq",
   "tests": 2000,
   "diff": -0.0193,
   "p": 0.226
  }
 ],
 "大樂透": [
  {
   "id": "pairing",
   "tests": 2000,
   "diff": 0.0276,
   "p": 0.132
  },
  {
   "id": "repeat_neighbor",
   "tests": 2000,
   "diff": 0.0218,
   "p": 0.215
  },
  {
   "id": "weighted_gap",
   "tests": 2000,
   "diff": 0.0156,
   "p": 0.361
  },
  {
   "id": "avoid_popular",
   "tests": 2000,
   "diff": 0.0148,
   "p": 0.44
  },
  {
   "id": "weighted_freq",
   "tests": 2000,
   "diff": 0.0061,
   "p": 0.722
  },
  {
   "id": "rebound",
   "tests": 2000,
   "diff": -0.0012,
   "p": 0.944
  },
  {
   "id": "mix",
   "tests": 2000,
   "diff": -0.0014,
   "p": 0.371
  },
  {
   "id": "balanced",
   "tests": 2000,
   "diff": -0.0102,
   "p": 0.504
  },
  {
   "id": "chase",
   "tests": 2000,
   "diff": -0.0232,
   "p": 0.199
  },
  {
   "id": "random",
   "tests": 2000,
   "diff": -0.0289,
   "p": 0.141
  }
 ],
 "威力彩": [
  {
   "id": "rebound",
   "tests": 1923,
   "diff": 0.0115,
   "p": 0.542
  },
  {
   "id": "avoid_popular",
   "tests": 1923,
   "diff": 0.0066,
   "p": 0.527
  },
  {
   "id": "balanced",
   "tests": 1923,
   "diff": 0.0061,
   "p": 0.705
  },
  {
   "id": "mix",
   "tests": 1923,
   "diff": 0.0027,
   "p": 0.48
  },
  {
   "id": "weighted_gap",
   "tests": 1923,
   "diff": -0.0012,
   "p": 0.924
  },
  {
   "id": "repeat_neighbor",
   "tests": 1923,
   "diff": -0.0059,
   "p": 0.763
  },
  {
   "id": "random",
   "tests": 1923,
   "diff": -0.0087,
   "p": 0.674
  },
  {
   "id": "weighted_freq",
   "tests": 1923,
   "diff": -0.0108,
   "p": 0.512
  },
  {
   "id": "chase",
   "tests": 1923,
   "diff": -0.0199,
   "p": 0.295
  },
  {
   "id": "pairing",
   "tests": 1923,
   "diff": -0.0306,
   "p": 0.117
  }
 ]
};
