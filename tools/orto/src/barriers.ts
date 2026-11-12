/**
 * Barriers in a cell (ADR-0077 point 4): low walls, retaining walls, fences, hedges, gates and
 * barrier arms, as the map has them (`barrier=*` in `data/osm/*.json`) against what the game draws.
 *
 * The game draws the lines the importer writes to the chunks' `barriers` (`MAP_CHUNKS[].barriers`,
 * laid as street pieces of kind `barrier` by the simulation), not pieces of the furniture's table,
 * so a map line is drawn when its id is among them. A line crossing a chunk's edge is cut in two
 * there, one id. The extracts keep a way with `barrier=wall|retaining_wall` whatever its other
 * tags, but a fence or a hedge only with another key the importer reads (`osm.ts`): their counts
 * are a lower bound.
 */
import type { LublinBarrierData } from "../../../packages/sim/src/content/lublin/types.ts";
import { type Pt, type Rect } from "../../osm-import/src/geometry.ts";
import { type OsmData } from "../../osm-import/src/osm.ts";
import { geoToWorld } from "../../osm-import/src/project.ts";

/** The kinds asked about: OSM `barrier` values and the game's barrier kinds for them. */
export const BARRIER_KINDS = ["wall", "retaining_wall", "city_wall", "fence", "hedge", "gate", "lift_gate"] as const;
const GAME_KINDS: Readonly<Record<string, readonly string[]>> = {
  wall: ["wall"],
  retaining_wall: ["retaining-wall"],
  city_wall: ["city-wall"],
  fence: ["fence"],
  hedge: ["hedge"],
  gate: ["gate"],
  lift_gate: ["lift-gate"],
};

export interface BarrierLine {
  readonly id: string;
  readonly barrier: string;
  /** Metres of it inside the cell. */
  readonly length: number;
}

export interface BarrierReport {
  /** Per kind: the map's lines (count, m) and points in the cell, and the game's lines in it. */
  readonly kinds: Readonly<Record<string, { readonly osmLines: number; readonly osmMetres: number; readonly osmPoints: number; readonly game: number }>>;
  /** The map's lines in the cell the game does not draw, longest first. */
  readonly notDrawn: readonly BarrierLine[];
}

const inRect = (p: Pt, r: Rect) => p.x > r.minX && p.x < r.maxX && p.z > r.minZ && p.z < r.maxZ;

/** Whether a segment of a flat polyline has its middle in the cell. */
const crosses = (line: readonly number[], r: Rect) => {
  for (let i = 0; i + 3 < line.length; i += 2) if (inRect({ x: (line[i]! + line[i + 2]!) / 2, z: (line[i + 1]! + line[i + 3]!) / 2 }, r)) return true;
  return false;
};

/** `game`: the barriers of all the chunks, so a line cut at a chunk's edge counts whole. */
export const barrierReport = (osm: OsmData, rect: Rect, game: readonly LublinBarrierData[]): BarrierReport => {
  const lines: BarrierLine[] = [];
  const points: Record<string, number> = {};
  for (const w of osm.ways.values()) {
    const b = w.tags?.barrier;
    if (!b || !(BARRIER_KINDS as readonly string[]).includes(b)) continue;
    const pts = w.nodes.map((id) => osm.nodes.get(id)).filter((n) => n !== undefined).map((n) => geoToWorld(n.lat, n.lon));
    let length = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a, c] = [pts[i]!, pts[i + 1]!];
      if (inRect({ x: (a.x + c.x) / 2, z: (a.z + c.z) / 2 }, rect)) length += Math.hypot(c.x - a.x, c.z - a.z);
    }
    if (length > 0) lines.push({ id: `w${w.id}`, barrier: b, length: Math.round(length * 10) / 10 });
  }
  for (const n of osm.nodes.values()) {
    const b = n.tags?.barrier;
    if (b && (BARRIER_KINDS as readonly string[]).includes(b) && inRect(geoToWorld(n.lat, n.lon), rect)) points[b] = (points[b] ?? 0) + 1;
  }
  const drawn = new Set(game.map((b) => b.id));
  const kinds: Record<string, BarrierReport["kinds"][string]> = {};
  for (const k of BARRIER_KINDS) {
    const of = lines.filter((l) => l.barrier === k);
    kinds[k] = {
      osmLines: of.length,
      osmMetres: Math.round(of.reduce((s, l) => s + l.length, 0) * 10) / 10,
      osmPoints: points[k] ?? 0,
      game: new Set(game.filter((b) => GAME_KINDS[k]!.includes(b.kind) && crosses(b.line, rect)).map((b) => b.id)).size,
    };
  }
  return { kinds, notDrawn: lines.filter((l) => !drawn.has(l.id)).sort((a, b) => b.length - a.length) };
};
