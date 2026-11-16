import { type GroundPoint, type TerrainGrid } from "@seki/core";
import { MAX_WALK_SLOPE } from "../../world/ground";
import { type Ramp } from "./shape";
import type { LublinChunkData } from "./types";

/**
 * The stretches of the ways walked on foot that the terrain makes too steep to walk (G-755): the
 * map draws no steps there, but the NMT falls faster than a walker climbs. The import grows each
 * until one even grade gets up it; here it is laid at that grade, from the terrain at its foot to
 * the terrain at its top, along the stretch's polyline, its ends square. Not as a ramp a segment:
 * a ramp's round end is level, and at a bend it would leave a landing and a ledge on the next
 * segment's grade.
 */

/** A stretch of a way as the import gives it: its polyline, foot first. */
export interface SteepWay {
  readonly id: string;
  readonly line: readonly GroundPoint[];
}

/** A stretch laid at an even grade: its polyline foot first, the heights there and how far round it it is laid. */
export interface WayRamp {
  readonly line: readonly GroundPoint[];
  readonly yFoot: number;
  readonly yTop: number;
  readonly width: number;
  readonly blend: number;
}

/**
 * How wide a stretch is laid (m): the terrain is bilinear between the points of the flights' 2.5 m
 * grid (`FLIGHT_CELL`), so the corners of the cells under the axis must take the grade too. A band
 * 3 m wide, as the steps', left the axis of w179264855 at 0.75 where the band's grade is 0.57.
 */
const WIDTH = 5;
/** How far beside it the terrain blends back into the map's (m). */
const BLEND = 1.5;
/** The axis's samples and the run its grade is taken over (m), as the glitch scan's `walk-blocked`. */
const [STEP, RUN] = [0.25, 2];

/** The stretches of the chunks, each once. */
export const steepWays = (chunks: readonly LublinChunkData[]): SteepWay[] => {
  const out: SteepWay[] = [];
  const seen = new Set<string>();
  for (const w of chunks.flatMap((c) => c.steepWays ?? [])) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    const line: GroundPoint[] = [];
    for (let i = 0; i + 1 < w.line.length; i += 2) line.push({ x: w.line[i]!, z: w.line[i + 1]! });
    if (line.length >= 2) out.push({ id: w.id, line });
  }
  return out;
};

/** The point `s` m along `line` (clamped to its ends). */
const pointAt = (line: readonly GroundPoint[], s: number): GroundPoint => {
  let left = Math.max(0, s);
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i]!, line[i + 1]!];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (left <= len) return { x: a.x + ((b.x - a.x) * left) / (len || 1), z: a.z + ((b.z - a.z) * left) / (len || 1) };
    left -= len;
  }
  return line[line.length - 1]!;
};

/** Is the ground `height` along `line` steeper than a walker climbs over `RUN` somewhere? */
const tooSteep = (line: readonly GroundPoint[], height: (x: number, z: number) => number): boolean => {
  let length = 0;
  for (let i = 0; i + 1 < line.length; i++) length += Math.hypot(line[i + 1]!.x - line[i]!.x, line[i + 1]!.z - line[i]!.z);
  const y = (s: number) => {
    const p = pointAt(line, s);
    return height(p.x, p.z);
  };
  for (let s = 0; s + RUN <= length; s += STEP) if (Math.abs(y(s + RUN) - y(s)) / RUN > MAX_WALK_SLOPE) return true;
  return false;
};

/**
 * The stretches still too steep on the game's terrain `height` (the pads, ramps and flights laid,
 * which may have levelled one already) and the decks over it (`ground` from the terrain's height),
 * each laid from that terrain at its foot to its top.
 */
export const wayRamps = (ways: readonly SteepWay[], height: (x: number, z: number) => number, ground: (x: number, z: number, terrain: number) => number = (_x, _z, h) => h): WayRamp[] =>
  ways.flatMap(({ line }) => {
    if (!tooSteep(line, (x, z) => ground(x, z, height(x, z)))) return [];
    const [foot, top] = [line[0]!, line[line.length - 1]!];
    return [{ line, yFoot: height(foot.x, foot.z), yTop: height(top.x, top.z), width: WIDTH, blend: BLEND }];
  });

/** The stretches' segments as ramps, for what reads only where they lie (`flightGrid`). */
export const waySegments = (ramps: readonly WayRamp[]): Ramp[] =>
  ramps.flatMap((r) => r.line.slice(1).map((b, i) => ({ a: r.line[i]!, b, ya: r.yFoot, yb: r.yTop, width: r.width, blend: r.blend })));

/** 1 inside, 0 beyond `blend`, smooth between (as the ramps' and pads' blend). */
const weight = (d: number, blend: number): number => {
  if (d <= 0) return 1;
  if (d >= blend) return 0;
  const t = 1 - d / blend;
  return t * t * (3 - 2 * t);
};

/**
 * How far (x, z) lies off the band `width` wide along `line` (0 on it) and how far along the line
 * it is (m), with the line's length. Its ends are square: past one the band does not go on level.
 */
const offBand = (line: readonly GroundPoint[], width: number, x: number, z: number): { d: number; s: number; length: number } => {
  let [d, s, at] = [Infinity, 0, 0];
  const last = line.length - 2;
  for (let i = 0; i <= last; i++) {
    const [a, b] = [line[i]!, line[i + 1]!];
    const [dx, dz] = [b.x - a.x, b.z - a.z];
    const len = Math.hypot(dx, dz) || 1;
    const u = ((x - a.x) * dx + (z - a.z) * dz) / len;
    const t = Math.max(0, Math.min(len, u));
    const over = (i === 0 && u < 0) || (i === last && u > len) ? Math.abs(u - t) : 0;
    const across = over > 0 ? Math.abs((x - a.x) * dz - (z - a.z) * dx) / len : Math.hypot(x - a.x - (t * dx) / len, z - a.z - (t * dz) / len);
    const e = Math.hypot(over, Math.max(0, across - width / 2));
    if (e < d) [d, s] = [e, at + t];
    at += len;
  }
  return { d, s, length: at };
};

/** Height at (x, z) after the stretches, from the height `h` there. */
export const wayRampHeight = (x: number, z: number, h: number, ramps: readonly WayRamp[]): number => {
  let out = h;
  for (const r of ramps) {
    const { d, s, length } = offBand(r.line, r.width, x, z);
    const w = weight(d, r.blend);
    if (w > 0) out += (r.yFoot + ((r.yTop - r.yFoot) * s) / (length || 1) - out) * w;
  }
  return out;
};

/** The grid with every point under a stretch laid. */
export const shapeWays = (g: TerrainGrid, ramps: readonly WayRamp[]): TerrainGrid => {
  if (ramps.length === 0) return g;
  const heights = g.heights.map((h, i) => wayRampHeight(g.originX + (i % g.cols) * g.cell, g.originZ + Math.floor(i / g.cols) * g.cell, h, ramps));
  return { ...g, heights };
};
