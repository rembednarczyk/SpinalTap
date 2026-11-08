import type { Pt } from "../../../packages/sim/src/content/lublin/roads";
import { projectOn } from "../../../packages/sim/src/content/traffic";

/**
 * The cars of Alchemia's P-1 ramp on the street (G-510): a way they drive, each of its points on a
 * carriageway farther than `REACH` from the nearest lane, is a car off the traffic's lanes (on the
 * street's axis, across both lanes). The way's arcs (its turns off and onto the street, a
 * junction's arcs) are left out: they leave one lane for another.
 */

/** A way a car of the ramp drives: its points and the arc length ranges of its turns. */
export interface RampCarWay {
  readonly id: string;
  readonly points: readonly Pt[];
  readonly arcs: readonly (readonly [number, number])[];
}

/** A point farther than this from every lane is off them (m). */
export const REACH = 0.5;

export const rampCarsOffLane = (
  ways: readonly RampCarWay[],
  lanes: readonly (readonly Pt[])[],
  onCarriageway: (x: number, z: number) => boolean,
): { readonly at: string; readonly what: string }[] =>
  ways.flatMap((w) => {
    let s = 0;
    return w.points.flatMap(([x, z], i) => {
      if (i > 0) s += Math.hypot(x - w.points[i - 1]![0], z - w.points[i - 1]![1]);
      if (w.arcs.some(([a, b]) => s >= a - 1e-6 && s <= b + 1e-6) || !onCarriageway(x, z)) return [];
      const d = Math.min(...lanes.map((l) => projectOn(l, x, z).d));
      return d > REACH ? [{ at: `${x.toFixed(0)},${z.toFixed(0)}`, what: `${w.id} ${d.toFixed(2)} m` }] : [];
    });
  });
