import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Quaternion, Scene, TransformNode, Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { animateRig, buildCivilian, buildHeroine, raiseWeapon } from "../src/renderer/characters";
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
    raiseWeapon(rig);
    for (let i = 0; i < 30; i++) animateRig(rig, 0, 0.016);
    retarget.update();
    const shoulder = worldOf(bone("J_Bip_R_UpperArm"));
    const hand = worldOf(bone("J_Bip_R_Hand"));
    expect(hand.z - shoulder.z).toBeGreaterThan(0.4);
    expect(Math.abs(hand.y - shoulder.y)).toBeLessThan(0.15);
  });

  it("crouches an imported model through the rig's hips and knees", () => {
    const scene = new Scene(new NullEngine());
    const rig = buildHeroine(scene, new ToonMaterials(scene), "h");
    const { root, bone } = tPose(scene);
    const retarget = HumanoidRetarget.create(rig, root)!;
    animateRig(rig, 0, 0.016, 0);
    retarget.update();
    const standingHead = worldOf(bone("J_Bip_C_Head")).y;
    animateRig(rig, 0, 0.016, 1);
    retarget.update();
    const hip = worldOf(bone("J_Bip_L_UpperLeg"));
    const knee = worldOf(bone("J_Bip_L_LowerLeg"));
    const foot = worldOf(bone("J_Bip_L_Foot"));
    // Thigh forward and nearly level, shin back down to the foot, the whole model lower.
    expect(knee.z - hip.z).toBeGreaterThan(0.3);
    expect(knee.y - foot.y).toBeGreaterThan(0.2);
    expect(standingHead - worldOf(bone("J_Bip_C_Head")).y).toBeGreaterThan(0.3);
  });

  it("jumps and climbs an imported model through the same joints (ADR-0021)", () => {
    const scene = new Scene(new NullEngine());
    const rig = buildHeroine(scene, new ToonMaterials(scene), "h");
    const { root, bone } = tPose(scene);
    const retarget = HumanoidRetarget.create(rig, root)!;
    for (let i = 0; i < 20; i++) animateRig(rig, 0, 1 / 60, 0, {}, { air: 6 });
    retarget.update();
    // Tucked: the knee comes up and forward of the hip.
    const hip = worldOf(bone("J_Bip_L_UpperLeg"));
    const knee = worldOf(bone("J_Bip_L_LowerLeg"));
    expect(knee.z - hip.z).toBeGreaterThan(0.15);
    for (let i = 0; i < 40; i++) animateRig(rig, 0, 1 / 60, 0, {}, { climb: 2 });
    retarget.update();
    // On a ladder the left hand is above the shoulder.
    const shoulder = worldOf(bone("J_Bip_L_UpperArm"));
    const hand = worldOf(bone("J_Bip_L_Hand"));
    expect(hand.y - shoulder.y).toBeGreaterThan(0.25);
  });

  it("holds a gun in the right hand, pointing along the aim", () => {
    const scene = new Scene(new NullEngine());
    const rig = buildHeroine(scene, new ToonMaterials(scene), "h");
    const { root, bone } = tPose(scene);
    const retarget = HumanoidRetarget.create(rig, root)!;
    raiseWeapon(rig);
    for (let i = 0; i < 30; i++) animateRig(rig, 0, 0.016);
    const gun = new TransformNode("gun", scene);
    // Rig forearm axes: -Y runs from the elbow to the fingers.
    expect(retarget.holdInRightHand(gun, new Vector3(0, -0.1, 0))).toBe(true);
    const hand = worldOf(bone("J_Bip_R_Hand"));
    const at = worldOf(gun);
    expect(Vector3.Distance(hand, at)).toBeCloseTo(0.1, 1);
    expect(at.z).toBeGreaterThan(hand.z);
    const forward = Vector3.TransformNormal(new Vector3(0, -1, 0), gun.getWorldMatrix()).normalize();
    expect(forward.z).toBeGreaterThan(0.9);
  });

  it("refuses models without a humanoid skeleton", () => {
    const scene = new Scene(new NullEngine());
    const rig = buildCivilian(scene, new ToonMaterials(scene), "c");
    expect(HumanoidRetarget.create(rig, new TransformNode("prop", scene))).toBeNull();
  });
});
