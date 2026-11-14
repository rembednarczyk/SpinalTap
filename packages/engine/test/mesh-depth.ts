import { type AbstractMesh, type TransformNode, Vector3, VertexBuffer } from "../src/babylon";

/**
 * How far points lie inside a weapon's model and whether the eye sees them past it (round 6 of
 * the FPP hands: the thumbs on a pistol's frame, not in it). Everything in the frame of `frame`
 * (the viewmodel's mount), the meshes' triangles as they are drawn.
 */
export type Triangle = readonly [Vector3, Vector3, Vector3];

const toFrame = (frame: TransformNode) => frame.computeWorldMatrix(true).clone().invert();

/** The drawn triangles of `meshes` (enabled and visible) in the frame of `frame`. */
export const trianglesIn = (meshes: readonly AbstractMesh[], frame: TransformNode): Triangle[] => {
  const inv = toFrame(frame);
  const out: Triangle[] = [];
  for (const mesh of meshes) {
    if (mesh.getTotalVertices() === 0 || !mesh.isEnabled() || !mesh.isVisible) continue;
    const world = mesh.computeWorldMatrix(true);
    const p = mesh.getPositionData(false)!;
    const ix = mesh.getIndices()!;
    const at = (i: number) => Vector3.TransformCoordinates(Vector3.TransformCoordinates(new Vector3(p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!), world), inv);
    for (let t = 0; t + 2 < ix.length; t += 3) out.push([at(ix[t]!), at(ix[t + 1]!), at(ix[t + 2]!)]);
  }
  return out;
};

/** Distance along `dir` (a unit vector) from `from` to the nearest triangle (Möller–Trumbore), or Infinity. */
export const castOn = (tris: readonly Triangle[], from: Vector3, dir: Vector3): number => {
  let first = Infinity;
  for (const [a, b, c] of tris) {
    const e1 = b.subtract(a);
    const e2 = c.subtract(a);
    const pv = Vector3.Cross(dir, e2);
    const det = Vector3.Dot(e1, pv);
    if (Math.abs(det) < 1e-12) continue;
    const tv = from.subtract(a);
    const u = Vector3.Dot(tv, pv) / det;
    if (u < 0 || u > 1) continue;
    const qv = Vector3.Cross(tv, e1);
    const v = Vector3.Dot(dir, qv) / det;
    if (v < 0 || u + v > 1) continue;
    const t = Vector3.Dot(e2, qv) / det;
    if (t > 0) first = Math.min(first, t);
  }
  return first;
};

const AXES = [new Vector3(1, 0, 0), new Vector3(0, 1, 0)];

/**
 * How deep `p` lies inside the solid the triangles bound, read as the gun's silhouettes across
 * and up: between the outer surfaces met from far left and far right, and from far below and
 * far above, the depth is the nearest of the four (metres; 0 or less outside). Inner faces of a
 * model that is not one closed shell do not count, and a hole through it (a trigger guard)
 * stays outside.
 */
export const depthInside = (tris: readonly Triangle[], p: Vector3): number => {
  let depth = Infinity;
  for (const axis of AXES) {
    const lo = 1 - castOn(tris, p.subtract(axis), axis);
    const hi = 1 - castOn(tris, p.add(axis), axis.negate());
    depth = Math.min(depth, lo, hi);
  }
  return depth;
};

/**
 * The skinned positions (in the frame of `frame`) of the vertices of `mesh` whose heaviest bone
 * is one `bone` picks by its node's name.
 */
export const skinVertices = (mesh: AbstractMesh, frame: TransformNode, bone: (name: string) => boolean): Vector3[] => {
  const inv = toFrame(frame);
  const world = mesh.computeWorldMatrix(true);
  mesh.skeleton!.prepare(true);
  const pos = mesh.getPositionData(true)!;
  const idx = mesh.getVerticesData(VertexBuffer.MatricesIndicesKind)!;
  const wts = mesh.getVerticesData(VertexBuffer.MatricesWeightsKind)!;
  const bones = mesh.skeleton!.bones;
  const out: Vector3[] = [];
  for (let v = 0; v < pos.length / 3; v++) {
    let heaviest = -1;
    let w = 0;
    for (let k = 0; k < 4; k++) {
      if (wts[v * 4 + k]! > w) {
        w = wts[v * 4 + k]!;
        heaviest = idx[v * 4 + k]!;
      }
    }
    const node = bones[heaviest]?.getTransformNode();
    if (!node || !bone(node.name)) continue;
    out.push(Vector3.TransformCoordinates(Vector3.TransformCoordinates(new Vector3(pos[v * 3]!, pos[v * 3 + 1]!, pos[v * 3 + 2]!), world), inv));
  }
  return out;
};

/** The share of `points` the eye at `eye` sees past the triangles (nothing of them nearer on the line). */
export const seenShare = (tris: readonly Triangle[], eye: Vector3, points: readonly Vector3[]): number => {
  let seen = 0;
  for (const p of points) {
    const to = p.subtract(eye);
    const d = to.length();
    if (castOn(tris, eye, to.scale(1 / d)) >= d - 1e-4) seen++;
  }
  return points.length ? seen / points.length : 0;
};
