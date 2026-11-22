import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { koiPoint } from "./interiors";

/*
 * Neon Koi's detail after its card (`docs/pomieszczenia/neon-koi.md`, ADR-0098): the models Blender
 * builds (`tools/blender/rooms/neon_koi.py`) standing where the bar's solids are (`koi()` of
 * `interiors.ts`, whose blocks are drawn no more), and the things on the counter and the back bar.
 * Placed in the room's old coordinates and turned onto its facade by `koiPoint`: old -x (the room's side
 * of the counter) is the world's +z, old +z the world's +x, so a model's front (+z) faces the room at yaw
 * 0. Pure data.
 */

const item = (key: string, x: number, y: number, z: number, yaw: number): StreetPropItem => {
  const p = koiPoint(x, y, z);
  return { prop: "room-detail", x: p.x, y: p.y, z: p.z, yaw, variant: roomDetailShape(key) };
};

/** The counter's stools (old z), as the solids of `koi()`. */
const STOOLS = [-2.5, -1, 0.5, 2, 5] as const;

export const KOI_DETAIL: readonly StreetPropItem[] = [
  item("rd-koi-counter", 13.8, 0, 1.5, 0),
  item("rd-koi-shelf", 16.7, 0, 1.5, 0),
  item("rd-koi-aquarium", 16.7, 2.4, 1.5, 0),
  ...STOOLS.map((z) => item("rd-koi-stool", 12.8, 0, z, 0)),
  item("rd-koi-table", 9.65, 0, -4.15, 0),
  item("rd-koi-table", 9.65, 0, 7.25, 0),
  // The chairs face their tables: the one at old x 10.6 to old -x (the world's +z), the one at 8.7 the other way.
  item("rd-koi-chair", 10.6, 0, -4.15, 0),
  item("rd-koi-chair", 8.7, 0, 7.25, Math.PI),
  // The jukebox on the stage's side faces old -z, the world's -x.
  item("rd-koi-jukebox", 16.0, 0, 10.3, -Math.PI / 2),
  item("rd-koi-counter-things", 13.8, 1.1, 1.0, 0),
];
