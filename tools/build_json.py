import csv, json, glob, os, sys
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.join(BASE, "history")
GAMES = {"今彩539": ("539", 5, None), "大樂透": ("lotto649", 6, "特別號"), "威力彩": ("superlotto638", 6, "第二區"), "加州539": ("ca539", 5, None)}
for game, (key, n, extra) in GAMES.items():
    files = glob.glob(os.path.join(ROOT, "**", game + "_*.csv"), recursive=True)
    rows = {}
    # history/api(官網介面抓取)與 history/manual(人工補登)先處理,官方 CSV 後處理而覆蓋同期別
    pre = lambda f: os.path.basename(os.path.dirname(f)) in ("api", "manual")
    for f in sorted(files, key=lambda f: (not pre(f), f)):
        with open(f, encoding="utf-8-sig", newline="") as fh:
            r = csv.reader(fh)
            hdr = [h.strip() for h in next(r)]
            for line in r:
                if not line or not line[0].strip():
                    continue
                d = dict(zip(hdr, [c.strip() for c in line]))
                nums = [int(d["獎號%d" % i]) for i in range(1, n + 1)]
                rec = {"period": d["期別"], "date": d["開獎日期"].replace("/", "-"),
                       "numbers": nums}
                for k, h in (("sales", "銷售總額"), ("bets", "銷售注數"), ("prize", "總獎金")):
                    if d.get(h):  # 補登資料(history/manual)沒有銷售欄位
                        rec[k] = int(d[h])
                if extra:
                    rec["special"] = int(d[extra])
                y, m, dd = rec["date"].split("-")
                rec["date"] = "%s-%02d-%02d" % (y, int(m), int(dd))
                rows[rec["period"]] = rec
    out = sorted(rows.values(), key=lambda x: x["date"] + x["period"])
    p = os.path.join(BASE, "data", game + ".json")
    with open(p, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    print(game, len(files), "files", len(out), "draws", out[0]["date"], "~", out[-1]["date"])
