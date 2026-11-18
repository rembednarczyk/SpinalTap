import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene, Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { type CharacterRig, animateRig, buildHeroine } from "../src/renderer/characters";
import { poseBodyFromClips } from "../src/renderer/clips/body-pose";
import { poseLegsFromClips } from "../src/renderer/clips/leg-pose";

/*
 * Jumps, falls and hard landings from Mixamo's Action Adventure clips (ADR-0090): the legs tuck
 * on the way up, a drop of 7 m/s and more lands on bent knees and gets up over two seconds, a
 * lighter one keeps the procedural dip.
 */

const scene = new Scene(new NullEngine());
const materials = new ToonMaterials(scene);
const DT = 1 / 30;

/** One frame as the views run it; `air` the vertical speed off the ground, undefined on it. */
const frame = (r: CharacterRig, air: number | undefined, speed = 0): void => {
  animateRig(r, speed, DT, 0, {}, air === undefined ? {} : { air });
  poseLegsFromClips(r, { x: 0, z: 0 }, speed, DT, 0);
  poseBodyFromClips(r, speed, DT, 0);
};

const world = (r: CharacterRig, n: CharacterRig["head"]): Vector3 => {
  r.root.computeWorldMatrix(true);
  return n.computeWorldMatrix(true).getTranslation().clone();
};
/** The left ankle's height over the hips (the knee's end, the rig's shin of 0.42 m). */
const ankleUnderHips = (r: CharacterRig): number => {
  const ankle = Vector3.TransformCoordinates(new Vector3(0, -0.42, 0), r.kneeL.computeWorldMatrix(true));
  return world(r, r.legL).y - ankle.y;
};

describe("off the ground and landing, from the clips (ADR-0090)", () => {
  it("springing up the legs tuck; standing they hang straight", () => {
    const r = buildHeroine(scene, materials, "jumper");
    for (let i = 0; i < 30; i++) frame(r, undefined);
    const standing = ankleUnderHips(r);
    for (let i = 0; i < 12; i++) frame(r, 4);
    expect(standing - ankleUnderHips(r)).toBeGreaterThan(0.15);
  });

  it("a hard landing goes down on bent knees and gets up over two seconds", () => {
    const r = buildHeroine(scene, materials, "hard");
    for (let i = 0; i < 30; i++) frame(r, undefined);
    const stand = world(r, r.head).y;
    for (let i = 0; i < 20; i++) frame(r, -9);
    let lowest = Infinity;
    for (let i = 0; i < 0.8 / DT; i++) {
      frame(r, undefined);
      lowest = Math.min(lowest, world(r, r.head).y);
    }
    expect(stand - lowest).toBeGreaterThan(0.25);
    for (let i = 0; i < 1.5 / DT; i++) frame(r, undefined);
    expect(Math.abs(world(r, r.head).y - stand)).toBeLessThan(0.05);
  });

  it("a light landing and one running on keep the quick procedural dip", () => {
    for (const [name, fall, speed] of [
      ["light", -4, 0],
      ["runner", -9, 4],
    ] as const) {
      const r = buildHeroine(scene, materials, name);
      for (let i = 0; i < 30; i++) frame(r, undefined, speed);
      const stand = world(r, r.head).y;
      for (let i = 0; i < 20; i++) frame(r, fall, speed);
      for (let i = 0; i < 0.6 / DT; i++) frame(r, undefined, speed);
      expect(Math.abs(world(r, r.head).y - stand), name).toBeLessThan(0.06);
    }
  });
});
