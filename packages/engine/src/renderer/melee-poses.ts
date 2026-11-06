import type { CharacterRig } from "./character-rig";
import { type ArmPose, easeDrawn, mixPose, smooth } from "./character-poses";
import { moveOf, swingEnd, swingPhase } from "./melee-timing";

export interface SwingPose extends ArmPose {
  /** Turn of the upper arm about its own length (the guard brings the forearm across). */
  armY: number;
  /** Turn of the body around Y (positive to the right). */
  twist: number;
  /** Extra forward lean of the body. */
  bend: number;
  /**
   * Tilt of the weapon in the fist (radians), from along the forearm towards the thumb: the
   * handle runs through the fist, so a blade stands across the forearm and the wrist cocks it.
   */
  wrist: number;
}

/**
 * Wound-up and follow-through poses of the right arm for the light strikes (by their place in
 * the combo) and the heavy one. Wound up, the wrist cocks the weapon back over the shoulder;
 * through the strike it straightens, so at the landing the weapon points at the target and
 * follows through low, a diagonal cut.
 */
const LIGHT: readonly { readonly cocked: SwingPose; readonly through: SwingPose }[] = [
  // Forehand: from over the left shoulder down across to the right.
  {
    cocked: { armX: -1.35, armY: 0, armZ: -1.15, elbowX: -0.7, twist: 0.45, bend: 0, wrist: 1.5 },
    through: { armX: -1.2, armY: 0, armZ: 0.75, elbowX: -0.2, twist: -0.4, bend: 0.06, wrist: -0.7 },
  },
  // Backhand: from over the right shoulder down across to the left.
  {
    cocked: { armX: -1.25, armY: 0, armZ: 0.85, elbowX: -1.45, twist: -0.4, bend: 0, wrist: 1.5 },
    through: { armX: -1.3, armY: 0, armZ: -1.2, elbowX: -0.15, twist: 0.45, bend: 0.06, wrist: -0.8 },
  },
];
/** Heavy: the overhead finisher, the weapon hanging behind the head, then straight down, the body leaning into it. */
const HEAVY = {
  cocked: { armX: -2.85, armY: 0, armZ: -0.25, elbowX: -0.95, twist: 0.1, bend: -0.12, wrist: 1.3 },
  through: { armX: -0.55, armY: 0, armZ: 0.05, elbowX: -0.1, twist: -0.05, bend: 0.22, wrist: -0.4 },
} as const satisfies { cocked: SwingPose; through: SwingPose };

/** Melee weapon held low and forward, the tip up: the stance between swings. */
const MELEE_READY: SwingPose = { armX: -0.62, armY: 0, armZ: -0.14, elbowX: -0.95, twist: 0, bend: 0, wrist: 0.9 };
/**
 * Guard: the fist before the right of the chest, the forearm turned in, the weapon slanting
 * up across the face to the left; the left hand braces it.
 */
const MELEE_GUARD: SwingPose = { armX: -0.4, armY: -0.6, armZ: 0.9, elbowX: -1.8, twist: -0.12, bend: 0, wrist: 0.55 };

const mixSwing = (a: SwingPose, b: SwingPose, t: number): SwingPose => ({
  ...mixPose(a, b, t),
  armY: a.armY + (b.armY - a.armY) * t,
  twist: a.twist + (b.twist - a.twist) * t,
  bend: a.bend + (b.bend - a.bend) * t,
  wrist: a.wrist + (b.wrist - a.wrist) * t,
});

/** The poses of strike `strike` of a combo: the light ones alternate, the finisher is heavy. */
export const swingPoses = (strike: number): { readonly cocked: SwingPose; readonly through: SwingPose } =>
  moveOf(strike) === "heavy" ? HEAVY : (LIGHT[((strike % LIGHT.length) + LIGHT.length) % LIGHT.length] ?? LIGHT[0]!);

/** The current swing pose of a melee rig, from the ready (or guard) stance. */
export const meleePose = (rig: CharacterRig): SwingPose => {
  const base = mixSwing(MELEE_READY, MELEE_GUARD, smooth(rig.guard));
  const sw = rig.swing;
  if (!sw) return base;
  const poses = swingPoses(sw.strike);
  const { cock, through } = swingPhase(sw.elapsed, sw.windup, sw.recovery);
  const cocked = mixSwing(base, poses.cocked, cock);
  return mixSwing(cocked, poses.through, through);
};

/**
 * Right arm of a character with a melee weapon: drawn it holds the weapon at the ready, swings
 * through the combo's poses and raises the guard; holstered it swings free like the pistol arm.
 */
export const poseMeleeArms = (rig: CharacterRig, swing: number, dt: number, run: number, guard: number): void => {
  easeDrawn(rig, dt);
  rig.aim = 0;
  const wantGuard = guard > 0.5 && rig.drawTarget && !rig.swing ? 1 : 0;
  rig.guard += (wantGuard - rig.guard) * Math.min(1, dt * (wantGuard > rig.guard ? 16 : 8));
  if (rig.swing) {
    rig.swing.elapsed += dt;
    if (rig.swing.elapsed >= swingEnd(rig.swing.windup, rig.swing.recovery)) rig.swing = null;
  }
  const free: ArmPose = { armX: swing * (0.6 + 0.5 * run), armZ: -rig.armSpread, elbowX: -0.18 - Math.max(0, -swing) * 0.4 * (1 - run) - 1.25 * run };
  const pose = meleePose(rig);
  // The weapon still moves a little with the stride.
  const held: ArmPose = { armX: pose.armX + swing * 0.12 * (1 - rig.guard), armZ: pose.armZ, elbowX: pose.elbowX };
  const out = mixPose(free, held, smooth(rig.drawn));
  rig.armR.rotation.x = out.armX;
  rig.armR.rotation.y = pose.armY * smooth(rig.drawn);
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

/**
 * Tilt of the melee weapon in the fist right now (radians): the pose's while drawn, along the
 * forearm before. `offset` turns a weapon whose blade leaves the handle at an angle (the curved
 * blade) so that its blade, not its handle, takes the pose.
 */
export const meleeWrist = (rig: CharacterRig, offset = 0): number => (rig.melee ? (meleePose(rig).wrist + offset) * smooth(Math.min(1, Math.max(0, rig.drawn))) : 0);
