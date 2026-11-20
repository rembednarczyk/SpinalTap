import { type ActivityId, type StreetPropItem, type Vec3, figureVariant } from "@seki/core";
import type { CrowdSpot } from "../crowd-spot";
import { FRONT_CEILINGS, FRONT_FLOORS, L3_DOORS } from "./front-levels";
import { cartonsAt, cupAt, inBox, litterAt, model, servicesRun, solidOnly, wayLights } from "./front-fit";
import type { VenueSign } from "./front-rooms";
import { shopHash } from "./shop-fittings";
import type { Piece } from "./plan";

/*
 * L3, the food hall's floor carried on into the front (ADR-0093 O5): the board's top storey with its
 * lit tables behind the glass under the sign. Pattern: the mall's food court on its top floor (O3), its
 * seating spilling into the street wing, with a bar and a grill counter. From the gallery's door south
 * down an aisle to the door onto L2's south terrace, across to the door onto its east terrace; the
 * SKY BAR along the gallery's glass, YAKITORI's grill in the north-east corner, NOODLE BOX and ARCADIA
 * on the west (`front-shops.ts`), shared tables with benches between, lanterns over them. Solid what
 * stops a body (counters, stools, the grill's line, shelves), drawn the rest. Traces of somebody just
 * gone: a glass left on the counter, skewers smoking on the grill, a bowl steaming.
 */

const F = FRONT_FLOORS.l3;
const C = FRONT_CEILINGS.l3;
const N = 0;
const S = Math.PI;
const W = -Math.PI / 2;

/** The bar along the gallery's glass west of its door: its counter, the barkeeper's flap at its west end, the back bar at the glass. */
export const SKY_BAR = { x0: 406.3, x1: 416.4, counter: { x0: 408.4, x1: 415.6, z0: 28.2, z1: 29.0 }, back: { z0: 31.3, z1: 31.85 } } as const;
/** The grill in the north-east corner: its partition west (x 422), its counter on its south side. */
export const YAKITORI = { x0: 422.2, x1: 427.8, z0: 27.0, z1: 32.0, counter: { z0: 27.0, z1: 27.8 } } as const;

/** The bar: counter with taps and glasses, stools before it, shelves of bottles behind, a screen, the wall shutting off the corner west of it. */
const bar = (): Piece[] => {
  const b = SKY_BAR;
  const k = b.counter;
  const out: Piece[] = [
    inBox(k.x0, k.x1, k.z0, k.z1, F - 0.05, F + 1.1, "counter", true),
    inBox(k.x0 - 0.05, k.x1 + 0.05, k.z0 - 0.08, k.z1 + 0.02, F + 1.1, F + 1.14, "table"),
    // Its return north at its west end to the barkeeper's flap (0.8 m, staff only) by the back bar; NOODLE BOX's and ARCADIA's
    // doors open onto the floor west of it.
    inBox(k.x0, k.x0 + 0.8, k.z1, b.back.z0 - 0.8, F - 0.05, F + 1.1, "counter", true),
    // The back bar: shelves of bottles to the ceiling's pipes, its box solid.
    solidOnly(b.x0 + 0.3, b.x1 - 0.2, b.back.z0, b.back.z1, F - 0.05, F + 2.3),
    inBox(b.x0 + 0.3, b.x1 - 0.2, b.back.z1 - 0.04, b.back.z1, F, F + 2.3, "rack"),
    // A screen in the back bar's middle, its picture lit (a match, a feed).
    inBox(409.6, 412.6, b.back.z0 - 0.04, b.back.z0, F + 1.4, F + 2.2, "display"),
  ];
  for (const [i, h] of [0.9, 1.35, 1.8, 2.25].entries()) {
    out.push(inBox(b.x0 + 0.3, b.x1 - 0.2, b.back.z0, b.back.z1, F + h, F + h + 0.03, "rack"));
    for (let x = b.x0 + 0.4; x < b.x1 - 0.3; x += 0.16) {
      if ((x > 409.5 && x < 412.7 && h < 2.2) || shopHash("sky-bar", i, x * 10) < 0.15) continue;
      out.push(inBox(x, x + 0.08, b.back.z0 + 0.15, b.back.z0 + 0.25, F + h + 0.03, F + h + 0.3 + shopHash("sky-bar", x * 10, i) * 0.06, "goods"));
    }
  }
  // Taps and glasses on the counter, one left half full; stools before it, one pushed back.
  for (let x = 409.4; x < 414.8; x += 1.6) out.push(inBox(x, x + 0.08, 28.55, 28.65, F + 1.14, F + 1.5, "machine"));
  out.push(...cupAt(409.3, 28.4, F + 1.14, false), ...cupAt(413.1, 28.5, F + 1.14, true), ...cupAt(414.6, 28.35, F + 1.14, false));
  for (let x = 408.9; x < k.x1 - 0.2; x += 0.95) {
    const back = x > 411 && x < 412 ? 0.35 : 0;
    out.push(inBox(x - 0.17, x + 0.17, 27.35 - back, 27.69 - back, F + 0.71, F + 0.75, "bench"), inBox(x - 0.03, x + 0.03, 27.49 - back, 27.55 - back, F, F + 0.71, "bench"));
    out.push(solidOnly(x - 0.17, x + 0.17, 27.35 - back, 27.69 - back, F - 0.05, F + 0.75));
  }
  return out;
};

/** The grill: its partition west, its counter south, the line with the grill smoking along the glass, the hood and its duct, a fridge, crates. */
const grill = (): Piece[] => {
  const g = YAKITORI;
  return [
    inBox(g.x0 - 0.2, g.x0, g.z0, g.z1, F - 0.05, C, "partition", true),
    inBox(g.x0 + 0.2, g.x1 - 0.6, g.counter.z0, g.counter.z1, F - 0.05, F + 1.0, "counter", true),
    inBox(g.x0 + 0.2, g.x1, 31.2, 31.8, F - 0.05, F + 0.9, "counter", true),
    inBox(g.x0 + 0.6, g.x0 + 2.4, 31.25, 31.75, F + 0.9, F + 0.98, "machine"),
    ...[0, 1, 2, 3, 4].map((i) => inBox(g.x0 + 0.7 + i * 0.32, g.x0 + 0.9 + i * 0.32, 31.3, 31.7, F + 0.98, F + 1.02, "food")),
    inBox(g.x0 + 0.8, g.x0 + 0.85, 31.4, 31.45, F + 1.1, F + 1.6, "steam"),
    inBox(g.x0 + 1.5, g.x0 + 1.55, 31.45, 31.5, F + 1.2, F + 1.75, "steam"),
    inBox(g.x0 + 0.4, g.x0 + 2.6, 30.9, 31.8, C - 1.6, C - 1.2, "duct"),
    inBox(g.x0 + 1.2, g.x0 + 1.8, 31.2, 31.6, C - 1.2, C, "duct"),
    inBox(g.x1 - 0.85, g.x1 - 0.1, 29.4, 30.2, F - 0.05, F + 1.9, "machine", true),
    inBox(g.x0 + 1.0, g.x1 - 1.2, 27.1, 27.7, F + 1.0, F + 1.04, "table"),
    inBox(g.x0 + 0.5, g.x1 - 0.8, g.counter.z0 + 0.05, g.counter.z0 + 0.1, F + 2.2, F + 2.7, "display"),
    ...cupAt(g.x0 + 3.1, 27.4, F + 1.04, true),
    ...cartonsAt("yakitori", g.x1 - 0.5, 28.2, F, 3),
  ];
};

/**
 * The shared tables (the food hall's: a table with a bench either long side, along x, 2.8 x 1.6 m) in
 * the dining room: south-west by the glass, the middle east of the aisle to the south door (with the
 * food hall's pair moved through the gallery's door, `foodhall-seating.ts`), south-east by the glass,
 * clear of the aisles (to the doors, before the units) and the rounded corners.
 */
export const L3_GROUPS: readonly { readonly x0: number; readonly z0: number }[] = [
  { x0: 400.0, z0: 14.2 },
  { x0: 404.0, z0: 14.2 },
  { x0: 412.0, z0: 17.0 },
  { x0: 412.0, z0: 20.4 },
  { x0: 420.6, z0: 14.2 },
  { x0: 424.4, z0: 14.2 },
  { x0: 420.6, z0: 17.6 },
  { x0: 424.4, z0: 17.6 },
  { x0: 420.6, z0: 21.0 },
];
const GROUP = { x: 2.8, z: 1.6 } as const;

/** A group's table and benches (solid), lanterns over it, a bowl or two on it. */
const group = (g: { x0: number; z0: number }, i: number): Piece[] => {
  const [x1, z1] = [g.x0 + GROUP.x, g.z0 + GROUP.z];
  const mx = (g.x0 + x1) / 2;
  const out: Piece[] = [
    inBox(g.x0, x1, g.z0 + 0.45, z1 - 0.45, F - 0.05, F + 0.75, "table", true),
    inBox(g.x0, x1, g.z0, g.z0 + 0.35, F - 0.05, F + 0.45, "bench", true),
    inBox(g.x0, x1, z1 - 0.35, z1, F - 0.05, F + 0.45, "bench", true),
  ];
  for (const x of [g.x0 + 0.7, x1 - 0.7]) out.push(inBox(x - 0.18, x + 0.18, g.z0 + 0.62, g.z0 + 0.98, F + 2.3, F + 2.75, "lantern"), inBox(x - 0.01, x + 0.01, g.z0 + 0.79, g.z0 + 0.81, F + 2.75, C, "cable"));
  if (i % 2 === 0) out.push(inBox(mx - 0.4, mx - 0.22, g.z0 + 0.62, g.z0 + 0.8, F + 0.75, F + 0.83, "cup"), ...(i % 4 === 0 ? [inBox(mx - 0.33, mx - 0.3, g.z0 + 0.69, g.z0 + 0.72, F + 0.86, F + 1.15, "steam")] : []));
  if (i % 3 === 1) out.push(...cupAt(x1 - 0.5, z1 - 0.62, F + 0.75, false));
  return out;
};

/** L3 furnished: the bar, the grill, the tables, the services, the way lit to its doors, its traces. */
export const l3Pieces = (): Piece[] => [
  ...bar(),
  ...grill(),
  ...L3_GROUPS.flatMap(group),
  ...servicesRun(416.6, 420.0, 12.8, 31.6, C, 3.0),
  ...servicesRun(405.8, 427.6, 23.2, 25.2, C, 3.0),
  ...servicesRun(399.8, 416.0, 15.4, 16.4, C, 0),
  ...wayLights(418.3, 418.3, 12.6, 31.8, F),
  ...wayLights(410.2, 418.3, 13.0, 13.0, F),
  ...wayLights(418.3, 427.8, 24.0, 24.0, F),
  ...litterAt("l3-bar", 411.0, 27.2, F, 4),
  ...litterAt("l3-south", 410.2, 13.4, F, 3),
];

/** The game's models on L3: the barkeeper, the grill's cook, bins and drinks machines by the aisles. */
export const L3_PROPS: readonly StreetPropItem[] = [
  model("figure", 411.0, F, 30.3, S, figureVariant({ pose: "stand", body: "a", seat: 0, look: 22 })),
  model("figure", 424.6, F, 29.6, S, figureVariant({ pose: "hips", body: "b", seat: 0, look: 3 })),
  model("waste-bin", 416.25, F, 27.6, 0, 3),
  model("waste-bin", 427.4, F, 22.2, 0, 1),
  model("vending-machine", 427.38, F, 20.2, W, 4),
];

/** The bar's and the grill's names in neon over them, facing the dining room. */
export const L3_SIGNS: readonly VenueSign[] = [
  { text: "SKY BAR", axis: "x", at: SKY_BAR.back.z0 - 0.05, a0: 412.8, a1: 416.0, y0: F + 2.45, y1: F + 2.95, out: -1, color: "neon-cyan" },
  { text: "YAKITORI", axis: "x", at: YAKITORI.counter.z0 + 0.02, a0: 422.8, a1: 427.2, y0: F + 2.8, y1: F + 3.2, out: -1, color: "neon-red" },
];

const CHUNK = "krakowskie-2-1";
const spot = (at: Vec3, yaw: number, does: readonly [ActivityId, ...ActivityId[]]): CrowdSpot => ({ chunk: CHUNK, at, yaw, does, indoor: true });
/** On a group's bench, south (`a`) or north, `along` from its west end, facing the table. */
const onBench = (i: number, side: "a" | "b", along: number): CrowdSpot => {
  const g = L3_GROUPS[i]!;
  return spot({ x: g.x0 + along, y: F, z: side === "a" ? g.z0 + 0.17 : g.z0 + GROUP.z - 0.17 }, side === "a" ? N : S, ["sit"]);
};

/** L3's still crowd (ADR-0060): at the bar, at the grill, at the tables, at the glass by the south door looking over the square. */
export const L3_CROWD: readonly CrowdSpot[] = [
  spot({ x: 410.35, y: F, z: 27.2 }, N, ["drink"]),
  spot({ x: 413.9, y: F, z: 27.4 }, N, ["drink", "talk"]),
  spot({ x: 424.0, y: F, z: 26.4 }, N, ["eat"]),
  onBench(0, "a", 0.8),
  onBench(0, "b", 2.0),
  onBench(3, "a", 1.0),
  onBench(5, "b", 0.9),
  onBench(8, "a", 1.9),
  spot({ x: 407.4, y: F, z: 12.8 }, S, ["phone"]),
  spot({ x: L3_DOORS.south.x1 + 1.2, y: F, z: 12.9 }, S, ["lean", "smoke"]),
];
