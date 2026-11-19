import type { GroundPoint } from "@seki/core";
import { FRONT_SIGN, L1_LEVEL, L1_TOP, L2_SLABS, L2_TOP, L3, L3_TOP, frontPieces } from "./front";
import { type Piece, box, outlined, piece } from "./plan";
import { type Corners, type Rectangle, ALL_CORNERS, outerCorners, roundedOutline } from "./rounded";
import { B_RADIUS, TIER_A, TIER_B, slabOf } from "./tiers";
import { ARCADE_FRONT } from "./arcade-front";
import type { Rect } from "../builders";

/*
 * The board's green on Alchemia (C2 of the board 1:1, 19.11): curtains of green hanging over every
 * storey's open edge, shrubs along the front's roofs inside their balustrades, trees on the corners
 * of L1's east wing and L3's roof. Drawn only: the curtains hang in the air outside the slabs, and
 * nobody walks the front's roofs. Placed by rule along the storeys' rounded outlines, what grows
 * where fixed by a hash of the place (no list of positions, no randomness).
 */

/** A storey for the green: its glass's rectangle, its glass's bottom and its slab's top, its rounded corners and their radius. */
interface Storey {
  readonly r: Rect;
  readonly bottom: number;
  readonly top: number;
  readonly corners: Corners;
  readonly radius?: number;
  /** The front's roofs, nobody on them: shrubs along their balustrades. */
  readonly shrubs: boolean;
  /** No curtains over its edges (the house with arcades: its windows and letters under its cornice). */
  readonly bare?: boolean;
}

const rect = (r: Rect): Rectangle => ({ x0: r.minX, x1: r.maxX, z0: r.minZ, z1: r.maxZ });
const SLAB = 0.3;
/** The slab's edge beam under it (the engine draws it, `storey-facade.ts`). */
const BEAM = 0.32;

const STOREYS: readonly Storey[] = [
  ...L1_LEVEL.map((r): Storey => ({ r, bottom: -3, top: L1_TOP, corners: outerCorners(rect(r), L1_LEVEL.map(rect)), shrubs: true })),
  ...L2_SLABS.map((r): Storey => ({ r, bottom: L1_TOP, top: L2_TOP, corners: outerCorners(rect(r), L2_SLABS.map(rect)), shrubs: true })),
  { r: L3, bottom: L2_TOP, top: L3_TOP, corners: ALL_CORNERS, shrubs: true },
  { r: TIER_A, bottom: TIER_A.bottom, top: TIER_A.top, corners: ALL_CORNERS, shrubs: false },
  { r: TIER_B, bottom: TIER_B.bottom, top: TIER_B.top, corners: ALL_CORNERS, radius: B_RADIUS, shrubs: false },
  // The house with arcades (C3): square, its roof a terrace with L2's.
  { r: ARCADE_FRONT, bottom: -3, top: ARCADE_FRONT.top, corners: [false, false, false, false], shrubs: true, bare: true },
];

/** Is (x, y, z) in a storey's volume, its slab included (another storey hides what is there)? */
const inStorey = (x: number, y: number, z: number, not?: Storey): boolean =>
  STOREYS.some((s) => {
    if (s === not) return false;
    const b = slabOf(s.r);
    return x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y > s.bottom && y < s.top + 0.2;
  });

/** What the green keeps clear of: the screens, the sign, the masts' feet. */
const CLEAR = [...frontPieces().filter((p) => p.kind === "screen" || p.kind === "sign").map((p) => p.box), FRONT_SIGN];
const clear = (x: number, z: number, y0: number, y1: number): boolean =>
  !CLEAR.some((b) => x > b.x0 - 0.6 && x < b.x1 + 0.6 && z > b.z0 - 0.6 && z < b.z1 + 0.6 && y1 > b.y0 - 0.3 && y0 < b.y1 + 0.3);

/** A cheap hash of a place: how long a curtain hangs, how tall a shrub grows. */
const hash = (x: number, z: number): number => {
  const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return h - Math.floor(h);
};

/** The curtains' pitch along an edge, how wide one is, how thick, how far out of the slab's edge. */
const CURTAIN_EVERY = 3.2;
const CURTAIN = 1.3;
const CURTAIN_THICK = 0.12;
const CURTAIN_OUT = 0.08;

/** Points along an outline every `every` metres, with the edge's direction and its outward normal. */
const along = (pts: readonly GroundPoint[], every: number): { p: GroundPoint; t: GroundPoint; n: GroundPoint }[] => {
  const out: { p: GroundPoint; t: GroundPoint; n: GroundPoint }[] = [];
  let carry = every / 2;
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-6) return;
    const t = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
    const n = { x: t.z, z: -t.x };
    let s = carry;
    for (; s < len; s += every) out.push({ p: { x: a.x + t.x * s, z: a.z + t.z * s }, t, n });
    carry = s - len;
  });
  return out;
};

/** The curtains of green over a storey's open edges, under its slab's beam and a hand over its top. */
const curtains = (s: Storey): Piece[] => {
  if (s.bare) return [];
  const pts = roundedOutline(slabOf(s.r), CURTAIN_OUT, s.corners, undefined, s.radius);
  const under = s.top - SLAB - BEAM;
  return along(pts, CURTAIN_EVERY).flatMap(({ p, t, n }) => {
    const h = hash(p.x, p.z);
    if (h < 0.18) return [];
    const drop = 0.6 + h * 1.2;
    const y1 = s.top + 0.15;
    const w = CURTAIN * (0.7 + 0.6 * hash(p.z, p.x));
    const q = { x: p.x + t.x * w, z: p.z + t.z * w };
    const y0 = Math.max(s.bottom + 0.5, under - drop);
    // Open edge only, all along it: nothing of another storey out of it under the slab, nor round its top.
    const open = [0, 0.5, 1].every((k) => {
      const [x, z] = [p.x + (q.x - p.x) * k, p.z + (q.z - p.z) * k];
      return !inStorey(x + n.x * 0.5, under - 0.5, z + n.z * 0.5, s) && !inStorey(x, s.top - 0.1, z, s) && clear(x, z, y0, y1);
    });
    if (!open) return [];
    // Two strands of uneven length, the board's ragged green, each counter-clockwise: its outside first.
    const strand = (a: GroundPoint, b: GroundPoint, bottom: number): Piece =>
      outlined([{ x: a.x + n.x * CURTAIN_THICK, z: a.z + n.z * CURTAIN_THICK }, { x: b.x + n.x * CURTAIN_THICK, z: b.z + n.z * CURTAIN_THICK }, b, a], bottom, y1, "green", false);
    const m = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 };
    return [strand(p, m, y0), strand(m, q, Math.min(under - 0.3, y0 + drop * (0.3 + 0.4 * hash(q.x, q.z))))];
  });
};

/** Shrubs along a front roof's balustrade, a step inside it, where no storey stands over the roof. */
const shrubs = (s: Storey): Piece[] => {
  if (!s.shrubs) return [];
  const pts = roundedOutline(slabOf(s.r), -0.75, s.corners, undefined, s.radius);
  return along(pts, 2.2).flatMap(({ p }) => {
    const h = hash(p.x + 0.5, p.z - 0.5);
    const tall = 0.55 + h * 0.5;
    if (h < 0.15 || inStorey(p.x, s.top + 0.5, p.z, s) || !clear(p.x, p.z, s.top, s.top + tall)) return [];
    const w = 0.45 + h * 0.25;
    return [piece(box(p.x - w, p.x + w, p.z - w, p.z + w, s.top, s.top + tall), "green", false, false)];
  });
};

/** A tree in a planter on a roof: trunk and two tiers of crown. */
const tree = (x: number, z: number, y: number, size: number): Piece[] => [
  piece(box(x - 0.6, x + 0.6, z - 0.6, z + 0.6, y, y + 0.6), "green", false, false),
  piece(box(x - 0.1, x + 0.1, z - 0.1, z + 0.1, y + 0.6, y + 1.6 * size), "frame", false, false),
  piece(box(x - 1.2 * size, x + 1.2 * size, z - 1.2 * size, z + 1.2 * size, y + 1.4 * size, y + 2.4 * size), "green", false, false),
  piece(box(x - 0.75 * size, x + 0.75 * size, z - 0.75 * size, z + 0.75 * size, y + 2.4 * size, y + 3.0 * size), "green", false, false),
];

/** The board's trees on the roofs' corners: L1's east wing (its front corners), L3's roof (its back corners, clear of the umbrellas). */
const roofTrees = (): Piece[] => {
  const e = L1_LEVEL[L1_LEVEL.length - 1]!;
  return [
    ...tree(e.minX + 2, e.minZ + 1.8, L1_TOP, 1),
    ...tree(e.maxX - 2, e.minZ + 1.8, L1_TOP, 1.1),
    ...tree(L3.minX + 2.5, L3.maxZ - 3, L3_TOP, 1.2),
    ...tree(L3.maxX - 2.5, L3.maxZ - 3, L3_TOP, 1),
  ];
};

/** All of the green, drawn with the storeys. */
export const frontGreenPieces = (): Piece[] => [...STOREYS.flatMap(curtains), ...STOREYS.flatMap(shrubs), ...roofTrees()];
