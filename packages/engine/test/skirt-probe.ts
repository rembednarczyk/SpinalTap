import { type AbstractMesh, type Matrix, type TransformNode, Vector3, VertexBuffer } from "../src/babylon";
import type { ModelInstance } from "../src/renderer/model-library";

/**
 * Where an imported model's legs go through its skirt (feat/seki-ruch). The meshes are skinned on
 * the CPU from the bones' turn since the bind pose. A leg passes through the cloth when the line
 * from its bone (thigh or shin) out to a point of its skin crosses a skirt triangle: the skin is
 * then outside the skirt by the rest of that line. Points are spread over the leg triangles,
 * since a VRoid thigh has few vertices and the skirt cuts between them.
 */

/** A leg skin point: a triangle's corners and their weights. */
interface LegPoint {
  readonly corners: readonly [number, number, number];
  readonly weights: readonly [number, number, number];
}

interface Skinned {
  readonly mesh: AbstractMesh;
  /** Bind positions in world space. */
  readonly bind: Vector3[];
  readonly bones: readonly TransformNode[];
  readonly joints: Float32Array | number[];
  readonly weights: Float32Array | number[];
}

interface LegSegment {
  readonly name: string;
  readonly from: TransformNode;
  readonly to: TransformNode;
  readonly mesh: Skinned;
  readonly points: readonly LegPoint[];
}

export interface Crossing {
  readonly leg: string;
  /** How far the skin is past the cloth (metres). */
  readonly depth: number;
}

/** Points per triangle edge: (N + 1)(N + 2) / 2 per triangle. */
const SPREAD = 2;
/** Grid cell of the skirt triangles (metres). */
const CELL = 0.04;

const boneName = (node: TransformNode, prefix: string): string => node.name.slice(node.name.startsWith(prefix) ? prefix.length : 0);

const skinnedOf = (mesh: AbstractMesh): Skinned | null => {
  const skeleton = mesh.skeleton;
  const pos = mesh.getVerticesData(VertexBuffer.PositionKind);
  const joints = mesh.getVerticesData(VertexBuffer.MatricesIndicesKind);
  const weights = mesh.getVerticesData(VertexBuffer.MatricesWeightsKind);
  if (!skeleton || !pos || !joints || !weights) return null;
  const world = mesh.computeWorldMatrix(true);
  const bind: Vector3[] = [];
  for (let i = 0; i < pos.length; i += 3) bind.push(Vector3.TransformCoordinates(new Vector3(pos[i], pos[i + 1], pos[i + 2]), world));
  return { mesh, bind, bones: skeleton.bones.map((b) => b.getTransformNode()!), joints, weights };
};

/** Share of a vertex's weight on the given bones. */
const weightOn = (m: Skinned, v: number, bones: readonly TransformNode[]): number => {
  let w = 0;
  for (let k = 0; k < 4; k++) if (bones.includes(m.bones[m.joints[v * 4 + k]!]!)) w += m.weights[v * 4 + k]!;
  return w;
};

export class SkirtProbe {
  /** Inverse bind (world) matrix of every bone node, taken at creation. */
  private readonly unbind = new Map<TransformNode, Matrix>();

  private constructor(
    private readonly root: TransformNode,
    private readonly skirt: Skinned,
    private readonly skirtTriangles: readonly number[],
    private readonly legs: readonly LegSegment[],
  ) {
    this.refresh();
    for (const n of root.getDescendants(false) as TransformNode[]) this.unbind.set(n, n.getWorldMatrix().clone().invert());
  }

  /** Call on a model still in its bind pose. Null when it has no skirt (bones named "Skirt"). */
  static create(model: ModelInstance): SkirtProbe | null {
    const meshes = model.meshes.filter((m) => m.getTotalVertices() > 0 && (m.getIndices()?.length ?? 0) > 0);
    model.root.computeWorldMatrix(true);
    for (const n of model.root.getDescendants(false) as TransformNode[]) n.computeWorldMatrix(true);
    const skinned = new Map(meshes.map((m) => [m, skinnedOf(m)]));
    // The skirt: the drawn part with the most vertices on skirt bones.
    let skirtMesh: AbstractMesh | null = null;
    let most = 0;
    for (const [mesh, s] of skinned) {
      if (!s) continue;
      const skirtBones = s.bones.filter((b) => /skirt/i.test(b.name));
      const used = new Set(mesh.getIndices()!);
      const count = [...used].filter((v) => weightOn(s, v, skirtBones) > 0.3).length;
      if (count > most) [skirtMesh, most] = [mesh, count];
    }
    const skirt = skirtMesh ? skinned.get(skirtMesh)! : null;
    if (!skirt || !skirtMesh) return null;
    const prefix = model.prefix;
    const bone = (name: string) => skirt.bones.find((b) => boneName(b, prefix) === name);
    const segments: { name: string; from?: TransformNode; to?: TransformNode; extra?: TransformNode }[] = (["L", "R"] as const).flatMap((side) => [
      { name: `${side} thigh`, from: bone(`J_Bip_${side}_UpperLeg`), to: bone(`J_Bip_${side}_LowerLeg`), extra: bone(`J_Sec_${side}_UpperLeg`) },
      { name: `${side} shin`, from: bone(`J_Bip_${side}_LowerLeg`), to: bone(`J_Bip_${side}_Foot`), extra: bone(`J_Sec_${side}_LowerLeg`) },
    ]);
    const legs: LegSegment[] = [];
    for (const seg of segments) {
      if (!seg.from || !seg.to) continue;
      const on = [seg.from, ...(seg.extra ? [seg.extra] : [])];
      for (const [mesh, s] of skinned) {
        if (!s || mesh === skirtMesh) continue;
        const ix = mesh.getIndices()!;
        const points: LegPoint[] = [];
        for (let t = 0; t < ix.length; t += 3) {
          const corners = [ix[t]!, ix[t + 1]!, ix[t + 2]!] as const;
          if (!corners.every((v) => weightOn(s, v, on) >= 0.4)) continue;
          for (let i = 0; i <= SPREAD; i++)
            for (let j = 0; j <= SPREAD - i; j++) points.push({ corners, weights: [i / SPREAD, j / SPREAD, (SPREAD - i - j) / SPREAD] });
        }
        if (points.length > 0) legs.push({ name: seg.name, from: seg.from, to: seg.to, mesh: s, points });
      }
    }
    return new SkirtProbe(model.root, skirt, [...skirtMesh.getIndices()!], legs);
  }

  /** Leg skin points outside the skirt cloth by more than `slack` metres in the current pose. */
  crossings(slack: number): Crossing[] {
    this.refresh();
    const skin = new Map<TransformNode, Matrix>();
    for (const [n, unbind] of this.unbind) skin.set(n, unbind.multiply(n.getWorldMatrix()));
    const place = (m: Skinned, v: number): Vector3 => {
      const out = Vector3.Zero();
      for (let k = 0; k < 4; k++) {
        const w = m.weights[v * 4 + k]!;
        if (w > 0) out.addInPlace(Vector3.TransformCoordinates(m.bind[v]!, skin.get(m.bones[m.joints[v * 4 + k]!]!)!).scaleInPlace(w));
      }
      return out;
    };
    const cloth = new Map<number, Vector3>();
    for (const v of this.skirtTriangles) if (!cloth.has(v)) cloth.set(v, place(this.skirt, v));
    const grid = this.gridOf(cloth);
    const out: Crossing[] = [];
    for (const leg of this.legs) {
      const a = leg.from.getAbsolutePosition();
      const ab = leg.to.getAbsolutePosition().subtract(a);
      const placed = new Map<number, Vector3>();
      const at = (v: number) => placed.get(v) ?? (placed.set(v, place(leg.mesh, v)), placed.get(v)!);
      for (const p of leg.points) {
        const q = at(p.corners[0]).scale(p.weights[0]).addInPlace(at(p.corners[1]).scale(p.weights[1])).addInPlace(at(p.corners[2]).scale(p.weights[2]));
        const t = Vector3.Dot(q.subtract(a), ab) / ab.lengthSquared();
        if (t < 0 || t > 1) continue;
        const c = a.add(ab.scale(t));
        const depth = this.past(grid, cloth, c, q);
        if (depth > slack) out.push({ leg: leg.name, depth });
      }
    }
    return out;
  }

  /** How far `to` is past the last skirt triangle the line from `from` crosses; -1 if none. */
  private past(grid: Map<string, number[]>, cloth: Map<number, Vector3>, from: Vector3, to: Vector3): number {
    const seen = new Set<number>();
    let best = -1;
    const lo = Vector3.Minimize(from, to);
    const hi = Vector3.Maximize(from, to);
    for (let x = Math.floor(lo.x / CELL); x <= Math.floor(hi.x / CELL); x++)
      for (let y = Math.floor(lo.y / CELL); y <= Math.floor(hi.y / CELL); y++)
        for (let z = Math.floor(lo.z / CELL); z <= Math.floor(hi.z / CELL); z++)
          for (const t of grid.get(`${x},${y},${z}`) ?? []) {
            if (seen.has(t)) continue;
            seen.add(t);
            const tri = this.skirtTriangles;
            const s = crossing(from, to, cloth.get(tri[t]!)!, cloth.get(tri[t + 1]!)!, cloth.get(tri[t + 2]!)!);
            if (s >= 0) best = Math.max(best, (1 - s) * Vector3.Distance(from, to));
          }
    return best;
  }

  private gridOf(cloth: Map<number, Vector3>): Map<string, number[]> {
    const grid = new Map<string, number[]>();
    const tri = this.skirtTriangles;
    for (let t = 0; t < tri.length; t += 3) {
      const [p0, p1, p2] = [cloth.get(tri[t]!)!, cloth.get(tri[t + 1]!)!, cloth.get(tri[t + 2]!)!];
      const lo = Vector3.Minimize(Vector3.Minimize(p0, p1), p2);
      const hi = Vector3.Maximize(Vector3.Maximize(p0, p1), p2);
      for (let x = Math.floor(lo.x / CELL); x <= Math.floor(hi.x / CELL); x++)
        for (let y = Math.floor(lo.y / CELL); y <= Math.floor(hi.y / CELL); y++)
          for (let z = Math.floor(lo.z / CELL); z <= Math.floor(hi.z / CELL); z++) {
            const key = `${x},${y},${z}`;
            const cell = grid.get(key);
            if (cell) cell.push(t);
            else grid.set(key, [t]);
          }
    }
    return grid;
  }

  private refresh(): void {
    this.root.computeWorldMatrix(true);
    for (const n of this.root.getDescendants(false) as TransformNode[]) n.computeWorldMatrix(true);
  }
}

/** Where along a->b (0..1) the segment crosses the triangle, or -1 (Möller-Trumbore). */
const crossing = (a: Vector3, b: Vector3, p0: Vector3, p1: Vector3, p2: Vector3): number => {
  const d = b.subtract(a);
  const e1 = p1.subtract(p0);
  const e2 = p2.subtract(p0);
  const h = Vector3.Cross(d, e2);
  const det = Vector3.Dot(e1, h);
  if (Math.abs(det) < 1e-12) return -1;
  const s = a.subtract(p0);
  const u = Vector3.Dot(s, h) / det;
  if (u < 0 || u > 1) return -1;
  const q = Vector3.Cross(s, e1);
  const v = Vector3.Dot(d, q) / det;
  if (v < 0 || u + v > 1) return -1;
  const t = Vector3.Dot(e2, q) / det;
  return t >= 0 && t <= 1 ? t : -1;
};
