import type { CharacterRig } from "./character-rig";
import { type LadderRungs, reachForRungs } from "./ladder-hands";
import { AIM_HOLD, applyStagger, poseWeaponArms, reloadPhase, smooth } from "./character-poses";
import { applySwingBody, poseMeleeArms } from "./melee-poses";
import { bladeOf, holdLongGun, holdWeight } from "./two-hand-hold";

const DEATH_FALL = 0.65;
const DEATH_LINGER = 5.5;

/** Thigh angle from vertical when fully crouched (negative: knee forward and up). */
export const CROUCH_THIGH = -0.9;
/** Knee bend when fully crouched. */
export const CROUCH_KNEE = 1.88;
/** Knees out when fully crouched (radians each way), clear of the middle of a skirt. */
const CROUCH_SPREAD = 0.25;
/** Share of the stride left when fully crouched: short, careful steps. */
const CROUCH_STRIDE = 0.25;
/**
 * Forward lean of the body when fully crouched. Thigh and lean together keep the hips bent by
 * under 65°: past that a short skirt weighted to the hips (VRoid) is cut by the thighs.
 */
export const CROUCH_LEAN = 0.15;
/** Speeds (m/s) where the walk starts turning into a run and where the run is full. */
const RUN_FROM = 5;
const RUN_FULL = 6.6;
/** Forward lean of the body at a full run (radians). */
const RUN_LEAN = 0.24;
/** Run knee: the fold at mid swing, how far past mid swing it peaks, and the knee in stance (radians). */
const RUN_TUCK = 2.1;
const RUN_KNEE_LAG = 0.35;
const RUN_STANCE_KNEE = 0.45;
/**
 * Stride swing of the thighs: walking, and what a full run adds. The run also reaches a little
 * further forward than back (radians), so the thigh in front stays under 65° from the hips.
 */
const WALK_SWING = 0.7;
const RUN_SWING = 0.1;
const RUN_REACH = 0.05;

export interface CrouchOffset {
  /** Body drop (negative) and shift along Z that keep the feet planted at the root. */
  readonly y: number;
  readonly z: number;
}

/**
 * Where the body has to go so that, with the hips leaning `lean` forward and the legs at the
 * given thigh angle and knee bend, the feet stay on the ground under the root. Measured from
 * the rig's own segments, so it fits every build.
 */
export const crouchOffset = (rig: CharacterRig, thigh: number, knee: number, lean: number, spread = 0): CrouchOffset => {
  const hip = rig.legL.position.y;
  const thighLen = -rig.kneeL.position.y;
  const shinLen = thighLen * (0.42 / 0.44);
  // The bent leg in the thigh's frame: along the thigh (shortened by opening it sideways by
  // `spread`) and the shin's fold back across it; then the thigh turns by θ around X.
  const along = (thighLen + shinLen * Math.cos(knee)) * Math.cos(spread);
  const across = shinLen * Math.sin(knee);
  const legHeight = along * Math.cos(thigh) - across * Math.sin(thigh);
  const footZ = -along * Math.sin(thigh) - across * Math.cos(thigh);
  return {
    y: legHeight - (thighLen + shinLen) - hip * (Math.cos(lean) - 1),
    z: -(hip * Math.sin(lean) + footZ),
  };
};

/** Slight knee bend of the standing pose. */
const KNEE_REST = 0.04;

/** Crouch offset relative to the standing pose (which already has the rest knee bend). */
const crouchDelta = (rig: CharacterRig, thigh: number, knee: number, lean: number, spread: number): CrouchOffset => {
  const rest = crouchOffset(rig, 0, KNEE_REST, 0);
  const pose = crouchOffset(rig, thigh, knee + KNEE_REST, lean, spread);
  return { y: pose.y - rest.y, z: pose.z - rest.z };
};

/** Aim and guard from the simulation (`Transform.aim`, `Transform.guard`), 0..1. */
export interface RigCombat {
  readonly aim?: number;
  readonly guard?: number;
}

/** Jumps, falls and ladders from the simulation (`Transform.air`, `Transform.climb`, ADR-0021). */
export interface RigMotion {
  /** Vertical speed while airborne, m/s; absent on the ground. */
  readonly air?: number;
  /** Climbing speed on a ladder, m/s; absent off it. */
  readonly climb?: number;
  /** The rungs of that ladder; without them the hands take rungs as the content spaces them, ahead. */
  readonly rungs?: LadderRungs | null;
  /** Seconds the idle clock (breathing, flinch, stagger rock) moves on; `dt` when absent. */
  readonly clock?: number;
}

/** Take-off speed the jump pose is scaled to (the simulation's JUMP_SPEED). */
const AIR_REF = 7;
/** Blend speeds of the jump and ladder poses, per second. */
const AIR_BLEND_IN = 14;
const AIR_BLEND_OUT = 10;
const CLIMB_BLEND = 8;
/** How long a landing dip lasts (1 / rate), and how deep it goes at full strength (as a crouch amount). */
const LANDING_RECOVER = 3.2;
export const LANDING_DIP = 0.6;
/** A drop landing at this speed (m/s) gives the full dip. */
const LANDING_FULL = 14;

/** Thigh and knee of the jump pose: tucked on the way up, reaching for the ground on the way down. */
export const jumpLegs = (air: number): { thigh: number; knee: number } => {
  const up = Math.max(0, Math.min(1, air / AIR_REF));
  const down = Math.max(0, Math.min(1, -air / AIR_REF));
  return { thigh: -0.75 * up - 0.3 * down, knee: 1.25 * up + 0.35 * down + 0.2 };
};

/** Foot over foot at the phase the hands set (`reachForRungs`). */
const climbLegs = (rig: CharacterRig, w: number): void => {
  const s = Math.sin(rig.climbPhase);
  const mix = (from: number, to: number) => from + (to - from) * w;
  rig.legL.rotation.x = mix(rig.legL.rotation.x, -0.55 - 0.5 * Math.max(0, s));
  rig.legR.rotation.x = mix(rig.legR.rotation.x, -0.55 - 0.5 * Math.max(0, -s));
  rig.kneeL.rotation.x = mix(rig.kneeL.rotation.x, 0.9 + 0.7 * Math.max(0, s));
  rig.kneeR.rotation.x = mix(rig.kneeR.rotation.x, 0.9 + 0.7 * Math.max(0, -s));
};

/** Turns only the long-gun hold gives back to rest: the arms' twist, the wrists, the fingers. */
const relaxHands = (rig: CharacterRig): void => {
  rig.armL.rotation.y = 0;
  rig.armR.rotation.y = 0;
  rig.wristL.rotationQuaternion?.set(0, 0, 0, 1);
  rig.wristR.rotationQuaternion?.set(0, 0, 0, 1);
  rig.fist[0] = 0;
  rig.fist[1] = 0;
};


/** Knees give, then the body drops backwards onto the street; after lying still it sinks out of view. */
const animateDeath = (rig: CharacterRig, dying: number): void => {
  relaxHands(rig);
  const t = Math.min(1, dying / DEATH_FALL);
  const ease = t * t * (3 - 2 * t);
  rig.kneeL.rotation.x = rig.kneeR.rotation.x = 1.1 * ease;
  rig.legL.rotation.x = rig.legR.rotation.x = -0.5 * ease;
  // The crouch (or an activity) spread the knees; they close as the body goes over, not with a snap.
  rig.legL.rotation.z *= 1 - ease;
  rig.legR.rotation.z *= 1 - ease;
  rig.root.rotation.x = -1.45 * ease * ease;
  rig.armL.rotation.z = 0.9 * ease;
  rig.armR.rotation.z = -0.9 * ease;
  rig.armR.rotation.x = -0.4 * (1 - ease) - 0.2 * ease;
  const sink = Math.max(0, dying - DEATH_FALL - DEATH_LINGER);
  rig.root.position.y = rig.deathGround + 0.12 * ease - sink * 0.5;
};

/**
 * Airborne and on ladders (ADR-0021): eases the jump and ladder blends and starts a landing dip,
 * deeper after a long drop. Returns how far the walk cycle gives way to those poses (0..1).
 */
const updateAirAndClimb = (rig: CharacterRig, dt: number, motion: RigMotion): number => {
  const air = motion.air;
  const climbing = motion.climb !== undefined;
  if (air === undefined && rig.lastAir !== null && !climbing) rig.landing = Math.min(1, 0.3 + Math.max(0, -rig.lastAir) / LANDING_FULL);
  rig.lastAir = climbing ? null : (air ?? null);
  rig.landing = Math.max(0, rig.landing - dt * LANDING_RECOVER);
  const airTarget = air !== undefined && !climbing ? 1 : 0;
  rig.airBlend += (airTarget - rig.airBlend) * Math.min(1, dt * (airTarget > rig.airBlend ? AIR_BLEND_IN : AIR_BLEND_OUT));
  rig.climbBlend += ((climbing ? 1 : 0) - rig.climbBlend) * Math.min(1, dt * CLIMB_BLEND);
  return Math.max(rig.airBlend, rig.climbBlend);
};

/** The walk, run and crouch of this frame, shared by the legs, arms and body. */
interface Gait {
  /** 0 standing .. 1 fully down, the landing dip included. */
  readonly c: number;
  /** 0 walking .. 1 sprinting. */
  readonly run: number;
  readonly lean: number;
  readonly thigh: number;
  readonly knee: number;
  readonly amount: number;
  /** Stride swing of the legs and arms. */
  readonly swing: number;
}

/** Advances the stride phase and works out the gait at `speed`. */
const gaitOf = (rig: CharacterRig, speed: number, dt: number, crouch: number): Gait => {
  const c = smooth(Math.min(1, Math.max(0, Math.max(crouch, rig.landing * LANDING_DIP))));
  // 0 walking .. 1 sprinting: longer stride, forward lean, pumping arms, a flight phase.
  const run = smooth(Math.min(1, Math.max(0, (speed - RUN_FROM) / (RUN_FULL - RUN_FROM)))) * (1 - c);
  const lean = CROUCH_LEAN * c + RUN_LEAN * run;
  const thigh = CROUCH_THIGH * c;
  const knee = CROUCH_KNEE * c;
  const amount = Math.min(1, speed / 4.2);
  rig.phase += dt * (4 + speed * 1.9) * (amount > 0.05 ? 1 : 0);
  const swing = Math.sin(rig.phase) * (WALK_SWING + RUN_SWING * run) * amount * (1 - (1 - CROUCH_STRIDE) * c);
  return { c, run, lean, thigh, knee, amount, swing };
};

/** Knee of a leg at stride phase `phase` (its thigh swings forward while cos(phase) < 0). */
const legKnee = (swing: number, phase: number, { run, amount, c }: Gait): number => {
  // Walking, the knee bends as the thigh comes forward.
  const walk = Math.max(0, -swing) * 1.3;
  // Running, the heel folds up while the thigh passes under the hips and opens again as it reaches
  // forward, so the shin does not tuck behind a raised thigh (into a skirt); a soft knee in stance.
  const lagged = Math.cos(phase - RUN_KNEE_LAG);
  const stride = amount * (1 - (1 - CROUCH_STRIDE) * c);
  const sprint = (Math.max(0, -lagged) * RUN_TUCK + Math.max(0, lagged) * RUN_STANCE_KNEE) * stride;
  return walk * (1 - run) + sprint * run;
};

const poseLegs = (rig: CharacterRig, gait: Gait): void => {
  const { swing, thigh, lean, knee } = gait;
  // Leg angles are relative to the leaning body: take the lean back out.
  const reach = RUN_REACH * gait.run;
  rig.legL.rotation.x = swing + thigh - lean - reach;
  rig.legR.rotation.x = -swing + thigh - lean - reach;
  // The rig's left is -X: a negative turn about Z opens the left leg.
  rig.legL.rotation.z = -CROUCH_SPREAD * gait.c;
  rig.legR.rotation.z = CROUCH_SPREAD * gait.c;
  rig.kneeL.rotation.x = legKnee(swing, rig.phase, gait) + KNEE_REST + knee;
  rig.kneeR.rotation.x = legKnee(-swing, rig.phase + Math.PI, gait) + KNEE_REST + knee;
};

const poseArms = (rig: CharacterRig, { swing, run, amount, lean }: Gait, dt: number, combat: RigCombat): void => {
  relaxHands(rig);
  if (rig.leftHold) {
    rig.armL.rotation.x = rig.leftHold[0];
    rig.elbowL.rotation.x = rig.leftHold[1];
  } else {
    // Walking arms swing loose; running arms pump, bent at the elbow.
    rig.armL.rotation.x = -swing * (0.6 + 0.5 * run);
    rig.elbowL.rotation.x = -0.18 - Math.max(0, swing) * 0.4 * (1 - run) - 1.25 * run;
  }
  rig.armL.rotation.z = rig.armSpread;
  if (rig.aiming && rig.melee) poseMeleeArms(rig, swing, dt, run, combat.guard ?? 0);
  else if (rig.aiming) poseWeaponArms(rig, swing, amount, dt, run, combat.aim ?? 0);
  else {
    rig.armR.rotation.x = swing * (0.6 + 0.5 * run);
    rig.armR.rotation.z = -rig.armSpread;
    rig.elbowR.rotation.x = -0.18 - Math.max(0, -swing) * 0.4 * (1 - run) - 1.25 * run;
  }
  // Arms hang and aim in world terms, so the lean is taken out of them too.
  rig.armL.rotation.x -= lean;
  rig.armR.rotation.x -= lean;
  if (rig.aiming && rig.drawn >= 0.5) {
    rig.fist[1] = 1;
    // The support hand under a raised pistol half closes round the other.
    if (!rig.melee && !rig.leftHold) rig.fist[0] = 0.5 * smooth(Math.min(1, Math.max(0, rig.aim)));
  }
  const w = holdWeight(rig);
  if (w > 0) {
    const left = rig.leftHold ? 0 : w;
    holdLongGun(rig, rig.grip!, rig.stoop + lean, w, left, reloadPhase(rig));
    rig.fist[0] = 0.6 * left;
  }
};

/** One knee leads: the jump reads as a step into the air, not a hop on both feet. */
const applyAirPose = (rig: CharacterRig, air: number | undefined): void => {
  const legs = jumpLegs(air ?? rig.lastAir ?? 0);
  const w = rig.airBlend;
  rig.legL.rotation.x += w * legs.thigh;
  rig.legR.rotation.x += w * legs.thigh * 0.55;
  rig.kneeL.rotation.x += w * legs.knee;
  rig.kneeR.rotation.x += w * legs.knee * 0.7;
  // Arms out for balance; a weapon arm stays where it aims.
  if (holdWeight(rig) <= 0) {
    rig.armL.rotation.x -= w * 0.45;
    rig.armL.rotation.z += w * 0.35;
  }
  if (!rig.aiming) {
    rig.armR.rotation.x -= w * 0.45;
    rig.armR.rotation.z -= w * 0.35;
  }
};

/** Drop and lean with the feet planted, bob, breathing and hit flinch; the head keeps looking ahead. */
const poseBody = (rig: CharacterRig, { c, thigh, knee, lean, run, amount }: Gait, dt: number): void => {
  const offset = c > 0 ? crouchDelta(rig, thigh, knee, lean, CROUCH_SPREAD * c) : { y: 0, z: 0 };
  const breathe = Math.sin(rig.time * 1.7) * 0.006;
  // Bob: a soft dip at a walk, a push-off and flight at a run.
  const bob = Math.abs(Math.cos(rig.phase)) * (0.04 + 0.05 * run) * amount * (1 - 0.5 * c) - 0.03 * run;
  rig.body.position.y = bob + breathe + offset.y;
  rig.body.position.z = offset.z;
  rig.body.rotation.x = rig.stoop + lean;
  rig.flinch = Math.max(0, rig.flinch - dt * 5);
  rig.body.rotation.z = Math.sin(rig.time * 30) * 0.05 * rig.flinch;
  // The head keeps looking ahead over the lean.
  rig.head.rotation.x = -0.25 * rig.flinch - lean * 0.8;
  // With a long gun the body stands bladed; the head looks ahead past it and the legs keep
  // stepping the way the character goes (they turn back under the hips).
  const blade = bladeOf(rig, holdWeight(rig));
  rig.body.rotation.y = blade;
  rig.head.rotation.y = -blade;
  rig.legL.rotation.y = -blade;
  rig.legR.rotation.y = -blade;
};

/**
 * Procedural animation: walk cycle with knees and elbows, crouch, idle breathing, hit flinch,
 * death fall. `crouch` is 0 standing .. 1 fully down (already eased by the simulation): hips
 * and knees bend, the body drops and leans in with the feet planted, the head and arms keep
 * looking and aiming forward. `combat` holds the weapon up while aiming (ADR-0019) and raises
 * a melee guard; melee swings and staggers come from `startSwing` and `startStagger`.
 */
export const animateRig = (rig: CharacterRig, speed: number, dt: number, crouch = 0, combat: RigCombat = {}, motion: RigMotion = {}): void => {
  rig.time += motion.clock ?? dt;
  if (rig.dying !== null) {
    rig.dying += dt;
    animateDeath(rig, rig.dying);
    return;
  }
  const still = updateAirAndClimb(rig, dt, motion);
  const gait = gaitOf(rig, speed * (1 - still), dt, crouch);
  poseLegs(rig, gait);
  poseArms(rig, gait, dt, combat);
  if (rig.airBlend > 0.001) applyAirPose(rig, motion.air);
  poseBody(rig, gait, dt);
  if (motion.climb !== undefined) rig.ladder = motion.rungs ?? null;
  if (rig.climbBlend > 0.001) {
    reachForRungs(rig, rig.climbBlend, rig.ladder);
    climbLegs(rig, rig.climbBlend);
  }
  if (rig.aiming && rig.melee) applySwingBody(rig);
  applyStagger(rig, dt);
};

/** Plays a melee swing (strike `strike` of the combo) over the simulation's windup and recovery. */
export const startSwing = (rig: CharacterRig, strike: number, windup: number, recovery: number): void => {
  rig.swing = { strike, windup: Math.max(0, windup), recovery: Math.max(0, recovery), elapsed: 0 };
  rig.guard = 0;
};

/** Plays a stagger for `seconds`; it also cuts a swing short. */
export const startStagger = (rig: CharacterRig, seconds: number): void => {
  rig.stagger = rig.staggerTotal = Math.max(0.1, seconds);
  rig.swing = null;
};

/** Holsters or draws the pistol (animated). */
export const setWeaponDrawn = (rig: CharacterRig, drawn: boolean): void => {
  rig.drawTarget = drawn;
};

/** Plays the reload for `seconds`. */
export const startReload = (rig: CharacterRig, seconds: number): void => {
  rig.reload = rig.reloadTotal = Math.max(0.1, seconds);
};

/** Brings the weapon up to aim for a moment, e.g. on a shot. */
export const raiseWeapon = (rig: CharacterRig): void => {
  rig.aimHold = AIM_HOLD;
};

/** Starts the death fall; the renderer disposes the rig when `deathFinished` says so. */
export const startDeath = (rig: CharacterRig): void => {
  if (rig.dying !== null) return;
  rig.dying = 0;
  // The root stands where the views put the living figure (terrain height plus lift); the fall is relative to it.
  rig.deathGround = rig.root.position.y;
};

export const deathFinished = (rig: CharacterRig): boolean => rig.dying !== null && rig.dying > DEATH_FALL + DEATH_LINGER + 1.2;
