import type { Vec3 } from "@seki/core";
import { KRAKOWSKIE_CHUNKS } from "./krakowskie.generated";
import { NABRZEZE_CHUNKS } from "./nabrzeze.generated";
import { PODZAMCZE_CHUNKS } from "./podzamcze.generated";
import { STARE_MIASTO_CHUNKS } from "./stare-miasto.generated";
import { GATE_PASSAGES, type PassageSite } from "./gate-passages";
import { type GroundRect, type Pad, type Ramp, mapHeight, stepRamps } from "./shape";
import type { LublinChunkData } from "./types";

/**
 * Where the game's places stand in Lublin (ADR-0045): the hand-made set pieces moved into the
 * city (the market under the viaduct on Aleja Tysiąclecia, Tessen's docks on the Bystrzyca, the
 * car wash in a yard behind Plac Łokietka), the interiors cut into real tenements on Krakowskie Przedmieście,
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
/**
 * The car wash in the tenements' yard behind Plac Łokietka, open to the car park off
 * Przystankowa (OSM way 179269921; local x -6..22, z 25..49). It stood on the square itself
 * before, in front of the town hall. Its north edge is the edge of the deptak's chunk, so the
 * courier and his guard load with the clinic's district, as they did on the square.
 */
export const CAR_WASH_PLACE: Vec3 = { x: 395, y: round(rawHeight(403, -32)), z: -69 };

/** The market's area in the world. */
export const MARKET_AREA: GroundRect = { minX: 755, maxX: 815, minZ: 316, maxZ: 376 };
/** The docks' yard and quay, and the basin dug in front of the quay. */
export const DOCKS_AREA: GroundRect = { minX: 2520, maxX: 2594, minZ: 390, maxZ: 450 };
export const DOCKS_BASIN: GroundRect = { minX: 2520, maxX: 2594, minZ: 452, maxZ: 500 };
export const CAR_WASH_AREA: GroundRect = { minX: 389, maxX: 417, minZ: -44, maxZ: -20 };

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

export { GATE_PASSAGES, type PassageSite };

/**
 * Trasa Podziemna under the Rynek (ADR-0048): its real entrance is in the Trybunał Koronny,
 * Rynek 1 (OSM way 66264159). A vaulted vestibule from the Trybunał's north-west facade runs
 * east to the head of the stairs; the stairs go down east to the cellars at `floor`, under the
 * Trybunał's own footprint (the terrain there is dug out, see `PADS`).
 */
export const TRASA_PODZIEMNA = {
  building: "w66264159",
  /** Floor of the vestibule and the head of the stairs (the Rynek at the door). */
  door: round(rawHeight(566, -57)),
  /** Floor of the cellars. */
  floor: round(rawHeight(566, -57)) - 3.95,
  /** The vestibule along z = -57, from outside the facade to the head of the stairs at x = 572. */
  vestibule: { from: { x: 565.5, z: -57 }, to: { x: 572, z: -57 }, width: 2.2 },
  /** The stair hall, x 572..583 (the stairs, then a landing to 585), between the walls. */
  stairs: { minX: 572, maxX: 585, minZ: -58.2, maxZ: -55.8 },
  /** Clear height of the vestibule and the stair hall over the door. */
  hall: 3.65,
} as const;

/**
 * Every passage through the map's buildings: the gates and Trasa Podziemna's vestibule by hand,
 * then the tenements' gateways and the covered lanes from the map (Rybna, Ku Farze), the gates'
 * own buildings left to the hand-made ones.
 */
export const PASSAGES: readonly PassageSite[] = [
  ...GATE_PASSAGES,
  { building: TRASA_PODZIEMNA.building, ...TRASA_PODZIEMNA.vestibule, height: TRASA_PODZIEMNA.hall, rise: 0.8, floor: TRASA_PODZIEMNA.door },
  ...MAP_CHUNKS.flatMap((c) => c.passages ?? []).filter((p) => !GATE_PASSAGES.some((g) => g.building === p.building)),
];

/** A box cut out of a map building's solid up to `bottom` (world y): rooms under it stay open. */
export interface BuildingCut {
  readonly building: string;
  readonly rect: GroundRect;
  readonly bottom: number;
}

/** The stair hall of Trasa Podziemna, open up to the hall's ceiling (with its walls). */
export const BUILDING_CUTS: readonly BuildingCut[] = [
  {
    building: TRASA_PODZIEMNA.building,
    rect: { minX: 571.7, maxX: 585.3, minZ: TRASA_PODZIEMNA.stairs.minZ - 0.3, maxZ: TRASA_PODZIEMNA.stairs.maxZ + 0.3 },
    bottom: TRASA_PODZIEMNA.door + TRASA_PODZIEMNA.hall + 0.25,
  },
];

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
  // Dug out under the Trybunał for Trasa Podziemna (ADR-0048): the grid points x 575..585,
  // z -65..-55 of the 5 m grid, so the cells between them are below the cellars' floor and the
  // slope into the cells around stays inside the Trybunał's walls. 2 m under the floor: the
  // Rynek's paving, draped in 5 m triangles, then stays under the floor up to the cellars' walls.
  { rect: { minX: 574, maxX: 586, minZ: -66, maxZ: -54 }, y: TRASA_PODZIEMNA.floor - 2, blend: 0.01 },
];

/** Even ramps along the steps of the map (ADR-0045). */
export const RAMPS: readonly Ramp[] = stepRamps(MAP_CHUNKS);
