import type { Vec3 } from "@seki/core";
import { ESCALATORS, type Escalator, escalatorHead } from "@seki/sim";
import { type CityKitData, type GeometrySink, swatchUv } from "../city-kit-data";

/*
 * The gallery's escalators (ADR-0093 O1) as the eye knows them: the simulation's treads drawn in
 * steel (`alchemia-geometry.ts`), and here, along each side of a flight, a sloping balustrade of
 * glass with a black handrail on it and a steel skirt (the truss) under the treads. The simulation's
 * upright balustrade pieces are not drawn. Pure data, no Babylon.
 */

/** The balustrade's height over the treads' line, the handrail's size, the truss's depth under it. */
const RAIL = 0.95;
const HAND = 0.06;
const TRUSS = 0.55;
/** How far the balustrade runs on past either end, flat at the landings. */
const RUN_ON = 0.6;

const at = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/** The line of a flight's treads' noses: its height at x (flat before its foot and past its head). */
const lineAt = (e: Escalator, x: number): number => {
  const head = escalatorHead(e);
  const t = Math.max(0, Math.min(1, (x - e.x0) / (head - e.x0)));
  return e.from + t * (e.to - e.from);
};

/** A quad of a side from x0 to x1, its bottom and top following the flight's line plus `lo` and `hi`, facing `nz`. */
const side = (sink: GeometrySink, e: Escalator, z: number, x0: number, x1: number, lo: number, hi: number, nz: number, uv: readonly [number, number]): void => {
  const [a, b] = [lineAt(e, x0), lineAt(e, x1)];
  const n = { x: 0, y: 0, z: nz };
  // Counter-clockwise seen from the side it faces.
  if (nz > 0) sink.quad(at(x0, a + lo, z), at(x1, b + lo, z), at(x1, b + hi, z), at(x0, a + hi, z), n, uv);
  else sink.quad(at(x1, b + lo, z), at(x0, a + lo, z), at(x0, a + hi, z), at(x1, b + hi, z), n, uv);
};

/** One flight's balustrades, handrails and truss. */
const flight = (sink: GeometrySink, data: CityKitData, e: Escalator): void => {
  const head = escalatorHead(e);
  const [lo, hi] = [Math.min(e.x0, head), Math.max(e.x0, head)];
  // Break the run into three: flat before the lower end, the slope, flat past the upper.
  const xs = [lo - RUN_ON, lo, hi, hi + RUN_ON];
  const glass = swatchUv(data, "glass-blue");
  const steel = swatchUv(data, "metal");
  const dark = swatchUv(data, "dark");
  for (const [z, out] of [
    [e.lane.z0 - 0.03, -1],
    [e.lane.z1 + 0.03, 1],
  ] as const) {
    for (let i = 0; i + 1 < xs.length; i++) {
      const [x0, x1] = [xs[i]!, xs[i + 1]!];
      // Glass both ways, the steel skirt under the treads outside, the handrail along the top.
      side(sink, e, z, x0, x1, 0.1, RAIL, out, glass);
      side(sink, e, z, x0, x1, 0.1, RAIL, -out, glass);
      if (i === 1) side(sink, e, z + out * 0.02, x0, x1, -TRUSS, 0.1, out, steel);
      side(sink, e, z + out * HAND, x0, x1, RAIL, RAIL + HAND, out, dark);
      side(sink, e, z - out * HAND, x0, x1, RAIL, RAIL + HAND, -out, dark);
    }
  }
  // The truss's underside, a sloping steel soffit (none under the lowest flight: it stands on P0's floor).
  if (e.solid) return;
  const [a, b] = [lineAt(e, lo) - TRUSS, lineAt(e, hi) - TRUSS];
  sink.quad(at(lo, a, e.lane.z1), at(hi, b, e.lane.z1), at(hi, b, e.lane.z0), at(lo, a, e.lane.z0), { x: 0, y: -1, z: 0 }, steel);
};

/** Every escalator's balustrades. */
export const escalatorGeometry = (sink: GeometrySink, data: CityKitData): void => {
  for (const e of ESCALATORS) flight(sink, data, e);
};

/** Is a step piece one of an escalator's treads (drawn in steel)? */
export const onEscalator = (b: { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number }): boolean =>
  ESCALATORS.some((e) => {
    const head = escalatorHead(e);
    return b.x0 >= Math.min(e.x0, head) - 1e-6 && b.x1 <= Math.max(e.x0, head) + 1e-6 && b.z0 >= e.lane.z0 - 1e-6 && b.z1 <= e.lane.z1 + 1e-6;
  });
