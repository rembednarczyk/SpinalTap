import type { Transform, Vec3 } from "@seki/core";
import type { CharacterRig } from "./character-rig";

/**
 * Which way a knocked-out or dead body lies (G-458, ADR-0075 stage 2). The prone pose reaches
 * from the feet behind the root to the head and the thrown-out arm ahead of it, about 2 m along
 * the body's yaw, while the simulation keeps the body out of walls only by a small circle: laid
 * down facing a wall, the head went into it. As the body goes down (a fall, or put down off the
 * shoulder) the renderer looks along the body's length and across it, turns it on the ground a
 * half or a quarter turn until the whole of it is clear, and where no turn is clear (a body
 * dropped against a wall) moves it off the wall by what is missing, at most `MAX_SHIFT`. Only
 * the picture moves: the simulation's place and yaw stay (its own place of the body is
 * ADR-0075 stage 4).
 */

/** Distance along a ray to the first wall (metres), or null when nothing is within `max`. */
export type WallProbe = (origin: Vec3, dir: Vec3, max: number) => number | null;

/**
 * How far the prone body reaches from its root at the 1.74 m build, metres: ahead (the head),
 * behind (the feet), to its right (the arm thrown out past the head) and to its left, with a
 * hand's breadth of margin.
 */
export const LYING_REACH = { ahead: 1.0, behind: 1.05, right: 0.85, left: 0.5 } as const;
/** Furthest the picture moves a body off a wall, metres. */
export const MAX_SHIFT = 0.5;
/** Height of the rays over the root: the lying body's middle. */
const PROBE_HEIGHT = 0.3;
/** Turns tried, in order of preference: as it fell, the other way round, then across. */
const TURNS = [0, Math.PI, Math.PI / 2, -Math.PI / 2] as const;
/** Radians per second the body turns on the ground; the shift goes at a metre per second. */
const TURN_RATE = Math.PI / 0.6;
const SHIFT_RATE = 1;

/** How the picture lays a body: turned from the simulation's yaw and moved off its place (x, z). */
export interface LayOffset {
  readonly turn: number;
  readonly x: number;
  readonly z: number;
}

/** Room left over round a body turned `turn` (metres, negative: in a wall), and the way out of the tightest wall. */
const roomFor = (at: Vec3, yaw: number, turn: number, scale: number, probe: WallProbe): { room: number; out: { x: number; z: number } } => {
  const o = { x: at.x, y: at.y + PROBE_HEIGHT, z: at.z };
  const h = yaw + turn;
  const ahead = { x: Math.sin(h), y: 0, z: Math.cos(h) };
  const right = { x: Math.cos(h), y: 0, z: -Math.sin(h) };
  const sides = [
    [ahead, LYING_REACH.ahead],
    [{ x: -ahead.x, y: 0, z: -ahead.z }, LYING_REACH.behind],
    [right, LYING_REACH.right],
    [{ x: -right.x, y: 0, z: -right.z }, LYING_REACH.left],
  ] as const;
  let room = Infinity;
  let out = { x: 0, z: 0 };
  for (const [dir, need] of sides) {
    const reach = need * scale;
    const left = (probe(o, dir, reach) ?? reach) - reach;
    if (left < room) {
      room = left;
      out = { x: -dir.x, z: -dir.z };
    }
  }
  return { room, out };
};

/**
 * How to lay a body at `at` clear of every wall: the first of `TURNS` with room enough, else the
 * one with the most room, moved off its tightest wall by what is missing. `scale`: the build's
 * height over 1.74 m.
 */
export const layOffset = (at: Vec3, yaw: number, probe: WallProbe, scale = 1): LayOffset => {
  let best: { turn: number; room: number; out: { x: number; z: number } } | null = null;
  for (const turn of TURNS) {
    const r = roomFor(at, yaw, turn, scale, probe);
    if (r.room >= 0) return { turn, x: 0, z: 0 };
    if (!best || r.room > best.room) best = { turn, ...r };
  }
  if (!best) return { turn: 0, x: 0, z: 0 };
  const shift = Math.min(MAX_SHIFT, -best.room);
  return { turn: best.turn, x: best.out.x * shift, z: best.out.z * shift };
};

interface Lay {
  turn: number;
  x: number;
  z: number;
  target: LayOffset;
  lying: boolean;
}

const NONE: LayOffset = { turn: 0, x: 0, z: 0 };
const lays = new WeakMap<CharacterRig, Lay>();

/** The build's height over 1.74 m, from the rig's hips (0.92 m at 1.74 m). */
const scaleOf = (rig: CharacterRig): number => rig.legL.position.y / 0.92;

const toward = (from: number, to: number, step: number): number => from + Math.sign(to - from) * Math.min(Math.abs(to - from), step);

/**
 * Eases how the body lies on the ground: chosen as it goes down (`t.unconscious`, not on a
 * shoulder), back to none while it is picked up or gets up. `settle` lays it at once (a body
 * streaming in lying). The offset to lay over the simulation's place and yaw, or null for a
 * body that never lay turned (its root is left as the transform put it).
 */
export const layBody = (rig: CharacterRig, dt: number, t: Transform, carried: boolean, probe: WallProbe | undefined, settle = false): LayOffset | null => {
  const lying = !!t.unconscious && !carried;
  let s = lays.get(rig);
  if (!s) {
    if (!lying || !probe) return null;
    s = { turn: 0, x: 0, z: 0, target: NONE, lying: false };
    lays.set(rig, s);
  }
  if (lying && !s.lying) s.target = probe ? layOffset(t.position, t.yaw, probe, scaleOf(rig)) : NONE;
  if (!lying) s.target = NONE;
  s.lying = lying;
  // Picked up, it comes round to the carrier quicker than it turned going down.
  const k = settle ? Infinity : dt * (carried ? 2 : 1);
  s.turn = toward(s.turn, s.target.turn, k * TURN_RATE);
  s.x = toward(s.x, s.target.x, k * SHIFT_RATE);
  s.z = toward(s.z, s.target.z, k * SHIFT_RATE);
  if (!lying && s.turn === 0 && s.x === 0 && s.z === 0) lays.delete(rig);
  return s;
};

/** Puts the root of a lying body where `lay` has it, over the simulation's place (`t`, lifted `lift`). */
export const placeLaid = (rig: CharacterRig, t: Transform, lift: number, lay: LayOffset): void => {
  rig.root.position.set(t.position.x + lay.x, t.position.y + lift, t.position.z + lay.z);
  rig.root.rotation.y = t.yaw + lay.turn;
};
