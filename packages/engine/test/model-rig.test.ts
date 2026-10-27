import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Matrix, Scene, TransformNode, Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { animateRig, buildCivilian, buildHeroine, raiseWeapon } from "../src/renderer/characters";
import { HumanoidRetarget, normaliseBoneName } from "../src/renderer/model-rig";
import { tPose, worldMatrixOf, worldOf } from "./t-pose";

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

  /** World axes of a node as one list of numbers (X, Y and Z axis directions with their lengths). */
  const axes = (node: TransformNode): number[] => {
    const m = worldMatrixOf(node);
    return [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)].flatMap((v) => Vector3.TransformNormal(v, m).asArray());
  };
  const expectClose = (a: number[], b: number[]) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i]!, 4));

  it("anchors add-ons on the head and chest bones in the rig's frame and metres", () => {
    const scene = new Scene(new NullEngine());
    const rig = buildHeroine(scene, new ToonMaterials(scene), "h");
    const { root, bone } = tPose(scene);
    // A model 1.2 times bigger than its file, mirrored by the glTF root.
    root.scaling.set(1.2, 1.2, -1.2);
    const retarget = HumanoidRetarget.create(rig, root)!;
    expect(retarget.headHeight).toBeCloseTo(1.45 * 1.2, 3);
    const head = retarget.anchor("head", "head-anchor")!;
    const chest = retarget.anchor("chest", "chest-anchor")!;
    expect(head.parent).toBe(bone("J_Bip_C_Head"));
    expect(chest.parent).toBe(bone("J_Bip_C_Chest"));
    expectClose(axes(head), axes(rig.head));
    expectClose(axes(chest), axes(rig.body));
    // The head anchor turns with the rig's head (look around, aim pitch).
    rig.head.rotation.set(0.3, 0.6, 0);
    retarget.update();
    expectClose(axes(head), axes(rig.head));
    expect(Vector3.Distance(worldOf(head), worldOf(bone("J_Bip_C_Head")))).toBeCloseTo(0, 5);
    // An offset under the anchor is in metres along the rig head's axes.
    const visor = new TransformNode("visor", scene);
    visor.parent = head;
    visor.position.set(0, 0, 0.1);
    const forward = Vector3.TransformNormal(new Vector3(0, 0, 0.1), Matrix.FromQuaternionToRef(rig.head.rotationQuaternion ?? rig.head.rotation.toQuaternion(), new Matrix()).multiply(worldMatrixOf(rig.body)));
    expect(worldOf(visor).subtract(worldOf(head)).subtract(forward).length()).toBeCloseTo(0, 4);
  });

  it("has no chest anchor on a skeleton without a chest bone", () => {
    const scene = new Scene(new NullEngine());
    const rig = buildHeroine(scene, new ToonMaterials(scene), "h");
    const { root, bone } = tPose(scene);
    bone("J_Bip_C_Chest").name = "Torso";
    const retarget = HumanoidRetarget.create(rig, root)!;
    expect(retarget.anchor("chest", "c")).toBeNull();
    expect(retarget.anchor("head", "h")).not.toBeNull();
  });

  it("refuses models without a humanoid skeleton", () => {
    const scene = new Scene(new NullEngine());
    const rig = buildCivilian(scene, new ToonMaterials(scene), "c");
    expect(HumanoidRetarget.create(rig, new TransformNode("prop", scene))).toBeNull();
  });
});
