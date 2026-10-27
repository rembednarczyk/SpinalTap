import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene, VertexBuffer } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { Vector3 } from "../src/babylon";
import { DRAW_SECONDS, animateRig, crouchOffset, buildCivilian, buildFixer, buildGanger, buildHeroine, buildRipperdoc, deathFinished, raiseWeapon, setWeaponDrawn, startDeath } from "../src/renderer/characters";

const scene = new Scene(new NullEngine());
const materials = new ToonMaterials(scene);

const builders = { heroine: buildHeroine, fixer: buildFixer, ganger: buildGanger, civilian: buildCivilian, ripperdoc: buildRipperdoc };

describe.each(Object.entries(builders))("character %s", (name, build) => {
  const rig = build(scene, materials, `test-${name}`);

  it("collapses into at most three skinned meshes", () => {
    expect(rig.meshes.length).toBeGreaterThan(0);
    expect(rig.meshes.length).toBeLessThanOrEqual(3);
    for (const m of rig.meshes) {
      // Ten joints, plus the hand and holster pistols (and their placeholder boxes) of armed characters.
      expect(m.skeleton?.bones).toHaveLength(rig.aiming ? 14 : 10);
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

describe("crouch pose", () => {
  const fresh = () => {
    const scene = new Scene(new NullEngine());
    return buildHeroine(scene, new ToonMaterials(scene), "c");
  };
  type Rig = ReturnType<typeof fresh>;
  const refresh = (rig: Rig) => {
    for (const n of [rig.root, rig.body, rig.legL, rig.kneeL, rig.head, rig.armR, rig.elbowR]) n.computeWorldMatrix(true);
  };
  const at = (rig: Rig, node: Rig["head"]) => {
    refresh(rig);
    return node.getAbsolutePosition().clone();
  };
  /** Ankle: the end of the left shin. */
  const ankle = (rig: Rig) => {
    refresh(rig);
    const shin = -rig.kneeL.position.y * (0.42 / 0.44);
    return Vector3.TransformCoordinates(new Vector3(0, -shin, 0), rig.kneeL.getWorldMatrix());
  };

  it("bends hips and knees, drops the body and keeps the feet planted", () => {
    const rig = fresh();
    animateRig(rig, 0, 1 / 60, 0);
    const standingHead = at(rig, rig.head).y;
    const standingAnkle = ankle(rig);
    animateRig(rig, 0, 1 / 60, 1);
    expect(rig.kneeL.rotation.x).toBeGreaterThan(1.8);
    expect(rig.legL.rotation.x).toBeLessThan(-1.2);
    expect(rig.body.rotation.x).toBeGreaterThan(0.3);
    expect(rig.body.position.y).toBeLessThan(-0.3);
    const head = at(rig, rig.head).y;
    expect(standingHead - head).toBeGreaterThan(0.4);
    // Head at about the simulation's crouched eye height (1.14 m).
    expect(head).toBeGreaterThan(1.05);
    expect(head).toBeLessThan(1.25);
    const a = ankle(rig);
    expect(a.y).toBeCloseTo(standingAnkle.y, 2);
    expect(a.z).toBeCloseTo(standingAnkle.z, 2);
    // The knee comes forward of the hips.
    expect(at(rig, rig.kneeL).z).toBeGreaterThan(at(rig, rig.legL).z + 0.3);
  });

  it("blends smoothly: half crouched is partway down, standing is back to neutral", () => {
    const rig = fresh();
    animateRig(rig, 0, 1 / 60, 0.5);
    expect(rig.body.position.y).toBeLessThan(-0.05);
    expect(rig.body.position.y).toBeGreaterThan(crouchOffset(rig, -1.2, 2, 0.35).y);
    animateRig(rig, 0, 1 / 60, 0);
    expect(rig.body.position.y).toBeCloseTo(0, 1);
    expect(rig.body.position.z).toBe(0);
    expect(rig.body.rotation.x).toBe(0);
  });

  it("keeps the aimed pistol level while crouched", () => {
    const rig = fresh();
    raiseWeapon(rig);
    for (let i = 0; i < 30; i++) animateRig(rig, 0, 1 / 60, 1);
    const shoulder = at(rig, rig.armR);
    const elbow = at(rig, rig.elbowR);
    expect(elbow.z - shoulder.z).toBeGreaterThan(0.2);
    expect(Math.abs(elbow.y - shoulder.y)).toBeLessThan(0.08);
  });

  it("keeps an old woman's stoop", () => {
    const scene = new Scene(new NullEngine());
    const ume = buildCivilian(scene, new ToonMaterials(scene), "u");
    animateRig(ume, 0, 1 / 60);
    expect(ume.body.rotation.x).toBeCloseTo(0.08);
  });
});

describe("run cycle", () => {
  const sample = (speed: number) => {
    const scene = new Scene(new NullEngine());
    const rig = buildFixer(scene, new ToonMaterials(scene), "f");
    let knee = 0;
    let elbow = 0;
    let lean = 0;
    for (let i = 0; i < 120; i++) {
      animateRig(rig, speed, 1 / 60);
      knee = Math.max(knee, rig.kneeL.rotation.x, rig.kneeR.rotation.x);
      elbow = Math.min(elbow, rig.elbowL.rotation.x);
      lean = Math.max(lean, rig.body.rotation.x);
    }
    return { knee, elbow, lean };
  };

  it("sprints with higher heels, pumping bent arms and a forward lean", () => {
    const walk = sample(4.2);
    const run = sample(6.9);
    expect(run.knee).toBeGreaterThan(walk.knee + 0.4);
    expect(run.elbow).toBeLessThan(-1.2);
    expect(walk.elbow).toBeGreaterThan(-0.7);
    expect(run.lean).toBeGreaterThan(walk.lean + 0.15);
  });
});
