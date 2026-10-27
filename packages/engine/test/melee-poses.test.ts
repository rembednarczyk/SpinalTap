import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Quaternion, Scene, TransformNode, Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { BASE_FOV, aimedFov, lookScaleFor, viewSwingOffset } from "../src/camera/camera-rig";
import { SWING_STRIKE, animateRig, buildGanger, buildHeroine, startStagger, startSwing, swingPhase } from "../src/renderer/characters";
import { HumanoidRetarget } from "../src/renderer/model-rig";

const scene = new Scene(new NullEngine());
const materials = new ToonMaterials(scene);
const DT = 1 / 60;

/** A heroine holding a melee weapon, drawn and settled. */
const meleeRig = (name: string) => {
  const rig = buildHeroine(scene, materials, name);
  rig.melee = true;
  for (let i = 0; i < 30; i++) animateRig(rig, 0, DT);
  return rig;
};

const play = (rig: ReturnType<typeof buildHeroine>, seconds: number, guard = 0) => {
  for (let t = 0; t < seconds - 1e-9; t += DT) animateRig(rig, 0, DT, 0, { guard });
};

describe("aim down sights in the camera (ADR-0019)", () => {
  it("zooms by the weapon's factor with the eased aim", () => {
    expect(aimedFov(0, 0.6)).toBeCloseTo(BASE_FOV);
    expect(aimedFov(1, 0.6)).toBeCloseTo(BASE_FOV * 0.6);
    expect(aimedFov(0.5, 0.6)).toBeCloseTo(BASE_FOV * 0.8);
  });

  it("slows the look with the zoom, so the crosshair travels as far on screen", () => {
    expect(lookScaleFor(BASE_FOV)).toBeCloseTo(1);
    const zoomed = aimedFov(1, 0.55);
    expect(lookScaleFor(zoomed)).toBeCloseTo(Math.tan(zoomed / 2) / Math.tan(BASE_FOV / 2));
    expect(lookScaleFor(zoomed)).toBeLessThan(0.6);
  });
});

describe("aiming characters (ADR-0019)", () => {
  it("holds the gun up while the transform says aim, without a shot", () => {
    const rig = buildGanger(scene, materials, "g-aim");
    for (let i = 0; i < 20; i++) animateRig(rig, 0, DT, 0, { aim: 1 });
    expect(rig.aim).toBe(1);
    expect(rig.armR.rotation.x).toBeCloseTo(-1.42, 1);
    for (let i = 0; i < 120; i++) animateRig(rig, 0, DT);
    expect(rig.aim).toBeLessThan(0.1);
  });
});

describe("melee swings, guard and stagger (ADR-0019)", () => {
  it("phases a swing: wound up at the end of the windup, through after the strike, back after the recovery", () => {
    expect(swingPhase(0, 0.2, 0.3)).toEqual({ cock: 0, through: 0 });
    expect(swingPhase(0.2, 0.2, 0.3)).toEqual({ cock: 1, through: 0 });
    expect(swingPhase(0.2 + SWING_STRIKE, 0.2, 0.3)).toEqual({ cock: 1, through: 1 });
    expect(swingPhase(0.5, 0.2, 0.3)).toEqual({ cock: 0, through: 0 });
  });

  it("winds the arm up to the right, sweeps it across to the left and returns to the ready stance", () => {
    const rig = meleeRig("swing");
    const ready = rig.armR.rotation.z;
    startSwing(rig, 0, 0.2, 0.3);
    play(rig, 0.2);
    expect(rig.armR.rotation.z).toBeLessThan(-0.9);
    expect(rig.body.rotation.y).toBeGreaterThan(0.3);
    play(rig, SWING_STRIKE);
    expect(rig.armR.rotation.z).toBeGreaterThan(0.5);
    expect(rig.body.rotation.y).toBeLessThan(-0.3);
    play(rig, 0.3);
    expect(rig.swing).toBeNull();
    expect(rig.armR.rotation.z).toBeCloseTo(ready, 1);
  });

  it("varies the swing through the combo: a backhand, then an overhead finisher", () => {
    const pose = (strike: number) => {
      const rig = meleeRig(`combo-${strike}`);
      startSwing(rig, strike, 0.2, 0.4);
      play(rig, 0.2);
      return { armX: rig.armR.rotation.x, armZ: rig.armR.rotation.z };
    };
    const [fore, back, over] = [pose(0), pose(1), pose(2)];
    expect(back.armZ).toBeGreaterThan(0.5);
    expect(fore.armZ).toBeLessThan(-0.9);
    expect(over.armX).toBeLessThan(-2.5);
  });

  it("raises the guard across the face and lowers it again", () => {
    const rig = meleeRig("guard");
    play(rig, 0.3, 1);
    expect(rig.guard).toBeGreaterThan(0.95);
    expect(rig.armR.rotation.x).toBeLessThan(-1.4);
    expect(rig.armR.rotation.z).toBeGreaterThan(0.4);
    expect(rig.armL.rotation.x).toBeLessThan(-1.2);
    play(rig, 0.6, 0);
    expect(rig.guard).toBeLessThan(0.05);
  });

  it("staggers: the body rocks back and recovers, and a swing is cut short", () => {
    const rig = meleeRig("stagger");
    const upright = rig.body.rotation.x;
    startSwing(rig, 0, 0.3, 0.3);
    play(rig, 0.1);
    startStagger(rig, 0.6);
    expect(rig.swing).toBeNull();
    play(rig, 0.1);
    expect(rig.body.rotation.x).toBeLessThan(upright - 0.2);
    play(rig, 0.6);
    expect(rig.stagger).toBe(0);
    expect(rig.body.rotation.x).toBeCloseTo(upright, 2);
  });

  it("swings an imported model through the retarget", () => {
    const rig = meleeRig("vrm");
    const root = new TransformNode("__root__", scene);
    root.rotationQuaternion = new Quaternion(0, 1, 0, 0);
    root.scaling.set(1, 1, -1);
    const add = (name: string, parent: TransformNode, x: number, y: number) => {
      const n = new TransformNode(name, scene);
      n.parent = parent;
      n.position.set(x, y, 0);
      n.rotationQuaternion = Quaternion.Identity();
      return n;
    };
    const hips = add("J_Bip_C_Hips", root, 0, 0.9);
    const chest = add("J_Bip_C_Chest", hips, 0, 0.3);
    add("J_Bip_C_Head", chest, 0, 0.25);
    const bones = new Map<string, TransformNode>();
    for (const [side, sx] of [["L", 1], ["R", -1]] as const) {
      const ul = add(`J_Bip_${side}_UpperLeg`, hips, 0.09 * sx, -0.05);
      add(`J_Bip_${side}_Foot`, add(`J_Bip_${side}_LowerLeg`, ul, 0, -0.4), 0, -0.4);
      const ua = add(`J_Bip_${side}_UpperArm`, chest, 0.18 * sx, 0.15);
      bones.set(`${side}ua`, ua);
      bones.set(`${side}hand`, add(`J_Bip_${side}_Hand`, add(`J_Bip_${side}_LowerArm`, ua, 0.27 * sx, 0), 0.25 * sx, 0));
    }
    const retarget = HumanoidRetarget.create(rig, root)!;
    const handHeight = () => {
      for (const n of [root, hips, chest, bones.get("Rua")!]) n.computeWorldMatrix(true);
      const hand = bones.get("Rhand")!;
      let p: TransformNode | null = hand;
      const chain: TransformNode[] = [];
      for (; p; p = p.parent as TransformNode | null) chain.unshift(p);
      for (const n of chain) n.computeWorldMatrix(true);
      return hand.getAbsolutePosition().y - Vector3.TransformCoordinates(Vector3.Zero(), bones.get("Rua")!.getWorldMatrix()).y;
    };
    retarget.update();
    const ready = handHeight();
    // The overhead finisher lifts the hand above the shoulder.
    startSwing(rig, 2, 0.25, 0.4);
    play(rig, 0.25);
    retarget.update();
    expect(handHeight()).toBeGreaterThan(0.2);
    expect(handHeight()).toBeGreaterThan(ready + 0.3);
  });
});

describe("FPP melee viewmodel (ADR-0019)", () => {
  it("cocks the weapon to the right shoulder, sweeps it left and returns", () => {
    expect(viewSwingOffset(0, 0, 0.2, 0.3).x).toBeCloseTo(0);
    expect(viewSwingOffset(0, 0.2, 0.2, 0.3).x).toBeGreaterThan(0.1);
    expect(viewSwingOffset(0, 0.2 + 0.09, 0.2, 0.3).x).toBeLessThan(-0.3);
    expect(viewSwingOffset(0, 0.6, 0.2, 0.3)).toEqual({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 });
    expect(viewSwingOffset(2, 0.25, 0.25, 0.4).y).toBeGreaterThan(0.2);
  });
});
