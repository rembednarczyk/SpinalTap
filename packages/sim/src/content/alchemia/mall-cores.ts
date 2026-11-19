import { CORE_HOUSE, CORE_WALL, MALL_LEVELS, MALL_RAIL, type StairCore } from "./mall-plan";
import { type Piece, box, piece } from "./plan";

/*
 * The gallery's stair cores (ADR-0093 O1, `docs/zasady-lokacji.md` §6): two flights a storey in two
 * lanes along x (a dog-leg stair), up east in the north lane to a mid landing, on up west in the south
 * lane to the next floor's landing at the west end, where a door opens onto the floor. Risers of
 * 0.173-0.175 m, treads of 0.28 m, a landing every 12-13 risers. Walled to a stair house over the roof.
 * The flights of the lowest storey are solid down to its floor, the higher ones a tread deep (the
 * flight under them passes under). Drawn near only, the stair houses on the roof from afar too.
 */

const L = MALL_LEVELS;
/** A tread's going, the highest riser, a floating tread's and landing's depth. */
export const CORE_GOING = 0.28;
const RISER = 0.18;
const TREAD = 0.45;
const LANDING = 0.3;
/** The divider between the lanes, the doors' height. */
const DIVIDER = 0.1;
const DOOR = 2.1;

/** Risers of each of a storey's two flights: the fewest within the highest riser. */
export const coreRisers = (rise: number): number => Math.ceil(rise / 2 / RISER - 1e-9);

/** The lanes: the south one and the north one, either side of the divider. */
export const coreLanes = (c: StairCore): { readonly s: { z0: number; z1: number }; readonly n: { z0: number; z1: number }; readonly mid: number } => {
  const mid = (c.z0 + c.z1) / 2;
  return { s: { z0: c.z0, z1: mid - DIVIDER / 2 }, n: { z0: mid + DIVIDER / 2, z1: c.z1 }, mid };
};

/** Where the flights start (the floor landing's east edge) and where the mid landing starts, for a storey of `rise`. */
export const coreSpan = (c: StairCore, rise: number): { readonly xs: number; readonly xm: number } => {
  const xs = c.x0 + c.landing;
  return { xs, xm: xs + (coreRisers(rise) - 1) * CORE_GOING };
};

/** A piece of the core, drawn near only (inside) under the roof, from afar too over it (the stair house): split there. */
const inside = (b: ReturnType<typeof box>, kind: Piece["kind"]): Piece => ({ ...piece(b, kind, true), inside: b.y0 < L.roof - 0.01 });
const split = (b: ReturnType<typeof box>, kind: Piece["kind"]): Piece[] =>
  b.y0 < L.roof - 0.01 && b.y1 > L.roof + 0.01 ? [inside({ ...b, y1: L.roof }, kind), inside({ ...b, y0: L.roof }, kind)] : [inside(b, kind)];

/** One storey's flights and its mid landing, from floor `y` up `rise`. */
const storey = (c: StairCore, y: number, rise: number, lowest: boolean): Piece[] => {
  const n = coreRisers(rise);
  const r = rise / (2 * n);
  const { xs, xm } = coreSpan(c, rise);
  const lanes = coreLanes(c);
  const half = y + rise / 2;
  const out: Piece[] = [];
  for (let k = 1; k < n; k++) {
    // Up east in the north lane, then up west in the south one.
    const t1 = y + k * r;
    out.push(inside(box(xs + (k - 1) * CORE_GOING, xs + k * CORE_GOING, lanes.n.z0, lanes.n.z1, lowest ? y - 0.05 : t1 - TREAD, t1), "step"));
    const t2 = half + k * r;
    out.push(inside(box(xm - k * CORE_GOING, xm - (k - 1) * CORE_GOING, lanes.s.z0, lanes.s.z1, lowest ? y - 0.05 : t2 - TREAD, t2), "step"));
  }
  out.push(inside(box(xm, c.x1, c.z0, c.z1, lowest ? y - 0.05 : half - LANDING, half), "step"));
  return out;
};

/** A wall along x at z0..z1 from `from` to the stair house's top, open at each floor over [a0, a1] (when `door`). */
const wallAlongX = (x0: number, x1: number, z0: number, z1: number, from: number, top: number, door?: { a0: number; a1: number; floors: readonly number[] }): Piece[] => {
  if (!door) return split(box(x0, x1, z0, z1, from, top), "wall");
  const out = [...split(box(x0, door.a0, z0, z1, from, top), "wall"), ...split(box(door.a1, x1, z0, z1, from, top), "wall")];
  let y = from;
  for (const f of door.floors.filter((f) => f >= from - 0.01)) {
    if (f > y + 0.01) out.push(...split(box(door.a0, door.a1, z0, z1, y, f), "wall"));
    y = f + DOOR;
  }
  if (top > y + 0.01) out.push(...split(box(door.a0, door.a1, z0, z1, y, top), "wall"));
  return out;
};

/** The same along z (a west or east wall), its door's span along z. */
const wallAlongZ = (x0: number, x1: number, z0: number, z1: number, from: number, top: number, door?: { a0: number; a1: number; floors: readonly number[] }): Piece[] =>
  wallAlongX(z0, z1, x0, x1, from, top, door).map((p) => ({ ...p, box: box(p.box.z0, p.box.z1, p.box.x0, p.box.x1, p.box.y0, p.box.y1) }));

/** The core's walls round it with its doors, the stair house's roof over it. */
const walls = (c: StairCore): Piece[] => {
  const top = L.roof + CORE_HOUSE;
  const W = CORE_WALL;
  const [x0, x1, z0, z1] = [c.x0 - W, c.x1 + W, c.z0 - W, c.z1 + W];
  const door = { a0: c.door.a0, a1: c.door.a1, floors: c.floors };
  return [
    ...wallAlongX(x0, x1, c.z1, z1, c.walls.n, top, c.door.side === "n" ? door : undefined),
    ...wallAlongX(x0, x1, z0, c.z0, c.walls.s, top),
    ...wallAlongZ(c.x1, x1, c.z0, c.z1, c.walls.e, top),
    ...wallAlongZ(x0, c.x0, c.z0, c.z1, c.walls.w, top, c.door.side === "w" ? door : undefined),
    inside(box(x0 - 0.1, x1 + 0.1, z0 - 0.1, z1 + 0.1, top, top + 0.15), "roof"),
  ];
};

/**
 * Every piece of a core: its storeys' flights, the divider between the lanes the whole way up, a rail
 * across the north lane at the roof's landing (no flight goes on up), the walls.
 */
export const corePieces = (c: StairCore): Piece[] => [...coreStoreys(c).flat(), ...coreShell(c)];

/** A core's storeys' flights with their mid landings, lowest first. */
export const coreStoreys = (c: StairCore): Piece[][] => c.floors.slice(0, -1).map((y, i) => storey(c, y, c.floors[i + 1]! - y, i === 0));

/**
 * The floor landing a storey's flights start from, as a solid of the flights' own (not drawn: the
 * slab is there): the movement holds a foot on a thin tread through the treads under it down to a
 * wide floor among the solids near the walker (G-372), so a flight's solids keep their floor with them.
 */
export const coreFootLanding = (c: StairCore, i: number): Piece => {
  const y = c.floors[i]!;
  return inside(box(c.x0, c.x0 + c.landing, c.z0, c.z1, y - 0.3, y), "step");
};

/** The divider, the roof's rail and the walls of a core. */
export const coreShell = (c: StairCore): Piece[] => {
  const out: Piece[] = [];
  const lanes = coreLanes(c);
  const roof = c.floors[c.floors.length - 1]!;
  const { xs, xm } = coreSpan(c, c.floors[1]! - c.floors[0]!);
  out.push(inside(box(xs, Math.min(xm, coreSpan(c, roof - c.floors[c.floors.length - 2]!).xm), lanes.mid - DIVIDER / 2, lanes.mid + DIVIDER / 2, c.floors[0]! - 0.05, roof + MALL_RAIL), "partition"));
  out.push(inside(box(xs, xs + 0.12, lanes.n.z0, lanes.n.z1, roof, roof + MALL_RAIL), "parapet"));
  return [...out, ...walls(c)];
};
