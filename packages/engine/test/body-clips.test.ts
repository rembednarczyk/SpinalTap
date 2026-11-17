import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene, Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { type CharacterRig, animateRig, buildGanger, buildHeroine } from "../src/renderer/characters";
import { BODY_CLIPS } from "../src/renderer/clips/body-clips.generated";
import { poseBodyFromClips, sampleBody } from "../src/renderer/clips/body-pose";
import { poseLegsFromClips } from "../src/renderer/clips/leg-pose";

/*
 * The body from Mixamo clips (ADR-0090 stage 2): standing, the idle clip's chest, head, arms and
 * legs; on a flinch, the hit reaction over whatever the figure does.
 */

const scene = new Scene(new NullEngine());
const materials = new ToonMaterials(scene);
const DT = 1 / 30;

/** One frame as the character views run it: the procedural rig, the leg clips, then the body clips. */
const frame = (r: CharacterRig, speed: number): void => {
  animateRig(r, speed, DT);
  poseLegsFromClips(r, { x: 0, z: 0 }, speed, DT, 0);
  poseBodyFromClips(r, speed, DT, 0);
};
/** The twin without the body clips. */
const plain = (r: CharacterRig, speed: number): void => {
  animateRig(r, speed, DT);
  poseLegsFromClips(r, { x: 0, z: 0 }, speed, DT, 0);
};

/** The rig's joints' rotations, to compare frames. */
const joints = (r: CharacterRig): number[] => [r.body, r.head, r.armL, r.elbowL, r.armR, r.elbowR, r.legL, r.kneeL].flatMap((n) => n.rotation.asArray());
const differs = (a: readonly number[], b: readonly number[]): number => Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));

/** The same rig's procedural pose this frame, without the clips: a twin animated alike. */
const twins = (build: (name: string) => CharacterRig): [CharacterRig, CharacterRig] => [build("a"), build("b")];

describe("the body clips (ADR-0090 stage 2)", () => {
  it("samples a clip looped or held at its last frame", () => {
    const idle = BODY_CLIPS.idle;
    const a = sampleBody(idle, 0.5, true);
    const b = sampleBody(idle, 0.5 + idle.cycle, true);
    a.chest.asArray().forEach((v, i) => expect(v).toBeCloseTo(b.chest.asArray()[i]!, 9));
    expect(a.arms).toHaveLength(18);
    expect(a.legs).toHaveLength(24);
    const hit = BODY_CLIPS.hit;
    expect(sampleBody(hit, hit.cycle * 3, false).chest.asArray()).toEqual(sampleBody(hit, hit.cycle, false).chest.asArray());
    // A delta clip starts from nothing.
    const start = sampleBody(hit, 0, false);
    expect(start.chest.w).toBeCloseTo(1, 3);
    expect(start.hips.length()).toBeCloseTo(0, 3);
  });

  it("standing, the figure takes the idle's pose and moves with it; walking, the procedural walk is left as it is", () => {
    const [r, twin] = twins((n) => buildHeroine(scene, materials, n));
    const poses: number[][] = [];
    for (let i = 0; i < 90; i++) {
      frame(r, 0);
      plain(twin, 0);
      if (i >= 60) poses.push(joints(r));
    }
    // Eased in: far from the procedural standing pose, and alive (it changes over the second).
    expect(differs(joints(r), joints(twin))).toBeGreaterThan(0.05);
    expect(differs(poses[0]!, poses.at(-1)!)).toBeGreaterThan(1e-3);
    // The free arms hang: the hand below the shoulder, near the hip.
    r.root.computeWorldMatrix(true);
    const hand = r.wristL.getAbsolutePosition().clone();
    const shoulder = r.armL.getAbsolutePosition().clone();
    expect(shoulder.y - hand.y).toBeGreaterThan(0.4);
    for (let i = 0; i < 60; i++) {
      frame(r, 2);
      plain(twin, 2);
    }
    expect(differs(joints(r), joints(twin))).toBeLessThan(1e-3);
    // The hips' sideways shift is taken off again: nothing builds up.
    expect(Math.abs(r.body.position.x)).toBeLessThan(1e-4);
  });

  it("keeps the weapon arm of a figure with its pistol drawn, the free left hand hanging as in the idle", () => {
    const [r, twin] = twins((n) => buildGanger(scene, materials, n));
    expect(r.aiming).toBe(true);
    r.drawTarget = twin.drawTarget = true;
    for (let i = 0; i < 60; i++) {
      frame(r, 0);
      plain(twin, 0);
    }
    expect(r.drawn).toBe(1);
    expect(differs(r.armR.rotation.asArray(), twin.armR.rotation.asArray())).toBeLessThan(1e-6);
    expect(differs(r.elbowR.rotation.asArray(), twin.elbowR.rotation.asArray())).toBeLessThan(1e-6);
    expect(differs(r.armL.rotation.asArray(), twin.armL.rotation.asArray())).toBeGreaterThan(0.05);
    // Raised to aim, the left hand comes up to support it as before.
    for (let i = 0; i < 20; i++) {
      r.aimHold = twin.aimHold = 1;
      frame(r, 0);
      plain(twin, 0);
    }
    expect(differs(r.armL.rotation.asArray(), twin.armL.rotation.asArray())).toBeLessThan(1e-6);
  });

  it("a flinch jolts the chest and the head back for the hit reaction's length, then lets go", () => {
    const [r, twin] = twins((n) => buildHeroine(scene, materials, n));
    // Walking, so the idle is out and only the hit shows.
    for (let i = 0; i < 30; i++) {
      frame(r, 2);
      plain(twin, 2);
    }
    r.flinch = twin.flinch = 1;
    let most = 0;
    let back = 0;
    const frames = Math.ceil(BODY_CLIPS.hit.cycle / DT);
    for (let i = 0; i < frames; i++) {
      frame(r, 2);
      plain(twin, 2);
      most = Math.max(most, differs(joints(r), joints(twin)));
      const ahead = (n: CharacterRig) => Vector3.Forward().applyRotationQuaternion(n.body.rotationQuaternion ?? n.body.rotation.toQuaternion());
      back = Math.max(back, ahead(r).y - ahead(twin).y);
    }
    expect(most).toBeGreaterThan(0.1);
    // Its torso tips back (some 5°): its front looks up.
    expect(back).toBeGreaterThan(0.05);
    frame(r, 2);
    plain(twin, 2);
    expect(differs(joints(r), joints(twin))).toBeLessThan(1e-3);
  });

  it("on a ladder the feet climb as in the clip, ahead of the hips, the left high while the right hand reaches", () => {
    const r = buildHeroine(scene, materials, "ladder");
    const step = (y: number) => {
      r.root.position.y = y;
      animateRig(r, 0, DT, 0, {}, { climb: 0.5 });
      poseBodyFromClips(r, 0, DT, 0);
    };
    for (let i = 0; i < 60; i++) step(0);
    expect(r.climbBlend).toBeGreaterThan(0.99);
    // Up one loop of the hands (two rungs), sampling the left ankle against the hips.
    const ankle = (knee: CharacterRig["kneeL"]) => {
      r.root.computeWorldMatrix(true);
      const a = Vector3.TransformCoordinates(new Vector3(0, -0.42, 0), knee.computeWorldMatrix(true));
      const hip = r.legL.getAbsolutePosition();
      return { y: a.y - hip.y, z: a.z - hip.z };
    };
    const rows: { q: number; y: number; z: number }[] = [];
    for (let i = 0; i < 48; i++) {
      step(i * 0.025);
      const q = (((r.climbPhase / (2 * Math.PI)) % 1) + 1) % 1;
      rows.push({ q, ...ankle(r.kneeL) });
    }
    const ys = rows.map((x) => x.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.15);
    for (const x of rows) expect(x.z).toBeGreaterThan(0.05);
    const top = rows.reduce((a, b) => (b.y > a.y ? b : a));
    expect(top.q).toBeGreaterThan(0.35);
    expect(top.q).toBeLessThan(0.75);
  });
});
