import type { GroundSurface } from "@seki/core";
import { MAP_CHUNKS } from "./sites";
import type { LublinChunkData } from "./types";

/**
 * The map's streets as whole ways for the traffic (ADR-0050): the clipped OSM pieces of each
 * chunk joined back into polylines by name, and the paved surfaces under them, so a lane can
 * keep to the carriageway and a parked car to the kerb. Pure functions of the generated data.
 */

export type Pt = readonly [number, number];

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

const piecesOf = (c: LublinChunkData): { key: string; name: string; kind: string; use: StreetUse; directed: boolean; oneway: boolean; pts: Pt[] }[] =>
  c.streets.flatMap((st) => {
    const use = st.noVehicles ? null : useOf(st.kind, c.district);
    if (!use) return [];
    const pts: Pt[] = [];
    for (let i = 0; i + 1 < st.line.length; i += 2) pts.push([st.line[i] as number, st.line[i + 1] as number]);
    if (pts.length < 2) return [];
    // Roundabouts are one-way however they are classified.
    const oneway = st.oneway === true;
    const directed = oneway || DIRECTED_KINDS.has(st.kind) || st.name.startsWith("Rondo");
    // One-way pieces join only each other, end to start, never turned round.
    return [{ key: `${st.name}|${use}|${c.district === "kanal" ? "kanal" : "city"}|${oneway ? "oneway" : "both"}`, name: st.name, kind: st.kind, use, directed, oneway, pts }];
  });

/**
 * Joins pieces of one street end to start (and, for minor two-way streets, end to end turned
 * round) until nothing joins any more. Deterministic: pieces in table order, first match wins.
 */
const joinPieces = (pieces: { pts: Pt[]; directed: boolean }[]): Pt[][] => {
  const lines = pieces.map((p) => ({ pts: [...p.pts], directed: p.directed }));
  for (let merged = true; merged; ) {
    merged = false;
    outer: for (let i = 0; i < lines.length; i++) {
      for (let j = 0; j < lines.length; j++) {
        if (i === j) continue;
        const a = lines[i]!;
        const b = lines[j]!;
        if (near(a.pts[a.pts.length - 1]!, b.pts[0]!) && carriesOn(a.pts, b.pts)) a.pts.push(...b.pts.slice(1));
        else if (!a.directed && !b.directed && near(a.pts[a.pts.length - 1]!, b.pts[b.pts.length - 1]!)) a.pts.push(...[...b.pts].reverse().slice(1));
        else continue;
        lines.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }
  return lines.map((l) => l.pts);
};

/** Every street of the map that carries traffic, as whole polylines, longest first within a name. */
export const ROAD_CHAINS: readonly RoadChain[] = (() => {
  const groups = new Map<string, { name: string; kind: string; use: StreetUse; district: LublinChunkData["district"]; oneway: boolean; pieces: { pts: Pt[]; directed: boolean }[] }>();
  for (const c of MAP_CHUNKS) {
    for (const p of piecesOf(c)) {
      const g = groups.get(p.key);
      if (g) g.pieces.push({ pts: p.pts, directed: p.directed });
      else groups.set(p.key, { name: p.name, kind: p.kind, use: p.use, district: c.district, oneway: p.oneway, pieces: [{ pts: p.pts, directed: p.directed }] });
    }
  }
  const out: RoadChain[] = [];
  for (const g of groups.values()) for (const points of joinPieces(g.pieces)) out.push({ name: g.name, kind: g.kind, use: g.use, district: g.district, points, oneway: g.oneway });
  return out;
})();

/** Length of a polyline. */
export const polylineLength = (pts: readonly Pt[]): number => {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  return s;
};

// ---------------------------------------------------------------- surfaces

interface Area {
  readonly surface: GroundSurface;
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
    return { surface: g.surface, pts, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
  }),
);

const CELL = 32;
const areaCells = new Map<string, Area[]>();
for (const a of AREAS) {
  for (let ix = Math.floor(a.minX / CELL); ix <= Math.floor(a.maxX / CELL); ix++) {
    for (let iz = Math.floor(a.minZ / CELL); iz <= Math.floor(a.maxZ / CELL); iz++) {
      const k = `${ix}:${iz}`;
      const list = areaCells.get(k);
      if (list) list.push(a);
      else areaCells.set(k, [a]);
    }
  }
}

const inside = (x: number, z: number, pts: readonly Pt[]): boolean => {
  let r = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!;
    const b = pts[j]!;
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) r = !r;
  }
  return r;
};

/** The surfaces of the map under (x, z), in draw order. */
export const surfacesAt = (x: number, z: number): GroundSurface[] =>
  (areaCells.get(`${Math.floor(x / CELL)}:${Math.floor(z / CELL)}`) ?? []).filter((a) => x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ && inside(x, z, a.pts)).map((a) => a.surface);

/** Is (x, z) on a carriageway of the map? */
export const onRoad = (x: number, z: number): boolean => surfacesAt(x, z).includes("road");
