/**
 * Bare ground laid from the orthophoto's cover (ADR-0077 step 1.1): where no ground piece and no
 * building of the map lies, the cover raster (`data/orto/<district>.cover.png`, 0.5 m) says what is
 * there, and its class becomes a piece of the lowest layer: green a lawn, light paving a square's
 * paving stones (as the curators' `ADDED_AREAS` lay them). Asphalt stays bare for now: as `road` the
 * simulation reads it as a carriageway (its width, parked cars), a stage of its own.
 *
 * As a land cover layer is built in GIS (Urban Atlas, CORINE): classify the raster, clean it (shade
 * and crowns take the class most of their neighbourhood has, specks join what surrounds them, a
 * minimum mapping unit), then vectorise each class by marching squares (`contour.ts`), simplify
 * the outlines (Douglas-Peucker) and drop pieces under a least area. The outlines follow the map's
 * pieces and walls where they meet them (a cell's edge crossed where its segment enters them), so
 * a fill neither runs under them nor leaves a strip bare. Laid in tiles, so a piece stays small,
 * keeps no holes (a shed in a yard splits its tile) and no square of it is big enough for the
 * crowd's loops.
 *
 * The renderer drapes a piece on a 2.5 m grid, so a fill costs some 3 vertices a metre of its
 * outline: all the city's bare ground would add 0.3 million to the 0.92 million the whole map has
 * resident (budget 1 million, `map-city.test.ts`). So the rule lays everything only in a town's
 * paved places, where bare ground is a glitch (`landuse-bare`, decision 5.11: the shops' and
 * markets' land, a shop's forecourt, a stop's platform), and elsewhere only the compact regions,
 * `FILL.looseWidth` wide on the average and more: a lawn or a yard, not a strip by a wall. Within
 * `FILL.kerbBand` of a carriageway a fill gives way behind bare ground on the kerb (`keepKerbs`):
 * the kerbs' strips are the next rule's (step 1.2), and a fill past one would make it a counted gap.
 */
import { type GroundSurface } from "../../../packages/core/src/world/city-geo.ts";
import { COVER } from "../../orto/src/classify.ts";
import { type Cover, coverFor } from "../../orto/src/cover.ts";
import { Cells, LABEL, STEP, scratch, taken } from "./bare-cells.ts";
import { keepKerbs } from "./bare-kerbs.ts";
import { contours } from "./contour.ts";
import { type Area } from "./features.ts";
import { type OsmData } from "./osm.ts";
import { geoToWorld } from "./project.ts";
import { type Pt, type Rect, ccw, r1, rectsOverlap, removeCollinear, ringBounds, signedArea, simplifyRing } from "./geometry.ts";
import { type GroundOut } from "./model.ts";

/** The rule's settings, measured on the four districts (ADR-0077 step 1.1). */
export const FILL = {
  step: STEP,
  /** A tile's side (m): a piece of square paving stays under the crowd's 1500 m² squares (`crowd.ts`). */
  tile: 36,
  /** Shade and crowns take the class most of the samples this many cells round them have. */
  around: 4,
  /** A region of one class under this many cells (m² x 4) joins the class round it: the minimum mapping unit. */
  speck: 8,
  /**
   * How far round a bridge's deck nothing is laid (m): the photograph shows the deck where the
   * terrain falls away under its sides, and paving there lies a step under its edge (`deck-abutment-step`).
   */
  bridge: 2,
  /** Douglas-Peucker tolerance (m): under half the distance between two outlines, so none crosses another. */
  simplify: 0.1,
  /** The least area of a piece laid (m²). */
  minArea: 1,
  /** The least area of a hole that splits its tile (m²): a smaller one stays under the piece. */
  minHole: 0.5,
  /** Off a town's paved places, the least mean width (2 area / outline, m) of a region laid. */
  looseWidth: 6,
  /** Off a town's paved places, the least area of a region laid (m²). */
  looseArea: 20,
  /** How far off a shop's or a public building's walls its forecourt reaches (m), as `landuse-bare` reads it. */
  forecourt: 5,
  /** How far round a stop its platform reaches (m), as `landuse-bare` reads it. */
  platform: 10,
  /** How far off a carriageway a fill must reach it with nothing bare between (m): `kerb-strip-bare` looks 5 m past the kerb. */
  kerbBand: 5,
} as const;

/**
 * The set pieces' rectangles where the map's surfaces give way (`CLEARED` in
 * `packages/sim/src/content/lublin/sites.ts`: the docks and their basin; the test holds them equal).
 */
export const FILL_CLEARED: readonly Rect[] = [
  { minX: 2520, maxX: 2594, minZ: 390, maxZ: 450 },
  { minX: 2520, maxX: 2594, minZ: 452, maxZ: 500 },
];

/** The surfaces drawn over both fills (a higher lift, `SURFACE_LIFT`), not water, steps, lawns, squares or setts. */
const OVER: ReadonlySet<GroundSurface> = new Set(["footway", "road", "rail", "crossing", "sidewalk"]);

const LAID: readonly { readonly label: number; readonly surface: GroundSurface }[] = [
  { label: LABEL.grass, surface: "grass" },
  { label: LABEL.square, surface: "square" },
];

const labelOf = (cls: number): number =>
  cls === COVER.green ? LABEL.grass : cls === COVER.paving ? LABEL.square : cls === COVER.shadow || cls === COVER.canopy ? LABEL.mixed : LABEL.other;

/** The free cells' labels from the cover; covered ones stay covered. */
const readCover = (cells: Cells, cover: Cover): void => {
  const h = cover.header;
  // Each class's label, and each column's column of the raster (-1 off it).
  const labels = Uint8Array.from({ length: 16 }, (_, c) => labelOf(c));
  const cols = Int32Array.from({ length: cells.nx }, (_, i) => {
    const col = Math.floor((cells.rect.minX + (i + 0.5) * STEP - h.x0) / h.step);
    return col < 0 || col >= h.width ? -1 : col;
  });
  for (let j = 0; j < cells.nz; j++) {
    const row = Math.floor((h.z1 - (cells.rect.minZ + (j + 0.5) * STEP)) / h.step);
    const off = row < 0 || row >= h.height;
    for (let i = 0; i < cells.nx; i++) {
      const k = j * cells.nx + i;
      if (taken(cells.label[k]!)) continue;
      const col = cols[i]!;
      cells.label[k] = labels[off || col < 0 ? COVER.none : cover.cls[row * h.width + col]!]!;
    }
  }
};

/** A summed-area table of the cells of `label`: entry (i, j) counts those west and south of (i, j). */
const summed = (cells: Cells, label: number): Int32Array => {
  const { nx, nz } = cells;
  const s = scratch.i32(`summed.${label}`, (nx + 1) * (nz + 1));
  for (let j = 0; j < nz; j++) {
    let n = 0;
    for (let i = 0; i < nx; i++) {
      if (cells.label[j * nx + i] === label) n++;
      s[(j + 1) * (nx + 1) + i + 1] = n + s[j * (nx + 1) + i + 1]!;
    }
  }
  return s;
};

/** Shade and crowns take the class most of the free cells `FILL.around` round them have, by a summed-area table a class. */
const resolveMixed = (cells: Cells): void => {
  const { nx, nz, label } = cells;
  if (!label.includes(LABEL.mixed)) return;
  const [sg, ss, so] = [summed(cells, LABEL.grass), summed(cells, LABEL.square), summed(cells, LABEL.other)];
  const r = FILL.around;
  const next = scratch.u8("mixed.next", label.length);
  next.set(label);
  for (let j = 0; j < nz; j++) {
    const lo = Math.max(0, j - r) * (nx + 1);
    const hi = Math.min(nz, j + r + 1) * (nx + 1);
    for (let i = 0; i < nx; i++) {
      if (label[j * nx + i] !== LABEL.mixed) continue;
      const i0 = Math.max(0, i - r);
      const i1 = Math.min(nx, i + r + 1);
      const g = sg[hi + i1]! - sg[lo + i1]! - sg[hi + i0]! + sg[lo + i0]!;
      const s = ss[hi + i1]! - ss[lo + i1]! - ss[hi + i0]! + ss[lo + i0]!;
      const o = so[hi + i1]! - so[lo + i1]! - so[hi + i0]! + so[lo + i0]!;
      // Ties and none round it stay bare.
      next[j * nx + i] = g > s && g > o ? LABEL.grass : s > g && s > o ? LABEL.square : LABEL.other;
    }
  }
  label.set(next);
};

/**
 * The 4-connected regions of free cells of one label, `apart` telling which cells keep to
 * themselves (they and the others are regions apart): each with its cells (in `queue`, `n` of
 * them), the free cells of each label round it (`round`) and its cell edges out of it (`edges`).
 */
const eachRegion = (
  cells: Cells,
  apart: Uint8Array | null,
  visit: (queue: Int32Array, n: number, round: Int32Array, edges: number) => void,
  from: (k: number) => boolean = () => true,
): void => {
  const { nx, nz, label } = cells;
  const seen = scratch.u8("region.seen", nx * nz);
  const queue = scratch.i32("region.queue", nx * nz);
  const round = new Int32Array(8);
  for (let s = 0; s < nx * nz; s++) {
    if (seen[s] || taken(label[s]!) || !from(s)) continue;
    const [own, side] = [label[s]!, apart ? apart[s]! : 0];
    let [n, edges] = [0, 0];
    queue[n++] = s;
    seen[s] = 1;
    round.fill(0);
    for (let q = 0; q < n; q++) {
      const k = queue[q]!;
      const i = k % nx;
      for (let d = 0; d < 4; d++) {
        const m = d === 0 ? (i + 1 < nx ? k + 1 : -1) : d === 1 ? (i > 0 ? k - 1 : -1) : d === 2 ? k + nx : k - nx;
        const l = m < 0 || m >= nx * nz ? -1 : label[m]!;
        if (l === own && (apart ? apart[m]! : 0) === side) {
          if (!seen[m]) {
            seen[m] = 1;
            queue[n++] = m;
          }
          continue;
        }
        if (l !== own) edges++;
        if (l >= 0 && l !== own && !taken(l)) round[l]!++;
      }
    }
    visit(queue, n, round, edges);
  }
};

/** Regions of one label under `FILL.speck` cells take the label most of the free cells round them have. */
const joinSpecks = (cells: Cells): void =>
  eachRegion(
    cells,
    null,
    (queue, n, round) => {
      if (n >= FILL.speck) return;
      // The label most of the border has, the lower one on a tie.
      let to = -1;
      for (let l = 0; l < round.length; l++) if (round[l]! > 0 && (to < 0 || round[l]! > round[to]!)) to = l;
      if (to >= 0) for (let q = 0; q < n; q++) cells.label[queue[q]!] = to;
    },
  );

/** Off a town's paved places, a region of lawn or paving narrower than `FILL.looseWidth` on the average or under `FILL.looseArea` stays bare. */
const dropLoose = (cells: Cells): void =>
  eachRegion(
    cells,
    cells.zone,
    (queue, n, _round, edges) => {
      // Area n / 4 m², outline edges / 2 m: the mean width 2 area / outline.
      if (n / edges >= FILL.looseWidth && n * STEP * STEP >= FILL.looseArea) return;
      for (let q = 0; q < n; q++) cells.label[queue[q]!] = LABEL.other;
    },
    (k) => !cells.zone[k] && (cells.label[k] === LABEL.grass || cells.label[k] === LABEL.square),
  );

/**
 * The cells a label's fills are drawn on: its own, and under a piece drawn over it (a carriageway,
 * a pavement) next to them one cell more, so no seam of bare ground runs by a kerb, nor a corner
 * is cut off at it.
 */
const drawnCells = (cells: Cells, label: number): Uint8Array => {
  const { nx, nz } = cells;
  const drawn = scratch.u8(`drawn.${label}`, nx * nz);
  for (let k = 0; k < nx * nz; k++) {
    if (cells.label[k] !== label) continue;
    drawn[k] = 1;
    const i = k % nx;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const m = k + dj * nx + di;
        if (i + di >= 0 && i + di < nx && m >= 0 && m < nx * nz && cells.over[m] === 1) drawn[m] = 1;
      }
  }
  return drawn;
};

const tilePieces = (cells: Cells, label: number, drawn: Uint8Array, surface: GroundSurface, i0: number, j0: number, i1: number, j1: number): GroundOut[] => {
  const { nx, nz } = cells;
  const own = (i: number, j: number) => i >= 0 && j >= 0 && i < nx && j < nz && cells.label[j * nx + i] === label;
  let any = false;
  for (let j = j0; j < j1 && !any; j++) any = cells.label.subarray(j * nx + i0, j * nx + i1).includes(label);
  if (!any) return [];
  const inside = new Uint8Array((i1 - i0) * (j1 - j0));
  for (let j = j0; j < j1; j++) inside.set(drawn.subarray(j * nx + i0, j * nx + i1), (j - j0) * (i1 - i0));
  const rings = contours({
    nx: i1 - i0,
    nz: j1 - j0,
    inside,
    at: (i, j) => cells.at(i + i0, j + j0),
    cross: (ai, aj, bi, bj) => {
      const gi = bi + i0;
      const gj = bj + j0;
      if (!own(ai + i0, aj + j0) || !cells.has(gi, gj) || cells.label[gj * nx + gi] !== LABEL.covered) return 0.5;
      return cells.enter(cells.at(ai + i0, aj + j0), cells.at(gi, gj));
    },
  });
  // A hole (a shed in a yard, a lawn in a paved one) splits the tile through it, across its longer
  // side: the hole's cells then reach the halves' edges, notches of their pieces, not holes.
  const hole = rings.find((r) => -signedArea(r) >= FILL.minHole);
  if (hole) {
    const b = ringBounds(hole);
    if (i1 - i0 >= j1 - j0) {
      const c = Math.min(i1 - 1, Math.max(i0 + 1, Math.round(((b.minX + b.maxX) / 2 - cells.rect.minX) / STEP - 0.5)));
      return [...tilePieces(cells, label, drawn, surface, i0, j0, c, j1), ...tilePieces(cells, label, drawn, surface, c, j0, i1, j1)];
    }
    const r = Math.min(j1 - 1, Math.max(j0 + 1, Math.round(((b.minZ + b.maxZ) / 2 - cells.rect.minZ) / STEP - 0.5)));
    return [...tilePieces(cells, label, drawn, surface, i0, j0, i1, r), ...tilePieces(cells, label, drawn, surface, i0, r, i1, j1)];
  }
  const round = (ring: readonly Pt[]) => removeCollinear(ring.map((p) => ({ x: r1(p.x), z: r1(p.z) })), 0.02);
  return rings
    .filter((r) => signedArea(r) >= FILL.minArea)
    .map((r) => ccw(round(simplifyRing(r, FILL.simplify))))
    .filter((r) => r.length >= 3 && signedArea(r) >= FILL.minArea)
    .map((r) => ({ surface, outline: r.flatMap((p) => [p.x, p.z]) }));
};

/**
 * A town's paved places round a chunk, as `landuse-bare` reads them: the shops' and markets' land
 * and the platforms (`areas`), the stops (`stops`) and the shops' and public buildings' outlines
 * (`shops`), the last with their forecourts.
 */
export interface TownPlaces {
  readonly areas: readonly (readonly Pt[])[];
  readonly stops: readonly Pt[];
  readonly shops: readonly (readonly Pt[])[];
}

const NO_PLACES: TownPlaces = { areas: [], stops: [], shops: [] };

const PAVED_LANDUSE: ReadonlySet<string> = new Set(["retail", "commercial"]);
const PAVED_AMENITY: ReadonlySet<string> = new Set(["marketplace", "bus_station"]);

/** The map's areas and stops of a town's paved places (`TownPlaces`, the shops come a chunk at a time). */
export const townPlaces = (data: OsmData, areas: readonly Area[]): Omit<TownPlaces, "shops"> => ({
  areas: areas
    .filter((a) => PAVED_LANDUSE.has(a.tags.landuse ?? "") || PAVED_AMENITY.has(a.tags.amenity ?? "") || a.tags.public_transport === "platform" || a.tags.public_transport === "station")
    .map((a) => a.ring),
  stops: [...data.nodes.values()]
    .filter((n) => n.tags?.highway === "bus_stop" || n.tags?.railway === "tram_stop" || n.tags?.public_transport === "platform")
    .sort((a, b) => a.id - b.id)
    .map((n) => geoToWorld(n.lat, n.lon)),
});

/**
 * The pieces the cover lays on the bare ground of a chunk: `ground` its pieces, `walls` the
 * buildings' outlines round it (any chunk's), on `cover` (its district's raster), all of it in a
 * town's paved places (`town`), compact regions only elsewhere.
 */
export const coverFills = (rect: Rect, cover: Cover, ground: readonly GroundOut[], walls: readonly (readonly Pt[])[], town: TownPlaces = NO_PLACES): GroundOut[] => {
  const cells = new Cells(rect);
  const ringOf = (flat: readonly number[]) => Array.from({ length: flat.length / 2 }, (_, k) => ({ x: flat[2 * k]!, z: flat[2 * k + 1]! }));
  const boxOf = (r: Rect): Pt[] => [
    { x: r.minX, z: r.minZ },
    { x: r.maxX, z: r.minZ },
    { x: r.maxX, z: r.maxZ },
    { x: r.minX, z: r.maxZ },
  ];
  ground.forEach((g, i) => cells.cover(ringOf(g.outline), g.surface === "road" ? i + 1 : 0, OVER.has(g.surface)));
  for (const w of walls) cells.cover(w);
  for (const g of ground) if (g.bridge) cells.block(ringOf(g.outline), FILL.bridge);
  for (const r of FILL_CLEARED) if (rectsOverlap(r, rect)) cells.cover(boxOf(r));
  for (const a of town.areas) cells.zoneIn(a);
  for (const s of town.shops) cells.zoneNear(s, FILL.forecourt);
  for (const p of town.stops) cells.zoneNear([p], FILL.platform);
  readCover(cells, cover);
  resolveMixed(cells);
  joinSpecks(cells);
  dropLoose(cells);
  keepKerbs(cells, FILL.kerbBand);
  const n = Math.round(FILL.tile / STEP);
  const out: GroundOut[] = [];
  for (const { label, surface } of LAID) {
    const drawn = drawnCells(cells, label);
    for (let j0 = 0; j0 < cells.nz; j0 += n)
      for (let i0 = 0; i0 < cells.nx; i0 += n) out.push(...tilePieces(cells, label, drawn, surface, i0, j0, Math.min(cells.nx, i0 + n), Math.min(cells.nz, j0 + n)));
  }
  return out;
};

/** What a chunk's fills are laid from: its rect, its pieces and the shops and public buildings among its buildings. */
export type CoverFill = (rect: Rect, ground: readonly GroundOut[], shops: readonly (readonly Pt[])[]) => GroundOut[];

/**
 * The fills of each chunk from its district's cover (`covers`), round `walls` (every building's
 * outline, any chunk's) and in the paved places of `town` (the whole map's areas and stops).
 */
export const coverFiller = (covers: readonly Cover[], walls: readonly (readonly Pt[])[], town: Omit<TownPlaces, "shops">): CoverFill => {
  const boxed = <T>(items: readonly T[], ring: (t: T) => readonly Pt[]) => items.map((t) => ({ t, box: ringBounds(ring(t)) }));
  const [wallBoxes, areaBoxes] = [boxed(walls, (w) => w), boxed(town.areas, (a) => a)];
  return (rect, ground, shops) => {
    const cover = coverFor(covers, { x: (rect.minX + rect.maxX) / 2, z: (rect.minZ + rect.maxZ) / 2 });
    if (!cover) return [];
    const near = (m: number) => ({ minX: rect.minX - m, minZ: rect.minZ - m, maxX: rect.maxX + m, maxZ: rect.maxZ + m });
    const pick = <T>(items: readonly { t: T; box: Rect }[], m: number) => items.filter((w) => rectsOverlap(w.box, near(m))).map((w) => w.t);
    const stops = town.stops.filter((p) => p.x > rect.minX - FILL.platform && p.x < rect.maxX + FILL.platform && p.z > rect.minZ - FILL.platform && p.z < rect.maxZ + FILL.platform);
    return coverFills(rect, cover, ground, pick(wallBoxes, 1), { areas: pick(areaBoxes, 1), stops, shops });
  };
};

/** Draw order of the surfaces the rule lays: each fill goes first among the pieces of its surface. */
const ORDER: Readonly<Partial<Record<GroundSurface, number>>> = { water: 0, grass: 1, square: 2 };

/** The chunk's ground with the fills, each at the start of its surface's pieces (the lowest layer). */
export const withFills = (ground: readonly GroundOut[], fills: readonly GroundOut[]): GroundOut[] => {
  const out = [...ground];
  for (const s of ["square", "grass"] as const) {
    const mine = fills.filter((f) => f.surface === s);
    const at = out.findIndex((g) => (ORDER[g.surface] ?? 99) >= ORDER[s]!);
    out.splice(at < 0 ? out.length : at, 0, ...mine);
  }
  return out;
};
