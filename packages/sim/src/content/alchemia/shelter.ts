import type { GroundCut } from "../../world/ground";
import type { GroundVault } from "../../world/vault";
import type { DoorDef, Rect } from "../builders";
import { P2, P2_CORRIDOR, P2_SHELTER_GATE } from "./p2";
import { T2 } from "./plaza";
import { type Piece, box, piece } from "./plan";

/**
 * The air-raid shelter under T2 (ADR-0074 §4 and §5, stage 5d1): the archaeologists' find under the
 * site (S13), kept in 2077 as a room of its own by the north end of P-2, an exhibit in it. Its floor
 * three metres under T2's (-12.2), its ceiling's slab under T2's ground. Two ways in: the steel gate
 * in P-2's corridor's east wall, a flight down north behind it and a low passage on to the room's
 * south-west corner; and the hatch on T2 east of the room, a flight down west from it in a shaft
 * open to the sky (a `GroundCut`) into the room's east wall. The room and its way to the gate are
 * vaults (`GroundVault`): the terrain and T2's paving whole over them. Hebi's stash comes into it in
 * stage 5d2; its north-west corner is kept for it.
 */

/** Its walls' thickness. */
const W = 0.2;
/** The room's floor, ceiling (its underside) and its slab's top. */
const F = -12.2;
const C = F + 2.3;
const SLAB = C + 0.3;
const BASE = F - 0.3;
/** P-2's floor and its corridor's ceiling's slab, where the gate's flight starts. */
const F2 = P2.floor;
const SLAB2 = P2.slab;
const C2 = P2.ceiling;

/** The room (outer faces), its floor, ceiling and its slab's top. */
export const SHELTER = { minX: 420.4, maxX: 435.0, minZ: 84.0, maxZ: 97.0, wall: W, floor: F, ceiling: C, slab: SLAB } as const;

/** One step of either flight: its rise (3 m in 17) and goings. */
export const SHELTER_RISERS = 17;
export const SHELTER_RISE = (F2 - F) / SHELTER_RISERS;

/**
 * The flight from the gate (outer faces): east of the corridor's wall, from a landing level with
 * P-2's floor behind the gate north down to the passage. Under T1's ground (-6.4) its ceiling is
 * P-2's corridor's.
 */
export const SHELTER_GATE_STAIR = { minX: P2_CORRIDOR.maxX, maxX: 423.0, minZ: 68.6, landing: 70.8, going: 0.28 } as const;
/** The north end of its last tread: the passage's floor on from there. */
export const SHELTER_STAIR_FOOT = SHELTER_GATE_STAIR.landing + (SHELTER_RISERS - 1) * SHELTER_GATE_STAIR.going;
/** Where the flight's ceiling (P-2's) steps down to the passage's (the room's). */
const HEADER_Z = 75.9;
/** The passage on north to the room (outer faces). */
export const SHELTER_PASSAGE = { minX: SHELTER_GATE_STAIR.minX, maxX: SHELTER_GATE_STAIR.maxX, minZ: HEADER_Z, maxZ: SHELTER.minZ } as const;

/**
 * The hatch's shaft (outer faces) east of the room: a landing level with T2's ground at its east
 * end, where the hatch opens, and a flight down west to a strip of the room's floor (`foot`) by its
 * east wall: a body at the flight's foot clears the wall over the opening. Its side walls stand a
 * railing's height over T2; the hatch's leaf stands open by its north side.
 */
export const SHELTER_HATCH = { minX: SHELTER.maxX, maxX: 441.4, minZ: 95.0, maxZ: 96.8, foot: 436.0, going: 0.26, rail: 1.0 } as const;
/** The east end of the hatch's last tread: the landing under the hatch from there. */
export const SHELTER_HATCH_HEAD = SHELTER_HATCH.foot + (SHELTER_RISERS - 1) * SHELTER_HATCH.going;

/**
 * The steel gate in P-2's corridor's east wall, Hebi's (stage 5d2): it opens for them; for the
 * player only on a retrieval, with the code or forced at its panel on the corridor's side (ADR-0082's
 * coded doors). Otherwise the way in is the hatch on T2.
 */
export const SHELTER_GATE: DoorDef = {
  key: "alchemia-shelter-gate",
  at: { x: P2_CORRIDOR.maxX - P2.wall / 2, y: F2, z: (P2_SHELTER_GATE.z0 + P2_SHELTER_GATE.z1) / 2 },
  along: "z",
  width: P2_SHELTER_GATE.z1 - P2_SHELTER_GATE.z0,
  height: P2_SHELTER_GATE.top,
  leaves: 1,
  dir: -1,
  material: "metal",
  lock: { kind: "code", staff: "hebi", during: "retrieve" },
  panel: { x: P2_CORRIDOR.maxX - P2.wall - 0.08, y: F2 + 1.3, z: P2_SHELTER_GATE.z1 + 0.5 },
};

/** The top of the step under z on the gate's flight: P-2's floor on its landing, the room's past its foot. */
export const shelterGateStairY = (z: number): number => {
  const s = SHELTER_GATE_STAIR;
  if (z < s.landing) return F2;
  if (z >= SHELTER_STAIR_FOOT) return F;
  return F2 - (Math.floor((z - s.landing) / s.going) + 1) * SHELTER_RISE;
};

/** The top of the step under x on the hatch's flight: the room's floor west of it, T2's on the landing. */
export const shelterHatchStairY = (x: number): number => {
  const h = SHELTER_HATCH;
  if (x < h.foot) return F;
  if (x >= SHELTER_HATCH_HEAD) return T2;
  return F + (Math.floor((x - h.foot) / h.going) + 1) * SHELTER_RISE;
};

/** The hatch's shaft dug out of T2. */
export const SHELTER_HATCH_CUT: GroundCut = { bounds: { minX: SHELTER_HATCH.minX, maxX: SHELTER_HATCH.maxX, minZ: SHELTER_HATCH.minZ, maxZ: SHELTER_HATCH.maxZ }, floor: F - 1 };

/** The room and its way to the gate in the ground, their ground 2 m under the room's floor. */
export const SHELTER_VAULTS: readonly GroundVault[] = [
  { bounds: { minX: SHELTER_GATE_STAIR.minX, maxX: SHELTER_GATE_STAIR.maxX, minZ: SHELTER_GATE_STAIR.minZ, maxZ: SHELTER.minZ }, floor: F - 2 },
  { bounds: { minX: SHELTER.minX, maxX: SHELTER.maxX, minZ: SHELTER.minZ, maxZ: SHELTER.maxZ }, floor: F - 2 },
];

/** The shelter as an interior of ADR-0061: its room, the passage, the gate's flight and the hatch's. */
export const SHELTER_ROOMS: readonly (Rect & { readonly bottom: number; readonly top: number })[] = [
  { minX: SHELTER.minX + W, maxX: SHELTER.maxX - W, minZ: SHELTER.minZ + W, maxZ: SHELTER.maxZ - W, bottom: F, top: C },
  { minX: SHELTER_PASSAGE.minX + W, maxX: SHELTER_PASSAGE.maxX - W, minZ: SHELTER_PASSAGE.minZ, maxZ: SHELTER.minZ + W, bottom: F, top: C },
  { minX: SHELTER_GATE_STAIR.minX + W, maxX: SHELTER_GATE_STAIR.maxX - W, minZ: SHELTER_GATE_STAIR.minZ + W, maxZ: HEADER_Z, bottom: F, top: C2 },
  { minX: SHELTER_HATCH.minX, maxX: SHELTER_HATCH_HEAD, minZ: SHELTER_HATCH.minZ + W, maxZ: SHELTER_HATCH.maxZ - W, bottom: F, top: T2 - 0.2 },
];

const floor = (x0: number, x1: number, z0: number, z1: number): Piece => piece(box(x0, x1, z0, z1, BASE, F), "floor", true);
const wall = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): Piece => piece(box(x0, x1, z0, z1, y0, y1), "wall", true);

/** The gate's flight: its landing and treads, its walls (the west one round the gate) and ceiling, the header over the passage. */
const gateStairPieces = (): Piece[] => {
  const s = SHELTER_GATE_STAIR;
  const g = P2_SHELTER_GATE;
  const out: Piece[] = [piece(box(s.minX + W, s.maxX - W, s.minZ + W, s.landing, BASE, F2), "step", true)];
  for (let k = 1; k < SHELTER_RISERS; k++) {
    const z0 = s.landing + (k - 1) * s.going;
    out.push(piece(box(s.minX + W, s.maxX - W, z0, z0 + s.going, BASE, F2 - k * SHELTER_RISE), "step", true));
  }
  out.push(
    wall(s.minX, s.minX + W, s.minZ, g.z0, BASE, SLAB2),
    wall(s.minX, s.minX + W, g.z1, HEADER_Z, BASE, SLAB2),
    wall(s.minX, s.minX + W, g.z0, g.z1, F2 + g.top, SLAB2),
    wall(s.minX, s.minX + W, g.z0, g.z1, BASE, F2),
    wall(s.maxX - W, s.maxX, s.minZ, HEADER_Z, BASE, SLAB2),
    wall(s.minX + W, s.maxX - W, s.minZ, s.minZ + W, BASE, SLAB2),
    piece(box(s.minX, s.maxX, s.minZ, HEADER_Z, C2, SLAB2), "roof", true),
    wall(s.minX + W, s.maxX - W, HEADER_Z - W, HEADER_Z, C, C2),
  );
  return out;
};

/** The passage on to the room: its floor, walls and ceiling. */
const passagePieces = (): Piece[] => {
  const p = SHELTER_PASSAGE;
  return [
    floor(p.minX, p.maxX, SHELTER_STAIR_FOOT, p.maxZ),
    wall(p.minX, p.minX + W, p.minZ, p.maxZ, BASE, SLAB),
    wall(p.maxX - W, p.maxX, p.minZ, p.maxZ, BASE, SLAB),
    piece(box(p.minX, p.maxX, p.minZ, p.maxZ, C, SLAB), "roof", true),
  ];
};

/** The room: its floor and ceiling, its walls open to the passage in its south-west corner and to the hatch's flight in its east wall. */
const roomPieces = (): Piece[] => {
  const r = SHELTER;
  const p = SHELTER_PASSAGE;
  const h = SHELTER_HATCH;
  return [
    floor(r.minX, r.maxX, r.minZ, r.maxZ),
    piece(box(r.minX, r.maxX, r.minZ, r.maxZ, C, SLAB), "roof", true),
    wall(r.minX, r.minX + W, r.minZ, r.maxZ, BASE, SLAB),
    wall(r.minX + W, r.maxX, r.maxZ - W, r.maxZ, BASE, SLAB),
    wall(p.maxX - W, r.maxX, r.minZ, r.minZ + W, BASE, SLAB),
    wall(r.maxX - W, r.maxX, r.minZ + W, h.minZ + W, BASE, SLAB),
    wall(r.maxX - W, r.maxX, h.maxZ - W, r.maxZ - W, BASE, SLAB),
  ];
};

/**
 * The exhibit and the shelter's own things: the wartime benches along its south and north walls,
 * two columns under its slab, glass cases with the finds in its middle, panels of photographs on its
 * west wall, the hand-cranked fan in its south-east corner, the emergency lamps (§6: weak light).
 */
const exhibitPieces = (): Piece[] => {
  const r = SHELTER;
  const out: Piece[] = [
    piece(box(424.0, r.maxX - W - 1.6, r.minZ + W, r.minZ + W + 0.4, F, F + 0.45), "bench", true),
    piece(box(425.0, 431.0, r.maxZ - W - 0.4, r.maxZ - W, F, F + 0.45), "bench", true),
    piece(box(r.maxX - W - 1.2, r.maxX - W, r.minZ + W, r.minZ + W + 1.0, F, F + 1.4), "machine", true),
  ];
  for (const z of [87.0, 91.8]) out.push(piece(box(427.4, 427.8, z - 0.2, z + 0.2, F, C), "column", true));
  for (const x of [424.5, 429.0]) {
    out.push(piece(box(x, x + 2.0, 88.6, 89.6, F, F + 0.85), "counter", true), piece(box(x + 0.05, x + 1.95, 88.65, 89.55, F + 0.85, F + 1.25), "vitrine", true));
  }
  for (const z of [86.6, 89.0, 91.4]) out.push(piece(box(r.minX + W, r.minX + W + 0.05, z, z + 1.8, F + 0.9, F + 1.9), "screen", true, false));
  for (const [x, z] of [[424, r.minZ + W], [431, r.minZ + W], [424, r.maxZ - W - 0.06], [431, r.maxZ - W - 0.06]] as const) {
    out.push(piece(box(x, x + 0.4, z, z + 0.06, C - 0.35, C - 0.2), "beacon", true, false));
  }
  return out;
};

/** The hatch's shaft: its treads and landing, its walls up to a railing over T2, the leaf standing open, a lamp over the hatch. */
const hatchPieces = (): Piece[] => {
  const h = SHELTER_HATCH;
  const top = T2 + h.rail;
  const out: Piece[] = [piece(box(h.minX, h.foot, h.minZ + W, h.maxZ - W, BASE, F), "floor", false)];
  for (let k = 1; k < SHELTER_RISERS; k++) {
    const x0 = h.foot + (k - 1) * h.going;
    out.push(piece(box(x0, x0 + h.going, h.minZ + W, h.maxZ - W, BASE, F + k * SHELTER_RISE), "step", false));
  }
  out.push(
    piece(box(SHELTER_HATCH_HEAD, h.maxX - W, h.minZ + W, h.maxZ - W, BASE, T2), "step", false),
    piece(box(h.minX, h.maxX, h.minZ, h.minZ + W, BASE, top), "parapet", false),
    piece(box(h.minX, h.maxX, h.maxZ - W, h.maxZ, BASE, top), "parapet", false),
    // Over the room's opening up to the railing; the east end under the landing, open over T2.
    piece(box(h.minX, h.minX + W, h.minZ + W, h.maxZ - W, C, top), "parapet", false),
    piece(box(h.maxX - W, h.maxX, h.minZ + W, h.maxZ - W, BASE, T2), "wall", false),
    piece(box(SHELTER_HATCH_HEAD + 0.1, h.maxX - W, h.maxZ, h.maxZ + 0.08, T2, T2 + 1.1), "shutter", false),
    piece(box(h.maxX - 0.5, h.maxX - 0.1, h.minZ + 0.05, h.minZ + 0.15, top, top + 0.12), "beacon", false, false),
  );
  return out;
};

/** The shelter under the ground (the room, the passage, the gate's flight, the exhibit): drawn near only, with P-2. */
export const SHELTER_PIECES: readonly Piece[] = [...gateStairPieces(), ...passagePieces(), ...roomPieces(), ...exhibitPieces()];
/** The hatch's shaft: Alchemia's outside, seen from T2 into it. */
export const SHELTER_HATCH_PIECES: readonly Piece[] = hatchPieces();
