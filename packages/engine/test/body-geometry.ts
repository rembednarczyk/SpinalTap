// @ts-expect-error The engine is typed for the browser; the tests read the files off disk.
import { readFileSync } from "node:fs";
import { type AbstractMesh, type Matrix, type Mesh, type TransformNode, Vector3, VertexBuffer } from "../src/babylon";
import { worldMatrixOf } from "./t-pose";

/** A character model of `packages/app/public/models` as a data URL, as the game would load it. */
export const characterUrl = (file: string): string => {
  const bytes = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/models/${file}`, import.meta.url));
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:model/gltf-binary;base64,${btoa(text)}`;
};

/** A skinned vertex in world space and the bone that moves it most. */
export interface BodyVertex {
  readonly at: Vector3;
  readonly bone: string;
}

/**
 * The model's body meshes as the GPU would skin them in the current pose (CPU skinning of the
 * same bone matrices), one entry per vertex, each with its dominant bone. Meshes that share a
 * geometry (VRoid primitives) are read once.
 */
export const skinnedBody = (meshes: readonly AbstractMesh[], match: RegExp = /body/i): BodyVertex[] => {
  const out: BodyVertex[] = [];
  const seen = new Set<unknown>();
  for (const mesh of meshes) {
    const skeleton = mesh.skeleton;
    const geometry = (mesh as Mesh).geometry;
    if (!skeleton || !geometry || !match.test(mesh.name) || seen.has(geometry)) continue;
    seen.add(geometry);
    for (const b of skeleton.bones) b.getTransformNode()?.computeWorldMatrix(true);
    skeleton.prepare(true);
    const local = (mesh as Mesh).getPositionData(true, true);
    const index = mesh.getVerticesData(VertexBuffer.MatricesIndicesKind);
    const weight = mesh.getVerticesData(VertexBuffer.MatricesWeightsKind);
    if (!local || !index || !weight) continue;
    const world = worldMatrixOf(mesh as unknown as TransformNode);
    for (let v = 0; v < local.length / 3; v++) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (weight[v * 4 + k]! > weight[v * 4 + best]!) best = k;
      const bone = skeleton.bones[index[v * 4 + best]!]?.name ?? "";
      out.push({ at: Vector3.TransformCoordinates(new Vector3(local[v * 3]!, local[v * 3 + 1]!, local[v * 3 + 2]!), world), bone });
    }
  }
  return out;
};

/** The gun's mesh in its file's frame (muzzle +X, top +Y): triangles, and its world matrix. */
export interface GunShape {
  readonly mesh: AbstractMesh;
  readonly world: Matrix;
  readonly tris: readonly (readonly [Vector3, Vector3, Vector3])[];
  readonly min: Vector3;
  readonly max: Vector3;
}

export const gunShape = (mesh: AbstractMesh): GunShape => {
  const p = mesh.getVerticesData(VertexBuffer.PositionKind)!;
  const idx = mesh.getIndices()!;
  const v = (i: number) => new Vector3(p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!);
  const tris = [] as [Vector3, Vector3, Vector3][];
  for (let t = 0; t < idx.length; t += 3) tris.push([v(idx[t]!), v(idx[t + 1]!), v(idx[t + 2]!)]);
  const { minimum, maximum } = mesh.getBoundingInfo().boundingBox;
  return { mesh, world: worldMatrixOf(mesh as unknown as TransformNode).clone(), tris, min: minimum.clone(), max: maximum.clone() };
};

/** A point of the gun's file frame in the world. */
export const onGun = (gun: GunShape, x: number, y: number, z = 0): Vector3 => Vector3.TransformCoordinates(new Vector3(x, y, z), gun.world);

/**
 * Whether a world point lies inside the gun, `margin` metres in from its surface: the gun's
 * cross-section at the point's distance along the barrel, as the span of heights and widths
 * the mesh's triangles cut there.
 */
export const insideGun = (gun: GunShape, world: Vector3, inverse: Matrix, margin: number): boolean => {
  const q = Vector3.TransformCoordinates(world, inverse);
  if (q.x < gun.min.x + margin || q.x > gun.max.x - margin || q.y < gun.min.y + margin || q.y > gun.max.y - margin || q.z < gun.min.z + margin || q.z > gun.max.z - margin) return false;
  let lo = Infinity;
  let hi = -Infinity;
  let zl = Infinity;
  let zh = -Infinity;
  for (const tri of gun.tris) {
    for (let e = 0; e < 3; e++) {
      const a = tri[e]!;
      const b = tri[(e + 1) % 3]!;
      if ((a.x - q.x) * (b.x - q.x) > 0 || a.x === b.x) continue;
      const u = (q.x - a.x) / (b.x - a.x);
      const y = a.y + (b.y - a.y) * u;
      const z = a.z + (b.z - a.z) * u;
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
      zl = Math.min(zl, z);
      zh = Math.max(zh, z);
    }
  }
  return q.y > lo + margin && q.y < hi - margin && q.z > zl + margin && q.z < zh - margin;
};
