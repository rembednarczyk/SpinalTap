import { STEP_LOOK } from "../../npr/toon-city";
import { DRESS_FLAG, type MeshSink, type Rgba, type Vec, hexColor } from "../mesh-sink";
import { type HeightAt, drape } from "./ground-plan";
import { type P2, orientedBox } from "./polygon";
import { type Uv, face, quadUv, vertex } from "./sink-ops";
import { humped, layFlight } from "./steps-flight";

const TREAD = hexColor(STEP_LOOK.tread, DRESS_FLAG.solid);
const RISER = hexColor(STEP_LOOK.riser, DRESS_FLAG.solid);

/** The shortest band drawn as a flight (m): a shorter one is a sliver, drawn as nothing (G-213). */
export const MIN_FLIGHT = 0.33;
/** Treads stand this far above the terrain they follow, like a sidewalk over the road. */
const LIFT = 0.05;

/**
 * Whether the side a-c of a band runs along the map's edge, a side of a chunk's terrain with no
 * terrain past it: the renderer's and the glitch scan's `TerrainEntries.onMapEdge`, which looks
 * for a terrain `EDGE_PROBE` past the side. Not "a terrain at the side plus a hair", which every
 * terrain answers within its margin, so it never saw the edge (G-703).
 */
export type MapEdgeAt = (a: P2, c: P2) => boolean;

/**
 * The ground `terrain` read on the map's side of its edge where the edge cut the band: the import
 * cuts a way along a chunk's edge, so a side of the band at its bounds may be the map's edge. A
 * band the edge cuts slantwise has a box running past the edge, and a drape's normals look 0.75 m
 * past its vertices; the ground there, off every chunk, is 0, and a riser down to it was a wall
 * of 20 m (G-703). At a seam between chunks the ground goes on and is read as it is, so the bands
 * on both sides share it. The surface under a point (`surfaceAt`, a bridge's deck, G-301) is read
 * with the same cut.
 */
const onItsSide = (ring: readonly P2[], terrain: HeightAt, mapEdgeAt: MapEdgeAt): HeightAt => {
  const cutAt = (of: (p: P2) => number, side: number) => {
    const v = side * Math.max(...ring.map((p) => side * of(p)));
    const cut = ring.some((p, i) => {
      const q = ring[(i + 1) % ring.length] as P2;
      return of(p) === v && of(q) === v && mapEdgeAt(p, q);
    });
    return cut ? v : side * Infinity;
  };
  const [x0, x1] = [-1, 1].map((side) => cutAt((p) => p.x, side)) as [number, number];
  const [z0, z1] = [-1, 1].map((side) => cutAt((p) => p.z, side)) as [number, number];
  if (x0 === -Infinity && x1 === Infinity && z0 === -Infinity && z1 === Infinity) return terrain;
  const clampX = (x: number) => Math.min(x1, Math.max(x0, x));
  const clampZ = (z: number) => Math.min(z1, Math.max(z0, z));
  const cut = (surface: HeightAt): HeightAt => (x, z) => surface(clampX(x), clampZ(z));
  const under = terrain.surfaceAt;
  if (!under) return cut(terrain);
  // The drape reads each surface once per corner of its grid, by the surface: one cut per surface.
  const cuts = new Map<HeightAt, HeightAt>();
  const surfaceAt = (x: number, z: number): HeightAt => {
    const s = under(clampX(x), clampZ(z));
    let c = cuts.get(s);
    if (!c) cuts.set(s, (c = cut(s)));
    return c;
  };
  return Object.assign(cut(terrain), { surfaceAt });
};

/**
 * A quad of a flight: wound to face `facing` (a tread's up, a riser's down the flight) but with
 * the normal `ramp` of the flight's ramp, so the geometry buffer sees no crease at a riser and the
 * line art draws no ink line on each; the vertex stage shades it by its face near (`STEPS_VERTEX_GLSL`).
 * `lift` per corner is uv2.y, how far the corner rises onto the ramp from far.
 */
const stepQuad = (sink: MeshSink, c: readonly [Vec, Vec, Vec, Vec], facing: Vec, ramp: Vec, color: Rgba, code: number, lift: readonly [number, number, number, number]): void => {
  const ids = c.map((p, k) => vertex(sink, p, ramp, color, [p.x, p.z] as Uv, [code, lift[k] as number]));
  face(sink, ids[0] as number, ids[1] as number, ids[2] as number, facing);
  face(sink, ids[0] as number, ids[2] as number, ids[3] as number, facing);
};

/**
 * A flight of outdoor steps (ADR-0044) on one straight run of a map's `highway=steps`: the
 * band's long side is the run. Its risers keep the norm (`STEP_NORM`, G-840): how many and where
 * comes from the rise of the ground between the run's ends and where the ground climbs between
 * them (`layFlight`), each tread level and on or over the ground across the band, what the run is
 * longer than its treads lying in landings and level stretches at its foot and top. A run whose
 * ends lie less than a riser of the norm apart lies on the ground as paving; a level one keeps a
 * level slab with a kerb at each end. `mapEdgeAt` tells where the map's edge cut the band (G-703);
 * `osm` is how many steps the map counts on it (`osmStepCount`).
 */
export const planSteps = (sink: MeshSink, ring: readonly P2[], terrain: HeightAt, mapEdgeAt: MapEdgeAt = () => false, osm?: number): void => {
  if (ring.length < 3) return;
  const h = onItsSide(ring, terrain, mapEdgeAt);
  const box = orientedBox(ring);
  const length = box.halfLong * 2;
  if (length < MIN_FLIGHT || box.halfShort < 0.2) return;
  const at = (u: number, v: number): P2 => ({ x: box.cx + box.ux * u - box.uz * v, z: box.cz + box.uz * u + box.ux * v });
  const w = box.halfShort;
  // The ground along the band's axis: a band across a slope stands on it in the middle, as a level tread must.
  const ground = (u: number) => {
    const p = at(u, 0);
    return h(p.x, p.z);
  };
  // Along the run from its low end: `t` from 0 at the foot to `length` at the top.
  const up = ground(box.halfLong) >= ground(-box.halfLong) ? 1 : -1;
  const uOf = (t: number) => up * (t - box.halfLong);
  const along = (t: number) => ground(uOf(t));
  // Over a crest or a hollow no level tread keeps on the ground: paving, as on a gentle run.
  const hump = humped(length, along);
  const flight = hump ? null : layFlight(length, along, osm);
  const base = ground(uOf(0)) + LIFT;
  if (!flight && (hump || ground(uOf(length)) + LIFT - base >= 0.01)) {
    drape(sink, ring, h, LIFT, TREAD, (p) => [p.x, p.z], [0, 0]);
    return;
  }
  const risers = flight?.at ?? [];
  const r = flight?.riser ?? 0;
  const cuts = [0, ...risers, length];
  const dir = { x: box.ux * up, z: box.uz * up };
  const ramp = (slope: number): Vec => {
    const l = Math.hypot(slope, 1);
    return { x: (-slope * dir.x) / l, y: 1 / l, z: (-slope * dir.z) / l };
  };
  const p3 = (t: number, v: number, y: number): Vec => {
    const p = at(uOf(t), v);
    return { x: p.x, y, z: p.z };
  };
  const upN = { x: 0, y: 1, z: 0 };
  const down = { x: -dir.x, y: 0, z: -dir.z };
  let below = ramp(0);
  for (let j = 0; j + 1 < cuts.length; j++) {
    const [t0, t1] = [cuts[j] as number, cuts[j + 1] as number];
    const y = base + j * r;
    if (j > 0) stepQuad(sink, [p3(t0, -w, y - r), p3(t0, w, y - r), p3(t0, w, y), p3(t0, -w, y)], down, below, RISER, STEP_LOOK.code.riser, [r, r, 0, 0]);
    if (t1 - t0 < 1e-6) continue;
    // The tread's back edge rises onto the next nosing from far; the top's stays.
    const lift = j < risers.length ? r : 0;
    // No steeper than 45°: a sliver of a tread at a foot would crease against the next in the geometry buffer.
    const n = ramp(Math.min(1, lift / (t1 - t0)));
    stepQuad(sink, [p3(t0, -w, y), p3(t1, -w, y), p3(t1, w, y), p3(t0, w, y)], upN, n, TREAD, STEP_LOOK.code.tread, [0, lift, lift, 0]);
    below = n;
  }
  // The ends: from the ground up to the foot and the top, a kerb.
  const kerb = (t: number, to: number) => {
    const u = uOf(t);
    const from = ground(u);
    if (Math.abs(to - from) < 0.01) return;
    const l = at(u, -w);
    const rr = at(u, w);
    const uv = (p: P2): [number, number] => [p.x, p.z];
    // A kerb faces down the flight, towards the lower of its two levels.
    const n = to > from ? { x: -box.ux, y: 0, z: -box.uz } : { x: box.ux, y: 0, z: box.uz };
    quadUv(sink, [{ x: l.x, y: from, z: l.z }, { x: rr.x, y: from, z: rr.z }, { x: rr.x, y: to, z: rr.z }, { x: l.x, y: to, z: l.z }], n, RISER, [uv(l), uv(rr), uv(rr), uv(l)]);
  };
  kerb(0, base);
  kerb(length, base + risers.length * r);
};
