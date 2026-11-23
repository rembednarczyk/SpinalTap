import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { groundY } from "../lublin/terrain";
import { opening } from "./foodhall";
import { HANA_SPOT } from "./market";
import { HALL } from "./plan";

/*
 * T1 dressed after its card (`docs/lokacje/alchemia-t1.md`, ADR-0102 point 5): the square before the gallery's north
 * front lives by the market. Pattern: environmental storytelling (Smith and Worch, GDC 2010), the one-page level of
 * Librande (GDC 2010) whose first frame is the gallery's corner from the east ramp. What happened here a moment ago:
 * a delivery from Kaito came in, Hana took the tarp off half her cart and the cool box stands open on it.
 *
 * - Hana's handcart drawn where its solid stands (`ALCHEMIA_MARKET_PROPS`, the block no more drawn: `scenery`): wheels,
 *   legs, the tarp on its hoops, the cool box with the modules in foil, the crates of parts, the cable, her mug, the
 *   price board; the lamp's battery at its pole's foot. The cool box's compressor hums (§17).
 * - Fumiko's hatch: the striped awning, the noren, the red lantern, the menu, the kitchen's extract over the awning
 *   (its fan heard, §17); her three stools before it with what the night market left, the bowls and cups on its counter.
 * - Where people smoke under the front (`activity-spots.ts`): butts, cans and a trodden flyer (§14's clusters).
 * - The café garden at the front's west end and a bin by Fumiko's door: the game's furniture (§8, models before boxes),
 *   their solids with the street's (`T1_FURNITURE`).
 *
 * The way from the gallery's entrance (x 413..419) and its east door (x 425.6..427.1) to the cart stays free (the
 * raid's run and the player's way back).
 */

const hatch = opening("fumiko-hatch");
/** The middle of Fumiko's hatch along the front and the front wall's outer face. */
export const T1_HATCH = { x: (hatch.x0 + hatch.x1) / 2, z: HALL.maxZ } as const;
/** Hana's cart: the middle of its solid (`ALCHEMIA_MARKET_PROPS`). */
export const T1_CART = { x: HANA_SPOT.x + 1.3, z: HANA_SPOT.z } as const;
/** The kitchen's extract over the awning: its fan box 0.65 m out of the front, 1.4 m west of the hatch's middle. */
export const T1_EXTRACT = { x: T1_HATCH.x - 1.4, z: T1_HATCH.z + 0.65 } as const;
/** Where people smoke under the front (`activity-spots.ts`, `targ-front-wall*`). */
export const T1_SMOKERS: readonly number[] = [410, 422.5, 428.5];

const model = (key: string, x: number, z: number, yaw = 0): StreetPropItem => ({ prop: "room-detail", x, y: groundY(x, z), z, yaw, variant: roomDetailShape(key) });
const furniture = (prop: StreetPropItem["prop"], x: number, z: number, yaw: number, variant = 0): StreetPropItem => ({ prop, x, y: groundY(x, z), z, yaw, variant });

/** The café garden at the front's west end, between Fumiko's door and the gallery's entrance, and the bin by her door. */
export const T1_FURNITURE: readonly StreetPropItem[] = [furniture("cafe-garden", 410.2, 61.6, 0), furniture("waste-bin", 407.6, 58.45, 0)];

/** The models on T1, Blender's (`tools/blender/rooms/alchemia_t1.py`), in the order of the card. */
export const T1_DETAIL: readonly StreetPropItem[] = [
  model("rd-t1-cart", T1_CART.x, T1_CART.z),
  model("rd-t1-hatch", T1_HATCH.x, T1_HATCH.z),
  model("rd-t1-extract", T1_EXTRACT.x, T1_EXTRACT.z),
  model("rd-t1-stools", T1_HATCH.x, T1_HATCH.z),
  ...T1_SMOKERS.map((x, i) => model("rd-t1-butts", x, T1_HATCH.z, i * 0.4 - 0.4)),
  ...T1_FURNITURE,
];
