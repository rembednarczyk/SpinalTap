import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Quaternion, Scene, TransformNode, Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { animateRig, buildCivilian, buildHeroine } from "../src/renderer/characters";
import { HumanoidRetarget, normaliseBoneName } from "../src/renderer/model-rig";

/** VRM 0.x-like T-pose skeleton facing -Z, under a glTF handedness root (mirror + 180°). */
const tPose = (scene: Scene): { root: TransformNode; bone: (n: string) => TransformNode } => {
  const root = new TransformNode("__root__", scene);
  root.rotationQuaternion = new Quaternion(0, 1, 0, 0);
  root.scaling.set(1, 1, -1);
  const nodes = new Map<string, TransformNode>();
  const add = (name: string, parent: TransformNode, x: number, y: number, z = 0): TransformNode => {
    const n = new TransformNode(name, scene);
    n.parent = parent;
    n.position.set(x, y, z);
    n.rotationQuaternion = Quaternion.Identity();
    nodes.set(name, n);
    return n;
  };
  const hips = add("J_Bip_C_Hips", root, 0, 0.9);
  const chest = add("J_Bip_C_Chest", hips, 0, 0.3);
  add("J_Bip_C_Head", chest, 0, 0.25);
  // VRM 0.x faces -Z, so the character's left is +X in glTF space.
  for (const [side, sx] of [["L", 1], ["R", -1]] as const) {
    const ul = add(`J_Bip_${side}_UpperLeg`, hips, 0.09 * sx, -0.05);
    const ll = add(`J_Bip_${side}_LowerLeg`, ul, 0, -0.4);
    add(`J_Bip_${side}_Foot`, ll, 0, -0.4);
    const ua = add(`J_Bip_${side}_UpperArm`, chest, 0.18 * sx, 0.15);
    const la = add(`J_Bip_${side}_LowerArm`, ua, 0.27 * sx, 0);
    add(`J_Bip_${side}_Hand`, la, 0.25 * sx, 0);
  }
  return { root, bone: (n) => nodes.get(n)! };
};

const worldOf = (node: TransformNode): Vector3 => {
  const chain: TransformNode[] = [];
  for (let n: TransformNode | null = node; n; n = n.parent as TransformNode | null) chain.unshift(n);
  for (const n of chain) n.computeWorldMatrix(true);
  return node.getAbsolutePosition().clone();
};

describe("HumanoidRetarget", () => {
  it("normalises VRoid, Mixamo and Blender bone names", () => {
    expect(normaliseBoneName("e3-m-J_Bip_L_UpperLeg", "e3-m-")).toBe("lupperleg");
    expect(normaliseBoneName("mixamorig:LeftForeArm")).toBe("leftforearm");
    expect(normaliseBoneName("thigh.L")).toBe("thighl");
  });

  it("turns a -Z facing T-pose model around and lowers its arms", () => {
    const scene = new Scene(new NullEngine());
    const rig = buildCivilian(scene, new ToonMaterials(scene), "c");
    const { root, bone } = tPose(scene);
    expect(HumanoidRetarget.create(rig, root)).not.toBeNull();
    const shoulder = worldOf(bone("J_Bip_L_UpperArm"));
    const hand = worldOf(bone("J_Bip_L_Hand"));
    // Character's left is -X in the rig's frame.
    expect(worldOf(bone("J_Bip_L_UpperLeg")).x).toBeLessThan(0);
    expect(hand.y).toBeLessThan(shoulder.y - 0.35);
  });

  it("follows the aiming arm of the heroine rig", () => {
    const scene = new Scene(new NullEngine());
    const rig = buildHeroine(scene, new ToonMaterials(scene), "h");
    const { root, bone } = tPose(scene);
    const retarget = HumanoidRetarget.create(rig, root)!;
    animateRig(rig, 0, 0.016);
    retarget.update();
    const shoulder = worldOf(bone("J_Bip_R_UpperArm"));
    const hand = worldOf(bone("J_Bip_R_Hand"));
    expect(hand.z - shoulder.z).toBeGreaterThan(0.4);
    expect(Math.abs(hand.y - shoulder.y)).toBeLessThan(0.15);
  });

  it("refuses models without a humanoid skeleton", () => {
    const scene = new Scene(new NullEngine());
    const rig = buildCivilian(scene, new ToonMaterials(scene), "c");
    expect(HumanoidRetarget.create(rig, new TransformNode("prop", scene))).toBeNull();
  });
});
