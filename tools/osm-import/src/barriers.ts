/**
 * Barriers of the map (ADR-0077 point 4): OSM `barrier=wall|retaining_wall|city_wall|fence|hedge`
 * lines as the game's walls, fences and hedges, with a kind and a height, and the gates and lift
 * gates as openings. A barrier never closes a way of the map: it is cut where it runs through a
 * building (the building's solid stands there), over a carriageway or steps, where a way of the
 * map crosses it (as wide as the way) and at its gates. What the game's own content needs clear
 * (doors, the crowd's routes, the set pieces) the simulation cuts on top (`barriers.ts` in sim).
 */
import type { BarrierKind } from "../../../packages/core/src/world/barriers.ts";
import { parseLength } from "./building-tags.ts";
import { type Area, type Line } from "./features.ts";
import { type Pt, type Rect, clipLineToRect, inRect, lineLength, pointAlong, pointInRing, r1, ringBounds, simplifyLine, sliceLine } from "./geometry.ts";
import { pathWidth, roadWidth } from "./ground.ts";
import { BARRIER_GAPS, type OsmData } from "./osm.ts";
import { geoToWorld } from "./project.ts";

export type { BarrierKind };

export interface BarrierOut {
  /** The OSM element, `w<id>` (a way) or `n<id>` (a gate node). */
  readonly id: string;
  readonly kind: BarrierKind;
  /** Over the ground, metres: the `height` tag, else the kind's default (`BARRIER_HEIGHT`). */
  readonly height: number;
  /** World polyline, clipped to the chunk; for an opening its span, post to post. */
  readonly line: readonly number[];
  /** OSM `material` (`brick`, `stone`, `concrete`, `metal`, `wood`…), or `fence_type` for a fence. */
  readonly material?: string;
}

/** The OSM kinds the game builds. */
const KINDS: Readonly<Record<string, BarrierKind>> = {
  wall: "wall",
  retaining_wall: "retaining-wall",
  city_wall: "city-wall",
  fence: "fence",
  hedge: "hedge",
  gate: "gate",
  lift_gate: "lift-gate",
};

/**
 * Heights without a `height` tag (ADR-0077): a low wall (murek) 1.0 m, a wall of the old town's
 * walls 2.0 m, a fence 1.6 m, a hedge 1.2 m; a retaining wall stands 1.0 m over its low side.
 */
export const BARRIER_HEIGHT: Readonly<Record<BarrierKind, number>> = {
  wall: 1,
  "retaining-wall": 1,
  "city-wall": 2,
  fence: 1.6,
  hedge: 1.2,
  gate: 1.6,
  "lift-gate": 1.1,
};

/** Tagged heights past these are noise (a whole facade tagged as a wall). */
const MIN_HEIGHT = 0.4;
const MAX_HEIGHT = 8;

/** A gate without a `width`: a wicket in a fence (m); on a way, the way's own width. */
const GATE_WIDTH = 1.6;
/** A way crossing a barrier opens it this much wider than the way (m), and no less than `MIN_GAP`. */
const GAP_MARGIN = 0.4;
const MIN_GAP = 1.2;
/** Steps along a barrier the cuts are tested at, and the shortest piece kept (m). */
const STEP = 0.25;
const MIN_PIECE = 0.6;

/** The barrier's kind: its own, or a wall of the city walls (`wall=city_wall|castle_wall`). */
export const barrierKind = (t: Readonly<Record<string, string>>): BarrierKind | null => {
  const k = KINDS[t.barrier ?? ""];
  if (k === "wall" && (t.wall === "city_wall" || t.wall === "castle_wall" || t.historic === "citywalls")) return "city-wall";
  return k ?? null;
};

export const barrierHeight = (t: Readonly<Record<string, string>>, kind: BarrierKind): number => {
  const h = parseLength(t.height);
  return h !== null && h >= MIN_HEIGHT && h <= MAX_HEIGHT ? Math.round(h * 10) / 10 : BARRIER_HEIGHT[kind];
};

/** What cuts the barriers: the buildings' outlines, the carriageways' and steps' bands, the ways of the map. */
export interface BarrierCuts {
  readonly buildings: readonly { readonly ring: readonly Pt[] }[];
  readonly bands: readonly { readonly ring: readonly Pt[]; readonly surface: string; readonly carriageway?: true }[];
  readonly lines: readonly Line[];
}

interface Indexed {
  readonly ring: readonly Pt[];
  readonly box: Rect;
}

const indexed = (rings: readonly { readonly ring: readonly Pt[] }[]): Indexed[] => rings.map((r) => ({ ring: r.ring, box: ringBounds(r.ring) }));
const inAny = (p: Pt, list: readonly Indexed[]): boolean => list.some((r) => p.x >= r.box.minX && p.x <= r.box.maxX && p.z >= r.box.minZ && p.z <= r.box.maxZ && pointInRing(p, r.ring));

/** Where segment a-b meets segment c-d, or null. */
const crossing = (a: Pt, b: Pt, c: Pt, d: Pt): Pt | null => {
  const r = { x: b.x - a.x, z: b.z - a.z };
  const s = { x: d.x - c.x, z: d.z - c.z };
  const den = r.x * s.z - r.z * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * s.z - (c.z - a.z) * s.x) / den;
  const u = ((c.x - a.x) * r.z - (c.z - a.z) * r.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + r.x * t, z: a.z + r.z * t } : null;
};

/** The sine of the angle between segments a-b and c-d. */
const sine = (a: Pt, b: Pt, c: Pt, d: Pt): number => {
  const [ux, uz, vx, vz] = [b.x - a.x, b.z - a.z, d.x - c.x, d.z - c.z];
  return (ux * vz - uz * vx) / (Math.hypot(ux, uz) * Math.hypot(vx, vz) || 1);
};
/** A way crosses a barrier at 30 degrees and more. */
const CROSS_SINE = 0.5;

/** An opening in the barriers: a centre and half its width. */
interface Gap {
  readonly at: Pt;
  readonly half: number;
}

/** The width a way of the map keeps through a barrier (m). */
const wayWidth = (t: Readonly<Record<string, string>>): number => {
  const h = t.highway ?? "";
  const path = h === "footway" || h === "path" || h === "cycleway" || h === "steps" || h === "bridleway" || h === "pedestrian";
  return path ? pathWidth(t) : roadWidth(t);
};

/** The openings where the ways of the map cross a barrier or end at it. */
const wayGaps = (line: readonly Pt[], ways: readonly Line[]): Gap[] => {
  const out: Gap[] = [];
  const box = ringBounds(line);
  for (const w of ways) {
    const wb = ringBounds(w.line);
    if (wb.minX > box.maxX + 1 || wb.maxX < box.minX - 1 || wb.minZ > box.maxZ + 1 || wb.maxZ < box.minZ - 1) continue;
    const half = Math.max(MIN_GAP, wayWidth(w.tags) + GAP_MARGIN) / 2;
    for (let i = 0; i + 1 < line.length; i++) {
      for (let k = 0; k + 1 < w.line.length; k++) {
        const [a, b, c, d] = [line[i]!, line[i + 1]!, w.line[k]!, w.line[k + 1]!];
        const p = crossing(a, b, c, d);
        // Across the barrier, not along it: a path mapped along a fence on its nodes leaves it whole.
        if (p && Math.abs(sine(a, b, c, d)) >= CROSS_SINE) out.push({ at: p, half });
      }
    }
  }
  return out;
};

/** Pieces of a polyline clear of `blocked`, tested every `STEP` metres. */
export const cutBarrier = (line: readonly Pt[], blocked: (p: Pt) => boolean): Pt[][] => {
  const total = lineLength(line);
  const out: Pt[][] = [];
  let start: number | null = null;
  const close = (end: number) => {
    if (start !== null && end - start >= MIN_PIECE) out.push(sliceLine(line, start, end));
    start = null;
  };
  const n = Math.max(1, Math.ceil(total / STEP));
  for (let k = 0; k <= n; k++) {
    const s = (total * k) / n;
    const free = !blocked(pointAlong(line, s));
    if (free && start === null) start = s;
    if (!free) close(s - total / n);
  }
  close(total);
  return out;
};

/** A barrier of the whole map, before it is clipped to the chunks. */
export interface WorldBarrier {
  readonly id: string;
  readonly kind: BarrierKind;
  readonly height: number;
  readonly line: readonly Pt[];
  readonly material?: string;
}

const materialOf = (t: Readonly<Record<string, string>>, kind: BarrierKind): string | undefined => (kind === "fence" ? (t.fence_type ?? t.material) : (t.material ?? t.wall));

/** The span of an opening: `half` either side of `at` along the direction (dx, dz). */
const span = (at: Pt, dx: number, dz: number, half: number): Pt[] => {
  const l = Math.hypot(dx, dz) || 1;
  return [
    { x: at.x - (dx / l) * half, z: at.z - (dz / l) * half },
    { x: at.x + (dx / l) * half, z: at.z + (dz / l) * half },
  ];
};

/** Gate nodes: on a barrier the opening runs along it, on a way across it, as wide as the way or its `width`. */
const gateNodes = (data: OsmData, barriers: readonly Line[], ways: readonly Line[]): { gap: Gap; out: WorldBarrier | null }[] => {
  const host = new Map<number, { line: Line; k: number; barrier: boolean }>();
  for (const [list, barrier] of [
    [ways, false],
    [barriers, true],
  ] as const) {
    for (const l of list) {
      const way = data.ways.get(l.osmId);
      way?.nodes.forEach((id, k) => {
        if (!host.has(id) || barrier) host.set(id, { line: l, k, barrier });
      });
    }
  }
  const out: { gap: Gap; out: WorldBarrier | null }[] = [];
  for (const n of [...data.nodes.values()].sort((a, b) => a.id - b.id)) {
    const b = n.tags?.barrier ?? "";
    const h = host.get(n.id);
    if (!BARRIER_GAPS.has(b) || !h) continue;
    const at = geoToWorld(n.lat, n.lon);
    const pts = h.line.line;
    const prev = pts[Math.max(0, h.k - 1)]!;
    const next = pts[Math.min(pts.length - 1, h.k + 1)]!;
    const [dx, dz] = [next.x - prev.x, next.z - prev.z];
    const tagged = parseLength(n.tags?.width);
    const half = (tagged ?? (h.barrier ? GATE_WIDTH : Math.max(MIN_GAP, wayWidth(h.line.tags)))) / 2;
    // An opening on a way runs across the way: turned a quarter from the way's direction.
    const line = h.barrier ? span(at, dx, dz, half) : span(at, -dz, dx, half);
    const kind = b === "lift_gate" ? "lift-gate" : b === "gate" ? "gate" : null;
    out.push({ gap: { at, half: half + 0.05 }, out: kind ? { id: `n${n.id}`, kind, height: BARRIER_HEIGHT[kind], line } : null });
  }
  return out;
};

/**
 * Every barrier of the map, cut clear of the buildings, carriageways, steps, the ways crossing it
 * and its gates; the gates (and lift gates) as openings of their own. Sorted by id, so the chunks
 * read the same whatever order the map was read in.
 */
export const worldBarriers = (data: OsmData, lines: readonly Line[], areas: readonly Area[], cuts: BarrierCuts): WorldBarrier[] => {
  const buildings = indexed(cuts.buildings);
  const paved = indexed(cuts.bands.filter((b) => b.carriageway || b.surface === "crossing" || b.surface === "steps"));
  const ways = cuts.lines.filter((l) => l.tags.highway !== undefined && l.tags.highway !== "proposed" && l.tags.highway !== "construction" && l.tags.tunnel === undefined);
  const barrierLines: Line[] = [
    ...lines.filter((l) => barrierKind(l.tags) && l.tags.building === undefined),
    ...areas.filter((a) => barrierKind(a.tags) && a.tags.building === undefined).map((a) => ({ id: a.id, osmId: a.osmId, tags: a.tags, line: [...a.ring, a.ring[0]!] })),
  ];
  const gates = gateNodes(data, barrierLines, ways);
  const out: WorldBarrier[] = [];
  for (const l of barrierLines) {
    const kind = barrierKind(l.tags)!;
    const height = barrierHeight(l.tags, kind);
    const material = materialOf(l.tags, kind);
    const extra = material ? { material } : {};
    // A gate mapped as a way is an opening of its own.
    if (kind === "gate" || kind === "lift-gate") {
      out.push({ id: l.id, kind, height: BARRIER_HEIGHT[kind], line: l.line, ...extra });
      continue;
    }
    const gaps = [...wayGaps(l.line, ways), ...gates.map((g) => g.gap)];
    const blocked = (p: Pt) => inAny(p, buildings) || inAny(p, paved) || gaps.some((g) => Math.hypot(p.x - g.at.x, p.z - g.at.z) < g.half);
    for (const piece of cutBarrier(l.line, blocked)) out.push({ id: l.id, kind, height, line: piece, ...extra });
  }
  for (const g of gates) {
    // A gate's posts stand on the ground, not in a building, nor (a lift gate's) in the road.
    if (g.out && !g.out.line.some((p) => inAny(p, buildings))) out.push(g.out);
  }
  const key = (b: WorldBarrier) => `${b.id.charAt(0)}${String(b.id.slice(1)).padStart(14, "0")}`;
  return out.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
};

/** The barriers of a chunk: clipped to its rectangle, simplified to 0.1 m, rounded to 0.1 m. */
export const chunkBarriers = (barriers: readonly WorldBarrier[], rect: Rect): BarrierOut[] => {
  const out: BarrierOut[] = [];
  for (const b of barriers) {
    // An opening belongs to the chunk of its centre, whole.
    if (b.kind === "gate" || b.kind === "lift-gate") {
      const mid = pointAlong(b.line, lineLength(b.line) / 2);
      if (inRect(mid, rect)) out.push({ ...b, line: b.line.flatMap((p) => [r1(p.x), r1(p.z)]) });
      continue;
    }
    for (const piece of clipLineToRect(b.line, rect)) {
      if (lineLength(piece) < MIN_PIECE / 2) continue;
      const line = simplifyLine(piece, 0.1).flatMap((p) => [r1(p.x), r1(p.z)]);
      out.push({ ...b, line });
    }
  }
  return out;
};
