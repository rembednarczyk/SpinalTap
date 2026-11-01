import { DRAIN_GRATE, GRAFFITI_DESIGNS, HOUSE_PLATE, STICKER, STICKER_HOSTS, type StreetPropItem, grateVariant, graffitiVariant, hostFace, hostFaces, plateVariant, stickerVariant } from "@seki/core";
import { describe, expect, it } from "vitest";
import type { MeshSink } from "../src/renderer/mesh-sink";
import { STICKER_OUT, decalModel, grateModel, plateModel, stickerModel } from "../src/renderer/mapcity/decal-models";
import { LAYER, graffitiModel } from "../src/renderer/mapcity/decal-paint";
import { toWorld } from "../src/renderer/mapcity/prop-batch";
import { buildPropModel } from "../src/renderer/mapcity/prop-models";

/**
 * The decals of ADR-0058 stage 6 as the renderer builds them from their variants: flat on the wall
 * inside their layout's rectangle, a sticker on its host's face as the host's model draws it, a
 * grate on the road's fall. The glitch scan checks where they stand; this checks they are drawn there.
 */

const points = (s: MeshSink) =>
  Array.from({ length: s.vertexCount }, (_, i) => ({
    x: s.positions[i * 3]!,
    y: s.positions[i * 3 + 1]!,
    z: s.positions[i * 3 + 2]!,
  }));
const EPS = 1e-6;

describe("graffiti (ADR-0058 stage 6)", () => {
  it("lies flat in its layers off the wall, inside its rectangle, for every design and size", () => {
    for (let design = 0; design < GRAFFITI_DESIGNS; design++) {
      for (const [width, height, lift] of [
        [0.6, 0.3, 0.3],
        [1.7, 0.9, 0.4],
        [3.2, 1.6, 0.3],
        [6, 4, 12.5],
      ] as const) {
        const g = graffitiModel({ design, width, height, lift });
        expect(g.vertexCount, `design ${design}`).toBeGreaterThan(0);
        for (const p of points(g)) {
          expect(Math.abs(p.x), `design ${design} ${width}x${height}`).toBeLessThanOrEqual(width / 2 + EPS);
          expect(p.y).toBeGreaterThanOrEqual(lift - EPS);
          expect(p.y).toBeLessThanOrEqual(lift + height + EPS);
          expect([LAYER.line, LAYER.fill, LAYER.top]).toContain(p.z);
        }
        for (let i = 0; i < g.vertexCount; i++) expect([g.normals[i * 3], g.normals[i * 3 + 1], g.normals[i * 3 + 2]]).toEqual([0, 0, 1]);
        // The same layout, the same paint.
        expect(graffitiModel({ design, width, height, lift }).positions).toEqual(g.positions);
      }
    }
  });

  it("draws every design differently", () => {
    const looks = Array.from({ length: GRAFFITI_DESIGNS }, (_, design) => JSON.stringify(graffitiModel({ design, width: 2, height: 1, lift: 0.3 }).positions));
    expect(new Set(looks).size).toBe(GRAFFITI_DESIGNS);
  });
});

describe("house number plates", () => {
  it("stands its plate inside its rectangle on the wall, the number on it", () => {
    for (const [number, letter] of [
      [7, 0],
      [12, 1],
      [128, 2],
      [0, 0],
    ] as const) {
      const s = plateModel(plateVariant({ number, letter, lift: 2.2 }));
      for (const p of points(s)) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(HOUSE_PLATE.width / 2 + EPS);
        expect(p.y).toBeGreaterThanOrEqual(2.2 - EPS);
        expect(p.y).toBeLessThanOrEqual(2.2 + HOUSE_PLATE.height + EPS);
        expect(p.z).toBeGreaterThanOrEqual(-EPS);
        expect(p.z).toBeLessThanOrEqual(0.03);
      }
    }
    // More digits, more of them drawn.
    expect(plateModel(plateVariant({ number: 128, letter: 0, lift: 2 })).vertexCount).toBeGreaterThan(plateModel(plateVariant({ number: 7, letter: 0, lift: 2 })).vertexCount);
  });
});

/** The triangles of a model whose plane faces along (nx, 0, nz) and passes `out` from the axis at height y, near (x, z). */
const onModelFace = (m: MeshSink, nx: number, nz: number, p: { x: number; y: number; z: number }): boolean => {
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => {
      const i = m.indices[t + k]!;
      return {
        x: m.positions[i * 3]!,
        y: m.positions[i * 3 + 1]!,
        z: m.positions[i * 3 + 2]!,
      };
    });
    const e1 = { x: b!.x - a!.x, y: b!.y - a!.y, z: b!.z - a!.z };
    const e2 = { x: c!.x - a!.x, y: c!.y - a!.y, z: c!.z - a!.z };
    const n = {
      x: e1.y * e2.z - e1.z * e2.y,
      y: e1.z * e2.x - e1.x * e2.z,
      z: e1.x * e2.y - e1.y * e2.x,
    };
    const l = Math.hypot(n.x, n.y, n.z);
    if (l < 1e-9) continue;
    const u = { x: n.x / l, y: n.y / l, z: n.z / l };
    const s = Math.sign(u.x * nx + u.z * nz) || 1;
    if (Math.abs(u.y) > 0.01 || u.x * s * nx + u.z * s * nz < 0.999) continue;
    // In the triangle's plane, and inside it.
    const d = (p.x - a!.x) * u.x + (p.y - a!.y) * u.y + (p.z - a!.z) * u.z;
    if (Math.abs(d) > 0.002) continue;
    const area = (q: typeof a, r: typeof a, w: typeof a) => {
      const f = { x: r!.x - q!.x, y: r!.y - q!.y, z: r!.z - q!.z };
      const g = { x: w!.x - q!.x, y: w!.y - q!.y, z: w!.z - q!.z };
      return (f.y * g.z - f.z * g.y) * u.x + (f.z * g.x - f.x * g.z) * u.y + (f.x * g.y - f.y * g.x) * u.z;
    };
    const w0 = area(b, c, p);
    const w1 = area(c, a, p);
    const w2 = area(a, b, p);
    if ((w0 >= -1e-9 && w1 >= -1e-9 && w2 >= -1e-9) || (w0 <= 1e-9 && w1 <= 1e-9 && w2 <= 1e-9)) return true;
  }
  return false;
};

type V = { x: number; y: number; z: number };
/** Does the ray from `o` along `d` cross a triangle of the model between t0 and t1 (Möller-Trumbore)? */
const rayHits = (m: MeshSink, o: V, d: V, t0: number, t1: number): boolean => {
  const at = (i: number): V => ({
    x: m.positions[i * 3]!,
    y: m.positions[i * 3 + 1]!,
    z: m.positions[i * 3 + 2]!,
  });
  const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const cross = (a: V, b: V): V => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  });
  const dot = (a: V, b: V): number => a.x * b.x + a.y * b.y + a.z * b.z;
  for (let k = 0; k < m.indices.length; k += 3) {
    const a = at(m.indices[k]!);
    const e1 = sub(at(m.indices[k + 1]!), a);
    const e2 = sub(at(m.indices[k + 2]!), a);
    const p = cross(d, e2);
    const det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(o, a);
    const u = dot(s, p) / det;
    const q = cross(s, e1);
    const v = dot(d, q) / det;
    const t = dot(e2, q) / det;
    if (u >= 0 && v >= 0 && u + v <= 1 && t > t0 && t < t1) return true;
  }
  return false;
};

describe("stickers on their hosts", () => {
  it("has the faces of the hosts' models where the decals' table says (`STICKER_HOSTS`)", () => {
    for (const h of STICKER_HOSTS) {
      const model = buildPropModel(h.kind, 0).sink;
      for (const face of hostFaces(h)) {
        for (const y of [h.low - STICKER.height / 2, h.low, h.high, h.high + STICKER.height / 2]) {
          const f = hostFace(h, face, y);
          const t = { x: -f.nz, z: f.nx };
          for (const along of [-STICKER.width / 2, 0, STICKER.width / 2]) {
            const p = {
              x: f.nx * f.out + t.x * along,
              y,
              z: f.nz * f.out + t.z * along,
            };
            expect(onModelFace(model, f.nx, f.nz, p), `${h.kind} face ${face} at ${y.toFixed(2)} m, ${along} along`).toBe(true);
          }
        }
      }
    }
  });

  it("puts no part of the host's model in front of a sticker (the modern lamp's LED strip, the cabinet's lamp)", () => {
    for (const h of STICKER_HOSTS) {
      const model = buildPropModel(h.kind, 0).sink;
      for (const face of hostFaces(h)) {
        // Every 2 cm over the heights a sticker covers.
        for (let y = h.low - STICKER.height / 2; y <= h.high + STICKER.height / 2 + 1e-9; y += 0.02) {
          const f = hostFace(h, face, y);
          const t = { x: -f.nz, z: f.nx };
          for (const along of [-STICKER.width / 2, 0, STICKER.width / 2]) {
            // Does a ray out of the face from this point of the sticker hit the model within 5 cm?
            const p = {
              x: f.nx * f.out + t.x * along,
              y,
              z: f.nz * f.out + t.z * along,
            };
            const hit = rayHits(model, p, { x: f.nx, y: 0, z: f.nz }, 0.002, 0.05);
            expect(hit, `${h.kind} face ${face} at ${y.toFixed(2)} m, ${along} along`).toBe(false);
          }
        }
      }
    }
  });

  it("sticks every sticker flat on its face, `STICKER_OUT` off it", () => {
    expect(STICKER_OUT).toBeGreaterThanOrEqual(0.002);
    STICKER_HOSTS.forEach((h, host) => {
      for (const face of hostFaces(h)) {
        const s = stickerModel(stickerVariant({ design: face % 8, host, face, lift: h.low }));
        expect(s.vertexCount).toBeGreaterThan(0);
        for (const p of points(s)) {
          const f = hostFace(h, face, p.y);
          const off = p.x * f.nx + p.z * f.nz - f.out;
          expect(off, h.kind).toBeGreaterThanOrEqual(STICKER_OUT - EPS);
          expect(off, h.kind).toBeLessThanOrEqual(STICKER_OUT + 0.001 + EPS);
          expect(Math.abs(-p.x * f.nz + p.z * f.nx)).toBeLessThanOrEqual(STICKER.width / 2 + EPS);
        }
      }
    });
  });
});

describe("gully grates", () => {
  it("lie on the road's fall, from its underside to its top over the terrain under its middle", () => {
    for (const [slopeX, slopeZ] of [
      [0, 0],
      [0.08, -0.05],
      [-0.15, 0.15],
    ] as const) {
      const g = grateModel(grateVariant({ casting: 1, slopeX, slopeZ }));
      for (const p of points(g)) {
        const plane = slopeX * p.x + slopeZ * p.z;
        expect(p.y - plane).toBeGreaterThanOrEqual(DRAIN_GRATE.bottom - EPS);
        expect(p.y - plane).toBeLessThanOrEqual(DRAIN_GRATE.top + 0.002 + EPS);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(DRAIN_GRATE.length / 2 + EPS);
        expect(Math.abs(p.z)).toBeLessThanOrEqual(DRAIN_GRATE.width / 2 + EPS);
      }
    }
  });
});

describe("decals among the street furniture", () => {
  it("keep their variants into the world pieces and build from them", () => {
    const items: StreetPropItem[] = [
      {
        prop: "graffiti",
        x: 1,
        y: 0,
        z: 2,
        yaw: 0,
        variant: graffitiVariant({
          design: 3,
          width: 1,
          height: 0.6,
          lift: 0.3,
        }),
      },
      { prop: "bench", x: 4, y: 0, z: 2, yaw: 0, variant: 77 },
    ];
    const [g, b] = toWorld(items, { x: 0, y: 0, z: 0 });
    expect(g!.variant).toBe(items[0]!.variant);
    expect(b!.variant).toBeUndefined();
    expect(decalModel("graffiti", g!.variant!)!.positions).toEqual(graffitiModel({ design: 3, width: 1, height: 0.6, lift: 0.3 }).positions);
    expect(decalModel("bench", 0)).toBeNull();
  });
});
