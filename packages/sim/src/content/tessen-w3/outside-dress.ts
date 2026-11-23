import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { groundY } from "../lublin/terrain";
import { W3_PLATFORM, W3_TOWER, W3_Y } from "./site";
import { W3_OFFICE_DOOR, W3_PIPE_LADDER } from "./tower-pipes";

/*
 * W-3's outside dressed after its scenes' cards (`docs/lokacje/w3-pas-publiczny.md`, `w3-wieza.md`,
 * `w3-rurociag-basen.md`, ADR-0102 point 5). Pattern: environmental storytelling (Smith and Worch, GDC 2010). Drawn only
 * (Blender, `tools/blender/rooms/w3_outside.py`): no solid and no light of their own, so W-3's people, its fights and
 * its night's draw calls stay as they were (the brazier stands where the crate's solid was).
 *
 * - The public strip: Genzō's brazier in the crate's place by KAIUN, his rods, cool box, net and chair under its wall.
 * - The tower: the smokers' corner by the pass office's door, the shift's water and a hard hat.
 * - The pipe walk: the fitters' bag, thermos and rope on the landing over the bank; the warning board and the chained
 *   foot of the ladder up to it.
 */

/** The crate by KAIUN the brazier is drawn over (`W3_PUBLIC_PROPS`), its foot sunk 0.15 m in the slope as the crate's. */
export const GENZO_BRAZIER = { x: 2492.6, z: 383.2, sink: 0.15 } as const;
/** KAIUN's north wall, east of its door: Genzō's things. */
export const KAIUN_WALL = { x: 2497.2, z: 386.02 } as const;
/** Beside the pass office's door on the tower's east wall, south of it. */
export const TOWER_SMOKERS = { x: W3_TOWER.maxX + 0.02, z: W3_OFFICE_DOOR.at.z + W3_OFFICE_DOOR.width / 2 + 1.2 } as const;
/** The landing over the bank at the pipe walk's west end. */
export const PIPE_LANDING = { x: 2444, z: 440.5 } as const;
/** The board at the ladder's foot, beside it, facing the riverside path. */
export const LADDER_BOARD = { x: W3_PIPE_LADDER.x + 1.2, z: W3_PIPE_LADDER.z - 0.3 } as const;

const model = (key: string, x: number, y: number, z: number, yaw: number): StreetPropItem => ({ prop: "room-detail", x, y, z, yaw, variant: roomDetailShape(key) });

/** W-3's outside models, in the order of the cards. */
export const W3_OUTSIDE_DETAIL: readonly StreetPropItem[] = [
  model("rd-w3-barrel", GENZO_BRAZIER.x, groundY(GENZO_BRAZIER.x, GENZO_BRAZIER.z) - GENZO_BRAZIER.sink, GENZO_BRAZIER.z, 0),
  model("rd-w3-genzo", KAIUN_WALL.x, groundY(KAIUN_WALL.x, KAIUN_WALL.z), KAIUN_WALL.z, 0),
  model("rd-w3-tower-door", TOWER_SMOKERS.x, W3_Y, TOWER_SMOKERS.z, Math.PI / 2),
  model("rd-w3-landing", PIPE_LANDING.x, W3_Y + W3_PLATFORM, PIPE_LANDING.z, 0),
  model("rd-w3-ladder-board", LADDER_BOARD.x, groundY(LADDER_BOARD.x, LADDER_BOARD.z), LADDER_BOARD.z, Math.PI),
];
