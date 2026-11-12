/**
 * The faces of a map steps band as the renderer draws it (`planSteps`), read by its triangles:
 * a flight's treads and risers are quads of four vertices, but a band laid as paving (`drape`)
 * shares vertices between triangles, so reading the sink four vertices at a time runs past a
 * triangle's three (G-255: the NaN of a three-point band).
 */
import { pointInRingEvenOdd } from "../../../packages/core/src";
import { planSteps } from "../../../packages/engine/src/renderer/mapcity/steps-plan";
import { MeshSink } from "../../../packages/engine/src/renderer/mesh-sink";

type Pt = { readonly x: number; readonly z: number };
type P3 = { readonly x: number; readonly y: number; readonly z: number };

/** A triangle of a drawn band: its corners, and whether it faces up (a tread) or sideways (a riser). */
export interface StepFace {
  readonly corners: readonly [P3, P3, P3];
  readonly up: boolean;
}

/** The triangles of the band `ring` drawn on the ground `h`. */
export const stepFaces = (ring: readonly Pt[], h: (x: number, z: number) => number): StepFace[] => {
  const sink = new MeshSink();
  planSteps(sink, ring, h);
  const at = (i: number): P3 => ({ x: sink.positions[i * 3]!, y: sink.positions[i * 3 + 1]!, z: sink.positions[i * 3 + 2]! });
  const out: StepFace[] = [];
  for (let t = 0; t + 2 < sink.indices.length; t += 3) {
    const [a, b, c] = [sink.indices[t]!, sink.indices[t + 1]!, sink.indices[t + 2]!];
    out.push({ corners: [at(a), at(b), at(c)], up: Math.abs(sink.normals[a * 3 + 1]!) > 0.5 });
  }
  return out;
};

/** A riser's height and middle from its triangle. */
export const riserOf = (f: StepFace): { readonly h: number; readonly x: number; readonly z: number } => {
  const ys = f.corners.map((p) => p.y);
  return { h: Math.max(...ys) - Math.min(...ys), x: (f.corners[0].x + f.corners[1].x + f.corners[2].x) / 3, z: (f.corners[0].z + f.corners[1].z + f.corners[2].z) / 3 };
};

const inTriangle = (p: Pt, [a, b, c]: readonly [P3, P3, P3]): boolean => {
  const s = (u: Pt, v: Pt) => (v.x - u.x) * (p.z - u.z) - (v.z - u.z) * (p.x - u.x);
  const [d1, d2, d3] = [s(a, b), s(b, c), s(c, a)];
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};

/** The height of the drawn tread over (x, z) among `faces`, the highest, or null off them. */
export const treadAt = (faces: readonly StepFace[], p: Pt): number | null => {
  let best: number | null = null;
  for (const f of faces) {
    if (!f.up || !inTriangle(p, f.corners)) continue;
    const y = Math.max(...f.corners.map((q) => q.y));
    if (best === null || y > best) best = y;
  }
  return best;
};

/** A walker's height (m). */
const BODY = 1.8;

/**
 * Each band of steps (world rings) with a point on its drawn treads (and in its ring) where a
 * walker coming along the terrain stands under the ground the treads are drawn on (`h`) by more
 * than a step and less than its height and the slab the renderer hangs under a deck: its body
 * goes through the drawn flight (G-255). `feet` is the ground there for feet on the terrain;
 * treads on a bridge's own deck (`onBridge`) are the bridge's, which has its headroom rule (G-062).
 */
export const flightUnderpass = (
  bands: readonly { readonly id: string; readonly ring: readonly Pt[] }[],
  h: (x: number, z: number) => number,
  feet: (x: number, z: number) => number,
  onBridge: (x: number, z: number, y: number) => boolean,
  step: number,
  slab: number,
): { readonly at: string; readonly what: string }[] =>
  bands.flatMap(({ id, ring }) => {
    if (ring.length < 3) return [];
    const faces = stepFaces(ring, h);
    const xs = ring.map((p) => p.x);
    const zs = ring.map((p) => p.z);
    let worst: { gap: number; x: number; z: number } | null = null;
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.25) {
      for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.25) {
        if (!inRing({ x, z }, ring)) continue;
        // The ground the treads are drawn on, not the tread: a tread is level at its higher end,
        // so on any flight the terrain under it lies up to a riser lower.
        const y = h(x, z);
        if (treadAt(faces, { x, z }) === null || onBridge(x, z, y)) continue;
        const gap = y - feet(x, z);
        if (gap > step && gap < BODY + slab && (!worst || gap > worst.gap)) worst = { gap, x, z };
      }
    }
    return worst ? [{ at: `${worst.x.toFixed(0)},${worst.z.toFixed(0)}`, what: `${id} feet ${worst.gap.toFixed(2)} m under the drawn steps` }] : [];
  });

const inRing = (p: Pt, ring: readonly Pt[]): boolean => pointInRingEvenOdd(p.x, p.z, ring);
