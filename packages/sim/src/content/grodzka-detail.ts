import { type StreetPropItem, roomDetailShape } from "@seki/core";
import type { StaticProp } from "./builders";
import { furnitureProps, turnLocal } from "./lublin/furniture";
import { GATE_PASSAGES } from "./lublin/gate-passages";
import { againstWall } from "./lublin/places";
import { groundY } from "./lublin/terrain";

/*
 * Grodzka under the covered footbridge after its card (`docs/lokacje/grodzka-kladka.md`, ADR-0102 point 5). Pattern:
 * environmental storytelling (Smith and Worch, GDC 2010), the one-page level of Librande (GDC 2010).
 *
 * - The Hebi traders' table of beer crates against the house under the bridge, the chips in their trays (ink: Tetsu's
 *   „Hebi z Hebi, chipy za gotówkę”), what the group leaves where it stands. The territory's group and the crew of
 *   Kaito's job `kanal_bridge` are one trading party there: one fight (decision of 23.11 in the owner's absence).
 * - The bridge's downpipe on the house at its west end, dripping (§17: the sound under the bridge from its source).
 * - Brama Grodzka: two lanterns on its jambs under the vault (§13: the passage lit), the Lantern of Memory before it
 *   as the one light without neon (the card's P1 plan), the sign of the Tessen bus stop Hideo waits at.
 */

/** The traders' table against the house under the bridge, its middle 0.75 m off the wall, its long side along it. */
export const CHIPS_TABLE = againstWall(652, 76, 0.75);
/** The Hebi group's ring (`TERRITORY_GROUPS`, `grodzka-bridge`). */
export const GRODZKA_RING = { x: 650, z: 70 } as const;
/** The downpipe on the house at the bridge's west end. */
export const BRIDGE_DOWNPIPE = againstWall(651.6, 79.6, 0.02);
/** The Lantern of Memory before Brama Grodzka (754.5, 146.1). */
export const MEMORY_LANTERN = { x: 754.5, z: 146.1 } as const;
/** The Tessen bus stop's sign by the gate's east mouth, out of its way. */
export const TESSEN_STOP = againstWall(731.5, 152.5, 0.45);

const GATE = GATE_PASSAGES[1]!;
const LENGTH = Math.hypot(GATE.to.x - GATE.from.x, GATE.to.z - GATE.from.z);
const ALONG = { x: (GATE.to.x - GATE.from.x) / LENGTH, z: (GATE.to.z - GATE.from.z) / LENGTH } as const;
const NORTH = { x: -ALONG.z, z: ALONG.x } as const;
/** A point of Brama Grodzka's passage `t` metres from its west end, `off` to its left. */
export const inGrodzkaGate = (t: number, off = 0): { x: number; z: number } => ({ x: GATE.from.x + ALONG.x * t + NORTH.x * off, z: GATE.from.z + ALONG.z * t + NORTH.z * off });
/** The lanterns' places along the passage and their jambs; they hang this much lower than on a house's front. */
export const GRODZKA_GATE_LANTERNS = [
  { t: 9, side: 1 },
  { t: 24, side: -1 },
] as const;
export const GRODZKA_LANTERN_DROP = 1.3;

const piece = (prop: StreetPropItem["prop"], x: number, z: number, yaw: number, variant: number, up = 0): StreetPropItem => ({ prop, x, y: groundY(x, z) + up, z, yaw, variant });
const model = (key: string, x: number, z: number, yaw: number): StreetPropItem => piece("room-detail", x, z, yaw, roomDetailShape(key));

const lantern = (t: number, side: 1 | -1): StreetPropItem => {
  const p = inGrodzkaGate(t, side * (GATE.width / 2));
  return piece("lamp-wall-lantern", p.x, p.z, Math.atan2(-NORTH.x * side, -NORTH.z * side), 0, -GRODZKA_LANTERN_DROP);
};

/** The Lantern of Memory and the bus stop's sign, the game's furniture with their solids. */
export const GRODZKA_FURNITURE: readonly StreetPropItem[] = [piece("lamp-pastoral", MEMORY_LANTERN.x, MEMORY_LANTERN.z, 0, 0), piece("bus-stop", TESSEN_STOP.at.x, TESSEN_STOP.at.z, TESSEN_STOP.yaw, 0)];

/** The traders' table's solid (1.56 x 0.5 m, 0.67 m high): one stops at it (§7). */
const TABLE_SOLID: StaticProp = (() => {
  const turn = (x: number, z: number) => turnLocal(CHIPS_TABLE.yaw, x, z);
  return {
    center: { x: CHIPS_TABLE.at.x, y: CHIPS_TABLE.at.y, z: CHIPS_TABLE.at.z },
    view: { kind: "street-props", items: [] },
    solid: true,
    prisms: [{ points: [turn(-0.78, -0.25), turn(0.78, -0.25), turn(0.78, 0.25), turn(-0.78, 0.25)], bottom: 0, top: 0.67 }],
    scenery: true,
    seeThrough: true,
  };
})();

/** Grodzka's scene's solids for the street's ids of their chunks: the table, the lantern's post and the sign's. */
export const GRODZKA_SOLIDS: readonly StaticProp[] = [TABLE_SOLID, ...furnitureProps(GRODZKA_FURNITURE)];

/** The scene's models (`tools/blender/rooms/grodzka.py`), lanterns and furniture, in the order of the card. */
export const GRODZKA_DETAIL: readonly StreetPropItem[] = [
  model("rd-gr-chips", CHIPS_TABLE.at.x, CHIPS_TABLE.at.z, CHIPS_TABLE.yaw),
  model("rd-gr-litter", GRODZKA_RING.x, GRODZKA_RING.z, 0),
  model("rd-gr-downpipe", BRIDGE_DOWNPIPE.at.x, BRIDGE_DOWNPIPE.at.z, BRIDGE_DOWNPIPE.yaw),
  ...GRODZKA_GATE_LANTERNS.map((l) => lantern(l.t, l.side)),
  ...GRODZKA_FURNITURE,
];
