import type { Vec3 } from "@seki/core";
import { KRAKOWSKIE_CHUNKS } from "./krakowskie.generated";
import { NABRZEZE_CHUNKS } from "./nabrzeze.generated";
import { PODZAMCZE_CHUNKS } from "./podzamcze.generated";
import { STARE_MIASTO_CHUNKS } from "./stare-miasto.generated";
import { GATE_PASSAGES, type PassageSite } from "./gate-passages";
import { abutmentRamps, flightTopRamps } from "./abutments";
import { LUBLIN_CONSTRUCTION_SITES, digPads } from "./construction";
import { type GroundRect, type Pad, type Ramp, flightRamps, mapHeight, stepRamps } from "./shape";
import { type SteepWay, steepWays } from "./steep-ways";
import { FARA_PAD } from "./fara-pad";
import type { LublinChunkData } from "./types";
import { ALCHEMIA_PADS, ALCHEMIA_RAMPS } from "../alchemia/terraces";
import { W3_BASIN, W3_BASIN_FLOOR, W3_CLEAR_RECTS, W3_PIER, W3_PIPES, W3_QUAY, W3_TOWER, W3_Y, W3_ZONE_RECTS } from "../tessen-w3/site";

/**
 * Where the game's places stand in Lublin (ADR-0045): the hand-made set pieces moved into the
 * city (Tessen's sector W-3 on the Bystrzyca, ADR-0082; the car wash in a yard behind Plac Łokietka; the market
 * that stood on Aleja Tysiąclecia is in Alchemia now, ADR-0063), the interiors cut into real
 * tenements on Krakowskie Przedmieście, and the terrain shaped under them. World metres around
 * `LUBLIN_ANCHOR` (ADR-0042).
 */

/** The map's chunks in table order (the generated data, before the game's shaping). */
export const MAP_CHUNKS: readonly LublinChunkData[] = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];

/** Height of the map's own terrain at (x, z). */
export const rawHeight = (x: number, z: number): number => mapHeight(MAP_CHUNKS, x, z);

const round = (y: number): number => Math.round(y * 100) / 100;

/**
 * The car wash in the tenements' yard behind Plac Łokietka, open to the car park off
 * Przystankowa (OSM way 179269921; local x -6..22, z 25..49). It stood on the square itself
 * before, in front of the town hall. Its north edge is the edge of the deptak's chunk, so the
 * courier and his guard load with the clinic's district, as they did on the square.
 */
export const CAR_WASH_PLACE: Vec3 = { x: 395, y: round(rawHeight(403, -32)), z: -69 };

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

/**
 * Rectangles where the map's buildings and surfaces give way to a set piece: W-3's zone behind
 * its fence (ADR-0082). A surface goes only when it lies wholly inside them (`lublin/city.ts`):
 * the riverside wood's lawn reaching far past the fence stays, and W-3's own paving covers it.
 */
export const CLEARED: readonly GroundRect[] = W3_ZONE_RECTS;
/** The building of the public strip that W-3's fence replaces (OSM w1354195809, audit P12). */
const W3_STRIP_BUILDING: GroundRect = { minX: 2586, maxX: 2606, minZ: 380, maxZ: 395 };
/** The pipeline's corridor over the west bank and the river: no tree grows through its walk (P8). */
const W3_PIPE_CORRIDOR: GroundRect = { minX: W3_PIPES.minX - 2, maxX: W3_PIPES.maxX, minZ: W3_PIPES.minZ - 1, maxZ: W3_PIPES.maxZ + 1 };
/**
 * Rectangles where only the map's buildings and trees give way (the surfaces stay under the car
 * wash, and under W-3's quay, pier and basin): the zone, its quay and pier, the basin, the
 * pipeline's corridor, the strip's one building, the car wash. Not the rest of the public strip:
 * its trees and the lamp by the lit path stay (P12).
 */
export const CLEARED_BUILDINGS: readonly GroundRect[] = [...W3_CLEAR_RECTS, W3_QUAY, W3_TOWER, W3_PIER, W3_BASIN, W3_PIPE_CORRIDOR, W3_STRIP_BUILDING, CAR_WASH_AREA];

/**
 * The quay's pad down to the grid's row at z 417.5 under the bridge (review round 2,
 * `pad-not-level`): from the quay's south edge at z 418.5 its cell sloped 0.4 m to the NMT.
 */
const W3_QUAY_PAD: GroundRect = { ...W3_QUAY, minZ: W3_QUAY.minZ - 1.1 };
/** The pickup yard's ends either side of the basin, to the grid's row at z 452.5 under the fence. */
const W3_YARD_ENDS: readonly GroundRect[] = [
  { minX: 2500, maxX: W3_BASIN.minX, minZ: 446, maxZ: W3_BASIN.minZ + 0.5 },
  { minX: W3_BASIN.maxX, maxX: 2606, minZ: 446, maxZ: W3_BASIN.minZ + 0.5 },
];

/** A rectangle grown by `d` metres on every side (or by `d` and `north` on the north side). */
const grow = (r: GroundRect, d: number, north = d): GroundRect => ({ minX: r.minX - d, maxX: r.maxX + d, minZ: r.minZ - d, maxZ: r.maxZ + north });

/**
 * W-3's zone levelled to the halls' floor (ADR-0082, audit P2, P3, P9, P10): its bands along the
 * path's fence, its quay and its tower, each blending into the terrain within a metre, so the
 * public strip, the bridge's abutment and the river keep the NMT (the terrain's cell is 2.5 m
 * there, `terrain.ts`); a retaining wall under the fence takes the terrace's step. Then the basin
 * dug 3 m down, to 1.5 m short of the chunks' north edge.
 */
const W3_PADS: readonly Pad[] = [
  ...[...W3_ZONE_RECTS, W3_QUAY_PAD, W3_TOWER].map((rect): Pad => ({ rect, y: W3_Y, blend: 1, row: "T-002" })),
  { rect: W3_BASIN, y: W3_BASIN_FLOOR, blend: 1.5, row: "T-002" },
  // The pickup yard level to the fence beside the basin's ends (review round 2, `pad-not-level`):
  // the basin's blend and its 2.5 m cells dipped the yard there by up to 1.6 m, past the quay wall's ends.
  ...W3_YARD_ENDS.map((rect): Pad => ({ rect, y: W3_Y, blend: 0, row: "T-002" })),
];

/** The terrain levelled under the set pieces and the rooms. */
export const PADS: readonly Pad[] = [
  ...W3_PADS,
  // The car wash's yard levelled up to the streets round it, not over them (G-754): on the
  // import's 5 m grid its level points end at z -30, behind the car park's north edge (OSM
  // w179269921), so the blend leaves the sidewalk, the crossings and Bajkowskiego on the NMT; west
  // and south short of the column at x 385 (the crossing) and the row at z -45 (the path south).
  { rect: { minX: 388, maxX: CAR_WASH_AREA.maxX + 5, minZ: -41, maxZ: -27 }, y: CAR_WASH_PLACE.y, blend: 3, row: "T-051" },
  ...ROOM_SITES.map((r): Pad => ({ rect: grow(r.rect, 5), y: r.floor, blend: 2 })),
  // Dug out under the Trybunał for Trasa Podziemna (ADR-0048): level over x 575..585, z -65..-55,
  // sloping up to the Rynek over 5 m, so the slope stays inside the Trybunał's walls. In metres,
  // not on a grid's points (G-252): on any grid of up to 5 m the stairs keep a metre of ground
  // under them, and on the import's 5 m grid its points are as they were. 2 m under the floor:
  // the Rynek's paving, draped in 5 m triangles, then stays under the floor up to the cellars' walls.
  { rect: { minX: 575, maxX: 585, minZ: -65, maxZ: -55 }, y: TRASA_PODZIEMNA.floor - 2, blend: 5, row: "T-055" },
  // Alchemia's terraces by the investor's plan (ADR-0074, T-206, T-207, T-217): T1 in front of the food
  // hall, the line of the grid under its back wall at T0, T2 before the Arkady where the Hebi hollow was (T-186).
  ...ALCHEMIA_PADS,
  // Plac po Farze's foundations of the parish church on one level, the hologram's plinth (T-347, the user's proposal of 24.11).
  FARA_PAD,
];

/**
 * The building sites' digs (ADR-0087 stage 1, T-321), laid on a grid refined to `FLIGHT_CELL`
 * (`terrain.ts`): the generator keeps the blend and a cell of that grid past it on the site's free
 * ground inside its fence, so the fence, the pavements and the walls round it keep the terrain.
 */
export const DIG_PADS: readonly Pad[] = digPads(LUBLIN_CONSTRUCTION_SITES);

/**
 * Even ramps along the steps of the map (ADR-0045), then the level ground before the bridges'
 * abutments (G-349) and up the top of a flight onto one's end (G-686), then Alchemia's ramps
 * beside the food hall from T0 to T1 (ADR-0074, T-208) and its stairs from T1 down to T2 (T-219),
 * laid over the pads.
 */
export const RAMPS: readonly Ramp[] = [...stepRamps(MAP_CHUNKS), ...abutmentRamps(MAP_CHUNKS), ...flightTopRamps(MAP_CHUNKS), ...ALCHEMIA_RAMPS];
/** Ramps along the flights the terrain climbs against their `incline` (G-236, T-131), laid last on a finer grid (`terrain.ts`). */
export const FLIGHT_RAMPS: readonly Ramp[] = flightRamps(MAP_CHUNKS);
/** The stretches of the ways walked on foot too steep on the terrain (G-755), laid last at an even grade on the flights' finer grid (`terrain.ts`). */
export const STEEP_WAYS: readonly SteepWay[] = steepWays(MAP_CHUNKS);
