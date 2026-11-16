import { type GroundSurface, SURFACE_LIFT, SpatialHash, pointInPairRingEvenOdd } from "@seki/core";
import { MAP_CHUNKS } from "./sites";
import type { LublinChunkData } from "./types";

/**
 * The map's streets as whole ways for the traffic (ADR-0050): the clipped OSM pieces of each
 * chunk joined back into polylines by name, and the paved surfaces under them, so a lane can
 * keep to the carriageway and a parked car to the kerb. Pure functions of the generated data.
 */

export type Pt = readonly [number, number];

/** How far a carriageway reaches `[left, right]` of its axis at one of its points (m; 0 off its asphalt). */
export type Reach = readonly [number, number];

/** What a street carries: cars, only the rare delivery van (pedestrian streets, the Old Town), or nothing. */
export type StreetUse = "cars" | "deliveries";

export interface RoadChain {
  readonly name: string;
  /** The OSM `highway` value of its first piece. */
  readonly kind: string;
  readonly use: StreetUse;
  readonly district: LublinChunkData["district"];
  /** As drawn in OSM (a one-way carriageway is drawn the way it is driven). */
  readonly points: readonly Pt[];
  /** Its carriageway's reach left and right at each of `points`, from the import's width (ADR-0080), not the asphalt drawn. */
  readonly half: readonly Reach[];
  /** Mapped one-way: driven only the way `points` run. */
  readonly oneway: boolean;
}

/** Roads for cars, by OSM `highway`. */
const CAR_KINDS: ReadonlySet<string> = new Set(["primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link", "residential", "unclassified"]);
/** Pedestrian streets a delivery van may use in the morning. */
const DELIVERY_KINDS: ReadonlySet<string> = new Set(["pedestrian", "living_street"]);
/** Major roads are drawn one way per carriageway; their pieces are never turned round when joined. */
const DIRECTED_KINDS: ReadonlySet<string> = new Set(["primary", "primary_link", "secondary", "secondary_link"]);

/** The Old Town (`kanal`): no cars on its streets, only deliveries (ADR-0050). */
const useOf = (kind: string, district: LublinChunkData["district"]): StreetUse | null => {
  if (DELIVERY_KINDS.has(kind)) return district === "kanal" || district === "shinsekai-7" ? "deliveries" : null;
  if (!CAR_KINDS.has(kind)) return null;
  return district === "kanal" && (kind === "residential" || kind === "unclassified") ? "deliveries" : "cars";
};

/** Length of a polyline. */
export const polylineLength = (pts: readonly Pt[]): number => {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  return s;
};

const JOIN = 0.6;
const near = (a: Pt, b: Pt): boolean => Math.hypot(a[0] - b[0], a[1] - b[1]) < JOIN;
/** Cosine of the sharpest turn where two pieces join (100°): sharper is the other carriageway turning back. */
const MAX_TURN_COS = -0.17;

/** Does `b` carry on from the end of `a` (not turn back along the other carriageway of a dual road)? */
const carriesOn = (a: readonly Pt[], b: readonly Pt[]): boolean => {
  const p = a[a.length - 2]!;
  const q = a[a.length - 1]!;
  const r = b[1]!;
  const ux = q[0] - p[0];
  const uz = q[1] - p[1];
  const vx = r[0] - q[0];
  const vz = r[1] - q[1];
  const l = Math.hypot(ux, uz) * Math.hypot(vx, vz);
  return l < 1e-9 || (ux * vx + uz * vz) / l > MAX_TURN_COS;
};

/** A piece of a street: its points and its carriageway's reach at each. */
type Piece = { pts: Pt[]; half: Reach[]; directed: boolean };

const piecesOf = (c: LublinChunkData): ({ key: string; name: string; kind: string; use: StreetUse; oneway: boolean } & Piece)[] =>
  c.streets.flatMap((st) => {
    const use = st.noVehicles ? null : useOf(st.kind, c.district);
    if (!use) return [];
    const pts: Pt[] = [];
    const half: Reach[] = [];
    for (let i = 0; i + 1 < st.line.length; i += 2) {
      pts.push([st.line[i] as number, st.line[i + 1] as number]);
      half.push(st.half ? [st.half[i] as number, st.half[i + 1] as number] : [0, 0]);
    }
    if (pts.length < 2) return [];
    // Roundabouts are one-way however they are classified.
    const oneway = st.oneway === true;
    const directed = oneway || DIRECTED_KINDS.has(st.kind) || st.name.startsWith("Rondo");
    // One-way pieces join only each other, end to start, never turned round.
    return [{ key: `${st.name}|${use}|${c.district === "kanal" ? "kanal" : "city"}|${oneway ? "oneway" : "both"}`, name: st.name, kind: st.kind, use, directed, oneway, pts, half }];
  });

/**
 * Joins pieces of one street end to start (and, for minor two-way streets, end to end turned
 * round) until nothing joins any more. Deterministic: pieces in table order, first match wins.
 */
const joinPieces = (pieces: readonly Piece[]): { pts: Pt[]; half: Reach[] }[] => {
  const lines = pieces.map((p) => ({ pts: [...p.pts], half: [...p.half], directed: p.directed }));
  for (let merged = true; merged; ) {
    merged = false;
    outer: for (let i = 0; i < lines.length; i++) {
      for (let j = 0; j < lines.length; j++) {
        if (i === j) continue;
        const a = lines[i]!;
        const b = lines[j]!;
        if (near(a.pts[a.pts.length - 1]!, b.pts[0]!) && carriesOn(a.pts, b.pts)) {
          a.pts.push(...b.pts.slice(1));
          a.half.push(...b.half.slice(1));
        } else if (!a.directed && !b.directed && near(a.pts[a.pts.length - 1]!, b.pts[b.pts.length - 1]!)) {
          // Turned round, its left is its right.
          a.pts.push(...[...b.pts].reverse().slice(1));
          a.half.push(...[...b.half].reverse().slice(1).map(([l, r]): Reach => [r, l]));
        } else continue;
        lines.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }
  return lines.map((l) => ({ pts: l.pts, half: l.half }));
};

/** Every street of the map that carries traffic, as whole polylines, longest first within a name. */
export const ROAD_CHAINS: readonly RoadChain[] = (() => {
  const groups = new Map<string, { name: string; kind: string; use: StreetUse; district: LublinChunkData["district"]; oneway: boolean; pieces: Piece[] }>();
  for (const c of MAP_CHUNKS) {
    for (const p of piecesOf(c)) {
      const piece = { pts: p.pts, half: p.half, directed: p.directed };
      const g = groups.get(p.key);
      if (g) g.pieces.push(piece);
      else groups.set(p.key, { name: p.name, kind: p.kind, use: p.use, district: c.district, oneway: p.oneway, pieces: [piece] });
    }
  }
  const out: RoadChain[] = [];
  for (const g of groups.values()) for (const { pts, half } of joinPieces(g.pieces)) out.push({ name: g.name, kind: g.kind, use: g.use, district: g.district, points: pts, half, oneway: g.oneway });
  return out;
})();

// ---------------------------------------------------------------- surfaces

interface Area {
  readonly surface: GroundSurface;
  /** Laid on a bridge's deck (ADR-0053). */
  readonly deck: boolean;
  readonly pts: readonly Pt[];
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

const AREAS: readonly Area[] = MAP_CHUNKS.flatMap((c) =>
  c.ground.map((g) => {
    const pts: Pt[] = [];
    for (let i = 0; i + 1 < g.outline.length; i += 2) pts.push([g.outline[i] as number, g.outline[i + 1] as number]);
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    return { surface: g.surface, deck: g.deck !== undefined, pts, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
  }),
);

/** The areas in a 32 m `SpatialHash` by their boxes: `at` gives those whose box holds a point, in draw order. */
const areaGrid = new SpatialHash<Area>(32);
for (const a of AREAS) areaGrid.insert(a, a.minX, a.minZ, a.maxX, a.maxZ);

const areasAt = (x: number, z: number): Area[] =>
  areaGrid.at(x, z).filter((a) => pointInPairRingEvenOdd(x, z, a.pts));

/** The surfaces of the map under (x, z), in draw order. */
export const surfacesAt = (x: number, z: number): GroundSurface[] => areasAt(x, z).map((a) => a.surface);

/**
 * How far the renderer lifts the surface drawn at (x, z) above the ground there: the highest
 * `SURFACE_LIFT` of the pieces under it, those on a bridge's deck when the ground is the deck.
 */
export const surfaceLiftAt = (x: number, z: number, onDeck: boolean): number =>
  areasAt(x, z).reduce((lift, a) => (a.deck === onDeck ? Math.max(lift, SURFACE_LIFT[a.surface]) : lift), 0);

/** The surfaces of a carriageway: its asphalt, and a zebra on it, a piece of its own since the ground is a partition (ADR-0078 step 3). */
export const CARRIAGEWAY: ReadonlySet<GroundSurface> = new Set<GroundSurface>(["road", "crossing"]);

/** Is (x, z) on a carriageway of the map? */
export const onRoad = (x: number, z: number): boolean => surfacesAt(x, z).some((s) => CARRIAGEWAY.has(s));
