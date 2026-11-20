import { Quaternion } from "../../babylon";
import type { CharacterRig } from "../character-rig";
import type { BodyClip } from "./body-clip";
import { airFrame } from "./air-clips";
import { turnFrame } from "./turn-clips";
import { BODY_CLIPS } from "./body-clips.generated";
import { sampleBody } from "./body-sample";
import { RIG_LEG, poseLeg, turnTowards } from "./leg-pose";
import { figureSeed, layPose, rotationOf, turnAboutHips } from "./pose-lay";
import { stepRecoil } from "./recoil";

export { type BodyFrame, sampleBody } from "./body-sample";

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

interface BodyState {
  idle: number;
  /** Where in its idle loop the figure stands, 0..1 of it (`figureSeed`). */
  readonly offset: number;
  flinch: number;
  hit: number | null;
  hitAmount: number;
  /** The hips' sideways shift laid on last frame: nothing else sets the body's x each frame. */
  shift: number;
}
const states = new WeakMap<CharacterRig, BodyState>();
/** A figure first seen standing stands in the idle from the start (the reference still, G-030, is posed the same however long it took). */
const stateOf = (rig: CharacterRig, idle: number): BodyState => {
  let s = states.get(rig);
  if (!s) {
    s = { idle, offset: figureSeed(rig), flinch: rig.flinch, hit: null, hitAmount: 0, shift: 0 };
    states.set(rig, s);
  }
  return s;
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
  const support = rig.reload > 0 || rig.reloadHold > 0 ? 1 : Math.min(1, rig.aim * 2);
  return [rig.leftHold ? 0 : free * (1 - rig.drawn * support), free * (1 - rig.drawn)];
};

const idleTarget = (rig: CharacterRig, speed: number, crouch: number): number => {
  if (rig.dying !== null || (rig.doing ?? []).some((a) => a !== "idle")) return 0;
  const still = Math.max(0, 1 - speed / STANDING);
  return still * (1 - Math.min(1, Math.max(0, crouch))) * (1 - rig.airBlend) * (1 - rig.climbBlend) * (1 - rig.knockout);
};

/** The idle each figure stands in, its own of two (Adventure's “idle (2)” bent Seki's bust through the ballistic vest, G-870). */
const IDLES = [BODY_CLIPS.idle, BODY_CLIPS.idleShift] as const;
/** A man's build stands as the Action Adventure pack's idle or shifts its weight. */
const IDLES_M = [BODY_CLIPS.idleM, BODY_CLIPS.idleShift] as const;
export const idleClipOf = (rig: CharacterRig): BodyClip => {
  const idles = rig.masculine ? IDLES_M : IDLES;
  return idles[Math.floor(figureSeed(rig) * idles.length)]!;
};

/** Hurt (ADR-0090 point 14), it stands bent over the wound, its own of two. */
const IDLES_HURT = [BODY_CLIPS.idleHurt, BODY_CLIPS.idleHurt2] as const;
const hurtIdleOf = (rig: CharacterRig): BodyClip => IDLES_HURT[Math.floor(figureSeed(rig) * IDLES_HURT.length)]!;

const poseIdle = (rig: CharacterRig, s: BodyState, target: number, dt: number): number => {
  s.idle += (target - s.idle) * Math.min(1, dt * IDLE_EASE);
  const w = s.idle;
  // Turning on the spot, the feet step round (`turn-clips.ts`); it follows the yaw every frame.
  const turn = turnFrame(rig, dt, w);
  if (w < 1e-3) return 0;
  const clip = idleClipOf(rig);
  let x = layPose(rig, sampleBody(clip, rig.time + s.offset * clip.cycle, true), w, freeArms(rig), true);
  // Hurt, the injured stance over it as far as it is hurt; the hips' shift is the two mixed.
  const h = rig.hurt ?? 0;
  if (h > 1e-3) {
    const hurt = hurtIdleOf(rig);
    x = x * (1 - h) + layPose(rig, sampleBody(hurt, rig.time + s.offset * hurt.cycle, true), w * h, freeArms(rig), true);
  }
  return turn ? x + layPose(rig, turn.frame, turn.w, freeArms(rig), true) : x;
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

/** Off the ground and after a hard landing (`air-clips.ts`); the arms that hold something keep it. */
const poseAir = (rig: CharacterRig, speed: number, dt: number): number => {
  const a = airFrame(rig, dt, (speed - STANDING) / 1.5);
  return a ? layPose(rig, a.frame, a.w, freeArms(rig), true) : 0;
};

/** A shot's kick (`recoil.ts`): the torso and the head jolt back about the hips. */
const poseRecoil = (rig: CharacterRig, dt: number): number => {
  const kick = stepRecoil(rig, dt);
  if (!kick) return 0;
  const { frame: f, amount: k } = kick;
  const x = turnAboutHips(rig, Quaternion.Slerp(Quaternion.Identity(), f.chest, k).multiply(rotationOf(rig.body)), 1, f.hips.scale(k));
  turnTowards(rig.head, Quaternion.Slerp(Quaternion.Identity(), f.head, k).multiply(rotationOf(rig.head)), 1);
  return x;
};

/** Lays the body clips over the rig after `animateRig` and the leg clips: the idle standing, the hit reaction on a flinch, a shot's kick, the ladder. */
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
  const shift = alive ? poseIdle(rig, s, target, dt) + poseAir(rig, speed, dt) + poseHit(rig, s, dt) + poseRecoil(rig, dt) : 0;
  if (alive) poseLadder(rig);
  rig.body.position.x += shift - s.shift;
  s.shift = shift;
};
