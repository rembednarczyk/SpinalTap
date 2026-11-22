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
  { x0: 428.3, x1: 429.9, z0: 38.0, z1: 40.8, along: "z" },
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

/** A bowl on a table at (x, z): steaming when it was just left (§5). */
const bowl = (x: number, z: number, hot: boolean): Piece[] => [
  piece(box(x - 0.09, x + 0.09, z - 0.09, z + 0.09, F + TABLE, F + TABLE + 0.08), "cup", true, false),
  ...(hot ? [piece(box(x - 0.015, x + 0.02, z - 0.015, z + 0.02, F + TABLE + 0.11, F + TABLE + 0.42), "steam", true, false)] : []),
];

/** The marks on the tables and the floor: bowls and cups, chopsticks' paper, a spilled drink, a stool on its side. */
const traces = (): Piece[] => [
  ...bowl(406.8, 41.0, true),
  ...bowl(406.8, 41.6, false),
  ...bowl(429.1, 43.4, true),
  ...bowl(415.8, 34.0, true),
  ...bowl(413.1, 14.4, false),
  ...bowl(406.4, 55.15, true),
  piece(box(406.6, 406.75, 46.0, 46.08, F + TABLE, F + TABLE + 0.12), "cup", true, false),
  // A drink knocked over and spreading on the east table, the cup on its side by it.
  piece(box(429.0, 429.35, 39.2, 39.8, F + TABLE, F + TABLE + 0.005), "water", true, false),
  piece(box(429.3, 429.42, 39.75, 39.84, F + TABLE, F + TABLE + 0.07), "cup", true, false),
  // A stool knocked over by the bar (drawn: it lies flat where it fell).
  piece(box(405.0, 405.7, 53.9, 54.25, F, F + 0.32), "bench", true, false),
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

/** Paper lanterns on cables over a group (warm, §4: food), two or three along its table. */
const lanterns = (g: Group): Piece[] => {
  const t = groupParts(g).table;
  const alongZ = g.along === "z";
  const len = alongZ ? t.z1 - t.z0 : t.x1 - t.x0;
  const n = Math.max(2, Math.round(len / 1.2));
  return Array.from({ length: n }, (_, i) => {
    const a = (len * (i + 0.5)) / n;
    const [x, z] = alongZ ? [(t.x0 + t.x1) / 2, t.z0 + a] : [t.x0 + a, (t.z0 + t.z1) / 2];
    return [
      piece(box(x - 0.18, x + 0.18, z - 0.18, z + 0.18, F + 2.3, F + 2.75), "lantern", true, false),
      piece(box(x - 0.01, x + 0.01, z - 0.01, z + 0.01, F + 2.75, C), "cable", true, false),
    ];
  }).flat();
};

/**
 * The services under the slab over the ring (the architecture's layer): a pipe run and a cable tray
 * along the west, north and east strips, a duct along the south one, drawn only, high over the head.
 * The pipes run over the units' signs' top (0.12 m under the slab) and 0.55 m out of their fronts, so
 * no name is cut by them seen from the floor (user's note of 22.11: they hung before every sign's top).
 */
const services = (): Piece[] => [
  piece(box(404.95, 405.05, 38.0, 52.8, C - 0.11, C - 0.01), "pipe", true, false),
  piece(box(408.2, 425.0, 52.35, 52.45, C - 0.11, C - 0.01), "pipe", true, false),
  piece(box(430.95, 431.05, 37.4, 49.2, C - 0.11, C - 0.01), "pipe", true, false),
  piece(box(405.4, 405.7, 38.0, 52.8, C - 0.1, C - 0.05), "cable", true, false),
  piece(box(430.5, 430.8, 37.4, 49.2, C - 0.1, C - 0.05), "cable", true, false),
  piece(box(415.0, 421.2, 33.4, 34.0, C - 0.45, C - 0.08), "duct", true, false),
];

/**
 * Strings of paper lanterns along the atrium's balustrade on all four sides, a cable sagging between
 * hooks under the slab and a lantern every 1.4 m (the night market's light, §4), over the gallery.
 */
const festoons = (): Piece[] => {
  const y = C - 0.75;
  const lines: [number, number, number, number][] = [
    [409.6, 426.4, 39.6, 39.6],
    [409.6, 426.4, 50.4, 50.4],
    [409.6, 409.6, 39.6, 50.4],
    [426.4, 426.4, 39.6, 50.4],
  ];
  return lines.flatMap(([x0, x1, z0, z1]) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.floor(len / 1.4);
    const out: Piece[] = [piece(box(Math.min(x0, x1) - 0.01, Math.max(x0, x1) + 0.01, Math.min(z0, z1) - 0.01, Math.max(z0, z1) + 0.01, y, y + 0.02), "cable", true, false)];
    for (let i = 1; i < n; i++) {
      const [x, z] = [x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n];
      out.push(piece(box(x - 0.12, x + 0.12, z - 0.12, z + 0.12, y - 0.32, y - 0.02), "lantern", true, false));
    }
    return out;
  });
};

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
