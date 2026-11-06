/**
 * A street over a tunnel (G-088): the NMT is bare earth, the tunnel's structure left out, so a
 * street the map runs over a tunnel it does not join dips into the cut the tunnel runs in.
 * Zamkowa (w154962966) over the footway under it before the Castle (w66258159) fell 3.5 m and rose
 * again over 10 m. The street's stretch over the tunnel is a deck, as a bridge's (ADR-0053), from
 * the terrain `REACH` m either side of the crossing; the way under it keeps its headroom (G-062).
 * Only where the terrain dips: a tunnel deep under a level street (the Underground Route under
 * the Market Square) leaves the street as it is.
 */
import { type HeightSource } from "./dtm.ts";
import { type Line } from "./features.ts";
import { type Pt, lineLength, pointAlong, sliceLine } from "./geometry.ts";
import { type Tags } from "./osm.ts";

/** How far along the street either side of the crossing the deck reaches (m): past the cut's walls at Zamkowa. */
const REACH = 8;
/** How far the terrain may lie under the chord between the deck's ends and the street stay on it (m). */
const DIP = 1;
/** Samples along the deck's stretch (m). */
const STEP = 0.5;

const isTunnel = (t: Tags) => t.highway !== undefined && (t.tunnel === "yes" || t.tunnel === "culvert" || Number(t.layer ?? 0) < 0);
const onGround = (t: Tags) => t.highway !== undefined && t.area !== "yes" && (t.tunnel === undefined || t.tunnel === "no") && t.covered === undefined && Number(t.layer ?? 0) >= 0 && (t.bridge === undefined || t.bridge === "no");

/** The highways' tunnels among the map's lines. */
export const tunnelLines = (lines: readonly Line[]): Line[] => lines.filter((l) => isTunnel(l.tags));

const same = (p: Pt, q: Pt) => Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.z - q.z) < 1e-6;

/** Arc lengths along `line` where it crosses `other`, not at a vertex the two share (a node in common: the street leads into the tunnel). */
const crossings = (line: readonly Pt[], other: readonly Pt[]): number[] => {
  const out: number[] = [];
  let start = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i]!, line[i + 1]!];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    for (let j = 0; j + 1 < other.length; j++) {
      const [c, d] = [other[j]!, other[j + 1]!];
      const den = (b.x - a.x) * (d.z - c.z) - (b.z - a.z) * (d.x - c.x);
      if (Math.abs(den) < 1e-9) continue;
      const s = ((c.x - a.x) * (d.z - c.z) - (c.z - a.z) * (d.x - c.x)) / den;
      const u = ((c.x - a.x) * (b.z - a.z) - (c.z - a.z) * (b.x - a.x)) / den;
      if (s < 0 || s > 1 || u < 0 || u > 1) continue;
      const p = { x: a.x + (b.x - a.x) * s, z: a.z + (b.z - a.z) * s };
      if (line.some((q) => same(q, p)) && other.some((q) => same(q, p))) continue;
      out.push(start + len * s);
    }
    start += len;
  }
  return out;
};

/** Does the terrain between `from` and `to` along `line` lie more than `DIP` under the chord between its ends? */
const dips = (line: readonly Pt[], from: number, to: number, h: HeightSource): boolean => {
  const [y0, y1] = [h(pointAlong(line, from)), h(pointAlong(line, to))];
  for (let s = from; s <= to; s += STEP) if (y0 + ((y1 - y0) * (s - from)) / (to - from || 1) - h(pointAlong(line, s)) > DIP) return true;
  return false;
};

/**
 * The street `l` cut into its stretches on the terrain and its decks over the tunnels it dips
 * over, in order along it; a deck's stretch is a bridge's way to `lineBands`, its ends the deck's
 * abutments. A line on no tunnel comes back whole.
 */
export const overTunnels = (l: Line, tunnels: readonly Line[], h: HeightSource): Line[] => {
  if (!onGround(l.tags) || l.line.length < 2) return [l];
  const total = lineLength(l.line);
  const spans: [number, number][] = [];
  for (const s of tunnels.flatMap((t) => crossings(l.line, t.line)).sort((a, b) => a - b)) {
    const span: [number, number] = [Math.max(0, s - REACH), Math.min(total, s + REACH)];
    if (!dips(l.line, span[0], span[1], h)) continue;
    const last = spans[spans.length - 1];
    if (last && span[0] <= last[1]) last[1] = span[1];
    else spans.push(span);
  }
  if (spans.length === 0) return [l];
  const out: Line[] = [];
  let at = 0;
  for (const [a, b] of spans) {
    if (a > at) out.push({ ...l, line: sliceLine(l.line, at, a) });
    out.push({ ...l, tags: { ...l.tags, bridge: "yes" }, line: sliceLine(l.line, a, b) });
    at = b;
  }
  if (at < total) out.push({ ...l, line: sliceLine(l.line, at, total) });
  return out.filter((p) => p.line.length >= 2 && lineLength(p.line) > 0.05);
};
