"""What the CPU did in each long render callback of a hitch report.
Usage: python3 -I tools/hitch-report/profile.py <report.json> [threshold_ms] [from_mark]"""
import json
import sys
from bisect import bisect_left, bisect_right
from collections import Counter

rep = json.load(open(sys.argv[1]))
prof = json.load(open(sys.argv[1].replace(".json", ".cpuprofile")))
thr = float(sys.argv[2]) if len(sys.argv) > 2 else 50.0
from_mark = sys.argv[3] if len(sys.argv) > 3 else "playing"
nodes = {n["id"]: n for n in prof["nodes"]}
parent = {}
for n in prof["nodes"]:
    for c in n.get("children", []):
        parent[c] = n["id"]


def label(n):
    cf = n["callFrame"]
    name = cf["functionName"] or "(anon)"
    url = cf["url"].rsplit("/", 1)[-1]
    return f"{name}@{url}:{cf['lineNumber']}:{cf['columnNumber']}" if url else name


def stack(nid):
    out = []
    while nid in nodes:
        out.append(nid)
        nid = parent.get(nid)
        if nid is None:
            break
    return out


times = []
t = prof["startTime"]
for dt in prof["timeDeltas"]:
    t += dt
    times.append(t / 1000.0)
samples = prof["samples"]
sync_t = None
for i, s in enumerate(samples):
    if any(nodes[x]["callFrame"]["functionName"] == "hrSyncMarker" for x in stack(s)):
        sync_t = times[i]
        break
off = sync_t - rep["sync"]
print("offset", off)
marks = {n: t for t, n in rep["marks"]}
start = marks[from_mark]
SKIP = {"(root)", "(program)", "(idle)", "(garbage collector)"}
rafs = [e for e in rep["ev"] if e["k"] == "raf" and e["t"] >= start and e["d"] > thr]
for e in sorted(rafs, key=lambda e: e["t"]):
    a, b = e["t"] + off, e["t"] + e["d"] + off
    i, j = bisect_left(times, a), bisect_right(times, b)
    selfc, incl = Counter(), Counter()
    for k in range(i, j):
        st = stack(samples[k])
        selfc[label(nodes[st[0]])] += 1
        seen = set()
        for x in st:
            lb = label(nodes[x])
            if lb in seen or nodes[x]["callFrame"]["functionName"] in SKIP:
                continue
            seen.add(lb)
            incl[lb] += 1
    n = max(1, j - i)
    phase = max((t, nm) for nm, t in marks.items() if t <= e["t"])[1]
    print(f"\n{e['t'] - marks['playing']:8.0f} {e['d']:6.0f}ms {phase} samples {j - i}")
    print("   self: " + " | ".join(f"{k} {100 * v // n}%" for k, v in selfc.most_common(5)))
    # Inclusive: the deepest frames that still hold most of the time, skipping the loop's own.
    picks = [(k, v) for k, v in incl.most_common(40) if v < 0.97 * n][:12]
    print("   incl: " + " | ".join(f"{k} {100 * v // n}%" for k, v in picks))
