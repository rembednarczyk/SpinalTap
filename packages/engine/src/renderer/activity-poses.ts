import type { ActivityId } from "@seki/core";

/**
 * Poses and loops of the activities (ADR-0040), as pure functions of the activity and the time
 * spent in it. Joint angles follow the procedural rig (character-animation.ts): arms and legs
 * hang along -Y, a negative X turn swings them forward, an elbow's negative X folds the forearm
 * forward and up, a knee's positive X folds the shin back; a left arm's Z opens it outwards, a
 * right arm's Z the other way. Imported models (VRoid and others) follow through the retarget.
 */
export interface ActivityJoints {
  armLX: number;
  armLZ: number;
  elbowL: number;
  armRX: number;
  armRZ: number;
  elbowR: number;
  legLX: number;
  legRX: number;
  kneeL: number;
  kneeR: number;
  /** Feet apart: the legs open by this much (radians). */
  spread: number;
  /** Forward lean of the body (negative leans back). */
  lean: number;
  /** Turn of the body around Y. */
  twist: number;
  /** Body shift back (towards a wall), metres. */
  back: number;
  headX: number;
  headY: number;
  headZ: number;
}

/** Things held or used in an activity. */
export type ActivityProp = "cigarette" | "phone" | "can" | "bowl" | "broom" | "stool";

/** Seconds of the blend from walking into an activity, out of it and between two of them. */
export const ACTIVITY_BLEND_SECONDS = 0.3;

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

const smooth = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/**
 * A raise-hold-lower pulse, 0..1, repeating every `period` seconds: up over `rise`, held for
 * `hold`, down over `rise` again.
 */
export const pulse = (t: number, period: number, rise: number, hold: number): number => {
  const p = ((t % period) + period) % period;
  if (p < rise) return smooth(p / rise);
  if (p < rise + hold) return 1;
  if (p < 2 * rise + hold) return 1 - smooth((p - rise - hold) / rise);
  return 0;
};

/** Hand at the mouth for a drag: every 6 s, up in 0.45 s, held 0.9 s. */
export const smokeDrag = (t: number): number => pulse(t, 6, 0.45, 0.9);

/** How bright the cigarette's tip glows, 0.35 at rest .. 1 at the height of a drag. */
export const emberGlow = (t: number): number => {
  const p = ((t % 6) + 6) % 6;
  // The draw brightens the tip while the hand is at the lips, and it dims slowly after.
  const draw = p >= 0.45 && p < 1.35 ? smooth((p - 0.45) / 0.9) : p >= 1.35 ? Math.max(0, 1 - (p - 1.35) / 2.5) : 0;
  return 0.35 + 0.65 * draw;
};

const SEATED = { legLX: -1.45, legRX: -1.45, kneeL: 1.45, kneeR: 1.45 } as const;

type PoseFn = (t: number) => Partial<ActivityJoints>;

const POSES: Readonly<Record<ActivityId, PoseFn>> = {
  idle: (t) => ({ twist: 0.03 * Math.sin(t * 0.4) }),
  smoke: (t) => {
    const up = smokeDrag(t);
    return {
      armRX: -0.25 - 0.3 * up,
      armRZ: 0.12 + 0.22 * up,
      elbowR: -1.0 - 1.35 * up,
      armLX: -0.2,
      armLZ: -0.25,
      elbowL: -1.35,
      legLX: 0.05,
      legRX: -0.08,
      kneeR: 0.25,
      spread: 0.04,
      headX: -0.1 * up,
      headY: 0.15 * Math.sin(t * 0.35),
    };
  },
  phone: (t) => ({
    armRX: -0.3,
    armRZ: -0.5,
    elbowR: -2.5,
    armLX: 0.1,
    armLZ: 0.45,
    elbowL: -1.2,
    headZ: 0.15,
    headX: 0.05 * Math.sin(t * 2.3),
    twist: 0.12 * Math.sin(t * 0.5),
  }),
  lean: (t) => ({
    armLX: -0.45,
    armLZ: -0.45,
    elbowL: -1.75,
    armRX: -0.45,
    armRZ: 0.45,
    elbowR: -1.75,
    legLX: 0.14,
    legRX: -0.06,
    kneeL: 0.12,
    lean: -0.1,
    back: 0.12,
    headY: 0.3 * Math.sin(t * 0.3),
  }),
  sit: (t) => ({
    ...SEATED,
    armLX: -0.6,
    armLZ: 0.08,
    elbowL: -0.6,
    armRX: -0.6,
    armRZ: -0.08,
    elbowR: -0.6,
    lean: -0.05,
    headY: 0.2 * Math.sin(t * 0.25),
  }),
  eat: (t) => {
    const up = pulse(t, 3, 0.35, 0.3);
    return {
      armLX: -0.5,
      armLZ: -0.15,
      elbowL: -1.45,
      armRX: -0.45 - 0.2 * up,
      armRZ: 0.2,
      elbowR: -1.3 - 0.9 * up,
      headX: 0.25 - 0.15 * up,
    };
  },
  drink: (t) => {
    const up = pulse(t, 5, 0.45, 0.6);
    return {
      armRX: -0.3 - 0.25 * up,
      armRZ: 0.15 + 0.2 * up,
      elbowR: -1.2 - 1.15 * up,
      armLX: 0.05,
      armLZ: 0.35,
      elbowL: -0.9,
      headX: -0.25 * up,
      legRX: -0.06,
      kneeR: 0.18,
    };
  },
  cook: (t) => ({
    armLX: -0.55,
    armLZ: -0.1,
    elbowL: -0.9 + 0.15 * Math.sin(t * 5),
    armRX: -0.6 + 0.08 * Math.sin(t * 4),
    armRZ: 0.15 + 0.12 * Math.cos(t * 4),
    elbowR: -0.95,
    lean: 0.15,
    headX: 0.35,
    twist: 0.05 * Math.sin(t * 0.7),
  }),
  sweep: (t) => {
    const s = Math.sin(t * 2.4);
    return {
      armLX: -0.6 + 0.12 * s,
      armLZ: -0.35,
      elbowL: -0.9,
      armRX: -0.25 - 0.12 * s,
      armRZ: 0.15,
      elbowR: -0.6,
      lean: 0.2,
      twist: 0.3 * s,
      headX: 0.3,
      spread: 0.06,
    };
  },
  talk: (t) => {
    const g1 = Math.max(0, Math.sin(t * 1.7));
    const g2 = Math.max(0, Math.sin(t * 1.3 + 2));
    return {
      armRX: -0.35 - 0.2 * g1,
      armRZ: 0.1,
      elbowR: -1.1 - 0.5 * g1,
      armLX: -0.2 - 0.15 * g2,
      armLZ: -0.05,
      elbowL: -0.8 - 0.4 * g2,
      headX: 0.06 * Math.sin(t * 2.6),
      headY: 0.12 * Math.sin(t * 0.7),
      twist: 0.06 * Math.sin(t * 0.9),
    };
  },
  sleep: (t) => ({
    ...SEATED,
    armLX: -0.35,
    armLZ: -0.05,
    elbowL: -0.4,
    armRX: -0.35,
    armRZ: 0.05,
    elbowR: -0.4,
    lean: 0.4 + 0.02 * Math.sin(t * 1.2),
    headX: 0.55,
    headZ: 0.1,
  }),
  terminal: (t) => ({
    armLX: -0.45,
    armLZ: -0.08,
    elbowL: -1.15 + 0.06 * Math.sin(t * 11),
    armRX: -0.45,
    armRZ: 0.08,
    elbowR: -1.15 + 0.06 * Math.sin(t * 13 + 1),
    lean: 0.08,
    headX: 0.3,
    headY: 0.1 * Math.sin(t * 0.4),
  }),
  guard: (t) => ({
    armLX: -0.25,
    armLZ: -0.2,
    elbowL: -0.75,
    armRX: -0.25,
    armRZ: 0.2,
    elbowR: -0.75,
    spread: 0.08,
    headX: -0.03,
    headY: 0.45 * Math.sin(t * 0.35),
  }),
};

/** The joints of `activity` `t` seconds into it. */
export const activityJoints = (activity: ActivityId, t: number): ActivityJoints => ({ ...REST, ...POSES[activity](t) });

/** Seated activities: the hips drop onto a seat. */
export const isSeated = (activity: ActivityId): boolean => activity === "sit" || activity === "sleep";

/** What the character holds (or sits on) in each activity. */
export const propsOf = (activity: ActivityId): readonly ActivityProp[] => {
  switch (activity) {
    case "smoke":
      return ["cigarette"];
    case "phone":
      return ["phone"];
    case "drink":
      return ["can"];
    case "eat":
      return ["bowl"];
    case "sweep":
      return ["broom"];
    case "sit":
    case "sleep":
      return ["stool"];
    default:
      return [];
  }
};

export const mixJoints = (a: ActivityJoints, b: ActivityJoints, t: number): ActivityJoints => {
  const out = { ...a };
  for (const k of Object.keys(out) as (keyof ActivityJoints)[]) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
};

/**
 * Where a character is between walking and its activities: `weight` eases the whole pose in
 * and out, `cross` from the previous activity (`from`) to the current one.
 */
export interface ActivityBlend {
  target: ActivityId | null;
  current: ActivityId | null;
  from: ActivityId | null;
  /** 0 walking/standing .. 1 fully in the activity. */
  weight: number;
  /** 0 still in `from` .. 1 fully in `current`. */
  cross: number;
  /** Seconds in the current activity (drives its loop). */
  time: number;
  fromTime: number;
}

export const freshBlend = (): ActivityBlend => ({ target: null, current: null, from: null, weight: 0, cross: 1, time: 0, fromTime: 0 });

/** A new activity (or null to go back to walking): a switch between two cross-fades, the rest eases. */
export const setBlendTarget = (b: ActivityBlend, activity: ActivityId | null): void => {
  b.target = activity;
  if (activity === null || activity === b.current) return;
  if (b.current !== null && b.weight > 0.01) {
    b.from = b.current;
    b.fromTime = b.time;
    b.cross = 0;
  } else {
    b.from = null;
    b.cross = 1;
  }
  b.current = activity;
  b.time = 0;
};

const approach = (v: number, to: number, step: number): number => (v < to ? Math.min(to, v + step) : Math.max(to, v - step));

/**
 * One frame of the blend. `moving` (the character walks) holds the pose out, so the walk never
 * fights it. Returns true while there is anything to show.
 */
export const stepBlend = (b: ActivityBlend, dt: number, moving: boolean): boolean => {
  const rate = dt / ACTIVITY_BLEND_SECONDS;
  b.weight = approach(b.weight, b.target !== null && !moving ? 1 : 0, rate);
  b.cross = approach(b.cross, 1, rate);
  b.time += dt;
  b.fromTime += dt;
  if (b.cross >= 1) b.from = null;
  if (b.weight <= 0 && b.target === null) {
    b.current = null;
    b.from = null;
  }
  return b.current !== null && b.weight > 0;
};

/** The pose of the blend right now (the current activity's, cross-faded from the previous one), or null. */
export const blendJoints = (b: ActivityBlend): ActivityJoints | null => {
  if (b.current === null) return null;
  const to = activityJoints(b.current, b.time);
  return b.from === null ? to : mixJoints(activityJoints(b.from, b.fromTime), to, smooth(b.cross));
};

/** The blend weight eased for the pose (smooth in and out). */
export const blendWeight = (b: ActivityBlend): number => smooth(b.weight);
