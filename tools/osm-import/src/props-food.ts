/**
 * The market's stock and the food booths (ADR-0058 stage 3), placed by rules over the map's data,
 * not by a list of points, so new districts get them from `pnpm osm:build` and `pnpm osm:props`:
 * - `market-goods`: cartons on a pallet, barrels, crates and goods under a canvas, beside the
 *   side of a stall of a marketplace or a flea market, within its row and inside the outline;
 * - `food-stall`: a yatai on the pavement in front of the facade of a fast-food venue (OSM
 *   `amenity=fast_food|food_court`, a venue of its building), beside its board, never in front of
 *   a venue's board (where its door is).
 * Both keep clear of the carriageway and the car streets' lanes, footpaths, zebra crossings,
 * passages, service ways, bus stops, the marketplace's entrances and the game's own doors, and
 * leave a walkway round them to every solid set before; a booth leaves 2 m of pavement between
 * the front of its stools and the edge of the carriageway as the map data has it. The old town (district `kanal`) gets neither: ADR-0058 keeps
 * the Rynek sparse. No randomness: which stalls get stock, and on which side, is a hash of their key.
 */
import type { StreetPropItem, StreetPropKind } from "../../../packages/core/src/world/city-geo.ts";
import { type CrossingBand, crossingBands, inCrossingBand } from "../../../packages/sim/src/content/lublin/crossing-bands.ts";
import { FOOD_STALL, distanceToPiece } from "../../../packages/sim/src/content/lublin/furniture.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { type Pt, type Rect, pointInRing, ringBounds } from "./geometry.ts";
import type { BoardSpan } from "./props-boards.ts";
import type { Placed } from "./props-gen.ts";
import { fnv, yawOf } from "./props-place.ts";
import type { Carriageway, DoorSpan } from "./props-roads.ts";
import type { Site } from "./props-site.ts";
import { nearTraffic } from "./props-streets.ts";

/** A stock's key: its stall's key with this after it (a stall left out takes its stock along). */
export const GOODS_KEY = "#goods";

/** Districts that get no stock and no booths: the old town (ADR-0058, „Rynek i Stare Miasto: oszczędnie”). */
export const SPARSE_DISTRICTS: ReadonlySet<string> = new Set(["kanal"]);

/** A stall's canvas (`marketStall`), as `props-market.ts` lays them out. */
const STALL = { hw: 1.2, hd: 0.9 } as const;
/** The stock's half extents in its frame (the widest of its shapes, sim `MARKET_GOODS`) and its gap from its stall's canvas (m). */
const GOODS = { hx: 0.7, hz: 0.5, gap: 0.25, z: -0.3 } as const;
/** The passage left beside the stock along its row (m), and the walkway kept from every solid (m). */
const WALKWAY = 1.5;
const SOLID_WALKWAY = 1;
/** How far the pieces keep from a car street's axis (m): its lanes and a car's half. */
const TRAFFIC_REACH = 4.5;
/**
 * How far they keep from a marketplace's entrance, a zebra's band, a passage's mouth, a service
 * way's edge, a bus stop's post and a door of the game (m).
 */
const ROOM = { entrance: 6, crossing: 3, passage: 4, service: 1.5, busStop: 10, door: 3 } as const;
/** The step of the footprints' samples (m). */
const STEP = 0.25;

/** A booth's extent in its frame: its roof and posts behind, its stools in front (sim `FOOD_STALL`). */
const BOOTH = { hx: 1.2, back: -0.8, front: FOOD_STALL.stoolZ + 0.2 } as const;
/** Booth: its centre off the wall, the pavement kept clear in front of its stools, its clearance from a board's end (m). */
const BOOTH_WALL = 1.35;
const BOOTH_WALKWAY = 2;
const BOARD_ROOM = 0.6;
/** Slides along the facade from the board's end, in steps (m), at most. */
const SLIDE = { step: 0.5, reach: 8 } as const;

/** What beyond the chunks the rules keep clear of: the map data's carriageways and the game's doors. */
export interface MarketContext {
  readonly roads?: readonly Carriageway[];
  readonly doors?: readonly DoorSpan[];
}

/** What the rules keep clear of, gathered once from the chunks and the context. */
export class Clearances {
  readonly bands: readonly CrossingBand[];
  private readonly mouths: readonly Pt[];
  private readonly service: readonly { readonly line: readonly Pt[]; readonly half: number; readonly box: Rect }[];
  private readonly stops: readonly Pt[];
  private readonly roads: readonly Carriageway[];
  private readonly doors: readonly DoorSpan[];

  constructor(chunks: readonly LublinChunkData[], ctx: MarketContext = {}) {
    this.bands = crossingBands(chunks);
    this.mouths = chunks.flatMap((c) => (c.passages ?? []).flatMap((p) => [p.from, p.to]));
    this.service = chunks.flatMap((c) => (c.serviceWays ?? []).map((w) => ({ line: flat(w.line), half: w.width / 2, box: ringBounds(flat(w.line)) })));
    this.stops = chunks.flatMap((c) => flat(c.busStops ?? []));
    this.roads = ctx.roads ?? [];
    this.doors = ctx.doors ?? [];
  }

  /** Is q clear of the zebras, the passages' mouths, the service ways, the bus stops and the game's doors? */
  clear(q: Pt): boolean {
    if (this.bands.some((b) => inCrossingBand(b, q, ROOM.crossing))) return false;
    if (this.mouths.some((m) => Math.hypot(m.x - q.x, m.z - q.z) < ROOM.passage)) return false;
    if (this.stops.some((s) => Math.hypot(s.x - q.x, s.z - q.z) < ROOM.busStop)) return false;
    if (this.doors.some((d) => distToLine(q, [d.a, d.b]) < ROOM.door)) return false;
    // A way's box first: the city has hundreds of them.
    const reach = (w: { half: number; box: Rect }) => w.half + ROOM.service;
    const nearBox = (w: { half: number; box: Rect }) => q.x > w.box.minX - reach(w) && q.x < w.box.maxX + reach(w) && q.z > w.box.minZ - reach(w) && q.z < w.box.maxZ + reach(w);
    return !this.service.some((w) => nearBox(w) && distToLine(q, w.line) < reach(w));
  }

  /** How far q is from the nearest carriageway's edge (m), negative on it; Infinity without any. */
  kerbGap(q: Pt): number {
    let best = Infinity;
    for (const r of this.roads) {
      if (!r.line.some((a) => Math.abs(a.x - q.x) < 300 && Math.abs(a.z - q.z) < 300)) continue;
      best = Math.min(best, distToLine(q, r.line) - r.half);
    }
    return best;
  }
}

const flat = (f: readonly number[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < f.length; i += 2) out.push({ x: f[i]!, z: f[i + 1]! });
  return out;
};

const distToLine = (p: Pt, line: readonly Pt[]): number => {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z));
  }
  return best;
};

/** A point of a piece's frame (x along its side, z to its front) in the world. */
const local = (p: Pt, yaw: number, x: number, z: number): Pt => {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: p.x + x * c + z * s, z: p.z - x * s + z * c };
};

/** Points of a rectangle of a piece's frame, every `STEP` metres. */
const rect = (p: Pt, yaw: number, x0: number, x1: number, z0: number, z1: number): Pt[] => {
  const out: Pt[] = [];
  for (let x = x0; x <= x1 + 1e-9; x += STEP) for (let z = z0; z <= z1 + 1e-9; z += STEP) out.push(local(p, yaw, x, z));
  return out;
};

/** Open paved ground of the map: in a chunk, a pavement or square, not a footpath. */
const paved = (site: Site, q: Pt): boolean => site.chunkAt(q) !== null && site.surfaceAt(q) === "walk" && !site.onPath(q);

/** Open ground in front of a facade: paving, or the bare ground the map leaves between a wall and its pavement; not a footpath. */
const forecourt = (site: Site, q: Pt): boolean => site.chunkAt(q) !== null && (site.surfaceAt(q) === "walk" || site.surfaceAt(q) === null) && !site.onPath(q);

/** Ground a walker passes over: paving or bare ground in a chunk, not a road, a building, grass or water. */
const open = (site: Site, q: Pt): boolean => site.chunkAt(q) !== null && (site.surfaceAt(q) === "walk" || site.surfaceAt(q) === null);

/** The solids placed so far as items, for the walkway. */
const asItems = (placed: readonly Placed[]): StreetPropItem[] => placed.map((x) => ({ prop: x.prop, x: x.p.x, y: 0, z: x.p.z, yaw: x.yaw ?? 0, variant: 0 }));

/** Is q under a stall's canvas, grown by `pad`? */
const underCanvas = (s: Placed, q: Pt, pad: number): boolean => {
  const yaw = s.yaw ?? 0;
  const dx = q.x - s.p.x;
  const dz = q.z - s.p.z;
  const c = Math.cos(yaw);
  const n = Math.sin(yaw);
  // The inverse of `local`: along the counter and to the front.
  const x = dx * c - dz * n;
  const z = dx * n + dz * c;
  return Math.abs(x) <= STALL.hw + pad && Math.abs(z) <= STALL.hd + pad;
};

/** A piece placed before, with its item for its solid. */
interface Near {
  readonly placed: Placed;
  readonly item: StreetPropItem;
}

const CELL = 16;

/** The pieces placed so far in a grid of `CELL` m cells: the walkway asks only the cells round a footprint. */
class Nearby {
  private readonly cells = new Map<string, Near[]>();

  constructor(placed: readonly Placed[]) {
    for (const x of placed) this.add(x);
  }

  add(placed: Placed, item: StreetPropItem = asItems([placed])[0]!): void {
    const k = `${Math.floor(placed.p.x / CELL)}:${Math.floor(placed.p.z / CELL)}`;
    const list = this.cells.get(k);
    if (list) list.push({ placed, item });
    else this.cells.set(k, [{ placed, item }]);
  }

  /** The pieces within about `CELL` m of p. */
  around(p: Pt): Near[] {
    const out: Near[] = [];
    const i = Math.floor(p.x / CELL);
    const j = Math.floor(p.z / CELL);
    for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) out.push(...(this.cells.get(`${a}:${b}`) ?? []));
    return out;
  }
}

/**
 * Is the footprint `foot` clear of every stall's canvas by `canvasPad` and of every solid placed
 * before by `solidPad`, `host` aside?
 */
const walkwayClear = (foot: readonly Pt[], near: Nearby, host: Placed | null, canvasPad: number, solidPad: number): boolean => {
  const c = foot[Math.floor(foot.length / 2)]!;
  for (const { placed: o, item } of near.around(c)) {
    if (o === host || Math.abs(o.p.x - c.x) > 12 || Math.abs(o.p.z - c.z) > 12) continue;
    if (o.prop === "market-stall" ? foot.some((q) => underCanvas(o, q, canvasPad)) : foot.some((q) => distanceToPiece(item, q.x, q.z) < solidPad)) return false;
  }
  return true;
};

/**
 * The site with only the streets near `box` (grown by `reach`), for `nearTraffic` over many samples
 * of one place: the city's streets are a thousand polylines.
 */
const streetsNear = (site: Site, box: Rect, reach: number): Site => {
  const near = (q: Pt) => q.x > box.minX - reach && q.x < box.maxX + reach && q.z > box.minZ - reach && q.z < box.maxZ + reach;
  const crosses = (line: readonly Pt[]) => {
    const b = ringBounds(line);
    return b.maxX > box.minX - reach && b.minX < box.maxX + reach && b.maxZ > box.minZ - reach && b.minZ < box.maxZ + reach;
  };
  // `nearTraffic` reads only the streets.
  return { streets: site.streets.filter((st) => st.line.some(near) || crosses(st.line)) } as unknown as Site;
};

/** The district of the chunk at p, or null outside them. */
const districtAt = (site: Site, p: Pt): string | null => site.chunkAt(p)?.district ?? null;

/**
 * Stock beside the stalls of one market (`stalls`, the outline `ring` and its entrances `gates`):
 * one stall in two by its key, on the side its key picks first, inside the outline.
 */
export const stallGoods = (site: Site, clear: Clearances, stalls: readonly Placed[], ring: readonly Pt[] | null, gates: readonly Pt[], placed: readonly Placed[]): Placed[] => {
  const out: Placed[] = [];
  const near = new Nearby([...placed, ...stalls]);
  const traffic = streetsNear(site, ringBounds(ring ?? stalls.map((s) => s.p)), TRAFFIC_REACH + 10);
  for (const s of stalls) {
    // The high bits: FNV's lowest follow the parity of the key's letters, as the stock's shape (`variant`) does.
    const h = fnv(`${s.key}#stock`);
    if (((h >>> 16) & 1) !== 0) continue;
    const d = districtAt(site, s.p);
    if (d === null || SPARSE_DISTRICTS.has(d)) continue;
    const yaw = s.yaw ?? 0;
    for (const side of (h >>> 17) & 1 ? [1, -1] : [-1, 1]) {
      const at = local(s.p, yaw, side * (STALL.hw + GOODS.gap + GOODS.hx), GOODS.z);
      const foot = rect(at, yaw, -GOODS.hx, GOODS.hx, -GOODS.hz, GOODS.hz);
      const fits = foot.every((q) => paved(site, q) && (!ring || pointInRing(q, ring)) && !nearTraffic(traffic, q, TRAFFIC_REACH) && clear.clear(q));
      if (!fits || gates.some((g) => Math.hypot(g.x - at.x, g.z - at.z) < ROOM.entrance)) continue;
      // The passage past it along the row stays a walkway: open paving, no canvas over it.
      const passage = rect(at, yaw, side > 0 ? GOODS.hx : -GOODS.hx - WALKWAY, side > 0 ? GOODS.hx + WALKWAY : -GOODS.hx, -GOODS.hz, GOODS.hz);
      if (!passage.every((q) => paved(site, q))) continue;
      if (!walkwayClear(foot, near, s, 0.1, SOLID_WALKWAY) || !walkwayClear(passage, near, null, 0, SOLID_WALKWAY)) continue;
      const stock: Placed = { prop: "market-goods" satisfies StreetPropKind, p: at, yaw, key: `${s.key}${GOODS_KEY}` };
      out.push(stock);
      near.add(stock);
      break;
    }
  }
  return out;
};

/** The fast-food venues' boards: those whose text is the name of a fast-food venue of their building's chunk. */
const foodBoards = (chunks: readonly LublinChunkData[], boards: readonly BoardSpan[]): BoardSpan[] => {
  const names = new Set(chunks.flatMap((c) => c.buildings.flatMap((b) => (b.venues ?? []).filter((v) => v.kind === "fast-food").map((v) => v.name))));
  // One booth per venue: its first board (a corner venue has one on each street).
  const seen = new Set<string>();
  return boards.filter((b) => {
    if (!names.has(b.text) || seen.has(b.text)) return false;
    seen.add(b.text);
    return true;
  });
};

/** Where p lies along a board's wall line (0 at its `a` end). */
const alongWall = (s: BoardSpan, p: Pt): number => {
  const len = Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z) || 1;
  return ((p.x - s.a.x) * (s.b.x - s.a.x) + (p.z - s.a.z) * (s.b.z - s.a.z)) / len;
};

/** Does a booth spanning [u0, u1] along `wall`'s line clear every board on that wall by `BOARD_ROOM`? */
const offBoards = (wall: BoardSpan, boards: readonly BoardSpan[], u0: number, u1: number): boolean =>
  boards.every((o) => {
    const sameWall = Math.abs(o.nx * wall.nx + o.nz * wall.nz) > 0.95 && Math.abs((o.a.x - wall.a.x) * wall.nx + (o.a.z - wall.a.z) * wall.nz) < 0.5;
    if (!sameWall) return true;
    const a = alongWall(wall, o.a);
    const b = alongWall(wall, o.b);
    return u1 < Math.min(a, b) - BOARD_ROOM || u0 > Math.max(a, b) + BOARD_ROOM;
  });

/** A booth for one board, or null: slid along its wall from either end of the board, nearest first. */
const boothAt = (site: Site, clear: Clearances, board: BoardSpan, boards: readonly BoardSpan[], near: Nearby): Placed | null => {
  const len = Math.hypot(board.b.x - board.a.x, board.b.z - board.a.z) || 1;
  const dir = { x: (board.b.x - board.a.x) / len, z: (board.b.z - board.a.z) / len };
  // The booth's front away from the wall: its back to the facade, the stools towards the street.
  const yaw = yawOf(board.nx, board.nz);
  const shifts: number[] = [];
  for (let t = BOARD_ROOM + BOOTH.hx; t <= SLIDE.reach; t += SLIDE.step) shifts.push(-t, len + t);
  const traffic = streetsNear(site, ringBounds([board.a, board.b]), SLIDE.reach + TRAFFIC_REACH + 5);
  for (const u of shifts) {
    if (!offBoards(board, boards, u - BOOTH.hx, u + BOOTH.hx)) continue;
    // A facade behind its whole length: this building's wall or the next one's in the row.
    const behind = [-BOOTH.hx, 0, BOOTH.hx].map((x) => ({ x: board.a.x + dir.x * (u + x) - board.nx * 0.3, z: board.a.z + dir.z * (u + x) - board.nz * 0.3 }));
    if (!behind.every((q) => site.surfaceAt(q) === "building")) continue;
    const p = { x: board.a.x + dir.x * u + board.nx * BOOTH_WALL, z: board.a.z + dir.z * u + board.nz * BOOTH_WALL };
    const d = districtAt(site, p);
    if (d === null || SPARSE_DISTRICTS.has(d)) return null;
    const foot = rect(p, yaw, -BOOTH.hx, BOOTH.hx, BOOTH.back, BOOTH.front);
    const ahead = rect(p, yaw, -BOOTH.hx, BOOTH.hx, BOOTH.front, BOOTH.front + BOOTH_WALKWAY);
    if (!foot.every((q) => forecourt(site, q) && clear.clear(q) && !nearTraffic(traffic, q, TRAFFIC_REACH))) continue;
    // The pavement in front of its stools stays open for the walkers, up to the kerb: drawn
    // ground, and 2 m to the carriageway's edge as the map data has it.
    if (!ahead.every((q) => open(site, q))) continue;
    if (!rect(p, yaw, -BOOTH.hx, BOOTH.hx, BOOTH.front, BOOTH.front).every((q) => clear.kerbGap(q) >= BOOTH_WALKWAY)) continue;
    if (!walkwayClear(foot, near, null, SOLID_WALKWAY, SOLID_WALKWAY) || !walkwayClear(ahead, near, null, 0.2, 0.2)) continue;
    return { prop: "food-stall", p, yaw, key: `food-stall:${board.text}` };
  }
  return null;
};

/** A booth in front of every fast-food venue's facade that has room for one, in the boards' order. */
export const foodStalls = (site: Site, clear: Clearances, boards: readonly BoardSpan[], placed: readonly Placed[]): Placed[] => {
  const out: Placed[] = [];
  const near = new Nearby(placed);
  for (const board of foodBoards(site.chunks, boards)) {
    const booth = boothAt(site, clear, board, boards, near);
    if (!booth) continue;
    out.push(booth);
    near.add(booth);
  }
  return out;
};
