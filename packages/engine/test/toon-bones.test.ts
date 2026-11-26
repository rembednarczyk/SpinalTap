import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it, vi } from "vitest";
import { Bone, FreeCamera, Matrix, type Mesh, MeshBuilder, Scene, Skeleton, Vector3, VertexBuffer } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";

/**
 * The bones of every skinned mesh are bound when it is drawn (user notes of 25.11, G-974): the
 * cut garments of several characters share one material and are drawn one after another, and
 * ShaderMaterial binds bones only when the material or the effect changes.
 */

const skinned = (scene: Scene, name: string, bones: number): Mesh => {
  const mesh = MeshBuilder.CreateBox(name, { size: 1 }, scene);
  const skeleton = new Skeleton(`${name}-skeleton`, name, scene);
  let parent: Bone | null = null;
  for (let i = 0; i < bones; i++) parent = new Bone(`${name}-b${i}`, skeleton, parent, Matrix.Translation(0, 0.1, 0));
  const count = mesh.getTotalVertices();
  mesh.setVerticesData(VertexBuffer.MatricesIndicesKind, new Float32Array(count * 4).fill(bones - 1), false, 4);
  mesh.setVerticesData(VertexBuffer.MatricesWeightsKind, new Float32Array(count * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), false, 4);
  mesh.skeleton = skeleton;
  mesh.numBoneInfluencers = 4;
  return mesh;
};

describe("toon materials bind each skinned mesh's own bones (G-974)", () => {
  it("binds the second character's skeleton after the first's with the same material and effect", () => {
    const scene = new Scene(new NullEngine());
    new FreeCamera("eye", new Vector3(0, 0, -5), scene);
    const material = new ToonMaterials(scene).forImported("#4fa85c", null, "importedCharacter", { layer: 2 });
    const a = skinned(scene, "a", 67);
    // The same bone count, so the same effect: as with the bone texture, whose defines do not count bones.
    const b = skinned(scene, "b", 67);
    for (const m of [a, b]) m.material = material;
    scene.render();
    const bound: (Skeleton | null)[] = [];
    for (const m of [a, b]) {
      const sub = m.subMeshes[0]!;
      expect(material.isReadyForSubMesh(m, sub)).toBe(true);
      const effect = sub.effect!;
      const setMatrices = vi.spyOn(effect, "setMatrices");
      const setTexture = vi.spyOn(effect, "setTexture");
      material.bind(m.getWorldMatrix(), m, undefined, sub);
      const ours = setMatrices.mock.calls.some(([u, v]) => u === "mBones" && v === m.skeleton!.getTransformMatrices(m)) || setTexture.mock.calls.some(([u]) => u === "boneSampler");
      bound.push(ours ? m.skeleton : null);
      setMatrices.mockRestore();
      setTexture.mockRestore();
    }
    expect(bound).toEqual([a.skeleton, b.skeleton]);
  });
});
