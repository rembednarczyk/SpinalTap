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
 * `FILL.looseWidth` wide on the average and more: a lawn or a yard, not a strip by a wall; but a
 * strip between a carriageway and the next piece past it is laid however narrow (step 1.2,
 * `bare-strips.ts`). Within `FILL.kerbBand` of a carriageway a fill gives way behind bare ground on
 * the kerb (`keepKerbs`, the asphalt the rule leaves): a fill past it would make it a counted gap.
 */
import { FillRule, type Path64, difference, isPositive } from "clipper2-ts";
import { type GroundSurface } from "../../../packages/core/src/world/city-geo.ts";
import { SpatialHash } from "../../../packages/core/src/math/spatial-hash.ts";
import { type Cover, coverFor } from "../../orto/src/cover.ts";
import { Cells, LABEL as CELL_LABEL, STEP as CELL_STEP, scratch } from "./bare-cells.ts";
import { dropLoose, joinSpecks, readCover } from "./bare-clean.ts";
import { keepKerbs } from "./bare-kerbs.ts";
import { kerbStrips } from "./bare-strips.ts";
import { contours } from "./contour.ts";
import { type Area, type Line } from "./features.ts";
import { type OsmData } from "./osm.ts";
import { geoToWorld } from "./project.ts";
import { type Pt, type Rect, ccw, rectsOverlap, removeCollinear, ringBounds, signedArea, simplifyRing, splitTouching } from "./geometry.ts";
import { type GroundOut } from "./model.ts";

// Module-local copies of what the cell loops read: Vitest's module runner reads an imported binding
// through a getter of the module's namespace, which a loop of 190 000 cells would pay at each cell.
const LABEL = { ...CELL_LABEL } as const;
const STEP = CELL_STEP;

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
  /**
   * How far past a town's paved place its fill reaches (m): the wider gaps `ground-strip-gap` counts
   * (up to 1.25 m), so the place's edge leaves no strip of bare ground between its fill and a piece.
   */
  zoneMargin: 3,
  /** How far off a carriageway a fill must reach it with nothing bare between (m): `kerb-strip-bare` looks 5 m past the kerb. */
  kerbBand: 5,
  /** The widest strip between a carriageway and the next piece past it laid however narrow (m, step 1.2, `bare-strips.ts`): as far as `kerb-strip-bare` looks. */
  kerbStrip: 5,
} as const;

/**
 * The set pieces' rectangles where the map's surfaces give way (`CLEARED` in
 * `packages/sim/src/content/lublin/sites.ts`: the docks and their basin; the test holds them equal).
 */
export const FILL_CLEARED: readonly Rect[] = [
  { minX: 2520, maxX: 2594, minZ: 390, maxZ: 450 },
  { minX: 2520, maxX: 2594, minZ: 452, maxZ: 500 },
];

/** The surfaces a kerb's strip between a carriageway and them is laid to (`kerbStrips`): what `kerb-gap-bare` and `kerb-strip-bare` count a strip to. */
const STRIP_ENDS: ReadonlySet<GroundSurface> = new Set(["sidewalk", "footway", "square", "cobble", "steps", "crossing", "grass"]);

const LAID: readonly [lawn: { readonly label: number; readonly surface: GroundSurface }, paving: { readonly label: number; readonly surface: GroundSurface }] = [
  { label: LABEL.grass, surface: "grass" },
  { label: LABEL.square, surface: "square" },
];

/** Each laid label's bit in `drawnCells`, 0 for the rest. */
const BIT = Uint8Array.from({ length: 8 }, (_, l) => (l === LABEL.grass ? 1 : l === LABEL.square ? 2 : 0));

/** The bits of the labels at and beside each cell of row `j` (`BIT`) into row `j % 3` of `beside`. */
const besideRow = (lab: Uint8Array, nx: number, j: number, beside: Uint8Array): void => {
  const o = j * nx;
  const into = (j % 3) * nx;
  let prev = 0;
  let cur = BIT[lab[o]!]!;
  for (let i = 0; i < nx; i++) {
    const next = i + 1 < nx ? BIT[lab[o + i + 1]!]! : 0;
    beside[into + i] = prev | cur | next;
    prev = cur;
    cur = next;
  }
};

/** Each label's mask of the laid labels' bits a covered cell takes from the cells round it (`drawnCells`): all of them, none for the rest. */
const COVERED_TAKES = Uint8Array.from({ length: 8 }, (_, l) => (l === LABEL.covered ? 3 : 0));

/** What `drawnRow` works a row with: `beside` holds three rows of `besideRow` and a fourth of none, for the rows off the raster. */
interface DrawnRows {
  readonly lab: Uint8Array;
  readonly nx: number;
  readonly tile: number;
  readonly has: Uint8Array;
  readonly grass: Uint8Array;
  readonly square: Uint8Array;
  readonly beside: Uint8Array;
}

/** Row `j` of `drawnCells` (of `nz` rows), a function of its own (see `bare-clean.ts`); `row` the row of tiles in `has`. */
const drawnRow = (d: DrawnRows, j: number, nz: number, row: number): void => {
  const { lab, nx, tile, has, grass, square, beside } = d;
  const o = j * nx;
  const here = (j % 3) * nx;
  const south = j > 0 ? ((j - 1) % 3) * nx : 3 * nx;
  const north = j + 1 < nz ? ((j + 1) % 3) * nx : 3 * nx;
  for (let i0 = 0, t = row; i0 < nx; i0 += tile, t++) {
    let held = 0;
    const end = Math.min(nx, i0 + tile);
    for (let i = i0; i < end; i++) {
      const l = lab[o + i]!;
      const own = BIT[l]!;
      held |= own;
      const v = own | (COVERED_TAKES[l]! & (beside[here + i]! | beside[south + i]! | beside[north + i]!));
      grass[o + i] = v & 1;
      square[o + i] = v >> 1;
    }
    has[t]! |= held;
  }
};

/**
 * The cells the laid labels' fills are traced on, a bit a label (`BIT`): its own, and one cell more
 * under the map's pieces and walls next to them (a covered cell with one of the label among the
 * eight round it), which then cut the fill on their edges (`cutByPieces`): no seam of bare ground
 * and no overlap where they meet. One pass, a row at a time (`drawnRow`), the cells beside a label
 * along the rows kept for three rows; the bits of the labels each tile of `tile` cells holds go to
 * `has`.
 */
const drawnCells = (cells: Cells, tile: number, has: Uint8Array): [grass: Uint8Array, square: Uint8Array] => {
  const { nx, nz } = cells;
  const lab = cells.label;
  const d: DrawnRows = {
    lab,
    nx,
    tile,
    has,
    grass: scratch.u8("drawn.grass", nx * nz, null),
    square: scratch.u8("drawn.square", nx * nz, null),
    beside: scratch.u8("drawn.beside", 4 * nx, null),
  };
  d.beside.fill(0, 3 * nx, 4 * nx);
  const tx = Math.ceil(nx / tile);
  besideRow(lab, nx, 0, d.beside);
  for (let j = 0; j < nz; j++) {
    if (j + 1 < nz) besideRow(lab, nx, j + 1, d.beside);
    drawnRow(d, j, nz, Math.floor(j / tile) * tx);
  }
  return [d.grass, d.square];
};

/**
 * The outlines of one label (`drawn` its cells, `drawnCells`) in a tile of cells, simplified, as the
 * chunk's ground, less `over` (the other label's pieces of the tile); a hole splits the tile.
 * `held`: the tile is known to hold the label.
 */
const tilePieces = (cells: Cells, label: number, drawn: Uint8Array, surface: GroundSurface, i0: number, j0: number, i1: number, j1: number, held = false, over: readonly (readonly Pt[])[] = []): GroundOut[] => {
  const { nx } = cells;
  let any = held;
  for (let j = j0; j < j1 && !any; j++) any = cells.label.subarray(j * nx + i0, j * nx + i1).includes(label);
  if (!any) return [];
  const inside = new Uint8Array((i1 - i0) * (j1 - j0));
  for (let j = j0; j < j1; j++) inside.set(drawn.subarray(j * nx + i0, j * nx + i1), (j - j0) * (i1 - i0));
  const rings = contours({
    nx: i1 - i0,
    nz: j1 - j0,
    inside,
    at: (i, j) => cells.at(i + i0, j + j0),
    // Half way: where a fill meets the map's pieces, the pieces themselves cut it (`cutByPieces`).
    cross: () => 0.5,
  });
  // A hole (a shed in a yard, a lawn in a paved one) splits the tile through it, across its longer
  // side: the hole's cells then reach the halves' edges, notches of their pieces, not holes.
  const hole = rings.find((r) => -signedArea(r) >= FILL.minHole);
  if (hole) {
    const b = ringBounds(hole);
    if (i1 - i0 >= j1 - j0) {
      const c = Math.min(i1 - 1, Math.max(i0 + 1, Math.round(((b.minX + b.maxX) / 2 - cells.rect.minX) / STEP - 0.5)));
      return [...tilePieces(cells, label, drawn, surface, i0, j0, c, j1, false, over), ...tilePieces(cells, label, drawn, surface, c, j0, i1, j1, false, over)];
    }
    const r = Math.min(j1 - 1, Math.max(j0 + 1, Math.round(((b.minZ + b.maxZ) / 2 - cells.rect.minZ) / STEP - 0.5)));
    return [...tilePieces(cells, label, drawn, surface, i0, j0, i1, r, false, over), ...tilePieces(cells, label, drawn, surface, i0, r, i1, j1, false, over)];
  }
  const simple = rings.filter((r) => signedArea(r) >= FILL.minArea).map((r) => simplifyRing(r, FILL.simplify));
  const tile = { minX: cells.rect.minX + i0 * STEP - 1, minZ: cells.rect.minZ + j0 * STEP - 1, maxX: cells.rect.minX + i1 * STEP + 1, maxZ: cells.rect.minZ + j1 * STEP + 1 };
  return cutByPieces(simple, cells.coversNear(tile).map((c) => c.ring), over)
    .filter((r) => r.length >= 3 && signedArea(r) >= FILL.minArea)
    .map((r) => ({ surface, outline: r.flatMap((p) => [p.x, p.z]) }));
};

/** Clipper2's integer grid (1 cm): the pieces of the tables lie on 0.1 m. */
const CLIP_SCALE = 100;

/**
 * The fills less the map's pieces and walls over them (Clipper2, ADR-0078): a fill laid a cell
 * under them ends exactly on their edges, no overlap and no seam. A hole the cut leaves (a piece
 * under 0.5 m² inside a fill) is not cut: the fill runs under it.
 */
const toPath = (r: readonly Pt[]): Path64 => r.map((p) => ({ x: Math.round(p.x * CLIP_SCALE), y: Math.round(p.z * CLIP_SCALE) }));
/**
 * The pieces' paths, made once a piece however many tiles it meets, counter-clockwise: a clockwise
 * one over another would cancel its winding (`NonZero`), and the fill would run on under both.
 */
const PATHS = new WeakMap<readonly Pt[], Path64>();
const pathOf = (r: readonly Pt[]): Path64 => {
  let p = PATHS.get(r);
  if (!p) PATHS.set(r, (p = toPath(signedArea(r) < 0 ? [...r].reverse() : r)));
  return p;
};

/** Whether two non-adjacent edges of the ring properly cross (`selfIntersects`), the edges swept along x. */
const crossesItself = (ring: readonly Pt[]): boolean => {
  const n = ring.length;
  const lo = (i: number) => Math.min(ring[i]!.x, ring[(i + 1) % n]!.x);
  const hi = (i: number) => Math.max(ring[i]!.x, ring[(i + 1) % n]!.x);
  const order = Array.from({ length: n }, (_, i) => i).sort((p, q) => lo(p) - lo(q));
  const side = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  for (let s = 0; s < n; s++) {
    const i = order[s]!;
    for (let t = s + 1; t < n && lo(order[t]!) <= hi(i); t++) {
      const j = order[t]!;
      const u = Math.min(i, j);
      const v = Math.max(i, j);
      if (v - u < 2 || (u === 0 && v === n - 1)) continue;
      const a = ring[u]!;
      const b = ring[(u + 1) % n]!;
      const c = ring[v]!;
      const d = ring[(v + 1) % n]!;
      const d1 = side(c, d, a);
      const d2 = side(c, d, b);
      const d3 = side(a, b, c);
      const d4 = side(a, b, d);
      if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
    }
  }
  return false;
};

const cutByPieces = (fills: readonly (readonly Pt[])[], pieces: readonly (readonly Pt[])[], over: readonly (readonly Pt[])[] = []): Pt[][] => {
  const cut = pieces.length + over.length > 0 ? difference(fills.map(toPath), [...pieces.map(pathOf), ...over.map(toPath)], FillRule.NonZero) : fills.map(toPath);
  // A sliver the cut leaves crossing itself is dropped: it would draw no ground the scan agrees with.
  // A ring touching itself is cut into its lobes (`splitTouching`); a hole's lobe, turning the other
  // way, goes, as the holes do.
  return cut
    .filter((p) => isPositive(p))
    .flatMap((p) => splitTouching(p.map((q) => ({ x: q.x / CLIP_SCALE, z: q.y / CLIP_SCALE }))))
    .filter((r) => signedArea(r) > 0)
    .map((r) => ccw(removeCollinear(r, 0.005)))
    .filter((r) => !crossesItself(r));
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

/** The paths a loop of which is laid whole inside (`pathLoops`). */
const LOOP_PATHS: ReadonlySet<string> = new Set(["footway", "path", "cycleway", "pedestrian"]);

/**
 * The outlines of the map's paths closed on themselves, on the ground (a footway round a lawn, a
 * plaza's ring): what they enclose is laid whole, as in a town's paved place. Until ADR-0078's
 * step 2 the band of such a loop crossed itself and the renderer drew it over the ground inside
 * too; laid right, the narrow strips between the loops' bands (Podzamcze, (1046; 424)) would
 * otherwise stay bare under the compact regions' rule.
 */
export const pathLoops = (lines: readonly Line[]): Pt[][] =>
  lines
    .filter(({ tags: t }) => LOOP_PATHS.has(t.highway ?? "") && t.area !== "yes" && t.tunnel === undefined && (t.bridge ?? "no") === "no" && Number(t.layer ?? 0) >= 0)
    .filter(({ line: l }) => l.length >= 4 && l[0]!.x === l[l.length - 1]!.x && l[0]!.z === l[l.length - 1]!.z)
    .map((l) => [...l.line]);

/** The map's areas and stops of a town's paved places (`TownPlaces`, the shops come a chunk at a time), and the paths' loops (`pathLoops`). */
export const townPlaces = (data: OsmData, areas: readonly Area[], loops: readonly (readonly Pt[])[] = []): Omit<TownPlaces, "shops"> => ({
  areas: [
    ...areas
      .filter((a) => PAVED_LANDUSE.has(a.tags.landuse ?? "") || PAVED_AMENITY.has(a.tags.amenity ?? "") || a.tags.public_transport === "platform" || a.tags.public_transport === "station")
      .map((a) => a.ring),
    ...loops,
  ],
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
  const ringOf = (flat: readonly number[]) => {
    const ring: Pt[] = [];
    for (let k = 0; k + 1 < flat.length; k += 2) ring.push({ x: flat[k]!, z: flat[k + 1]! });
    return ring;
  };
  const boxOf = (r: Rect): Pt[] => [
    { x: r.minX, z: r.minZ },
    { x: r.maxX, z: r.minZ },
    { x: r.maxX, z: r.maxZ },
    { x: r.minX, z: r.maxZ },
  ];
  ground.forEach((g, i) => cells.cover(ringOf(g.outline), g.surface === "road" ? i + 1 : 0, STRIP_ENDS.has(g.surface)));
  for (const w of walls) cells.cover(w);
  for (const g of ground) if (g.bridge) cells.block(ringOf(g.outline), FILL.bridge);
  for (const r of FILL_CLEARED) if (rectsOverlap(r, rect)) cells.cover(boxOf(r));
  for (const a of town.areas) cells.zoneIn(a);
  for (const s of town.shops) cells.zoneNear(s, FILL.forecourt);
  for (const p of town.stops) cells.zoneNear([p], FILL.platform);
  cells.growZone(FILL.zoneMargin);
  readCover(cells, cover, FILL.around);
  joinSpecks(cells, FILL.speck);
  kerbStrips(cells, FILL.kerbStrip, FILL.zoneMargin);
  dropLoose(cells, FILL.looseWidth, FILL.looseArea);
  keepKerbs(cells, FILL.kerbBand);
  const n = Math.round(FILL.tile / STEP);
  const out: GroundOut[] = [];
  const has = new Uint8Array(Math.ceil(cells.nx / n) * Math.ceil(cells.nz / n));
  const drawn = drawnCells(cells, n, has);
  const [lawn, paving] = LAID;
  const lawns: GroundOut[] = [];
  // Paving first, a tile at a time, and the tile's lawns less it: the two simplified apart would
  // overlap and part along their border by up to `FILL.simplify` (`ground-strip-overlap`).
  for (let j0 = 0, t = 0; j0 < cells.nz; j0 += n)
    for (let i0 = 0; i0 < cells.nx; i0 += n, t++) {
      const [i1, j1] = [Math.min(cells.nx, i0 + n), Math.min(cells.nz, j0 + n)];
      const laid = has[t]! & BIT[paving.label]! ? tilePieces(cells, paving.label, drawn[1], paving.surface, i0, j0, i1, j1, true) : [];
      out.push(...laid);
      if (has[t]! & BIT[lawn.label]!) lawns.push(...tilePieces(cells, lawn.label, drawn[0], lawn.surface, i0, j0, i1, j1, true, laid.map((g) => ringOf(g.outline))));
    }
  return [...lawns, ...out];
};

/** What a chunk's fills are laid from: its rect, its pieces and the shops and public buildings among its buildings. */
export type CoverFill = (rect: Rect, ground: readonly GroundOut[], shops: readonly (readonly Pt[])[]) => GroundOut[];

/** Side of the cells of the grid the walls and areas round a chunk are found by (m). */
const FILLER_CELL = 50;

/**
 * The fills of each chunk from its district's cover (`covers`), round `walls` (every building's
 * outline, any chunk's) and in the paved places of `town` (the whole map's areas and stops).
 */
export const coverFiller = (covers: readonly Cover[], walls: readonly (readonly Pt[])[], town: Omit<TownPlaces, "shops">): CoverFill => {
  // Broad phase: the rings by the cells of a grid, each with its box (`rectsOverlap` the narrow phase).
  const grid = (rings: readonly (readonly Pt[])[]) => {
    const g = new SpatialHash<{ readonly ring: readonly Pt[]; readonly box: Rect }>(FILLER_CELL);
    for (const ring of rings) {
      const box = ringBounds(ring);
      g.insert({ ring, box }, box.minX, box.minZ, box.maxX, box.maxZ);
    }
    return g;
  };
  const [wallGrid, areaGrid] = [grid(walls), grid(town.areas)];
  return (rect, ground, shops) => {
    const cover = coverFor(covers, { x: (rect.minX + rect.maxX) / 2, z: (rect.minZ + rect.maxZ) / 2 });
    if (!cover) return [];
    const near = { minX: rect.minX - 1, minZ: rect.minZ - 1, maxX: rect.maxX + 1, maxZ: rect.maxZ + 1 };
    const pick = (g: ReturnType<typeof grid>) => g.query(near.minX, near.minZ, near.maxX, near.maxZ).filter((w) => rectsOverlap(w.box, near)).map((w) => w.ring);
    const stops = town.stops.filter((p) => p.x > rect.minX - FILL.platform && p.x < rect.maxX + FILL.platform && p.z > rect.minZ - FILL.platform && p.z < rect.maxZ + FILL.platform);
    return coverFills(rect, cover, ground, pick(wallGrid), { areas: pick(areaGrid), stops, shops });
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
