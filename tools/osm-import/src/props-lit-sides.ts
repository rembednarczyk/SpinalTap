/**
 * Which side of a car street the `lit` rule's lamps stand on, and whether on both (G-804, T-297).
 * A line of lamps on one side stands left of its direction (`props-gen`), and the rule's lines are
 * the OSM ways, so the side was the direction the way happened to be drawn in: Peowiaków's lamps
 * crossed from the plan's north kerb to the south one, and Narutowicza, lit from both kerbs every
 * 34 m (orthophoto 2025-04), had them on one.
 *
 * - Both sides: a street whose sidewalks the map tags on both sides and draws apart by
 *   `WIDE_SPAN` or more (`Kerbs`), a carriageway of some 10 m between them, as the main streets.
 * - One side, in turn: the side the plan's line taken over there lit (`yieldToRule`), or the rule's
 *   own first pass on the way; the only side the tags give a sidewalk; else by the compass, the
 *   left of the way run eastwards (northwards across), so a street split into ways keeps one side.
 */
import type { Pt } from "./geometry.ts";
import type { Tags } from "./osm.ts";

/** How far a lit way's separately mapped sidewalks lie off its axis, left and right of its drawing direction (m, median), null where none runs along it. */
export interface Kerbs {
  readonly left: number | null;
  readonly right: number | null;
}

/**
 * How far apart a street's sidewalks lie for lamps on both its sides (m, axis to axis): a
 * carriageway of 10 m and 2 m from each kerb to its sidewalk's axis. Narutowicza's lie 17 m apart,
 * Peowiaków's 9 m.
 */
export const WIDE_SPAN = 14;
/** How far off a way its sidewalks are looked for (m), the step along it (m), and how parallel they run (cosine). */
const REACH = 20;
const STEP = 5;
const PARALLEL = 0.85;
/** The share of the stations a sidewalk is found at to count. */
const FOUND = 0.5;

const median = (v: readonly number[]): number => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;

/** The way's points every `STEP` metres, each with its unit direction. */
const stationsOf = (pts: readonly Pt[]): { p: Pt; u: Pt }[] => {
  const out: { p: Pt; u: Pt }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1]!, pts[i]!];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len === 0) continue;
    const u = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
    for (let s = 0; s < len; s += STEP) out.push({ p: { x: a.x + u.x * s, z: a.z + u.z * s }, u });
  }
  return out;
};

/** The sidewalks' segments on a grid of `REACH` cells. */
export class SidewalkIndex {
  private readonly cells = new Map<string, [Pt, Pt][]>();

  constructor(sidewalks: readonly (readonly Pt[])[]) {
    for (const l of sidewalks)
      for (let i = 1; i < l.length; i++) {
        const [a, b] = [l[i - 1]!, l[i]!];
        for (let x = Math.floor(Math.min(a.x, b.x) / REACH); x <= Math.floor(Math.max(a.x, b.x) / REACH); x++)
          for (let z = Math.floor(Math.min(a.z, b.z) / REACH); z <= Math.floor(Math.max(a.z, b.z) / REACH); z++) {
            const k = `${x},${z}`;
            const list = this.cells.get(k);
            if (list) list.push([a, b]);
            else this.cells.set(k, [[a, b]]);
          }
      }
  }

  near(p: Pt): [Pt, Pt][] {
    const out = new Set<[Pt, Pt]>();
    for (let x = Math.floor(p.x / REACH) - 1; x <= Math.floor(p.x / REACH) + 1; x++)
      for (let z = Math.floor(p.z / REACH) - 1; z <= Math.floor(p.z / REACH) + 1; z++) for (const s of this.cells.get(`${x},${z}`) ?? []) out.add(s);
    return [...out];
  }
}

/** A way's `Kerbs`: across it every `STEP` metres, the nearest sidewalk running along it on each side, within `REACH`. */
export const kerbsOf = (pts: readonly Pt[], sidewalks: SidewalkIndex): Kerbs => {
  const sts = stationsOf(pts);
  const [left, right]: [number[], number[]] = [[], []];
  for (const { p, u } of sts) {
    const n = { x: -u.z, z: u.x };
    let [l, r] = [Infinity, Infinity];
    for (const [a, b] of sidewalks.near(p)) {
      const [sx, sz] = [b.x - a.x, b.z - a.z];
      const len = Math.hypot(sx, sz);
      if (len === 0 || Math.abs((sx * u.x + sz * u.z) / len) < PARALLEL) continue;
      // Where the normal through p crosses the segment: t along the normal, v along the segment.
      const den = n.x * sz - n.z * sx;
      const t = ((a.x - p.x) * sz - (a.z - p.z) * sx) / den;
      const v = ((a.x - p.x) * n.z - (a.z - p.z) * n.x) / den;
      if (v < 0 || v > 1) continue;
      if (t > 0) l = Math.min(l, t);
      else r = Math.min(r, -t);
    }
    if (l <= REACH) left.push(l);
    if (r <= REACH) right.push(r);
  }
  const side = (v: number[]) => (sts.length > 0 && v.length >= sts.length * FOUND ? Math.round(median(v) * 10) / 10 : null);
  return { left: side(left), right: side(right) };
};

const HAS = new Set(["yes", "separate", "both"]);

/** The sides the tags give a sidewalk, left and right of the drawing direction. */
const tagged = (t: Tags): { left: boolean; right: boolean } => {
  const all = t.sidewalk ?? t["sidewalk:both"];
  if (all !== undefined && HAS.has(all)) return { left: true, right: true };
  if (all === "left" || all === "right") return { left: all === "left", right: all === "right" };
  return { left: HAS.has(t["sidewalk:left"] ?? ""), right: HAS.has(t["sidewalk:right"] ?? "") };
};

/** Whether a street's lamps stand on both its sides: sidewalks tagged on both, drawn `WIDE_SPAN` or more apart. */
export const bothSides = (tags: Tags, kerbs: Kerbs | undefined): boolean => {
  const t = tagged(tags);
  return t.left && t.right && kerbs?.left != null && kerbs.right != null && kerbs.left + kerbs.right >= WIDE_SPAN;
};

const reversed = (run: readonly Pt[]): Pt[] => [...run].reverse();

/** How many of a stretch's stations a line must run along to say its side: 10 m, past a crossing street's line. */
const ALONG = 2;

/** The stations of `run` the lines `ref` run along within `near`, less those they run against. */
const alongness = (run: readonly Pt[], ref: readonly (readonly Pt[])[], near: number): number => {
  let sum = 0;
  for (const { p, u } of stationsOf(run))
    for (const l of ref)
      for (let i = 1; i < l.length; i++) {
        const [a, b] = [l[i - 1]!, l[i]!];
        const [dx, dz] = [b.x - a.x, b.z - a.z];
        const len2 = dx * dx + dz * dz;
        if (len2 === 0) continue;
        const k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
        const cos = (dx * u.x + dz * u.z) / Math.sqrt(len2);
        if (Math.abs(cos) >= PARALLEL && Math.hypot(p.x - a.x - dx * k, p.z - a.z - dz * k) <= near) sum += Math.sign(cos);
      }
  return sum;
};

/**
 * A stretch of a way turned so the side its lamps stand on is its left (`props-gen`): by the lines
 * `ref` along it (the plan's taken over, the rule's first pass), by the one side the way's tags give a
 * sidewalk, else the left of the stretch run eastwards, or northwards when it runs due north or south.
 */
export const facing = (run: readonly Pt[], tags: Tags, ref: readonly (readonly Pt[])[], near: number): Pt[] => {
  const by = alongness(run, ref, near);
  if (Math.abs(by) >= ALONG) return by > 0 ? [...run] : reversed(run);
  const t = tagged(tags);
  if (t.left !== t.right) return t.left ? [...run] : reversed(run);
  const [a, b] = [run[0]!, run[run.length - 1]!];
  return b.x > a.x || (b.x === a.x && b.z > a.z) ? [...run] : reversed(run);
};
