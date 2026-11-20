import type { Vec3 } from "@seki/core";
import { ROOM_CEILING, clinicPoint, koiPoint } from "./interiors";
import { TRASA_PODZIEMNA_ROOMS } from "./kanal-underground";
import { CAPSULE_INTERIOR_ROOM, CAPSULE_SITE } from "./capsule-room";
import { METRO_PLATFORMS } from "./metro";
import { P0_ROOM } from "./alchemia/foodhall";
import { P1_ROOMS } from "./alchemia/parking";
import { METRO_DOOR_ROOM } from "./alchemia/metro-door";
import { P2_ROOMS } from "./alchemia/p2";
import { SHELTER_ROOMS } from "./alchemia/shelter";
import { FOODHALL_ROOMS, GALLERY_ROOMS } from "./alchemia/mall-plan";
import { FRONT_ROOMS } from "./alchemia/front-shell";
import { CLINIC_SITE, KOI_SITE, TRASA_PODZIEMNA } from "./lublin/sites";
import { W3_OFFICE } from "./tessen-w3/tower-pipes";
import { W3_BASEMENT_ROOMS, W3_HALL_ROOMS } from "./tessen-w3/rooms";
import { W3_Y } from "./tessen-w3/site";

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
  /**
   * Stepping in saves no game (ADR-0082: inside W-3's fence the autosave waits for the metro or
   * a job taken); absent, it does (ADR-0061).
   */
  readonly autosave?: false;
}

/** A room of the clinic or the bar from two corners in its old coordinates (`interiors.ts`). */
const oldRoom = (point: (x: number, y: number, z: number) => Vec3, x0: number, x1: number, z0: number, z1: number, floor: number): InteriorRoom => {
  const a = point(x0, 0, z0);
  const b = point(x1, 0, z1);
  return { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z), bottom: floor, top: floor + ROOM_CEILING };
};

/** Tessen's pass office on the ground floor of W-3's tower (ADR-0082), inside its walls, up to its ceiling. */
/** A storey of Alchemia's gallery (its rectangles' `x0..z1`) as a room. */
const room = (r: { x0: number; x1: number; z0: number; z1: number; bottom: number; top: number }): InteriorRoom => ({ minX: r.x0, maxX: r.x1, minZ: r.z0, maxZ: r.z1, bottom: r.bottom, top: r.top });

const TESSEN_OFFICE_ROOM: InteriorRoom = {
  minX: W3_OFFICE.minX,
  maxX: W3_OFFICE.maxX,
  minZ: W3_OFFICE.minZ,
  maxZ: W3_OFFICE.maxZ,
  bottom: W3_Y,
  top: W3_Y + W3_OFFICE.top,
};

/** Every interior the player can walk into. A new one is one more entry (ADR-0061). */
export const INTERIORS: readonly InteriorDef[] = [
  { id: "clinic", name: "interior.clinic", building: CLINIC_SITE.building, rooms: [oldRoom(clinicPoint, -17, -7.3, 1.3, 7.7, CLINIC_SITE.floor)] },
  { id: "neon-koi", name: "interior.neon-koi", building: KOI_SITE.building, rooms: [oldRoom(koiPoint, 7.3, 17, -6.7, 10.7, KOI_SITE.floor)] },
  { id: "tessen-office", name: "interior.tessen-office", building: null, rooms: [TESSEN_OFFICE_ROOM] },
  // W-3's hall and its basement with the culvert (ADR-0082 stage 2), behind the fence: no autosave.
  { id: "w3-hall", name: "interior.w3-hall", building: null, rooms: W3_HALL_ROOMS, autosave: false },
  { id: "w3-basement", name: "interior.w3-basement", building: null, rooms: W3_BASEMENT_ROOMS, autosave: false },
  { id: "trasa-podziemna", name: "interior.trasa-podziemna", building: TRASA_PODZIEMNA.building, rooms: TRASA_PODZIEMNA_ROOMS },
  { id: "capsule", name: "interior.capsule", building: CAPSULE_SITE.building, rooms: [CAPSULE_INTERIOR_ROOM] },
  // The metro's platforms under the streets (ADR-0071 stage 4), the second flight down to each.
  ...METRO_PLATFORMS.map((e): InteriorDef => ({ id: `metro-${e.station}`, name: `interior.metro-${e.station}`, building: null, rooms: e.platform.rooms })),
  // Alchemia's food hall (ADR-0074 stage 1, under its terrace; on the gallery's P3 since ADR-0093 O3): a building of the game's own.
  { id: "alchemia-foodhall", name: "interior.alchemia-foodhall", building: null, rooms: FOODHALL_ROOMS.map(room) },
  // Its car park's upper level P-1 under T0 (stage 4): the deck, the apron and the stair core's foot.
  { id: "alchemia-parking", name: "interior.alchemia-parking", building: null, rooms: [...P1_ROOMS, METRO_DOOR_ROOM] },
  // Its lower level P-2 under P-1 (stage 5a): the automated store, the corridor north to its portal, the flight down.
  { id: "alchemia-p2", name: "interior.alchemia-p2", building: null, rooms: P2_ROOMS },
  // The air-raid shelter under T2 by P-2's north end (stage 5d1): its room, the passage, both flights.
  { id: "alchemia-shelter", name: "interior.alchemia-shelter", building: null, rooms: SHELTER_ROOMS },
  // Its gallery round the atrium (ADR-0093 O2): its shops' floors P0 (the old hall, O3), P1 and P2, and the front's storeys
  // joined to it, its arcades, units, café and bar (O5).
  { id: "alchemia-gallery", name: "interior.alchemia-gallery", building: null, rooms: [P0_ROOM, ...GALLERY_ROOMS.map(room), ...FRONT_ROOMS] },
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
