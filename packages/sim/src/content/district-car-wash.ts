import { type StaticProp, building, crate, lamp, neon, placeProps, skin, slab, v } from "./builders";
import { CAR_WASH_PLACE } from "./lublin/sites";
import { onPaving } from "./lublin/terrain";

/**
 * MYJNIA 24H (ADR-0026) in a yard behind Plac Łokietka: the machine room, a canopy on two posts over the
 * bay, the wash gantry and a car being washed; the yard behind it (north) with a dumpster,
 * crates and a parked car is the contract site `car_wash`. Old coordinates, placed by
 * `CAR_WASH_PLACE`.
 */
const carWash = (): StaticProp[] => [
  building(18, 30.5, 6, 4.6, 9, "concrete", skin("shop", "x-", { signs: false })),
  // Canopy and gantry beam: visual, and thicker than a sidewalk so the minimap skips them.
  slab(11.6, 4.45, 30.5, v(7, 0.36, 8.4), "metal"),
  building(8.4, 26.6, 0.3, 4.3, 0.3, "metal"),
  building(8.4, 34.4, 0.3, 4.3, 0.3, "metal"),
  building(12.5, 27.6, 1.2, 3.4, 0.3, "glass"),
  building(12.5, 33.4, 1.2, 3.4, 0.3, "glass"),
  slab(12.5, 3.5, 30.5, v(1.2, 0.36, 5.5), "metal"),
  crate(11.2, 30.5, 4.2, 1.5, 2, skin("car", "x+")),
  neon(8.2, 5.1, 30.5, v(0.15, 0.9, 6), "#ff4040", "MYJNIA 24H"),
  // The yard: crates, two dumpsters and a parked car, a lamp.
  crate(-3, 36, 1.6, 1.2, 1.2),
  crate(4, 38.5, 1.2, 1.2, 2.4, skin("dumpster", "x-")),
  crate(-5, 44, 2.4, 1.4, 1.4, skin("dumpster", "z-")),
  crate(5.5, 45.5, 2, 1.5, 4.2, skin("car", "z+")),
  lamp(-1, 40, "#ff6a6a"),
];

/**
 * The car wash in the world. Apart from the rest of Krakowskie Przedmieście, which finds its
 * places by the map's buildings: the buildings cleared for the car wash depend on these.
 */
export const CAR_WASH_PROPS: readonly StaticProp[] = onPaving(placeProps(CAR_WASH_PLACE, carWash()));
