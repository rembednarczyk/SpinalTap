/**
 * Road markings (ADR-0052): the lines painted on Lublin's carriageways, from the roads' lanes,
 * direction and tags, the traffic lights and the cycle and bus lanes. Each marking is a world
 * polyline the renderer paints in its kind's dashes and colours. Lines stop where they run into
 * another carriageway (a junction) or a zebra, as the paint does.
 */
import { type RoadMarkingKind } from "../../../packages/core/src/world/city-geo.ts";
import { type Line } from "./features.ts";
import { type Pt, type Rect, clipLineToRect, lineLength, offsetLine, pointAlong, r1, simplifyLine, sliceLine } from "./geometry.ts";
import { roadWidth } from "./ground.ts";
import { type Tags } from "./osm.ts";

export interface MarkingOut {
  readonly kind: RoadMarkingKind;
  readonly line: readonly number[];
}

/** A marking before it is cut to a chunk. */
export interface Marking {
  readonly kind: RoadMarkingKind;
  readonly line: readonly Pt[];
  readonly source: string;
}

/** Roads that carry painted lanes (not the Old Town's setts, a service lane or a living street). */
const MARKED_ROADS = new Set(["primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link", "unclassified", "residential", "trunk", "trunk_link"]);
/** Main roads get an edge line along the kerb. */
const EDGED = new Set(["primary", "secondary", "trunk"]);
/** Width of a lane the generator assumes where the map does not say (m). */
const LANE = 3.25;
/** The edge line stands this far in from the kerb; a cycle or bus lane is this wide (m). */
const EDGE_IN = 0.35;
const SIDE_LANE = 1.5;
/** The stop line stands this far back from the traffic lights' node (m). */
const STOP_BACK = 4;
/** Pieces of a line shorter than this are dropped (m). */
const MIN_PIECE = 2;

const COBBLES = new Set(["sett", "cobblestone", "unhewn_cobblestone", "cobblestone:flattened"]);

export const oneway = (t: Tags): boolean => t.oneway === "yes" || t.oneway === "1" || t.oneway === "-1" || t.junction === "roundabout";

/** Lanes each way: [backward (left of the line's direction), forward (right)]. */
export const lanesOf = (t: Tags, width: number): [number, number] => {
  const total = Number(t.lanes);
  const n = Number.isFinite(total) && total > 0 ? Math.round(total) : Math.max(1, Math.round(width / LANE));
  if (oneway(t)) return [0, n];
  const fwd = Number(t["lanes:forward"]);
  const bwd = Number(t["lanes:backward"]);
  if (Number.isFinite(fwd) && Number.isFinite(bwd) && fwd > 0 && bwd > 0) return [bwd, fwd];
  const both = Math.max(2, n);
  return [Math.floor(both / 2), Math.ceil(both / 2)];
};

const sideLanes = (t: Tags, key: "cycleway" | "busway"): { left: boolean; right: boolean } => {
  const all = t[key];
  const both = t[`${key}:both`];
  const lane = (v: string | undefined) => v === "lane" || v === "exclusive";
  return { left: lane(all) || lane(both) || lane(t[`${key}:left`]), right: lane(all) || lane(both) || lane(t[`${key}:right`]) };
};

/**
 * The markings of one road, before they are cut at junctions: lane lines at the boundaries
 * between lanes (the centre one between the directions), edge lines on main roads, cycle and
 * bus lanes along the kerbs. Offsets are left of the line's direction, as `offsetLine` takes.
 */
export const roadMarkings = (l: Line): Marking[] => {
  const t = l.tags;
  if (!t.highway || !MARKED_ROADS.has(t.highway) || t.area === "yes" || COBBLES.has(t.surface ?? "") || l.line.length < 2) return [];
  if (t.tunnel === "yes" || Number(t.layer ?? 0) < 0 || t.lane_markings === "no") return [];
  const w = roadWidth(t);
  const [back, fwd] = lanesOf(t, w);
  const lanes = back + fwd;
  const lw = w / lanes;
  const out: Marking[] = [];
  const add = (kind: RoadMarkingKind, offset: number) => out.push({ kind, line: offsetLine(l.line, offset), source: l.id });
  // Lanes run from the left kerb (+w/2) to the right one (-w/2); the directions meet after `back` of them.
  for (let k = 1; k < lanes; k++) add(k === back ? (lanes >= 4 ? "centre-double" : "centre-dash") : "lane-dash", w / 2 - k * lw);
  if (EDGED.has(t.highway) && w >= 9) {
    add("edge", w / 2 - EDGE_IN);
    add("edge", -w / 2 + EDGE_IN);
  }
  const cycle = sideLanes(t, "cycleway");
  const bus = sideLanes(t, "busway");
  // A bus lane takes the kerb; a cycle lane goes there or just inside the bus lane.
  if (bus.right) add("bus-lane", -w / 2 + SIDE_LANE / 2);
  if (bus.left) add("bus-lane", w / 2 - SIDE_LANE / 2);
  if (cycle.right) add("cycle-lane", -w / 2 + SIDE_LANE / 2 + (bus.right ? SIDE_LANE : 0));
  if (cycle.left) add("cycle-lane", w / 2 - SIDE_LANE / 2 - (bus.left ? SIDE_LANE : 0));
  return out;
};

/**
 * Stop lines before traffic lights on the roads through `at`: across the lanes that drive
 * towards the lights, `STOP_BACK` metres before them, or before the junction they stand in
 * (`inJunction`: on another carriageway than `road`); both ways on a two-way road.
 */
export const stopLines = (source: string, at: Pt, roads: readonly Line[], inJunction: (p: Pt, road: string) => boolean = () => false): Marking[] => {
  const out: Marking[] = [];
  for (const l of roads) {
    const t = l.tags;
    if (!t.highway || !MARKED_ROADS.has(t.highway)) continue;
    let s = 0;
    for (let i = 0; i + 1 < l.line.length; i++) {
      const a = l.line[i]!;
      const b = l.line[i + 1]!;
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const k = len > 0 ? Math.max(0, Math.min(1, ((at.x - a.x) * (b.x - a.x) + (at.z - a.z) * (b.z - a.z)) / (len * len))) : 0;
      if (Math.hypot(a.x + (b.x - a.x) * k - at.x, a.z + (b.z - a.z) * k - at.z) < 1) {
        const w = roadWidth(t);
        const total = lineLength(l.line);
        const here = s + k * len;
        const across = (along: number, from: number, to: number) => {
          if (along < 0 || along > total) return;
          const p = pointAlong(l.line, along);
          const q = pointAlong(l.line, Math.min(total, along + 0.5));
          const r = pointAlong(l.line, Math.max(0, along - 0.5));
          const dx = q.x - r.x;
          const dz = q.z - r.z;
          const d = Math.hypot(dx, dz) || 1;
          // Left of the direction is (-dz, dx).
          const side = (o: number): Pt => ({ x: p.x - (dz / d) * o, z: p.z + (dx / d) * o });
          out.push({ kind: "stop", line: [side(from), side(to)], source });
        };
        // Back from the lights, and on until the line is clear of the junction.
        const back = (dir: 1 | -1): number => {
          let d = STOP_BACK;
          while (d < 30 && inJunction(pointAlong(l.line, here + dir * d), l.id)) d += 0.5;
          return here + dir * (d + (d > STOP_BACK ? 1 : 0));
        };
        across(back(-1), 0, -w / 2 + EDGE_IN);
        if (!oneway(t)) across(back(1), 0, w / 2 - EDGE_IN);
        break;
      }
      s += len;
    }
  }
  return out;
};

/** The pieces of `line` whose points are not `blocked`, sampled every half metre, `MIN_PIECE` long at least. */
export const cutLine = (line: readonly Pt[], blocked: (p: Pt) => boolean): Pt[][] => {
  const total = lineLength(line);
  const runs: Pt[][] = [];
  let start: number | null = null;
  const close = (end: number) => {
    if (start !== null && end - start >= MIN_PIECE) runs.push(sliceLine(line, start, end));
    start = null;
  };
  for (let s = 0; s <= total + 1e-6; s += 0.5) {
    const free = !blocked(pointAlong(line, s));
    if (free && start === null) start = s;
    if (!free) close(s - 0.5);
  }
  close(total);
  return runs;
};

/** Markings cut to a chunk, rounded to 0.1 m, in their order. */
export const chunkMarkings = (markings: readonly Marking[], rect: Rect): MarkingOut[] =>
  markings.flatMap((m) =>
    clipLineToRect(m.line, rect)
      .map((piece) => simplifyLine(piece, m.kind === "stop" ? 0 : 0.15))
      .filter((piece) => piece.length >= 2)
      .map((piece) => ({ kind: m.kind, line: piece.flatMap((p) => [r1(p.x), r1(p.z)]) })),
  );
