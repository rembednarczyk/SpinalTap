import { pointInRing } from "../../osm-import/src/geometry.ts";
import { toLine } from "./lamp-band";

/**
 * Two checks of the lamps' looks by the squares (G-798 review):
 * - `lamp-freestanding-in-courtyard`: a lamp on a post (any `lamp-*` but the wall lantern) inside a
 *   courtyard, a pedestrian square whose outline runs along buildings (`courtyards.ts`). Dziedziniec
 *   Zamkowy is lit from its facades and its paving, with no post on the orthophoto of 2024-06.
 * - `lamp-square-style-leak`: a candelabrum further than `LEAK_REACH` from every line of the plan's
 *   candelabra (Plac Zamkowy, the castle's stairs): the square's look carried onto streets beside it
 *   (Podwale, lit by pastorals).
 */

type Pt = { readonly x: number; readonly z: number };
type Lamp = Pt & { readonly prop: string };
type Finding = { readonly at: string; readonly what: string };

/** How far from the plan's candelabra lines a candelabrum may stand (m): past a kerb lamp's offset and a slide along its line. */
export const LEAK_REACH = 12;

export const lampsFreestandingInCourtyard = (lamps: readonly Lamp[], courts: readonly { readonly id: string; readonly ring: readonly Pt[] }[]): Finding[] =>
  lamps.flatMap((l) => {
    if (!l.prop.startsWith("lamp-") || l.prop === "lamp-wall-lantern") return [];
    const court = courts.find((c) => pointInRing(l, c.ring));
    return court ? [{ at: `${l.x.toFixed(1)},${l.z.toFixed(1)}`, what: `${l.prop} on a post in the courtyard ${court.id}` }] : [];
  });

export const squareStyleLeak = (lamps: readonly Lamp[], lines: readonly (readonly Pt[])[], reach = LEAK_REACH): Finding[] =>
  lamps.flatMap((l) => {
    if (l.prop !== "lamp-candelabra") return [];
    const d = Math.min(Infinity, ...lines.map((line) => toLine(l, line)));
    return d > reach ? [{ at: `${l.x.toFixed(1)},${l.z.toFixed(1)}`, what: `lamp-candelabra ${Number.isFinite(d) ? d.toFixed(1) : "far"} m from the plan's candelabra lines` }] : [];
  });
