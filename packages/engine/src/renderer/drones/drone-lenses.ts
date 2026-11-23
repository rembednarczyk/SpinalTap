import { type CityKitData, swatchUv } from "../city-kit-data";
import type { DroneTemplate } from "./drone-models";

/**
 * A drone's lights as lamps, not blocks (the user's note of 22.11): every light of the model (its triangles on a neon
 * swatch: the patrol's red and blue bar, the navigation lights on the fans, the belly light) is cut out and drawn again
 * as a lens, a low dome over its footprint on a dark housing ring, round in plan, as a lamp's lens is. A light whose
 * swatch flashes (the patrol's bar) keeps its vertices in a range of its own, so the views blink it, red and blue in
 * turn, as a police bar does. Pure data, no Babylon.
 */

/** A range of the template's vertices that flashes, and its phase in the flashing's cycle (0 or 0.5). */
export interface DroneFlash {
  readonly from: number;
  readonly to: number;
  readonly phase: number;
}

export interface LensedTemplate extends DroneTemplate {
  readonly flashes: readonly DroneFlash[];
}

/** The lights' swatches, and which of them flash and at which phase of the cycle. */
const LIGHTS: ReadonlySet<string> = new Set(["neon-red", "neon-blue", "neon-green", "neon-amber", "neon-pink", "neon-cyan"]);
/** Segments round a lens and its rings up (a dome of a few steps reads round at a drone's size). */
const SEG = 12;
const RINGS = 3;
/** The housing's ring: this much wider than the lens (on the old light's footprint), this tall, on the kit's dark trim. */
const RIM = 0.015;
const RIM_H = 0.012;

interface Light {
  swatch: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-4;

/**
 * The template with its lights as lenses. `flash` names the swatches that blink and their phase: the patrol's red at 0,
 * its blue at 0.5. The airframe and the rest keep their triangles as they were.
 */
export const withLenses = (data: CityKitData, t: DroneTemplate, flash: Readonly<Record<string, number>> = {}): LensedTemplate => {
  const uvOf = new Map<string, readonly [number, number]>();
  for (const s of LIGHTS) uvOf.set(s, swatchUv(data, s));
  const swatchOf = (v: number): string | null => {
    for (const [s, uv] of uvOf) if (near(t.uvs[v * 2] ?? -1, uv[0]) && near(t.uvs[v * 2 + 1] ?? -1, uv[1])) return s;
    return null;
  };
  // The kept triangles, and the lights' boxes: a light is the triangles of one swatch on one side (x) of the drone.
  const keep: number[] = [];
  const lights = new Map<string, Light>();
  for (let i = 0; i < t.indices.length; i += 3) {
    const tri = [t.indices[i]!, t.indices[i + 1]!, t.indices[i + 2]!];
    const s = swatchOf(tri[0]!);
    if (!s || tri.some((v) => swatchOf(v) !== s)) {
      keep.push(...tri);
      continue;
    }
    const cx = tri.reduce((a, v) => a + t.positions[v * 3]!, 0) / 3;
    const key = `${s}:${Math.abs(cx) < 0.02 ? 0 : Math.sign(cx)}`;
    const l = lights.get(key) ?? { swatch: s, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (const v of tri) {
      const [x, y, z] = [t.positions[v * 3]!, t.positions[v * 3 + 1]!, t.positions[v * 3 + 2]!];
      l.minX = Math.min(l.minX, x);
      l.maxX = Math.max(l.maxX, x);
      l.minY = Math.min(l.minY, y);
      l.maxY = Math.max(l.maxY, y);
      l.minZ = Math.min(l.minZ, z);
      l.maxZ = Math.max(l.maxZ, z);
    }
    lights.set(key, l);
  }
  const pos = Array.from(t.positions);
  const nor = Array.from(t.normals);
  const uvs = Array.from(t.uvs);
  const col = Array.from(t.colors);
  const ind = keep;
  const trim = swatchUv(data, "dark");
  const vert = (x: number, y: number, z: number, nx: number, ny: number, nz: number, uv: readonly [number, number]): number => {
    pos.push(x, y, z);
    nor.push(nx, ny, nz);
    uvs.push(uv[0], uv[1]);
    col.push(1, 1, 1, 1);
    return pos.length / 3 - 1;
  };
  const flashes: DroneFlash[] = [];
  // Over the airframe's middle a light looks up (the bar, the fans' lights), under it down (the belly light).
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 1; i < t.positions.length; i += 3) {
    lo = Math.min(lo, t.positions[i]!);
    hi = Math.max(hi, t.positions[i]!);
  }
  const mid = (lo + hi) / 2;
  // Lights in a fixed order (by key), so the same model gives the same template.
  for (const [, l] of [...lights].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const from = pos.length / 3;
    const cx = (l.minX + l.maxX) / 2;
    const cz = (l.minZ + l.maxZ) / 2;
    // The housing's ring on the light's footprint, the lens inside it: the drone keeps its size.
    const rx = Math.max((l.maxX - l.minX) / 2 - RIM, 0.01);
    const rz = Math.max((l.maxZ - l.minZ) / 2 - RIM, 0.01);
    // No taller than the light it replaces: the ring and the dome within its box, so the drone keeps its size.
    const h = Math.max(l.maxY - l.minY - RIM_H, 0.01);
    const down = (l.minY + l.maxY) / 2 < mid;
    // The housing sits on the light's base: its bottom looking up, its top looking down.
    const dir = down ? -1 : 1;
    const y0 = down ? l.maxY : l.minY;
    const uv = uvOf.get(l.swatch)!;
    // The housing: a dark ring a little wider than the lens, as tall as a bezel.
    for (let k = 0; k < SEG; k++) {
      const a0 = (k / SEG) * 2 * Math.PI;
      const a1 = ((k + 1) / SEG) * 2 * Math.PI;
      const [c0, s0, c1, s1] = [Math.cos(a0), Math.sin(a0), Math.cos(a1), Math.sin(a1)];
      const p = [
        vert(cx + (rx + RIM) * c0, y0, cz + (rz + RIM) * s0, c0, 0, s0, trim),
        vert(cx + (rx + RIM) * c1, y0, cz + (rz + RIM) * s1, c1, 0, s1, trim),
        vert(cx + (rx + RIM) * c1, y0 + dir * RIM_H, cz + (rz + RIM) * s1, c1, 0, s1, trim),
        vert(cx + (rx + RIM) * c0, y0 + dir * RIM_H, cz + (rz + RIM) * s0, c0, 0, s0, trim),
      ];
      // Wound as the kit's boxes (`GeometrySink.box`): their face normal by (b - a) x (c - a) against the vertex normal.
      if (down) ind.push(p[0]!, p[2]!, p[1]!, p[0]!, p[3]!, p[2]!);
      else ind.push(p[0]!, p[1]!, p[2]!, p[0]!, p[2]!, p[3]!);
    }
    // The lens: rings of a dome (a quarter circle in profile), from the ring's top to its crown.
    const rings: number[][] = [];
    for (let r = 0; r <= RINGS; r++) {
      const a = (r / RINGS) * (Math.PI / 2);
      const k = Math.cos(a);
      const up = Math.sin(a);
      const ring: number[] = [];
      for (let s = 0; s < SEG; s++) {
        const b = (s / SEG) * 2 * Math.PI;
        ring.push(vert(cx + rx * k * Math.cos(b), y0 + dir * (RIM_H + h * up), cz + rz * k * Math.sin(b), k * Math.cos(b), dir * up, k * Math.sin(b), uv));
      }
      rings.push(ring);
    }
    for (let r = 0; r < RINGS; r++) {
      for (let s = 0; s < SEG; s++) {
        const [a, b] = [rings[r]![s]!, rings[r]![(s + 1) % SEG]!];
        const [c, d] = [rings[r + 1]![s]!, rings[r + 1]![(s + 1) % SEG]!];
        if (down) ind.push(a, c, b, b, c, d);
        else ind.push(a, b, c, b, d, c);
      }
    }
    // Only a light on the top flashes (the patrol's bar): the navigation lights on the fans stay steady.
    const phase = flash[l.swatch];
    const onTop = (l.minY + l.maxY) / 2 > lo + 0.7 * (hi - lo);
    if (phase !== undefined && onTop) flashes.push({ from, to: pos.length / 3, phase });
  }
  return {
    positions: Float32Array.from(pos),
    normals: Float32Array.from(nor),
    uvs: Float32Array.from(uvs),
    colors: Float32Array.from(col),
    indices: Uint32Array.from(ind),
    vertexCount: pos.length / 3,
    flashes,
  };
};
