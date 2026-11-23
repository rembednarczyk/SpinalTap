import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { groundY } from "./lublin/terrain";

/*
 * The bus station after its card (`docs/lokacje/dworzec-autobusowy.md`, ADR-0102 point 5). Pattern: environmental
 * storytelling (Smith and Worch, GDC 2010). Kiku the fortune teller's table by the metro pavilion B, where she reads
 * palms at night (`enc_targ_fortune`, 18:00-2:00): she sits behind it with her back to the pavilion, the client before
 * it facing her (Blender, `tools/blender/rooms/dworzec.py`). Drawn only: the encounter's place stays walkable.
 */

/** Where Kiku's encounter stands (`ENCOUNTERS`, `targ_fortune`). */
export const KIKU_SPOT = { x: 745, z: 376 } as const;
/** Her table: 0.75 m west of her, its front to the west (the passers-by on the square). */
export const KIKU_TABLE = { x: KIKU_SPOT.x - 0.75, z: KIKU_SPOT.z, yaw: -Math.PI / 2 } as const;

export const DWORZEC_DETAIL: readonly StreetPropItem[] = [{ prop: "room-detail", x: KIKU_TABLE.x, y: groundY(KIKU_TABLE.x, KIKU_TABLE.z), z: KIKU_TABLE.z, yaw: KIKU_TABLE.yaw, variant: roomDetailShape("rd-dw-kiku") }];
