import type { Vec3 } from "@seki/core";
import { placeRect } from "./builders";
import { ROOM_CEILING, clinicPoint, koiPoint } from "./interiors";
import { TRASA_PODZIEMNA_ROOMS } from "./kanal-underground";
import { CLINIC_SITE, DOCKS_PLACE, KOI_SITE, TRASA_PODZIEMNA } from "./lublin/sites";

/**
 * Interiors as areas (ADR-0061): where the player counts as inside a place, for the
 * `InteriorEntered` and `InteriorLeft` events (autosave, the ambience of ADR-0060). Each place
 * is one or more boxes, axis-aligned in the world, inside the walls of its shell from ADR-0038:
 * the floor at `bottom`, the underside of the ceiling at `top`.
 */
export interface InteriorRoom {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly bottom: number;
  readonly top: number;
}

export interface InteriorDef {
  readonly id: string;
  /** The name's key in the `i18n/{en,pl}` catalogues (ADR-0056). */
  readonly name: `interior.${string}`;
  /**
   * The OSM building the interior is cut into, for the glitch scan's check that it stays inside
   * the building's outline and under its eaves; null for a set piece of the game's own.
   */
  readonly building: string | null;
  readonly rooms: readonly InteriorRoom[];
}

/** A room of the clinic or the bar from two corners in its old coordinates (`interiors.ts`). */
const oldRoom = (point: (x: number, y: number, z: number) => Vec3, x0: number, x1: number, z0: number, z1: number, floor: number): InteriorRoom => {
  const a = point(x0, 0, z0);
  const b = point(x1, 0, z1);
  return { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z), bottom: floor, top: floor + ROOM_CEILING };
};

/** Tessen's office on the quay, inside its walls (`district-doki.ts`), up to the roof deck. */
const TESSEN_OFFICE_ROOM: InteriorRoom = {
  ...placeRect(DOCKS_PLACE, { minX: -29.7, maxX: -18.3, minZ: 128.3, maxZ: 137.7 }),
  bottom: DOCKS_PLACE.y,
  top: DOCKS_PLACE.y + 3.6,
};

/** Every interior the player can walk into. A new one is one more entry (ADR-0061). */
export const INTERIORS: readonly InteriorDef[] = [
  { id: "clinic", name: "interior.clinic", building: CLINIC_SITE.building, rooms: [oldRoom(clinicPoint, -17, -7.3, 1.3, 7.7, CLINIC_SITE.floor)] },
  { id: "neon-koi", name: "interior.neon-koi", building: KOI_SITE.building, rooms: [oldRoom(koiPoint, 7.3, 17, -6.7, 10.7, KOI_SITE.floor)] },
  { id: "tessen-office", name: "interior.tessen-office", building: null, rooms: [TESSEN_OFFICE_ROOM] },
  { id: "trasa-podziemna", name: "interior.trasa-podziemna", building: TRASA_PODZIEMNA.building, rooms: TRASA_PODZIEMNA_ROOMS },
];

/** Feet this far under a room's floor still count (a floor slab, a step down the stairs). */
const FEET_SLACK = 0.3;

const inRoom = (r: InteriorRoom, p: Vec3, margin: number): boolean =>
  p.x > r.minX - margin && p.x < r.maxX + margin && p.z > r.minZ - margin && p.z < r.maxZ + margin && p.y > r.bottom - FEET_SLACK && p.y < r.top;

/**
 * The interior the feet at `p` are in, or null. The interior the player is already in holds on
 * `keep` metres past its walls, so standing in a doorway does not flicker in and out.
 */
export const interiorAt = (p: Vec3, current: string | null = null, keep = 0): InteriorDef | null => {
  const held = current === null ? undefined : INTERIORS.find((i) => i.id === current);
  if (held?.rooms.some((r) => inRoom(r, p, keep))) return held;
  return INTERIORS.find((i) => i.rooms.some((r) => inRoom(r, p, 0))) ?? null;
};
