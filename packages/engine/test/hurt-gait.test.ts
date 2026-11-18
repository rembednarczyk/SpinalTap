import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { type CharacterRig, animateRig, buildHeroine } from "../src/renderer/characters";
import { poseBodyFromClips } from "../src/renderer/clips/body-pose";
import { LEG_CLIPS } from "../src/renderer/clips/leg-clips.generated";
import { legWeights, poseLegsFromClips } from "../src/renderer/clips/leg-pose";

/*
 * ADR-0090 point 14: a hurt figure limps ahead and back with the Male Injured Pack's walk and
 * run, as far as it is hurt, and stands bent over the wound; sideways it steps as ever.
 */

const scene = new Scene(new NullEngine());
const materials = new ToonMaterials(scene);
const DT = 1 / 30;

const frame = (r: CharacterRig, speed: number, z: number): void => {
  animateRig(r, speed, DT);
  poseLegsFromClips(r, { x: 0, z }, speed, DT, 0);
  poseBodyFromClips(r, speed, DT, 0);
};
const joints = (r: CharacterRig): number[] => [r.body, r.head, r.armL, r.legL, r.kneeL, r.legR, r.kneeR].flatMap((n) => (n.rotationQuaternion ?? n.rotation.toQuaternion()).asArray());
const differs = (a: readonly number[], b: readonly number[]): number => Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));

describe("ADR-0090 point 14: the injured walk and stance", () => {
  it("the mix: ahead and back the hurt clips as far as hurt, sideways the plain ones", () => {
    const share = (mix: ReturnType<typeof legWeights>, clip: object) => mix.filter(([c]) => c === clip).reduce((a, [, w]) => a + w, 0);
    expect(share(legWeights(0, 0, 0, false, 1), LEG_CLIPS.walkHurt)).toBeCloseTo(1, 6);
    expect(share(legWeights(0, 0, 0, false, 0.25), LEG_CLIPS.walkHurt)).toBeCloseTo(0.25, 6);
    expect(share(legWeights(Math.PI, 1, 0, false, 1), LEG_CLIPS.runBackHurt)).toBeCloseTo(1, 6);
    expect(share(legWeights(Math.PI / 2, 0, 0, false, 1), LEG_CLIPS.walkRight)).toBeCloseTo(1, 6);
    // Unhurt, the mix is as before.
    expect(share(legWeights(0, 0, 0, false, 0), LEG_CLIPS.walkHurt)).toBe(0);
  });

  it("walking and standing, a hurt figure moves otherwise than an unhurt twin", () => {
    const [hurt, fine] = [buildHeroine(scene, materials, "hurt-a"), buildHeroine(scene, materials, "hurt-a")];
    hurt.hurt = 1;
    let z = 0;
    let walking = 0;
    for (let i = 0; i < 60; i++) {
      z += 1.2 * DT;
      frame(hurt, 1.2, z);
      frame(fine, 1.2, z);
      walking = Math.max(walking, differs(joints(hurt), joints(fine)));
    }
    expect(walking).toBeGreaterThan(0.05);
    let standing = 0;
    for (let i = 0; i < 90; i++) {
      frame(hurt, 0, z);
      frame(fine, 0, z);
      if (i > 60) standing = Math.max(standing, differs(joints(hurt), joints(fine)));
    }
    expect(standing).toBeGreaterThan(0.05);
  });
});
