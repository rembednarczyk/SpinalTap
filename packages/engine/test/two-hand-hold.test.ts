import { beforeAll, describe, expect, it } from "vitest";
import { Matrix, Vector3 } from "../src/babylon";
import { type BodyVertex, gunShape, insideGun, onGun, skinnedBody } from "./body-geometry";
import { BODY, type Cast, GRIP_MIDDLE, LONG, POINTS, arm, cast, heldGun, palmOf, pose } from "./two-hand-cast";
import { worldOf } from "./t-pose";

const STANCES = [
  { name: "from the hip", aim: 0, crouch: 0, speed: 0 },
  { name: "aimed", aim: 1, crouch: 0, speed: 0 },
  { name: "walking from the hip", aim: 0, crouch: 0, speed: 2 },
  { name: "aimed in a crouch", aim: 1, crouch: 1, speed: 0 },
  { name: "crouch-walking from the hip", aim: 0, crouch: 1, speed: 0.8 },
] as const;

describe.each([["heroine"], ["ganger"], [null]] as const)("long guns held in both hands (G-282): %s", (who) => {
  let c: Cast;
  beforeAll(async () => {
    c = await cast(who);
  }, 60_000);

  it.each(LONG)("%s: the left hand lies on the fore-end and the right on the grip", async (kind) => {
    await arm(c, kind);
    for (const st of STANCES) {
      pose(c, st.aim, st.crouch, st.speed);
      const gun = gunShape(heldGun(c, kind)!);
      const p = POINTS[kind];
      const left = Vector3.Distance(palmOf(c, "L"), onGun(gun, ...p.fore));
      const right = Vector3.Distance(palmOf(c, "R"), onGun(gun, ...p.grip));
      // Before: one hand held every gun; the left hung at the side, 0.4-0.6 m off the fore-end.
      expect(left, `${st.name}: left palm to fore-end`).toBeLessThan(0.05);
      expect(right, `${st.name}: right palm to grip`).toBeLessThan(0.05);
    }
  });

  it.each(["rifle", "shotgun"] as const)("%s: aimed, the butt sits at the right shoulder and the barrel points ahead", async (kind) => {
    await arm(c, kind);
    pose(c, 1);
    const gun = gunShape(heldGun(c, kind)!);
    const [bx, by] = POINTS[kind].butt!;
    const butt = onGun(gun, bx, by);
    const muzzle = onGun(gun, gun.max.x, 0);
    const shoulder = c.meshes ? worldOf(c.bone("R_UpperArm")) : worldOf(c.rig.armR);
    // Before: the butt hung 0.3-0.4 m ahead of the shoulder on a straight arm.
    expect(Vector3.Distance(butt, shoulder), "butt to shoulder joint").toBeLessThan(0.14);
    expect(butt.z, "butt in front of the shoulder").toBeGreaterThan(shoulder.z);
    expect(Math.abs(butt.y - shoulder.y), "butt at shoulder height").toBeLessThan(0.08);
    const barrel = muzzle.subtract(butt).normalize();
    expect(barrel.z, "barrel forward").toBeGreaterThan(0.95);
    if (c.meshes) {
      // In contact: the skin or cloth of the shoulder within a few centimetres of the butt plate.
      const near = Math.min(...skinnedBody(c.meshes).filter((v) => /UpperChest|Shoulder|UpperArm|Chest/.test(v.bone) && /_R_|_C_/.test(v.bone)).map((v) => Vector3.Distance(v.at, butt)));
      expect(near, "butt to the shoulder's surface").toBeLessThan(0.05);
    }
  });

  // Imported models only: the procedural rig has no skin to measure.
  if (who === null) return;

  it.each(LONG)("%s: the gun passes through neither the torso nor the arms", async (kind) => {
    await arm(c, kind);
    for (const st of STANCES) {
      pose(c, st.aim, st.crouch, st.speed);
      const gun = gunShape(heldGun(c, kind)!);
      const inverse = Matrix.Invert(gun.world);
      const body = skinnedBody(c.meshes!, /body|face/i).filter((v) => BODY.test(v.bone));
      const inside: BodyVertex[] = body.filter((v) => insideGun(gun, v.at, inverse, 0.004));
      expect(body.length).toBeGreaterThan(1000);
      const where = inside.slice(0, 8).map((v) => {
        const q = Vector3.TransformCoordinates(v.at, inverse);
        return `${v.bone}@${q.x.toFixed(3)},${q.y.toFixed(3)},${q.z.toFixed(3)}`;
      });
      expect([inside.length, ...where], `${st.name}: body vertices inside the gun`).toEqual([0]);
    }
  });

  it.each(["pistol", "revolver", ...LONG] as const)("%s: the right hand's fingers close round the grip", async (kind) => {
    await arm(c, kind);
    for (const aim of [0, 1]) {
      pose(c, aim);
      const grip = onGun(gunShape(heldGun(c, kind)!), ...GRIP_MIDDLE[kind]);
      const palm = palmOf(c, "R");
      // The way the right palm faces: across the knuckles (little to index) and along the hand.
      const along = worldOf(c.bone("R_Middle1")).subtract(worldOf(c.bone("R_Hand")));
      const across = worldOf(c.bone("R_Index1")).subtract(worldOf(c.bone("R_Little1")));
      const palmSide = Vector3.Cross(along, across).normalize();
      for (const finger of ["Thumb", "Index", "Middle", "Ring"]) {
        const tip = worldOf(c.bone(`R_${finger}3_end`));
        // Open (the model's bind pose) the tips stood 0.1-0.14 m off the grip.
        expect(Vector3.Distance(tip, grip), `aim ${aim}: ${finger} tip to the middle of the grip`).toBeLessThan(0.07);
        // Curled the wrong way they end up round the back of the hand.
        expect(Vector3.Dot(tip.subtract(palm), palmSide), `aim ${aim}: ${finger} tip on the palm side`).toBeGreaterThan(0);
      }
    }
  });
});
