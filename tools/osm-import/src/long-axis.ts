/**
 * The long axis of an outline as the renderer takes it for a ridge (`orientedBox` in the engine's
 * `polygon.ts`): the side of the hull whose bounding box has the least area, or the box's other
 * side where that one is longer. The importer does not import the engine; a test keeps the two equal.
 */
import { type Pt } from "./geometry.ts";

const cross = (o: Pt, a: Pt, b: Pt): number => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

/** The convex hull (monotone chain), counter-clockwise. */
const hull = (pts: readonly Pt[]): Pt[] => {
  const s = [...pts].sort((a, b) => a.x - b.x || a.z - b.z);
  if (s.length < 3) return s;
  const half = (seq: readonly Pt[]) => {
    const out: Pt[] = [];
    for (const p of seq) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...half(s), ...half([...s].reverse())];
};

/** The long axis's direction, degrees from +x towards +z in [0, 180). */
export const longAxisDegrees = (ring: readonly Pt[]): number => {
  const h = hull(ring);
  let best = { area: Infinity, deg: 0 };
  for (let i = 0; i < h.length; i++) {
    const a = h[i]!;
    const b = h[(i + 1) % h.length]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-6) continue;
    const ux = (b.x - a.x) / len;
    const uz = (b.z - a.z) / len;
    let u0 = Infinity;
    let u1 = -Infinity;
    let v0 = Infinity;
    let v1 = -Infinity;
    for (const p of h) {
      const u = p.x * ux + p.z * uz;
      const v = -p.x * uz + p.z * ux;
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (area >= best.area - 1e-9) continue;
    const deg = (Math.atan2(uz, ux) * 180) / Math.PI + (u1 - u0 >= v1 - v0 ? 0 : 90);
    best = { area, deg: ((deg % 180) + 180) % 180 };
  }
  return best.deg;
};

/** The angle between two undirected lines given in degrees, in [0, 90]. */
export const lineAngle = (a: number, b: number): number => {
  const d = Math.abs((((a - b) % 180) + 180) % 180);
  return Math.min(d, 180 - d);
};
