import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { beforeAll, describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { ACTIVITY_BLEND_SECONDS } from "../src/renderer/activity-poses";
import { CharacterActivities } from "../src/renderer/character-activities";
import { type CharacterRig, animateRig, buildCivilian } from "../src/renderer/characters";
import { poseBodyFromClips } from "../src/renderer/clips/body-pose";
import { poseLegsFromClips } from "../src/renderer/clips/leg-pose";
import { type Cast, cast } from "./two-hand-cast";

/*
 * G-732: getting up from a seat and walking off, the figure stands up as it sets off: the hips
 * come up, the legs walk and nothing of the seated pose (or the skirt hidden for it) stays on
 * while it walks.
 */

const scene = new Scene(new NullEngine());
const materials = new ToonMaterials(scene);
const DT = 1 / 60;

/** One frame as the character views run it. */
const frame = (acts: CharacterActivities, id: number, r: CharacterRig, speed: number, z: number): void => {
  animateRig(r, speed, DT);
  poseLegsFromClips(r, { x: 0, z }, speed, DT, 0);
  poseBodyFromClips(r, speed, DT, 0);
  acts.apply(id, r, speed, DT, null);
};

describe("G-732: up from the seat and walking", () => {
  it("stands up as it sets off and walks with nothing of the seated pose", () => {
    const acts = new CharacterActivities(scene, materials, () => ({ x: 0, y: 1.6, z: -3 }));
    const r = buildCivilian(scene, materials, "seated-walk");
    const twin = buildCivilian(scene, materials, "seated-walk");
    acts.set(1, "sit");
    let z = 0;
    for (let i = 0; i < 120; i++) {
      frame(acts, 1, r, 0, z);
      frame(acts, 2, twin, 0, z);
    }
    expect(r.doing).toEqual(["sit"]);
    expect(r.body.position.y).toBeLessThan(twin.body.position.y - 0.3);
    // It sets off: the simulation drops the activity once it walks faster than 0.3 m/s (`activityOf`).
    let walking = 0;
    let worst = 0;
    for (let i = 0; i < 90; i++) {
      const speed = Math.min(1.2, i * DT * 2.4);
      if (speed > 0.3) acts.set(1, null);
      z += speed * DT;
      frame(acts, 1, r, speed, z);
      frame(acts, 2, twin, speed, z);
      if (speed > 0.6) walking += DT;
      if (walking > ACTIVITY_BLEND_SECONDS + 0.05) {
        expect(r.doing ?? [], `${i}`).toEqual([]);
        // The hips as high as the twin's that never sat; the knees within the idle's ease-out.
        worst = Math.max(worst, Math.abs(r.body.position.y - twin.body.position.y));
        expect(Math.abs(r.kneeL.rotation.x - twin.kneeL.rotation.x), `${i}`).toBeLessThan(0.03);
      }
    }
    expect(walking).toBeGreaterThan(0.5);
    expect(worst).toBeLessThan(0.01);
    expect(acts.count).toBe(0);
  });
});

describe("G-732: the dressed model up from the seat", () => {
  let c: Cast;
  beforeAll(async () => {
    c = await cast("heroine");
  }, 60_000);

  it("walks off with its feet on the ground and the skirt shown again", () => {
    const acts = new CharacterActivities(c.scene, materials, () => ({ x: 0, y: 1.6, z: -3 }));
    const foot = () => Math.min(c.bone("L_Foot").getAbsolutePosition().y, c.bone("R_Foot").getAbsolutePosition().y);
    const step = (speed: number, z: number) => {
      c.rig.root.position.z = z;
      frame(acts, 1, c.rig, speed, z);
      c.models.update(DT, DT);
      c.rig.root.computeWorldMatrix(true);
    };
    for (let i = 0; i < 30; i++) step(0, 0);
    const standing = foot();
    acts.set(1, "sit");
    for (let i = 0; i < 120; i++) step(0, 0);
    let z = 0;
    let lowest = Infinity;
    for (let i = 0; i < 120; i++) {
      const speed = Math.min(1.2, i * DT * 2.4);
      if (speed > 0.3) acts.set(1, null);
      z += speed * DT;
      step(speed, z);
      if (i > 60) lowest = Math.min(lowest, foot());
    }
    expect(c.rig.doing ?? []).toEqual([]);
    // Walking, the feet come no lower than standing (a few cm for the ankle's roll).
    expect(lowest).toBeGreaterThan(standing - 0.04);
  });
});
