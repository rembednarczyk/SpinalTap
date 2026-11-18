import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene, type TransformNode, Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { type CharacterRig, animateRig, buildHeroine } from "../src/renderer/characters";
import { LEG_CLIPS } from "../src/renderer/clips/leg-clips.generated";
import { headingOf, legWeights, poseLegsFromClips, sampleLegs, strideOf } from "../src/renderer/clips/leg-pose";

/*
 * The legs from Mixamo's locomotion clips (ADR-0090): mixed by the way the character moves against
 * its facing, run with the ground covered, turned into the rig's thighs and knees.
 */

const rig = (): CharacterRig => {
  const scene = new Scene(new NullEngine());
  return buildHeroine(scene, new ToonMaterials(scene), "h");
};

const world = (n: TransformNode): Vector3 => {
  n.computeWorldMatrix(true);
  return n.getAbsolutePosition().clone();
};

/** Walks `r` from x, z along (dx, dz) per second at `speed` for `seconds`, facing +Z; its ankles' sideways and forward reach from the hips over the walk. */
const walk = (r: CharacterRig, dx: number, dz: number, speed: number, seconds: number) => {
  const dt = 1 / 60;
  let x = 0;
  let z = 0;
  const reach = { side: 0, ahead: 0 };
  for (let i = 0; i < seconds * 60; i++) {
    x += dx * speed * dt;
    z += dz * speed * dt;
    r.root.position.set(x, 0, z);
    animateRig(r, speed, dt);
    poseLegsFromClips(r, { x, z }, speed, dt, 0);
    r.root.computeWorldMatrix(true);
    const hip = world(r.legL);
    for (const k of [r.kneeL, r.kneeR]) {
      const ankle = Vector3.TransformCoordinates(new Vector3(0, -0.42, 0), k.computeWorldMatrix(true));
      reach.side = Math.max(reach.side, Math.abs(ankle.x - hip.x));
      reach.ahead = Math.max(reach.ahead, Math.abs(ankle.z - hip.z));
    }
  }
  return reach;
};

describe("legs from the locomotion clips (ADR-0090)", () => {
  it("are made of the fifteen clips (two of them a man's walk and run ahead), each a loop with its stride the way it goes", () => {
    expect(Object.keys(LEG_CLIPS).sort()).toEqual(["crouch", "crouchBackLeft", "crouchBackRight", "crouchLeft", "crouchRight", "run", "runBack", "runBackHurt", "runHurt", "runLeft", "runM", "runRight", "walk", "walkBack", "walkBackHurt", "walkHurt", "walkLeft", "walkM", "walkRight"]);
    // The left ones crouched are the right ones mirrored.
    expect(LEG_CLIPS.crouchLeft.stride.x).toBeCloseTo(-LEG_CLIPS.crouchRight.stride.x, 9);
    expect(LEG_CLIPS.walk.stride.z).toBeGreaterThan(1);
    expect(LEG_CLIPS.walkM.stride.z).toBeGreaterThan(1);
    expect(LEG_CLIPS.runM.stride.z).toBeGreaterThan(LEG_CLIPS.walkM.stride.z);
    expect(LEG_CLIPS.walkBack.stride.z).toBeLessThan(-1);
    expect(LEG_CLIPS.walkLeft.stride.x).toBeLessThan(-1);
    expect(LEG_CLIPS.walkRight.stride.x).toBeGreaterThan(1);
    for (const c of Object.values(LEG_CLIPS)) expect(c.legs.length).toBe(c.frames * 24);
  });

  it("mix by the heading: ahead the forward clip, to the right the right one, between both; the weights sum to one", () => {
    const names = (h: number, run = 0) => legWeights(h, run).map(([c, w]) => [Object.entries(LEG_CLIPS).find(([, v]) => v === c)![0], Math.round(w * 100) / 100]);
    expect(names(0)).toEqual([["walk", 1]]);
    expect(names(Math.PI / 2)).toEqual([["walkRight", 1]]);
    expect(names(-Math.PI / 2, 1)).toEqual([["runLeft", 1]]);
    expect(names(Math.PI / 4)).toEqual([
      ["walk", 0.5],
      ["walkRight", 0.5],
    ]);
    for (const h of [0.3, 2, -2.5]) expect(legWeights(h, 0.4).reduce((a, [, w]) => a + w, 0)).toBeCloseTo(1, 9);
    expect(strideOf(legWeights(0, 0))).toBeCloseTo(Math.hypot(LEG_CLIPS.walk.stride.x, LEG_CLIPS.walk.stride.z), 9);
  });

  it("read the heading from a step against the facing: ahead, to the right, back", () => {
    expect(headingOf(0, 1, 0)).toBeCloseTo(0, 9);
    expect(headingOf(1, 0, 0)).toBeCloseTo(Math.PI / 2, 9);
    expect(Math.abs(headingOf(0, -1, 0))).toBeCloseTo(Math.PI, 9);
    // Facing +X (yaw π/2), a step towards -Z is to its right.
    expect(headingOf(0, -1, Math.PI / 2)).toBeCloseTo(Math.PI / 2, 9);
  });

  it("swing the feet ahead and behind in a walk, apart sideways in a sidestep", () => {
    // The left ankle's z goes from ahead to behind and back over a loop: it spans more than a foot.
    const zs = Array.from({ length: 20 }, (_, i) => sampleLegs(legWeights(0, 0), i / 20)[8]!);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(0.5);
    const ahead = walk(rig(), 0, 1, 1.4, 3);
    const aside = walk(rig(), 1, 0, 1.4, 3);
    // Walking ahead the feet reach far forward and stay under the hips sideways; sidestepping, the other way round.
    expect(ahead.ahead).toBeGreaterThan(0.25);
    expect(aside.side).toBeGreaterThan(ahead.side + 0.1);
    expect(aside.ahead).toBeLessThan(ahead.ahead);
  });

  it("leave the procedural legs standing still; crouched and moving, take the crouching walks", () => {
    const r = rig();
    animateRig(r, 0, 1 / 60);
    const before = r.legL.rotation.clone();
    poseLegsFromClips(r, { x: 0, z: 0 }, 0, 1 / 60, 0);
    poseLegsFromClips(r, { x: 0, z: 0.01 }, 0.1, 1 / 60, 0);
    expect(r.legL.rotation.subtract(before).length()).toBeLessThan(1e-9);
    expect(legWeights(0, 0, 1).map(([c]) => c)).toEqual([LEG_CLIPS.crouch]);
    expect(legWeights(Math.PI * 0.9, 0, 1).map(([c]) => c)).toContain(LEG_CLIPS.crouchBackRight);
    expect(legWeights(-Math.PI * 0.9, 0, 1).map(([c]) => c)).toContain(LEG_CLIPS.crouchBackLeft);
    // Crouched, the knees bend deeper than walking upright.
    const knee = (crouch: number) => {
      const k = rig();
      let most = 0;
      for (let i = 0; i < 90; i++) {
        animateRig(k, 1.2, 1 / 60, crouch);
        poseLegsFromClips(k, { x: 0, z: (i * 1.2) / 60 }, 1.2, 1 / 60, crouch);
        most = Math.max(most, Math.abs(k.kneeL.rotation.x));
      }
      return most;
    };
    expect(knee(1)).toBeGreaterThan(knee(0) + 0.2);
  });
});
