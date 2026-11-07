import { describe, expect, it } from "vitest";
import type { Pad } from "../../../packages/sim/src/content/lublin/shape";
import { ORTHO_PIERS, arcadeRhythm, dipInGame, gamePiers, padDipUncovered } from "./arkady-checks";

const pier = (m: number, w = 0.55) => ({ x0: m - w / 2, x1: m + w / 2, y0: -9.5, y1: -6, z0: 0, z1: w });

describe("arcade-rhythm (G-461)", () => {
  it("passes piers on the orthophoto's to 0.3 m, finds one off it, a missing one and a fat one", () => {
    expect(arcadeRhythm(ORTHO_PIERS.map((m, i) => pier(m + (i % 2 ? 0.25 : -0.25))))).toEqual([]);
    const off = arcadeRhythm(ORTHO_PIERS.map((m, i) => pier(i === 3 ? m + 0.5 : m)));
    expect(off.map((f) => f.what)).toEqual(["the orthophoto's pier at 13.60 m has none in the game", "a pier at 14.10 m where the orthophoto has none"]);
    expect(arcadeRhythm(ORTHO_PIERS.slice(1).map((m) => pier(m)))).toHaveLength(1);
    expect(arcadeRhythm(ORTHO_PIERS.map((m, i) => pier(m, i === 0 ? 0.7 : 0.55)))[0]?.what).toBe("the pier at 2.95 m is 0.70 m wide");
  });

  it("finds the 12 even spans of 4.14 m off the orthophoto's 14", () => {
    const even = Array.from({ length: 11 }, (_, k) => pier((k + 1) * 4.144, 0.7));
    expect(arcadeRhythm(even).length).toBeGreaterThan(10);
  });

  it("finds the Arkady's 13 piers where the orthophoto has them", () => {
    expect(gamePiers()).toHaveLength(13);
    expect(arcadeRhythm(gamePiers())).toEqual([]);
  });
});

describe("pad-dip-uncovered (G-460)", () => {
  const point = (x: number, z: number): Pad => ({ rect: { minX: x, maxX: x, minZ: z, maxZ: z }, y: -9, blend: 1, row: "T-217" });
  const band: Pad = { rect: { minX: 0, maxX: 10, minZ: 0, maxZ: 4 }, y: -9, blend: 4, row: "T-217" };
  /** The ground 1 m under the map's within 2 m of (20; 2), level elsewhere. */
  const ground = (x: number, z: number) => (Math.hypot(x - 20, z - 2) < 2 ? -1 : 0);

  it("finds a dip by a grid point's pad in sight, not under a cover nor in a band's cut", () => {
    const base = { raw: () => 0, ground, covered: () => false };
    expect(padDipUncovered({ ...base, pads: [point(20, 2)] }).length).toBeGreaterThan(10);
    expect(padDipUncovered({ ...base, pads: [point(20, 2)], covered: (x) => x > 17 })).toEqual([]);
    expect(padDipUncovered({ ...base, pads: [point(20, 2), { ...band, rect: { ...band.rect, maxX: 20 } }] })).toEqual([]);
    expect(padDipUncovered({ ...base, pads: [band] })).toEqual([]);
  });

  it("finds no dip of T2's pads left in sight round the Arkady", () => {
    expect(padDipUncovered(dipInGame())).toEqual([]);
  });
});
