import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { type Matrix, Scene, Vector3 } from "../src/babylon";
import { NIGHT_RIG } from "../src/npr/lighting";
import { MoonShadow } from "../src/npr/moon-shadow";
import { cable } from "../src/renderer/mapcity/canyon-plan";
import { MeshSink, hexColor } from "../src/renderer/mesh-sink";

/**
 * The moon shadow of a garland's cable on the CPU, as the GPU makes it: the faces turned to the
 * moon (the depth material culls the others) rasterised at texel centres into the nearest depth of
 * the widest square (56 m at 2048 px, a texel 2.7 cm), and the ground under the cable read through
 * the receivers' filter (moonShadow() in the toon shader: a 3-texel box, 4x4 taps with bilinear
 * weights at the rim, cut at a half; its fwidth smoothing only softens that cut).
 */
const SIZE = 2048;
/** High's depth bias (babylon-renderer). */
const BIAS = 0.0012;
const MOON = new Vector3(NIGHT_RIG.sunDir.x, NIGHT_RIG.sunDir.y, NIGHT_RIG.sunDir.z).normalize();

const depthMap = (sink: MeshSink, m: Matrix): Float32Array => {
  const map = new Float32Array(SIZE * SIZE).fill(1);
  const p = sink.positions;
  const n = sink.normals;
  const at = (i: number): [number, number, number] => {
    const v = Vector3.TransformCoordinates(new Vector3(p[3 * i]!, p[3 * i + 1]!, p[3 * i + 2]!), m);
    return [(v.x * 0.5 + 0.5) * SIZE, (v.y * 0.5 + 0.5) * SIZE, v.z * 0.5 + 0.5];
  };
  const ix = sink.indices;
  for (let t = 0; t < ix.length; t += 3) {
    const k0 = 3 * ix[t]!;
    if (n[k0]! * MOON.x + n[k0 + 1]! * MOON.y + n[k0 + 2]! * MOON.z <= 0) continue;
    const [a, b, c] = [at(ix[t]!), at(ix[t + 1]!), at(ix[t + 2]!)];
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 1e-12) continue;
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    const x1 = Math.min(SIZE - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    const y1 = Math.min(SIZE - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area;
        const w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const d = w0 * a[2] + w1 * b[2] + w2 * c[2];
        const k = y * SIZE + x;
        if (d < map[k]!) map[k] = d;
      }
  }
  return map;
};

/** Lit share of the receivers' 3-texel box at `q`. */
const lit = (map: Float32Array, m: Matrix, q: Vector3): number => {
  const v = Vector3.TransformCoordinates(q, m);
  const d = v.z * 0.5 + 0.5 - BIAS;
  const tx = (v.x * 0.5 + 0.5) * SIZE - 0.5;
  const ty = (v.y * 0.5 + 0.5) * SIZE - 0.5;
  const bx = Math.floor(tx);
  const by = Math.floor(ty);
  const wx = [1 - (tx - bx), 1, 1, tx - bx];
  const wy = [1 - (ty - by), 1, 1, ty - by];
  let sum = 0;
  for (let j = -1; j <= 2; j++) for (let i = -1; i <= 2; i++) sum += wx[i + 1]! * wy[j + 1]! * (d <= (map[(by + j) * SIZE + bx + i] ?? 1) ? 1 : 0);
  return sum / 9;
};

/** Share of the ground points under an 8 m cable 5 m up, `deg` from the x axis, that come out dark. */
const traceShadowed = (deg: number, focus: { x: number; z: number }): number => {
  const scene = new Scene(new NullEngine());
  const shadow = new MoonShadow(scene, NIGHT_RIG, 28, SIZE);
  const m = shadow.update({ x: focus.x, y: 0, z: focus.z });
  if (!m) throw new Error("no light matrix");
  // Looking down the street the square is the widest.
  expect(shadow.coverage).toBe(56);
  const yaw = (deg * Math.PI) / 180;
  const a = new Vector3(-Math.cos(yaw) * 4, 5, -Math.sin(yaw) * 4);
  const b = new Vector3(-a.x, 5, -a.z);
  const sink = new MeshSink();
  cable(sink, a, b, 0.4, hexColor("#15161b"));
  const map = depthMap(sink, m);
  let dark = 0;
  const samples = 400;
  for (let i = 0; i < samples; i++) {
    const t = 0.05 + (0.9 * i) / (samples - 1);
    const p = new Vector3(a.x + (b.x - a.x) * t, 5 - Math.sin(t * Math.PI) * 0.4, a.z + (b.z - a.z) * t);
    if (lit(map, m, p.subtract(MOON.scale(p.y / MOON.y))) < 0.5) dark++;
  }
  scene.getEngine().dispose();
  return dark / samples;
};

describe("a garland's cable casts its moon shadow far out too (G-800)", () => {
  for (let deg = 0; deg < 180; deg += 15)
    it(`a 5 cm cable at ${deg} degrees leaves an unbroken shadow in the 56 m square`, () => {
      for (const focus of [
        { x: 0.013, z: -0.007 },
        { x: 0.6, z: 0.31 },
      ])
        expect(traceShadowed(deg, focus), `focus ${focus.x}, ${focus.z}`).toBeGreaterThanOrEqual(0.8);
    });
});
