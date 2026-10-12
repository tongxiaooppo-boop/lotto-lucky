// Web Worker:在背景執行回測,避免畫面卡住。訊息格式見 js/ui/backtest.js。
import { runJob } from "./job.js";

self.onmessage = e => {
  try {
    const result = runJob(e.data, p => self.postMessage({ type: "progress", p }));
    self.postMessage({ type: "done", result });
  } catch (err) {
    self.postMessage({ type: "error", message: err.message });
  }
};
