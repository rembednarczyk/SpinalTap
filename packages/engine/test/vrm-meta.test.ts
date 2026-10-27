import { describe, expect, it } from "vitest";
import { readGlbJson, readVrmSprings } from "../src/renderer/vrm-meta";

/** Minimal GLB: header plus a padded JSON chunk. */
const glb = (json: unknown): ArrayBuffer => {
  let text = JSON.stringify(json);
  while (text.length % 4) text += " ";
  const body = new TextEncoder().encode(text);
  const out = new ArrayBuffer(20 + body.byteLength);
  const view = new DataView(out);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, out.byteLength, true);
  view.setUint32(12, body.byteLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(out, 20).set(body);
  return out;
};

const nodes = [{ name: "J_Bip_C_Head" }, { name: "HairJoint-a" }, { name: "J_Sec_L_Skirt1" }];

describe("VRM spring data", () => {
  it("reads VRM 0.x bone groups and colliders, flipping Unity z", () => {
    const json = readGlbJson(
      glb({
        nodes,
        extensions: {
          VRM: {
            secondaryAnimation: {
              boneGroups: [{ stiffiness: 0.6, gravityPower: 0.1, dragForce: 0.4, hitRadius: 0.03, bones: [1], colliderGroups: [0] }],
              colliderGroups: [{ node: 0, colliders: [{ offset: { x: 0.01, y: 0.05, z: 0.02 }, radius: 0.09 }] }],
            },
          },
        },
      }),
    )!;
    expect(readVrmSprings(json)).toEqual({
      groups: [{ stiffness: 0.6, gravity: 0.1, drag: 0.4, hitRadius: 0.03, roots: ["HairJoint-a"], colliderGroups: [0] }],
      colliderGroups: [[{ node: "J_Bip_C_Head", offset: [0.01, 0.05, -0.02], radius: 0.09 }]],
    });
  });

  it("reads VRM 1.0 springs, taking the chain's first joint for its settings", () => {
    const json = readGlbJson(
      glb({
        nodes,
        extensions: {
          VRMC_springBone: {
            colliders: [{ node: 0, shape: { sphere: { offset: [0, 0.06, 0], radius: 0.1 } } }],
            colliderGroups: [{ colliders: [0] }],
            springs: [{ joints: [{ node: 2, stiffness: 1.2, dragForce: 0.3, gravityPower: 0, hitRadius: 0.02 }, { node: 1 }], colliderGroups: [0] }],
          },
        },
      }),
    )!;
    const springs = readVrmSprings(json)!;
    expect(springs.groups[0]).toEqual({ stiffness: 1.2, gravity: 0, drag: 0.3, hitRadius: 0.02, roots: ["J_Sec_L_Skirt1"], colliderGroups: [0] });
    expect(springs.colliderGroups[0]).toEqual([{ node: "J_Bip_C_Head", offset: [0, 0.06, 0], radius: 0.1 }]);
  });

  it("returns null for plain glTF and for bytes that are not a GLB", () => {
    expect(readVrmSprings(readGlbJson(glb({ nodes }))!)).toBeNull();
    expect(readGlbJson(new ArrayBuffer(8))).toBeNull();
    expect(readGlbJson(new TextEncoder().encode("not a glb at all, really").buffer)).toBeNull();
  });
});
