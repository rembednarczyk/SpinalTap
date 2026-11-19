import type { GroundVault } from "../../world/vault";
import type { NavGraph, Rect } from "../builders";
import { groundY } from "../lublin/terrain";
import { ALCHEMIA_DOOR_HEAD, METRO_ENTRANCES } from "../metro";
import { P1, P1_PIECES } from "./parking";
import { type Piece, box, piece } from "./plan";

/*
 * The door from metro B's hall down to P-1 (ADR-0074 stage 10, decision of 7.11). Entrance B by
 * Alchemia (Brama Krakowska station) has its hall 2.1 m over P-1's floor and its end wall 2.4 m off
 * P-1's east wall, the hall's middle facing the apron. The end wall opens over the hall's floor
 * (`EndDoorway.through`, the pavilion keeps its number of blocks); behind it eleven steps of 0.28 m
 * go west down under the terrain, the last three inside P-1 through an opening in its east wall.
 * Like a metro platform's passage it is a room in the ground (a `GroundVault`): the terrain over it
 * stays whole and nothing of it shows from the car park.
 */

const B = (() => {
  const e = METRO_ENTRANCES.find((m) => m.station === "kanal" && m.label === "B");
  if (!e || e.spot.along !== "x" || e.spot.opens !== 1 || !e.endDoor) throw new Error("metro B by Alchemia: no doorway facing P-1");
  return e;
})();

const W = P1.wall;
const RISERS = 12;
const TREAD = 0.28;

/** The passage: its west end at P-1's east wall, the end wall's outer and inner faces, its sides, the hall's and P-1's floors. */
export const METRO_DOOR = {
  wall: P1.maxX,
  outer: B.outline.minX,
  inner: B.cut.bounds.minX,
  minZ: B.cut.bounds.minZ,
  maxZ: B.cut.bounds.maxZ,
  hall: B.floor,
  floor: P1.floor,
  risers: RISERS,
  tread: TREAD,
  /** The underside of its ceiling: the doorway's head over the hall's floor. */
  ceiling: B.floor + ALCHEMIA_DOOR_HEAD,
} as const;

const RISE = (METRO_DOOR.hall - METRO_DOOR.floor) / RISERS;
/** The foot of the steps, inside P-1. */
export const METRO_DOOR_FOOT = METRO_DOOR.outer - (RISERS - 1) * TREAD;

/** The top of the slab over the passage: under the terrain everywhere over it, as a platform's. */
export const METRO_DOOR_TOP = (() => {
  let low = Infinity;
  for (let x = METRO_DOOR.wall; x <= METRO_DOOR.inner + 1e-6; x += 0.25)
    for (let z = METRO_DOOR.minZ - W; z <= METRO_DOOR.maxZ + W + 1e-6; z += 0.25) low = Math.min(low, groundY(x, z));
  return Math.round((low - 0.05) * 100) / 100;
})();

/** The steps' top at x (the hall's floor east of them, P-1's west of their foot). */
export const metroDoorStepY = (x: number): number => {
  if (x >= METRO_DOOR.outer) return METRO_DOOR.hall;
  const k = Math.min(RISERS, Math.floor((METRO_DOOR.outer - x) / TREAD) + 1);
  return METRO_DOOR.hall - k * RISE;
};

/** The passage's boxes: its steps, its side walls and ceiling over the gap, the wall over P-1's opening, the threshold drawn in the doorway. */
export const metroDoorPieces = (): Piece[] => {
  const d = METRO_DOOR;
  const base = d.floor - W;
  const out: Piece[] = [];
  for (let k = 1; k < RISERS; k++) out.push(piece(box(d.outer - k * TREAD, d.outer - (k - 1) * TREAD, d.minZ, d.maxZ, base, d.hall - k * RISE), "step", true));
  for (const [z0, z1] of [
    [d.minZ - W, d.minZ],
    [d.maxZ, d.maxZ + W],
  ] as const)
    out.push(piece(box(d.wall, d.outer, z0, z1, base, METRO_DOOR_TOP), "wall", true));
  out.push(piece(box(d.wall, d.outer, d.minZ - W, d.maxZ + W, d.ceiling, METRO_DOOR_TOP), "roof", true));
  // Over P-1's opening, from its ceiling's slab up to the passage's.
  out.push(piece(box(d.wall - W, d.wall, d.minZ, d.maxZ, P1.ceiling + P1.slab, METRO_DOOR_TOP), "wall", true));
  // The hall's floor runs on through the doorway (the pavilion's block); its face drawn here.
  out.push(piece(box(d.outer, d.inner, d.minZ, d.maxZ, d.hall - 0.05, d.hall), "floor", true, false));
  return out;
};

export const METRO_DOOR_PIECES: readonly Piece[] = metroDoorPieces();

/** The passage in the ground: from P-1's east wall to the hall's end wall, its walls inside. */
export const METRO_DOOR_VAULT: GroundVault = { bounds: { minX: METRO_DOOR.wall, maxX: METRO_DOOR.inner, minZ: METRO_DOOR.minZ - W, maxZ: METRO_DOOR.maxZ + W }, floor: METRO_DOOR.floor - 2 };

/** P-1's room over the steps: up to the passage's ceiling. */
export const METRO_DOOR_ROOM = { minX: METRO_DOOR_FOOT, maxX: METRO_DOOR.inner, minZ: METRO_DOOR.minZ, maxZ: METRO_DOOR.maxZ, bottom: METRO_DOOR.floor, top: METRO_DOOR.ceiling } as const;

/** The node in B's doorway (`metro-nav.ts`), on the passage's north side clear of the ticket machine. */
const B_END = "metro-kanal-B-end";

/** In P-1's level graph: a node at the steps' foot, on to the apron. */
export const METRO_DOOR_NAV: NavGraph = {
  nodes: [{ id: "alchemia-p1-metro-foot", at: { x: METRO_DOOR_FOOT - 0.8, y: METRO_DOOR.floor, z: METRO_DOOR.maxZ - 0.7 } }],
  edges: [{ a: "alchemia-p1-metro-foot", b: "alchemia-p1-apron" }],
};

/** The steps between the metro's graph and P-1's: merged into the world's graph with both. */
export const METRO_DOOR_LINK: NavGraph = {
  nodes: [],
  edges: [{ a: B_END, b: "alchemia-p1-metro-foot", via: { minX: METRO_DOOR_FOOT - 0.6, maxX: METRO_DOOR.inner, minZ: METRO_DOOR.minZ, maxZ: METRO_DOOR.maxZ } satisfies Rect }],
};

/** P-1's pieces with the passage's: what the car park's views draw. */
export const P1_ALL_PIECES: readonly Piece[] = [...P1_PIECES, ...METRO_DOOR_PIECES];
