import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { MorphTarget } from "@babylonjs/core/Morph/morphTarget";
import { MorphTargetManager } from "@babylonjs/core/Morph/morphTargetManager";
import { describe, expect, it } from "vitest";
import { MeshBuilder, Scene } from "../src/babylon";
import { FaceRig } from "../src/renderer/face";
import { readVrmExpressions } from "../src/renderer/vrm-meta";

const scene = new Scene(new NullEngine());

/** A face of two primitives, each with six morph targets, named like a glTF import with a prefix. */
const face = () => {
  const meshes = [0, 1].map((i) => {
    const m = MeshBuilder.CreateBox(`p-Face_primitive${i}`, { size: 0.1 }, scene);
    const manager = new MorphTargetManager(scene);
    for (let t = 0; t < 6; t++) manager.addTarget(new MorphTarget(`t${t}`, 0, scene));
    m.morphTargetManager = manager;
    return m;
  });
  const other = MeshBuilder.CreateBox("p-Body", { size: 0.1 }, scene);
  return [...meshes, other];
};

const expressions = {
  blink: [{ node: "Face", index: 0, weight: 1 }],
  a: [{ node: "Face", index: 1, weight: 1 }],
  i: [{ node: "Face", index: 2, weight: 1 }],
  u: [{ node: "Face", index: 3, weight: 1 }],
  e: [{ node: "Face", index: 4, weight: 1 }],
  o: [{ node: "Face", index: 5, weight: 0.5 }],
} as const;

describe("VRM expressions", () => {
  it("reads VRM 0.x groups by mesh and VRM 1.0 presets by node", () => {
    const v0 = readVrmExpressions({
      nodes: [{ name: "Face", mesh: 0 }, { name: "Body", mesh: 1 }],
      extensions: {
        VRM: {
          blendShapeMaster: {
            blendShapeGroups: [
              { presetName: "blink", binds: [{ mesh: 0, index: 12, weight: 100 }] },
              { presetName: "a", binds: [{ mesh: 0, index: 29, weight: 50 }] },
              { presetName: "joy", binds: [{ mesh: 0, index: 3, weight: 100 }] },
            ],
          },
        },
      },
    });
    expect(v0).toEqual({ blink: [{ node: "Face", index: 12, weight: 1 }], a: [{ node: "Face", index: 29, weight: 0.5 }] });
    const v1 = readVrmExpressions({
      nodes: [{ name: "Face", mesh: 0 }],
      extensions: { VRMC_vrm: { expressions: { preset: { blink: { morphTargetBinds: [{ node: 0, index: 2, weight: 1 }] }, oh: { morphTargetBinds: [{ node: 0, index: 7, weight: 0.8 }] } } } } },
    });
    expect(v1).toEqual({ blink: [{ node: "Face", index: 2, weight: 1 }], o: [{ node: "Face", index: 7, weight: 0.8 }] });
    expect(readVrmExpressions({ nodes: [] })).toBeNull();
  });
});

describe("FaceRig", () => {
  it("binds every primitive of the face and keeps targets just above zero", () => {
    const meshes = face();
    const rig = FaceRig.create(meshes, expressions, "p-", () => 0.5)!;
    expect(rig.has("blink")).toBe(true);
    for (const m of meshes.slice(0, 2)) {
      expect(m.morphTargetManager!.optimizeInfluencers).toBe(false);
      for (let t = 0; t < 6; t++) expect(m.morphTargetManager!.getTarget(t)!.influence).toBeGreaterThan(0);
    }
    expect(FaceRig.create(meshes, null, "p-")).toBeNull();
    expect(FaceRig.create(meshes, expressions, "other-")).toBeNull();
  });

  it("blinks after a few seconds and opens the eyes again", () => {
    const meshes = face();
    const rig = FaceRig.create(meshes, expressions, "p-", () => 0)!;
    const blink = meshes[0]!.morphTargetManager!.getTarget(0)!;
    let closed = 0;
    for (let i = 0; i < 150; i++) {
      rig.update(1 / 60);
      closed = Math.max(closed, blink.influence);
    }
    // With the shortest gap (2 s) a full blink happened within 2.5 s.
    expect(closed).toBe(1);
    expect(rig.weight("blink")).toBe(0);
  });

  it("moves the mouth while talking and closes it after", () => {
    const meshes = face();
    let n = 0;
    const rig = FaceRig.create(meshes, expressions, "p-", () => (n++ % 7) / 7)!;
    rig.talk(0.5);
    let open = 0;
    for (let i = 0; i < 30; i++) {
      rig.update(1 / 60);
      open = Math.max(open, ...(["a", "i", "u", "e", "o"] as const).map((v) => rig.weight(v)));
    }
    expect(open).toBeGreaterThan(0.3);
    rig.talk(0);
    for (let i = 0; i < 60; i++) rig.update(1 / 60);
    for (const v of ["a", "i", "u", "e", "o"] as const) expect(rig.weight(v)).toBeLessThan(0.01);
  });
});
