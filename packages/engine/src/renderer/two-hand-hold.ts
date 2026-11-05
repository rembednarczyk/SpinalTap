import { Quaternion, Vector3 } from "../babylon";
import type { CharacterRig } from "./character-rig";
import type { ArmReach, GunPoint, TwoHandGrip } from "./two-hand-grip";

/** The procedural rig's measurements; a dressed model replaces them (`rig.reach`). */
export const rigReach = (rig: CharacterRig): ArmReach => ({
  shoulderL: rig.armL.position,
  shoulderR: rig.armR.position,
  upper: -rig.elbowR.position.y,
  fore: -rig.wristR.position.y,
  // The box hand's middle.
  palm: new Vector3(0, -rig.head.position.y * (0.045 / 1.6), 0),
});

/** Length of the reference arm (the 1.74 m rig's upper arm and forearm); poses scale with the reach. */
const REF_ARM = 0.54;

type Vec = readonly [number, number, number];

/** A carry: where the butt goes from the right shoulder joint (reference-arm units), where the barrel points (level ground, facing ahead). */
interface Carry {
  readonly butt: Vec;
  readonly barrel: Vec;
}

/**
 * Aimed: the butt in the pocket in front of the shoulder, the barrel level ahead. From the hip
 * (low ready): the butt under the shoulder at the chest, the gun across the body, the muzzle
 * down and to the left. An SMG, without a stock, is held out in front on bent arms. Drawn: as
 * it comes out of the sling, upright before the right shoulder, muzzle up and to the left.
 */
const CARRY = {
  shouldered: {
    hip: { butt: [-0.03, -0.09, 0.15], barrel: [-0.7, -0.35, 0.62] },
    aimed: { butt: [-0.025, -0.01, 0.13], barrel: [0, 0, 1] },
    drawn: { butt: [0, -0.12, 0.2], barrel: [-0.65, -0.42, 0.63] },
  },
  out: {
    hip: { butt: [-0.06, -0.2, 0.2], barrel: [-0.55, -0.35, 0.75] },
    aimed: { butt: [-0.1, -0.04, 0.25], barrel: [0, 0, 1] },
    drawn: { butt: [-0.03, -0.22, 0.24], barrel: [-0.55, -0.3, 0.75] },
  },
} as const satisfies Record<string, { hip: Carry; aimed: Carry; drawn: Carry }>;

/** How far the butt swings forward (and three quarters of it in) half way between the hip and the shoulder (reference-arm units). */
const BUTT_ARC = 0.04;

/** Past this blend of the ladder pose the long gun is on the back, where the climbing hands leave it. */
export const CLIMB_SLING = 0.02;

/** The long gun is out of the sling and shows in the hands: past half the draw and off a ladder. */
export const longGunInHands = (rig: CharacterRig): boolean => rig.aiming && !rig.melee && rig.grip !== null && rig.drawn >= 0.5 && rig.climbBlend < CLIMB_SLING;

/**
 * How far the arms take the two-handed hold (0..1): the hands go to the gun over the draw just
 * before it leaves the sling (0.3..0.5), so it never shows in the air; none on a ladder.
 */
export const holdWeight = (rig: CharacterRig): number => {
  if (!rig.aiming || rig.melee || rig.grip === null || rig.climbBlend >= CLIMB_SLING) return 0;
  return smoothstep(Math.min(1, Math.max(0, (rig.drawn - 0.3) / 0.2)));
};

/** 0 the gun upright as it leaves the sling .. 1 carried (second half of the draw). */
const carried = (rig: CharacterRig): number => smoothstep(Math.min(1, Math.max(0, (rig.drawn - 0.5) / 0.5)));

/**
 * A long gun in both hands turns the body to the right (radians; 11° from the hip, 37° aimed),
 * its left shoulder towards the target (a bladed stance): the models' short arms (0.5 m) reach
 * the fore-end of a 0.8 m rifle, and the gun still points ahead.
 */
export const BLADE = { hip: 0.2, aimed: 0.65 } as const;

/** Elbow hints: the right elbow out and down, the left under the gun. */
const POLE_R = new Vector3(0.45, -0.9, 0.1).normalize();
const POLE_L = new Vector3(-0.35, -1, 0.1).normalize();

/** How far the left hand's fingers turn from across the gun towards the muzzle (radians). */
const LEFT_FINGERS = 0.75;
/** The fist's hole and the palm lie this far to the palm side of the hand's bones (metres). */
const PALM_SIDE = 0.018;

/** A long gun placed in the body's frame: the mount point, the barrel and the top. */
export interface GunPose {
  readonly origin: Vector3;
  readonly barrel: Vector3;
  readonly top: Vector3;
}

const v3 = (a: Vec): Vector3 => new Vector3(a[0], a[1], a[2]);
const lerp3 = (a: Vec, b: Vec, t: number): Vector3 => new Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);

/**
 * A direction in the world (level ground, facing ahead) in the frame of a body turned `blade`
 * to the right and then leaning `tilt` forward: what the body's turns undo.
 */
const intoBody = (v: Vector3, tilt: number, blade: number): Vector3 => {
  const cb = Math.cos(blade);
  const sb = Math.sin(blade);
  const x = v.x * cb - v.z * sb;
  const z = v.x * sb + v.z * cb;
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  return new Vector3(x, v.y * c + z * s, -v.y * s + z * c);
};

/** A point of the gun file in the body's frame. */
export const gunPoint = (pose: GunPose, g: TwoHandGrip, p: GunPoint): Vector3 =>
  pose.origin.add(pose.barrel.scale(p.x - g.grip.x)).add(pose.top.scale(p.y - g.grip.y));

/**
 * Where the gun is at `aim` (0 from the hip .. 1 aimed), with the body leaning `tilt` forward
 * and turned `blade` to the right: the butt at the chest or in the shoulder, the barrel level
 * ahead when aimed whatever the body does.
 */
export const longGunPose = (g: TwoHandGrip, reach: ArmReach, aim: number, tilt: number, blade: number, out = 1): GunPose => {
  const k = (reach.upper + reach.fore) / REF_ARM;
  const carry = g.shouldered ? CARRY.shouldered : CARRY.out;
  // Between the hip and the shoulder the butt swings out in front and in, clear of the upper arm.
  const at = lerp3(carry.hip.butt, carry.aimed.butt, aim).addInPlaceFromFloats(-0.75 * BUTT_ARC * 4 * aim * (1 - aim), 0, BUTT_ARC * 4 * aim * (1 - aim));
  const to = lerp3(carry.hip.barrel, carry.aimed.barrel, aim).normalize();
  const butt = reach.shoulderR.add(Vector3.Lerp(v3(carry.drawn.butt), at, out).scale(k));
  const barrel = intoBody(Vector3.Lerp(v3(carry.drawn.barrel).normalize(), to, out).normalize(), tilt, blade);
  const up = intoBody(Vector3.Up(), tilt, blade);
  const top = up.subtract(barrel.scale(Vector3.Dot(up, barrel))).normalize();
  const origin = butt.subtract(barrel.scale(g.butt.x - g.grip.x)).subtract(top.scale(g.butt.y - g.grip.y));
  return { origin, barrel, top };
};

/** Hand axes in the body: +X towards the right of the hand's back, -Y wrist to fingers, +Z the thumb. */
export interface HandFrame {
  readonly x: Vector3;
  readonly y: Vector3;
  readonly z: Vector3;
}

/** The gun's right side (its +X under the hand mount). */
const gunRight = (pose: GunPose): Vector3 => Vector3.Cross(pose.top, pose.barrel);

/** Right hand on the grip: the gun's frame, the fingers turned down and to the left by the grip's angles. */
const rightHand = (pose: GunPose, g: TwoHandGrip): HandFrame => {
  const side = gunRight(pose);
  const f1 = pose.barrel.scale(Math.cos(g.yaw)).subtract(side.scale(Math.sin(g.yaw)));
  const x = side.scale(Math.cos(g.yaw)).add(pose.barrel.scale(Math.sin(g.yaw)));
  const fingers = f1.scale(Math.cos(g.pitch)).subtract(pose.top.scale(Math.sin(g.pitch)));
  const thumb = f1.scale(Math.sin(g.pitch)).add(pose.top.scale(Math.cos(g.pitch)));
  return { x, y: fingers.negate(), z: thumb };
};

/** Left hand under the fore-end: palm up against it, fingers across to the right and forward, thumb along the barrel. */
const leftHand = (pose: GunPose): HandFrame => {
  const fingers = gunRight(pose).scale(Math.cos(LEFT_FINGERS)).add(pose.barrel.scale(Math.sin(LEFT_FINGERS)));
  const x = pose.top;
  const y = fingers.negate();
  return { x, y, z: Vector3.Cross(x, y) };
};

/** Joint turns that put a wrist on a target with the hand in a frame. */
export interface ArmSolution {
  /** Shoulder Euler angles (the rig joint's `rotation`). */
  readonly arm: Vector3;
  /** Elbow bend about its X (negative: the forearm comes forward). */
  readonly elbow: number;
  /** The hand's turn against the forearm. */
  readonly wrist: Quaternion;
}

/**
 * Two-bone IK in the body's frame: the elbow on the side of `pole`, the upper arm then the
 * forearm towards the wrist target (pulled in if out of reach), and the wrist turn that leaves
 * the hand in `hand`. The rig's joints: an arm points down its -Y at rest and bends at the
 * elbow about its X.
 */
export const solveArm = (shoulder: Vector3, upper: number, fore: number, target: Vector3, pole: Vector3, hand: HandFrame): ArmSolution => {
  const toTarget = target.subtract(shoulder);
  const dist = Math.min(Math.max(toTarget.length(), Math.abs(upper - fore) + 1e-3), (upper + fore) * 0.999);
  const d = toTarget.normalize();
  const along = (upper * upper - fore * fore + dist * dist) / (2 * dist);
  const out = Math.sqrt(Math.max(0, upper * upper - along * along));
  let n = pole.subtract(d.scale(Vector3.Dot(pole, d)));
  if (n.lengthSquared() < 1e-8) n = Vector3.Cross(d, Vector3.Right());
  n.normalize();
  const elbowAt = shoulder.add(d.scale(along)).add(n.scale(out));
  const u = elbowAt.subtract(shoulder).normalize();
  const f = shoulder.add(d.scale(dist)).subtract(elbowAt).normalize();
  let bendDir = f.subtract(u.scale(Vector3.Dot(f, u)));
  if (bendDir.lengthSquared() < 1e-8) bendDir = n.negate();
  const zl = bendDir.normalize();
  const yl = u.negate();
  const xl = Vector3.Cross(yl, zl);
  const arm = Quaternion.RotationQuaternionFromAxis(xl, yl, zl).toEulerAngles();
  const elbow = -Math.acos(Math.min(1, Math.max(-1, Vector3.Dot(u, f))));
  // The forearm's axes: the arm's, turned about X by the elbow.
  const yf = f.negate();
  const zf = Vector3.Cross(xl, yf);
  const local = (v: Vector3) => new Vector3(Vector3.Dot(v, xl), Vector3.Dot(v, yf), Vector3.Dot(v, zf));
  const wrist = Quaternion.RotationQuaternionFromAxis(local(hand.x), local(hand.y), local(hand.z));
  return { arm, elbow, wrist };
};

/** The wrist that puts the hand's centre, shifted `side` (−1 right, +1 left) towards its palm, on `centre`. */
const wristFor = (centre: Vector3, hand: HandFrame, palm: Vector3, side: number): Vector3 =>
  centre
    .subtract(hand.x.scale(side * PALM_SIDE + (side < 0 ? palm.x : -palm.x)))
    .subtract(hand.y.scale(palm.y))
    .subtract(hand.z.scale(palm.z));

/** The gun's place and, for each hand, the wrist target and the hand's frame. */
export interface TwoHandTargets {
  readonly pose: GunPose;
  readonly right: { readonly wrist: Vector3; readonly hand: HandFrame };
  readonly left: { readonly wrist: Vector3; readonly hand: HandFrame };
}

/** A magazine pouch on the left hip, from the left shoulder joint (reference-arm units). */
const POUCH: Vec = [0.02, -0.52, 0.1];

/**
 * Where the left hand is at `reload` (0..1..0 over a reload): from the fore-end to the magazine
 * (or the shotgun's loading port) and on down to the pouch, then back the same way.
 */
const leftHandAt = (pose: GunPose, g: TwoHandGrip, reach: ArmReach, reload: number): Vector3 => {
  const fore = gunPoint(pose, g, g.fore);
  if (reload <= 0) return fore;
  const mag = gunPoint(pose, g, g.mag);
  if (reload < 0.35) return Vector3.Lerp(fore, mag, smoothstep(reload / 0.35));
  const pouch = reach.shoulderL.add(v3(POUCH).scale((reach.upper + reach.fore) / REF_ARM));
  return Vector3.Lerp(mag, pouch, smoothstep((reload - 0.35) / 0.65));
};

export const twoHandTargets = (g: TwoHandGrip, reach: ArmReach, aim: number, tilt: number, blade: number, out = 1, reload = 0): TwoHandTargets => {
  const pose = longGunPose(g, reach, aim, tilt, blade, out);
  const right = rightHand(pose, g);
  const left = leftHand(pose);
  return {
    pose,
    right: { wrist: wristFor(gunPoint(pose, g, g.fist), right, reach.palm, -1), hand: right },
    left: { wrist: wristFor(leftHandAt(pose, g, reach, reload), left, reach.palm, 1), hand: left },
  };
};

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** How far the body turns into the bladed stance: with the aim, once the gun is in both hands. */
export const bladeOf = (rig: CharacterRig, w: number): number => (BLADE.hip + (BLADE.aimed - BLADE.hip) * smoothstep(Math.min(1, Math.max(0, rig.aim)))) * w;

/**
 * Both hands on a long gun (G-282): places the gun on the rig's `gunHold` node for this frame's
 * aim, lean and bladed stance, and turns both arms so that the right hand closes on the grip
 * and the left holds the fore-end, by `w` and `leftW` (0 leaves an arm as it is). Call after
 * the arm poses and the lean are set; the body takes the `bladeOf` turn after its own pose.
 * While the gun comes out of the sling it stands upright before the right shoulder; over a
 * reload (`reload` 0..1..0) the left hand fetches a magazine from the pouch on the left hip.
 */
export const holdLongGun = (rig: CharacterRig, g: TwoHandGrip, tilt: number, w: number, leftW: number, reload = 0): void => {
  const reach = rig.reach ?? rigReach(rig);
  const t = twoHandTargets(g, reach, smoothstep(Math.min(1, Math.max(0, rig.aim))), tilt, bladeOf(rig, w), carried(rig), reload);
  const hold = rig.gunHold;
  hold.position.copyFrom(t.pose.origin);
  // The mount's frame: barrel along -Y, top along +Z.
  const y = t.pose.barrel.negate();
  hold.rotationQuaternion = Quaternion.RotationQuaternionFromAxis(Vector3.Cross(y, t.pose.top), y, t.pose.top);
  applyArm(rig.armR, rig.elbowR, rig.wristR, solveArm(reach.shoulderR, reach.upper, reach.fore, t.right.wrist, POLE_R, t.right.hand), w);
  if (leftW > 0) applyArm(rig.armL, rig.elbowL, rig.wristL, solveArm(reach.shoulderL, reach.upper, reach.fore, t.left.wrist, POLE_L, t.left.hand), leftW);
};

type Joint = CharacterRig["armR"];

/** Turns an arm towards a solution by `w` (0 leaves it as it is). */
export const applyArm = (arm: Joint, elbow: Joint, wrist: Joint, s: ArmSolution, w: number): void => {
  const mix = (from: number, to: number) => from + (to - from) * w;
  arm.rotation.set(mix(arm.rotation.x, s.arm.x), mix(arm.rotation.y, s.arm.y), mix(arm.rotation.z, s.arm.z));
  elbow.rotation.x = mix(elbow.rotation.x, s.elbow);
  wrist.rotationQuaternion = Quaternion.Slerp(wrist.rotationQuaternion ?? Quaternion.Identity(), s.wrist, w);
};
