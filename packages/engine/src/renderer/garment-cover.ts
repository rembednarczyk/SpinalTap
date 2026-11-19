import { type AbstractMesh, type Mesh, MeshClass, type Scene, VertexBuffer } from "../babylon";
import { BodyGrid } from "./garment-fit";

/**
 * The model's cloth under a garment (ADR-0086, first layer against clipping): the triangles of its
 * top (and what it wears over the top) that the garment covers are not drawn while it is worn, so
 * a short sleeve or a collar cannot show through the jacket in motion. The skin of the arms and the
 * torso under it goes the same way (user notes of 19.11: the shoulders showed through the jacket). An open jacket covers the
 * sleeves, the back and the sides, not the front between its flaps: there the top stays.
 *
 * A triangle is covered when each of its corners has a garment vertex over it (`COVER`). The rest of
 * the cloth is drawn by a small mesh of its own (only the vertices it uses), since every instance
 * of a file shares the cloth's index buffer and the characters without the garment keep it whole.
 */

/**
 * A corner of the cloth is under the garment when a garment vertex stands over it: within `SIDE`
 * of the line along the cloth's normal and between `BELOW` under and `ABOVE` over it. Beside the
 * flaps of an open jacket the nearest garment vertex lies to the side, so the top shows there.
 */
export const COVER = { SIDE: 0.02, BELOW: 0.005, ABOVE: 0.06 } as const;

/**
 * The indices of the cloth's triangles left uncovered, from the garment's vertices (fitted, same space).
 * `may` limits what may be hidden by vertex (the skin of the arms and the torso, not of the legs or the hands).
 */
export const uncoveredTriangles = (
  cloth: { positions: ArrayLike<number>; normals: ArrayLike<number>; indices: ArrayLike<number> },
  garment: Float32Array,
  may: (v: number) => boolean = () => true,
): number[] => {
  const grid = new BodyGrid({ positions: garment, normals: garment });
  const p = cloth.positions;
  const n = cloth.normals;
  const near = new Map<number, boolean>();
  const covered = (v: number): boolean => {
    let c = near.get(v);
    if (c === undefined) {
      const [x, y, z] = [p[v * 3]!, p[v * 3 + 1]!, p[v * 3 + 2]!];
      const [nx, ny, nz] = [n[v * 3]!, n[v * 3 + 1]!, n[v * 3 + 2]!];
      c = grid.any(x, y, z, (g) => {
        const [dx, dy, dz] = [garment[g * 3]! - x, garment[g * 3 + 1]! - y, garment[g * 3 + 2]! - z];
        const up = dx * nx + dy * ny + dz * nz;
        return up >= -COVER.BELOW && up <= COVER.ABOVE && dx * dx + dy * dy + dz * dz - up * up <= COVER.SIDE * COVER.SIDE;
      });
      near.set(v, c);
    }
    return c;
  };
  const out: number[] = [];
  const idx = cloth.indices;
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const [a, b, c] = [idx[t]!, idx[t + 1]!, idx[t + 2]!];
    if (!may(a) || !may(b) || !may(c) || !covered(a) || !covered(b) || !covered(c)) out.push(a, b, c);
  }
  return out;
};

const KINDS = [
  [VertexBuffer.PositionKind, 3],
  [VertexBuffer.NormalKind, 3],
  [VertexBuffer.UVKind, 2],
  [VertexBuffer.MatricesIndicesKind, 4],
  [VertexBuffer.MatricesWeightsKind, 4],
  [VertexBuffer.MatricesIndicesExtraKind, 4],
  [VertexBuffer.MatricesWeightsExtraKind, 4],
] as const;

/** A mesh of only the given triangles of `cloth`, on its skeleton, place and material; null when none are left. */
export const clothRemainder = (scene: Scene, cloth: AbstractMesh, indices: readonly number[], name: string): Mesh | null => {
  if (indices.length === 0) return null;
  const remap = new Map<number, number>();
  const order: number[] = [];
  const local = indices.map((i) => {
    let j = remap.get(i);
    if (j === undefined) {
      j = order.length;
      remap.set(i, j);
      order.push(i);
    }
    return j;
  });
  const mesh = new MeshClass(name, scene);
  for (const [kind, size] of KINDS) {
    const data = cloth.getVerticesData(kind);
    if (!data) continue;
    const out = new Float32Array(order.length * size);
    order.forEach((v, j) => {
      for (let k = 0; k < size; k++) out[j * size + k] = data[v * size + k]!;
    });
    mesh.setVerticesData(kind, out, false, size);
  }
  mesh.setIndices(local);
  mesh.skeleton = cloth.skeleton;
  mesh.numBoneInfluencers = cloth.numBoneInfluencers;
  mesh.parent = cloth.parent;
  mesh.position.copyFrom(cloth.position);
  mesh.rotationQuaternion = cloth.rotationQuaternion?.clone() ?? null;
  mesh.rotation.copyFrom(cloth.rotation);
  mesh.scaling.copyFrom(cloth.scaling);
  mesh.material = cloth.material;
  mesh.metadata = cloth.metadata as unknown;
  mesh.isPickable = false;
  return mesh;
};
