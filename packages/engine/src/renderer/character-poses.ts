import type { CharacterRig } from "./character-rig";

/** Seconds to draw or holster the pistol (matches the simulation's DRAW_TIME). */
export const DRAW_SECONDS = 0.4;
/** Seconds the weapon stays up after a shot before dropping back to low ready. */
export const AIM_HOLD = 1.4;

export interface ArmPose {
  armX: number;
  armZ: number;
  elbowX: number;
}

const mixPose = (a: ArmPose, b: ArmPose, t: number): ArmPose => ({
  armX: a.armX + (b.armX - a.armX) * t,
  armZ: a.armZ + (b.armZ - a.armZ) * t,
  elbowX: a.elbowX + (b.elbowX - a.elbowX) * t,
});

export const smooth = (t: number): number => t * t * (3 - 2 * t);

/**
 * Right arm of an armed character. Holstered it swings like anyone's; drawn it carries the
 * pistol at low ready (muzzle down and forward, the arm loose and swaying with the walk) and
 * comes up to aim after a shot, the left hand joining to support it. Drawing reaches for the
 * hip, then brings the pistol up; holstering plays the same backwards. The pistol swaps from
 * holster to hand at the middle of the move.
 */
export const poseWeaponArms = (rig: CharacterRig, swing: number, amount: number, dt: number, run = 0, aiming = 0): void => {
  const target = rig.drawTarget ? 1 : 0;
  rig.drawn += Math.sign(target - rig.drawn) * Math.min(Math.abs(target - rig.drawn), dt / DRAW_SECONDS);
  rig.aimHold = Math.max(0, rig.aimHold - dt);
  const aimTarget = rig.aimHold > 0 && rig.drawTarget ? 1 : 0;
  // Snap up to aim, ease back down.
  rig.aim += (aimTarget - rig.aim) * Math.min(1, dt * (aimTarget > rig.aim ? 14 : 3));
  // Aiming down sights (or an NPC in a fight) holds the weapon up as long as it lasts.
  if (rig.drawTarget) rig.aim = Math.max(rig.aim, Math.min(1, Math.max(0, aiming)));

  const sway = Math.cos(rig.phase) * amount;
  const free: ArmPose = { armX: swing * (0.6 + 0.5 * run), armZ: -rig.armSpread, elbowX: -0.18 - Math.max(0, -swing) * 0.4 * (1 - run) - 1.25 * run };
  const reach: ArmPose = { armX: 0.12, armZ: -0.32, elbowX: -0.55 };
  // At a run the pistol is carried close to the chest, muzzle down, still moving with the stride.
  const lowReady: ArmPose = { armX: -0.32 + swing * (0.22 + 0.12 * run) - 0.1 * run, armZ: -0.06 - 0.12 * run, elbowX: -0.62 + sway * 0.12 - 0.55 * run };
  const aimed: ArmPose = { armX: -1.42 + Math.abs(sway) * 0.05, armZ: 0, elbowX: -0.05 };
  // Reloading: pistol down to the chest, tipped in, while the left hand fetches a magazine.
  rig.reload = Math.max(0, rig.reload - dt);
  const reloading = rig.reloadTotal > 0 && rig.reload > 0 ? Math.sin(Math.PI * (1 - rig.reload / rig.reloadTotal)) : 0;
  if (reloading > 0) rig.aim *= 1 - reloading;
  const chest: ArmPose = { armX: -0.55, armZ: -0.18, elbowX: -1.35 };
  const ready = mixPose(mixPose(lowReady, aimed, smooth(rig.aim)), chest, reloading);
  const d = rig.drawn;
  const pose = d < 0.5 ? mixPose(free, reach, smooth(d / 0.5)) : mixPose(reach, ready, smooth((d - 0.5) / 0.5));
  rig.armR.rotation.x = pose.armX;
  rig.armR.rotation.z = pose.armZ;
  rig.elbowR.rotation.x = pose.elbowX;
  rig.gunHand?.scaling.setAll(d >= 0.5 ? 1 : 0);
  rig.gunHip?.scaling.setAll(d >= 0.5 ? 0 : 1);

  if (reloading > 0 && !rig.leftHold) {
    rig.armL.rotation.x += (-1.05 - rig.armL.rotation.x) * reloading;
    rig.armL.rotation.z += (0.5 - rig.armL.rotation.z) * reloading;
    rig.elbowL.rotation.x += (-1.5 - rig.elbowL.rotation.x) * reloading;
    return;
  }
  // Support hand under the pistol while aiming.
  const support = smooth(rig.aim) * (d >= 0.5 ? 1 : 0);
  if (support > 0 && !rig.leftHold) {
    rig.armL.rotation.x += (-1.3 - rig.armL.rotation.x) * support;
    rig.armL.rotation.z += (0.42 - rig.armL.rotation.z) * support;
    rig.elbowL.rotation.x += (-0.42 - rig.elbowL.rotation.x) * support;
  }
};

/** Seconds from the end of the windup to the end of the follow-through. */
export const SWING_STRIKE = 0.09;

/**
 * Where a swing is at `elapsed` seconds: `cock` takes the arm from ready to the wound-up pose
 * over the windup, `through` carries it on to the follow-through in SWING_STRIKE, and both
 * fall back to 0 over the rest of the recovery. 0/0 is the ready pose.
 */
export const swingPhase = (elapsed: number, windup: number, recovery: number): { cock: number; through: number } => {
  if (elapsed < windup) return { cock: smooth(elapsed / Math.max(1e-3, windup)), through: 0 };
  const strike = elapsed - windup;
  if (strike < SWING_STRIKE) return { cock: 1, through: smooth(strike / SWING_STRIKE) };
  const back = 1 - smooth(Math.min(1, (strike - SWING_STRIKE) / Math.max(1e-3, recovery - SWING_STRIKE)));
  return { cock: back, through: back };
};

export interface SwingPose extends ArmPose {
  /** Turn of the body around Y (positive to the right). */
  twist: number;
  /** Extra forward lean of the body. */
  bend: number;
}

/** Wound-up and follow-through poses of the right arm per strike of a combo. */
const SWING_POSES: readonly { readonly cocked: SwingPose; readonly through: SwingPose }[] = [
  // Forehand, right to left at chest height.
  { cocked: { armX: -1.35, armZ: -1.15, elbowX: -0.7, twist: 0.45, bend: 0 }, through: { armX: -1.2, armZ: 0.75, elbowX: -0.2, twist: -0.4, bend: 0.06 } },
  // Backhand, left to right.
  { cocked: { armX: -1.25, armZ: 0.85, elbowX: -1.45, twist: -0.4, bend: 0 }, through: { armX: -1.3, armZ: -1.2, elbowX: -0.15, twist: 0.45, bend: 0.06 } },
  // Overhead finisher, straight down.
  { cocked: { armX: -2.85, armZ: -0.25, elbowX: -0.95, twist: 0.1, bend: -0.12 }, through: { armX: -0.55, armZ: 0.05, elbowX: -0.1, twist: -0.05, bend: 0.22 } },
];

/** Melee weapon held low and forward, the tip up: the stance between swings. */
const MELEE_READY: SwingPose = { armX: -0.62, armZ: -0.14, elbowX: -0.95, twist: 0, bend: 0 };
/** Guard: the forearm (and the weapon along it) across the face, the left hand bracing it. */
const MELEE_GUARD: SwingPose = { armX: -1.55, armZ: 0.55, elbowX: -1.35, twist: -0.12, bend: 0 };

/** The current swing pose of a melee rig, from the ready (or guard) stance. */
export const meleePose = (rig: CharacterRig): SwingPose => {
  const base = mixSwing(MELEE_READY, MELEE_GUARD, smooth(rig.guard));
  const sw = rig.swing;
  if (!sw) return base;
  const poses = SWING_POSES[((sw.strike % SWING_POSES.length) + SWING_POSES.length) % SWING_POSES.length] ?? SWING_POSES[0]!;
  const { cock, through } = swingPhase(sw.elapsed, sw.windup, sw.recovery);
  const cocked = mixSwing(base, poses.cocked, cock);
  return mixSwing(cocked, poses.through, through);
};

const mixSwing = (a: SwingPose, b: SwingPose, t: number): SwingPose => ({ ...mixPose(a, b, t), twist: a.twist + (b.twist - a.twist) * t, bend: a.bend + (b.bend - a.bend) * t });

/**
 * Right arm of a character with a melee weapon: drawn it holds the weapon at the ready, swings
 * through the combo's poses and raises the guard; holstered it swings free like the pistol arm.
 */
export const poseMeleeArms = (rig: CharacterRig, swing: number, dt: number, run: number, guard: number): void => {
  const target = rig.drawTarget ? 1 : 0;
  rig.drawn += Math.sign(target - rig.drawn) * Math.min(Math.abs(target - rig.drawn), dt / DRAW_SECONDS);
  rig.aim = 0;
  const wantGuard = guard > 0.5 && rig.drawTarget && !rig.swing ? 1 : 0;
  rig.guard += (wantGuard - rig.guard) * Math.min(1, dt * (wantGuard > rig.guard ? 16 : 8));
  if (rig.swing) {
    rig.swing.elapsed += dt;
    if (rig.swing.elapsed >= rig.swing.windup + Math.max(SWING_STRIKE, rig.swing.recovery)) rig.swing = null;
  }
  const free: ArmPose = { armX: swing * (0.6 + 0.5 * run), armZ: -rig.armSpread, elbowX: -0.18 - Math.max(0, -swing) * 0.4 * (1 - run) - 1.25 * run };
  const pose = meleePose(rig);
  // The weapon still moves a little with the stride.
  const held: ArmPose = { armX: pose.armX + swing * 0.12 * (1 - rig.guard), armZ: pose.armZ, elbowX: pose.elbowX };
  const out = mixPose(free, held, smooth(rig.drawn));
  rig.armR.rotation.x = out.armX;
  rig.armR.rotation.z = out.armZ;
  rig.elbowR.rotation.x = out.elbowX;
  rig.gunHand?.scaling.setAll(rig.drawn >= 0.5 ? 1 : 0);
  rig.gunHip?.scaling.setAll(rig.drawn >= 0.5 ? 0 : 1);
  // The left hand braces the guard and swings out for balance on a blow.
  if (!rig.leftHold) {
    const g = smooth(rig.guard) * (rig.drawn >= 0.5 ? 1 : 0);
    rig.armL.rotation.x += (-1.35 - rig.armL.rotation.x) * g;
    rig.armL.rotation.z += (-0.45 - rig.armL.rotation.z) * g;
    rig.elbowL.rotation.x += (-1.25 - rig.elbowL.rotation.x) * g;
    const blow = rig.swing ? swingPhase(rig.swing.elapsed, rig.swing.windup, rig.swing.recovery).cock : 0;
    rig.armL.rotation.z += 0.35 * blow * (1 - g);
  }
};

/** Body turn and lean of the swing in progress, after the walk and crouch set the body. */
export const applySwingBody = (rig: CharacterRig): void => {
  if (rig.drawn < 0.5) return;
  const pose = meleePose(rig);
  rig.body.rotation.y = pose.twist;
  rig.body.rotation.x += pose.bend;
};

/** Knocked off balance: the body rocks back, the head snaps, the arms fly out, then it recovers. */
export const applyStagger = (rig: CharacterRig, dt: number): void => {
  if (rig.stagger <= 0) return;
  rig.stagger = Math.max(0, rig.stagger - dt);
  const t = 1 - rig.stagger / Math.max(1e-3, rig.staggerTotal);
  // Quick to hit, slow to recover.
  const k = t < 0.15 ? smooth(t / 0.15) : 1 - smooth((t - 0.15) / 0.85);
  rig.body.rotation.x -= 0.32 * k;
  rig.body.rotation.z += 0.12 * k * Math.sin(rig.time * 9);
  rig.head.rotation.x -= 0.35 * k;
  rig.armR.rotation.z -= 0.5 * k;
  rig.armL.rotation.z += 0.5 * k;
  rig.armR.rotation.x += 0.4 * k;
  rig.armL.rotation.x += 0.3 * k;
};
