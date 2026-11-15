/**
 * Where a carriageway's lanes lie across its way (G-825). OSM draws a way along the middle of its
 * carriageway unless `placement` says otherwise: `left_of:N` on the left edge of lane N (counted
 * from the left in the way's direction), `right_of:N` on its right edge, `middle_of:N` along its
 * middle; `transition` changes along the way and is read as the middle. Lwowska's `left_of:3` of
 * three lanes has two lanes left of its line and one right of it, and the import laid them
 * evenly, 1.6 m short of the west kerb.
 *
 * Where a one-way street splits or joins at a node with its links or its own next way (the turn
 * lanes going off on a way of their own), their lanes are one cross section there: those going
 * left lie left, those going right lie right, each as wide as its lanes, from the left edge of the
 * single way when the lanes add up (`lanes` 5 into 3 and 2), and on the edge of the way going
 * straight on when they do not: a link's lane going off begins beside it, its middle on the edge,
 * and one merging into it ends inside it, its outer edge on the edge (G-825 r2). The way going
 * straight on keeps its place there while the others run beside it, then ramps back to its own
 * axis at `LANE_RAMP`; the others keep beside the way they leave or join as long as their axes
 * run nearer to it than their place (`beside`), swinging in to the node over its last
 * `NODE_TAPER` m. Al. Solidarności's three through lanes after the two turning left are the right
 * three of five, and the link from Andersa begins beside Andersa's lanes, not over them.
 *
 * Sources (ADR-0080 decision 2): a way whose width the orthophoto measured (`ORTHO_OFFSETS`) keeps
 * its measured axis, the measure being taken off the map's axis; the measure reads no station near
 * a junction (`JUNCTION_GAP`), so the lanes' places at a node apply to it as to any way.
 */
import { type Line } from "./features.ts";
import { type Pt, lineLength, offsetPoints, pointAlong } from "./geometry.ts";
import { type Tags } from "./osm.ts";
import { ROAD_WIDTH, roadWidth } from "./street-section.ts";

/** How fast a carriageway moves aside towards its own axis (m aside per m along), as the ADR's ramp between stations. */
export const LANE_RAMP = 0.1;
/** Ways meeting a node at more than this to the single way (cos 60°) turn there: no split of its lanes. */
const SPLIT_COS = 0.5;
/** The densest a moved stretch is laid (m): the offset follows the separation from the way beside. */
const STEP = 2;
/**
 * The stretch a way beside another swings in over to end on their node (m): its band's end stays
 * round there with theirs (ADR-0078), and the joint's patches close the bend as before (G-760).
 */
const NODE_TAPER = 4;
/** How far a ramped way's moved end laps back over the way it goes on from (m). */
const LAP = 1;
/** Offsets under this are none (m). */
const NONE = 0.05;

const PLACEMENT = /^(left_of|right_of|middle_of):(\d+)$/;

const laneCount = (t: Tags): number => {
  const n = Math.round(Number(t.lanes));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Metres the carriageway's middle lies left of its way by `placement` (OSM), 0 without one, for `transition` or a lane it does not have. */
export const placementOffset = (t: Tags): number => {
  const m = PLACEMENT.exec(t.placement ?? "");
  const lanes = laneCount(t);
  if (!m || lanes === 0) return 0;
  const n = Number(m[2]);
  // The line's place from the left edge, in lanes.
  const at = m[1] === "left_of" ? n - 1 : m[1] === "right_of" ? n : n - 0.5;
  if (n < 1 || at > lanes) return 0;
  return Math.round((at - lanes / 2) * (roadWidth(t) / lanes) * 100) / 100;
};

/**
 * How a way's carriageway lies at one of its ends: `centre` m left of the node, kept there `hold` m
 * and ramped back to its own axis, or kept beside `along`.
 */
export type EndPlace = { readonly kind: "ramp"; readonly centre: number; readonly hold?: number } | { readonly kind: "beside"; readonly centre: number; readonly along: readonly (readonly Pt[])[] };

export interface LanePlaces {
  readonly start?: EndPlace;
  readonly end?: EndPlace;
}

interface Arm {
  readonly l: Line;
  /** Leaving the node (its start, or a node it runs through) or arriving at it. */
  readonly out: boolean;
  readonly lanes: number;
  /** Its carriageway's middle left of its line by `placement`. */
  readonly own: number;
  /** Its lanes' width. */
  readonly w: number;
  /** Where its stretch by the node lies, unit, from the node: ahead when leaving, behind when arriving. */
  readonly dir: Pt;
  readonly end: "start" | "end" | "through";
}

const SPLITS = (t: Tags): boolean =>
  ROAD_WIDTH[t.highway ?? ""] !== undefined && t.highway !== "service" && t.area !== "yes" && (t.oneway === "yes" || t.oneway === "1") && laneCount(t) > 0 && (t.bridge === undefined || t.bridge === "no") && (t.tunnel === undefined || t.tunnel === "no");

const unit = (a: Pt, b: Pt): Pt => {
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
};

/** The arms of a way at its point `i`: leaving at its start, arriving at its end, both where it runs through. */
const armsAt = (l: Line, i: number, own: (l: Line, i: number) => number): Arm[] => {
  const t = l.tags;
  const base = { l, lanes: laneCount(t), own: own(l, i), w: roadWidth(t) / laneCount(t) };
  const n = l.line.length;
  const p = l.line[i]!;
  const out: Arm[] = [];
  if (i < n - 1) out.push({ ...base, out: true, dir: unit(p, pointAlong(l.line.slice(i), 5)), end: i === 0 ? "start" : "through" });
  if (i > 0) out.push({ ...base, out: false, dir: unit(p, pointAlong(l.line.slice(0, i + 1).reverse(), 5)), end: i === n - 1 ? "end" : "through" });
  return out;
};

/**
 * The places of the ways' carriageways at the nodes where one one-way carriageway splits into
 * several or several join into one (`own`: a way's middle left of its line at its point `i`,
 * `placementOffset` or the measured offset there, `orthoOffsetAt`), by way: the single way's
 * street going on and its links (`*_link`). A node where any other carriageway (not `service`)
 * meets them, or where a way turns off at over 60°, is a junction, not a split: none.
 */
export const lanePlaces = (lines: readonly Line[], own: (l: Line, i: number) => number): Map<string, LanePlaces> => {
  const at = new Map<string, { l: Line; i: number }[]>();
  for (const l of lines) {
    if (ROAD_WIDTH[l.tags.highway ?? ""] === undefined || l.tags.highway === "service" || l.tags.area === "yes") continue;
    l.line.forEach((p, i) => {
      const k = `${p.x},${p.z}`;
      const list = at.get(k) ?? [];
      list.push({ l, i });
      at.set(k, list);
    });
  }
  const out = new Map<string, LanePlaces>();
  const put = (a: Arm, place: EndPlace) => {
    if (a.end === "through") return;
    out.set(a.l.id, { ...out.get(a.l.id), [a.end]: place });
  };
  for (const ways of at.values()) {
    if (ways.length < 2 || !ways.every(({ l }) => SPLITS(l.tags))) continue;
    const arms = ways.flatMap(({ l, i }) => armsAt(l, i, own));
    const [ins, outs] = [arms.filter((a) => !a.out), arms.filter((a) => a.out)];
    const [single, many] = ins.length === 1 && outs.length >= 2 ? [ins[0]!, outs] : outs.length === 1 && ins.length >= 2 ? [outs[0]!, ins] : [null, []];
    // The street going on and its links: a street of another name meeting it there turns into it,
    // as the one-way pair of a T junction's corner.
    if (!single || !many.every((a) => a.l.tags.highway!.endsWith("_link") || (a.l.tags.name !== undefined && a.l.tags.name === single.l.tags.name))) continue;
    // The single way's direction of travel at the node, and each other's side of it and turn off it.
    const ahead = single.out ? single.dir : { x: -single.dir.x, z: -single.dir.z };
    const lateral = (a: Arm) => ahead.x * a.dir.z - ahead.z * a.dir.x;
    const along = (a: Arm) => (ahead.x * a.dir.x + ahead.z * a.dir.z) * (a.out ? 1 : -1);
    if (many.some((a) => along(a) < SPLIT_COS)) continue;
    const sorted = [...many].sort((a, b) => lateral(b) - lateral(a));
    const through = sorted.reduce((best, a) => (Math.abs(lateral(a)) < Math.abs(lateral(best)) ? a : best));
    const centres = new Map<Arm, number>();
    const total = sorted.reduce((n, a) => n + a.lanes, 0);
    let hold = 0;
    if (total === single.lanes) {
      // The single way's lanes shared out from its left edge. The way going straight on is laid
      // halfway between its lanes' place and its own line: the map's node of a split lies on the
      // single way's line, which mappers draw along its middle or along the lanes going straight
      // on (Al. Solidarności's w762599273 2 m off its middle at the node, G-825 r2). It keeps the
      // place while the lanes turning off run within the single way's width of it, then ramps.
      let edge = single.own + (single.lanes * single.w) / 2;
      hold = sharedLength(through, sorted.filter((a) => a !== through), single.lanes * single.w);
      for (const a of sorted) {
        const c = edge - (a.lanes * single.w) / 2;
        centres.set(a, a === through ? (c + a.own) / 2 : c);
        edge -= a.lanes * single.w;
      }
    } else if (total > single.lanes) {
      // Lanes beginning at the node (a link going off) lie beside the way going straight on, their
      // middle on its edge, the deceleration lane's wedge; lanes ending there (a link joining) have
      // tapered to nothing: inside it, their outer edge on its edge, as the merge's wedge closes on
      // the kerb (G-825 r2).
      const k = sorted.indexOf(through);
      const inward = single.out ? 1 : 0;
      centres.set(through, through.own);
      let edge = through.own + (through.lanes * through.w) / 2;
      for (const a of sorted.slice(0, k).reverse()) {
        centres.set(a, edge - (inward * a.lanes * a.w) / 2);
        edge += (1 - 2 * inward) * a.lanes * a.w;
      }
      edge = through.own - (through.lanes * through.w) / 2;
      for (const a of sorted.slice(k + 1)) {
        centres.set(a, edge + (inward * a.lanes * a.w) / 2);
        edge -= (1 - 2 * inward) * a.lanes * a.w;
      }
    } else continue;
    for (const [a, c] of centres) {
      if (a === through) {
        if (Math.abs(c - a.own) >= NONE) put(a, { kind: "ramp", centre: c, ...(hold > 0 ? { hold } : {}) });
      } else if (Math.abs(c) >= NONE) put(a, { kind: "beside", centre: c, along: [single.l.line, through.l.line] });
    }
  }
  return out;
};

const distanceTo = (p: Pt, line: readonly Pt[]): number => {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i]!, line[i + 1]!];
    const [dx, dz] = [b.x - a.x, b.z - a.z];
    const l2 = dx * dx + dz * dz;
    const k = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0;
    best = Math.min(best, Math.hypot(a.x + dx * k - p.x, a.z + dz * k - p.z));
  }
  return best;
};

/**
 * How far from the node way `a` runs with one of `others` within `reach` m of its line (m, by
 * `STEP`): the lanes of a split keep one cross section, and their places, as long (Al. Solidarności's
 * through lanes 14 m past the node, G-825 r2).
 */
const sharedLength = (a: Arm, others: readonly Arm[], reach: number): number => {
  const line = a.end === "end" ? [...a.l.line].reverse() : a.l.line;
  const length = lineLength(line);
  let s = 0;
  while (s + STEP <= length && others.some((o) => distanceTo(pointAlong(line, s + STEP), o.l.line) < reach)) s += STEP;
  return s;
};

/** The offset an end's place adds at `p`, `d` m from that end (`own`: the way's middle left of its line there). */
const endOffset = (place: EndPlace | undefined, own: number, p: Pt, d: number, clear: { reached: boolean }): number => {
  if (!place) return 0;
  if (place.kind === "ramp") return (place.centre - own) * Math.max(0, 1 - (Math.max(0, d - (place.hold ?? 0)) * LANE_RAMP) / Math.abs(place.centre - own));
  if (clear.reached) return 0;
  const gap = Math.abs(place.centre) - Math.min(...place.along.map((l) => distanceTo(p, l)));
  // Once clear of the way beside, it does not come back to it.
  if (gap <= 0) clear.reached = true;
  return Math.sign(place.centre) * Math.max(0, gap) * Math.min(1, d / NODE_TAPER);
};

/**
 * The carriageway's pieces of `l` (its line, or `fitLanes`' or `orthoPieces`' pieces of it, in
 * order) moved aside by `shift` m left of the map's line everywhere (its `placement`, when nothing
 * else moved it) and to its lanes' places at its ends (`places`), the moved stretches laid every
 * `STEP` m. The pieces as they are when nothing moves them.
 */
export const placedPieces = (l: Line, pieces: readonly Line[], shift: number, places: LanePlaces | undefined, own: number): Line[] => {
  if (Math.abs(shift) < NONE && !places) return [...pieces];
  const length = lineLength(l.line);
  const reach = (p: EndPlace | undefined) => (!p ? 0 : p.kind === "ramp" ? (p.hold ?? 0) + Math.abs(p.centre - own) / LANE_RAMP : length);
  const [fromStart, fromEnd] = [reach(places?.start), reach(places?.end)];
  const out: Line[] = [];
  let s0 = 0;
  // From each end's side: the `beside` rule walks out from the node, so the far end's samples are read backwards.
  const startClear = { reached: false };
  const endClear = { reached: false };
  const pts = pieces.map((piece) => {
    const at: { p: Pt; s: number }[] = [];
    const n = piece.line.length;
    for (let i = 0; i < n; i++) {
      const p = piece.line[i]!;
      at.push({ p, s: s0 });
      if (i + 1 < n) {
        const q = piece.line[i + 1]!;
        const seg = Math.hypot(q.x - p.x, q.z - p.z);
        const moved = (x: number) => x < fromStart || x > length - fromEnd;
        for (let k = 1; k * STEP < seg; k++) if (moved(s0 + k * STEP)) at.push({ p: { x: p.x + ((q.x - p.x) * k * STEP) / seg, z: p.z + ((q.z - p.z) * k * STEP) / seg }, s: s0 + k * STEP });
        s0 += seg;
      }
    }
    return { piece, at };
  });
  // A way ramped from its place at a node laps `LAP` m back over the way it goes on from: its end
  // is off the node and square, and the two bands' ends would meet at an angle and leave a crack.
  const lap = (a: Pt, b: Pt): Pt => {
    const u = unit(b, a);
    return { x: a.x + u.x * LAP, z: a.z + u.z * LAP };
  };
  const [first, last] = [pts[0]!.at, pts[pts.length - 1]!.at];
  if (places?.start?.kind === "ramp" && first.length >= 2) first.unshift({ p: lap(first[0]!.p, first[1]!.p), s: 0 });
  if (places?.end?.kind === "ramp" && last.length >= 2) last.push({ p: lap(last[last.length - 1]!.p, last[last.length - 2]!.p), s: length });
  const all = pts.flatMap((x) => x.at);
  const startAdds = all.map(({ p, s }) => endOffset(places?.start, own, p, s, startClear));
  const endAdds: number[] = [];
  for (let k = all.length - 1; k >= 0; k--) endAdds[k] = endOffset(places?.end, own, all[k]!.p, Math.max(0, length - all[k]!.s), endClear);
  let k = 0;
  for (const { piece, at } of pts) {
    const offsets = at.map(() => {
      const v = shift + startAdds[k]! + endAdds[k]!;
      k++;
      return Math.round(v * 100) / 100;
    });
    out.push({ ...piece, line: offsets.every((o) => o === 0) ? at.map((x) => x.p) : offsetPoints(at.map((x) => x.p), offsets) });
  }
  return out;
};
