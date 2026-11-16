import { describe, expect, it } from "vitest";
import { type Pt } from "../src/geometry.ts";
import { generatedAround } from "./city.ts";

/**
 * The zebras of the curator's review of G-836 (round 2), on the city's data: a junction's crossing
 * along the foot path the map draws through it, across the street it crosses square, and from
 * kerb to kerb of the game's asphalt (a road area's mouth too).
 */
const zebraNear = (x: number, z: number): { len: number; axis: Pt; mid: Pt } => {
  const rings = generatedAround([{ x, z }])
    .chunks.flatMap((c) => c.ground)
    .filter((g) => g.surface === "crossing")
    .map((g) => Array.from({ length: g.outline.length / 2 }, (_, i) => ({ x: g.outline[2 * i]!, z: g.outline[2 * i + 1]! })));
  const mid = (r: readonly Pt[]) => ({ x: r.reduce((s, p) => s + p.x, 0) / r.length, z: r.reduce((s, p) => s + p.z, 0) / r.length });
  const ring = rings.sort((a, b) => Math.hypot(mid(a).x - x, mid(a).z - z) - Math.hypot(mid(b).x - x, mid(b).z - z))[0]!;
  // The longest side of the piece: its axis across the street.
  let best = { len: 0, axis: { x: 0, z: 0 } };
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length]!;
    const len = Math.hypot(q.x - p.x, q.z - p.z);
    if (len > best.len) best = { len, axis: { x: (q.x - p.x) / len, z: (q.z - p.z) / len } };
  });
  return { ...best, mid: mid(ring) };
};
const degrees = (a: Pt, b: Pt) => (Math.acos(Math.min(1, Math.abs(a.x * b.x + a.z * b.z))) * 180) / Math.PI;

describe("the zebras of a junction and a road area's mouth (G-836, round 2)", () => {
  it("lays n4087364975's along the footway w406693442 through it, across Kalinowszczyzna", () => {
    const z = zebraNear(2361, 432);
    // w406693442 runs north to south there (OSM): (-0.066, -0.998).
    expect(degrees(z.axis, { x: -0.066, z: -0.998 })).toBeLessThan(10);
    expect(z.len).toBeGreaterThan(5.5);
  });

  it("reaches w1054556913's across the mouth of Cerkiewna's road area to its kerbs", () => {
    const z = zebraNear(929, 467);
    // The game's asphalt on its axis: from 9.5 m west to 14 m east of the way's crossing of Cerkiewna.
    expect(z.len).toBeGreaterThan(20);
  });

  it("lays n4586176953's west to east across Cerkiewna's northern branch w739432830, along the path w1435832526", () => {
    const z = zebraNear(914, 346);
    // w1435832526 runs west to east through the node (OSM): (-0.992, 0.123).
    expect(degrees(z.axis, { x: -0.992, z: 0.123 })).toBeLessThan(10);
    expect(z.len).toBeGreaterThan(9);
    expect(z.len).toBeLessThan(13);
  });
});
