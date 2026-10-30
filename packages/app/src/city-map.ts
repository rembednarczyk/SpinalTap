import type { GroundSurface } from "@seki/core";
import { DISTRICTS, type DistrictId, MAP_CHUNKS, WORLD_CHUNKS, WORLD_METRO, clearedBuilding, ground } from "@seki/sim";
import type { LublinChunkData, LublinStreetData } from "@seki/sim/lublin";
import type { MapAreaKind, MapAreaVm, MapLabelVm, MapPlaceVm, MapPolygon, MapRectVm, MapVm } from "@seki/ui";
import { buildDistrictMap, sidewalkProps } from "./minimap";

/**
 * Lublin for the minimap and the map tab (ADR-0045): the surfaces and the buildings of the map
 * data under the game's own blocks, decks and links, with the names of the streets, the
 * districts, the landmarks and the metro stations.
 */

const AREA: Readonly<Record<GroundSurface, MapAreaKind>> = {
  road: "road",
  sidewalk: "walk",
  square: "walk",
  cobble: "walk",
  footway: "walk",
  steps: "walk",
  crossing: "road",
  grass: "green",
  water: "water",
  basin: "water",
  rail: "rail",
};

/** A street gets a name where it runs straight for this long, metres. */
const LABEL_RUN = 24;
/** The same name again only this far from the last one, metres. */
const LABEL_GAP = 90;

const round = (v: number) => Math.round(v * 10) / 10;

/** Kept readable: the text never runs upside down (−π/2..π/2]. */
export const readableAngle = (a: number): number => {
  let out = a;
  while (out > Math.PI / 2) out -= Math.PI;
  while (out <= -Math.PI / 2) out += Math.PI;
  return Math.round(out * 1000) / 1000;
};

export const cityAreas = (chunks: readonly LublinChunkData[]): MapAreaVm[] => chunks.flatMap((c) => c.ground.map((g) => ({ kind: AREA[g.surface], points: g.outline })));

/** Outlines of the buildings that stand (the set pieces cleared some, ADR-0045), in world metres. */
export const cityBuildings = (chunks: readonly LublinChunkData[]): MapPolygon[] =>
  chunks.flatMap((c) => c.buildings.filter((b) => !clearedBuilding(b)).map((b) => b.outline.map((v, i) => round(v + (i % 2 === 0 ? b.x : b.z)))));

/** The longest straight piece of a street's line: where its name goes. */
const longestRun = (s: LublinStreetData): { x: number; z: number; angle: number; length: number } | null => {
  let best: { x: number; z: number; angle: number; length: number } | null = null;
  for (let i = 2; i + 1 < s.line.length; i += 2) {
    const ax = s.line[i - 2] as number;
    const az = s.line[i - 1] as number;
    const bx = s.line[i] as number;
    const bz = s.line[i + 1] as number;
    const length = Math.hypot(bx - ax, bz - az);
    if (!best || length > best.length) best = { x: (ax + bx) / 2, z: (az + bz) / 2, angle: Math.atan2(bz - az, bx - ax), length };
  }
  return best;
};

export const streetLabels = (chunks: readonly LublinChunkData[]): MapLabelVm[] => {
  const out: MapLabelVm[] = [];
  for (const c of chunks) {
    for (const s of c.streets) {
      const run = s.name ? longestRun(s) : null;
      if (!run || run.length < LABEL_RUN) continue;
      if (out.some((l) => l.text === s.name && Math.hypot(l.x - run.x, l.z - run.z) < LABEL_GAP)) continue;
      out.push({ kind: "street", text: s.name, x: round(run.x), z: round(run.z), angle: readableAngle(run.angle) });
    }
  }
  return out;
};

/** Landmarks: the historic, civic and church buildings the map names (Zamek, Brama Krakowska, Trybunał). */
const LANDMARK_USES: ReadonlySet<string> = new Set(["historic", "civic", "church"]);
const landmarkLabels = (chunks: readonly LublinChunkData[]): MapLabelVm[] =>
  chunks.flatMap((c) => c.buildings.filter((b) => b.name && LANDMARK_USES.has(b.use)).map((b) => ({ kind: "landmark" as const, text: b.name ?? "", x: b.x, z: b.z, angle: 0 })));

/** Each district's name over the middle of its chunks. */
export const districtPlaces = (chunks: readonly LublinChunkData[]): MapPlaceVm[] =>
  (Object.keys(DISTRICTS) as DistrictId[]).flatMap((d) => {
    const own = chunks.filter((c) => c.district === d);
    if (own.length === 0) return [];
    const minX = Math.min(...own.map((c) => c.bounds.minX));
    const maxX = Math.max(...own.map((c) => c.bounds.maxX));
    const minZ = Math.min(...own.map((c) => c.bounds.minZ));
    const maxZ = Math.max(...own.map((c) => c.bounds.maxZ));
    return [{ name: DISTRICTS[d].name, x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 }];
  });

const chunkRect = (c: LublinChunkData): MapRectVm => ({ x: (c.bounds.minX + c.bounds.maxX) / 2, z: (c.bounds.minZ + c.bounds.maxZ) / 2, w: c.bounds.maxX - c.bounds.minX, d: c.bounds.maxZ - c.bounds.minZ });

const unionRect = (rects: readonly MapRectVm[]): MapRectVm => {
  const minX = Math.min(...rects.map((r) => r.x - r.w / 2));
  const maxX = Math.max(...rects.map((r) => r.x + r.w / 2));
  const minZ = Math.min(...rects.map((r) => r.z - r.d / 2));
  const maxZ = Math.max(...rects.map((r) => r.z + r.d / 2));
  return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, w: maxX - minX, d: maxZ - minZ };
};

/** The map of the whole city: Lublin's chunks, the game's content on them, and the names. */
export const buildCityMap = (chunks: readonly LublinChunkData[] = MAP_CHUNKS): MapVm => {
  const game = buildDistrictMap([...WORLD_CHUNKS.flatMap((c) => c.props), ...sidewalkProps()], (x, z) => ground(x, z).y);
  const plates = chunks.map(chunkRect);
  const places = districtPlaces(chunks);
  const labels: MapLabelVm[] = [
    ...places.map((p) => ({ kind: "district" as const, text: p.name, x: p.x, z: p.z, angle: 0 })),
    ...landmarkLabels(chunks),
    ...WORLD_METRO.map((s) => ({ kind: "station" as const, text: `Ⓜ ${s.name}`, x: s.kiosk.x, z: s.kiosk.z, angle: 0 })),
    ...streetLabels(chunks),
  ];
  return {
    ...game,
    bounds: plates.length > 0 ? unionRect(plates) : game.bounds,
    ground: plates,
    areas: cityAreas(chunks),
    buildings: cityBuildings(chunks),
    labels,
    places,
  };
};
