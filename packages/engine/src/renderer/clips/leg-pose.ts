import { Quaternion, Vector3 } from "../../babylon";
import type { CharacterRig } from "../character-rig";
import type { LegClip } from "./leg-clip";
import { LEG_CLIPS } from "./leg-clips.generated";

/*
 * The legs from Mixamo's locomotion clips (ADR-0090). A clip is mixed in by the way the character
 * moves against the way it faces (forward, back, to either side, and between) and by its speed
 * (walk to run); a man's build walks and runs ahead as a man does (`rig.masculine`). Its phase runs with the ground covered, one loop per the mixed clip's stride, so
 * the feet do not slide; crouched, the crouching walks (the user's ask of 17.11). The joints'
 * paths turn into the rig's thigh and knee rotations (each limb's swing from hanging down), on top
 * of which the dressed model is posed as before (`HumanoidRetarget`). An older figure's shorter
 * stride (`pace`) takes the swing towards standing and the steps quicker. Standing still (and so
 * crouched still), in the air, on a ladder and in a death fall the procedural legs stay; between,
 * the two mix.
 */

/** Hip to ankle of the rig at scale 1 (thigh 0.44 m and shin 0.42 m, `humanoid.ts`). */
export const RIG_LEG = 0.86;
/** Below `START` m/s the legs are the procedural rig's; at `FULL` the clips' wholly. */
const START = 0.3;
const FULL = 0.9;
/** Up to `WALK` m/s the walk clips, from `RUN` the run clips, mixed between. */
const WALK = 2;
const RUN = 4;
/** How fast the heading eases to the way it moves, per second. */
const TURN = 10;

type Dir = "fwd" | "back" | "left" | "right";
const WALKS: Readonly<Record<Dir, LegClip>> = { fwd: LEG_CLIPS.walk, back: LEG_CLIPS.walkBack, left: LEG_CLIPS.walkLeft, right: LEG_CLIPS.walkRight };
const RUNS: Readonly<Record<Dir, LegClip>> = { fwd: LEG_CLIPS.run, back: LEG_CLIPS.runBack, left: LEG_CLIPS.runLeft, right: LEG_CLIPS.runRight };
/** A man walks and runs ahead as in the Action Adventure pack (the rest is the same for all). */
const WALKS_M: Readonly<Record<Dir, LegClip>> = { ...WALKS, fwd: LEG_CLIPS.walkM };
const RUNS_M: Readonly<Record<Dir, LegClip>> = { ...RUNS, fwd: LEG_CLIPS.runM };
/** Crouched: the back is a diagonal one to the side it leans to (Mixamo's rifle pack walks back only so). */
const crouches = (side: number): Readonly<Record<Dir, LegClip>> => ({
  fwd: LEG_CLIPS.crouch,
  back: side >= 0 ? LEG_CLIPS.crouchBackRight : LEG_CLIPS.crouchBackLeft,
  left: LEG_CLIPS.crouchLeft,
  right: LEG_CLIPS.crouchRight,
});

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * The clips and their weights (summing to 1) for a heading (radians: 0 the way it faces, +π/2 to
 * its right), a share of running and one of crouching, each 0..1. Crouched, it walks.
 */
export const legWeights = (heading: number, run: number, crouch = 0, masculine = false): [LegClip, number][] => {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  const sum = Math.abs(c) + Math.abs(s) || 1;
  const dirs: [Dir, number][] = [
    ["fwd", Math.max(0, c) / sum],
    ["back", Math.max(0, -c) / sum],
    ["right", Math.max(0, s) / sum],
    ["left", Math.max(0, -s) / sum],
  ];
  const k = clamp01(crouch);
  const r = clamp01(run) * (1 - k);
  const low = crouches(s);
  const walks = masculine ? WALKS_M : WALKS;
  const runs = masculine ? RUNS_M : RUNS;
  return dirs.flatMap(([d, w]): [LegClip, number][] =>
    [
      [walks[d], w * (1 - r) * (1 - k)] as [LegClip, number],
      [runs[d], w * r] as [LegClip, number],
      [low[d], w * k] as [LegClip, number],
    ].filter(([, x]) => x > 1e-6),
  );
};

/** Ground one loop of the mix covers, in leg lengths. */
export const strideOf = (mix: readonly [LegClip, number][]): number => mix.reduce((a, [c, w]) => a + w * Math.hypot(c.stride.x, c.stride.z), 0);

/** The 8 leg joints (hipL kneeL ankleL toeL hipR kneeR ankleR toeR) of the mix at `phase` (0..1), x y z relative to the hips, in leg lengths. */
export const sampleLegs = (mix: readonly [LegClip, number][], phase: number): number[] => {
  const out = new Array<number>(24).fill(0);
  const p = ((phase % 1) + 1) % 1;
  for (const [clip, w] of mix) {
    const t = p * clip.frames;
    const f0 = Math.floor(t) % clip.frames;
    const f1 = (f0 + 1) % clip.frames;
    const k = t - Math.floor(t);
    for (let i = 0; i < 24; i++) out[i]! += w * (clip.legs[f0 * 24 + i]! * (1 - k) + clip.legs[f1 * 24 + i]! * k);
  }
  return out;
};

const DOWN = new Vector3(0, -1, 0);

/** The swing turning a limb that hangs down to point along `dir`. */
export const swing = (dir: Vector3): Quaternion => {
  const q = new Quaternion();
  Quaternion.FromUnitVectorsToRef(DOWN, dir.normalizeToNew(), q);
  return q;
};

interface LegState {
  phase: number;
  heading: number;
  at: { x: number; z: number } | null;
}
const states = new WeakMap<CharacterRig, LegState>();

/** `node`'s rotation mixed `w` of the way towards `q`. */
export const turnTowards = (node: CharacterRig["body"], q: Quaternion, w: number): void => {
  const own = node.rotationQuaternion ?? Quaternion.FromEulerAngles(node.rotation.x, node.rotation.y, node.rotation.z);
  const mixed = Quaternion.Slerp(own, q, w);
  if (node.rotationQuaternion) node.rotationQuaternion.copyFrom(mixed);
  else node.rotation.copyFrom(mixed.toEulerAngles());
};

/** Its facing about +Y (0: +Z), whether the root turns by a quaternion or by angles. */
export const yawOf = (rig: CharacterRig): number => rig.root.rotationQuaternion?.toEulerAngles().y ?? rig.root.rotation.y;

/** The heading of a step (dx, dz) in the world against a facing `yaw`: 0 ahead, +π/2 to the right. */
export const headingOf = (dx: number, dz: number, yaw: number): number => {
  const ahead = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  return Math.atan2(right, ahead);
};

/** How much of the clips' legs a rig shows at `speed` (m/s), 0..1. */
export const clipShare = (rig: CharacterRig, speed: number): number => {
  if (rig.dying !== null) return 0;
  return clamp01((speed - START) / (FULL - START)) * (1 - rig.airBlend) * (1 - rig.climbBlend);
};

/**
 * Turns one leg's thigh and knee towards the clip's hip, knee and ankle, mixed with the procedural
 * pose by `w`. The clip's frame is the facing's; the thigh hangs from the body, which leans (a run,
 * a crouch): `body` takes that lean back out.
 */
export const poseLeg = (thigh: CharacterRig["legL"], knee: CharacterRig["kneeL"], j: number[], at: number, w: number, body: Quaternion, pace: number): void => {
  const inBody = (i: number) => new Vector3(j[i]!, j[i + 1]!, j[i + 2]!).applyRotationQuaternion(body);
  const hip = inBody(at);
  const kn = inBody(at + 3);
  const ankle = inBody(at + 6);
  const clipUpper = swing(kn.subtract(hip));
  // The shin in the thigh's frame: the knee turns from the thigh, not from the body.
  const clipLower = swing(ankle.subtract(kn).applyRotationQuaternion(Quaternion.Inverse(clipUpper)));
  // A shorter stride swings less far from standing.
  const upper = Quaternion.Slerp(Quaternion.Identity(), clipUpper, pace);
  const lower = Quaternion.Slerp(Quaternion.Identity(), clipLower, pace);
  turnTowards(thigh, upper, w);
  turnTowards(knee, lower, w);
};

/**
 * Puts the clips' legs on `rig` after `animateRig`, from where its root stands now (`at`, the
 * world) and its speed. Keeps the phase and the heading per rig.
 */
export const poseLegsFromClips = (rig: CharacterRig, at: { x: number; z: number }, speed: number, dt: number, crouch: number): void => {
  // The procedural rig bends the knees about x only: the clips' twist of the last frame goes.
  for (const k of [rig.kneeL, rig.kneeR]) k.rotation.y = k.rotation.z = 0;
  let s = states.get(rig);
  if (!s) {
    s = { phase: 0, heading: 0, at: null };
    states.set(rig, s);
  }
  const step = s.at && dt > 0 ? { x: at.x - s.at.x, z: at.z - s.at.z } : null;
  s.at = { x: at.x, z: at.z };
  if (step && Math.hypot(step.x, step.z) > 1e-4) {
    const target = headingOf(step.x, step.z, yawOf(rig));
    const d = Math.atan2(Math.sin(target - s.heading), Math.cos(target - s.heading));
    s.heading += d * Math.min(1, TURN * dt);
  }
  const w = clipShare(rig, speed);
  if (w <= 0) return;
  const mix = legWeights(s.heading, (speed - WALK) / (RUN - WALK), crouch, rig.masculine ?? false);
  const scale = Math.abs(rig.root.scaling.y) || 1;
  const pace = rig.pace ?? 1;
  s.phase += (speed * dt) / (Math.max(0.5, strideOf(mix) * pace) * RIG_LEG * scale);
  const j = sampleLegs(mix, s.phase);
  const b = rig.body;
  const unlean = Quaternion.Inverse(b.rotationQuaternion ?? Quaternion.FromEulerAngles(b.rotation.x, b.rotation.y, b.rotation.z));
  poseLeg(rig.legL, rig.kneeL, j, 0, w, unlean, pace);
  poseLeg(rig.legR, rig.kneeR, j, 12, w, unlean, pace);
};
