"""Long frames of a hitch report (render-loop callbacks over the threshold), each with what happened in it.
Usage: python3 -I tools/hitch-report/analyze.py <report.json> [threshold_ms] [--list]"""
import json
import sys
from bisect import bisect_left, bisect_right
from collections import defaultdict

r = json.load(open(sys.argv[1]))
thr = float(sys.argv[2]) if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else 50.0
listing = "--list" in sys.argv
marks = r["marks"]
ev = sorted(r["ev"], key=lambda e: e["t"])
ts = [e["t"] for e in ev]
mark_t = {n: t for t, n in marks}
play, newg, end = mark_t["playing"], mark_t["newGame"], mark_t["end"]
print("loadMs", r["loadMs"], "query", r["query"])


def phase(t):
    name = "pre"
    for mt, n in marks:
        if t >= mt:
            name = n
    return name


def window(a, b):
    i, j = bisect_left(ts, a), bisect_right(ts, b)
    agg, cnt, files, srcs = defaultdict(float), defaultdict(int), [], []
    for e in ev[i:j]:
        k = e["k"]
        if k in ("file", "fetch"):
            if k == "fetch":
                files.append((e["n"], e.get("b") or 0))
        elif k == "loaf":
            srcs.append("LoAF " + e["n"])
        elif k == "linkSrc":
            srcs.append(e["n"])
        elif k != "raf":
            agg[k] += e["d"]
            cnt[k] += 1
            if k == "buffer":
                agg["bufMB"] += (e.get("b") or 0) / 1e6
    return agg, cnt, files, srcs


def district(t):
    d = "-"
    for dt, n in r["districts"]:
        if dt <= t:
            d = n
    return d


def shader(agg):
    return agg["link"] + agg["programStatus"] + agg["compile"] + agg["shaderStatus"]


agg, cnt, files, srcs = window(newg, play)
print(f"loading screen {play - newg:.0f} ms: links {cnt['link']} shader {shader(agg):.0f} ms, tex {cnt['texture']} {agg['texture']:.0f} ms, buf {agg['bufMB']:.0f} MB, files {len(files)} {sum(b for _, b in files) / 1e6:.1f} MB")
rafs = [e for e in ev if e["k"] == "raf"]
loading_long = [e for e in rafs if newg <= e["t"] < play and e["d"] > thr]
print(f"  loading-screen callbacks >{thr}: {len(loading_long)}, sum {sum(e['d'] for e in loading_long):.0f} ms")
after = [e for e in rafs if play <= e["t"] <= end]
print(f"render callbacks after play {len(after)}")
agg, cnt, files, srcs = window(play, end)
print(f"after play: links {cnt['link']} ({shader(agg):.0f} ms), tex uploads {cnt['texture']} ({agg['texture']:.0f} ms), buffers {agg['bufMB']:.0f} MB ({agg['buffer']:.0f} ms), sync {agg['sync']:.0f} ms, files {len(files)} {sum(b for _, b in files) / 1e6:.1f} MB")
for s in (s for s in srcs if not s.startswith("LoAF")):
    print("   link", s[:260])
big = sorted(files, key=lambda f: -f[1])[:12]
for f, b in big:
    print(f"   file {b / 1e3:8.0f} kB {f}")
by_phase = defaultdict(lambda: [0, 0, 0.0])
longs = []
for e in after:
    p = phase(e["t"])
    by_phase[p][0] += 1
    if e["d"] > thr:
        by_phase[p][1] += 1
        by_phase[p][2] += e["d"]
        longs.append(e)
print(f"phase: callbacks, >{thr} ms, their sum")
for mt, n in marks:
    if n in by_phase:
        c, l, s = by_phase[n]
        print(f"  {n:14s} {c:5d} {l:4d} {s:8.0f}")
print(f"long callbacks: {len(longs)} (60 s from play: {sum(1 for e in longs if e['t'] < play + 60000)})")
causes = defaultdict(lambda: [0, 0.0])
for e in longs:
    a, b = e["t"], e["t"] + e["d"]
    agg, cnt, files, srcs = window(a, b)
    c = []
    if shader(agg) > 0.3 * e["d"]:
        key = "shader"
    elif agg["texture"] > 0.3 * e["d"]:
        key = "texture"
    elif agg["buffer"] > 0.3 * e["d"]:
        key = "buffer"
    elif agg["sync"] > 0.3 * e["d"]:
        key = "sync"
    elif agg["bufMB"] > 1:
        key = "geometry(js)"
    else:
        key = "js"
    causes[(phase(a), key)][0] += 1
    causes[(phase(a), key)][1] += e["d"]
    if listing:
        if shader(agg) > 1:
            c.append(f"shader {cnt['link']}L {shader(agg):.0f}ms")
        if agg["texture"] > 1:
            c.append(f"tex {cnt['texture']} {agg['texture']:.0f}ms")
        if agg["bufMB"] > 0.2:
            c.append(f"buf {agg['bufMB']:.1f}MB {agg['buffer']:.0f}ms")
        if agg["sync"] > 1:
            c.append(f"sync {agg['sync']:.0f}ms")
        if files:
            c.append("files " + ",".join(f.rsplit("/", 1)[-1] for f, _ in files))
        print(f"  {a - play:8.0f} {e['d']:6.0f}ms {phase(a):12s} {district(a):12s} {key:10s} | {'; '.join(c)}")
        for s in srcs:
            print("        link", s[:200])
print("by phase and cause: count, sum ms")
for (p, k), (n, s) in sorted(causes.items(), key=lambda x: mark_t.get(x[0][0], 0)):
    print(f"  {p:14s} {k:12s} {n:4d} {s:8.0f}")
