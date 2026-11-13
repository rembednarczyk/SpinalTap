/**
 * A bridge's sidewalk off the level of its carriageway (G-737): a point of a sidewalk's piece on
 * a bridge where the carriageway beside it, in the same cross section, lies more than `KERB_OFF`
 * higher or lower. In Lublin the sidewalk behind the kerb is level with the carriageway; at the
 * west end of Mełgiewska's south bridge it lay 0.14–0.16 m under it, each deck on the NMT at its
 * own way's ends, a step under the deck-step check's face.
 */
import { pointInRingEvenOdd } from "../../../packages/core/src";

type Pt = { readonly x: number; readonly z: number };
/** A piece of a deck: its outline, its surface, its axis. */
type Piece = { readonly ring: readonly Pt[]; readonly surface: string; readonly a: Pt; readonly b: Pt };
type Finding = { readonly at: string; readonly what: string };

/** How far apart the scan samples a sidewalk's piece (m). */
export const KERB_SAMPLE = 0.5;
/** A sidewalk more than this off its carriageway's level in one cross section is a step (m). */
export const KERB_OFF = 0.05;
/** How far off the sidewalk's point the carriageway may lie and still be the one beside it (m): the widest gap a bridge's outline fills, and a margin. */
export const KERB_REACH = 5;
/** How far the two pieces' axes may turn from each other and still run side by side (cosine of 15°). */
const SIDE_BY_SIDE = Math.cos((15 * Math.PI) / 180);

const WALKS = new Set(["sidewalk", "footway"]);

/** The point's distance to the ring's edges. */
const toEdge = (ring: readonly Pt[], p: Pt): number => {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const [dx, dz] = [b.x - a.x, b.z - a.z];
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t));
  }
  return best;
};

/** Where along the piece's axis the point's cross section lies: 0 at `a`, 1 at `b`. */
const along = (d: Piece, p: Pt): number => {
  const [dx, dz] = [d.b.x - d.a.x, d.b.z - d.a.z];
  return ((p.x - d.a.x) * dx + (p.z - d.a.z) * dz) / (dx * dx + dz * dz || 1);
};

const parallel = (s: Piece, r: Piece): boolean => {
  const [sx, sz, rx, rz] = [s.b.x - s.a.x, s.b.z - s.a.z, r.b.x - r.a.x, r.b.z - r.a.z];
  return Math.abs((sx * rx + sz * rz) / (Math.hypot(sx, sz) * Math.hypot(rx, rz) || 1)) >= SIDE_BY_SIDE;
};

/**
 * The points (every `KERB_SAMPLE` m) of the sidewalks' and footways' pieces among `pieces` more
 * than `KERB_OFF` off the nearest carriageway (`road`) side by side with them within `KERB_REACH`,
 * where its cross section lies within the carriageway's span; `height(piece, x, z)` the piece's deck there.
 */
export const kerbSteps = <T extends Piece>(pieces: readonly T[], height: (piece: T, x: number, z: number) => number): Finding[] => {
  const out: Finding[] = [];
  const seen = new Set<string>();
  const roads = pieces.filter((p) => p.surface === "road");
  for (const walk of pieces.filter((p) => WALKS.has(p.surface))) {
    const beside = roads.filter((r) => parallel(walk, r));
    if (beside.length === 0) continue;
    const xs = walk.ring.map((p) => p.x);
    const zs = walk.ring.map((p) => p.z);
    for (let i = Math.ceil(Math.min(...xs) / KERB_SAMPLE); i <= Math.floor(Math.max(...xs) / KERB_SAMPLE); i++) {
      for (let j = Math.ceil(Math.min(...zs) / KERB_SAMPLE); j <= Math.floor(Math.max(...zs) / KERB_SAMPLE); j++) {
        const p = { x: i * KERB_SAMPLE, z: j * KERB_SAMPLE };
        if (!pointInRingEvenOdd(p.x, p.z, walk.ring)) continue;
        let road: T | null = null;
        let near = KERB_REACH;
        for (const r of beside) {
          const d = toEdge(r.ring, p);
          if (d <= near) [road, near] = [r, d];
        }
        if (road === null) continue;
        const t = along(road, p);
        if (t < 0 || t > 1) continue;
        const [y, yr] = [height(walk, p.x, p.z), height(road, p.x, p.z)];
        const at = `${p.x.toFixed(1)},${p.z.toFixed(1)}`;
        if (Math.abs(y - yr) <= KERB_OFF || seen.has(at)) continue;
        seen.add(at);
        out.push({ at, what: `${walk.surface} ${y.toFixed(2)} beside the carriageway at ${yr.toFixed(2)}` });
      }
    }
  }
  return out;
};
