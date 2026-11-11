import { BARRIER_OPENINGS, BARRIER_THICKNESS, type GroundPoint, type StreetPropItem, barrierMaterial } from "@seki/core";
import { barrierBlocked, pointsOf } from "./barrier-room";
import { barrierPieces } from "./lublin/barriers";
import { MAP_CHUNKS } from "./lublin/sites";
import { clearOfGame } from "./street-props";
import { groundY } from "./lublin/terrain";
import type { LublinBarrierData } from "./lublin/types";

export { barrierBlocked } from "./barrier-room";

/**
 * The map's barriers in the game (ADR-0077 point 4): each chunk's walls, fences and hedges laid
 * as street pieces (`lublin/barriers.ts`), cut where the game's content needs the way clear
 * (`barrier-room.ts`).
 */

type Pt = GroundPoint;

/** Tested every this many metres; a stretch shorter than `MIN_RUN` left between cuts goes too. */
const STEP = 0.25;
const MIN_RUN = 0.6;

/** The stretches of a polyline the game leaves clear of: tested every `STEP` metres, runs shorter than `MIN_RUN` dropped. */
const clearRuns = (line: readonly Pt[], half: number): Pt[][] => {
  const out: Pt[][] = [];
  let run: Pt[] = [];
  const close = () => {
    let len = 0;
    for (let k = 1; k < run.length; k++) len += Math.hypot((run[k] as Pt).x - (run[k - 1] as Pt).x, (run[k] as Pt).z - (run[k - 1] as Pt).z);
    if (len >= MIN_RUN) out.push(run);
    run = [];
  };
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i] as Pt;
    const b = line[i + 1] as Pt;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / STEP));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const p = { x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n };
      // A corner is tested along both its sides: a route may cross the one and run along the other.
      const c = k === n ? line[i + 2] : undefined;
      if (barrierBlocked(p.x, p.z, half, { x: b.x - a.x, z: b.z - a.z }) || (c !== undefined && barrierBlocked(p.x, p.z, half, { x: c.x - b.x, z: c.z - b.z }))) close();
      else run.push(p);
    }
  }
  close();
  return out.map(simplifyRun);
};

/** Drops the samples of a run on a straight line between its neighbours: it keeps its corners and ends. */
const simplifyRun = (run: readonly Pt[]): Pt[] =>
  run.filter((p, k) => {
    if (k === 0 || k === run.length - 1) return true;
    const a = run[k - 1] as Pt;
    const b = run[k + 1] as Pt;
    return Math.abs((p.x - a.x) * (b.z - a.z) - (p.z - a.z) * (b.x - a.x)) > 1e-4;
  });

/** The pieces of one barrier of the map in the game: an opening whole where its posts stand clear, a solid kind in its clear runs. */
const piecesOf = (b: LublinBarrierData): StreetPropItem[] => {
  const line = pointsOf(b.line);
  const material = barrierMaterial(b.material);
  if (BARRIER_OPENINGS.has(b.kind)) return line.every((p) => clearOfGame(p.x, p.z, 0.2)) ? barrierPieces(b.kind, b.height, line, groundY, material) : [];
  return clearRuns(line, BARRIER_THICKNESS[b.kind] / 2).flatMap((run) => barrierPieces(b.kind, b.height, run, groundY, material));
};

/** The barriers of the game's Lublin per chunk (ADR-0077), as street pieces of kind `barrier`. */
export const WORLD_BARRIERS: Readonly<Record<string, readonly StreetPropItem[]>> = Object.fromEntries(
  MAP_CHUNKS.flatMap((c) => {
    const items = (c.barriers ?? []).flatMap(piecesOf);
    return items.length > 0 ? [[c.id, items]] : [];
  }),
);
