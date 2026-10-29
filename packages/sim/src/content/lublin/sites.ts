import type { Vec3 } from "@seki/core";
import { KRAKOWSKIE_CHUNKS } from "./krakowskie.generated";
import { NABRZEZE_CHUNKS } from "./nabrzeze.generated";
import { PODZAMCZE_CHUNKS } from "./podzamcze.generated";
import { STARE_MIASTO_CHUNKS } from "./stare-miasto.generated";
import { type GroundRect, type Pad, type Ramp, mapHeight, stepRamps } from "./shape";
import type { LublinChunkData } from "./types";

/**
 * Where the game's places stand in Lublin (ADR-0045): the hand-made set pieces moved into the
 * city (the market under the viaduct on Aleja Tysiąclecia, Tessen's docks on the Bystrzyca, the
 * car wash on Plac Łokietka), the interiors cut into real tenements on Krakowskie Przedmieście,
 * and the terrain shaped under them. World metres around `LUBLIN_ANCHOR` (ADR-0042).
 */

/** The map's chunks in table order (the generated data, before the game's shaping). */
export const MAP_CHUNKS: readonly LublinChunkData[] = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];

/** Height of the map's own terrain at (x, z). */
export const rawHeight = (x: number, z: number): number => mapHeight(MAP_CHUNKS, x, z);

const round = (y: number): number => Math.round(y * 100) / 100;

/**
 * The market of Podzamcze (ADR-0045): the old market under the elevated highway, now on Aleja
 * Tysiąclecia between Plac Zamkowy and the bus station; its deck is the viaduct over the
 * avenue. Its own coordinates (x 66..126, z 56..116) shift by this.
 */
export const MARKET_PLACE: Vec3 = { x: 689, y: -20.6, z: 260 };
/** Tessen's docks on the Bystrzyca (local x -40..34, z 90..218), reached by the metro only. */
export const DOCKS_PLACE: Vec3 = { x: 2560, y: -28.6, z: 300 };
/** The car wash at the end of the deptak, on Plac Łokietka (local x -6..22, z 25..49). */
export const CAR_WASH_PLACE: Vec3 = { x: 419, y: round(rawHeight(427, -115)), z: -152 };

/** The market's area in the world. */
export const MARKET_AREA: GroundRect = { minX: 755, maxX: 815, minZ: 316, maxZ: 376 };
/** The docks' yard and quay, and the basin dug in front of the quay. */
export const DOCKS_AREA: GroundRect = { minX: 2520, maxX: 2594, minZ: 390, maxZ: 450 };
export const DOCKS_BASIN: GroundRect = { minX: 2520, maxX: 2594, minZ: 452, maxZ: 500 };
export const CAR_WASH_AREA: GroundRect = { minX: 413, maxX: 441, minZ: -127, maxZ: -103 };

/**
 * A room cut into the ground floor of a tenement (ADR-0045). The front wall of the building is
 * straightened onto `front` (z of the facade); the room spans `rect` behind it, its floor at
 * `floor` (the ground outside the door), its own storey up to `floor + 4.2`.
 */
export interface RoomSite {
  /** OSM id of the building. */
  readonly building: string;
  /** The facade the door is in, at this z, facing south (-1) or north (+1). */
  readonly front: number;
  readonly faces: 1 | -1;
  readonly rect: GroundRect;
  readonly floor: number;
}

/** Height of the cut storey: the building's own floors start this far above the room's floor. */
export const ROOM_STOREY = 4.2;

const room = (building: string, front: number, faces: 1 | -1, minX: number, maxX: number, depth: number, door: { x: number; z: number }): RoomSite => ({
  building,
  front,
  faces,
  rect: faces < 0 ? { minX, maxX, minZ: front, maxZ: front + depth } : { minX, maxX, minZ: front - depth, maxZ: front },
  floor: round(rawHeight(door.x, door.z)),
});

/**
 * Doktor Mori's clinic, Krakowskie Przedmieście, north side (a tenement of four storeys with
 * shops, OSM way 67499277): the room x 318..325, 10 m deep behind the facade at z = -72.5.
 */
export const CLINIC_SITE: RoomSite = room("w67499277", -72.5, -1, 318, 325, 10, { x: 321.4, z: -73.6 });
/**
 * Neon Koi, across the deptak (OSM way 66330644): the room x 306.5..324.5, 10 m deep behind the
 * facade at z = -94.
 */
export const KOI_SITE: RoomSite = room("w66330644", -94, 1, 306.5, 324.5, 10, { x: 315, z: -92.9 });

export const ROOM_SITES: readonly RoomSite[] = [CLINIC_SITE, KOI_SITE];

/** Rectangles where the map's buildings and surfaces give way to a set piece. */
export const CLEARED: readonly GroundRect[] = [DOCKS_AREA, DOCKS_BASIN];
/** Rectangles where only the map's buildings give way (the surfaces stay under the market). */
export const CLEARED_BUILDINGS: readonly GroundRect[] = [MARKET_AREA, DOCKS_AREA, DOCKS_BASIN, CAR_WASH_AREA];

/** A rectangle grown by `d` metres on every side (or by `d` and `north` on the north side). */
const grow = (r: GroundRect, d: number, north = d): GroundRect => ({ minX: r.minX - d, maxX: r.maxX + d, minZ: r.minZ - d, maxZ: r.maxZ + north });

/**
 * The terrain levelled under the set pieces and the rooms; the docks' basin dug 3 m down. The
 * terrain is bilinear between grid points up to 5 m apart, so a pad is levelled a cell beyond
 * what must be flat (the docks' quay ends at the basin instead, which starts 2 m out).
 */
export const PADS: readonly Pad[] = [
  { rect: grow(MARKET_AREA, 2.5), y: MARKET_PLACE.y, blend: 5 },
  { rect: grow(DOCKS_AREA, 5, 0), y: DOCKS_PLACE.y, blend: 6 },
  { rect: DOCKS_BASIN, y: DOCKS_PLACE.y - 3, blend: 1.5 },
  { rect: grow(CAR_WASH_AREA, 5), y: CAR_WASH_PLACE.y, blend: 3 },
  ...ROOM_SITES.map((r): Pad => ({ rect: grow(r.rect, 5), y: r.floor, blend: 2 })),
];

/** Even ramps along the steps of the map (ADR-0045). */
export const RAMPS: readonly Ramp[] = stepRamps(MAP_CHUNKS);
