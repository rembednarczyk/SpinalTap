import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { ACTIVITY_IDS } from "@seki/core";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import {
  ACTIVITY_BLEND_SECONDS,
  activityJoints,
  blendJoints,
  emberGlow,
  freshBlend,
  isSeated,
  propsOf,
  pulse,
  setBlendTarget,
  smokeDrag,
  stepBlend,
} from "../src/renderer/activity-poses";
import { applyActivityPose, plantedOffset } from "../src/renderer/activity-rig";
import { CharacterActivities } from "../src/renderer/character-activities";
import { CHARACTER_DRAW_DISTANCE, withinDrawDistance } from "../src/renderer/character-lod";
import { animateRig, buildCivilian, buildGanger, setWeaponDrawn } from "../src/renderer/characters";

const scene = new Scene(new NullEngine());
const materials = new ToonMaterials(scene);
const DT = 1 / 60;

describe("activity poses (ADR-0040)", () => {
  it("every activity has a finite pose all through its loop", () => {
    for (const a of ACTIVITY_IDS) {
      for (let t = 0; t < 12; t += 0.37) for (const v of Object.values(activityJoints(a, t))) expect(Number.isFinite(v), a).toBe(true);
    }
  });

  it("smoking brings the hand to the mouth every few seconds, and the tip glows brighter on the drag", () => {
    expect(smokeDrag(0)).toBe(0);
    expect(smokeDrag(0.9)).toBe(1);
    expect(smokeDrag(3)).toBe(0);
    const atMouth = activityJoints("smoke", 0.9);
    const down = activityJoints("smoke", 3);
    expect(atMouth.elbowR).toBeLessThan(-2.2);
    expect(down.elbowR).toBeGreaterThan(-1.2);
    expect(emberGlow(1.3)).toBeGreaterThan(0.9);
    expect(emberGlow(5)).toBeCloseTo(0.35);
    for (let t = 0; t < 12; t += 0.1) expect(emberGlow(t)).toBeGreaterThanOrEqual(0.35);
  });

  it("the phone is held at the ear, the guard looks around, sitting and sleeping bend the legs", () => {
    expect(activityJoints("phone", 1).elbowR).toBeLessThan(-2.3);
    const looks = Array.from({ length: 40 }, (_, i) => activityJoints("guard", i * 0.5).headY);
    expect(Math.max(...looks) - Math.min(...looks)).toBeGreaterThan(0.5);
    for (const a of ["sit", "sleep"] as const) {
      expect(isSeated(a)).toBe(true);
      expect(activityJoints(a, 0).legLX).toBeLessThan(-1.3);
      expect(activityJoints(a, 0).kneeL).toBeGreaterThan(1.3);
    }
    expect(activityJoints("sleep", 0).headX).toBeGreaterThan(0.4);
    expect(propsOf("smoke")).toEqual(["cigarette"]);
    expect(propsOf("sit")).toEqual(["stool"]);
    expect(propsOf("guard")).toEqual([]);
  });

  it("a pulse rises, holds and falls inside its period", () => {
    expect(pulse(0, 4, 1, 1)).toBe(0);
    expect(pulse(1.5, 4, 1, 1)).toBe(1);
    expect(pulse(2.5, 4, 1, 1)).toBeCloseTo(0.5);
    expect(pulse(3.5, 4, 1, 1)).toBe(0);
    expect(pulse(5.5, 4, 1, 1)).toBe(1);
  });
});

describe("activity blends", () => {
  const run = (b: ReturnType<typeof freshBlend>, seconds: number, moving = false) => {
    for (let t = 0; t < seconds - 1e-9; t += DT) stepBlend(b, DT, moving);
  };

  it("eases from walking into an activity in about 0.3 s and back out", () => {
    expect(ACTIVITY_BLEND_SECONDS).toBeCloseTo(0.3);
    const b = freshBlend();
    setBlendTarget(b, "drink");
    run(b, 0.15);
    expect(b.weight).toBeGreaterThan(0.4);
    expect(b.weight).toBeLessThan(0.6);
    run(b, 0.2);
    expect(b.weight).toBe(1);
    setBlendTarget(b, null);
    run(b, 0.1);
    expect(b.current).toBe("drink");
    run(b, 0.25);
    expect(b.weight).toBe(0);
    expect(b.current).toBeNull();
  });

  it("cross-fades between two activities without dropping to walking", () => {
    const b = freshBlend();
    setBlendTarget(b, "smoke");
    run(b, 0.5);
    setBlendTarget(b, "phone");
    expect(b.from).toBe("smoke");
    stepBlend(b, ACTIVITY_BLEND_SECONDS / 2, false);
    const mid = blendJoints(b)!;
    const smoke = activityJoints("smoke", b.fromTime);
    const phone = activityJoints("phone", b.time);
    expect(mid.armRZ).toBeGreaterThan(Math.min(smoke.armRZ, phone.armRZ));
    expect(mid.armRZ).toBeLessThan(Math.max(smoke.armRZ, phone.armRZ));
    expect(b.weight).toBe(1);
    run(b, 0.3);
    expect(b.from).toBeNull();
  });

  it("walking holds the pose out and it comes back once the character stands", () => {
    const b = freshBlend();
    setBlendTarget(b, "lean");
    run(b, 0.4, true);
    expect(b.weight).toBe(0);
    expect(b.current).toBe("lean");
    run(b, 0.4);
    expect(b.weight).toBe(1);
  });
});

describe("activity poses on the rigs", () => {
  it("sitting drops the hips and moves them back over the seat, with the feet planted", () => {
    const rig = buildCivilian(scene, materials, "act-sit");
    animateRig(rig, 0, DT);
    const standing = rig.body.position.y;
    const sit = activityJoints("sit", 0);
    applyActivityPose(rig, sit, 1);
    const off = plantedOffset(rig, sit);
    expect(off.y).toBeLessThan(-0.3);
    expect(off.z).toBeLessThan(-0.2);
    expect(rig.body.position.y).toBeLessThan(standing - 0.3);
    expect(rig.legL.rotation.x).toBeLessThan(-1.3);
  });

  it("weight 0 leaves the walk alone and puts the turned head straight again", () => {
    const rig = buildCivilian(scene, materials, "act-zero");
    applyActivityPose(rig, activityJoints("guard", 2), 1);
    expect(rig.head.rotation.y).not.toBe(0);
    animateRig(rig, 1.4, DT);
    const arm = rig.armR.rotation.x;
    applyActivityPose(rig, activityJoints("guard", 2), 0);
    expect(rig.head.rotation.y).toBe(0);
    expect(rig.armR.rotation.x).toBe(arm);
  });

  it("a drawn weapon keeps its arm through the pose", () => {
    const rig = buildGanger(scene, materials, "act-armed");
    setWeaponDrawn(rig, true);
    for (let i = 0; i < 60; i++) animateRig(rig, 0, DT);
    const arm = rig.armR.rotation.x;
    applyActivityPose(rig, activityJoints("smoke", 0.9), 1);
    expect(rig.armR.rotation.x).toBe(arm);
  });
});

describe("CharacterActivities", () => {
  it("builds the held things once in the activity, and drops them with it", () => {
    const acts = new CharacterActivities(scene, materials, () => ({ x: 0, y: 1.6, z: -3 }));
    const rig = buildCivilian(scene, materials, "act-props");
    const meshes = scene.meshes.length;
    acts.set(7, "smoke");
    for (let i = 0; i < 30; i++) {
      animateRig(rig, 0, DT);
      acts.apply(7, rig, 0, DT, null);
    }
    expect(acts.activityOf(7)).toBe("smoke");
    expect(scene.meshes.length).toBe(meshes + 2);
    expect(rig.elbowR.rotation.x).toBeLessThan(-0.9);
    acts.set(7, null);
    for (let i = 0; i < 30; i++) {
      animateRig(rig, 0, DT);
      acts.apply(7, rig, 0, DT, null);
    }
    expect(acts.count).toBe(0);
    expect(scene.meshes.length).toBe(meshes);
  });

  it("seated on the scene's own bench brings no stool", () => {
    const acts = new CharacterActivities(scene, materials, () => ({ x: 0, y: 1.6, z: -3 }));
    const rig = buildCivilian(scene, materials, "act-bench");
    const meshes = scene.meshes.length;
    acts.set(8, "sit", { seat: "scene" });
    for (let i = 0; i < 30; i++) acts.apply(8, rig, 0, DT, null);
    expect(scene.meshes.length).toBe(meshes);
    acts.set(9, "sit");
    for (let i = 0; i < 30; i++) acts.apply(9, rig, 0, DT, null);
    expect(scene.meshes.length).toBe(meshes + 1);
    acts.clear();
    expect(scene.meshes.length).toBe(meshes);
  });
});

describe("character draw distance", () => {
  it("keeps characters within 60 m on the ground plane and drops the ones beyond", () => {
    expect(CHARACTER_DRAW_DISTANCE).toBe(60);
    expect(withinDrawDistance({ x: 0, z: 59.9 }, { x: 0, z: 0 })).toBe(true);
    expect(withinDrawDistance({ x: 43, z: 43 }, { x: 0, z: 0 })).toBe(false);
    expect(withinDrawDistance({ x: 10, z: 10 }, { x: 12, z: 9 }, 2)).toBe(false);
  });
});
