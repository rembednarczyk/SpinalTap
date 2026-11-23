import { type StreetPropItem, roomDetailShape } from "@seki/core";
import type { StaticProp } from "./builders";
import { KOI_DOOR } from "./interiors";
import { furnitureProps, turnLocal } from "./lublin/furniture";
import { againstWall } from "./lublin/places";
import { groundY } from "./lublin/terrain";

/*
 * The deptak of Krakowskie Przedmieście in M0 after its card (`docs/lokacje/deptak-krakowskie.md`, ADR-0102 point 5).
 * Pattern: environmental storytelling (Smith and Worch, GDC 2010), the one-page level of Librande (GDC 2010) whose way
 * is the prologue's: the clinic, Babcia Ume, Neon Koi.
 *
 * - Neon Koi's door lit warm by a lantern over it (§13: the prologue's way is the lit one), a crate of empties and the
 *   menu board by it; the stand-up counter on its front with two stools, where the contract's night drinker stands
 *   (`BAR_SPOT`; the comment spoke of a counter the street did not have).
 * - Nobu's bench before PACHINKO (`enc_s7_pachinko`, ink: „Na ławce przed PACHINKO”), RAMEN's door, the gate Ume sleeps
 *   in from eleven with her broom, bucket and blanket (§14's clusters).
 */

/** A front's foot at (x, z) and its facing out of the wall. */
const front = (x: number, z: number) => againstWall(x, z, 0.02);

/** Neon Koi's front at its door's east side: the counter's middle, 1.3 m east of the door's middle. */
export const KOI_COUNTER = front(KOI_DOOR.at.x + 2.4, KOI_DOOR.at.z + 0.5);
/** Over Neon Koi's door: its lantern's foot on the front. */
export const KOI_LANTERN = front(KOI_DOOR.at.x, KOI_DOOR.at.z + 0.5);
/** Nobu's place on the bench before PACHINKO (`enc_s7_pachinko`) and the bench's middle behind it, facing the deptak. */
export const NOBU_SEAT = { x: 306, z: -77 } as const;
const PACHINKO_FRONT = front(306, -77);
/** A bench's seat is 0.67 m in front of its middle (`seats.ts`). */
export const NOBU_BENCH = { x: NOBU_SEAT.x - Math.sin(PACHINKO_FRONT.yaw) * 0.67, z: NOBU_SEAT.z - Math.cos(PACHINKO_FRONT.yaw) * 0.67, yaw: PACHINKO_FRONT.yaw } as const;
/** RAMEN's front under its neon, and the gate Ume sleeps in (329.2, -73.4). */
export const RAMEN_FRONT = front(314, -72.75);
export const UME_GATE = front(329.2, -73.4);

const model = (key: string, w: { readonly at: { readonly x: number; readonly z: number }; readonly yaw: number }): StreetPropItem => ({
  prop: "room-detail",
  x: w.at.x,
  y: groundY(w.at.x, w.at.z),
  z: w.at.z,
  yaw: w.yaw,
  variant: roomDetailShape(key),
});

/** The lantern over Koi's door (hung 1 m lower than on a house's front, over the door) and Nobu's bench. */
export const DEPTAK_FURNITURE: readonly StreetPropItem[] = [
  { prop: "lamp-wall-lantern", x: KOI_LANTERN.at.x, y: groundY(KOI_LANTERN.at.x, KOI_LANTERN.at.z) - 1, z: KOI_LANTERN.at.z, yaw: KOI_LANTERN.yaw, variant: 0 },
  { prop: "bench", x: NOBU_BENCH.x, y: groundY(NOBU_BENCH.x, NOBU_BENCH.z), z: NOBU_BENCH.z, yaw: NOBU_BENCH.yaw, variant: 1 },
];

/** The counter's solid (1.8 x 0.35 m off the front, 1.08 m high). */
const COUNTER_SOLID: StaticProp = {
  center: { x: KOI_COUNTER.at.x, y: groundY(KOI_COUNTER.at.x, KOI_COUNTER.at.z), z: KOI_COUNTER.at.z },
  view: { kind: "street-props", items: [] },
  solid: true,
  prisms: [{ points: [turnLocal(KOI_COUNTER.yaw, -0.9, 0), turnLocal(KOI_COUNTER.yaw, 0.9, 0), turnLocal(KOI_COUNTER.yaw, 0.9, 0.35), turnLocal(KOI_COUNTER.yaw, -0.9, 0.35)], bottom: 0, top: 1.08 }],
  scenery: true,
  seeThrough: true,
};

/** The deptak scene's solids for the street's ids of its chunk: the counter, the bench, the lantern's bracket. */
export const DEPTAK_SOLIDS: readonly StaticProp[] = [COUNTER_SOLID, ...furnitureProps(DEPTAK_FURNITURE)];

/** The deptak's models (`tools/blender/rooms/deptak.py`) and furniture, in the order of the card. */
export const DEPTAK_DETAIL: readonly StreetPropItem[] = [
  model("rd-dp-bar", KOI_COUNTER),
  model("rd-dp-koi-door", front(KOI_DOOR.at.x - 2.4, KOI_DOOR.at.z + 0.5)),
  model("rd-dp-ramen", RAMEN_FRONT),
  model("rd-dp-ume", UME_GATE),
  ...DEPTAK_FURNITURE,
];
