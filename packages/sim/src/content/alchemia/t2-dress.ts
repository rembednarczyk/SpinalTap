import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { groundY } from "../lublin/terrain";
import { HEBI_LOOKOUT_POST, HEBI_LOOKOUT_YAW } from "./market";
import { MEMORIAL } from "./plaza";

/*
 * T2 under the Arkady dressed after its card (`docs/lokacje/alchemia-t2-arkady.md`, ADR-0102 point 5). Pattern:
 * environmental storytelling (Smith and Worch, GDC 2010), the one-page level of Librande (GDC 2010) whose first frame
 * is the foot of the stairs from T1. Two factions of the place: the street (the Hebi under the arcades) and the memory
 * of the place (the stone of Plac Ofiar Getta, ADR-0074 §6), kept apart: no light by the stone but its candle's flame.
 *
 * - The stone's front: the square's name cut in it, pebbles on its top, a candle burning at its foot and one gone out,
 *   a ribbon on its bed (Blender, `tools/blender/rooms/alchemia_t2.py`), facing the stairs from T1.
 * - The outline of the early medieval settlement found under the square (`docs/plany/alchemia.md`, S9, S13) laid in
 *   the paving: the ring of its little square, four huts with their hearths, a plate. Drawn only, flush with T2.
 * - The lookout's post by the shelter's hatch: the drinks crate he sits on behind him, the radio on it, butts, a can.
 * - Where the Hebi group stands (`territory-groups.ts`, `alchemia-arcades`): butts, bottles, a crushed can, a pod.
 */

const model = (key: string, x: number, z: number, yaw = 0): StreetPropItem => ({ prop: "room-detail", x, y: groundY(x, z), z, yaw, variant: roomDetailShape(key) });

/** The stone's middle on the ground, its model facing south to the stairs from T1. */
export const T2_STONE = { x: (MEMORIAL.x0 + MEMORIAL.x1) / 2, z: (MEMORIAL.z0 + MEMORIAL.z1) / 2 } as const;
/** The settlement's outline: its little square's middle, clear of the stone's bed, the stairs and the hatch. */
export const T2_SETTLEMENT = { x: 437, z: 103.5 } as const;
/** The Hebi group's ring under the arcades (`TERRITORY_GROUPS`, `alchemia-arcades`). */
export const T2_HEBI_RING = { x: 449.5, z: 105.9 } as const;

/** The models on T2, in the order of the card. */
export const T2_DETAIL: readonly StreetPropItem[] = [
  model("rd-t2-tribute", T2_STONE.x, T2_STONE.z, Math.PI),
  model("rd-t2-settlement", T2_SETTLEMENT.x, T2_SETTLEMENT.z),
  model("rd-t2-lookout", HEBI_LOOKOUT_POST.x, HEBI_LOOKOUT_POST.z, HEBI_LOOKOUT_YAW),
  model("rd-t2-hebi", T2_HEBI_RING.x, T2_HEBI_RING.z),
];
