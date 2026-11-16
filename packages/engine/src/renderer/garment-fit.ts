/**
 * Fitting a garment cut out of one VRoid file (ADR-0086, `tools/garments`) onto the body of another,
 * once per pair (garment, cast file), in the bind pose. Plain arrays, no scene: the loader
 * (`garment-assets.ts`) reads them off the meshes and the test checks the result on its own.
 *
 * 1. Bones: each vertex moves with its weighted bones from where they stand in the garment's file to
 *    where they stand in the cast file. VRoid binds every bone unrotated, so that is a translation
 *    per bone: a taller model's jacket gets longer between the hips and the shoulders, a model with
 *    longer arms longer sleeves.
 * 2. Body: a vertex nearer the body than `lift` along the normal of the nearest body vertex (or
 *    inside it) is pushed out to `lift`. Models of one base differ in their figure sliders (bust,
 *    hips, shoulders), so a garment made on one goes into the body of another without this.
 */

/** A garment as its file gives it: per vertex 3 floats of position and normal, 4 bone slots. */
export interface GarmentGeometry {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
  /** Per vertex four indices into `bones` and four weights. */
  readonly joints: Float32Array;
  readonly weights: Float32Array;
  /** Bone names (`J_Bip_*`) and their bind positions in the garment's file. */
  readonly bones: readonly string[];
  readonly bind: readonly (readonly [number, number, number])[];
  /** Each bone's parent among `bones`, or -1: where a cast file lacks a bone, its parent takes the weight. */
  readonly parents: readonly number[];
}

/** The skeleton of a cast file: bone names (prefix of the instance stripped) and bind positions, by index. */
export interface TargetSkeleton {
  readonly names: readonly string[];
  readonly bind: readonly (readonly [number, number, number])[];
}

/** The body's vertices a garment must stay off: positions and normals, three floats each. */
export interface BodySurface {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
}

export interface FittedGarment {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  /** Bone indices into the cast file's skeleton. */
  readonly joints: Float32Array;
  readonly weights: Float32Array;
  /** Vertices pushed off the body, and the deepest push (metres). */
  readonly pushed: number;
  readonly deepest: number;
}

/** How far a garment stands off the body at least, in metres: under the toon line's width. */
export const GARMENT_LIFT = 0.008;
/** How far from a garment vertex the body is looked for: farther, the garment hangs free. */
const REACH = 0.06;
const CELL = 0.03;
/** Rounds of pushing a garment off the body at most. */
const PUSH_ROUNDS = 6;

/** A garment bone's index in the cast skeleton, or that of its nearest ancestor the cast has. */
const targetBoneOf = (g: GarmentGeometry, target: TargetSkeleton): number[] => {
  const byName = new Map(target.names.map((n, i) => [n, i]));
  return g.bones.map((_, i) => {
    for (let b = i; b >= 0; b = g.parents[b] ?? -1) {
      const t = byName.get(g.bones[b]!);
      if (t !== undefined) return t;
    }
    return -1;
  });
};

/** Nearest body vertex within `REACH`, through a hash grid of `CELL` cells. */
export class BodyGrid {
  private readonly cells = new Map<string, number[]>();

  constructor(readonly body: BodySurface) {
    const p = body.positions;
    for (let i = 0; i < p.length / 3; i++) {
      const key = this.key(p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!);
      const list = this.cells.get(key);
      if (list) list.push(i);
      else this.cells.set(key, [i]);
    }
  }

  private key(x: number, y: number, z: number): string {
    return `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
  }

  /** The nearest body vertex to (x, y, z) within reach, or -1. */
  nearest(x: number, y: number, z: number): number {
    const p = this.body.positions;
    const [cx, cy, cz] = [Math.floor(x / CELL), Math.floor(y / CELL), Math.floor(z / CELL)];
    const r = Math.ceil(REACH / CELL);
    let best = -1;
    let bestD = REACH * REACH;
    for (let i = -r; i <= r; i++)
      for (let j = -r; j <= r; j++)
        for (let k = -r; k <= r; k++) {
          for (const v of this.cells.get(`${cx + i},${cy + j},${cz + k}`) ?? []) {
            const d = (p[v * 3]! - x) ** 2 + (p[v * 3 + 1]! - y) ** 2 + (p[v * 3 + 2]! - z) ** 2;
            if (d < bestD) {
              bestD = d;
              best = v;
            }
          }
        }
    return best;
  }

  /** Whether `test` holds for any vertex in the cells within reach of (x, y, z). */
  any(x: number, y: number, z: number, test: (v: number) => boolean): boolean {
    const [cx, cy, cz] = [Math.floor(x / CELL), Math.floor(y / CELL), Math.floor(z / CELL)];
    const r = Math.ceil(REACH / CELL);
    for (let i = -r; i <= r; i++)
      for (let j = -r; j <= r; j++)
        for (let k = -r; k <= r; k++) for (const v of this.cells.get(`${cx + i},${cy + j},${cz + k}`) ?? []) if (test(v)) return true;
    return false;
  }

  /** How far (x, y, z) stands out of the body along the normal of its nearest body vertex; null with no body in reach. */
  standOff(x: number, y: number, z: number): { readonly vertex: number; readonly out: number } | null {
    const v = this.nearest(x, y, z);
    if (v < 0) return null;
    const p = this.body.positions;
    const n = this.body.normals;
    const out = (x - p[v * 3]!) * n[v * 3]! + (y - p[v * 3 + 1]!) * n[v * 3 + 1]! + (z - p[v * 3 + 2]!) * n[v * 3 + 2]!;
    return { vertex: v, out };
  }
}

/** The garment on the cast file's skeleton and body (see the file's comment). */
export const fitGarment = (g: GarmentGeometry, target: TargetSkeleton, body: BodySurface | null, lift = GARMENT_LIFT): FittedGarment => {
  const count = g.positions.length / 3;
  const toTarget = targetBoneOf(g, target);
  const positions = new Float32Array(g.positions);
  const joints = new Float32Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let v = 0; v < count; v++) {
    let total = 0;
    for (let k = 0; k < 4; k++) {
      const w = g.weights[v * 4 + k]!;
      const b = g.joints[v * 4 + k]!;
      const t = toTarget[b] ?? -1;
      if (w <= 0 || t < 0) continue;
      const from = g.bind[b]!;
      const to = target.bind[t]!;
      for (let a = 0; a < 3; a++) positions[v * 3 + a]! += w * (to[a]! - from[a]!);
      joints[v * 4 + k] = t;
      weights[v * 4 + k] = w;
      total += w;
    }
    if (total > 0) for (let k = 0; k < 4; k++) weights[v * 4 + k]! /= total;
  }
  let pushed = 0;
  let deepest = 0;
  if (body) {
    const grid = new BodyGrid(body);
    const moved = new Float32Array(count);
    // A push can bring another body vertex nearest (the cloth's fold, the skirt over the hip): again, a few rounds.
    for (let round = 0; round < PUSH_ROUNDS; round++) {
      let any = false;
      for (let v = 0; v < count; v++) {
        const at = grid.standOff(positions[v * 3]!, positions[v * 3 + 1]!, positions[v * 3 + 2]!);
        if (!at || at.out >= lift - 1e-5) continue;
        const push = lift - at.out;
        for (let a = 0; a < 3; a++) positions[v * 3 + a]! += push * body.normals[at.vertex * 3 + a]!;
        moved[v]! += push;
        any = true;
      }
      if (!any) break;
    }
    for (const m of moved) if (m > 0) pushed++;
    deepest = Math.max(0, ...moved);
  }
  return { positions, normals: g.normals, joints, weights, pushed, deepest };
};
