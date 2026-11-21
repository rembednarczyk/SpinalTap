import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { CarPose } from "@seki/core";
import { describe, expect, it } from "vitest";
import { Scene, type Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { type CharacterRig, animateRig, buildCivilian } from "../src/renderer/characters";
import { poseAtCar } from "../src/renderer/clips/car-clips";

/*
 * A taken car's driver pulled out of the seat (ADR-0097, user's notes of 21.11): his head stays
 * inside the car until he is out of its door. Mixamo's car is taller than ours, so in the clip he
 * rises in the seat before he is pulled out sideways; here he rises as he comes out of the door.
 * The car stands at the origin heading +Z, its driver's door on its left (-X); the street car's
 * seat (`driverSeat` of a 1.82 m wide car) and its roof at about 1.15 m.
 */

const scene = new Scene(new NullEngine());
const materials = new ToonMaterials(scene);
const SIDE = 0.91;
const SEAT = { x: -0.38, y: 0.26, z: -0.36 };
/** The pull's span the simulation plays (s of clip, `ejected-driver.ts`). */
const PULL_TO = 3.6;

const headAt = (r: CharacterRig): Vector3 => {
  r.root.computeWorldMatrix(true);
  return r.head.computeWorldMatrix(true).getTranslation().clone();
};

const pulled = (r: CharacterRig, t: number): Vector3 => {
  animateRig(r, 0, 1 / 60);
  poseAtCar(r, { act: "pulled", t, yaw: 0, seat: SEAT, floor: 0 } satisfies CarPose);
  return headAt(r);
};

describe("the pulled driver's head (ADR-0097)", () => {
  it("is no higher than seated while it is over the car, and stands up once out of the door", () => {
    const r = buildCivilian(scene, materials, "pulled-driver");
    const seated = pulled(r, 0);
    let worst = -Infinity;
    for (let t = 0; t <= PULL_TO + 1e-6; t += 0.05) {
      const h = pulled(r, t);
      if (h.x > -SIDE) worst = Math.max(worst, h.y - seated.y);
    }
    expect(worst).toBeLessThan(0.05);
    // Out of the door at the end of the pull, he stands as the clip has him (bent, dragged by the arm).
    const out = pulled(r, PULL_TO);
    expect(out.x).toBeLessThan(-SIDE);
    expect(out.y - seated.y).toBeGreaterThan(0.3);
  });
});
