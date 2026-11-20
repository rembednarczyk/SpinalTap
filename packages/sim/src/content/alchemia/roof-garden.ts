import { type StreetPropItem, measuredTreeVariant } from "@seki/core";
import type { CrowdSpot } from "../crowd-spot";
import { seatGroups } from "../lublin/seats";
import { type Piece, box, outlined, piece } from "./plan";
import { roundedOutline } from "./rounded";
import {
  BED_RAISED,
  LANTERN,
  PERGOLA,
  PERGOLAS,
  ROOF_BEDS,
  ROOF_BENCHES,
  ROOF_LAMPS,
  ROOF_PLANTERS,
  ROOF_TABLES,
  ROOF_TREES,
  ROOF_Y,
  type Pergola,
  type RoofBed,
} from "./roof-plan";

/*
 * The green roof's garden (ADR-0093 O4): the beds with their edging and substrate, the pergolas of
 * dark timber with ruby paper lanterns under their rafters and climbers over them, the tables, and
 * the game's trees, shrubs, benches, park lamps and planters on it (`docs/zasady-lokacji.md` §8: the
 * game's models before boxes of our own). Solid where somebody stops (beds, posts, tables, the
 * game's benches, lamps, trunks and planters); the beams, rafters, lanterns, climbers and flowers
 * drawn only (over every head, or in a bed). What grows where by a hash of the place.
 */

const R = ROOF_Y;

/** A cheap hash of a place, in [0, 1). */
export const roofHash = (x: number, z: number): number => {
  const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return h - Math.floor(h);
};

/** A bed's outline, rounded as planned. */
export const bedOutline = (b: RoofBed, grow = 0) => roundedOutline(b, grow, b.corners, undefined, b.radius);

/** Is (x, z) inside a bed's outline (its rounded corners too), `margin` in from it? */
export const inBed = (b: RoofBed, x: number, z: number, margin = 0): boolean => {
  if (x < b.x0 + margin || x > b.x1 - margin || z < b.z0 + margin || z > b.z1 - margin) return false;
  const r = b.radius;
  const corners: [number, number, number, number, boolean][] = [
    [b.x1 - r, b.z0 + r, 1, -1, b.corners[0]],
    [b.x1 - r, b.z1 - r, 1, 1, b.corners[1]],
    [b.x0 + r, b.z1 - r, -1, 1, b.corners[2]],
    [b.x0 + r, b.z0 + r, -1, -1, b.corners[3]],
  ];
  return corners.every(([cx, cz, sx, sz, round]) => !round || (x - cx) * sx <= 0 || (z - cz) * sz <= 0 || Math.hypot(x - cx, z - cz) <= r - margin);
};

/** The beds: a raised one an edged box of substrate (`planter`), a low one a lawn on its substrate (`lawn`); both solid. */
const beds = (): Piece[] => ROOF_BEDS.map((b) => outlined(bedOutline(b), R - 0.05, R + b.high, b.high >= BED_RAISED ? "planter" : "lawn"));

/** Flowers in the raised beds without a tree (rabaty): tufts in the substrate along the edging, drawn only. */
const flowers = (): Piece[] =>
  ROOF_BEDS.filter((b) => b.high >= BED_RAISED && (b.key === "s-flowers" || b.key === "w-tree" || b.key === "nw")).flatMap((b) => {
    const out: Piece[] = [];
    for (let x = b.x0 + 0.45; x < b.x1 - 0.3; x += 0.55) {
      for (const z of [b.z0 + 0.4, b.z1 - 0.4, (b.z0 + b.z1) / 2]) {
        const h = roofHash(x, z);
        if (h < 0.35 || !inBed(b, x, z, 0.25)) continue;
        const s = 0.12 + 0.1 * h;
        out.push(piece(box(x - s, x + s, z - s, z + s, R + b.high - 0.02, R + b.high + 0.12 + 0.25 * h), "flower", true, false));
      }
    }
    return out;
  });

/** A pergola's top: the crossbeams' underside over the roof. */
const TOP = R + PERGOLA.height;

/**
 * A pergola: its posts (solid), a crossbeam along x over each row, rafters along z between the rows
 * every 0.6 m on them, a ruby lantern under every other rafter over each span's middle, climbers
 * over some rafters (the board's green over its terraces).
 */
const pergola = (p: Pergola): Piece[] => {
  const { post: P, beam: B } = PERGOLA;
  const [x0, x1] = [p.xs[0]! - P / 2, p.xs[p.xs.length - 1]! + P / 2];
  const [z0, z1] = [p.zs[0]! - P / 2, p.zs[p.zs.length - 1]! + P / 2];
  const out: Piece[] = [];
  for (const x of p.xs) for (const z of p.zs) out.push(piece(box(x - P / 2, x + P / 2, z - P / 2, z + P / 2, R - 0.05, TOP), "pergola", false));
  for (const z of p.zs) out.push(piece(box(x0 - 0.25, x1 + 0.25, z - P / 2, z + P / 2, TOP, TOP + B), "pergola", false, false));
  const n = Math.round((x1 - x0) / PERGOLA.rafterEvery);
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    out.push(piece(box(x - 0.04, x + 0.04, z0 - 0.3, z1 + 0.3, TOP + B, TOP + B + 0.1), "pergola", false, false));
    if (i % 2 === 1) {
      for (let k = 0; k + 1 < p.zs.length; k++) {
        const z = (p.zs[k]! + p.zs[k + 1]!) / 2;
        for (const dz of [-1, 1]) {
          const zz = z + dz * (p.zs[k + 1]! - p.zs[k]!) * 0.22;
          const s = LANTERN.size / 2;
          out.push(piece(box(x - s, x + s, zz - s, zz + s, TOP + B - LANTERN.drop - LANTERN.size, TOP + B - LANTERN.drop), "lantern", false, false));
        }
      }
    }
    // Climbers: a strand of leaves along some rafters, hanging a little over the ends.
    if (roofHash(x, z0) > 0.45) out.push(piece(box(x - 0.14, x + 0.14, z0 - 0.2, z0 + (z1 - z0) * (0.4 + 0.5 * roofHash(z0, x)), TOP + B + 0.1, TOP + B + 0.24), "green", false, false));
  }
  // Leaves down a post or two of the back row, round it.
  const back = p.zs[p.zs.length - 1]!;
  for (const x of p.xs) {
    if (roofHash(x, z1) < 0.5) continue;
    out.push(piece(box(x - 0.16, x + 0.16, back - 0.16, back + 0.16, R + 0.6, TOP + B), "green", false, false));
  }
  return out;
};

/** The tables: a top on a frame, solid, elbow high. */
const tables = (): Piece[] => ROOF_TABLES.map((t) => piece(box(t.x0, t.x1, t.z0, t.z1, R - 0.05, R + 0.75), "table", false));

/** The garden's own pieces: beds, flowers, pergolas, tables. */
export const roofGardenPieces = (): Piece[] => [...beds(), ...flowers(), ...PERGOLAS.flatMap(pergola), ...tables()];

/** A shrub of the game's (`shrubs`), its size from bits 4..7 of its variant (0.7 to 1.2) by the hash: small in a bed. */
const shrub = (x: number, y: number, z: number, h: number): StreetPropItem => ({ prop: "shrubs", x, y, z, yaw: h * 6.283, variant: (Math.floor(h * 4096) & 0xf0f) | 0x10 });

/** Shrubs along a raised bed's edging, a step in, by the hash; none by its tree's trunk nor at a lamp. */
const bedShrubs = (b: RoofBed): StreetPropItem[] => {
  if (b.high < BED_RAISED || b.key === "s-flowers") return [];
  const out: StreetPropItem[] = [];
  const step = 1.3;
  for (let x = b.x0 + 0.7; x < b.x1 - 0.5; x += step) {
    // A narrow bed takes one row down its middle.
    for (const z of b.z1 - b.z0 < 2.2 ? [(b.z0 + b.z1) / 2] : [b.z0 + 0.7, b.z1 - 0.7]) {
      const h = roofHash(x + 0.5, z - 0.5);
      if (h < 0.3 || !inBed(b, x, z, 0.5)) continue;
      if (ROOF_TREES.some((t) => Math.hypot(t.x - x, t.z - z) < 1.3) || ROOF_LAMPS.some((l) => Math.hypot(l.x - x, l.z - z) < 0.9)) continue;
      out.push(shrub(x, R + b.high, z, h));
    }
  }
  return out;
};

/** The roof's trees: the game's, on the substrate of their beds, some 6 m tall, of the seed's species. */
const trees = (): StreetPropItem[] =>
  ROOF_TREES.map((t) => {
    const bed = ROOF_BEDS.find((b) => inBed(b, t.x, t.z))!;
    return { prop: "tree", x: t.x, y: R + bed.high, z: t.z, yaw: (t.seed % 628) / 100, variant: measuredTreeVariant(t.seed, 6 + (t.seed % 3) * 0.4) };
  });

/** The surface under (x, z): a bed's top, or the roof. */
const surface = (x: number, z: number): number => R + (ROOF_BEDS.find((b) => inBed(b, x, z))?.high ?? 0);

/**
 * The game's models on the roof: trees, shrubs in the beds, the benches, the park lamps by the ways,
 * the planters with their greenery.
 */
export const ROOF_GARDEN_PROPS: readonly StreetPropItem[] = [
  ...trees(),
  ...ROOF_BEDS.flatMap(bedShrubs),
  ...ROOF_BENCHES.map((b): StreetPropItem => ({ prop: "bench", x: b.x, y: R, z: b.z, yaw: b.yaw, variant: b.variant })),
  ...ROOF_LAMPS.map((l): StreetPropItem => ({ prop: "lamp-park", x: l.x, y: surface(l.x, l.z), z: l.z, yaw: 0, variant: 0 })),
  ...ROOF_PLANTERS.map((p, i): StreetPropItem => ({ prop: "planter", x: p.x, y: R, z: p.z, yaw: 0, variant: 7 + 2 * i })),
];

/** The planters' concrete boxes (the game's planter: 1.2 m square, 0.6 m over its foot, `prop-green.ts`): solid, not drawn. */
export const ROOF_PLANTER_SOLIDS: readonly Piece[] = ROOF_PLANTERS.map((p) => piece(box(p.x - 0.6, p.x + 0.6, p.z - 0.6, p.z + 0.6, R - 0.05, R + 0.6), "machine", false));

const CHUNK = "krakowskie-2-1";

/**
 * The roof's crowd (ADR-0060): on the benches of the three pergolas (their seats, as the street
 * furniture's) and leaning on the atrium's balustrade, out of the ring's way.
 */
export const ROOF_CROWD: readonly CrowdSpot[] = [
  ...[0, 4, 6].flatMap((i, k) => {
    const b = ROOF_BENCHES[i]!;
    const seats = seatGroups({ prop: "bench", x: b.x, y: R, z: b.z, yaw: b.yaw, variant: b.variant })[0] ?? [];
    return seats.map((s): CrowdSpot => ({ chunk: CHUNK, at: { x: s.x, y: R, z: s.z }, yaw: s.yaw, does: s.does, group: `alchemia-roof:seat-${k}` }));
  }),
  { chunk: CHUNK, at: { x: 418.0, y: R, z: 50.62 }, yaw: Math.PI, does: ["lean", "phone"] },
  { chunk: CHUNK, at: { x: 425.62, y: R, z: 45.0 }, yaw: -Math.PI / 2, does: ["lean", "smoke"] },
];
