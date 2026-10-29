import { DRESS_FLAG, type MeshSink, type Rgba, type Vec, hexColor } from "../mesh-sink";
import { darken } from "./facade-style";
import { type FacadeFrame, type WorldPassage, trimMeta } from "./facade-frame";
import type { P2 } from "./polygon";
import { type Uv, quadUv } from "./sink-ops";

/**
 * The lining of a street passage through a building (ADR-0048): a city gate, or a vestibule
 * that ends inside. Straight walls along both sides up to the springing line, a barrel vault
 * over them, and at each end the spandrels that turn the rectangular opening of the facade
 * into an arch; at a mouth in the facade an arch of trim frames it. Each strip follows the
 * outline where it meets the facade, so an oblique gate is closed exactly at its wall.
 */

/** Strips of the vault: enough for a round arch in the line art, few enough to stay cheap. */
const VAULT_STEPS = 10;
/** The walls reach this far below the lower floor, under the terrain. */
const BELOW = 0.4;
const UNIT: readonly [Uv, Uv, Uv, Uv] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

/** Width of the arch's trim on the facade. */
const ARCH_TRIM = 0.32;

interface Frame {
  readonly o: P2;
  /** Along the passage. */
  readonly u: P2;
  /** Across it, to the left of `u`. */
  readonly n: P2;
  readonly length: number;
}

const frameOf = (p: WorldPassage): Frame | null => {
  const dx = p.to.x - p.from.x;
  const dz = p.to.z - p.from.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.1) return null;
  const u = { x: dx / length, z: dz / length };
  return { o: p.from, u, n: { x: -u.z, z: u.x }, length };
};

const pointInRing = (ring: readonly P2[], x: number, z: number): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i] as P2;
    const b = ring[j] as P2;
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};

/**
 * The stretch of the line `s` metres to the left of the passage's axis that lies under the
 * building, as distances along the axis: from the first crossing of the outline (or the start,
 * when it begins inside) to the last (or the end). Null when the line misses the building.
 */
export const spanAt = (ring: readonly P2[], f: Frame, s: number): readonly [number, number] | null => {
  const ox = f.o.x + f.n.x * s;
  const oz = f.o.z + f.n.z * s;
  const hits: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as P2;
    const b = ring[(i + 1) % ring.length] as P2;
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const den = f.u.x * ez - f.u.z * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a.x - ox) * ez - (a.z - oz) * ex) / den;
    const k = ((a.x - ox) * f.u.z - (a.z - oz) * f.u.x) / den;
    if (k >= 0 && k <= 1 && t > 0 && t < f.length) hits.push(t);
  }
  const t0 = pointInRing(ring, ox, oz) ? 0 : Math.min(...hits);
  const t1 = pointInRing(ring, ox + f.u.x * f.length, oz + f.u.z * f.length) ? f.length : Math.max(...hits);
  return Number.isFinite(t0) && Number.isFinite(t1) && t1 > t0 ? [t0, t1] : null;
};

/** A point of the passage: `t` along the axis, `s` to the left of it, at height y. */
const at = (f: Frame, t: number, s: number, y: number): Vec => ({ x: f.o.x + f.u.x * t + f.n.x * s, y, z: f.o.z + f.u.z * t + f.n.z * s });

/** The vault's cross-section, `grow` metres outside it: lateral offsets and heights from one springing to the other. */
const profile = (p: WorldPassage, grow = 0): { s: number; y: number }[] => {
  const half = p.width / 2 + grow;
  const rise = Math.max(p.crown - p.spring, 0) + grow;
  return Array.from({ length: VAULT_STEPS + 1 }, (_, k) => {
    const a = (Math.PI * k) / VAULT_STEPS;
    return { s: half * Math.cos(a), y: p.spring + rise * Math.sin(a) };
  });
};

/** The inward normal of the vault between two points of its section. */
const vaultNormal = (f: Frame, a: { s: number; y: number }, b: { s: number; y: number }): Vec => {
  // Perpendicular to the chord in the (across, up) plane, pointing down into the passage.
  const ds = b.s - a.s;
  const dy = b.y - a.y;
  const len = Math.hypot(ds, dy) || 1;
  let ns = -dy / len;
  let ny = ds / len;
  if (ny > 0 || (ny === 0 && ns * (a.s + b.s) > 0)) {
    ns = -ns;
    ny = -ny;
  }
  return { x: f.n.x * ns, y: ny, z: f.n.z * ns };
};

interface Colors {
  readonly wall: Rgba;
  readonly base: Rgba;
  readonly vault: Rgba;
  readonly trim: Rgba;
}

/** A side wall, `side` +1 on the left of the axis, from below the floor up to the springing. */
const sideWall = (sink: MeshSink, ring: readonly P2[], f: Frame, p: WorldPassage, side: 1 | -1, c: Colors): void => {
  const s = (side * p.width) / 2;
  const span = spanAt(ring, f, s);
  if (!span) return;
  const [t0, t1] = span;
  const n: Vec = { x: -f.n.x * side, y: 0, z: -f.n.z * side };
  const bottom = Math.min(p.floor[0], p.floor[1]) - BELOW;
  const base = Math.max(p.floor[0], p.floor[1]) + 0.7;
  const meta = trimMeta(0.37);
  const len = t1 - t0;
  const quad = (y0: number, y1: number, color: Rgba, inset: number) =>
    quadUv(
      sink,
      [at(f, t0, s - side * inset, y0), at(f, t1, s - side * inset, y0), at(f, t1, s - side * inset, y1), at(f, t0, s - side * inset, y1)],
      n,
      color,
      [
        [0, y0 - bottom],
        [len, y0 - bottom],
        [len, y1 - bottom],
        [0, y1 - bottom],
      ],
      meta,
    );
  quad(bottom, p.spring, c.wall, 0);
  // A darker stone base, a hair in front of the plaster.
  quad(bottom, Math.min(base, p.spring), c.base, 0.02);
};

/** The barrel vault, each strip clipped to the outline at its own offset. */
const vault = (sink: MeshSink, ring: readonly P2[], f: Frame, p: WorldPassage, c: Colors): void => {
  const pts = profile(p);
  const meta = trimMeta(0.61);
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k] as { s: number; y: number };
    const b = pts[k + 1] as { s: number; y: number };
    const sa = spanAt(ring, f, a.s);
    const sb = spanAt(ring, f, b.s);
    if (!sa || !sb) continue;
    quadUv(
      sink,
      [at(f, sa[0], a.s, a.y), at(f, sa[1], a.s, a.y), at(f, sb[1], b.s, b.y), at(f, sb[0], b.s, b.y)],
      vaultNormal(f, a, b),
      c.vault,
      [
        [0, a.y],
        [sa[1] - sa[0], a.y],
        [sb[1] - sb[0], b.y],
        [0, b.y],
      ],
      meta,
    );
  }
};

/**
 * The ends of the passage: between the arch and the top of the opening (the spandrels), facing
 * out of the passage; where the end is a mouth in the facade, an arch of trim around it too.
 */
const ends = (sink: MeshSink, ring: readonly P2[], f: Frame, p: WorldPassage, c: Colors): void => {
  const pts = profile(p);
  const outer = profile(p, ARCH_TRIM);
  const meta = trimMeta(0.37);
  for (const end of [0, 1] as const) {
    const out: Vec = end === 0 ? { x: -f.u.x, y: 0, z: -f.u.z } : { x: f.u.x, y: 0, z: f.u.z };
    // A hair outside the end, so the spandrels win over the vault's last strip.
    const t = (s: number): number | null => {
      const span = spanAt(ring, f, s);
      return span ? span[end] + (end === 0 ? -0.01 : 0.01) : null;
    };
    const mouth = !pointInRing(ring, f.o.x + f.u.x * f.length * end, f.o.z + f.u.z * f.length * end);
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k] as { s: number; y: number };
      const b = pts[k + 1] as { s: number; y: number };
      const ta = t(a.s);
      const tb = t(b.s);
      if (ta === null || tb === null) continue;
      if (p.crown - Math.min(a.y, b.y) > 1e-3) {
        quadUv(sink, [at(f, ta, a.s, a.y), at(f, tb, b.s, b.y), at(f, tb, b.s, p.crown), at(f, ta, a.s, p.crown)], out, c.wall, UNIT, meta);
      }
      if (!mouth) continue;
      // The arch's trim: a band outside the curve, standing a little proud of the facade.
      const ga = outer[k] as { s: number; y: number };
      const gb = outer[k + 1] as { s: number; y: number };
      const lift = end === 0 ? -0.04 : 0.04;
      const tga = t(ga.s) ?? ta;
      const tgb = t(gb.s) ?? tb;
      quadUv(sink, [at(f, ta + lift, a.s, a.y), at(f, tb + lift, b.s, b.y), at(f, tgb + lift, gb.s, gb.y), at(f, tga + lift, ga.s, ga.y)], out, c.trim, UNIT, meta);
    }
  }
};

const colorsOf = (f: FacadeFrame): Colors => ({
  wall: hexColor(darken(f.style.plaster, 0.12), DRESS_FLAG.solid),
  base: hexColor(f.style.plinth, DRESS_FLAG.solid),
  vault: hexColor(darken(f.style.plaster, 0.28), DRESS_FLAG.solid),
  trim: hexColor(f.style.trim, DRESS_FLAG.solid),
});

/** The linings of every passage through the building. */
export const planPassages = (sink: MeshSink, f: FacadeFrame): void => {
  const passages = f.b.passages ?? [];
  if (passages.length === 0) return;
  const c = colorsOf(f);
  for (const p of passages) {
    const fr = frameOf(p);
    if (!fr) continue;
    sideWall(sink, f.b.ring, fr, p, 1, c);
    sideWall(sink, f.b.ring, fr, p, -1, c);
    vault(sink, f.b.ring, fr, p, c);
    ends(sink, f.b.ring, fr, p, c);
  }
};
