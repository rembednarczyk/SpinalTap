import { type StaticProp, building, crate, lamp, neon, placeProps, skin, slab, v } from "./builders";
import { CAR_WASH_DETAIL } from "./car-wash-detail";
import { furnitureProps } from "./lublin/furniture";
import { CAR_WASH_PLACE } from "./lublin/sites";
import { onPaving } from "./lublin/terrain";

/**
 * MYJNIA 24H (ADR-0026) in a yard behind Plac Łokietka: the machine room, a canopy on two posts over the
 * bay, the wash gantry and a car being washed; the yard behind it (north) with a dumpster,
 * crates and a parked car is the contract site `car_wash`. Old coordinates, placed by
 * `CAR_WASH_PLACE`. The gantry is drawn by its model (`car-wash-detail.ts`, ADR-0102 point 5): its
 * blocks stay solids without a view (`scenery`), as a room's blocks under its Blender detail.
 */

/** A block of the set piece whose look is a model of `CAR_WASH_DETAIL`: its solid stays, its box is drawn no more. */
const drawnByModel = (p: StaticProp): StaticProp => ({ ...p, scenery: true });

const carWash = (): StaticProp[] => [
  building(18, 30.5, 6, 4.6, 9, "concrete", skin("shop", "x-", { signs: false })),
  // Canopy and gantry beam: visual, and thicker than a sidewalk so the minimap skips them.
  slab(11.6, 4.45, 30.5, v(7, 0.36, 8.4), "metal"),
  building(8.4, 26.6, 0.3, 4.3, 0.3, "metal"),
  building(8.4, 34.4, 0.3, 4.3, 0.3, "metal"),
  drawnByModel(building(12.5, 27.6, 1.2, 3.4, 0.3, "glass")),
  drawnByModel(building(12.5, 33.4, 1.2, 3.4, 0.3, "glass")),
  drawnByModel(slab(12.5, 3.5, 30.5, v(1.2, 0.36, 5.5), "metal")),
  crate(11.2, 30.5, 4.2, 1.5, 2, skin("car", "x+")),
  neon(8.2, 5.1, 30.5, v(0.15, 0.9, 6), "#ff4040", "MYJNIA 24H"),
  // The yard: crates, two dumpsters and a parked car, a lamp. All on its level ground, local z up
  // to 39 (G-754): north of it the yard falls to Bajkowskiego on the NMT.
  crate(-3, 36, 1.6, 1.2, 1.2),
  crate(4, 38.5, 1.2, 1.2, 2.4, skin("dumpster", "x-")),
  // The big one takes a body (ADR-0065).
  { ...crate(11, 37.5, 2.4, 1.4, 1.4, skin("dumpster", "z-")), hide: "dumpster" },
  crate(19.5, 37.5, 4.2, 1.5, 2, skin("car", "x+")),
  lamp(-1, 39, "#ff6a6a"),
  // The solids of the scene's models (ADR-0102 point 5), last so the ids above stay: the machine room's pump unit on its
  // plinth, the chemistry's tray and buckets by its west wall in the bay, the payment post at the way in.
  drawnByModel(crate(16.18, 35.37, 1.35, 1.4, 0.74)),
  drawnByModel(crate(14.7, 27.3, 0.6, 0.8, 1.8)),
  drawnByModel(crate(6.8, 32.6, 0.6, 1.9, 0.5)),
];

/**
 * The car wash in the world. Apart from the rest of Krakowskie Przedmieście, which finds its
 * places by the map's buildings: the buildings cleared for the car wash depend on these.
 */
export const CAR_WASH_PROPS: readonly StaticProp[] = [
  ...onPaving(placeProps(CAR_WASH_PLACE, carWash())),
  // The yard's container, crowd barrier and lamp and the clutter's solids, as the map's furniture's (ADR-0050).
  ...furnitureProps(CAR_WASH_DETAIL),
];
