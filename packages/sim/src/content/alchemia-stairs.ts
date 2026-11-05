/**
 * The ways up of Alchemia (G-287): the flights of steps from the paving to its modules' doors,
 * in a module's own frame (glTF metres: x across its front, z to its front, heights over its
 * floor). Pure numbers: `alchemia.ts` sets them on the ground.
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
