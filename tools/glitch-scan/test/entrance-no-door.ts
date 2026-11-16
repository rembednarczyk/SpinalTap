import type { StreetPropItem } from "../../../packages/core/src";
import { segmentDistance } from "../../../packages/core/src";

/**
 * `entrance-no-door` (G-781 round 2): an entrance of the map (`entrance=*`, `door=*`) within the
 * doors' reach of a drawn wall a door may take (`ENTRANCE_REACH`, rule 1 of `props-doors.ts`) with
 * no door within `NEAR` of it: the rules turned its slots down, so the entrance of Poczta Główna
 * (n4934217573) on the top of its flight was a bare wall once a footway no longer hid the steps.
 */

type Pt = { readonly x: number; readonly z: number };

/** How near the entrance its door stands (m): the slot nearest it, `SNAP` 1.5 m along the wall at most. */
export const NEAR = 2;

export const entrancesWithoutDoor = (
  entrances: readonly { readonly id: string; readonly p: Pt }[],
  walls: readonly { readonly a: Pt; readonly b: Pt }[],
  props: readonly StreetPropItem[],
  reach: number,
): { at: string; what: string }[] => {
  const doors = props.filter((i) => i.prop === "door");
  return entrances
    .filter((e) => walls.some((w) => segmentDistance(e.p.x, e.p.z, w.a.x, w.a.z, w.b.x, w.b.z) <= reach))
    .filter((e) => !doors.some((d) => Math.hypot(d.x - e.p.x, d.z - e.p.z) < NEAR))
    .map((e) => ({ at: `${e.p.x.toFixed(1)},${e.p.z.toFixed(1)}`, what: `entrance ${e.id} on a drawn wall, no door within ${NEAR} m` }));
};
