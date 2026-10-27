import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { loadToonModel } from "../src/renderer/model-loader";

/** A single red triangle as an embedded glTF 2.0 document. */
export const triangleGltf = (): string => {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const bytes = new Uint8Array(positions.byteLength + normals.byteLength);
  bytes.set(new Uint8Array(positions.buffer), 0);
  bytes.set(new Uint8Array(normals.buffer), positions.byteLength);
  const gltf = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "triangle" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 1] } }],
    buffers: [{ byteLength: bytes.byteLength, uri: `data:application/octet-stream;base64,${btoa(String.fromCharCode(...bytes))}` }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
      { buffer: 0, byteOffset: positions.byteLength, byteLength: normals.byteLength },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5126, count: 3, type: "VEC3" },
    ],
  };
  return `data:model/gltf+json;base64,${btoa(JSON.stringify(gltf))}`;
};

describe("loadToonModel", () => {
  it("imports glTF and swaps the PBR material for a toon material with the same base colour", async () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const model = await loadToonModel(scene, materials, triangleGltf(), { scale: 2 });
    const mesh = model.meshes.find((m) => m.getTotalVertices() > 0)!;
    expect(mesh.material?.name).toContain("imp:importedCharacter:#FF0000");
    expect(mesh.renderOutline).toBe(true);
    expect(scene.meshes).toContain(mesh);
    expect(model.root.scaling.x).toBeCloseTo(2);
    model.dispose();
    expect(scene.meshes).not.toContain(mesh);
  });

  it("shares one toon material between meshes with the same source colour", async () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const a = await loadToonModel(scene, materials, triangleGltf());
    const b = await loadToonModel(scene, materials, triangleGltf(), { outline: false });
    const ma = a.meshes.find((m) => m.getTotalVertices() > 0)!.material;
    const mb = b.meshes.find((m) => m.getTotalVertices() > 0)!;
    expect(mb.material).toBe(ma);
    expect(mb.renderOutline).toBeFalsy();
  });
});

describe("ModelLibrary", () => {
  it("loads a file once and hands out independent instances", async () => {
    const { ModelLibrary, pickAnimation } = await import("../src/renderer/model-library");
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const library = new ModelLibrary(scene, materials);
    const spec = { url: triangleGltf(), scale: 1.5 };
    const [a, b] = await Promise.all([library.instantiate(spec, "a"), library.instantiate(spec, "b")]);
    expect(a.root).not.toBe(b.root);
    expect(a.root.scaling.x).toBeCloseTo(1.5);
    const ma = a.meshes.find((m) => m.getTotalVertices() > 0)!;
    expect(ma.material?.name).toContain("#FF0000");
    // Imported characters are inked by the line-art pass; the hull is opt-in.
    expect(ma.renderOutline).toBeFalsy();
    // A pooled instance gets its bind pose back.
    const node = a.root.getChildren()[0] as unknown as { rotation: { x: number }; position: { y: number } };
    node.rotation.x = 1.2;
    node.position.y = 3;
    a.resetPose();
    expect(node.rotation.x).toBe(0);
    expect(node.position.y).toBe(0);
    expect(a.prefix).toBe("a-");
    a.dispose();
    expect(b.root.isDisposed()).toBe(false);
    expect(pickAnimation([], spec, 3)).toBeNull();
  });
});
