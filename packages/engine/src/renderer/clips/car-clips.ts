import type { CarAct, CarPose } from "@seki/core";
import { Quaternion, Vector3 } from "../../babylon";
import type { CharacterRig } from "../character-rig";
import type { BodyClip } from "./body-clip";
import { BODY_CLIPS } from "./body-clips.generated";
import { sampleBody } from "./body-sample";
import { RIG_LEG, poseLeg } from "./leg-pose";
import { poseArm } from "./pose-lay";

/*
 * The figure at a car from the user's Mixamo clips (ADR-0097, 21.11): seated at the wheel
 * (“Driving”), pressing the horn (“Honking Horn”), getting in at the driver's door (“Entering
 * Car”) and out of it (“Exiting Car”). The simulation keeps the clip's time (`Transform.car`);
 * here the clip lays the whole body (the torso turned about the hips, the hips carried as in the
 * clip, the arms and legs), as the death clips do, with the hips put on the car's seat.
 *
 * The clips' car is taller than ours: seated, Mixamo's hips sit only a fifth of a leg under its
 * standing ones. So the hips' height goes by how far the figure stands in the clip at that moment:
 * seated, on our seat; standing, a standing figure's height over the ground by the door.
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
};

/** How high the hips stand in a clip's standing end over its seated one (leg lengths): the enter's start, the exit's end. */
const standingRise = (clip: BodyClip, last: boolean): number => clip.hips[(last ? clip.frames - 1 : 0) * 3 + 1] ?? 0;
const RISE: Readonly<Record<CarAct, number>> = {
  drive: 0,
  horn: 0,
  enter: standingRise(BODY_CLIPS.carEnter, false),
  exit: standingRise(BODY_CLIPS.carExit, true),
};

/** Lays the clip of what the figure does at its car, after `animateRig`; the root goes to the car's seat. */
export const poseAtCar = (rig: CharacterRig, car: CarPose): void => {
  const act = ACTS[car.act];
  const f = sampleBody(act.clip, car.t, act.loop);
  const hipH = rig.legL.position.y;
  // 0 seated .. 1 standing: on the seat, or a standing figure's hips over the ground by the door.
  const rise = RISE[car.act];
  const stand = rise > 1e-3 ? Math.max(0, Math.min(1, f.hips.y / rise)) : 0;
  const hipsY = car.seat.y + stand * (car.floor + hipH - car.seat.y);
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
