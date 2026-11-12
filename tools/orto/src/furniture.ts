/**
 * Street furniture in a cell (ADR-0077 point 4): how many of each kind the game has, how many stand
 * where the map has one (OSM) and how many the generator placed by its rules, and the pavements
 * running more than `EMPTY_RUN` metres without any piece.
 *
 * The table (`props.generated.ts`) does not keep where a piece came from. A piece counts as from
 * OSM when it stands within `OSM_MATCH` of a point of a plan group whose positions are the map's
 * (`inOsm` with `points` or `position` in `docs/world/lublin-props.todo.json`); the rest (pieces
 * strung along lines, laid by spacing, the decals' grates and covers, bollards strung into rows)
 * are the generator's.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Pt, type Rect } from "../../osm-import/src/geometry.ts";
import type { LublinChunkData, LublinPropTable } from "../../../packages/sim/src/content/lublin/types.ts";
import { type CoverHeader } from "./cover.ts";
import { REPO } from "./config.ts";
import { flatRing } from "./overlay.ts";
import { samplesIn } from "./rings.ts";

/** The kinds asked about, the lamps' styles under one name. */
export const FURNITURE_GROUPS: Readonly<Record<string, (kind: string) => boolean>> = {
  lamp: (k) => k.startsWith("lamp-"),
  bench: (k) => k === "bench",
  "waste-bin": (k) => k === "waste-bin",
  bollard: (k) => k === "bollard",
  "bike-rack": (k) => k === "bike-rack",
  hydrant: (k) => k === "hydrant",
  "drain-grate": (k) => k === "drain-grate",
};

/** What breaks a run of empty pavement: the kinds above and the rest of the standing street furniture. */
const STANDING = new Set(["bus-shelter", "bus-stop", "ticket-machine", "street-cabinet", "advertising-column", "trolley-pole", "traffic-signal", "planter", "bike-station", "vending-machine", "atm", "cctv", "flagpole", "granite-block"]);
const isFurniture = (kind: string) => STANDING.has(kind) || Object.values(FURNITURE_GROUPS).some((f) => f(kind));

/** How near a plan point of the map's a piece stands to count as the map's (m). */
export const OSM_MATCH = 1.5;
/** A pavement longer than this without furniture is reported (m). */
export const EMPTY_RUN = 60;
/** Stations along a street's axis (m), how far out its pavement is looked for, and how near a piece must be. */
const STATION = 2;
const REACH = 15;
const NEAR = 5;
/** What the import draws a pavement as: a sidewalk of a street, a footway mapped beside it, or the paving of a square or a yard. */
const PAVEMENT: ReadonlySet<string> = new Set(["sidewalk", "footway", "cobble", "square"]);
/** Streets with pavements: not the paths, steps and squares mapped as ways. */
const NO_PAVEMENT = new Set(["footway", "path", "pedestrian", "steps", "cycleway", "bridleway", "track", "corridor", "platform"]);

export interface Piece {
  readonly kind: string;
  readonly x: number;
  readonly z: number;
}

export const piecesOf = (table: LublinPropTable): Piece[] =>
  Object.values(table).flatMap((byKind) =>
    Object.entries(byKind).flatMap(([kind, rows]) => {
      const out: Piece[] = [];
      for (let i = 0; i + 4 < (rows ?? []).length; i += 5) out.push({ kind, x: rows![i]!, z: rows![i + 2]! });
      return out;
    }),
  );

interface PlanItem {
  readonly kind: string;
  readonly inOsm?: boolean;
  readonly points?: readonly (readonly [number, number])[];
  readonly position?: { readonly x: number; readonly z: number };
}

/** The plan's points from the map, by kind. */
export const osmPlanPoints = (path = join(REPO, "docs/world/lublin-props.todo.json")): Map<string, Pt[]> => {
  const plan = JSON.parse(readFileSync(path, "utf8")) as { items: PlanItem[] };
  const out = new Map<string, Pt[]>();
  for (const it of plan.items) {
    if (!it.inOsm) continue;
    const pts = [...(it.points ?? []).map(([x, z]) => ({ x, z })), ...(it.position ? [it.position] : [])];
    if (pts.length) out.set(it.kind, [...(out.get(it.kind) ?? []), ...pts]);
  }
  return out;
};

const inRect = (p: Pt, r: Rect) => p.x > r.minX && p.x < r.maxX && p.z > r.minZ && p.z < r.maxZ;

export interface FurnitureCount {
  readonly total: number;
  readonly osm: number;
  readonly generator: number;
}

export const furnitureCounts = (pieces: readonly Piece[], plan: ReadonlyMap<string, readonly Pt[]>, rect: Rect): Record<string, FurnitureCount> => {
  const out: Record<string, FurnitureCount> = {};
  for (const [group, of] of Object.entries(FURNITURE_GROUPS)) {
    const here = pieces.filter((p) => of(p.kind) && inRect(p, rect));
    const osm = here.filter((p) => (plan.get(p.kind) ?? []).some((q) => Math.hypot(q.x - p.x, q.z - p.z) <= OSM_MATCH)).length;
    out[group] = { total: here.length, osm, generator: here.length - osm };
  }
  return out;
};

export interface EmptyRun {
  readonly street: string;
  readonly side: "left" | "right";
  readonly length: number;
  readonly from: Pt;
  readonly to: Pt;
}

const r1 = (p: Pt): Pt => ({ x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10 });

/** Stations every `STATION` metres along a polyline, with the unit normal to the left. */
const stations = (line: readonly Pt[]): { p: Pt; n: Pt }[] => {
  const out: { p: Pt; n: Pt }[] = [];
  // How far into the next segment its first station lies: the stations keep their spacing round the bends.
  let next = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i]!, line[i + 1]!];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-6) continue;
    const n = { x: -(b.z - a.z) / len, z: (b.x - a.x) / len };
    let t = next;
    for (; t < len; t += STATION) out.push({ p: { x: a.x + ((b.x - a.x) * t) / len, z: a.z + ((b.z - a.z) * t) / len }, n });
    next = t - len;
  }
  return out;
};

/**
 * The pavements of the cell's streets without furniture for more than `EMPTY_RUN` metres: from
 * each station along a street's axis the pavement is the first paved piece out to `REACH` on
 * each side (`PAVEMENT`; none, or a building first: the run ends); a station is furnished when a piece stands
 * within `NEAR` of that point.
 */
export const emptyRuns = (h: CoverHeader, chunk: LublinChunkData, pieces: readonly Piece[]): EmptyRun[] => {
  const pavement = new Uint8Array(h.width * h.height);
  for (const g of chunk.ground) if (PAVEMENT.has(g.surface)) for (const k of samplesIn(h, flatRing(g.outline))) pavement[k] = 1;
  for (const b of chunk.buildings) for (const k of samplesIn(h, flatRing(b.outline, b.x, b.z))) pavement[k] = 2;
  const at = (p: Pt) => {
    const [col, row] = [Math.floor((p.x - h.x0) / h.step), Math.floor((h.z1 - p.z) / h.step)];
    return col < 0 || row < 0 || col >= h.width || row >= h.height ? 0 : pavement[row * h.width + col]!;
  };
  const furniture = pieces.filter((p) => isFurniture(p.kind) && inRect(p, { minX: chunk.bounds.minX - REACH, maxX: chunk.bounds.maxX + REACH, minZ: chunk.bounds.minZ - REACH, maxZ: chunk.bounds.maxZ + REACH }));
  const out: EmptyRun[] = [];
  for (const s of chunk.streets) {
    if (NO_PAVEMENT.has(s.kind)) continue;
    const st = stations(flatRing(s.line));
    for (const side of [1, -1] as const) {
      let run: Pt[] = [];
      const close = () => {
        if ((run.length - 1) * STATION > EMPTY_RUN) out.push({ street: s.name || s.kind, side: side > 0 ? "left" : "right", length: (run.length - 1) * STATION, from: r1(run[0]!), to: r1(run[run.length - 1]!) });
        run = [];
      };
      for (const { p, n } of st) {
        let walk: Pt | undefined;
        for (let d = 2; d <= REACH && !walk; d += h.step) {
          const q = { x: p.x + n.x * d * side, z: p.z + n.z * d * side };
          const v = at(q);
          if (v === 2) break;
          if (v === 1) walk = q;
        }
        if (!walk) {
          close();
          continue;
        }
        if (furniture.some((f) => Math.hypot(f.x - walk!.x, f.z - walk!.z) <= NEAR)) close();
        else run.push(walk);
      }
      close();
    }
  }
  return out.sort((a, b) => b.length - a.length);
};
