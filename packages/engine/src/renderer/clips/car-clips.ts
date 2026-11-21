import type { CarAct, CarPose } from "@seki/core";
import { Quaternion, Vector3 } from "../../babylon";
import type { CharacterRig } from "../character-rig";
import type { BodyClip } from "./body-clip";
import { BODY_CLIPS } from "./body-clips.generated";
import { type BodyFrame, mixFrames, sampleBody } from "./body-sample";
import { RIG_LEG, poseLeg } from "./leg-pose";
import { poseArm } from "./pose-lay";

/*
 * The figure at a car from the user's Mixamo clips (ADR-0097, 21.11): seated at the wheel
 * (“Driving”), pressing the horn (“Honking Horn”), getting in at the driver's door (“Entering
 * Car”) and out of it (“Exiting Car”); a taken car's driver pulled out (“Removing Driver”),
 * thrown onto the road (“Hit By Car”) and getting up (the hard landing's crouch to its feet). The simulation keeps the clip's time (`Transform.car`);
 * here the clip lays the whole body (the torso turned about the hips, the hips carried as in the
 * clip, the arms and legs), as the death clips do, with the hips put on the car's seat.
 *
 * The clips' car is taller than ours: seated, Mixamo's hips sit only a fifth of a leg under its
 * standing ones. So the hips' height goes by how far the figure stands in the clip at that moment:
 * seated, on our seat; standing, a standing figure's height over the ground by the door.
 * Pulled out, the clip's driver rises in his tall seat before he is dragged out sideways; under our
 * roof (1.15 m) his head would go through it (user's notes of 21.11). There he stands only as far
 * as his hips have come out of the door (`OUT`).
 */

interface Act {
  readonly clip: BodyClip;
  readonly loop: boolean;
  /** The clip's facing against the car's heading: getting in, it faces the car's side. */
  readonly turn: number;
}
const ACTS: Readonly<Record<CarAct, Act>> = {
  drive: { clip: BODY_CLIPS.carDrive, loop: true, turn: 0 },
  horn: { clip: BODY_CLIPS.carHorn, loop: false, turn: 0 },
  enter: { clip: BODY_CLIPS.carEnter, loop: false, turn: Math.PI / 2 },
  exit: { clip: BODY_CLIPS.carExit, loop: false, turn: 0 },
  pulled: { clip: BODY_CLIPS.carJack, loop: false, turn: 0 },
  thrown: { clip: BODY_CLIPS.carHit, loop: false, turn: 0 },
  getup: { clip: BODY_CLIPS.hardLanding, loop: false, turn: 0 },
};
/** On the ground (the yaw given is the figure's own): the hips go as the clip carries them from a standing figure's. */
const ON_GROUND: ReadonlySet<CarAct> = new Set(["thrown", "getup"]);
/** Getting up starts from how the throw left the figure, and eases into the landing's crouch over this long (s of clip). */
const GETUP_EASE = 0.35;
const GETUP_FROM = 0.9;

/**
 * Pulled out: how far the hips go out of the seat sideways (leg lengths, the clip's -x) before he
 * may start to stand, and by when he stands as the clip has him: his head out of the door by then.
 */
const OUT = { from: 0.3, to: 0.7 } as const;
const smooth = (k: number): number => k * k * (3 - 2 * k);
/** How far out of the door the pulled driver is (0..1); 1 for every other act. */
const outOfDoor = (act: CarAct, f: BodyFrame): number => {
  if (act !== "pulled") return 1;
  return smooth(Math.min(1, Math.max(0, (-f.hips.x - OUT.from) / (OUT.to - OUT.from))));
};

/** How high the hips stand in a clip's standing end over its seated one (leg lengths): the enter's start, the exit's end. */
const standingRise = (clip: BodyClip, last: boolean): number => clip.hips[(last ? clip.frames - 1 : 0) * 3 + 1] ?? 0;
const RISE: Readonly<Record<CarAct, number>> = {
  drive: 0,
  horn: 0,
  enter: standingRise(BODY_CLIPS.carEnter, false),
  exit: standingRise(BODY_CLIPS.carExit, true),
  pulled: standingRise(BODY_CLIPS.carJack, true),
  thrown: 0,
  getup: 0,
};

/** The clip's frame now; getting up, eased out of the throw's last frame into the landing's crouch. */
const frameOf = (car: CarPose, act: Act): BodyFrame => {
  const f = sampleBody(act.clip, car.t, act.loop);
  if (car.act !== "getup") return f;
  const k = Math.min(1, Math.max(0, (car.t - GETUP_FROM) / GETUP_EASE));
  return k >= 1 ? f : mixFrames(sampleBody(BODY_CLIPS.carHit, BODY_CLIPS.carHit.cycle, false), f, k * k * (3 - 2 * k));
};

/** Lays the clip of what the figure does at its car, after `animateRig`; the root goes to the car's seat. */
export const poseAtCar = (rig: CharacterRig, car: CarPose): void => {
  const act = ACTS[car.act];
  const f = frameOf(car, act);
  // A dressed model hangs on the body with its hips its own legs' length over its feet: those go on the seat.
  const hipH = rig.hips ?? rig.legL.position.y;
  // 0 seated .. 1 standing: on the seat, or a standing figure's hips over the ground by the door.
  // On the ground the clip's hips go from a standing figure's over `floor`.
  const rise = RISE[car.act];
  const stand = rise > 1e-3 ? Math.min(outOfDoor(car.act, f), Math.max(0, Math.min(1, f.hips.y / rise))) : 0;
  const hipsY = ON_GROUND.has(car.act) ? car.floor + hipH + f.hips.y * RIG_LEG : car.seat.y + stand * (car.floor + hipH - car.seat.y);
  rig.root.rotation.set(0, car.yaw + act.turn, 0);
  rig.root.position.set(car.seat.x, hipsY - hipH - f.hips.y * RIG_LEG, car.seat.z);
  const b = rig.body;
  const hip = new Vector3(0, hipH, 0);
  b.rotation.copyFrom(f.chest.toEulerAngles());
  b.position.copyFrom(hip.subtract(hip.applyRotationQuaternion(f.chest)).add(f.hips.scale(RIG_LEG)));
  rig.head.rotation.copyFrom(f.head.toEulerAngles());
  const unlean = Quaternion.Inverse(f.chest);
  poseLeg(rig.legL, rig.kneeL, [...f.legs], 0, 1, unlean, 1);
  poseLeg(rig.legR, rig.kneeR, [...f.legs], 12, 1, unlean, 1);
  for (const e of [rig.elbowL, rig.elbowR]) e.rotation.y = e.rotation.z = 0;
  poseArm(rig.armL, rig.elbowL, rig.wristL, f.arms, 0, 1);
  poseArm(rig.armR, rig.elbowR, rig.wristR, f.arms, 9, 1);
};
