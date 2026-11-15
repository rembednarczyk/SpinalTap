import { type DoorDef, type StaticProp, crate, ladderParts, neon, placeProps, stairRail, stairs, v } from "../builders";
import { doorParts } from "../doors";
import { DOOR_TOP } from "../interiors";
import { groundY } from "../lublin/terrain";
import { W3_BRIDGE_Z } from "./hall";
import { box, railing, slabTop } from "./parts";
import { W3_PIPES, W3_PLATFORM, W3_ROOF, W3_ROW_N, W3_TOWER, W3_TRESTLES, W3_Y, w3 } from "./site";

/**
 * The control tower and the pipeline over the river (ADR-0082 stage 1, P8, P10).
 *
 * The tower (x 2486..2496, z 436..446): the pass office on the ground floor (the infiltration's
 * site, door on the east face onto the gap by the hall, on the code from the hook), its lower part
 * up to the platform at +10, the shaft, the cabin of red glass at +24..+28, the roof at +28.6 and
 * the masts. A steel stair runs up its south face from the zone to the platform (NPCs too, through
 * `W3_NAV`); the platform joins the pipe walk on the west and a bridge onto row N's roof on the east.
 *
 * The pipeline (x 2442..2486, z 442..444): a bundle of pipes beside a service walk at +10 a metre
 * wide, on trestles on the west bank, in the river and by the tower; a ladder up the west trestle
 * from the riverside path (the player's, ADR-0021).
 */

const T = W3_TOWER;
const P = W3_PLATFORM;
/** The office's walls, and the ceiling under the tower's lower part. */
const OFFICE_TOP = 4;
const WALL = 0.3;
/** The platform's edges over the shore and the river: higher than a jump (the fence is the tower's north face). */
const OUTER_RAIL = 1.9;

/** The office door on the east face, opening z 442..444, on the code from the hook (ADR-0038). */
export const W3_OFFICE_DOOR: DoorDef = {
  key: "door:tessen-office",
  at: w3(T.maxX - WALL / 2, 0, 443),
  along: "z",
  width: 2,
  height: DOOR_TOP,
  leaves: 2,
  lock: { kind: "code", staff: "tessen", during: "infiltrate" },
  panel: w3(T.maxX + 0.21, 1.3, 444.6),
};

/** The pass office: inside the tower's walls, under its ceiling. */
export const W3_OFFICE = { minX: T.minX + WALL, maxX: T.maxX - WALL, minZ: T.minZ + WALL, maxZ: T.maxZ - WALL, top: OFFICE_TOP } as const;

const office = (): StaticProp[] => [
  box(T.minX, T.minX + WALL, 0, OFFICE_TOP, T.minZ, T.maxZ, "concrete"),
  box(T.minX + WALL, T.maxX, 0, OFFICE_TOP, T.maxZ - WALL, T.maxZ, "concrete"),
  box(T.minX + WALL, T.maxX, 0, OFFICE_TOP, T.minZ, T.minZ + WALL, "concrete"),
  box(T.maxX - WALL, T.maxX, 0, OFFICE_TOP, T.minZ + WALL, 442, "concrete"),
  box(T.maxX - WALL, T.maxX, 0, OFFICE_TOP, 444, T.maxZ - WALL, "concrete"),
  { ...box(T.maxX - WALL, T.maxX, DOOR_TOP, OFFICE_TOP, 442, 444, "concrete"), interior: true },
  // The desk with the terminal by the west wall, a filing cabinet, a bench by the door.
  ...placeProps({ x: 0, y: W3_Y, z: 0 }, [crate(2487.2, 441, 1.2, 0.85, 3), crate(2490, 445.1, 2, 1.8, 0.6), crate(2494.9, 438.2, 0.6, 0.45, 2.2)]),
];

/** The lower part over the office up to the platform, the shaft, the cabin, the roof and the masts. */
const body = (): StaticProp[] => [
  box(T.minX, T.maxX, OFFICE_TOP, P, T.minZ, T.maxZ, "concrete"),
  box(2488.5, 2493.5, P, 24, 438.5, 443.5, "concrete"),
  box(2487, 2495, 24, 28, 437, 445, "glass"),
  slabTop(2486.6, 2495.4, 436.6, 445.4, 28.6, 0.6, "concrete"),
  box(2488.9, 2489.1, 28.6, 34, 440.9, 441.1, "metal"),
  box(2493.4, 2493.6, 28.6, 32.4, 442.9, 443.1, "metal"),
  ...placeProps({ x: 0, y: W3_Y, z: 0 }, [neon(2489, 34.2, 441, v(0.4, 0.4, 0.15), "#ff3030"), neon(2491, 20, 438.4, v(4.4, 0.9, 0.15), "#ff5a3c", "TESSEN")]),
];

/** The platform's railings: open onto the pipe walk (west, z 442..444), the bridge (east) and the stair's landing (south-east). */
const platformRails = (): StaticProp[] => [
  railing(T.minX, 2494.5, T.minZ, T.minZ + 0.2, P),
  railing(T.minX, T.minX + 0.2, T.minZ + 0.2, 440, P),
  railing(T.minX, T.minX + 0.2, 440, W3_PIPES.minZ, P, OUTER_RAIL),
  railing(T.minX, T.minX + 0.2, W3_PIPES.maxZ, T.maxZ, P, OUTER_RAIL),
  railing(T.minX + 0.2, T.maxX, T.maxZ - 0.2, T.maxZ, P, OUTER_RAIL),
  railing(T.maxX - 0.2, T.maxX, W3_BRIDGE_Z.maxZ, T.maxZ - 0.2, P),
  railing(T.maxX - 0.2, T.maxX, 436.2, W3_BRIDGE_Z.minZ, P),
];

/** The bridge from the platform onto row N's roof, rising 0.4 m over the gap. */
const bridge = (): StaticProp[] => {
  const { minZ, maxZ } = W3_BRIDGE_Z;
  const x1 = W3_ROW_N.minX + 0.3;
  return [
    stairs(T.maxX, x1, minZ, maxZ, W3_Y + P, W3_Y + W3_ROOF, "x", 1),
    stairRail(T.maxX, x1, minZ - 0.2, minZ, W3_Y + P, W3_Y + W3_ROOF, "x", 1),
    stairRail(T.maxX, x1, maxZ, maxZ + 0.2, W3_Y + P, W3_Y + W3_ROOF, "x", 1),
  ];
};

/** The stair up the tower's south face: a flight west to a landing at +5, a flight east to a landing at +10 by the platform. */
export const W3_TOWER_STAIR = {
  first: { minX: 2486.5, maxX: 2494.5, minZ: 434.2, maxZ: 436 },
  landing: { minX: 2484.5, maxX: 2486.5, minZ: 432, maxZ: 436 },
  second: { minX: 2486.5, maxX: 2494.5, minZ: 432.2, maxZ: 434 },
  top: { minX: 2494.5, maxX: 2496.5, minZ: 432, maxZ: 436 },
} as const;

const towerStair = (): StaticProp[] => {
  const { first: a, landing: l, second: b, top: t } = W3_TOWER_STAIR;
  const y = (h: number) => W3_Y + h;
  return [
    stairs(a.minX, a.maxX, a.minZ, a.maxZ, y(0), y(5), "x", -1),
    slabTop(l.minX, l.maxX, l.minZ, l.maxZ, 5, 0.3, "metal"),
    stairs(b.minX, b.maxX, b.minZ, b.maxZ, y(5), y(P), "x", 1),
    slabTop(t.minX, t.maxX, t.minZ, t.maxZ, P, 0.3, "metal"),
    stairRail(b.minX, b.maxX, b.minZ - 0.2, b.minZ, y(5), y(P), "x", 1),
    stairRail(b.minX, b.maxX, b.maxZ, a.minZ, y(5), y(P), "x", 1),
    railing(l.minX, l.minX + 0.2, l.minZ, l.maxZ, 5),
    railing(l.minX + 0.2, l.maxX, l.minZ - 0.2, l.minZ, 5),
    railing(l.minX + 0.2, T.minX, l.maxZ - 0.2, l.maxZ, 5),
    railing(t.maxX - 0.2, t.maxX, t.minZ, t.maxZ, P),
    railing(t.minX, t.maxX - 0.2, t.minZ - 0.2, t.minZ, P),
    railing(T.maxX, t.maxX - 0.2, t.maxZ - 0.2, t.maxZ, P),
    // The landings' posts.
    box(l.minX + 0.1, l.minX + 0.3, 0, 4.7, l.minZ + 0.1, l.minZ + 0.3, "metal"),
    box(t.maxX - 0.3, t.maxX - 0.1, 0, P - 0.3, t.minZ + 0.1, t.minZ + 0.3, "metal"),
  ];
};

/** The pipe walk's deck and the pipes beside it, north of it. */
const WALK = { minZ: W3_PIPES.minZ, maxZ: 443.1 } as const;

/**
 * The landing at the walk's west end over the bank, 4 m wide and 3 m deep, its south edge open
 * over the ladder from the riverside path (as a roof's edge over a fire escape, ADR-0021): the
 * ladder climbs its post from the bank, a metre off the Lutosławski bridge's north edge.
 */
const LANDING = { minX: 2442, maxX: 2446, minZ: 439, maxZ: W3_PIPES.minZ } as const;

/** Where the ladder up to the landing starts, on the bank. */
export const W3_PIPE_LADDER = { key: "w3-pipe", x: 2444, z: LANDING.minZ - 0.4 } as const;

const pipeline = (): StaticProp[] => {
  const { minX, maxX } = W3_PIPES;
  const trestles = W3_TRESTLES.flatMap((x): StaticProp[] => {
    const foot = groundY(x, (W3_PIPES.minZ + W3_PIPES.maxZ) / 2) - W3_Y - 0.25;
    return [box(x - 0.5, x + 0.5, foot, P - 0.3, W3_PIPES.minZ + 0.2, W3_PIPES.maxZ - 0.2, "metal")];
  });
  const ladder = W3_PIPE_LADDER;
  const bottom = groundY(ladder.x, ladder.z);
  const l = LANDING;
  return [
    slabTop(minX, maxX, WALK.minZ, WALK.maxZ, P, 0.3, "metal"),
    box(minX, maxX, P - 0.7, P + 0.9, WALK.maxZ, W3_PIPES.maxZ, "metal"),
    // The walk's south rail east of the landing; the landing's sides.
    railing(l.maxX, maxX, WALK.minZ - 0.15, WALK.minZ, P),
    slabTop(l.minX, l.maxX, l.minZ, l.maxZ, P, 0.3, "metal"),
    railing(l.minX - 0.15, l.minX, l.minZ, WALK.maxZ, P),
    railing(l.maxX, l.maxX + 0.15, l.minZ, l.maxZ - 0.15, P),
    // The landing's post, the ladder up its south face.
    box(ladder.x - 0.4, ladder.x + 0.4, groundY(ladder.x, l.minZ + 0.15) - W3_Y - 0.25, P - 0.3, l.minZ, l.minZ + 0.3, "metal"),
    ...trestles,
    ...ladderParts({ key: ladder.key, x: ladder.x, z: ladder.z, yaw: 0, bottom, top: W3_Y + P, exit: v(ladder.x, W3_Y + P, l.minZ + 0.8) }),
  ];
};

/** The tower and the pipeline, in the world. */
export const W3_TOWER_PROPS: readonly StaticProp[] = [...office(), ...body(), ...platformRails(), ...bridge(), ...towerStair(), ...pipeline(), ...doorParts(W3_OFFICE_DOOR)];
