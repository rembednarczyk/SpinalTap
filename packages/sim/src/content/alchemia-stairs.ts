/**
 * The ways up of Alchemia (G-287, G-288): the flights of steps from the paving to its modules'
 * doors and the hall's outside stair, in a module's own frame (glTF metres: x across its front,
 * z to its front, heights over its floor). Pure numbers: `alchemia.ts` sets them on the ground.
 */

/** A block of a module's solid: a convex outline in the model's frame, its top and its bottom over the floor (without one, the plinth's bottom). */
export interface AlchemiaPart {
  readonly points: readonly (readonly [number, number])[];
  readonly top: number;
  readonly bottom?: number;
}

/** A rectangle of the model's frame as a part. */
export const rectPart = (x0: number, x1: number, z0: number, z1: number, top: number, bottom?: number): AlchemiaPart => ({
  points: [
    [x0, z0],
    [x0, z1],
    [x1, z1],
    [x1, z0],
  ],
  top,
  ...(bottom === undefined ? {} : { bottom }),
});

/**
 * A flight of steps out of a module down to the paving: across `x0`..`x1`, from its edge at `z`
 * outwards along `dir` (+1: out of its front, -1: out of its back), its top step at `top` over the
 * floor (the threshold of the door, or the podium, behind it).
 */
export interface AlchemiaFlight {
  readonly x0: number;
  readonly x1: number;
  readonly z: number;
  readonly dir: 1 | -1;
  readonly top: number;
}

/**
 * The steps' sizes: the threshold step at the door is as deep as a body's radius and more, the
 * rest are a going of 0.36 m (more than a body's radius less the movement's edge margin, so the
 * step after next never stops a foot on this one) and rise at most 0.33 m (under `STEP_HEIGHT`,
 * 0.45 m). Short, so that the longest flight (2.6 m) keeps clear of the residents' loop along
 * the footway in front of the stalls.
 */
export const FLIGHT_THRESHOLD = 0.4;
export const FLIGHT_GOING = 0.36;
export const FLIGHT_MAX_RISE = 0.33;
const FLIGHT_MAX_STEPS = 10;
/** How far a step's block reaches under the lowest paving under it (m), as the plinths do. */
const STEP_SINK = 0.3;

/** Points across a line of the model's frame from x0 to x1 at z, every half metre or so, ends included. */
const across = (x0: number, x1: number, z: number): (readonly [number, number])[] => {
  const n = Math.max(1, Math.ceil((x1 - x0) / 0.5));
  return Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, z] as const);
};

/** Where the `i`-th step (0: the threshold) of a flight begins and ends, out from its edge. */
const stepSpan = (f: AlchemiaFlight, i: number): readonly [number, number] => [
  f.z + f.dir * (i === 0 ? 0 : FLIGHT_THRESHOLD + (i - 1) * FLIGHT_GOING),
  f.z + f.dir * (FLIGHT_THRESHOLD + i * FLIGHT_GOING),
];

/**
 * The steps of a flight on the paving `ground` (height over the floor at a point of the model's
 * frame): as few as rise at most `FLIGHT_MAX_RISE` each down to the lowest paving along the last
 * one's outer edge, so the riser from it to the paving is no higher than the others. Where the
 * paving is higher than a step, the step lies under it. None where the paving reaches the top.
 */
export const flightSteps = (f: AlchemiaFlight, ground: (x: number, z: number) => number): AlchemiaPart[] => {
  const lowest = (pts: readonly (readonly [number, number])[]) => Math.min(...pts.map(([x, z]) => ground(x, z)));
  const drop = (n: number) => f.top - lowest(across(f.x0, f.x1, stepSpan(f, n - 1)[1]));
  let n = 1;
  while (n < FLIGHT_MAX_STEPS && drop(n) > n * FLIGHT_MAX_RISE) n++;
  const rise = drop(n) / n;
  if (rise <= 0) return [];
  return Array.from({ length: n }, (_, i) => {
    const [a, b] = stepSpan(f, i);
    const top = f.top - i * rise;
    const under = Math.min(lowest([...across(f.x0, f.x1, a), ...across(f.x0, f.x1, b)]), top);
    return rectPart(f.x0, f.x1, Math.min(a, b), Math.max(a, b), top, under - STEP_SINK);
  });
};

/**
 * The hall's outside stair as alchemia-props.glb draws it (`alchemia-hall`, measured off its
 * faces): the building stands on a podium 1.23 m high; on its east side, between the ground
 * storey's wall (x 2.24) and the outer stringer (x 4.15), nine risers of 0.60 m and treads of
 * 0.69 m climb from the podium at the back (z -5.26) towards the front to a landing at 6.64 m,
 * which runs on from z 0.96 to a railing at 45° (x + z = 6.8) and along its open side (x
 * 4.15..4.5) to 7.35 m. The roof (11.51 m) is no further up: the landing is the door of the upper
 * storey, and runs on west of the wall as a balcony round the storey's cut corner (x + z = 3.35)
 * to its east wall (x 0.40), with a railing along its front (z 4.4..4.8; G-297). Over the foot of
 * the run the upper storey overhangs the wall (to x 2.7) from 8.6 m up, and a lamp hangs at 6.1 m.
 * Under the run (its soffit 0.9 m under its line) and the landing (a slab from 6.03 m) the podium
 * is open to the front, between the wall and the outer stringer.
 */
export const HALL_WALL_X = 2.24;
/** The cut east corner of the hall's storeys (x + z) and the east wall of its upper storey over the porch. */
export const HALL_CORNER = 3.35;
export const HALL_UPPER_X = 0.4;
const STRINGER_X = 4.15;
const RAIL_X = 4.5;
const PODIUM = { top: 1.23, x1: 5.51, z0: -5.54, z1: 5.49 } as const;
const RUN = { z0: -5.26, rise: 0.601, going: 0.691, soffit: 0.9 } as const;
const LANDING = { top: 6.64, z: 0.96, diagonal: 6.8, rail: 7.35, side: 2.65, bottom: 6.03 } as const;
const BALCONY = { rail: 4.4, edge: 4.8 } as const;
const OVERHANG = { x1: 2.7, z0: -4.7, z1: -2.6, step: -3.8, low: 9.9, high: 11.51, bottom: 8.6 } as const;
const LAMP = { x0: 3.15, x1: 3.75, z0: -4.47, z1: -4.0, bottom: 6.06, top: 6.27 } as const;

/** The walkable line of the run: through the middle of each drawn tread. */
const runLine = (z: number): number => PODIUM.top + RUN.rise / 2 + ((z - RUN.z0) * RUN.rise) / RUN.going;

/**
 * The run as steps of about 0.2 m (two of them stay within a step), from the podium's edge to the
 * landing, their tops on its line, their bottoms on its soffit where that is over the podium.
 */
const RUN_STEPS = 28;
const runSteps = (): AlchemiaPart[] => {
  const going = (LANDING.z - PODIUM.z0) / RUN_STEPS;
  return Array.from({ length: RUN_STEPS }, (_, i) => {
    const z0 = PODIUM.z0 + i * going;
    const z1 = z0 + going;
    const soffit = runLine(z0) - RUN.soffit;
    return rectPart(HALL_WALL_X, STRINGER_X, z0, z1, Math.min(LANDING.top, runLine((z0 + z1) / 2)), soffit > PODIUM.top ? Math.min(soffit, LANDING.bottom) : undefined);
  });
};

/**
 * The stair's solid: the podium (the hall's, across its width), the run, the landing and its
 * railings, the balcony on from it and its railing, and the overhang and the lamp over the run's foot.
 */
export const HALL_STAIR_PARTS: readonly AlchemiaPart[] = [
  rectPart(-PODIUM.x1, PODIUM.x1, PODIUM.z0, PODIUM.z1, PODIUM.top),
  ...runSteps(),
  {
    points: [
      [HALL_WALL_X, LANDING.z],
      [HALL_WALL_X, LANDING.diagonal - HALL_WALL_X],
      [STRINGER_X, LANDING.side],
      [STRINGER_X, LANDING.z],
    ],
    top: LANDING.top,
    bottom: LANDING.bottom,
  },
  rectPart(STRINGER_X, RAIL_X, LANDING.z, LANDING.side, LANDING.rail, LANDING.bottom),
  {
    points: [
      [HALL_WALL_X, LANDING.diagonal - HALL_WALL_X],
      [HALL_WALL_X, LANDING.diagonal - HALL_WALL_X + (RAIL_X - STRINGER_X)],
      [RAIL_X, LANDING.side],
      [STRINGER_X, LANDING.side],
    ],
    top: LANDING.rail,
    bottom: LANDING.bottom,
  },
  {
    points: [
      [HALL_UPPER_X, HALL_CORNER - HALL_UPPER_X],
      [HALL_UPPER_X, BALCONY.rail],
      [HALL_WALL_X, BALCONY.rail],
      [HALL_WALL_X, HALL_CORNER - HALL_WALL_X],
    ],
    top: LANDING.top,
    bottom: LANDING.bottom,
  },
  rectPart(HALL_UPPER_X, HALL_WALL_X, BALCONY.rail, BALCONY.edge, LANDING.rail, LANDING.bottom),
  rectPart(HALL_WALL_X, OVERHANG.x1, OVERHANG.z0, OVERHANG.step, OVERHANG.low, OVERHANG.bottom),
  rectPart(HALL_WALL_X, OVERHANG.x1, OVERHANG.step, OVERHANG.z1, OVERHANG.high, OVERHANG.bottom),
  rectPart(LAMP.x0, LAMP.x1, LAMP.z0, LAMP.z1, LAMP.top, LAMP.bottom),
];

/** The flight from the paving up to the podium at the run's foot, out of the hall's back. */
export const HALL_STAIR_FOOT: AlchemiaFlight = { x0: HALL_WALL_X, x1: STRINGER_X, z: PODIUM.z0, dir: -1, top: PODIUM.top };
