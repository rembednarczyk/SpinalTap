import { type Mesh, MeshClass, VertexBuffer } from "../babylon";

/** A vertex belongs to the arms when at least this share of its skin weight is on their bones. */
const ARM_WEIGHT = 0.5;

/** Share of each vertex's skin weight on the bones `kept` (skeleton bone indices). */
const weightOn = (mesh: Mesh, kept: ReadonlySet<number>): Float32Array => {
  const n = mesh.getTotalVertices();
  const out = new Float32Array(n);
  const sets: [string, string][] = [
    [VertexBuffer.MatricesIndicesKind, VertexBuffer.MatricesWeightsKind],
    [VertexBuffer.MatricesIndicesExtraKind, VertexBuffer.MatricesWeightsExtraKind],
  ];
  for (const [ik, wk] of sets) {
    const idx = mesh.getVerticesData(ik);
    const w = mesh.getVerticesData(wk);
    if (!idx || !w) continue;
    for (let v = 0; v < n; v++) for (let k = 0; k < 4; k++) if (kept.has(idx[v * 4 + k]!)) out[v] = out[v]! + w[v * 4 + k]!;
  }
  return out;
};

/**
 * A new skinned mesh of the triangles of `source` that the bones `kept` move (ADR-0076 file,
 * Seki's FPP arms): a triangle stays when one of its corners is mostly on them. The vertices are
 * copied and compacted, so the shared geometry of the file and its other instances stays whole;
 * the mesh keeps the source's skeleton, material and place in the hierarchy. Null when no
 * triangle is left.
 */
export const armMesh = (source: Mesh, kept: ReadonlySet<number>, name: string): Mesh | null => {
  const indices = source.getIndices();
  if (!indices || !source.skeleton) return null;
  const weight = weightOn(source, kept);
  const remap = new Map<number, number>();
  const picked: number[] = [];
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const a = indices[t]!;
    const b = indices[t + 1]!;
    const c = indices[t + 2]!;
    if (weight[a]! < ARM_WEIGHT && weight[b]! < ARM_WEIGHT && weight[c]! < ARM_WEIGHT) continue;
    for (const i of [a, b, c]) {
      let j = remap.get(i);
      if (j === undefined) remap.set(i, (j = remap.size));
      picked.push(j);
    }
  }
  if (picked.length === 0) return null;
  const mesh = new MeshClass(name, source.getScene());
  const order = [...remap.keys()];
  for (const kind of source.getVerticesDataKinds()) {
    const data = source.getVerticesData(kind);
    const size = source.getVertexBuffer(kind)?.getSize();
    if (!data || !size) continue;
    const out = new Float32Array(order.length * size);
    order.forEach((from, to) => {
      for (let k = 0; k < size; k++) out[to * size + k] = data[from * size + k]!;
    });
    mesh.setVerticesData(kind, out, false, size);
  }
  mesh.setIndices(picked, order.length);
  mesh.skeleton = source.skeleton;
  mesh.numBoneInfluencers = source.numBoneInfluencers;
  mesh.material = source.material;
  mesh.parent = source.parent;
  mesh.position.copyFrom(source.position);
  mesh.rotationQuaternion = source.rotationQuaternion?.clone() ?? null;
  mesh.rotation.copyFrom(source.rotation);
  mesh.scaling.copyFrom(source.scaling);
  mesh.metadata = source.metadata as unknown;
  mesh.isPickable = false;
  return mesh;
};
