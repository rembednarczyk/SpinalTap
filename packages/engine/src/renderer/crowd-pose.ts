import type { ActivityId } from "@seki/core";
import { type ActivityBlend, type ActivityJoints, blendJoints, blendWeight, freshBlend, mixJoints, setBlendTarget, stepBlend } from "./activity-poses";
import { PART, PART_COUNT, type PuppetDims, UMBRELLA_ARM } from "./crowd-puppet";

/**
 * How a resident moves (ADR-0041): the walk and run cycle, the activities of ADR-0040 (the same
 * poses as the full characters, blended the same way), cowering from a shot, and the arm that
 * holds the umbrella. Then the eleven part matrices of the figure. Pure: no Babylon, no scene.
 */

export interface PuppetState {
  /** Stride phase (radians). */
  phase: number;
  /** Seconds since spawn, for breathing. */
  time: number;
  readonly blend: ActivityBlend;
  /** 0 standing .. 1 down on its haunches. */
  cower: number;
}

export const freshPuppet = (): PuppetState => ({ phase: 0, time: 0, blend: freshBlend(), cower: 0 });

export const setPuppetActivity = (s: PuppetState, activity: ActivityId | null): void => setBlendTarget(s.blend, activity);

/** Faster than this the figure walks rather than stands (m/s). */
const MOVING = 0.3;
const COWER_RATE = 4;

/**
 * One frame: the stride, the activity blend and the cower ease. `clock` moves the cycles (stride,
 * bob, activity): `dt` in play, 0 in the reference still so the pose does not hang on load time (G-044).
 */
export const stepPuppet = (s: PuppetState, speed: number, crouch: number, dt: number, clock = dt): void => {
  s.time += clock;
  if (speed > 0.05) s.phase += clock * (4 + speed * 1.9);
  stepBlend(s.blend, dt, speed > MOVING, clock);
  const to = crouch > 0.5 ? 1 : 0;
  s.cower += Math.max(-COWER_RATE * dt, Math.min(COWER_RATE * dt, to - s.cower));
};

export interface PuppetPose extends ActivityJoints {
  /** Hips up (+) or down (-) from standing, and forward (+) or back, keeping the feet planted (m). */
  readonly dropY: number;
  readonly shiftZ: number;
}

const REST: ActivityJoints = {
  armLX: 0,
  armLZ: 0.1,
  elbowL: -0.18,
  armRX: 0,
  armRZ: -0.1,
  elbowR: -0.18,
  legLX: 0,
  legRX: 0,
  kneeL: 0.04,
  kneeR: 0.04,
  spread: 0,
  lean: 0,
  twist: 0,
  back: 0,
  headX: 0,
  headY: 0,
  headZ: 0,
};

/** Down on the haunches, arms over the head, looking at the ground. */
const COWER: ActivityJoints = { ...REST, legLX: -1.25, legRX: -1.1, kneeL: 2.05, kneeR: 1.9, lean: 0.45, armLX: -2.3, armLZ: -0.3, elbowL: -1.7, armRX: -2.3, armRZ: 0.3, elbowR: -1.7, headX: 0.5 };

/** The walk (or run) cycle at `speed`. */
export const gaitJoints = (phase: number, speed: number): ActivityJoints => {
  const amount = Math.min(1, speed / 1.2);
  const run = Math.max(0, Math.min(1, (speed - 2.2) / 1.4));
  const swing = Math.sin(phase) * (0.6 + 0.3 * run) * amount;
  const kick = 0.9 + 0.6 * run;
  return {
    ...REST,
    legLX: swing - 0.12 * run,
    legRX: -swing - 0.12 * run,
    kneeL: Math.max(0, -swing) * kick + Math.max(0, swing) * 0.4 * run + 0.04,
    kneeR: Math.max(0, swing) * kick + Math.max(0, -swing) * 0.4 * run + 0.04,
    armLX: -swing * (0.6 + 0.5 * run),
    armRX: swing * (0.6 + 0.5 * run),
    elbowL: -0.18 - Math.max(0, swing) * 0.4 * (1 - run) - 1.2 * run,
    elbowR: -0.18 - Math.max(0, -swing) * 0.4 * (1 - run) - 1.2 * run,
    lean: 0.2 * run,
  };
};

/**
 * Where the hips go so that the feet stay on the ground under the figure with these legs,
 * relative to standing (the figure leans about its hips, so the lean does not move them) (as the full rigs do, character-animation.ts).
 */
export const plantedHips = (d: PuppetDims, thigh: number, knee: number): { y: number; z: number } => {
  const height = (t: number, k: number) => d.thigh * Math.cos(t) + d.shin * Math.cos(t + k);
  const foot = (t: number, k: number) => -d.thigh * Math.sin(t) - d.shin * Math.sin(t + k);
  return { y: height(thigh, knee) - height(0, 0.04), z: -foot(thigh, knee) + foot(0, 0.04) };
};

/** The figure's joints this frame. */
export const puppetPose = (s: PuppetState, speed: number, d: PuppetDims, umbrella: boolean): PuppetPose => {
  let j = gaitJoints(s.phase, speed);
  let planted = 0;
  const act = blendJoints(s.blend);
  const w = blendWeight(s.blend);
  if (act && w > 0) {
    j = mixJoints(j, act, w);
    planted = w;
  }
  if (s.cower > 0) {
    const c = s.cower * s.cower * (3 - 2 * s.cower);
    j = mixJoints(j, COWER, c);
    planted = Math.max(planted, c);
  }
  // The umbrella stays up in the left hand, whatever else the figure does.
  if (umbrella) j = { ...j, armLX: UMBRELLA_ARM.armX + j.lean, armLZ: UMBRELLA_ARM.armZ, elbowL: UMBRELLA_ARM.elbow };
  const hips = plantedHips(d, (j.legLX + j.legRX) / 2, (j.kneeL + j.kneeR) / 2);
  const bob = Math.abs(Math.cos(s.phase)) * 0.035 * Math.min(1, speed / 1.2) + Math.sin(s.time * 1.7) * 0.005;
  return { ...j, dropY: hips.y * planted + bob * (1 - planted), shiftZ: hips.z * planted - j.back };
};

/** A 3×4 affine matrix, row-major: [r00 r01 r02 tx, r10 r11 r12 ty, r20 r21 r22 tz]. */
export type Affine = Float64Array;

export const identity = (out: Affine = new Float64Array(12)): Affine => {
  out.fill(0);
  out[0] = out[5] = out[10] = 1;
  return out;
};

/** out = a · b (out may not alias b). */
const mul = (out: Affine, a: Affine, b: Affine): Affine => {
  for (let r = 0; r < 3; r++) {
    const a0 = a[r * 4] as number;
    const a1 = a[r * 4 + 1] as number;
    const a2 = a[r * 4 + 2] as number;
    const a3 = a[r * 4 + 3] as number;
    for (let c = 0; c < 4; c++) out[r * 4 + c] = a0 * (b[c] as number) + a1 * (b[4 + c] as number) + a2 * (b[8 + c] as number) + (c === 3 ? a3 : 0);
  }
  return out;
};

const tmp = new Float64Array(12);
const op = new Float64Array(12);

/** m ← m · T(x, y, z). */
export const translate = (m: Affine, x: number, y: number, z: number): Affine => {
  for (let r = 0; r < 3; r++) m[r * 4 + 3] = (m[r * 4] as number) * x + (m[r * 4 + 1] as number) * y + (m[r * 4 + 2] as number) * z + (m[r * 4 + 3] as number);
  return m;
};

/** m ← m · R about an axis (Babylon's rotations: the same signs as a node's rotation.x/y/z). */
const rotate = (m: Affine, axis: 0 | 1 | 2, a: number): Affine => {
  if (a === 0) return m;
  const c = Math.cos(a);
  const s = Math.sin(a);
  identity(op);
  if (axis === 0) {
    op[5] = c;
    op[6] = -s;
    op[9] = s;
    op[10] = c;
  } else if (axis === 1) {
    op[0] = c;
    op[2] = s;
    op[8] = -s;
    op[10] = c;
  } else {
    op[0] = c;
    op[1] = -s;
    op[4] = s;
    op[5] = c;
  }
  mul(tmp, m, op);
  m.set(tmp);
  return m;
};

export const rotX = (m: Affine, a: number): Affine => rotate(m, 0, a);
export const rotY = (m: Affine, a: number): Affine => rotate(m, 1, a);
export const rotZ = (m: Affine, a: number): Affine => rotate(m, 2, a);

/** Fresh part matrices of one figure. */
export const partMatrices = (): Affine[] => Array.from({ length: PART_COUNT }, () => identity());

/**
 * The part matrices of a figure at (x, y, z) facing `yaw`, in pose `p`. The hierarchy follows the
 * full rigs: legs from the pelvis, arms and head from the leaning torso; a node's X turn after
 * its Z turn, a body's yaw after its pitch.
 */
export const poseParts = (out: Affine[], d: PuppetDims, p: PuppetPose, x: number, y: number, z: number, yaw: number): void => {
  const pelvis = out[PART.pelvis] as Affine;
  identity(pelvis);
  translate(pelvis, x, y, z);
  rotY(pelvis, yaw);
  translate(pelvis, 0, d.hipY + p.dropY, p.shiftZ);
  const torso = (out[PART.torso] as Affine).fill(0);
  torso.set(pelvis);
  rotY(torso, p.twist);
  rotX(torso, p.lean);
  const head = out[PART.head] as Affine;
  head.set(torso);
  translate(head, 0, d.neckY, 0);
  rotY(head, p.headY);
  rotX(head, p.headX - p.lean * 0.5);
  rotZ(head, p.headZ);
  const leg = (thigh: number, shin: number, side: number, legX: number, knee: number, spread: number) => {
    const t = out[thigh] as Affine;
    t.set(pelvis);
    translate(t, side * d.hipX, 0, 0);
    rotX(t, legX);
    rotZ(t, spread);
    const s = out[shin] as Affine;
    s.set(t);
    translate(s, 0, -d.thigh, 0);
    rotX(s, knee);
  };
  leg(PART.thighL, PART.shinL, -1, p.legLX, p.kneeL, p.spread);
  leg(PART.thighR, PART.shinR, 1, p.legRX, p.kneeR, -p.spread);
  const arm = (upper: number, fore: number, side: number, armX: number, armZ: number, elbow: number) => {
    const u = out[upper] as Affine;
    u.set(torso);
    translate(u, side * d.shoulderX, d.shoulderY, 0);
    rotX(u, armX - p.lean);
    rotZ(u, armZ);
    const f = out[fore] as Affine;
    f.set(u);
    translate(f, 0, -d.upper, 0);
    rotX(f, elbow);
  };
  arm(PART.upperL, PART.foreL, -1, p.armLX, p.armLZ, p.elbowL);
  arm(PART.upperR, PART.foreR, 1, p.armRX, p.armRZ, p.elbowR);
};
