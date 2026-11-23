import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { RIBS_X, RIBS_Z } from "./kanal-underground";
import { TRASA_PODZIEMNA } from "./lublin/sites";

/** The stair hall's east wall at the stairs' foot, where the exit sign hangs facing back up the stairs (west). */
export const TRASA_EXIT_SIGN = { x: 584.9, z: (TRASA_PODZIEMNA.stairs.minZ + TRASA_PODZIEMNA.stairs.maxZ) / 2 } as const;
/** Mei's poster on the loch's south wall, facing into it; the leak in the south corridor. */
export const MEI_POSTER = { x: 580.8, z: -62.05 } as const;
export const TRASA_LEAK = { x: 583.6, z: -62.0 } as const;

/*
 * Trasa Podziemna's detail after its card (`docs/pomieszczenia/trasa-podziemna.md`, ADR-0098): the models
 * Blender builds (`tools/blender/rooms/trasa.py`): brick arches where the corridors' ribs are, Mei's stage
 * and her speaker where their solids are (`kanal-underground.ts`, drawn no more); the route's boards, a rope
 * barrier, a homeless man's bedding and an old lamp, drawn only. A model's front (+z) faces the world's +z
 * at yaw 0, -z at π, -x at -π/2, +x at π/2; its x runs along the world's z at ±π/2. Pure data.
 */

const F = TRASA_PODZIEMNA.floor;
/** The cellars' ceiling (`C` of `kanal-underground.ts`) and the arches' springing under it. */
const C = F + 2.7;
const SPRING = C - 0.45;

const item = (key: string, x: number, y: number, z: number, yaw: number): StreetPropItem => ({ prop: "room-detail", x, y, z, yaw, variant: roomDetailShape(key) });

export const TRASA_DETAIL: readonly StreetPropItem[] = [
  // The south corridor's arches span its 2.4 m across x, the west corridor's its 2.1 m across z.
  ...RIBS_Z.map((z) => item("rd-trasa-arch-24", 583.8, SPRING, z, 0)),
  ...RIBS_X.map((x) => item("rd-trasa-arch-21", x, SPRING, -63.45, Math.PI / 2)),
  // Mei's stage and speaker face the loch's floor to the south.
  item("rd-trasa-stage", 579.75, F, -59.55, Math.PI),
  item("rd-trasa-speaker", 581.9, F, -59.0, Math.PI),
  // The boards: on the south corridor's east wall, facing west; on the west corridor's north wall, facing south.
  item("rd-trasa-board", 584.75, F, -60.4, -Math.PI / 2),
  item("rd-trasa-board", 580.2, F, -62.55, Math.PI),
  // The rope barrier along the west corridor's south wall, the bedding along the loch's east wall.
  item("rd-trasa-rope", 579.6, F, -64.25, 0),
  item("rd-trasa-bedding", 581.75, F, -61.2, Math.PI / 2),
  // The old lamp on the south corridor's east wall, over the warm strip.
  item("rd-trasa-lamp", 584.97, F + 1.6, -61, -Math.PI / 2),
  // The scene's card (ADR-0102 point 5): the way out marked at the stairs' foot (ISO 7010 E001, as Alchemia's and
  // W-3's), Mei's poster in the loch, the leak in the south corridor heard from its source (§17).
  item("rd-w3h-exit", TRASA_EXIT_SIGN.x, F + 2.25, TRASA_EXIT_SIGN.z, -Math.PI / 2),
  item("rd-trasa-poster", MEI_POSTER.x, F, MEI_POSTER.z, 0),
  item("rd-trasa-drip", TRASA_LEAK.x, F, TRASA_LEAK.z, 0),
];
