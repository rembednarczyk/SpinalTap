import type { ViewDescriptor } from "@seki/core";
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
  // The crate 3.5 m south of the guard, as before both moved onto the level ground (old z up to 38.4).
  crate(-3, 34.9, 1.6, 1.2, 1.2),
  crate(4, 38.5, 1.2, 1.2, 2.4, skin("dumpster", "x-")),
  // The big one takes a body (ADR-0065).
  { ...crate(11, 37.5, 2.4, 1.4, 1.4, skin("dumpster", "z-")), hide: "dumpster" },
  // Nosed in towards the yard, its back to the container (its lamps lit the yard, not the container's wall).
  crate(19.5, 37.5, 4.2, 1.5, 2, skin("car", "x-")),
  lamp(-1, 39, "#ff6a6a"),
];

/**
 * The solids of the scene's models (ADR-0102 point 5): the machine room's pump unit on its plinth, the chemistry's tray
 * and buckets by its west wall in the bay, the payment post at the way in.
 */
const modelSolids = (): StaticProp[] => [crate(16.18, 35.37, 1.35, 1.4, 0.74), crate(14.7, 27.3, 0.6, 0.8, 1.8), crate(6.8, 32.6, 0.6, 1.9, 0.5)];

/** No view of its own: the model draws it (`car-wash-detail.ts`), as the map's furniture's solids (`furnitureProps`). */
const NO_VIEW: ViewDescriptor = { kind: "street-props", items: [] };

/**
 * A placed block as a street solid (ADR-0050): a prism from its foot, without a view and see-through like the map's
 * furniture, so it may take an id from the chunk's street ids (`stream-catalog.ts`) like them.
 */
const asStreetSolid = (p: StaticProp): StaticProp => {
  if (p.view.kind !== "block") throw new Error("a street solid of the car wash must be a block");
  const { x: w, y: h, z: d } = p.view.size;
  const points = [
    { x: -w / 2, z: -d / 2 },
    { x: w / 2, z: -d / 2 },
    { x: w / 2, z: d / 2 },
    { x: -w / 2, z: d / 2 },
  ];
  return { center: v(p.center.x, p.center.y - h / 2, p.center.z), view: NO_VIEW, solid: true, prisms: [{ points, bottom: 0, top: h }], scenery: true, seeThrough: true };
};

/**
 * The car wash in the world. Apart from the rest of Krakowskie Przedmieście, which finds its
 * places by the map's buildings: the buildings cleared for the car wash depend on these.
 */
export const CAR_WASH_PROPS: readonly StaticProp[] = onPaving(placeProps(CAR_WASH_PLACE, carWash()));

/**
 * The solids of the scene's detail (`car-wash-detail.ts`): its models' blocks, the yard's container, barriers and lamp
 * and the clutter's, as the map's furniture's (ADR-0050). They go with the chunk's street solids, whose ids come from
 * `STREET_ID_BASE` and not the allocator (`stream-catalog.ts`), last in it: adding them moves no id of the content
 * (three blocks among the content's props moved every later id, W-3's people's too, and with them fights far off).
 */
export const CAR_WASH_SOLIDS: readonly StaticProp[] = [...onPaving(placeProps(CAR_WASH_PLACE, modelSolids())).map(asStreetSolid), ...furnitureProps(CAR_WASH_DETAIL)];
