import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Quaternion, Scene, TransformNode } from "../src/babylon";
import { SpringBones } from "../src/renderer/spring-bones";

/** glTF-like root (mirror + 180°) with a head and a two-joint hair strand hanging down. */
const strand = () => {
  const scene = new Scene(new NullEngine());
  const root = new TransformNode("__root__", scene);
  root.rotationQuaternion = new Quaternion(0, 1, 0, 0);
  root.scaling.set(1, 1, -1);
  const node = (name: string, parent: TransformNode, y: number): TransformNode => {
    const n = new TransformNode(name, scene);
    n.parent = parent;
    n.position.set(0, y, 0);
    n.rotationQuaternion = Quaternion.Identity();
    return n;
  };
  const head = node("J_Bip_C_Head", root, 1.5);
  const a = node("HairJoint-a", head, 0);
  const b = node("HairJoint-b", a, -0.1);
  node("HairJoint-c", b, -0.1);
  return { root, a, b };
};

const angle = (q: Quaternion | null): number => 2 * Math.acos(Math.min(1, Math.abs(q?.w ?? 1)));

/** The same root with a two-joint skirt panel hanging from the hips. */
const skirt = () => {
  const { root } = strand();
  const scene = root.getScene();
  const node = (name: string, parent: TransformNode, y: number): TransformNode => {
    const n = new TransformNode(name, scene);
    n.parent = parent;
    n.position.set(0, y, 0);
    n.rotationQuaternion = Quaternion.Identity();
    return n;
  };
  const hips = node("J_Bip_C_Hips", root, 0.9);
  const a = node("J_Sec_L_Skirt_00", hips, 0);
  // A flared panel: out and down from the hips, as a skirt hangs.
  const b = node("J_Sec_L_Skirt_01", a, -0.15);
  b.position.x = 0.09;
  const end = node("J_Sec_L_Skirt_end", b, -0.15);
  end.position.x = 0.09;
  return { root, a };
};

describe("SpringBones", () => {
  it("keeps a skirt down through a fall (user notes of 18.11)", () => {
    const fall = (pick: (s: ReturnType<typeof skirt>) => TransformNode, make: typeof skirt) => {
      const s = make();
      const springs = SpringBones.create(s.root)!;
      springs.update(1 / 60);
      let most = 0;
      for (let i = 0; i < 30; i++) {
        s.root.position.y -= 7 / 60;
        springs.update(1 / 60);
        most = Math.max(most, angle(pick(s).rotationQuaternion));
      }
      return most;
    };
    // Before: carried by three quarters of the drop, the panel swung up 0.37 rad.
    expect(fall((s) => s.a, skirt), "skirt").toBeLessThan(0.1);
  });

  it("finds secondary chains and starts in the bind pose", () => {
    const { root, a, b } = strand();
    const springs = SpringBones.create(root)!;
    expect(springs.count).toBe(2);
    springs.update(1 / 60);
    expect(angle(a.rotationQuaternion)).toBeLessThan(1e-3);
    expect(angle(b.rotationQuaternion)).toBeLessThan(1e-3);
  });

  it("lags behind a sudden move, then settles back", () => {
    const { root, a } = strand();
    const springs = SpringBones.create(root)!;
    springs.update(1 / 60);
    root.position.x += 0.3;
    springs.update(1 / 60);
    const swung = angle(a.rotationQuaternion);
    expect(swung).toBeGreaterThan(0.2);
    for (let i = 0; i < 300; i++) springs.update(1 / 60);
    expect(angle(a.rotationQuaternion)).toBeLessThan(0.15);
  });

  it("re-primes after a teleport instead of flinging the strand", () => {
    const { root, a } = strand();
    const springs = SpringBones.create(root)!;
    springs.update(1 / 60);
    root.position.x += 50;
    springs.update(1 / 60);
    expect(angle(a.rotationQuaternion)).toBeLessThan(1e-3);
  });

  it("uses authored VRM groups: their settings, colliders and only their bones", () => {
    const { root, a } = strand();
    const vrm = {
      groups: [{ stiffness: 4, gravity: 0, drag: 0.9, hitRadius: 0.01, roots: ["HairJoint-b"], colliderGroups: [0] }],
      colliderGroups: [[{ node: "J_Bip_C_Head", offset: [0, -0.3, 0] as [number, number, number], radius: 0.05 }]],
    };
    const springs = SpringBones.create(root, { vrm })!;
    // HairJoint-a is not in any group, so only b (with its child c) is simulated.
    expect(springs.count).toBe(1);
    springs.update(1 / 60);
    root.position.x += 0.3;
    springs.update(1 / 60);
    expect(angle(a.rotationQuaternion)).toBeLessThan(1e-3);
  });

  it("ignores models without secondary bones", () => {
    const scene = new Scene(new NullEngine());
    expect(SpringBones.create(new TransformNode("prop", scene))).toBeNull();
  });
});
