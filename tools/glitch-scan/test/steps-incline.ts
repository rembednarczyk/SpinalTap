/**
 * Flights of steps climbing the wrong way (G-236): a way of `highway=steps` the map tags with
 * `incline=up` (rising along the way) or `incline=down` whose game terrain at its two ends goes
 * the other way by `AGAINST` or more. The renderer lays the treads on the terrain (`planSteps`),
 * so a walker goes down the steps the map says lead up.
 */
import { type MapWay } from "./steps-walls";

type Pt = { readonly x: number; readonly z: number };

/** How far the terrain may fall against a flight's `incline` before it reads as the wrong way (m). */
export const AGAINST = 0.3;

/** Each steps way of `ways` with both ends on the map (`onMap`) whose terrain `h` at its ends falls by `AGAINST` against its `incline`. */
export const stepsInclineAgainst = (ways: readonly MapWay[], h: (p: Pt) => number, onMap: (p: Pt) => boolean): { readonly at: string; readonly what: string }[] =>
  ways.flatMap((w) => {
    const sign = w.tags.incline === "up" ? 1 : w.tags.incline === "down" ? -1 : 0;
    const a = w.line[0];
    const b = w.line[w.line.length - 1];
    if (w.tags.highway !== "steps" || sign === 0 || !a || !b || !onMap(a) || !onMap(b)) return [];
    const rise = (h(b) - h(a)) * sign;
    if (rise > -AGAINST) return [];
    return [{ at: `${a.x.toFixed(0)},${a.z.toFixed(0)}`, what: `${w.id} incline=${w.tags.incline} but the terrain ${sign > 0 ? "falls" : "rises"} ${(-rise).toFixed(2)} m end to end` }];
  });
