import type { GroundPoint } from "@seki/core";
import type { Rect } from "../builders";
import { groundY } from "../lublin/terrain";
import { ARCADE_FRONT } from "./arcade-front";
import { EAST_WING, L1_LEVEL, L1_TOP, L2_SLABS, L2_TOP, L3, L3_TOP, WEST_WING, storeyCorners } from "./front";
import { FRONT_CEILINGS, FRONT_DOOR_TOP, FRONT_FLOORS, FRONT_GLASS, L1E_DOOR, L1_DOORS, L3_DOORS, STEP_GOING, STEP_RISE } from "./front-levels";
import { PLAZA_TOP } from "./front-plaza";
import { MALL } from "./mall-plan";
import { type Piece, box, outlined, piece } from "./plan";
import { type Corners, type Rectangle, cornerRadius, roundedOutline, wallStrip } from "./rounded";
import { OVER, SLAB, slabOf, storeyGlass } from "./storey";

/*
 * The front's storeys as rooms (ADR-0093 O5): their glass a wall 0.2 m deep round them (the gallery's,
 * drawn as its frame), open at their doors and where a storey meets the next bar of it or the gallery
 * (whose glass is the wall there, its doors into L2 and L3 in it, `mall.ts`); L1's level floors over
 * the slope with the steps at their doors; the patch of L3's floor where it overhangs L2. Pattern: the
 * mall's street wing on the storeys of its front, its arcades on the gallery's levels.
 */

const F = FRONT_FLOORS;
const [W1, W2] = WEST_WING as readonly [Rect, Rect];
const [A, B] = L2_SLABS as readonly [Rect, Rect];
/** The ground under the wings, a little under its lowest corner, as `front.ts`'s. */
const FOOT = -3;

/** A gap in a glass running along x at `z` (a door from `x0` to `x1`), or along z at `x`. */
const acrossZ = (s: { readonly x0: number; readonly x1: number }, z: number): Rectangle => ({ x0: s.x0, x1: s.x1, z0: z - 0.5, z1: z + 0.5 });
const acrossX = (x: number, s: { readonly z0: number; readonly z1: number }): Rectangle => ({ x0: x - 0.5, x1: x + 0.5, z0: s.z0, z1: s.z1 });

/** Over a door the glass on to the slab: its outer face on the storey's outline, which way out by the side. */
const lintel = (side: "n" | "s" | "e" | "w", a0: number, a1: number, at: number, floor: number, top: number): Piece => {
  const y0 = floor + FRONT_DOOR_TOP;
  const y1 = top - SLAB;
  const p = (x: number, z: number): GroundPoint => ({ x, z });
  if (side === "s") return wallStrip(p(a0, at), p(a1, at), FRONT_GLASS, y0, y1, "pane");
  if (side === "n") return wallStrip(p(a1, at), p(a0, at), FRONT_GLASS, y0, y1, "pane");
  if (side === "e") return wallStrip(p(at, a0), p(at, a1), FRONT_GLASS, y0, y1, "pane");
  return wallStrip(p(at, a1), p(at, a0), FRONT_GLASS, y0, y1, "pane");
};

/** The glass of every storey of the front, open at its doors, its joints and along the gallery. */
export const frontGlass = (): Piece[] => [
  // L1's west wing: its two bars joined along z 14, doors from the arcade, the passage and onto T0.
  ...storeyGlass(W1, F.l1 - 0.05, L1_TOP, FRONT_GLASS, storeyCorners(W1, L1_LEVEL), [
    { x0: W2.minX + FRONT_GLASS, x1: W1.maxX - 0.05, z0: W1.maxZ - 0.4, z1: W1.maxZ + 0.4 },
    acrossZ(L1_DOORS.arcade, W1.minZ),
    acrossX(W1.maxX, L1_DOORS.east),
  ]),
  ...storeyGlass(W2, F.l1 - 0.05, L1_TOP, FRONT_GLASS, storeyCorners(W2, L1_LEVEL), [{ x0: W2.minX + 0.05, x1: W2.maxX - 0.05, z0: W2.minZ - 0.4, z1: W2.minZ + 0.4 }, acrossZ(L1_DOORS.north, W2.maxZ)]),
  lintel("s", L1_DOORS.arcade.x0, L1_DOORS.arcade.x1, W1.minZ, F.l1, L1_TOP),
  lintel("e", L1_DOORS.east.z0, L1_DOORS.east.z1, W1.maxX, F.l1, L1_TOP),
  lintel("n", L1_DOORS.north.x0, L1_DOORS.north.x1, W2.maxZ, F.l1, L1_TOP),
  // L1's east wing: its unit's door onto the walk to Lubartowska.
  ...storeyGlass(EAST_WING, F.l1e - 0.05, L1_TOP, FRONT_GLASS, storeyCorners(EAST_WING, L1_LEVEL), [acrossX(EAST_WING.maxX, L1E_DOOR)]),
  lintel("e", L1E_DOOR.z0, L1E_DOOR.z1, EAST_WING.maxX, F.l1e, L1_TOP),
  // L2: the gallery's glass its wall along z 32, its two bars joined along x 422 (the corner at z 13.5 closed by the west one's),
  // the house with arcades' back its wall behind its upper storey.
  ...storeyGlass(A, F.l2 - 0.05, L2_TOP, FRONT_GLASS, storeyCorners(A, L2_SLABS), [
    { x0: MALL.x0, x1: A.maxX + 0.5, z0: MALL.z0 - 0.5, z1: MALL.z0 + 0.5 },
    { x0: A.maxX - 0.5, x1: A.maxX + 0.5, z0: B.minZ + FRONT_GLASS + 0.05, z1: A.maxZ + 0.5 },
    { x0: A.minX + cornerRadius(slabOf(A)) - OVER, x1: ARCADE_FRONT.maxX + 0.3, z0: A.minZ - 0.5, z1: A.minZ + 0.5 },
  ]),
  ...storeyGlass(B, F.l2 - 0.05, L2_TOP, FRONT_GLASS, storeyCorners(B, L2_SLABS), [
    { x0: B.minX - 0.5, x1: B.maxX - 0.05, z0: MALL.z0 - 0.5, z1: MALL.z0 + 0.5 },
    { x0: B.minX - 0.5, x1: B.minX + 0.5, z0: B.minZ + 0.05, z1: B.maxZ + 0.5 },
  ]),
  // L3: the gallery's glass its wall along z 32, its doors out onto L2's terraces south and east.
  ...storeyGlass(L3, F.l3 - 0.05, L3_TOP, FRONT_GLASS, storeyCorners(L3), [
    { x0: MALL.x0, x1: L3.maxX - 0.05, z0: MALL.z0 - 0.5, z1: MALL.z0 + 0.5 },
    acrossZ(L3_DOORS.south, L3.minZ),
    acrossX(L3.maxX, L3_DOORS.east),
  ]),
  lintel("s", L3_DOORS.south.x0, L3_DOORS.south.x1, L3.minZ, F.l3, L3_TOP),
  lintel("e", L3_DOORS.east.z0, L3_DOORS.east.z1, L3.maxX, F.l3, L3_TOP),
];

/** The house with arcades' back wall behind its upper storey, L2's south wall there (the café's, `front-rooms.ts`). */
export const ARCADE_BACK: Rectangle = { x0: A.minX + cornerRadius(slabOf(A)) - OVER, x1: ARCADE_FRONT.maxX + 0.3, z0: A.minZ, z1: A.minZ + FRONT_GLASS };
const arcadeBack = (): Piece => piece(box(ARCADE_BACK.x0, ARCADE_BACK.x1, ARCADE_BACK.z0, ARCADE_BACK.z1, F.l2 - 0.05, L2_TOP - SLAB), "plaster", false);

/** A wing's level floor: its glass's outline from the ground under it up to the floor (a plinth seen through the glass's foot). */
const floorOf = (r: Rect, level: readonly Rect[], y: number): Piece => {
  const corners: Corners = storeyCorners(r, level);
  return outlined(roundedOutline(slabOf(r), -OVER, corners, undefined, cornerRadius(slabOf(r))), FOOT, y, "floor");
};

/**
 * L3's floor where it overhangs L2's slab (x 422-428, z 12-13.7, L2's east bar starting at z 13.5): a
 * piece of slab under its rounded south-east corner, concentric with its glass.
 */
const l3Patch = (): Piece => {
  const r = cornerRadius(slabOf(L3)) - OVER;
  return outlined(roundedOutline({ x0: A.maxX - 0.1, x1: L3.maxX, z0: L3.minZ, z1: L3.minZ + r }, 0, [true, false, false, false], undefined, r), F.l3 - SLAB, F.l3, "roof");
};

/** A flight of `n` risers from a floor at `top` down to the ground `n` risers under it, outwards along +x or +z from `from`, `a0`..`a1` across. */
const flight = (along: "x" | "z", from: number, a0: number, a1: number, top: number, ground: number, inside: boolean, cheeks: boolean): Piece[] => {
  const n = Math.max(1, Math.round((top - ground) / STEP_RISE));
  const rise = (top - ground) / n;
  const out: Piece[] = [];
  for (let k = 1; k < n; k++) {
    const [s0, s1] = [from + (k - 1) * STEP_GOING, from + k * STEP_GOING];
    const y = top - k * rise;
    out.push(piece(along === "x" ? box(s0, s1, a0, a1, FOOT, y) : box(a0, a1, s0, s1, FOOT, y), "step", inside));
    // Cheek walls a hand over the treads either side where the flight stands high (over 0.5 m).
    if (cheeks && y - ground > 0.5) {
      for (const [c0, c1] of [[a0 - 0.15, a0], [a1, a1 + 0.15]] as const) out.push(piece(along === "x" ? box(s0, s1, c0, c1, FOOT, y + 0.95) : box(c0, c1, s0, s1, FOOT, y + 0.95), "parapet", inside));
    }
  }
  return out;
};

/** The ground under a flight's foot: the lowest of the terrain across it a step past its last tread. */
const footGround = (along: "x" | "z", at: number, a0: number, a1: number): number => Math.min(...[a0, (a0 + a1) / 2, a1].map((a) => (along === "x" ? groundY(at, a) : groundY(a, at))));

/** The steps at L1's doors: down from the arcade's podium inside the west wing, up from the ground outside its east and north doors and the east wing's door. */
const steps = (): Piece[] => {
  const d = L1_DOORS;
  // Inside the arcade's door: a landing level with the podium in the glass's depth, then down to the floor.
  const landing = 0.45;
  const inner = flight("z", W1.minZ + landing, d.arcade.x0, d.arcade.x1, PLAZA_TOP, F.l1, true, false);
  return [
    piece(box(d.arcade.x0, d.arcade.x1, W1.minZ, W1.minZ + landing, F.l1 - 0.05, PLAZA_TOP), "step", true),
    ...inner,
    ...flight("x", W1.maxX, d.east.z0, d.east.z1, F.l1, footGround("x", W1.maxX + 0.9, d.east.z0, d.east.z1), false, true),
    ...flight("z", W2.maxZ, d.north.x0, d.north.x1, F.l1, footGround("z", W2.maxZ + 2.1, d.north.x0, d.north.x1), false, true),
    ...flight("x", EAST_WING.maxX, L1E_DOOR.z0, L1E_DOOR.z1, F.l1e, footGround("x", EAST_WING.maxX + 0.6, L1E_DOOR.z0, L1E_DOOR.z1), false, true),
  ];
};

/** The front's shell drawn from afar with the storeys: the glass, the house with arcades' back wall, the wings' floors, L3's patch, the steps outside. */
export const frontShellPieces = (): Piece[] => [
  ...frontGlass(),
  arcadeBack(),
  ...WEST_WING.map((r) => floorOf(r, L1_LEVEL, F.l1)),
  floorOf(EAST_WING, L1_LEVEL, F.l1e),
  l3Patch(),
  ...steps().filter((p) => !p.inside),
];

/** Inside: the steps down from the arcade's door (drawn near). */
export const frontShellInsidePieces = (): Piece[] => steps().filter((p) => p.inside);


type Room = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number; readonly bottom: number; readonly top: number };
const room = (minX: number, maxX: number, minZ: number, maxZ: number, bottom: number, top: number): Room => ({ minX, maxX, minZ, maxZ, bottom, top });

/**
 * The front's storeys as rooms of the gallery's interior (ADR-0061): inside the glass, from the floor to
 * the ceiling, each storey a cross of rectangles past its rounded corners (as the gallery's, `mall-plan.ts`).
 */
export const FRONT_ROOMS: readonly Room[] = (() => {
  const [c1, c2, c2e, c3] = [FRONT_CEILINGS.l1, FRONT_CEILINGS.l2, FRONT_CEILINGS.l1e, FRONT_CEILINGS.l3];
  return [
    // L1's west wing: its south bar past its three rounded corners, its north bar past its two.
    room(394.2, 403.8, 2.7, 12.3, F.l1, c1),
    room(395.7, 402.3, 1.2, 13.8, F.l1, c1),
    room(396.2, 403.8, 13.8, 25.8, F.l1, c1),
    room(397.7, 402.3, 25.8, 27.3, F.l1, c1),
    // L1's east wing.
    room(427.9, 435.8, 15.2, 20.8, F.l1e, c2e),
    room(429.4, 434.3, 13.7, 22.3, F.l1e, c2e),
    // L2: its west bar past its three rounded corners, its east one past its south-east one.
    room(394.2, 421.8, 5.7, 30.3, F.l2, c2),
    room(395.7, 420.3, 4.2, 31.8, F.l2, c2),
    room(421.8, 435.8, 15.2, 31.8, F.l2, c2),
    room(421.8, 434.3, 13.7, 15.2, F.l2, c2),
    // L3: past its rounded corners but the north-east one, against the gallery.
    room(398.2, 427.8, 13.7, 30.3, F.l3, c3),
    room(399.7, 427.8, 30.3, 31.8, F.l3, c3),
    room(399.7, 426.3, 12.2, 13.7, F.l3, c3),
  ];
})();
