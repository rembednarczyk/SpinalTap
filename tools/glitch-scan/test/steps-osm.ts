/**
 * Flights of steps against the map's count of their steps and the terrain under them (G-840):
 * `steps-count-osm`, a way with a `step_count` drawn with more or fewer risers along it than
 * `max(1, 10%)` off the count; `steps-landing-osm`, a landing inside a run of such a way where
 * its count fits one flight of the norm's stride with no landing; `steps-tread-sunk`, a tread of
 * a band more than 0.02 m (less its lift) under the ground along its axis. Read from the faces
 * the renderer draws, on the ground the game walks.
 */
import { STEP_NORM, pointInRingEvenOdd } from "../../../packages/core/src";
import { orientedBox } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { STEPS_BEND, underground } from "../../osm-import/src/ground.ts";
import { simplifyLine } from "../../osm-import/src/geometry.ts";
import { type StepFace, treadAt } from "./steps-faces";
import type { MapWay } from "./steps-walls";

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };

/** A tread stands this over the ground it is laid on (`planSteps`' lift, m). */
const LIFT = 0.05;
/** How far a tread may lie under the ground along its axis, less its lift (m). */
export const SUNK = 0.02;
/** Along a run, a riser is a change of level of more than this between two samples (m): more than a kerb's lift. */
const JUMP = 0.06;
/** The run is read every this (m), from this past either end. */
const STEP = 0.05;
const PAST = 0.3;
/** Off the axis by this (m): the strips a wide flight is cut into meet on its axis when there are two. */
const ASIDE = 0.3;

/** A drawn band of steps: its ring and faces. */
export interface DrawnBand {
  readonly ring: readonly Pt[];
  readonly faces: readonly StepFace[];
}

/** The risers along the run `a`-`b` as drawn: where along it (m from `a`) the level changes. */
const risersAlong = (a: Pt, b: Pt, bands: readonly DrawnBand[], ground: (p: Pt) => number): number[] => {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const [ux, uz] = [(b.x - a.x) / len, (b.z - a.z) / len];
  const out: number[] = [];
  let last: number | null = null;
  for (let s = -PAST; s <= len + PAST + 1e-9; s += STEP) {
    const p = { x: a.x + ux * s - uz * ASIDE, z: a.z + uz * s + ux * ASIDE };
    const y = bands.reduce<number | null>((m, band) => {
      const t = treadAt(band.faces, p);
      return t !== null && (m === null || t > m) ? t : m;
    }, null) ?? ground(p) + LIFT;
    if (last !== null && Math.abs(y - last) > JUMP) out.push(s);
    last = y;
  }
  return out;
};

/** The ways of `ways` with a `step_count` on the map (`onMap` at both ends), each straight run as the import cuts it, with its share of the count. */
const countedRuns = (ways: readonly MapWay[], onMap: (p: Pt) => boolean) =>
  ways.flatMap((w) => {
    const count = Number(w.tags.step_count);
    if (w.tags.highway !== "steps" || underground(w.tags) || !Number.isInteger(count) || count <= 0) return [];
    if (!onMap(w.line[0]!) || !onMap(w.line[w.line.length - 1]!)) return [];
    const runs = simplifyLine(w.line, STEPS_BEND);
    const lens = runs.slice(1).map((b, i) => Math.hypot(b.x - runs[i]!.x, b.z - runs[i]!.z));
    const total = lens.reduce((x, y) => x + y, 0);
    return [{ w, count, runs: runs.slice(1).map((b, i) => ({ a: runs[i]!, b, share: (count * lens[i]!) / total })) }];
  });

/** The bands near the line `pts` (2 m). */
const near = (bands: readonly DrawnBand[], pts: readonly Pt[]) => {
  const [x0, x1] = [Math.min(...pts.map((p) => p.x)) - 2, Math.max(...pts.map((p) => p.x)) + 2];
  const [z0, z1] = [Math.min(...pts.map((p) => p.z)) - 2, Math.max(...pts.map((p) => p.z)) + 2];
  return bands.filter((b) => {
    const xs = b.ring.map((p) => p.x);
    const zs = b.ring.map((p) => p.z);
    return Math.min(...xs) <= x1 && Math.max(...xs) >= x0 && Math.min(...zs) <= z1 && Math.max(...zs) >= z0;
  });
};

const at = (p: Pt) => `${p.x.toFixed(0)},${p.z.toFixed(0)}`;

/** `steps-count-osm`: each way with a `step_count` whose drawn risers along it differ from it by more than max(1, 10%). */
export const stepsCountOsm = (ways: readonly MapWay[], bands: readonly DrawnBand[], ground: (p: Pt) => number, onMap: (p: Pt) => boolean): Finding[] =>
  countedRuns(ways, onMap).flatMap(({ w, count, runs }) => {
    const mine = near(bands, w.line);
    const drawn = runs.reduce((n, r) => n + risersAlong(r.a, r.b, mine, ground).length, 0);
    return Math.abs(drawn - count) > Math.max(1, 0.1 * count) ? [{ at: at(w.line[0]!), what: `${w.id} step_count ${count}, drawn ${drawn}` }] : [];
  });

/**
 * `steps-landing-osm`: each run of a way with a `step_count` drawn with a landing (a level
 * stretch of at least `landingMin` between two of its risers) where its share of the count fills
 * the run as one flight of the norm's stride, treads alike, on the rise of its ends.
 */
export const stepsLandingOsm = (ways: readonly MapWay[], bands: readonly DrawnBand[], ground: (p: Pt) => number, onMap: (p: Pt) => boolean): Finding[] =>
  countedRuns(ways, onMap).flatMap(({ w, runs }) => {
    const mine = near(bands, w.line);
    return runs.flatMap(({ a, b, share }) => {
      const n = Math.round(share);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const r = Math.abs(ground(b) - ground(a)) / Math.max(1, n);
      // One flight fills the run: n treads alike within the stride.
      const stride = 2 * r + len / Math.max(1, n);
      if (n < 2 || stride < STEP_NORM.strideMin - 1e-6 || stride > STEP_NORM.strideMax + 1e-6) return [];
      const us = risersAlong(a, b, mine, ground);
      const landing = us.slice(1).findIndex((u, i) => u - us[i]! >= STEP_NORM.landingMin - 1e-6);
      return landing < 0 ? [] : [{ at: at(a), what: `${w.id} ${n} steps on ${len.toFixed(1)} m, a landing ${(us[landing + 1]! - us[landing]!).toFixed(2)} m at ${us[landing]!.toFixed(1)} m` }];
    });
  });

/** `steps-tread-sunk`: each band with a tread more than `SUNK` (less its lift) under the ground on its axis, at its deepest. */
export const stepsTreadSunk = (bands: readonly { readonly id: string; readonly band: DrawnBand }[], ground: (p: Pt) => number, onMap: (p: Pt) => boolean): Finding[] =>
  bands.flatMap(({ id, band }) => {
    if (band.ring.length < 3) return [];
    const box = orientedBox(band.ring);
    let worst: { by: number; p: Pt } | null = null;
    for (let u = -box.halfLong + 0.05; u < box.halfLong - 0.05; u += 0.1) {
      const p = { x: box.cx + box.ux * u, z: box.cz + box.uz * u };
      // In the band, on the map: past a cut edge the box runs on over no ground of the map (G-703).
      if (!onMap(p) || !pointInRingEvenOdd(p.x, p.z, band.ring)) continue;
      const y = treadAt(band.faces, p);
      if (y === null) continue;
      const by = ground(p) - (y - LIFT);
      if (by > SUNK && (!worst || by > worst.by)) worst = { by, p };
    }
    return worst ? [{ at: at(worst.p), what: `${id} tread ${worst.by.toFixed(2)} m under the ground` }] : [];
  });
