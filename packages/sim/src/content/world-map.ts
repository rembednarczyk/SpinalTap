import { CAR_WASH_DETAIL } from "./car-wash-detail";
import { BRAMA_DETAIL, BRAMA_SOLIDS, GATE_DUMPSTER } from "./brama-detail";
import { CAR_WASH_SOLIDS } from "./district-car-wash";
import { CLINIC_DETAIL } from "./clinic-detail";
import { KOI_DETAIL } from "./koi-detail";
import { KOI_BACK_DETAIL, KOI_BACK_PROPS } from "./koi-back";
import { TRASA_DETAIL } from "./trasa-detail";
import { CAPSULE_DETAIL } from "./capsule-detail";
import { TESSEN_OFFICE_DETAIL } from "./tessen-w3/office-detail";
import { W3_BASEMENT_DETAIL } from "./tessen-w3/basement-detail";
import { W3_HALL_DETAIL } from "./tessen-w3/hall-detail";
import { METRO_DETAIL } from "./metro-detail";
import { SHELTER_DETAIL } from "./alchemia/shelter-detail";
import { PAVILION_ROOF_DETAIL } from "./alchemia/pavilion-roof-dress";
import { P2_DETAIL } from "./alchemia/p2-detail";
import { P1_DRESSING, P2_TUNNEL_DRESSING, SHELTER_DRESSING, TESSEN_OFFICE_DRESSING, W3_HALL_DRESSING } from "./room-dressing-rooms";
import { PLAC_LITEWSKI_DETAIL } from "./plac-litewski-detail";
import { RYNEK_DETAIL, RYNEK_FURNITURE } from "./rynek-detail";
import { SHOP_DRESSING } from "./room-dressing-shops";
import { P1_DETAIL } from "./alchemia/p1-detail";
import { FOODHALL_DETAIL } from "./alchemia/foodhall-detail";
import type { TerrainGrid, StreetPropItem} from "@seki/core";
import { type ActorDef, type NavGraph, type Rect, type StaticProp, mergeNav } from "./builders";
import { S7_STASHES } from "./district-m0";
import { KANAL_ALLEY_STASH, KANAL_SCENERY } from "./district-kanal";
import { type RoofStash, TARG_OVERPASS_STASH, TARG_ROOF_STASH } from "./alchemia/market";
import { DEVICES, type DeviceDef } from "./devices";
import { TRASA_PODZIEMNA_BOUNDS, TRASA_PODZIEMNA_CHUNK, TRASA_PODZIEMNA_PROPS, TRASA_PODZIEMNA_STASH } from "./kanal-underground";
import { METRO_STATIONS, type MetroStationDef } from "./metro";
import { METRO_NAV } from "./metro-nav";
import { CLINIC_DOOR, KOI_BACK_CUT, KOI_BACK_ROOM_PROPS, KOI_DOOR, S7_NAV } from "./interiors";
import { W3_BOUNDS, W3_CHUNK, W3_CUTS, W3_NAV, W3_PROPS, W3_SCENERY, W3_VAULTS } from "./tessen-w3";
import { type RoomCut, type SceneryItem, chunkBuildings, chunkScenery } from "./lublin/city";
import { BUILDING_CUTS, CLINIC_SITE, KOI_SITE, MAP_CHUNKS, PASSAGES } from "./lublin/sites";
import { CAPSULE_DOOR, CAPSULE_PROPS, CAPSULE_SITE } from "./capsule-room";
import { ALCHEMIA_CENTRE, ALCHEMIA_CUTS, ALCHEMIA_PROPS, ALCHEMIA_VAULTS, ALCHEMIA_HALL_PROPS, ALCHEMIA_ROOF_PROPS, C7_PROPS, FRONT_GREEN_PROPS, FRONT_ROOM_MODELS, FRONT_PLAZA_PROPS, P1_CARS, P2_CARS, T1_DETAIL, T1_FURNITURE, type P1Car, p1CarView, p2CarView } from "./alchemia";
import { ALCHEMIA_NAV } from "./alchemia/nav";
import { METRO_DOOR_LINK } from "./alchemia/metro-door";
import type { GroundCut } from "../world/ground";
import type { GroundVault } from "../world/vault";
import { SHAPED_TERRAIN } from "./lublin/terrain";
import { GROUND_DECKS } from "./lublin/decks";
import type { GroundDeck } from "../world/deck";
import { furnitureProps } from "./lublin/furniture";
import { basinRimProps } from "./lublin/basins";
import { barrierProps } from "./lublin/barriers";
import { WORLD_BARRIERS } from "./world-barriers";
import { GAME_ACTORS, GAME_PROPS, WORLD_STREET_PROPS } from "./street-props";
import { PARKED_CARS, parkedProp, parkedView } from "./parked-cars";

export { WORLD_STREET_PROPS } from "./street-props";
export { WORLD_BARRIERS } from "./world-barriers";

/** The districts of Lublin 2077 (ADR-0042); the ids are the game's from before the move. */
export const DISTRICTS = {
  "shinsekai-7": { name: "Krakowskie Przedmieście" },
  kanal: { name: "Stare Miasto" },
  targ: { name: "Podzamcze" },
  doki: { name: "Nabrzeże Bystrzycy" },
} as const;

export type DistrictId = keyof typeof DISTRICTS;

/**
 * The unit of world streaming: a rectangle of the map with everything placed in it.
 * `bounds` encloses the chunk's walkable area and props; streaming measures distance to it.
 */
export interface ChunkDef {
  readonly id: string;
  readonly district: DistrictId;
  readonly bounds: Rect;
  readonly props: readonly StaticProp[];
  readonly actors: readonly ActorDef[];
  /**
   * The chunk's terrain (ADR-0043): characters stand on it, rays stop on it. Neighbouring chunks
   * must give the same heights where their bounds meet. Without it the ground is y = 0.
   */
  readonly terrain?: TerrainGrid;
  /** Bridge decks over the terrain (ADR-0053) and the flights of steps hung off them (G-255): the ground there. */
  readonly decks?: readonly GroundDeck[];
  /**
   * Solids of the street (ADR-0050): the furniture a body stumbles on, drawn by the scenery.
   * Their ids come from `STREET_ID_BASE`, not the allocator, so no id of the content moves.
   */
  readonly street?: readonly StaticProp[];
  /**
   * Solids the game adds to the map after its own data (ADR-0063): the rooms cut into its buildings
   * (the capsule room: walls, ceiling, floor and furniture) and the buildings of 2077 on its empty
   * plots (Alchemia), drawn by the engine. Their ids come from `ROOM_ID_BASE`, not the allocator,
   * so no id of the content moves.
   */
  readonly rooms?: readonly StaticProp[];
  /**
   * The level graph of a world of its own (ADR-0021), given to the simulation instead of the city
   * (a test floor with stairs and decks): its chunks' graphs together. The city's chunks carry
   * none; theirs is `WORLD_NAV`.
   */
  readonly nav?: NavGraph;
  /**
   * Ground dug out to a floor of its own in the chunk (`GroundCut`, ADR-0074: the food hall of
   * Alchemia under its terrace): the ground of the simulation there, a hole in the drawn terrain.
   */
  readonly cuts?: readonly GroundCut[];
  /**
   * Rooms in the ground under the chunk's terrain (`GroundVault`, ADR-0074 stage 4: Alchemia's P-1
   * under its car park): the ground of the simulation for feet deep in them, the terrain whole over them.
   */
  readonly vaults?: readonly GroundVault[];
}

/** Horizontal distance from a point to a rectangle; 0 inside. */
export const distanceToRect = (x: number, z: number, r: Rect): number =>
  Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));

/** The map chunk a piece of content belongs to: the first holding its point, or the nearest. */
const mapChunkOf = (x: number, z: number): string => {
  let best = MAP_CHUNKS[0]?.id ?? "";
  let bestD = Infinity;
  for (const c of MAP_CHUNKS) {
    const d = distanceToRect(x, z, c.bounds);
    if (d === 0) return c.id;
    if (d < bestD) {
      bestD = d;
      best = c.id;
    }
  }
  return best;
};

/**
 * The rooms cut into the map's tenements, with their doors: the clinic and Neon Koi on
 * Krakowskie Przedmieście (ADR-0045), the capsule room on Jezuicka (ADR-0063).
 */
const ROOM_CUTS: readonly RoomCut[] = [
  { site: CLINIC_SITE, doors: [{ x: CLINIC_DOOR.at.x, width: CLINIC_DOOR.width, height: CLINIC_DOOR.height }] },
  // Neon Koi with its back room through the ground floor to the yard (`docs/lokacje/koi-podworko.md`).
  { site: KOI_SITE, doors: [{ x: KOI_DOOR.at.x, width: KOI_DOOR.width, height: KOI_DOOR.height }], back: KOI_BACK_CUT },
  { site: CAPSULE_SITE, doors: [{ x: CAPSULE_DOOR.at.x, width: CAPSULE_DOOR.width, height: CAPSULE_DOOR.height }] },
];

/** The chunk of the map holding the capsule room's door: its solids stream in with it. */
export const CAPSULE_CHUNK = mapChunkOf(CAPSULE_DOOR.at.x, CAPSULE_DOOR.at.z);
/** The chunk of the map holding Alchemia (ADR-0074): its solids stream in with it. */
export const ALCHEMIA_CHUNK = mapChunkOf(ALCHEMIA_CENTRE.x, ALCHEMIA_CENTRE.z);

/** A car in a bay of P-1 as a solid of the street, on P-1's floor (a parked car's, without the terrain under it). */
const p1CarProp = (c: P1Car): StaticProp => parkedProp({ ...c, chunk: ALCHEMIA_CHUNK }, c.y);

/** The chunk of the map holding Brama Krakowska's dumpster (its scene, ADR-0102). */
const BRAMA_CHUNK = mapChunkOf(GATE_DUMPSTER.x, GATE_DUMPSTER.z);

/**
 * Neon Koi's back room and its yard (`docs/lokacje/koi-podworko.md`, ADR-0102 point 5): in the district's props for
 * whoever reads its shapes (the crowd, the street's pieces), but streamed with the rooms cut into the map's buildings,
 * whose ids come from `ROOM_ID_BASE` and not the allocator (`stream-catalog.ts`). Among the content's props they moved
 * every later id, W-3's people's too, and with them fights far off (as the car wash's solids did, #956).
 */
const KOI_BACK_OWN: readonly StaticProp[] = [...KOI_BACK_ROOM_PROPS, ...KOI_BACK_PROPS];
const KOI_BACK_SET: ReadonlySet<StaticProp> = new Set(KOI_BACK_OWN);

/** The game's own solids in a chunk of the map, after its data (`ChunkDef.rooms`); Neon Koi's back last, so the ids before it stay. */
const roomsOf = (id: string): readonly StaticProp[] => [
  ...(id === CAPSULE_CHUNK ? CAPSULE_PROPS : []),
  ...(id === ALCHEMIA_CHUNK ? ALCHEMIA_PROPS : []),
  ...KOI_BACK_OWN.filter((p) => mapChunkOf(p.center.x, p.center.z) === id),
  ...(id === BRAMA_CHUNK ? BRAMA_SOLIDS : []),
];

/** W-3's props stream in its own chunk (ADR-0082), not by the map's chunk under each. */
const W3_OWN: ReadonlySet<StaticProp> = new Set(W3_PROPS);

const MAP_BUILDINGS: ReadonlyMap<string, readonly StaticProp[]> = new Map(MAP_CHUNKS.map((c) => [c.id, chunkBuildings(c, ROOM_CUTS, PASSAGES, BUILDING_CUTS)]));

/**
 * Every chunk of the city (ADR-0045): Lublin's chunks from the map, each with the map's
 * buildings as solids and the game's props and characters that stand in it, on the shaped
 * terrain. The order is the creation order (and the order entity ids are reserved in).
 */
export const WORLD_CHUNKS: readonly ChunkDef[] = [
  ...MAP_CHUNKS.map((c): ChunkDef => {
    const terrain = SHAPED_TERRAIN.get(c.id);
    return {
      id: c.id,
      district: c.district,
      bounds: c.bounds,
      props: [...(MAP_BUILDINGS.get(c.id) ?? []), ...GAME_PROPS.filter((p) => !W3_OWN.has(p) && !KOI_BACK_SET.has(p) && mapChunkOf(p.center.x, p.center.z) === c.id)],
      actors: GAME_ACTORS.filter((a) => mapChunkOf(a.spawn.position.x, a.spawn.position.z) === c.id),
      ...(terrain ? { terrain } : {}),
      ...((GROUND_DECKS.get(c.id) ?? []).length > 0 ? { decks: GROUND_DECKS.get(c.id) } : {}),
      street: [
        ...furnitureProps(WORLD_STREET_PROPS[c.id] ?? []),
        ...basinRimProps(c),
        ...PARKED_CARS.filter((p) => p.chunk === c.id).map(parkedProp),
        // The cars in the bays of Alchemia's P-1 (ADR-0074 stage 4), after the street's, so their ids stay.
        ...(c.id === ALCHEMIA_CHUNK ? P1_CARS.map(p1CarProp) : []),
        // The map's walls, fences and hedges (ADR-0077) last, so the ids before them stay.
        ...barrierProps(WORLD_BARRIERS[c.id] ?? []),
        // The car wash scene's solids (ADR-0102 point 5) after them, so every street id before them stays.
        ...CAR_WASH_SOLIDS.filter((p) => mapChunkOf(p.center.x, p.center.z) === c.id),
        // T1's café garden and bin (its scene, ADR-0102), last, so the ids before them stay.
        ...(c.id === ALCHEMIA_CHUNK ? furnitureProps(T1_FURNITURE) : []),
        // The Rynek's drinks machine and Grodzka's lantern (its scene, ADR-0102), last, so the ids before them stay.
        ...furnitureProps(RYNEK_FURNITURE.filter((p) => mapChunkOf(p.x, p.z) === c.id)),
      ],
      ...(roomsOf(c.id).length > 0 ? { rooms: roomsOf(c.id) } : {}),
      ...(c.id === ALCHEMIA_CHUNK ? { cuts: ALCHEMIA_CUTS, vaults: ALCHEMIA_VAULTS } : {}),
    };
  }),
  // Trasa Podziemna (ADR-0048): a chunk of its own over the cellars, last in the table, so it
  // streams in only near the Trybunał and the ground and the district there stay the Rynek's.
  // W-3 (ADR-0082): its hall's boxes, tower, pipeline, quay and fences' solids in one chunk over the
  // Nabrzeże's, after them, so they stream in together from anywhere along the site.
  // Its basement and culvert lie in the ground under the hall and the terrace (stage 2): dug shafts and rooms in the ground.
  { id: W3_CHUNK, district: "doki", bounds: W3_BOUNDS, props: W3_PROPS, actors: [], cuts: W3_CUTS, vaults: W3_VAULTS },
  { id: TRASA_PODZIEMNA_CHUNK, district: "kanal", bounds: TRASA_PODZIEMNA_BOUNDS, props: TRASA_PODZIEMNA_PROPS, actors: [] },
];

/** A room's detail (ADR-0098) as a view of the scenery, in the chunk of its first piece. */
const roomDetail = (items: readonly StreetPropItem[]): SceneryItem => ({ chunk: mapChunkOf(items[0]!.x, items[0]!.z), view: { kind: "street-props", items }, at: { x: 0, y: 0, z: 0 } });

/**
 * The rooms' detail built by Blender after their cards (ADR-0098), one view a room in the order the rooms
 * came: the scenery's last views, so every id before them stays (a new room goes last). The scenes of the
 * locations' cards (ADR-0102) go the same way: Plac Litewski's wreck and its night.
 */
export const ROOM_DETAIL_SCENERY: readonly SceneryItem[] = [roomDetail(KOI_DETAIL), roomDetail(CLINIC_DETAIL), roomDetail(TESSEN_OFFICE_DETAIL), roomDetail(TRASA_DETAIL), roomDetail(CAPSULE_DETAIL), roomDetail(W3_BASEMENT_DETAIL), roomDetail(W3_HALL_DETAIL), ...METRO_DETAIL.map(roomDetail), roomDetail(SHELTER_DETAIL), roomDetail(P2_DETAIL), roomDetail(P1_DETAIL), roomDetail(FOODHALL_DETAIL), roomDetail(P2_TUNNEL_DRESSING), roomDetail(TESSEN_OFFICE_DRESSING), roomDetail(SHOP_DRESSING), roomDetail(SHELTER_DRESSING), roomDetail(P1_DRESSING), roomDetail(W3_HALL_DRESSING), roomDetail(CAR_WASH_DETAIL), roomDetail(KOI_BACK_DETAIL), roomDetail(PLAC_LITEWSKI_DETAIL), roomDetail(PAVILION_ROOF_DETAIL), roomDetail(BRAMA_DETAIL), roomDetail(T1_DETAIL), roomDetail(RYNEK_DETAIL)];

/**
 * What the renderer draws of the city for good (ADR-0045): the shaped terrain, the surfaces and
 * the buildings of every chunk, whether the chunk is streamed in or not. The buildings' props
 * carry `scenery`, so their entities are solids without a view.
 */
export const WORLD_SCENERY: readonly SceneryItem[] = [
  ...MAP_CHUNKS.flatMap((c) => chunkScenery(c, MAP_BUILDINGS.get(c.id) ?? [])),
  // The game's own buildings drawn with the city: the covered footbridge over Grodzka (ADR-0048).
  ...KANAL_SCENERY.map((s): SceneryItem => ({ chunk: mapChunkOf(s.at.x, s.at.z), view: s.view, at: s.at })),
  // The furniture (ADR-0050), so the views above keep their scenery ids.
  ...MAP_CHUNKS.map((c): SceneryItem => ({ chunk: c.id, view: { kind: "street-props", items: WORLD_STREET_PROPS[c.id] ?? [] }, at: { x: 0, y: 0, z: 0 } })),
  // The parked cars (ADR-0050), each drawn where it stands.
  ...PARKED_CARS.map((p, i): SceneryItem => ({ chunk: p.chunk, view: parkedView(p), at: { x: p.x, y: p.y, z: p.z }, yaw: p.yaw, parked: i })),
  // And those in the bays of Alchemia's P-1 under its car park (ADR-0074 stage 4).
  ...P1_CARS.map((p): SceneryItem => ({ chunk: ALCHEMIA_CHUNK, view: p1CarView(p), at: { x: p.x, y: p.y, z: p.z }, yaw: p.yaw })),
  // The map's walls, fences and hedges (ADR-0077), drawn with the furniture, last so the ids above stay.
  ...Object.entries(WORLD_BARRIERS).map(([chunk, items]): SceneryItem => ({ chunk, view: { kind: "street-props", items }, at: { x: 0, y: 0, z: 0 } })),
  // W-3's paving, its hall's walls and its fences (ADR-0082), after the city's, so its ids stay.
  ...W3_SCENERY.map((s): SceneryItem => ({ chunk: mapChunkOf(s.in.x, s.in.z), view: s.view, at: s.at })),
  // The cars on P-2's pallets (19.11, once boxes of its mesh), last so every id above stays.
  ...P2_CARS.map((p): SceneryItem => ({ chunk: ALCHEMIA_CHUNK, view: p2CarView(p), at: { x: p.x, y: p.y, z: p.z }, yaw: p.yaw })),
  // Alchemia's roof green (C2, 19.11): the game's trees, planters and shrubs, last so every id above stays.
  { chunk: ALCHEMIA_CHUNK, view: { kind: "street-props", items: FRONT_GREEN_PROPS }, at: { x: 0, y: 0, z: 0 } },
  // The gallery's shops (ADR-0093 O2): the game's machines, cabinets and shrubs in them and their sellers, last;
  // with the food hall's machines and bins and P0's benches and planters by its fountain (O3).
  { chunk: ALCHEMIA_CHUNK, view: { kind: "street-props", items: ALCHEMIA_HALL_PROPS }, at: { x: 0, y: 0, z: 0 } },
  // The green roof's trees, shrubs, benches, park lamps and planters (ADR-0093 O4), last so every id above stays.
  { chunk: ALCHEMIA_CHUNK, view: { kind: "street-props", items: ALCHEMIA_ROOF_PROPS }, at: { x: 0, y: 0, z: 0 } },
  // The square before the front (C5, 19.11): the game's drinks machines, bins, bench, planters, tree and the kiosks' sellers, last.
  { chunk: ALCHEMIA_CHUNK, view: { kind: "street-props", items: FRONT_PLAZA_PROPS }, at: { x: 0, y: 0, z: 0 } },
  // The deptak's stalls' sellers and crates and the people on the front's terraces (C7, 20.11).
  { chunk: ALCHEMIA_CHUNK, view: { kind: "street-props", items: C7_PROPS }, at: { x: 0, y: 0, z: 0 } },
  // The game's machines, benches and planters in the front's arcades, its units' models and sellers, the café's and the bar's people (ADR-0093 O5), last.
  { chunk: ALCHEMIA_CHUNK, view: { kind: "street-props", items: FRONT_ROOM_MODELS }, at: { x: 0, y: 0, z: 0 } },
  // The rooms' detail built by Blender after their cards (ADR-0098), last so every id above stays.
  ...ROOM_DETAIL_SCENERY,
];

/** Cameras and hackable devices (ADR-0029); each one names its chunk above. */
export const WORLD_DEVICES: readonly DeviceDef[] = DEVICES;

/** Metro platforms (ADR-0034); each one names its chunk above. */
export const WORLD_METRO: readonly MetroStationDef[] = METRO_STATIONS;

/**
 * Level graph of the whole city (ADR-0021): W-3's tower, roof and pipe walk (ADR-0082),
 * the interiors of Krakowskie Przedmieście (ADR-0038), the metro's stairs (ADR-0071) and
 * Alchemia's food hall under its terrace (ADR-0074). The streets themselves are one level
 * on the terrain.
 */
export const WORLD_NAV: NavGraph = mergeNav(W3_NAV, S7_NAV, METRO_NAV, ALCHEMIA_NAV, METRO_DOOR_LINK);

/** Stashes placed once when the player first comes near: on roofs (ADR-0021), in alleys and dead ends (ADR-0026). */
export const WORLD_STASHES: readonly RoofStash[] = [TARG_ROOF_STASH, ...S7_STASHES, KANAL_ALLEY_STASH, TARG_OVERPASS_STASH, TRASA_PODZIEMNA_STASH];

/** First chunk (in table order) whose bounds contain the point. */
export const chunkAt = (x: number, z: number, chunks: readonly ChunkDef[] = WORLD_CHUNKS): ChunkDef | null =>
  chunks.find((c) => distanceToRect(x, z, c.bounds) === 0) ?? null;
