/**
 * Placement rules of the street furniture (ADR-0047): stations along lines, the side of the
 * street a lamp stands on (from the ground surfaces), facades for wall lanterns, the open side
 * a bench faces, and deterministic scattering in an area. No randomness: every choice comes
 * from a hash of the plan's ids, so the same plan gives the same street.
 */
import { type Pt, pointInRing, ringBounds } from "./geometry.ts";
import { type Site, type SiteSurface } from "./props-site.ts";

/** FNV-1a, 32 bits. */
export const fnv = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
};

/** Uniform in [0, 1) from a key. */
export const unit = (key: string): number => fnv(key) / 4294967296;

/** Facing a direction on the ground plane: yaw from +z towards +x (the StreetPropItem convention). */
export const yawOf = (dx: number, dz: number): number => Math.atan2(dx, dz);

export interface Station {
  readonly p: Pt;
  /** Unit direction of the line there. */
  readonly dir: Pt;
  /** Distance along the line. */
  readonly s: number;
}

/** Points every `spacing` metres along a polyline, the first `start` metres in. */
export const stations = (line: readonly Pt[], spacing: number, start = spacing / 2): Station[] => {
  const out: Station[] = [];
  let next = start;
  let walked = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-6) continue;
    const dir = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
    while (next <= walked + len + 1e-9) {
      const t = (next - walked) / len;
      out.push({ p: { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, dir, s: next });
      next += spacing;
    }
    walked += len;
  }
  return out;
};

const lengthOf = (line: readonly Pt[]): number => {
  let s = 0;
  for (let i = 0; i + 1 < line.length; i++) s += Math.hypot(line[i + 1]!.x - line[i]!.x, line[i + 1]!.z - line[i]!.z);
  return s;
};

/** `count` points spread evenly over several polylines, by length. */
export const evenStations = (lines: readonly (readonly Pt[])[], count: number): Station[] => {
  const total = lines.reduce((s, l) => s + lengthOf(l), 0);
  if (count <= 0 || total <= 0) return [];
  const step = total / count;
  const out: Station[] = [];
  let walked = 0;
  for (const l of lines) {
    const len = lengthOf(l);
    while (out.length < count && step / 2 + out.length * step <= walked + len + 1e-9) {
      const st = stations(l, Number.MAX_VALUE, step / 2 + out.length * step - walked)[0];
      if (!st) break;
      out.push(st);
    }
    walked += len;
  }
  return out;
};

/** How a thing finds its place beside a street axis. */
export type SideMode = "kerb" | "facade" | "front" | "path";

/** How far from a line's axis a facade or a road edge is looked for, metres. */
const SIDE_REACH = 16;
const FACADE_REACH = 36;

/**
 * The wall between the last open sample (`inside` − 0.5) and the first one in a building, to a
 * centimetre: a lantern hung 0.3 m off a wall placed by the 0.5 m step alone ended up to a
 * quarter of a metre inside it, its halo glowing out of the plaster.
 */
const facadeAt = (site: Site, at: (d: number) => Pt, inside: number): number => {
  let open = inside - 0.5;
  let hit = inside;
  while (hit - open > 0.01) {
    const mid = (open + hit) / 2;
    if (site.surfaceAt(at(mid)) === "building") hit = mid;
    else open = mid;
  }
  return open;
};

/** Where a thing beside the axis goes: the offset along the normal, or null when there is no place. */
export const sideOffset = (site: Site, p: Pt, n: Pt, mode: SideMode, fallback: number): number | null => {
  const at = (d: number): Pt => ({ x: p.x + n.x * d, z: p.z + n.z * d });
  if (mode === "path") {
    // Beside a path: the given side, else the other, else on the path itself. On a flight wider
    // than the offset (the castle stairs, T-113) a lamp stands just past its edge, on its side,
    // unless a landing or another path goes on from there.
    const pastSteps = (d: number) => {
      for (let e = Math.abs(d) + 0.5; e <= 2 * fallback; e += 0.5) {
        const q = at(Math.sign(d) * e);
        if (site.onSteps(q)) continue;
        return site.standable(q) && !site.onPath(q) ? Math.sign(d) * e : null;
      }
      return null;
    };
    for (const d of [fallback, -fallback, 0]) {
      if (site.standable(at(d))) return d;
      const past = d !== 0 && site.onSteps(at(d)) ? pastSteps(d) : null;
      if (past !== null) return past;
    }
    return null;
  }
  const axisRoad = site.surfaceAt(p) === "road";
  let building: number | null = null;
  let walkFrom: number | null = null;
  let road: number | null = null;
  // A wall lantern looks for the facade across a whole square (the Rynek is some 60 m wide),
  // anything else only along a street's width.
  const reach = mode === "facade" ? FACADE_REACH : SIDE_REACH;
  for (let d = 0.5; d <= reach; d += 0.5) {
    const s = site.surfaceAt(at(d));
    if (s === "building") {
      building = d;
      break;
    }
    if (axisRoad && walkFrom === null && s !== "road") walkFrom = d;
    if (!axisRoad && road === null && s === "road") road = d;
  }
  if (mode === "facade") return building === null ? null : facadeAt(site, at, building) - 0.3;
  if (mode === "front") return building === null ? fallback : Math.max(building - fallback, 0.8);
  // Kerb: on the pavement just past the road's edge, or the fallback on a pedestrian street.
  let d: number;
  if (axisRoad) {
    if (walkFrom === null) return null;
    d = walkFrom + 0.4;
  } else {
    d = road === null ? fallback : Math.min(fallback, road - 0.6);
  }
  if (building !== null) d = Math.min(d, building - 1.2);
  return d > 0.3 && site.standable(at(d)) ? d : null;
};

const DIRS = Array.from({ length: 8 }, (_, i) => ({ x: Math.sin((i * Math.PI) / 4), z: Math.cos((i * Math.PI) / 4) }));

/**
 * The direction a bench or a machine faces: towards open pavement, away from buildings and
 * flower beds; along the nearest street when everything around is open.
 */
export const openFacing = (site: Site, p: Pt): Pt | null => {
  let fx = 0;
  let fz = 0;
  for (const d of DIRS) {
    const s = site.surfaceAt({ x: p.x + d.x * 1.6, z: p.z + d.z * 1.6 });
    const w = s === "walk" || s === "road" ? 1 : s === null ? 0.3 : -1;
    fx += d.x * w;
    fz += d.z * w;
  }
  const l = Math.hypot(fx, fz);
  return l > 0.8 ? { x: fx / l, z: fz / l } : null;
};

/** Unit vector from p towards the nearest point of the nearest street axis, or null without streets. */
export const towardsStreet = (site: Site, p: Pt, within = 60): Pt | null => {
  let best: Pt | null = null;
  let bestD = within;
  for (const st of site.streets) {
    for (let i = 0; i + 1 < st.line.length; i++) {
      const a = st.line[i]!;
      const b = st.line[i + 1]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
      const q = { x: a.x + dx * t, z: a.z + dz * t };
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < bestD && d > 0.05) {
        bestD = d;
        best = { x: (q.x - p.x) / d, z: (q.z - p.z) / d };
      }
    }
  }
  return best;
};

/** Ground beside a road a thing can stand on: pavement, green or the bare terrain. */
const beside = (s: SiteSurface): boolean => s === "walk" || s === "green" || s === null;

const AROUND = Array.from({ length: 32 }, (_, i) => ({ x: Math.sin((i * Math.PI) / 16), z: Math.cos((i * Math.PI) / 16) }));

/**
 * p itself off the carriageway; on it (a traffic light's node in the road's axis), the nearest
 * pavement, green or bare ground within `reach` metres, `inset` metres in from its edge; null when none is.
 */
export const offRoad = (site: Site, p: Pt, reach = 12, inset = 0.6): Pt | null => {
  if (site.surfaceAt(p) !== "road") return p;
  for (let r = 0.5; r <= reach; r += 0.5) {
    for (const d of AROUND) {
      if (!beside(site.surfaceAt({ x: p.x + d.x * r, z: p.z + d.z * r }))) continue;
      const q = { x: p.x + d.x * (r + inset), z: p.z + d.z * (r + inset) };
      if (beside(site.surfaceAt(q))) return q;
    }
  }
  return null;
};

/** Does a circle of radius `r` round p reach into a building (sampled at its centre and 16 points round it)? */
const touchesBuilding = (site: Site, p: Pt, r: number): boolean =>
  site.surfaceAt(p) === "building" || AROUND.some((d, i) => i % 2 === 0 && site.surfaceAt({ x: p.x + d.x * r, z: p.z + d.z * r }) === "building");

/**
 * p itself when a piece `r` metres round keeps out of the buildings; else the nearest point
 * within `reach` metres where it does (a sculpture from a node on a facade, the mural's); null
 * when there is none.
 */
export const offWall = (site: Site, p: Pt, r: number, reach = 4): Pt | null => {
  if (!touchesBuilding(site, p, r)) return p;
  for (let d = 0.25; d <= reach; d += 0.25) {
    for (const u of AROUND) {
      const q = { x: p.x + u.x * d, z: p.z + u.z * d };
      if (!touchesBuilding(site, q, r)) return q;
    }
  }
  return null;
};

/** Radical inverse in `base` (Halton sequence). */
const halton = (i: number, base: number): number => {
  let f = 1;
  let r = 0;
  let k = i;
  while (k > 0) {
    f /= base;
    r += f * (k % base);
    k = Math.floor(k / base);
  }
  return r;
};

/**
 * `count` points scattered in a ring, at least `gap` apart, on open ground: a Halton sequence
 * started at an offset from `seed`, so it is spread evenly and the same every time.
 */
export const scatter = (site: Site, ring: readonly Pt[], count: number, seed: string, gap: number): Pt[] => {
  const box = ringBounds(ring);
  const out: Pt[] = [];
  const start = 1 + (fnv(seed) % 997);
  for (let k = 0; k < count * 60 && out.length < count; k++) {
    const p = { x: box.minX + (box.maxX - box.minX) * halton(start + k, 2), z: box.minZ + (box.maxZ - box.minZ) * halton(start + k, 3) };
    if (!pointInRing(p, ring) || !site.standable(p)) continue;
    if (out.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < gap)) continue;
    out.push(p);
  }
  return out;
};
