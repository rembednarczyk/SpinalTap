/**
 * Shared vocabulary of the city built from map data (ADR-0042): Lublin's centre from
 * OpenStreetMap and a terrain model, converted offline by `tools/osm-import` into content the
 * simulation and the renderer read. No network at runtime.
 */

/** A point on the ground plane in world metres: x east, z north. */
export interface GroundPoint {
  readonly x: number;
  readonly z: number;
}

/**
 * The geographic anchor of world coordinates (ADR-0042): world (0, 0) is this point, x grows
 * east and z north in metres, on a local tangent plane (equirectangular around the anchor; the
 * error stays under 0.1 % across the 2 km the game covers). `altitude` is the terrain height
 * mapped to world y = 0.
 */
export interface GeoAnchor {
  readonly lat: number;
  readonly lon: number;
  readonly altitude: number;
}

/** Plac Litewski, by the fountain: the middle of the game's Krakowskie Przedmieście. */
export const LUBLIN_ANCHOR: GeoAnchor = { lat: 51.24838, lon: 22.55964, altitude: 195.8 };

/** What a building is for: chooses its facade, its ground floor and its signs. */
export type BuildingUse = "residential" | "commercial" | "civic" | "church" | "historic" | "industrial" | "garage" | "other";

/**
 * Terrain heights on a regular grid (ADR-0042): `heights[row * cols + col]` is the ground
 * height in world metres at x = originX + col * cell, z = originZ + row * cell. Between the
 * points the height is interpolated bilinearly, the same way in the simulation and the
 * renderer, so feet and ground agree.
 */
export interface TerrainGrid {
  readonly originX: number;
  readonly originZ: number;
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  readonly heights: readonly number[];
  /** Breaklines the height is not interpolated across (`city-geo.ts` `brokenHeight`): the walls a terrace steps under. */
  readonly breaks?: readonly (readonly GroundPoint[])[];
}

/** Ground height of `grid` at (x, z); clamped to the grid's edge outside it; stepping at its breaklines. */
export const terrainHeightAt = (grid: TerrainGrid, x: number, z: number): number => {
  const fx = Math.min(Math.max((x - grid.originX) / grid.cell, 0), grid.cols - 1);
  const fz = Math.min(Math.max((z - grid.originZ) / grid.cell, 0), grid.rows - 1);
  const c0 = Math.min(Math.floor(fx), grid.cols - 2 < 0 ? 0 : grid.cols - 2);
  const r0 = Math.min(Math.floor(fz), grid.rows - 2 < 0 ? 0 : grid.rows - 2);
  const c1 = Math.min(c0 + 1, grid.cols - 1);
  const r1 = Math.min(r0 + 1, grid.rows - 1);
  const tx = fx - c0;
  const tz = fz - r0;
  const h = (r: number, c: number) => grid.heights[r * grid.cols + c] ?? 0;
  const broken = grid.breaks ? brokenHeight(grid, c0, r0, tx, tz, x, z, h) : undefined;
  if (broken !== undefined) return broken;
  const top = h(r0, c0) * (1 - tx) + h(r0, c1) * tx;
  const bottom = h(r1, c0) * (1 - tx) + h(r1, c1) * tx;
  return top * (1 - tz) + bottom * tz;
};

/** Which sides of a chunk's terrain are the edge of the map data. */
export interface TerrainOpenSides {
  readonly south: boolean;
  readonly north: boolean;
  readonly west: boolean;
  readonly east: boolean;
}

/** Ground surfaces drawn from map areas and ways (ADR-0042). */
/**
 * `basin`: a fountain's water inside its stone rim, standing above the square. `steps`: one
 * straight run of outdoor steps; its long side is the direction of the flight. `crossing`: a
 * zebra across a carriageway; its long side runs across the road, kerb to kerb.
 */
export type GroundSurface = "road" | "sidewalk" | "square" | "cobble" | "footway" | "steps" | "crossing" | "grass" | "water" | "basin" | "rail";

/**
 * Lift above the terrain per surface (m): order of drawing where they overlap. The carriageway
 * and what is painted on it (a few centimetres up: the drapes of the two differ that much on a
 * slope) lie over the squares' paving and the paths it crosses (a street
 * through Plac Łokietka, a park path meeting a road), under the raised sidewalks only. The
 * renderer drapes each surface this high; the simulation sets what stands on the paving (a
 * parked car, G-130) on the same height.
 */
export const SURFACE_LIFT: Readonly<Record<GroundSurface, number>> = {
  water: 0.03,
  grass: 0.04,
  steps: 0.05,
  square: 0.08,
  cobble: 0.08,
  footway: 0.09,
  road: 0.1,
  rail: 0.105,
  crossing: 0.13,
  sidewalk: 0.16,
  basin: 0.32,
};

/**
 * Road markings of the map city (ADR-0052), from the carriageways' lanes, direction and tags:
 * - `centre-dash`: the broken line between the two directions (P-1);
 * - `centre-double`: the double solid line between them on four lanes and more (P-4);
 * - `lane-dash`: the broken line between two lanes of one direction;
 * - `edge`: the solid line along the edge of a main road (P-7);
 * - `stop`: the stop line across the lanes before traffic lights (P-14);
 * - `cycle-lane`, `bus-lane`: a lane of its own along the kerb.
 */
export type RoadMarkingKind = "centre-dash" | "centre-double" | "lane-dash" | "edge" | "stop" | "cycle-lane" | "bus-lane";

/**
 * Street furniture of the map city (ADR-0047), from `docs/world/lublin-props.todo.json`: the
 * five Lublin lamp types, benches, bollards, trees, bins and the rest. Drawn in bulk per chunk.
 * The last four came with the street furniture of ADR-0058 stage 2: free-standing cash machines,
 * fire hydrants, food carts on the markets and shipping containers on the riverside. ADR-0058
 * stage 3 adds the market's stock beside the stalls (`market-goods`: cartons on a pallet, barrels,
 * crates, goods under a canvas) and the food booths in front of the fast-food venues (`food-stall`:
 * a yatai with its counter, stools, noren and lanterns). ADR-0058 stage 9 adds the doors on the
 * facades (`door`: on a building's wall, at an entrance of the map or under a venue's board; its
 * variant holds the model in the low 3 bits, the width (5 cm steps) and the height (2 cm) above them,
 * `doorVariant`). Drawn only: the walls behind them are the building's solid already. ADR-0058
 * stage 6 adds the decals, drawn only (`decals.ts`): `graffiti` on walls without glass,
 * `house-plate` with the map's house number, `sticker` on a pole or a cabinet, `drain-grate` at the kerb.
 * ADR-0058 stage 8 adds the still crowd, drawn only (`figures.ts`): a `figure` sitting on a bench or a
 * stool, queueing at a booth, waiting at a stop or smoking by a door; its variant holds its pose, build,
 * seat and look (`figureVariant`). ADR-0077 adds the map's walls, fences, hedges and gates, a `barrier`
 * a straight stretch of one (`barriers.ts`): its variant holds the kind, length, height and rise.
 * ADR-0087 adds the building sites' pieces (`sites.ts`): the fence's stretches, the gate, the board
 * and the office containers, laid by the import's generator; stage 2 the tower crane and the scaffold.
 */
export type StreetPropKind =
  | "lamp-pastoral"
  | "lamp-wall-lantern"
  | "lamp-candelabra"
  | "lamp-modern-pole"
  | "lamp-road"
  | "lamp-park"
  | "floodlight"
  | "bench"
  | "bollard"
  | "tree"
  | "shrubs"
  | "planter"
  | "hanging-basket"
  | "waste-bin"
  | "bike-rack"
  | "bike-station"
  | "advertising-column"
  | "a-frame-sign"
  | "street-plate"
  | "street-cabinet"
  | "manhole"
  | "granite-block"
  | "flagpole"
  | "traffic-signal"
  | "bus-shelter"
  | "bus-stop"
  | "ticket-machine"
  | "vending-machine"
  | "kiosk"
  | "cafe-garden"
  | "market-stall"
  | "trolley-pole"
  | "fountain-jets"
  | "monument"
  | "artwork"
  | "cctv"
  | "atm"
  | "hydrant"
  | "food-cart"
  | "container"
  | "market-goods"
  | "food-stall"
  | "graffiti"
  | "house-plate"
  | "sticker"
  | "drain-grate"
  | "door"
  | "figure"
  | "barrier"
  | "site-fence"
  | "site-gate"
  | "site-board"
  | "site-cabin"
  | "site-crane"
  | "site-scaffold"
  // ADR-0096: the odds and ends of `extra-props.glb` (`clutter.ts`), one model per shape.
  | "clutter"
  // ADR-0098: the rooms' detail of `room-detail-props.glb` (`room-detail.ts`), built by Blender, one model per shape.
  | "room-detail";

/** One piece of street furniture, in world metres relative to its chunk entity's position. */
export interface StreetPropItem {
  readonly prop: StreetPropKind;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Facing around Y in radians (a bench's front, a lamp's arm). */
  readonly yaw: number;
  /**
   * Seed of the variation (species and size of a tree, `trees.ts`; colour of a bin, which monument), up to 16 bits. For
   * a bollard its chains (G-032), 0 for none: bits 0-8 where the chain along its +x ends (cm from
   * its centre, at the next post's face or a lamp's shaft), bits 9-17 where a second chain ends
   * behind it, back to a lamp of its row (cm), bits 18-24 that chain's turn off its -x towards
   * +z (degrees + 64).
   */
  readonly variant: number;
}

/**
 * Breaklines of a terrain grid (G-971, T-351): polylines the ground may not be interpolated
 * across, where a retaining wall stands over a step of the terrain. Pattern: interpolation with
 * barriers (the hard breaklines of a TIN, the barrier polylines of GIS interpolation such as
 * ArcGIS's IDW): a sample across a barrier is left out. Here, in a cell of the grid a line
 * crosses, the bilinear weights of the corners on the other side of the line from the point are
 * dropped and the rest scaled up to one, so the ground steps at the line itself instead of over
 * the whole cell. Where we differ: the grid stays regular and the line cuts its cells; a cell is
 * cut by the infinite line of its nearest segment, so past a line's end within its last cell the
 * cut runs on (at most a cell; the walls' ends meet a flight or fade to no step there).
 */

/** One segment of a breakline. */
interface Segment {
  readonly a: GroundPoint;
  readonly b: GroundPoint;
}

/** The grid's frame as the cut needs it. */
interface GridFrame {
  readonly originX: number;
  readonly originZ: number;
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  readonly breaks?: readonly (readonly GroundPoint[])[];
}

/** Does the segment pass through the box (Liang-Barsky clipping)? */
const crosses = (s: Segment, minX: number, minZ: number, maxX: number, maxZ: number): boolean => {
  const dx = s.b.x - s.a.x;
  const dz = s.b.z - s.a.z;
  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of [
    [-dx, s.a.x - minX],
    [dx, maxX - s.a.x],
    [-dz, s.a.z - minZ],
    [dz, maxZ - s.a.z],
  ] as const) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
};

const CELLS = new WeakMap<GridFrame, ReadonlyMap<number, readonly Segment[]>>();

/** The cells of the grid its breaklines cross (row * (cols - 1) + col), each with the segments through it. */
export const breakCells = (g: GridFrame): ReadonlyMap<number, readonly Segment[]> => {
  const known = CELLS.get(g);
  if (known) return known;
  const out = new Map<number, Segment[]>();
  const [cols, rows] = [g.cols - 1, g.rows - 1];
  for (const line of g.breaks ?? []) {
    for (let i = 0; i + 1 < line.length; i++) {
      const s = { a: line[i] as GroundPoint, b: line[i + 1] as GroundPoint };
      const c0 = Math.max(0, Math.floor((Math.min(s.a.x, s.b.x) - g.originX) / g.cell));
      const c1 = Math.min(cols - 1, Math.floor((Math.max(s.a.x, s.b.x) - g.originX) / g.cell));
      const r0 = Math.max(0, Math.floor((Math.min(s.a.z, s.b.z) - g.originZ) / g.cell));
      const r1 = Math.min(rows - 1, Math.floor((Math.max(s.a.z, s.b.z) - g.originZ) / g.cell));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const [x, z] = [g.originX + c * g.cell, g.originZ + r * g.cell];
          if (!crosses(s, x, z, x + g.cell, z + g.cell)) continue;
          const k = r * cols + c;
          out.set(k, [...(out.get(k) ?? []), s]);
        }
      }
    }
  }
  CELLS.set(g, out);
  return out;
};

/** Which side of the segment's line p is on: true to its left (or on it). */
const leftOf = (s: Segment, p: GroundPoint): boolean => (s.b.x - s.a.x) * (p.z - s.a.z) - (s.b.z - s.a.z) * (p.x - s.a.x) >= 0;

const distance2 = (s: Segment, p: GroundPoint): number => {
  const [dx, dz] = [s.b.x - s.a.x, s.b.z - s.a.z];
  const t = Math.max(0, Math.min(1, ((p.x - s.a.x) * dx + (p.z - s.a.z) * dz) / (dx * dx + dz * dz || 1)));
  return (p.x - s.a.x - dx * t) ** 2 + (p.z - s.a.z - dz * t) ** 2;
};

/** The segment of `segments` nearest p. */
const nearestOf = (segments: readonly Segment[], p: GroundPoint): Segment =>
  segments.reduce((best, s) => (distance2(s, p) < distance2(best, p) ? s : best), segments[0] as Segment);

/**
 * The height at (x, z) in cell (c0, r0) when a breakline crosses it: the bilinear blend of the
 * corners on the point's side of the line only. Undefined where no line crosses the cell, or no
 * corner is on the point's side (a line through the cell twice); the caller interpolates as usual.
 */
export const brokenHeight = (g: GridFrame, c0: number, r0: number, tx: number, tz: number, x: number, z: number, h: (r: number, c: number) => number): number | undefined => {
  if (!g.breaks || g.cols < 2 || g.rows < 2) return undefined;
  const segments = breakCells(g).get(r0 * (g.cols - 1) + c0);
  if (!segments) return undefined;
  const s = nearestOf(segments, { x, z });
  const side = leftOf(s, { x, z });
  let sum = 0;
  let weight = 0;
  let count = 0;
  let plain = 0;
  for (const [dr, dc, w] of [
    [0, 0, (1 - tx) * (1 - tz)],
    [0, 1, tx * (1 - tz)],
    [1, 0, (1 - tx) * tz],
    [1, 1, tx * tz],
  ] as const) {
    const corner = { x: g.originX + (c0 + dc) * g.cell, z: g.originZ + (r0 + dr) * g.cell };
    if (leftOf(s, corner) !== side) continue;
    const y = h(r0 + dr, c0 + dc);
    sum += w * y;
    weight += w;
    plain += y;
    count++;
  }
  if (count === 0) return undefined;
  // On an edge whose corners are both across the line the point's own corners weigh nothing: their mean.
  return weight > 1e-9 ? sum / weight : plain / count;
};
