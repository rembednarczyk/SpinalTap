import { ALCHEMIA_LIFT, ALCHEMIA_LIFT_NE, type FoodhallLift } from "./lift";
import { escalatorFlight, escalatorLandings } from "./escalators";
import { coreFootLanding, coreShell, coreStoreys } from "./mall-cores";
import {
  ATRIUM,
  ESCALATORS,
  ESCALATOR_LANDINGS,
  CORE_WALL,
  LANE_A,
  NE_CORE,
  FRONT_OVERHANG,
  MALL,
  MALL_CORNERS,
  MALL_GLASS_RADIUS,
  MALL_GLASS_THICK,
  MALL_LEVELS,
  MALL_OVER,
  MALL_RADIUS,
  MALL_RAIL,
  MALL_SLAB,
  STAIR_CORES,
  escalatorHead,
  stairwell,
} from "./mall-plan";
import { HALL, type Piece, box, outlined, solidProp, tiledSolidProps } from "./plan";
import type { StaticProp } from "../builders";
import type { GroundCut } from "../../world/ground";
import { type Corners, type Rectangle, balustrade, roundedOutline } from "./rounded";

/*
 * The gallery's body (ADR-0093 O1): the slabs of P2, P3 and the roof as rings round the atrium (and
 * round the cores' stairwells and the lifts' shafts), each a few convex pieces, its outer north
 * corners rounded as the front's storeys' (C1); glass round P1..P3 as thin solids the engine draws
 * as frames only, open at the doors; solid balustrades round the atrium on every floor and round the
 * roof. P1's floor is the food hall's old roof (`foodhall.ts`). The front's L2 and L3 stand against
 * the south face: there their glass is the body's wall and their slabs reach over its edge.
 */

const L = MALL_LEVELS;

/** The parts of `outer` outside every rectangle of `holes`: strips along x between the holes' edges, merged along x. */
export const rectsMinus = (outer: Rectangle, holes: readonly Rectangle[]): Rectangle[] => {
  const xs = [...new Set([outer.x0, outer.x1, ...holes.flatMap((h) => [h.x0, h.x1])])].filter((x) => x >= outer.x0 && x <= outer.x1).sort((a, b) => a - b);
  const strips: Rectangle[][] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const [x0, x1] = [xs[i]!, xs[i + 1]!];
    const cover = holes.filter((h) => h.x0 <= x0 + 1e-9 && h.x1 >= x1 - 1e-9).map((h) => [Math.max(h.z0, outer.z0), Math.min(h.z1, outer.z1)] as const).sort((a, b) => a[0] - b[0]);
    const out: Rectangle[] = [];
    let z = outer.z0;
    for (const [z0, z1] of cover) {
      if (z0 > z + 1e-9) out.push({ x0, x1, z0: z, z1: z0 });
      z = Math.max(z, z1);
    }
    if (outer.z1 > z + 1e-9) out.push({ x0, x1, z0: z, z1: outer.z1 });
    strips.push(out);
  }
  // Merge a strip's piece into the one west of it when their z spans are the same.
  const merged: Rectangle[] = [];
  for (const strip of strips) {
    for (const r of strip) {
      const w = merged.findIndex((m) => Math.abs(m.x1 - r.x0) < 1e-9 && Math.abs(m.z0 - r.z0) < 1e-9 && Math.abs(m.z1 - r.z1) < 1e-9);
      if (w >= 0) merged[w] = { ...merged[w]!, x1: r.x1 };
      else merged.push(r);
    }
  }
  return merged;
};

/** A rectangle cut at the lines z = `zs` and x = `xs` crossing it. */
const splitAt = (r: Rectangle, zs: readonly number[], xs: readonly number[]): Rectangle[] => {
  const cuts = (lo: number, hi: number, at: readonly number[]) => [lo, ...at.filter((v) => v > lo + 1e-6 && v < hi - 1e-6).sort((a, b) => a - b), hi];
  const [cx, cz] = [cuts(r.x0, r.x1, xs), cuts(r.z0, r.z1, zs)];
  return cx.slice(1).flatMap((x1, i) => cz.slice(1).map((z1, k) => ({ x0: cx[i]!, x1, z0: cz[k]!, z1 })));
};

/** A lift's shaft in plan: its walls' outer faces. */
const shaft = (l: FoodhallLift): Rectangle => {
  const r = l.half + l.wall;
  return { x0: l.centre.x - r, x1: l.centre.x + r, z0: l.centre.z - r, z1: l.centre.z + r };
};

/** The holes in every slab over P1: the atrium, the stairwells, the lifts' shafts. */
export const MALL_HOLES: readonly Rectangle[] = [ATRIUM, ...STAIR_CORES.map(stairwell), shaft(ALCHEMIA_LIFT), shaft(ALCHEMIA_LIFT_NE)];

/** The slab's outline: the glass line grown by the overhang on the west, north and east; on the south from the glass line, or past the front's slab where it reaches over. */
const slabRect = (z0: number): Rectangle => ({ x0: MALL.x0 - MALL_OVER, x1: MALL.x1 + MALL_OVER, z0, z1: MALL.z1 + MALL_OVER });

/** The rounded corners' squares, kept out of the strips so each is one piece of its own. */
const CORNER = 2.6;

/**
 * A slab from `y - SLAB` to `y`: its outline less `holes` (and less what of the front's slabs reaches
 * over its south edge, `front`), the north corners a piece each, rounded.
 */
const slab = (y: number, z0: number, front: readonly Rectangle[] = []): Piece[] => {
  const o = slabRect(z0);
  const corners: [Rectangle, Corners][] = [
    [{ x0: o.x1 - CORNER, x1: o.x1, z0: o.z1 - CORNER, z1: o.z1 }, [false, MALL_CORNERS[1], false, false]],
    [{ x0: o.x0, x1: o.x0 + CORNER, z0: o.z1 - CORNER, z1: o.z1 }, [false, false, MALL_CORNERS[2], false]],
  ];
  // Cut along the atrium's sides too: a piece's edge on the atrium is all of it there (the engine lights it).
  const plain = rectsMinus(o, [...MALL_HOLES, ...front, ...corners.map(([r]) => r)]).flatMap((r) => splitAt(r, [ATRIUM.z0, ATRIUM.z1], [ATRIUM.x0, ATRIUM.x1]));
  return [
    ...plain.map((r) => outlined(roundedOutline(r, 0, [false, false, false, false]), y - MALL_SLAB, y, "roof")),
    ...corners.map(([r, c]) => outlined(roundedOutline(r, 0, c, undefined, MALL_RADIUS), y - MALL_SLAB, y, "roof")),
  ];
};

/** The front's L2 slab over the south edge at P3's floor, L3's at the roof's (x spans, ADR-0074 B1). */
const L3_OVER: Rectangle = { x0: 397.7, x1: 428.3, z0: MALL.z0, z1: MALL.z0 + FRONT_OVERHANG };

/** The slabs of P2, P3 and the roof (P1's floor is the hall's roof). */
export const mallSlabs = (): Piece[] => [...slab(L.p2, MALL.z0), ...slab(L.p3, MALL.z0 + FRONT_OVERHANG), ...slab(L.roof, MALL.z0, [L3_OVER])];

/** A door in P1's glass: its span and its top over the floor. */
interface GlassDoor {
  readonly gap: Rectangle;
  readonly lintel: Rectangle;
}
const DOOR_TOP = 2.3;
const PANE = MALL_GLASS_THICK;

/**
 * P1's ways in through the glass: the main doors from T0's strip under L2 (south), the side door onto
 * the east ramp's top, and the opening before the lift's gate. The hall's stair house (south-west
 * corner) is the glass's wall where it stands.
 */
export const P1_DOORS: readonly GlassDoor[] = [
  { gap: { x0: 418.8, x1: 421.2, z0: MALL.z0 - 0.5, z1: MALL.z0 + 0.5 }, lintel: { x0: 418.8, x1: 421.2, z0: MALL.z0, z1: MALL.z0 + PANE } },
  { gap: { x0: MALL.x1 - 0.5, x1: MALL.x1 + 0.5, z0: 32.4, z1: 33.9 }, lintel: { x0: MALL.x1 - PANE, x1: MALL.x1, z0: 32.4, z1: 33.9 } },
  { gap: { x0: 412.3, x1: 414.7, z0: MALL.z0 - 0.5, z1: MALL.z0 + 0.5 }, lintel: { x0: 412.3, x1: 414.7, z0: MALL.z0, z1: MALL.z0 + PANE } },
];
/** The hall's stair house in P1's south-west corner. */
const STAIR_HOUSE_GAP: Rectangle = { x0: MALL.x0 - 0.5, x1: 407.9, z0: MALL.z0 - 0.5, z1: 34.9 };

/** The glass of a storey from `y0` to the slab over it at `y1`, open over `gaps`. */
const glass = (y0: number, y1: number, gaps: readonly Rectangle[]): Piece[] => balustrade(MALL, 0, MALL_CORNERS, y0, y1 - y0, true, gaps, MALL_GLASS_RADIUS, "pane", MALL_GLASS_THICK);

/*
 * Under L2 (P2) and L3 (P3) the front's storeys stand against the south face, but the glass runs on
 * behind them all the same: without it a 0.2 m slot stayed between their boxes and the shops' backs,
 * and a crouched, aimed shoulder there started its shot in it (G-275's measure, ADR-0093 O2).
 */
/** The glass of P1..P3 with P1's doors' lintels. */
export const mallGlass = (): Piece[] => [
  ...glass(L.p1, L.p2 - MALL_SLAB, [STAIR_HOUSE_GAP, ...P1_DOORS.map((d) => d.gap)]),
  ...P1_DOORS.map((d) => outlined(roundedOutline(d.lintel, 0, [false, false, false, false]), L.p1 + DOOR_TOP, L.p2 - MALL_SLAB, "pane")),
  ...glass(L.p2, L.p3 - MALL_SLAB, []),
  ...glass(L.p3, L.roof - MALL_SLAB, []),
];

/** The balustrade round the atrium at `y`, a rail thick outside its hole, open where an escalator lands on the floor. */
const atriumRail = (y: number): Piece[] => {
  const gaps = ESCALATOR_LANDINGS.filter((l) => Math.abs(l.y - y) < 0.01).flatMap((l): Rectangle[] => [
    { x0: l.x0 - 0.2, x1: l.x1 + 0.2, z0: ATRIUM.z0 - 0.3, z1: ATRIUM.z0 + 0.3 },
    // The landing at the atrium's east edge opens east onto the gallery too.
    ...(Math.abs(l.x1 - ATRIUM.x1) < 0.01 ? [{ x0: ATRIUM.x1 - 0.3, x1: ATRIUM.x1 + 0.3, z0: l.z0 - 0.2, z1: l.z1 }] : []),
  ]);
  return balustrade(ATRIUM, 0.12, [false, false, false, false], y, MALL_RAIL, true, gaps).map((p) => ({ ...p, inside: true }));
};

/** Round the roof: on the slab's edge, a hand in. */
const roofRail = (): Piece[] => balustrade(slabRect(MALL.z0 + FRONT_OVERHANG), -0.05, MALL_CORNERS, L.roof, MALL_RAIL, true, [], MALL_RADIUS);

/** The body's pieces drawn from afar: slabs, glass, the roof's balustrades. */
export const mallOutsidePieces = (): Piece[] => [...mallSlabs(), ...mallGlass(), ...roofRail(), ...atriumRail(L.roof).map((p) => ({ ...p, inside: false }))];

/** The escalators' flights, their landings, the cores' storeys and shells: made once, grouped for the solids. */
const FLIGHTS = ESCALATORS.map(escalatorFlight);
const LANDINGS = escalatorLandings();
const STOREYS = STAIR_CORES.map(coreStoreys);
const SHELLS = STAIR_CORES.flatMap(coreShell);
const RAILS = [L.p1, L.p2, L.p3].flatMap(atriumRail);

/**
 * The services' riser east of the north-east core (ADR-0093 O3), from P0's floor to the roof's slab:
 * the dead corner between the core, its lift and the rounded glass filled, as a building's shaft for
 * its pipes and cables beside the stairs. Without it the corner was open on every floor, and a
 * crouched, aimed shoulder in the core by its east wall started its shot out there (G-275's measure:
 * on P2 and P3 since O1, on P1 too once O3 brought the core down to P0).
 */
export const NE_RISER: readonly { x: number; z: number }[] = (() => {
  const [x0, z0] = [NE_CORE.x1 + CORE_WALL, NE_CORE.z0 - CORE_WALL];
  const r = MALL_GLASS_RADIUS - MALL_GLASS_THICK;
  const [cx, cz] = [MALL.x1 - MALL_GLASS_RADIUS, MALL.z1 - MALL_GLASS_RADIUS];
  const arc = [0, 1, 2, 3].map((k) => {
    const a = (k / 3) * (Math.PI / 2);
    return { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r };
  });
  return [{ x: x0, z: z0 }, { x: MALL.x1 - MALL_GLASS_THICK, z: z0 }, ...arc, { x: x0, z: MALL.z1 - MALL_GLASS_THICK }];
})();
const riser = (): Piece => ({ ...outlined(NE_RISER, L.p0 - 0.05, L.roof - MALL_SLAB, "wall"), inside: true });

/** Its pieces drawn near only: the atrium's balustrades on P1..P3, the escalators, the cores, the riser by the north-east one. */
export const mallInsidePieces = (): Piece[] => [...RAILS, ...FLIGHTS.flat(), ...LANDINGS.flat(), ...STOREYS.flat(2), ...SHELLS, riser()];

/** The tile of the gallery's solids (`tiledSolidProps`). */
const TILE = 12;

/**
 * The gallery's solids: its body, balustrades and shells a prop per tile; each escalator's flight
 * with the landing at its foot, each core storey's flights with the floor landing they start from, a
 * prop each, so a walker on a flight has its treads down to a floor among the solids near it (the
 * movement's foothold on a thin tread, G-372).
 */
export const mallSolidProps = (outside: readonly Piece[], extra: readonly Piece[]): StaticProp[] => {
  const footOf = (e: (typeof ESCALATORS)[number]) => ESCALATOR_LANDINGS.findIndex((l) => Math.abs(l.y - e.from) < 0.01);
  const flights = ESCALATORS.map((e, i) => [...FLIGHTS[i]!, ...(footOf(e) >= 0 ? LANDINGS[footOf(e)]! : [])]);
  const storeys = STAIR_CORES.flatMap((c, k) => STOREYS[k]!.map((s, i) => [...s, coreFootLanding(c, i)]));
  const grouped = new Set(flights.flat());
  const rest = [...outside, ...mallInsidePieces(), ...extra].filter((p) => !grouped.has(p) && p.kind !== "step");
  return [...tiledSolidProps(rest, TILE), ...flights.map(solidProp), ...storeys.map(solidProp)];
};

/** A small box helper for tests and the engine: the atrium's column from P0's floor to the sky. */
export const ATRIUM_COLUMN = box(ATRIUM.x0, ATRIUM.x1, ATRIUM.z0, ATRIUM.z1, L.p0, L.roof + 10);

/**
 * The cores' stairwells and the escalators' lane A as pieces of the hall's cut of their own, before
 * it (the first holding a point is its floor): a body on a flight is on no floor of the gallery
 * (`heightApart`), so an NPC on it keeps to the level graph's way up or down instead of making for a
 * target a floor up straight through a wall (as the hall's stairs, G-368). Lane B stays the hall's:
 * P0's floor runs on under its flight.
 */
export const MALL_CUTS: readonly GroundCut[] = [
  ...STAIR_CORES.map((c): GroundCut => ({ bounds: { minX: c.x0, maxX: c.x1, minZ: c.z0, maxZ: c.z1 }, floor: HALL.floor })),
  {
    bounds: { minX: Math.min(...ESCALATORS.filter((e) => e.lane === LANE_A).map(escalatorHead)), maxX: Math.max(...ESCALATORS.filter((e) => e.lane === LANE_A).map((e) => e.x0)), minZ: LANE_A.z0, maxZ: LANE_A.z1 },
    floor: HALL.floor,
  },
];
