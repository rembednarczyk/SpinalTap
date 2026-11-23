import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { groundY } from "./lublin/terrain";

/*
 * Plac po Farze after its card (`docs/lokacje/plac-po-farze.md`, ADR-0102 point 5). Pattern: environmental
 * storytelling (Smith and Worch, GDC 2010). The coin-op viewing telescope on the square's east side looking over the
 * escarpment to the Castle, its AR screen lit (Blender, `tools/blender/rooms/plac_po_farze.py`), and two benches by it
 * (the card: one bench on the terrace today): the game's furniture with their solids.
 */

/** The telescope on the square's open east side (4.6 m off the nearest wall), its view to the east. */
export const FARA_TELESCOPE = { x: 690, z: 55, yaw: Math.PI / 2 } as const;

const at = (prop: StreetPropItem["prop"], x: number, z: number, yaw: number, variant: number): StreetPropItem => ({ prop, x, y: groundY(x, z), z, yaw, variant });

/** The benches either side of the telescope, facing the view. */
export const FARA_BENCHES: readonly StreetPropItem[] = [at("bench", 688.6, 52.2, Math.PI / 2, 1), at("bench", 688.6, 57.8, Math.PI / 2, 1)];

export const PO_FARZE_DETAIL: readonly StreetPropItem[] = [
  { ...at("room-detail", FARA_TELESCOPE.x, FARA_TELESCOPE.z, FARA_TELESCOPE.yaw, 0), variant: roomDetailShape("rd-fara-telescope") },
  ...FARA_BENCHES,
];
