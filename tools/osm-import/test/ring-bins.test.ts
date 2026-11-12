import { describe, expect, it } from "vitest";
import { type Pt, pointInRing, ringBounds } from "../src/geometry.ts";
import { RingBins } from "../src/ring-bins.ts";

/** A fixed sequence in [0, 1): the same rings and points every run. */
const lcg = (seed: number) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;

describe("rings by cells (kerbFills' index, G-522)", () => {
  const rnd = lcg(409);
  // Stars round random centres, from a few metres to long strips over many cells, a few square to the cells' lines.
  const rings = Array.from({ length: 120 }, (_, n) => {
    const [cx, cz, r] = [rnd() * 200 - 100, rnd() * 200 - 100, 1 + rnd() * (n % 7 === 0 ? 60 : 8)];
    const m = 3 + Math.floor(rnd() * 12);
    const ring: Pt[] = Array.from({ length: m }, (_, k) => {
      const a = (k / m) * 2 * Math.PI;
      const d = r * (0.4 + rnd() * 0.6);
      return { x: cx + Math.cos(a) * d * (n % 5 === 0 ? 4 : 1), z: cz + Math.sin(a) * d };
    });
    if (n % 11 === 0) ring.push({ x: Math.round(cx / 10) * 10, z: ring[ring.length - 1]!.z });
    return { ring, box: ringBounds(ring), n };
  });
  const bins = new RingBins(rings);
  const points: Pt[] = [
    ...Array.from({ length: 20000 }, () => ({ x: rnd() * 260 - 130, z: rnd() * 260 - 130 })),
    // On the cells' lines and the rings' own vertices, where the rounding of a cell would tell.
    ...Array.from({ length: 2000 }, () => ({ x: Math.round(rnd() * 26 - 13) * 10, z: rnd() * 260 - 130 })),
    ...Array.from({ length: 2000 }, () => ({ x: rnd() * 260 - 130, z: Math.round(rnd() * 26 - 13) * 10 })),
    ...rings.flatMap((r) => r.ring),
  ];

  it("finds the rings holding a point as pointInRing does, in their order", () => {
    for (const p of points) {
      const want = rings.filter((r) => p.x >= r.box.minX && p.x <= r.box.maxX && p.z >= r.box.minZ && p.z <= r.box.maxZ && pointInRing(p, r.ring)).map((r) => r.n);
      const got: number[] = [];
      bins.scan(p.x, p.z, (r) => (got.push(r.n), false));
      expect(got, `${p.x},${p.z}`).toEqual(want);
      expect(bins.holds(p.x, p.z)).toBe(want.length > 0);
    }
  });

  it("stops where the visitor says so", () => {
    const p = rings[0]!.ring[0]!;
    let calls = 0;
    const centre = { x: (rings[0]!.box.minX + rings[0]!.box.maxX) / 2, z: (rings[0]!.box.minZ + rings[0]!.box.maxZ) / 2 };
    expect(bins.scan(centre.x, centre.z, () => (calls++, true))).toBe(bins.holds(centre.x, centre.z));
    expect(calls).toBeLessThanOrEqual(1);
    expect(bins.scan(p.x - 1e6, p.z, () => true)).toBe(false);
  });
});
