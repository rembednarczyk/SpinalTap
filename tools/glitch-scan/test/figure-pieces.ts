import { FIGURE_SEAT, FIGURE_SOLES, type FigureLayout, type StreetPropItem, figureFootprint, figureLayout, isSitting, seatAt } from "../../../packages/core/src";
import { distanceToPiece, furnitureRadius, turnLocal } from "../../../packages/sim/src/content/lublin/furniture";

/**
 * The still crowd of ADR-0058 stage 8 checked against what the game draws and runs, not against the
 * generator's rules (`props-figures.ts`): the buildings and the carriageways of the game's map, the
 * paving it draws, the furniture the game kept with its seats, and the simulation's moving crowd (its
 * residents' spots and its walkers' lanes). A figure is drawn only, so where it stands in a wall, on a
 * road, in a piece of furniture or in a walker's way, or sits beside its seat, the player sees it.
 */

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };

/** The game the figures are checked against. */
export interface FigureWorld {
  readonly inBuilding: (x: number, z: number) => boolean;
  /** A carriageway (or a crossing on it) drawn at (x, z). */
  readonly onRoad: (x: number, z: number) => boolean;
  /** The paving drawn at (x, z). */
  readonly surfaceY: (x: number, z: number) => number;
  readonly crowdSpots: readonly Pt[];
  /** The crowd's lanes as closed lines (walkers keep 0.28 m to a side, a body 0.3 m round). */
  readonly crowdLanes: readonly (readonly Pt[])[];
}

/** How much two bodies, or a body and a solid, may touch (m). */
const TOUCH = 0.05;
/** A resident's body round its spot, and a walker's reach off its lane (m). */
const RESIDENT = 0.3;
const WALKER = 0.58;
/** How far a sitter's feet may hang over, and sink into, what is drawn under them (m). */
const FEET_OVER = 0.1;
const FEET_UNDER = 0.04;
/** How far a standing figure's soles may stand off the paving (m). */
const OFF_FOOT = 0.05;
/** A sitter's hips off its seat's middle (m), its height off the seat's top, its facing off the seat's. */
const OFF_SEAT = 0.05;
const OFF_TOP = 0.01;
const OFF_TURN = 0.05;

const near = (p: Pt): string => `${p.x.toFixed(0)},${p.z.toFixed(0)}`;

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

/** A figure's circles in the world, and the points round each (its middle and sixteen on its rim). */
const circlesOf = (i: StreetPropItem, f: FigureLayout) =>
  figureFootprint(f).map((c) => {
    const q = turnLocal(i.yaw, c.x, c.z);
    return { x: i.x + q.x, z: i.z + q.z, r: c.r };
  });
const rim = (c: { x: number; z: number; r: number }): Pt[] => [c, ...Array.from({ length: 16 }, (_, k) => ({ x: c.x + Math.cos((k / 16) * Math.PI * 2) * c.r, z: c.z + Math.sin((k / 16) * Math.PI * 2) * c.r }))];

const angle = (a: number): number => Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));

/** The piece whose seat a sitter is on, with the seat: hips on its middle, at its top, facing as it does; or null. */
const seatOf = (i: StreetPropItem, f: FigureLayout, pieces: readonly StreetPropItem[]) => {
  for (const h of pieces) {
    if (Math.abs(h.x - i.x) > 3 || Math.abs(h.z - i.z) > 3) continue;
    const s = seatAt(h, i.x, i.z, OFF_SEAT);
    if (s && Math.abs(h.y - i.y) <= OFF_TOP && Math.abs(s.top - f.seat) <= OFF_TOP && angle(i.yaw - h.yaw - s.turn) <= OFF_TURN) return { host: h, seat: s };
  }
  return null;
};

/** The checks over every piece of the city `all` (the figures among them) and the game `world`. */
export const figureChecks = (all: readonly StreetPropItem[], world: FigureWorld): Record<string, () => Finding[]> => {
  const figures = all.filter((i) => i.prop === "figure").map((i) => ({ item: i, f: figureLayout(i.variant) }));
  const solids = all.filter((i) => furnitureRadius(i) > 0);
  const circles = new Map(figures.map((x) => [x.item, circlesOf(x.item, x.f)]));
  const each = (test: (i: StreetPropItem, f: FigureLayout) => string | null): Finding[] =>
    figures.flatMap(({ item, f }) => {
      const what = test(item, f);
      return what ? [{ at: near(item), what: `${f.pose} figure ${what}` }] : [];
    });
  return {
    /** A figure's footprint in a building of the game's map. */
    "figure-in-building": () => each((i) => (circles.get(i)!.some((c) => rim(c).some((q) => world.inBuilding(q.x, q.z))) ? "in a building" : null)),
    /** A figure's footprint on a carriageway or a crossing the game draws. */
    "figure-on-road": () => each((i) => (circles.get(i)!.some((c) => rim(c).some((q) => world.onRoad(q.x, q.z))) ? "on the road" : null)),
    /**
     * A figure in a piece of furniture's solid (a sitter's own seat aside) or in another figure: its
     * circles reach more than `TOUCH` into it.
     */
    "figure-in-piece": () =>
      each((i, f) => {
        const own = isSitting(f.pose) ? seatOf(i, f, all)?.host : undefined;
        const mine = circles.get(i)!;
        const solid = solids.find((o) => o !== own && Math.abs(o.x - i.x) < 6 && Math.abs(o.z - i.z) < 6 && mine.some((c) => distanceToPiece(o, c.x, c.z) < c.r - TOUCH));
        if (solid) return `in ${solid.prop} at ${near(solid)}`;
        const other = figures.find((o) => o.item !== i && Math.abs(o.item.x - i.x) < 2 && Math.abs(o.item.z - i.z) < 2 && circles.get(o.item)!.some((a) => mine.some((c) => Math.hypot(a.x - c.x, a.z - c.z) < a.r + c.r - TOUCH)));
        return other ? `in a figure at ${near(other.item)}` : null;
      }),
    /**
     * A sitter on no seat of the furniture the game kept (its hips off every seat's middle, off its
     * top or turned from its facing, or its piece gone), or with its feet hanging more than
     * `FEET_OVER` over or sunk `FEET_UNDER` into the paving or deck drawn under them.
     */
    "figure-off-seat": () =>
      each((i, f) => {
        if (f.pose !== "sit" && f.pose !== "perch") return null;
        const on = seatOf(i, f, all);
        if (!on) return "on no seat";
        const feet = circles.get(i)![1]!;
        const floor = Math.max(on.host.y + on.seat.floor, world.surfaceY(feet.x, feet.z));
        const drop = i.y + f.seat - FIGURE_SEAT[f.pose][f.body] - floor;
        return drop > FEET_OVER || drop < -FEET_UNDER ? `feet ${drop.toFixed(2)} m off the ground` : null;
      }),
    /** A standing figure with a sole (a heel or a toe) more than `OFF_FOOT` off the paving drawn under it. */
    "figure-floating": () =>
      each((i, f) => {
        if (isSitting(f.pose)) return null;
        // Every heel and toe (`FIGURE_SOLES`, turned by its yaw) on the paving under it: none over a lower one, none sunk in a higher.
        const off = FIGURE_SOLES.map((s) => {
          const q = turnLocal(i.yaw, s.x, s.z);
          return i.y - world.surfaceY(i.x + q.x, i.z + q.z);
        });
        const worst = off.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
        return Math.abs(worst) > OFF_FOOT ? `a sole ${worst.toFixed(2)} m off the paving` : null;
      }),
    /** A figure where the simulation's moving crowd stands or walks: a resident's spot, a walker's lane. */
    "figure-in-crowd": () =>
      each((i) => {
        const mine = circles.get(i)!;
        if (mine.some((c) => world.crowdSpots.some((p) => Math.hypot(p.x - c.x, p.z - c.z) < c.r + RESIDENT))) return "on a resident's spot";
        return mine.some((c) => world.crowdLanes.some((l) => lineGap(c, l) < c.r + WALKER)) ? "on a walkers' lane" : null;
      }),
  };
};
