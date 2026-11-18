import { Quaternion, Vector3 } from "../../babylon";
import type { CharacterRig } from "../character-rig";
import type { BodyClip } from "./body-clip";
import { BODY_CLIPS } from "./body-clips.generated";
import { RIG_LEG, poseLeg, swing, turnTowards } from "./leg-pose";

/*
 * The body from Mixamo clips (ADR-0090 stage 2). Standing, a figure stands as in the idle clip:
 * its weight shifts from leg to leg, the chest breathes and sways, the head turns a little and the
 * free arms hang as a person's do, each figure at its own point of the loop. A hit (a flinch: a
 * bullet, a blocked blow) plays the hit reaction over whatever it does: the chest and the head
 * jolt back and the hips drop, as hard as the hit. The procedural rig stays underneath; walking,
 * crouched, in the air, on a ladder, knocked out, dying or busy with an activity the idle eases out,
 * and arms holding a weapon, a guard or a grip keep theirs. On a ladder the legs climb as in the
 * ladder clip.
 */

/** Below this many m/s it stands (the leg clips take over from here, `leg-pose.ts`). */
const STANDING = 0.3;
/** How fast the idle eases in and out, per second. */
const IDLE_EASE = 3;

export interface BodyFrame {
  readonly hips: Vector3;
  readonly chest: Quaternion;
  readonly head: Quaternion;
  readonly arms: readonly number[];
  readonly legs: readonly number[];
}

const mixRows = (a: readonly number[], f0: number, f1: number, k: number, width: number): number[] => {
  const out = new Array<number>(width);
  for (let i = 0; i < width; i++) out[i] = a[f0 * width + i]! * (1 - k) + a[f1 * width + i]! * k;
  return out;
};
const quatAt = (a: readonly number[], f: number): Quaternion => new Quaternion(a[f * 4]!, a[f * 4 + 1]!, a[f * 4 + 2]!, a[f * 4 + 3]!);

/** The clip at `t` seconds: looped, or held at its last frame. */
export const sampleBody = (clip: BodyClip, t: number, loop: boolean): BodyFrame => {
  const n = clip.frames;
  let x = (t / clip.cycle) * n;
  x = loop ? ((x % n) + n) % n : Math.max(0, Math.min(n - 1, x));
  const f0 = Math.floor(x);
  const f1 = loop ? (f0 + 1) % n : Math.min(n - 1, f0 + 1);
  const k = x - f0;
  const [hx, hy, hz] = mixRows(clip.hips, f0, f1, k, 3) as [number, number, number];
  return {
    hips: new Vector3(hx, hy, hz),
    chest: Quaternion.Slerp(quatAt(clip.chest, f0), quatAt(clip.chest, f1), k),
    head: Quaternion.Slerp(quatAt(clip.head, f0), quatAt(clip.head, f1), k),
    arms: clip.arms.length ? mixRows(clip.arms, f0, f1, k, 18) : [],
    legs: clip.legs.length ? mixRows(clip.legs, f0, f1, k, 24) : [],
  };
};

interface BodyState {
  idle: number;
  readonly offset: number;
  flinch: number;
  hit: number | null;
  hitAmount: number;
  /** The hips' sideways shift laid on last frame: nothing else sets the body's x each frame. */
  shift: number;
}
const states = new WeakMap<CharacterRig, BodyState>();
/** Where in the idle loop a figure stands, from its name: the same figure the same each time, a crowd spread out. */
const offsetOf = (rig: CharacterRig): number => {
  let h = 0;
  for (const c of rig.root.name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ((h % 997) / 997) * BODY_CLIPS.idle.cycle;
};
/** A figure first seen standing stands in the idle from the start (the reference still, G-030, is posed the same however long it took). */
const stateOf = (rig: CharacterRig, idle: number): BodyState => {
  let s = states.get(rig);
  if (!s) {
    s = { idle, offset: offsetOf(rig), flinch: rig.flinch, hit: null, hitAmount: 0, shift: 0 };
    states.set(rig, s);
  }
  return s;
};

const rotationOf = (node: CharacterRig["body"]): Quaternion => node.rotationQuaternion ?? Quaternion.FromEulerAngles(node.rotation.x, node.rotation.y, node.rotation.z);
const dir = (a: readonly number[], i: number): Vector3 => new Vector3(a[i]!, a[i + 1]!, a[i + 2]!);

/** One arm along the clip's upper arm, forearm and hand (directions in the chest's frame), `w` of the way. */
const poseArm = (arm: CharacterRig["armL"], elbow: CharacterRig["elbowL"], wrist: CharacterRig["wristL"], a: readonly number[], at: number, w: number): void => {
  if (w <= 0) return;
  const upper = swing(dir(a, at));
  const toUpper = Quaternion.Inverse(upper);
  const lower = swing(dir(a, at + 3).applyRotationQuaternion(toUpper));
  const hand = swing(dir(a, at + 6).applyRotationQuaternion(toUpper).applyRotationQuaternion(Quaternion.Inverse(lower)));
  turnTowards(arm, upper, w);
  turnTowards(elbow, lower, w);
  turnTowards(wrist, hand, w);
};

/**
 * How free each arm is for the idle's, left then right: not holding a weapon, a guard, a grip or
 * someone. With the pistol drawn at low ready the left hand hangs free until it comes up to
 * support the aim or to reload.
 */
const freeArms = (rig: CharacterRig): [number, number] => {
  if (rig.grip || rig.handsBusy || rig.swing || rig.stagger > 0) return [0, 0];
  const free = 1 - rig.guard;
  if (!rig.aiming) return [rig.leftHold ? 0 : free, free];
  const support = rig.reload > 0 ? 1 : Math.min(1, rig.aim * 2);
  return [rig.leftHold ? 0 : free * (1 - rig.drawn * support), free * (1 - rig.drawn)];
};

const idleTarget = (rig: CharacterRig, speed: number, crouch: number): number => {
  if (rig.dying !== null || (rig.doing ?? []).some((a) => a !== "idle")) return 0;
  const still = Math.max(0, 1 - speed / STANDING);
  return still * (1 - Math.min(1, Math.max(0, crouch))) * (1 - rig.airBlend) * (1 - rig.climbBlend) * (1 - rig.knockout);
};

/** Moves the hips by `by` (leg lengths): x on top of what was laid on before, y and z on the procedural rig's, set anew each frame. */
/**
 * Turns the body `w` of the way to `q` about the hips (the body's origin is at the feet), and moves
 * the hips by `by` (leg lengths). Returns the sideways part, which the caller keeps track of.
 */
const turnAboutHips = (rig: CharacterRig, q: Quaternion, w: number, by: Vector3): number => {
  const b = rig.body;
  const hip = new Vector3(0, rig.legL.position.y, 0);
  const before = hip.applyRotationQuaternion(rotationOf(b));
  turnTowards(b, q, w);
  const after = hip.applyRotationQuaternion(rotationOf(b));
  return shiftHips(b, by.add(before.subtract(after).scale(1 / RIG_LEG)));
};

const shiftHips = (b: CharacterRig["body"], by: Vector3): number => {
  b.position.y += by.y * RIG_LEG;
  b.position.z += by.z * RIG_LEG;
  return by.x * RIG_LEG;
};

const poseIdle = (rig: CharacterRig, s: BodyState, target: number, dt: number): number => {
  s.idle += (target - s.idle) * Math.min(1, dt * IDLE_EASE);
  const w = s.idle;
  if (w < 1e-3) return 0;
  const f = sampleBody(BODY_CLIPS.idle, rig.time + s.offset, true);
  const b = rig.body;
  const x = turnAboutHips(rig, f.chest.multiply(rotationOf(b)), w, f.hips.scale(w));
  turnTowards(rig.head, f.head.multiply(rotationOf(rig.head)), w);
  const unlean = Quaternion.Inverse(rotationOf(b));
  poseLeg(rig.legL, rig.kneeL, [...f.legs], 0, w, unlean, 1);
  poseLeg(rig.legR, rig.kneeR, [...f.legs], 12, w, unlean, 1);
  const [left, right] = freeArms(rig);
  poseArm(rig.armL, rig.elbowL, rig.wristL, f.arms, 0, w * left);
  poseArm(rig.armR, rig.elbowR, rig.wristR, f.arms, 9, w * right);
  return x;
};

/** A flinch that jumped up since the last frame starts the hit reaction, as hard as the jump. */
const poseHit = (rig: CharacterRig, s: BodyState, dt: number): number => {
  const jump = rig.flinch - s.flinch;
  s.flinch = rig.flinch;
  if (jump > 0.2) {
    s.hit = 0;
    s.hitAmount = Math.min(1, jump);
  } else if (s.hit !== null) s.hit += dt;
  if (s.hit === null) return 0;
  if (s.hit >= BODY_CLIPS.hit.cycle) {
    s.hit = null;
    return 0;
  }
  const f = sampleBody(BODY_CLIPS.hit, s.hit, false);
  const k = s.hitAmount;
  const b = rig.body;
  const x = turnAboutHips(rig, Quaternion.Slerp(Quaternion.Identity(), f.chest, k).multiply(rotationOf(b)), 1, f.hips.scale(k));
  turnTowards(rig.head, Quaternion.Slerp(Quaternion.Identity(), f.head, k).multiply(rotationOf(rig.head)), 1);
  return x;
};

/** How far ahead of the hips the ladder clip's toes go at most, in leg lengths. */
const LADDER_TOES = (() => {
  const { legs, frames } = BODY_CLIPS.ladder;
  let most = 0;
  for (let f = 0; f < frames; f++) for (const at of [11, 23]) most = Math.max(most, legs[f * 24 + at]!);
  return most;
})();
/** The toes stop this far short of the rungs' line (m). */
const TOE_CLEAR = 0.05;

/** How far ahead of her the rungs are, in leg lengths (from the ladder she climbs; far off without one). */
const ladderReach = (rig: CharacterRig): number => {
  const l = rig.ladder;
  if (!l) return LADDER_TOES;
  const ahead = Math.sin(l.yaw) * (l.x - rig.root.position.x) + Math.cos(l.yaw) * (l.z - rig.root.position.z);
  return (ahead - TOE_CLEAR) / (RIG_LEG * (Math.abs(rig.root.scaling.y) || 1));
};

/**
 * On a ladder the legs and the head climb as in the ladder clip: foot over foot, the left with the
 * right hand's reach, looking up. Its phase is the hands' (`reachForRungs`: the height on the
 * ladder, one loop per two rungs; the clip's left hand reaches over the same part of its loop), so
 * the feet keep time with the hands up or down and stop when she hangs still. The torso stays the
 * procedural pose's: the hands are solved onto the rungs from it.
 */
const poseLadder = (rig: CharacterRig): void => {
  const w = rig.climbBlend;
  if (w < 1e-3) return;
  const clip = BODY_CLIPS.ladder;
  const f = sampleBody(clip, (rig.climbPhase / (2 * Math.PI)) * clip.cycle, true);
  // The game holds her nearer the ladder than Mixamo's figure stands to its own: the legs reach
  // as far ahead as the rungs are, not through them.
  const k = Math.min(1, Math.max(0.3, ladderReach(rig) / LADDER_TOES));
  const legs = f.legs.map((v, i) => (i % 3 === 2 ? v * k : v));
  const unlean = Quaternion.Inverse(rotationOf(rig.body));
  poseLeg(rig.legL, rig.kneeL, legs, 0, w, unlean, 1);
  poseLeg(rig.legR, rig.kneeR, legs, 12, w, unlean, 1);
  turnTowards(rig.head, f.head.multiply(rotationOf(rig.head)), w);
};

/** Lays the body clips over the rig after `animateRig` and the leg clips: the idle standing, the hit reaction on a flinch, the ladder. */
export const poseBodyFromClips = (rig: CharacterRig, speed: number, dt: number, crouch: number): void => {
  const target = idleTarget(rig, speed, crouch);
  const s = stateOf(rig, target);
  // The procedural rig bends the elbows about x only and turns a free hand by no angles: the clips' of the last frame go.
  for (const e of [rig.elbowL, rig.elbowR]) e.rotation.y = e.rotation.z = 0;
  // Nor does it tilt the head sideways (an activity does, after this).
  rig.head.rotation.z = 0;
  for (const h of [rig.wristL, rig.wristR]) if (!h.rotationQuaternion) h.rotation.setAll(0);
  // Dying, the death fall has the body: nothing of the clips stays on it.
  const alive = rig.dying === null;
  if (!alive) {
    s.idle = 0;
    s.hit = null;
  }
  const shift = alive ? poseIdle(rig, s, target, dt) + poseHit(rig, s, dt) : 0;
  if (alive) poseLadder(rig);
  rig.body.position.x += shift - s.shift;
  s.shift = shift;
};
