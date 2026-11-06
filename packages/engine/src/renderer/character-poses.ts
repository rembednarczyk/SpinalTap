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

export const mixPose = (a: ArmPose, b: ArmPose, t: number): ArmPose => ({
  armX: a.armX + (b.armX - a.armX) * t,
  armZ: a.armZ + (b.armZ - a.armZ) * t,
  elbowX: a.elbowX + (b.elbowX - a.elbowX) * t,
});

export const smooth = (t: number): number => t * t * (3 - 2 * t);

/** 0..1..0 over a reload: how far the weapon is down and the left hand away fetching a magazine. */
export const reloadPhase = (rig: CharacterRig): number => (rig.reloadTotal > 0 && rig.reload > 0 ? Math.sin(Math.PI * (1 - rig.reload / rig.reloadTotal)) : 0);

/**
 * Draws or holsters towards the weapon's state; on a ladder or pulling up onto a ledge (the
 * ladder pose, ADR-0021) both hands are on the rungs, so the weapon goes back in the holster
 * for the climb and comes out again after it.
 */
export const easeDrawn = (rig: CharacterRig, dt: number): void => {
  const target = rig.drawTarget && rig.climbBlend < 0.5 ? 1 : 0;
  rig.drawn += Math.sign(target - rig.drawn) * Math.min(Math.abs(target - rig.drawn), dt / DRAW_SECONDS);
};

/**
 * Right arm of an armed character. Holstered it swings like anyone's; drawn it carries the
 * pistol at low ready (muzzle down and forward, the arm loose and swaying with the walk) and
 * comes up to aim after a shot, the left hand joining to support it. Drawing reaches for the
 * hip, then brings the pistol up; holstering plays the same backwards. The pistol swaps from
 * holster to hand at the middle of the move.
 */
export const poseWeaponArms = (rig: CharacterRig, swing: number, amount: number, dt: number, run = 0, aiming = 0): void => {
  easeDrawn(rig, dt);
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
  const reloading = reloadPhase(rig);
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
