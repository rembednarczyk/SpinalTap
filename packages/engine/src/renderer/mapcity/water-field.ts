import { WATER_FAR, WATER_NEVER, WATER_SETTS } from "../../npr/water-mask";
import type { MeshSink } from "../mesh-sink";
import { SURFACE_CODE } from "./ground-plan";
import type { GroundEntry, MapEntries } from "./map-entries";
import { type Box2, type P2, pointInRing } from "./polygon";

/**
 * The water field of the map city's ground (ADR-0084 stage 1), baked into its third UV channel
 * (`npr/water-mask.ts`): from the geometry the city has, nothing drawn at random. Per vertex,
 * x = distance to the nearest edge of a carriageway (a road's or a zebra's edge with no road past
 * it: the kerb, where the cross fall sends the rain), y = how well the place holds water: the
 * hollows and flats of the terrain (NMT), the foot of steps; never on zebras, decks, kerbs, walls,
 * lawns and rails. Reads a box round a cell once, so the cells' seams meet.
 */

/** How far from a point carriageway edges are looked for (m): the ruts of three lanes. */
const REACH = 12;
/** Side of the buckets the edges are sorted into (m). */
const BUCKET = 6;
/** Radius of the ring of terrain samples a hollow is measured against (m). */
const HOLLOW_R = 4;
/** Side of the lattice the terrain's hollows are read on (m): the drape's grid. */
const LATTICE = 2.5;
/** A hollow this deep under its ring holds water fully (m). */
const HOLLOW_FULL = 0.06;

interface Segment {
  readonly ax: number;
  readonly az: number;
  readonly dx: number;
  readonly dz: number;
  readonly len2: number;
}

interface StepsFoot {
  readonly ring: readonly P2[];
  readonly low: number;
  readonly box: Box2;
}

const distanceToSegment = (s: Segment, x: number, z: number): number => {
  const t = Math.max(0, Math.min(1, ((x - s.ax) * s.dx + (z - s.az) * s.dz) / s.len2));
  return Math.hypot(x - s.ax - s.dx * t, z - s.az - s.dz * t);
};

const distanceToRing = (ring: readonly P2[], x: number, z: number): number => {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as P2;
    const b = ring[(i + 1) % ring.length] as P2;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    if (len2 > 1e-9) best = Math.min(best, distanceToSegment({ ax: a.x, az: a.z, dx, dz, len2 }, x, z));
  }
  return pointInRing({ x, z }, ring) ? 0 : best;
};

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Surfaces water stands on: the carriageway, the setts, and the paving in its hollows. */
const HOLDS: ReadonlySet<number> = new Set([SURFACE_CODE.road, SURFACE_CODE.cobble, SURFACE_CODE.sidewalk, SURFACE_CODE.square, SURFACE_CODE.footway]);

export class WaterField {
  private readonly buckets = new Map<number, Segment[]>();
  private readonly feet: StepsFoot[] = [];
  private readonly terrain = new Map<number, readonly [number, number]>();

  constructor(
    private readonly entries: MapEntries,
    box: Box2,
  ) {
    const reach = { minX: box.minX - REACH, maxX: box.maxX + REACH, minZ: box.minZ - REACH, maxZ: box.maxZ + REACH };
    for (const id of [...entries.surfacesWithin(reach)].sort((a, b) => a - b)) {
      const g = entries.grounds.get(id);
      if (!g || g.marking) continue;
      if (g.surface === "road" || g.surface === "crossing") this.addEdges(g.ring);
      else if (g.surface === "steps") this.addFoot(g.ring);
    }
  }

  /** The edges of a carriageway's piece with no road past them. */
  private addEdges(ring: readonly P2[]): void {
    const roadAt = this.entries.roadAt;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i] as P2;
      const b = ring[(i + 1) % ring.length] as P2;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.3) continue;
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      const nx = (dz / len) * 0.3;
      const nz = (-dx / len) * 0.3;
      if (roadAt(mx + nx, mz + nz) && roadAt(mx - nx, mz - nz)) continue;
      const s = { ax: a.x, az: a.z, dx, dz, len2: len * len };
      const i0 = Math.floor((Math.min(a.x, b.x) - REACH) / BUCKET);
      const i1 = Math.floor((Math.max(a.x, b.x) + REACH) / BUCKET);
      const k0 = Math.floor((Math.min(a.z, b.z) - REACH) / BUCKET);
      const k1 = Math.floor((Math.max(a.z, b.z) + REACH) / BUCKET);
      for (let bi = i0; bi <= i1; bi++) {
        for (let bk = k0; bk <= k1; bk++) {
          const key = bi * 100003 + bk;
          const list = this.buckets.get(key);
          if (list) list.push(s);
          else this.buckets.set(key, [s]);
        }
      }
    }
  }

  private addFoot(ring: readonly P2[]): void {
    let low = Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of ring) {
      low = Math.min(low, this.entries.heightAt(p.x, p.z) ?? Infinity);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    if (Number.isFinite(low)) this.feet.push({ ring, low, box: { minX, maxX, minZ, maxZ } });
  }

  /** Distance to the nearest carriageway edge, `WATER_FAR` past `REACH`. */
  kerbDistance(x: number, z: number): number {
    const list = this.buckets.get(Math.floor(x / BUCKET) * 100003 + Math.floor(z / BUCKET));
    let best = WATER_FAR;
    if (list) for (const s of list) best = Math.min(best, distanceToSegment(s, x, z));
    return best;
  }

  /** The terrain's hollow and flatness at a corner of the lattice (`LATTICE`), each 0..1, read once. */
  private terrainAt(i: number, k: number): readonly [number, number] {
    const key = i * 100003 + k;
    const known = this.terrain.get(key);
    if (known) return known;
    const x = i * LATTICE;
    const z = k * LATTICE;
    const h = (px: number, pz: number) => this.entries.heightAt(px, pz);
    const h0 = h(x, z);
    let value: readonly [number, number] = [0, 0];
    if (h0 !== null) {
      let sum = 0;
      let n = 0;
      let slope = 0;
      for (let d = 0; d < 8; d++) {
        const a = (d * Math.PI) / 4;
        const y = h(x + Math.cos(a) * HOLLOW_R, z + Math.sin(a) * HOLLOW_R);
        if (y === null) continue;
        sum += y;
        n++;
        if (d < 4) {
          const o = h(x - Math.cos(a) * HOLLOW_R, z - Math.sin(a) * HOLLOW_R);
          if (o !== null) slope = Math.max(slope, Math.abs(y - o) / (2 * HOLLOW_R));
        }
      }
      const hollow = n > 0 ? Math.max(0, Math.min(1, (sum / n - h0 - 0.008) / HOLLOW_FULL)) : 0;
      value = [hollow, 1 - smoothstep(0.004, 0.02, slope)];
    }
    this.terrain.set(key, value);
    return value;
  }

  /**
   * How well the ground holds water at (x, z), 0..1: the terrain's hollows (and, off the paving,
   * its flats) between the lattice's corners, and the foot of steps.
   */
  hold(x: number, z: number, paving: boolean): number {
    const fx = x / LATTICE;
    const fz = z / LATTICE;
    const i = Math.floor(fx);
    const k = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - k;
    const c00 = this.terrainAt(i, k);
    const c10 = this.terrainAt(i + 1, k);
    const c01 = this.terrainAt(i, k + 1);
    const c11 = this.terrainAt(i + 1, k + 1);
    const lerp = (j: 0 | 1) => (c00[j] * (1 - tx) + c10[j] * tx) * (1 - tz) + (c01[j] * (1 - tx) + c11[j] * tx) * tz;
    const hollow = lerp(0);
    let value = paving ? 0.75 * hollow : 0.8 * hollow + 0.3 * lerp(1);
    for (const f of this.feet) {
      if (x < f.box.minX - 1.5 || x > f.box.maxX + 1.5 || z < f.box.minZ - 1.5 || z > f.box.maxZ + 1.5) continue;
      const h0 = this.entries.heightAt(x, z);
      if (h0 !== null && h0 < f.low + 0.4 && distanceToRing(f.ring, x, z) < 1.5) value += 0.5;
    }
    return Math.min(1, value);
  }

  /** The field at a point of a surface with code `code` (`SURFACE_CODE`) facing up by `ny`. */
  at(x: number, z: number, code: number, ny: number): readonly [number, number] {
    if (ny < 0.9 || !HOLDS.has(code)) return [WATER_FAR, WATER_NEVER];
    if (code === SURFACE_CODE.cobble) return [WATER_SETTS, this.hold(x, z, false)];
    const road = code === SURFACE_CODE.road;
    return [road ? this.kerbDistance(x, z) : WATER_FAR, this.hold(x, z, !road)];
  }

  /** Whether (x, y, z) lies on a bridge's deck: a piece lifted onto it drains like the deck. */
  private onDeck(x: number, y: number, z: number): boolean {
    const decks = this.entries.decks;
    if (!decks.near(x, z)) return false;
    const deck = decks.heightAt(x, z, y);
    return deck !== null && y > deck - 0.5;
  }

  /**
   * Bakes the field of the vertices `sink` has past its third UV channel, laid for `g`: none on
   * a zebra, a bridge's deck or steps, by the surface code of each vertex elsewhere.
   */
  bake(sink: MeshSink, g: GroundEntry | undefined): void {
    const never = !g || g.deck !== undefined || g.surface === "crossing" || g.surface === "steps" || g.surface === "water" || g.surface === "basin";
    const p = sink.positions;
    for (let v = sink.uvs3.length / 2; v < sink.vertexCount; v++) {
      const x = p[v * 3] ?? 0;
      const z = p[v * 3 + 2] ?? 0;
      const f = never || this.onDeck(x, p[v * 3 + 1] ?? 0, z) ? [WATER_FAR, WATER_NEVER] : this.at(x, z, Math.round(sink.uvs2[v * 2] ?? 0), sink.normals[v * 3 + 1] ?? 0);
      sink.uvs3.push(f[0] ?? WATER_FAR, f[1] ?? WATER_NEVER);
    }
  }

  /**
   * The field of the vertices `sink` has past its third UV channel that `lies` takes, by the
   * ground under them (the neon's streaks); none for the rest.
   */
  bakeOver(sink: MeshSink, lies: (v: number) => boolean): void {
    const p = sink.positions;
    for (let v = sink.uvs3.length / 2; v < sink.vertexCount; v++) {
      if (!lies(v)) {
        sink.uvs3.push(WATER_FAR, WATER_NEVER);
        continue;
      }
      const x = p[v * 3] ?? 0;
      const z = p[v * 3 + 2] ?? 0;
      const code = this.entries.roadAt(x, z) ? SURFACE_CODE.road : SURFACE_CODE.sidewalk;
      const f = this.at(x, z, code, 1);
      sink.uvs3.push(f[0], f[1]);
    }
  }
}
