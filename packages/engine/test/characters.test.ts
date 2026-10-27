import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene, VertexBuffer } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { DRAW_SECONDS, animateRig, buildCivilian, buildFixer, buildGanger, buildHeroine, buildRipperdoc, deathFinished, raiseWeapon, setWeaponDrawn, startDeath } from "../src/renderer/characters";

const scene = new Scene(new NullEngine());
const materials = new ToonMaterials(scene);

const builders = { heroine: buildHeroine, fixer: buildFixer, ganger: buildGanger, civilian: buildCivilian, ripperdoc: buildRipperdoc };

describe.each(Object.entries(builders))("character %s", (name, build) => {
  const rig = build(scene, materials, `test-${name}`);

  it("collapses into at most three skinned meshes", () => {
    expect(rig.meshes.length).toBeGreaterThan(0);
    expect(rig.meshes.length).toBeLessThanOrEqual(3);
    for (const m of rig.meshes) {
      // Ten joints, plus the hand and holster pistols of armed characters.
      expect(m.skeleton?.bones).toHaveLength(rig.aiming ? 12 : 10);
      expect(m.parent).toBe(rig.root);
    }
  });

  it("gives every vertex a colour and exactly one full-weight joint", () => {
    for (const m of rig.meshes) {
      const n = m.getTotalVertices();
      const colors = m.getVerticesData(VertexBuffer.ColorKind)!;
      const weights = m.getVerticesData(VertexBuffer.MatricesWeightsKind)!;
      const indices = m.getVerticesData(VertexBuffer.MatricesIndicesKind)!;
      expect(colors).toHaveLength(n * 4);
      for (let i = 0; i < n; i++) {
        expect(weights[i * 4]).toBe(1);
        expect(indices[i * 4]).toBeGreaterThanOrEqual(0);
        expect(indices[i * 4]).toBeLessThan(m.skeleton!.bones.length);
      }
    }
  });

  it("outlines the main body mesh", () => {
    expect(rig.meshes.some((m) => m.renderOutline)).toBe(true);
  });
});

describe("procedural animation", () => {
  it("bends knees while walking and straightens the gun arm when aiming", () => {
    const rig = buildHeroine(scene, materials, "anim");
    raiseWeapon(rig);
    for (let i = 0; i < 20; i++) animateRig(rig, 4.2, 1 / 60);
    expect(Math.max(rig.kneeL.rotation.x, rig.kneeR.rotation.x)).toBeGreaterThan(0.1);
    expect(rig.armR.rotation.x).toBeCloseTo(-1.42, 1);
  });

  it("keeps Ume's umbrella arm in its hold pose", () => {
    const rig = buildCivilian(scene, materials, "ume");
    animateRig(rig, 2, 0.5);
    expect(rig.armL.rotation.x).toBeCloseTo(-0.45);
    expect(rig.elbowL.rotation.x).toBeCloseTo(-2.35);
  });

  it("falls, lies still and then reports it can be removed", () => {
    const rig = buildGanger(scene, materials, "dead");
    startDeath(rig);
    animateRig(rig, 0, 0.7);
    expect(rig.root.rotation.x).toBeLessThan(-1.3);
    expect(deathFinished(rig)).toBe(false);
    for (let i = 0; i < 20; i++) animateRig(rig, 0, 0.5);
    expect(deathFinished(rig)).toBe(true);
  });

  it("decays a hit flinch", () => {
    const rig = buildFixer(scene, materials, "flinch");
    rig.flinch = 1;
    animateRig(rig, 0, 0.1);
    expect(rig.flinch).toBeCloseTo(0.5);
  });
});

describe("weapon arm", () => {
  const armed = () => {
    const scene = new Scene(new NullEngine());
    return buildHeroine(scene, new ToonMaterials(scene), "h");
  };
  const step = (rig: ReturnType<typeof armed>, seconds: number, speed = 0) => {
    for (let t = 0; t < seconds; t += 1 / 60) animateRig(rig, speed, 1 / 60);
  };

  it("walks at low ready with the arm swinging, not stiffly aimed", () => {
    const rig = armed();
    const xs: number[] = [];
    for (let i = 0; i < 90; i++) {
      animateRig(rig, 4, 1 / 60);
      xs.push(rig.armR.rotation.x);
    }
    expect(Math.min(...xs)).toBeGreaterThan(-0.9);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.15);
  });

  it("raises the pistol to aim after a shot and lowers it again", () => {
    const rig = armed();
    raiseWeapon(rig);
    step(rig, 0.3);
    expect(rig.armR.rotation.x).toBeLessThan(-1.3);
    step(rig, 3);
    expect(rig.armR.rotation.x).toBeGreaterThan(-0.9);
  });

  it("holsters: the hand pistol vanishes and the holstered one appears, and back", () => {
    const rig = armed();
    expect(rig.gunHand!.scaling.x).toBe(1);
    setWeaponDrawn(rig, false);
    step(rig, DRAW_SECONDS + 0.1);
    expect(rig.drawn).toBe(0);
    expect(rig.gunHand!.scaling.x).toBe(0);
    expect(rig.gunHip!.scaling.x).toBe(1);
    setWeaponDrawn(rig, true);
    step(rig, DRAW_SECONDS + 0.1);
    expect(rig.gunHand!.scaling.x).toBe(1);
    expect(rig.gunHip!.scaling.x).toBe(0);
  });
});
