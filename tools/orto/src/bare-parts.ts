/**
 * Section 3 of the cell report: the cell's bare ground (0.5 m samples under no building and no
 * ground piece) in parts (ADR-0077, G-704, G-705). The mask is opened by `OPEN` samples (strips
 * under about 1 m between a wall and the paving drop out), split into 4-connected components of
 * `MIN_AREA` m² or more, and each is classed by what its edge meets (looking past the strips the
 * opening dropped):
 * - `lod2`: half of it or more inside LoD2 footprints (a building the game lacks, or LoD2 filling a courtyard);
 * - `yard`: `YARD_WALLS` of its edge or more on the game's walls;
 * - `frontage`: on a wall (`FRONT_WALLS` or more) and open to a carriageway, paving or a car park;
 * - `gap`: by a carriageway, wider than `KERB_REACH` (the kerb fills close narrower ones);
 * - `other`.
 * Each part gets the orthophoto's class from the flight leaning least (`lean.ts`), one flight
 * alone, without the samples a roof shifted by that lean covers on the photograph.
 */
import { type Pt, type Rect } from "../../osm-import/src/geometry.ts";
import { KERB_REACH } from "../../osm-import/src/kerb-fill.ts";
import { COVER_NAMES, type CoverName } from "./classify.ts";
import { type Cover, classifyRect, coverAt, emptyCover } from "./cover.ts";
import { type Grid, STEPS, centreOf, components, depthOf, gridOver, opening, ringMask } from "./grid.ts";
import { samplesIn } from "./rings.ts";
import { type Thresholds } from "./thresholds.ts";
import { type Tile } from "./tiles.ts";

export const PARTS = { OPEN: 2, MIN_AREA: 50, YARD_WALLS: 0.6, FRONT_WALLS: 0.15, ROAD: 0.1 } as const;
export const PART_CLASSES = ["yard", "frontage", "gap", "lod2", "other"] as const;
export type PartClass = (typeof PART_CLASSES)[number];

/** What a sample is, for the edges of the bare parts. */
const KIND = { bare: 0, wall: 1, road: 2, paving: 3, green: 4, parking: 5, other: 6, edge: 7 } as const;
const SURFACE_KIND: Readonly<Record<string, number>> = { road: KIND.road, crossing: KIND.road, sidewalk: KIND.paving, square: KIND.paving, cobble: KIND.paving, footway: KIND.paving, steps: KIND.paving, grass: KIND.green };

export interface PartsInput {
  readonly rect: Rect;
  readonly buildings: readonly (readonly Pt[])[];
  readonly pieces: readonly { readonly surface: string; readonly ring: readonly Pt[] }[];
  readonly carParks: readonly (readonly Pt[])[];
  readonly lod2: readonly (readonly Pt[])[];
  /** The district's cover raster: the classes where no tile is cached. */
  readonly cover?: Cover;
  /** The flight leaning least, its tile and lean. */
  readonly photo?: { readonly flight: string; readonly tile: Tile; readonly dx: number; readonly dz: number };
  readonly thresholds: Thresholds;
  readonly landuseBareAt?: (x: number, z: number) => boolean;
}

export interface Part {
  readonly cls: PartClass;
  readonly m2: number;
  readonly box: Rect;
  /** Shares of its edge on walls and carriageways, its width (m), m² in LoD2 and in the scan's `landuse-bare`. */
  readonly walls: number;
  readonly road: number;
  readonly width: number;
  readonly lod2: number;
  readonly landuseBare: number;
  /** The photograph's classes (%) of the samples no shifted roof covers, and the share left out. */
  readonly hard: number;
  readonly green: number;
  readonly rest: number;
  readonly underRoof: number;
}

export interface PartsSection {
  readonly bareM2: number;
  readonly source: string;
  readonly classes: Readonly<Record<PartClass, { readonly count: number; readonly m2: number; readonly landuseBare: number; readonly hard: number }>>;
  readonly parts: readonly Part[];
  readonly verdict: string;
}

/** The kinds of the cell's samples: walls, the pieces in drawing order (the last on top), the car parks over what is not a wall. */
const kindsOf = (g: Grid, inp: PartsInput): Uint8Array => {
  const kinds = new Uint8Array(g.width * g.height);
  for (const p of inp.pieces) {
    const v = SURFACE_KIND[p.surface] ?? KIND.other;
    for (const k of samplesIn(g, p.ring)) kinds[k] = v;
  }
  const parks = ringMask(g, inp.carParks);
  const walls = ringMask(g, inp.buildings);
  for (let k = 0; k < kinds.length; k++) {
    if (walls[k]) kinds[k] = KIND.wall;
    else if (parks[k] && kinds[k] !== KIND.bare) kinds[k] = KIND.parking;
  }
  return kinds;
};

/** What the edge of a part meets: each step out, past the bare samples the opening dropped (up to `reach`). */
const edgeOf = (g: Grid, comp: readonly number[], inComp: Uint8Array, kinds: Uint8Array, reach: number): number[] => {
  const counts = new Array<number>(8).fill(0);
  for (const q of comp) {
    const [col, row] = [q % g.width, Math.floor(q / g.width)];
    for (const [dc, dr] of STEPS) {
      let [c, r, s] = [col + dc, row + dr, 0];
      if (c >= 0 && r >= 0 && c < g.width && r < g.height && inComp[r * g.width + c]) continue;
      while (s < reach && c >= 0 && r >= 0 && c < g.width && r < g.height && kinds[r * g.width + c] === KIND.bare) [c, r, s] = [c + dc, r + dr, s + 1];
      counts[c < 0 || r < 0 || c >= g.width || r >= g.height ? KIND.edge : kinds[r * g.width + c]!]!++;
    }
  }
  return counts;
};

const classOf = (walls: number, road: number, open: number, width: number, lod2: number): PartClass => {
  if (lod2 >= 0.5) return "lod2";
  if (walls >= PARTS.YARD_WALLS) return "yard";
  if (walls >= PARTS.FRONT_WALLS && open > 0) return "frontage";
  if (road >= PARTS.ROAD && width > KERB_REACH) return "gap";
  return "other";
};

const pct = (n: number, of: number) => (of ? Math.round((100 * n) / of) : 0);

/** The photograph's classes of the cell (one flight), or the cover raster's. */
const photoClasses = (g: Grid, inp: PartsInput): { readonly at: (k: number) => CoverName; readonly source: string } => {
  if (inp.photo) {
    const c = emptyCover("cell", inp.rect, inp.thresholds, g.step);
    classifyRect(c, [inp.photo.tile], inp.rect);
    return { at: (k) => COVER_NAMES[c.cls[k]!] ?? "none", source: `nalot ${inp.photo.flight}, bez próbek pod dachem przesuniętym o (${inp.photo.dx}; ${inp.photo.dz}) m` };
  }
  const cover = inp.cover;
  return { at: (k) => (cover ? (COVER_NAMES[coverAt(cover, centreOf(g, k).x, centreOf(g, k).z)] ?? "none") : "none"), source: cover ? "raster pokrycia (średnia nalotów, bez odjęcia dachów)" : "brak ortofoto i rastra" };
};

const partOf = (g: Grid, comp: readonly number[], inComp: Uint8Array, kinds: Uint8Array, lod2: Uint8Array, roofAt: (k: number) => boolean, photo: (k: number) => CoverName, inp: PartsInput, reach: number): Part => {
  const e = edgeOf(g, comp, inComp, kinds, reach);
  const total = e.reduce((s, v) => s + v, 0) || 1;
  const [walls, road] = [e[KIND.wall]! / total, e[KIND.road]! / total];
  const open = (e[KIND.road]! + e[KIND.paving]! + e[KIND.parking]!) / total;
  const width = 2 * depthOf(g, comp) * g.step;
  const a = g.step * g.step;
  let [inLod2, landuse, hard, green, rest, roof] = [0, 0, 0, 0, 0, 0];
  let box = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
  for (const k of comp) {
    const p = centreOf(g, k);
    box = { minX: Math.min(box.minX, p.x), minZ: Math.min(box.minZ, p.z), maxX: Math.max(box.maxX, p.x), maxZ: Math.max(box.maxZ, p.z) };
    if (lod2[k]) inLod2++;
    if (inp.landuseBareAt?.(p.x, p.z)) landuse++;
    if (roofAt(k)) {
      roof++;
      continue;
    }
    const c = photo(k);
    if (c === "paving" || c === "asphalt" || c === "canopyHard") hard++;
    else if (c === "green" || c === "canopy") green++;
    else rest++;
  }
  const seen = comp.length - roof;
  return {
    cls: classOf(walls, road, open, width, inLod2 / comp.length),
    m2: Math.round(comp.length * a),
    box: { minX: Math.floor(box.minX), minZ: Math.floor(box.minZ), maxX: Math.ceil(box.maxX), maxZ: Math.ceil(box.maxZ) },
    walls: pct(walls, 1),
    road: pct(road, 1),
    width,
    lod2: Math.round(inLod2 * a),
    landuseBare: Math.round(landuse * a),
    hard: pct(hard, seen),
    green: pct(green, seen),
    rest: pct(rest, seen),
    underRoof: pct(roof, comp.length),
  };
};

export const partsSection = (inp: PartsInput, step = 0.5, open = PARTS.OPEN): PartsSection => {
  const g = gridOver(inp.rect, step);
  const kinds = kindsOf(g, inp);
  const bare = kinds.map((v) => (v === KIND.bare ? 1 : 0));
  const opened = opening(g, bare, open);
  const lod2 = ringMask(g, inp.lod2);
  const photo = photoClasses(g, inp);
  const [si, sj] = inp.photo ? [Math.round(inp.photo.dx / step), Math.round(-inp.photo.dz / step)] : [0, 0];
  // The photograph shows the roof of a footprint at footprint + lean: a sample is under a roof where its point less the lean is in LoD2.
  const roofAt = (k: number) => {
    if (!inp.photo) return false;
    const [c, r] = [(k % g.width) - si, Math.floor(k / g.width) - sj];
    return c >= 0 && r >= 0 && c < g.width && r < g.height && lod2[r * g.width + c] === 1;
  };
  const inComp = new Uint8Array(bare.length);
  const parts: Part[] = [];
  for (const comp of components(g, opened)) {
    if (comp.length * step * step < PARTS.MIN_AREA) continue;
    for (const k of comp) inComp[k] = 1;
    parts.push(partOf(g, comp, inComp, kinds, lod2, roofAt, photo.at, inp, 2 * open + 2));
    for (const k of comp) inComp[k] = 0;
  }
  parts.sort((a, b) => b.m2 - a.m2);
  const classes = Object.fromEntries(
    PART_CLASSES.map((c) => {
      const ps = parts.filter((p) => p.cls === c);
      const m2 = ps.reduce((s, p) => s + p.m2, 0);
      return [c, { count: ps.length, m2, landuseBare: ps.reduce((s, p) => s + p.landuseBare, 0), hard: m2 ? Math.round(ps.reduce((s, p) => s + p.hard * p.m2, 0) / m2) : 0 }];
    }),
  ) as PartsSection["classes"];
  const bareM2 = Math.round(bare.reduce((s, v) => s + v, 0) * step * step);
  return { bareM2, source: photo.source, classes, parts, verdict: verdictOf(classes) };
};

const NAMES: Readonly<Record<PartClass, string>> = { yard: "podwórza", frontage: "przedpola", gap: `szczeliny przy jezdni > ${KERB_REACH} m`, lod2: "w obrysie LoD2", other: "inne" };

const verdictOf = (c: PartsSection["classes"]): string => {
  const big = PART_CLASSES.filter((k) => k !== "other" && c[k].count).map((k) => `${NAMES[k]} ${c[k].count} (${c[k].m2} m², twarde ${c[k].hard}%)`);
  return big.length ? `goły teren do nawierzchni z ortofoto: ${big.join(", ")}` : "bez podwórzy, przedpoli i szczelin ≥ 50 m²";
};

export const partsText = (s: PartsSection): string[] => [
  `-- goły teren (otwarcie o ${PARTS.OPEN * 0.5} m, składowe ≥ ${PARTS.MIN_AREA} m²; klasy ortofoto: ${s.source})`,
  `goły teren w komórce ${s.bareM2} m²; ${PART_CLASSES.map((k) => `${NAMES[k]} ${s.classes[k].count}/${s.classes[k].m2} m² (landuse-bare ${s.classes[k].landuseBare})`).join("; ")}`,
  ...s.parts.slice(0, 10).map((p) => `  ${p.cls.padEnd(8)} (${p.box.minX}..${p.box.maxX}; ${p.box.minZ}..${p.box.maxZ}) ${p.m2} m², ściany ${p.walls}%, jezdnia ${p.road}%, szer. ${p.width} m, LoD2 ${p.lod2} m², twarde ${p.hard}% zieleń ${p.green}% inne ${p.rest}% (pod dachem ${p.underRoof}%)`),
  `werdykt: ${s.verdict}`,
];
