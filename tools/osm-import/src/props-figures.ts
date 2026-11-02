/**
 * The still crowd of Lublin 2077 (ADR-0058 stage 8), placed by rules on the furniture already in the
 * table (no list of points, so new districts get it from `pnpm osm:props`):
 * - on the seats of the benches, the bus shelters' benches and the café gardens' stools
 *   (`FIGURE_SEATS`), sitting or perched (shins under a seat low over the paving), whichever keeps the
 *   feet on what is drawn under them (`FEET`): a bench sunk in a sidewalk's paving leaves 0.29 m;
 * - standing in the queue of a food booth, a food cart and a market stall, waiting at a bus stop or
 *   under a shelter, and smoking beside a door of a shop, an office or a tenement (not a garage's or a
 *   bank's), from the spots of `STANDS` in the piece's frame.
 * A share of each kind of furniture gets people (`SHARE`, a hash of the piece's point: no randomness).
 * A figure stands only where its footprint (`figureFootprint`) is on open ground (no building, road,
 * water, rails or steps, no passage), clear of every solid of the furniture but its own seat, of the
 * other figures, of the simulation's crowd (its spots and lanes, so the moving people never walk
 * through or sit on a still one) and of the game's doors, and in a block of the renderer's furniture
 * the furniture already fills (no mesh more). A sitter's piece is put on its seat's host (`y` its
 * foot, the seat over it in the variant); a standing one's on the paving at its feet.
 */
import type { StreetPropItem, StreetPropKind } from "../../../packages/core/src/world/city-geo.ts";
import { FIGURE_SEATS, FIGURE_SEAT, FIGURE_SEAT_SHAPES, type FigureBody, type FigureLayout, type FigurePose, figureFootprint, figureVariant } from "../../../packages/core/src/world/figures.ts";
import { doorLayout } from "../../../packages/core/src/world/doors.ts";
import { distanceToPiece, furnitureRadius, turnLocal } from "../../../packages/sim/src/content/lublin/furniture.ts";
import type { Pt } from "./geometry.ts";
import { fnv } from "./props-place.ts";
import type { DoorSpan } from "./props-roads.ts";
import type { Site } from "./props-site.ts";

/** The moving crowd of the simulation the still one keeps clear of: its spots and the lines its walkers walk. */
export interface CrowdClear {
  readonly spots: readonly Pt[];
  readonly lanes: readonly (readonly Pt[])[];
}

export interface FigureContext {
  /** The ground the game puts the furniture on (a host's `y`), and the paving drawn at a point. */
  readonly groundY: (p: Pt) => number;
  readonly surfaceY: (p: Pt) => number;
  readonly crowd?: CrowdClear;
  readonly gameDoors?: readonly DoorSpan[];
  /** The renderer's furniture block of a point (`PROP_BLOCK`). */
  readonly blockOf?: (p: Pt) => string;
  /** The shares in place of `SHARE` (the tests' small maps). */
  readonly share?: Readonly<Partial<Record<StreetPropKind, { readonly share: number; readonly most: number }>>>;
}

/** Share of the pieces of each kind that get people, and how many at most. */
export const SHARE: Readonly<Partial<Record<StreetPropKind, { readonly share: number; readonly most: number }>>> = {
  bench: { share: 0.45, most: 2 },
  "bus-shelter": { share: 0.6, most: 2 },
  "cafe-garden": { share: 0.5, most: 3 },
  "food-stall": { share: 1, most: 2 },
  "food-cart": { share: 1, most: 2 },
  "market-stall": { share: 0.3, most: 1 },
  "bus-stop": { share: 0.7, most: 2 },
  door: { share: 0.15, most: 1 },
};

/** How far a sitter's feet may hang over, or sink into, what is drawn under them (m). */
export const FEET = { over: 0.08, under: 0.03 } as const;
/** How far a figure keeps from the simulation's crowd spots, past its own circle, and a walker's line, past its body (m). */
export const CROWD_ROOM = 0.6;
export const WALKER = 0.6;
/** And from the game's doors, and between its circles and another figure's (m). */
export const GAME_DOOR_ROOM = 2;
export const FIGURE_GAP = 0.05;

/** A standing spot in a piece's frame: point, facing turned from the piece's front, pose. */
interface Stand {
  readonly x: number;
  readonly z: number;
  readonly turn: number;
  readonly pose: FigurePose;
}

const st = (x: number, z: number, turn: number, pose: FigurePose): Stand => ({ x, z, turn, pose });

/**
 * Where people stand, in the frame of the piece: the queue behind a booth's stools (sim `FOOD_STALL`:
 * stools at z 0.85) and before a cart's and a stall's counter, facing it; beside a stop's post and
 * under a shelter's roof, facing the street; beside a door, out of its way, turned a little to the
 * street. A door's spots are set by its width (`doorStands`).
 */
const STANDS: Readonly<Partial<Record<StreetPropKind, readonly Stand[]>>> = {
  "food-stall": [st(-0.33, 1.32, Math.PI, "hips"), st(0.35, 1.36, Math.PI, "stand")],
  "food-cart": [st(-0.4, 1.25, Math.PI, "stand"), st(0.45, 1.3, Math.PI, "hips")],
  "market-stall": [st(-0.45, 1.2, Math.PI, "stand"), st(0.5, 1.22, Math.PI, "hips")],
  "bus-stop": [st(0.75, 0.25, 0.35, "stand"), st(-0.7, 0.3, -0.3, "hips")],
  "bus-shelter": [st(1.15, 0.15, -0.3, "stand")],
};

/** Doors people smoke by: not a garage's shutter, not a bank's door on a code. */
const SMOKERS_AT = new Set(["steel", "steel-double", "shop", "tall"]);

const doorStands = (door: StreetPropItem): Stand[] => {
  const half = doorLayout(door.variant).width / 2;
  return [st(half + 0.6, 0.45, 0.6, "smoke"), st(-half - 0.6, 0.45, -0.6, "smoke")];
};

const r2 = (v: number): number => Math.round(v * 100) / 100 + 0;

const segGap = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
};
const lineGap = (p: Pt, line: readonly Pt[]): number => {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) best = Math.min(best, segGap(p, line[i]!, line[i + 1]!));
  return best;
};

/** A figure's circles in the world. */
export const worldCircles = (item: StreetPropItem, f: FigureLayout): { x: number; z: number; r: number }[] =>
  figureFootprint(f).map((c) => {
    const q = turnLocal(item.yaw, c.x, c.z);
    return { x: item.x + q.x, z: item.z + q.z, r: c.r };
  });

/** A point of a piece's frame in the world. */
const at = (host: StreetPropItem, x: number, z: number): Pt => {
  const q = turnLocal(host.yaw, x, z);
  return { x: host.x + q.x, z: host.z + q.z };
};

/** The build and the pose of a sitter whose feet fit what is drawn under them, the man's or the woman's by the hash first; or null. */
const sitterFits = (gap: (pose: "sit" | "perch", body: FigureBody) => number, first: FigureBody): { pose: "sit" | "perch"; body: FigureBody } | null => {
  for (const body of first === "a" ? (["a", "b"] as const) : (["b", "a"] as const)) {
    for (const pose of ["sit", "perch"] as const) {
      const g = gap(pose, body);
      if (g <= FEET.over && g >= -FEET.under) return { pose, body };
    }
  }
  return null;
};

/** What the still crowd keeps clear of, gathered once. */
class Clear {
  private readonly site: Site;
  private readonly ctx: FigureContext;
  private readonly solids: StreetPropItem[];
  readonly figures: { item: StreetPropItem; circles: { x: number; z: number; r: number }[] }[] = [];

  constructor(site: Site, pieces: readonly StreetPropItem[], ctx: FigureContext) {
    this.site = site;
    this.ctx = ctx;
    this.solids = pieces.filter((p) => furnitureRadius(p) > 0);
  }

  /** Why the circles cannot take a figure, or null. */
  why(circles: readonly { x: number; z: number; r: number }[], host: StreetPropItem, sitting: boolean): string | null {
    for (const c of circles) {
      for (let k = 0; k <= 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const q = k === 6 ? c : { x: c.x + Math.cos(a) * c.r, z: c.z + Math.sin(a) * c.r };
        const s = this.site.surfaceAt(q);
        // No surface drawn there is the bare terrain, open ground within the chunks.
        if (s === "building" || s === "road" || s === "water" || s === "rail" || (s === null && !this.site.chunkAt(q))) return `ground ${s ?? "outside"}`;
        if (this.site.onSteps(q)) return "steps";
      }
      if (this.site.nearPassage(c, c.r + 0.3)) return "passage";
      const near = this.solids.filter((o) => Math.abs(o.x - c.x) < 6 && Math.abs(o.z - c.z) < 6);
      if (near.some((o) => !(sitting && o === host) && distanceToPiece(o, c.x, c.z) < c.r - FIGURE_GAP)) return "furniture";
      if (this.figures.some((f) => f.circles.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < o.r + c.r - FIGURE_GAP))) return "figure";
      const crowd = this.ctx.crowd;
      if (crowd?.spots.some((p) => Math.hypot(p.x - c.x, p.z - c.z) < c.r + CROWD_ROOM)) return "crowd spot";
      if (crowd?.lanes.some((l) => lineGap(c, l) < c.r + WALKER)) return "crowd lane";
      if (this.ctx.gameDoors?.some((d) => segGap(c, d.a, d.b) < GAME_DOOR_ROOM)) return "game door";
    }
    return null;
  }
}

export interface FiguresOut {
  readonly per: Record<string, number>;
  readonly rejected: Record<string, number>;
}

/** Adds the still crowd to the furniture per chunk, after every other piece (it keeps clear of them all). */
export const addFigures = (byChunk: Map<string, StreetPropItem[]>, site: Site, ctx: FigureContext): FiguresOut => {
  const per: Record<string, number> = {};
  const rejected: Record<string, number> = {};
  const all = [...byChunk.values()].flat();
  const blocks = new Set(ctx.blockOf ? all.map(ctx.blockOf) : []);
  const clear = new Clear(site, all, ctx);
  const turn = (why: string) => (rejected[why] = (rejected[why] ?? 0) + 1);
  for (const [chunk, items] of byChunk) {
    const added: StreetPropItem[] = [];
    // The hosts in an order of their own (kind, then point), not the table's: the committed table gives the same figures.
    const shares = ctx.share ?? SHARE;
    const hosts = items.filter((h) => shares[h.prop]).sort((a, b) => (a.prop < b.prop ? -1 : a.prop > b.prop ? 1 : a.x - b.x || a.z - b.z));
    for (const host of hosts) {
      const rule = shares[host.prop];
      if (!rule) continue;
      if (host.prop === "door" && !SMOKERS_AT.has(doorLayout(host.variant).model)) continue;
      const key = `${host.prop}:${host.x.toFixed(1)}:${host.z.toFixed(1)}`;
      const h = fnv(key);
      if ((h % 1000) / 1000 >= rule.share) continue;
      let placed = 0;
      const want = 1 + ((h >>> 10) % rule.most);
      const seats = FIGURE_SEATS[host.prop]?.(host.variant % (FIGURE_SEAT_SHAPES[host.prop] ?? 1)) ?? [];
      const stands = host.prop === "door" ? doorStands(host) : (STANDS[host.prop] ?? []);
      const spots = [...seats.map((s) => ({ seat: s, stand: null })), ...stands.map((s) => ({ seat: null, stand: s }))];
      for (let k = 0; k < spots.length && placed < want; k++) {
        const spot = spots[(k + (h >>> 16)) % spots.length]!;
        const n = fnv(`${key}:${k}`);
        const first: FigureBody = n % 2 === 0 ? "a" : "b";
        const look = (n >>> 8) % 32;
        let item: StreetPropItem;
        let layout: FigureLayout;
        if (spot.seat) {
          const s = spot.seat;
          const p = at(host, s.x, s.z);
          const yaw = host.yaw + s.turn;
          const hostY = r2(ctx.groundY(host));
          // The feet's drop under the seat, against the paving or the deck under them.
          const gap = (pose: "sit" | "perch", body: FigureBody): number => {
            const foot = figureFootprint({ pose, body, seat: 0, look })[1]!;
            const q = turnLocal(yaw, foot.x, foot.z);
            const floor = Math.max(hostY + s.floor, ctx.surfaceY({ x: p.x + q.x, z: p.z + q.z }));
            return hostY + s.top - FIGURE_SEAT[pose][body] - floor;
          };
          const fit = sitterFits(gap, first);
          if (!fit) {
            turn("seat drop");
            continue;
          }
          layout = { pose: fit.pose, body: fit.body, seat: s.top, look };
          item = { prop: "figure", x: r2(p.x), y: hostY, z: r2(p.z), yaw: r2(yaw), variant: figureVariant(layout) };
        } else {
          const s = spot.stand!;
          const p = at(host, s.x, s.z);
          layout = { pose: s.pose === "stand" && n % 3 === 0 ? "hips" : s.pose, body: first, seat: 0, look };
          item = { prop: "figure", x: r2(p.x), y: r2(ctx.surfaceY(p)), z: r2(p.z), yaw: r2(host.yaw + s.turn), variant: figureVariant(layout) };
        }
        const circles = worldCircles(item, layout);
        const why = ctx.blockOf && !blocks.has(ctx.blockOf(item)) ? "block" : clear.why(circles, host, spot.seat !== null);
        if (why) {
          turn(why);
          continue;
        }
        clear.figures.push({ item, circles });
        added.push(item);
        placed++;
        per[host.prop] = (per[host.prop] ?? 0) + 1;
      }
    }
    items.push(...added);
    byChunk.set(chunk, items);
  }
  return { per, rejected };
};
