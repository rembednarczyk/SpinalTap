import { CLUTTER, type StreetPropItem } from "@seki/core";
import { againstWall } from "./lublin/places";
import { TERRITORY_GROUPS } from "./territory-groups";
import { groundY } from "./lublin/terrain";

/*
 * Lubartowska at the crossing with aleja Tysiąclecia after its card (`docs/lokacje/lubartowska.md`, ADR-0102 point 5).
 * Pattern: environmental storytelling (Smith and Worch, GDC 2010); the game's models before boxes of our own (§8): the
 * 24-hour kiosk on the pavement by the tenement where the Hebi group stands (`TERRITORY_GROUPS`, `lubartowska`), its
 * solid with the street's, its queue's spots the import's furniture gives a kiosk; what the group leaves round it (the
 * odds and ends of ADR-0096), drawn only.
 */

/** The Hebi group's ring on the pavement (`TERRITORY_GROUPS`, `lubartowska`): the scene goes where the group stands. */
const GROUP = TERRITORY_GROUPS.find((g) => g.territory === "lubartowska")!;
export const LUBARTOWSKA_RING = { x: GROUP.core.x, z: GROUP.core.z } as const;

const WALL = againstWall(LUBARTOWSKA_RING.x, LUBARTOWSKA_RING.z, 0);
const along = { x: Math.cos(WALL.yaw), z: -Math.sin(WALL.yaw) };
/** The kiosk's middle: 3.5 m along the tenement's front from the group's foot of the wall, its back 0.05 m off it. */
const KIOSK_WALL = againstWall(WALL.at.x + along.x * 3.5, WALL.at.z + along.z * 3.5, 1.05);
export const LUBARTOWSKA_KIOSK = { x: KIOSK_WALL.at.x, z: KIOSK_WALL.at.z, yaw: KIOSK_WALL.yaw } as const;

const at = (prop: StreetPropItem["prop"], x: number, z: number, yaw: number, variant: number): StreetPropItem => ({ prop, x, y: groundY(x, z), z, yaw, variant });

/** The kiosk, the game's furniture with its solid. */
export const LUBARTOWSKA_FURNITURE: readonly StreetPropItem[] = [at("kiosk", LUBARTOWSKA_KIOSK.x, LUBARTOWSKA_KIOSK.z, LUBARTOWSKA_KIOSK.yaw, 0)];

/** Round the group's ring (1.4 m): bottles and cups (`CLUTTER.litter`), a bag of cans, off the ring itself. */
const LITTER: readonly [number, number, number, number][] = [
  [CLUTTER.litter[0]!, 2.1, 0.4, 0.3],
  [CLUTTER.litter[1]!, -1.9, 0.9, 1.9],
  [CLUTTER.litter[0]!, 0.6, -2.2, 2.6],
  [CLUTTER.litter[0]!, -0.4, 2.3, 0.8],
  [CLUTTER.litter[1]!, 2.4, -1.3, 1.1],
  [CLUTTER.bags[1]!, -2.6, -1.4, 0.5],
];

export const LUBARTOWSKA_DETAIL: readonly StreetPropItem[] = [
  ...LUBARTOWSKA_FURNITURE,
  ...LITTER.map(([shape, dx, dz, yaw]) => at("clutter", LUBARTOWSKA_RING.x + dx, LUBARTOWSKA_RING.z + dz, yaw, shape)),
];
