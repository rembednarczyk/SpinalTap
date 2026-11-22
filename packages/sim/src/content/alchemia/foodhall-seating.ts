import type { StreetPropItem } from "@seki/core";
import { type Piece, box, piece } from "./plan";
import { FOODHALL_CEILING, FOODHALL_FLOOR } from "./units";

/*
 * The food hall's seating on P3 (ADR-0093 O3, `docs/zasady-lokacji.md` §2): shared tables with their
 * benches in the strips before the units' counters (west, east and south of the atrium), stools along
 * Fumiko's bar and a table in its corner, a ledge to eat standing at along the atrium's balustrade on
 * the west and east galleries; over them paper lanterns on cables and the services under the slab
 * (pipes, a duct, cable trays). Its marks of somebody just gone (§5): bowls left steaming on the
 * tables, a spilled drink, a stool knocked over. Solid what stops a body (tables, benches, stools,
 * ledges), drawn only what is on them or over the head. Inside: drawn near only.
 */

const F = FOODHALL_FLOOR;
const C = FOODHALL_CEILING;
const TABLE = 0.75;
const BENCH = 0.45;

/** A table group: a table with a bench on either long side, along x or along z, from `a0` to `a1` across. */
interface Group {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  /** The long side runs along z (the benches west and east of the table) or along x. */
  readonly along: "x" | "z";
}

/**
 * The groups, each 1.6 m across (bench 0.35, table 0.7, a hand between): two in the west strip and
 * three in the east one, their aisle to the counters 1.6-1.7 m; one in the south strip between the
 * hall's lift's lobby and the door into L3 (ADR-0093 O5), at right angles to the glass, and its pair
 * moved through that door into L3's dining room; one in the corner before Fumiko's bar.
 */
export const TABLE_GROUPS: readonly Group[] = [
  { x0: 406.0, x1: 407.6, z0: 40.2, z1: 43.0, along: "z" },
  { x0: 406.0, x1: 407.6, z0: 44.6, z1: 47.4, along: "z" },
  // A metre and more before Oyaji's counter for his customers (22.11, his counter turned onto this strip): 38.0-40.8 until then.
  { x0: 428.3, x1: 429.9, z0: 39.2, z1: 41.4, along: "z" },
  { x0: 428.3, x1: 429.9, z0: 42.4, z1: 45.2, along: "z" },
  { x0: 428.3, x1: 429.9, z0: 46.6, z1: 48.8, along: "z" },
  // West of the door into L3 (ADR-0093 O5; x 416.0-417.6 until then), and the second moved through it into L3's dining room.
  { x0: 415.0, x1: 416.6, z0: 32.6, z1: 35.8, along: "z" },
  { x0: 412.0, x1: 414.8, z0: 13.6, z1: 15.2, along: "x" },
  { x0: 405.6, x1: 407.6, z0: 54.35, z1: 55.95, along: "x" },
];

/** A group's table and its two benches (`a` the low side's bench, `b` the high side's), as world boxes. */
export const groupParts = (g: Group) => {
  if (g.along === "z") {
    return {
      table: box(g.x0 + 0.45, g.x1 - 0.45, g.z0, g.z1, F - 0.05, F + TABLE),
      a: box(g.x0, g.x0 + 0.35, g.z0, g.z1, F - 0.05, F + BENCH),
      b: box(g.x1 - 0.35, g.x1, g.z0, g.z1, F - 0.05, F + BENCH),
    };
  }
  return {
    table: box(g.x0, g.x1, g.z0 + 0.45, g.z1 - 0.45, F - 0.05, F + TABLE),
    a: box(g.x0, g.x1, g.z0, g.z0 + 0.35, F - 0.05, F + BENCH),
    b: box(g.x0, g.x1, g.z1 - 0.35, g.z1, F - 0.05, F + BENCH),
  };
};

/** The stools along Fumiko's counter (its customers' side), clear of her customer's place in its middle. */
export const FUMIKO_STOOLS: readonly number[] = [50.9, 51.7, 55.3, 56.1, 56.9];
const STOOL_X = 404.75;

/** The ledges to eat standing at along the atrium's balustrade, on the west and east galleries. */
const LEDGES = [box(410.5, 410.85, 43.0, 47.0, F - 0.05, F + 1.05), box(425.15, 425.5, 43.0, 47.0, F - 0.05, F + 1.05)];

/**
 * The bowls left on the tables (§5), steaming when just left: drawn by the rooms' detail (round bowls on trays,
 * `foodhall-detail.ts`, ADR-0098), their steam here.
 */
export const FOODHALL_MEALS: readonly { readonly x: number; readonly z: number; readonly hot: boolean }[] = [
  { x: 406.8, z: 41.0, hot: true },
  { x: 406.8, z: 41.6, hot: false },
  { x: 429.1, z: 43.4, hot: true },
  { x: 415.8, z: 34.0, hot: true },
  { x: 413.1, z: 14.4, hot: false },
  { x: 406.4, z: 55.15, hot: true },
];

/** A meal's steam over its bowl. */
const steam = (m: (typeof FOODHALL_MEALS)[number]): Piece[] =>
  m.hot ? [piece(box(m.x - 0.015, m.x + 0.02, m.z - 0.015, m.z + 0.02, F + TABLE + 0.11, F + TABLE + 0.42), "steam", true, false)] : [];

/** The tables' top over the floor. */
export const FOODHALL_TABLE_TOP = TABLE;

/** The marks on the tables and the floor: bowls and cups, chopsticks' paper, a spilled drink, a stool on its side. */
const traces = (): Piece[] => [
  ...FOODHALL_MEALS.flatMap(steam),
  // A drink knocked over and spreading on the east table (its cup on its side by it, and a cup standing on the west
  // table, and the stool knocked over by the bar, are the rooms' detail's: `foodhall-detail.ts`).
  piece(box(429.0, 429.35, 39.2, 39.8, F + TABLE, F + TABLE + 0.005), "water", true, false),
  // Wrappers and napkins under the tables.
  ...[
    [406.9, 43.4],
    [405.5, 44.1],
    [429.0, 41.7],
    [415.7, 36.3],
    [414.9, 16.0],
    [407.9, 52.4],
  ].map(([x, z]) => piece(box(x! - 0.12, x! + 0.12, z! - 0.16, z! + 0.16, F + 0.003, F + 0.008), "paper", true, false)),
];

/** Where the paper lanterns hang over a group (warm, §4: food), two or three along its table: their tops on their cables. */
export const lanternSpots = (g: Group): { readonly x: number; readonly z: number; readonly top: number }[] => {
  const t = groupParts(g).table;
  const alongZ = g.along === "z";
  const len = alongZ ? t.z1 - t.z0 : t.x1 - t.x0;
  const n = Math.max(2, Math.round(len / 1.2));
  return Array.from({ length: n }, (_, i) => {
    const a = (len * (i + 0.5)) / n;
    const [x, z] = alongZ ? [(t.x0 + t.x1) / 2, t.z0 + a] : [t.x0 + a, (t.z0 + t.z1) / 2];
    return { x, z, top: F + 2.75 };
  });
};

/** The lanterns' cables over a group (the lanterns themselves are the rooms' detail's, round: `foodhall-detail.ts`). */
const lanterns = (g: Group): Piece[] => lanternSpots(g).map(({ x, z, top }) => piece(box(x - 0.01, x + 0.01, z - 0.01, z + 0.01, top, C), "cable", true, false));

/**
 * The services under the slab over the ring (the architecture's layer): a pipe run and a cable tray
 * along the west, north and east strips, a duct along the south one, drawn only, high over the head.
 * The pipes run over the units' signs' top (0.12 m under the slab) and 0.55 m out of their fronts, so
 * no name is cut by them seen from the floor (user's note of 22.11: they hung before every sign's top).
 */
const services = (): Piece[] => [
  piece(box(404.95, 405.05, 38.0, 52.8, C - 0.11, C - 0.01), "pipe", true, false),
  piece(box(408.2, 425.0, 52.35, 52.45, C - 0.11, C - 0.01), "pipe", true, false),
  piece(box(430.95, 431.05, 37.6, 49.2, C - 0.11, C - 0.01), "pipe", true, false),
  piece(box(405.4, 405.7, 38.0, 52.8, C - 0.1, C - 0.05), "cable", true, false),
  piece(box(430.5, 430.8, 37.6, 49.2, C - 0.1, C - 0.05), "cable", true, false),
  piece(box(415.0, 421.2, 33.4, 34.0, C - 0.45, C - 0.08), "duct", true, false),
];

/**
 * Strings of paper lanterns along the atrium's balustrade on all four sides, a cable sagging between
 * hooks under the slab and a lantern every 1.4 m (the night market's light, §4), over the gallery.
 */
const FESTOON_Y = C - 0.75;
const FESTOON_LINES: readonly (readonly [number, number, number, number])[] = [
  [409.6, 426.4, 39.6, 39.6],
  [409.6, 426.4, 50.4, 50.4],
  [409.6, 409.6, 39.6, 50.4],
  [426.4, 426.4, 39.6, 50.4],
];

/** The strings' lanterns: a lantern every 1.4 m along each line, its top under the cable (drawn by the rooms' detail). */
export const FESTOON_SPOTS: readonly { readonly x: number; readonly z: number; readonly top: number }[] = FESTOON_LINES.flatMap(([x0, x1, z0, z1]) => {
  const n = Math.floor(Math.hypot(x1 - x0, z1 - z0) / 1.4);
  return Array.from({ length: Math.max(0, n - 1) }, (_, k) => ({ x: x0 + ((x1 - x0) * (k + 1)) / n, z: z0 + ((z1 - z0) * (k + 1)) / n, top: FESTOON_Y - 0.02 }));
});

const festoons = (): Piece[] =>
  FESTOON_LINES.map(([x0, x1, z0, z1]) => piece(box(Math.min(x0, x1) - 0.01, Math.max(x0, x1) + 0.01, Math.min(z0, z1) - 0.01, Math.max(z0, z1) + 0.01, FESTOON_Y, FESTOON_Y + 0.02), "cable", true, false));

/** The seating's pieces: tables, benches, stools and ledges (solid), lanterns, services and marks (drawn). */
export const seatingPieces = (): Piece[] => [
  ...TABLE_GROUPS.flatMap((g) => {
    const p = groupParts(g);
    return [piece(p.table, "table", true), piece(p.a, "bench", true), piece(p.b, "bench", true)];
  }),
  ...FUMIKO_STOOLS.map((z) => piece(box(STOOL_X - 0.17, STOOL_X + 0.17, z - 0.17, z + 0.17, F - 0.05, F + 0.75), "bench", true)),
  ...LEDGES.map((b) => piece(b, "counter", true)),
  ...TABLE_GROUPS.flatMap(lanterns),
  ...festoons(),
  ...services(),
  ...traces(),
];

/**
 * The game's models in the food hall: a pair of drinks machines in the pocket east of the north-east
 * lift, facing its lobby, and bins at the seating's ends (`docs/zasady-lokacji.md` §8: models first).
 */
export const FOODHALL_PROPS: readonly StreetPropItem[] = [
  { prop: "vending-machine", x: 435.0, y: F, z: 52.45, yaw: -Math.PI / 2, variant: 2 },
  { prop: "vending-machine", x: 435.0, y: F, z: 53.5, yaw: -Math.PI / 2, variant: 5 },
  { prop: "waste-bin", x: 407.9, y: F, z: 43.8, yaw: 0, variant: 1 },
  // Off the door into L3 (ADR-0093 O5; at x 418.4, z 32.5 until then).
  { prop: "waste-bin", x: 416.95, y: F, z: 36.55, yaw: 0, variant: 2 },
];
