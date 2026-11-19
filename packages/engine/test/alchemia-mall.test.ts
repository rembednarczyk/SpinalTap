import { describe, expect, it } from "vitest";
import { ALCHEMIA_PIECES, ATRIUM, ESCALATORS, MALL, MALL_LEVELS, escalatorHead, mallGlass } from "@seki/sim";
import { GeometrySink, parseCityKit, swatchUv } from "../src/renderer/city-kit-data";
import { alchemiaGeometry } from "../src/renderer/alchemia/alchemia-geometry";
import { escalatorGeometry } from "../src/renderer/alchemia/escalator-geometry";
import { paneFrame } from "../src/renderer/alchemia/storey-facade";
// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";

/**
 * The gallery round the atrium in the drawing (ADR-0093 O1): its glass a frame the eye looks through
 * into the real gallery, its slabs' light only along the facade and round the atrium, its galleries,
 * escalators and cores near only (the inside's mesh), within the budget of a mesh.
 */
describe("Alchemia's gallery in the drawing (ADR-0093 O1)", () => {
  const bytes = (readFileSync as (url: URL) => Uint8Array)(new URL("../../app/public/city/city-kit.glb", import.meta.url));
  const data = parseCityKit(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  /** Area of the triangles of a sink. */
  const area = (s: GeometrySink): number => {
    let sum = 0;
    for (let i = 0; i < s.indices.length; i += 3) {
      const [a, b, c] = [s.indices[i]!, s.indices[i + 1]!, s.indices[i + 2]!].map((k) => [s.positions[3 * k]!, s.positions[3 * k + 1]!, s.positions[3 * k + 2]!]) as [number[], number[], number[]];
      const [u, v] = [a.map((x, j) => b[j]! - x), a.map((x, j) => c[j]! - x)];
      sum += Math.hypot(u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!) / 2;
    }
    return sum;
  };

  it("draws the gallery's glass as a frame only: sill, head and mullions, no pane", () => {
    const panes = mallGlass().filter((p) => p.kind === "pane" && p.box.y1 - p.box.y0 > 3 && Math.max(p.box.x1 - p.box.x0, p.box.z1 - p.box.z0) > 2.5);
    expect(panes.length).toBeGreaterThan(10);
    for (const p of panes) {
      const s = new GeometrySink();
      paneFrame(s, data, p.outline!, p.box.y0, p.box.y1);
      const [a, b] = [p.outline![0]!, p.outline![1]!];
      const face = Math.hypot(b.x - a.x, b.z - a.z) * (p.box.y1 - p.box.y0);
      // Both faces of a frame of boxes a hand deep: far less than the pane's own face would be.
      expect(s.indices.length).toBeGreaterThan(0);
      expect(area(s) / 2).toBeLessThan(0.45 * face);
    }
  });

  it("lights the slabs' edges along the facade and round the atrium only, not on their joints", () => {
    const { tiers } = alchemiaGeometry(data, ALCHEMIA_PIECES.filter((p) => p.kind === "roof" && p.outline && p.box.z0 >= MALL.z0 - 0.01 && p.box.x0 >= MALL.x0 - 0.31));
    const led = swatchUv(data, "neon-cyan");
    const lit: [number, number][] = [];
    for (let k = 0; k < tiers.uvs.length / 2; k++) {
      const [x, z] = [tiers.positions[3 * k]!, tiers.positions[3 * k + 2]!];
      // The gallery's (the front's sign letters are neon too).
      if (tiers.uvs[2 * k] === led[0] && tiers.uvs[2 * k + 1] === led[1] && z > MALL.z0 - 0.1 && x > MALL.x0 - 0.5 && x < MALL.x1 + 0.5) lit.push([x, z]);
    }
    expect(lit.length).toBeGreaterThan(100);
    for (const [x, z] of lit) {
      const facade = x < MALL.x0 + 0.01 || x > MALL.x1 - 0.01 || z > MALL.z1 - 0.01;
      const atrium = x > ATRIUM.x0 - 0.1 && x < ATRIUM.x1 + 0.1 && z > ATRIUM.z0 - 0.1 && z < ATRIUM.z1 + 0.1;
      expect(facade || atrium, `${x.toFixed(2)},${z.toFixed(2)}`).toBe(true);
    }
  });

  it("draws the escalators' balustrades sloping with their flights, the galleries, escalators and cores in the inside's mesh", () => {
    const s = new GeometrySink();
    escalatorGeometry(s, data);
    for (const e of ESCALATORS) {
      // At the foot the balustrade's top is a metre over its floor, at the head a metre over the floor it reaches.
      const topAt = (x: number) => {
        let y = -Infinity;
        for (let k = 0; k < s.positions.length / 3; k++) {
          if (Math.abs(s.positions[3 * k]! - x) < 1e-6 && s.positions[3 * k + 2]! > e.lane.z0 - 0.2 && s.positions[3 * k + 2]! < e.lane.z1 + 0.2) y = Math.max(y, s.positions[3 * k + 1]!);
        }
        return y;
      };
      for (const [x, floor] of [
        [e.x0, e.from],
        [escalatorHead(e), e.to],
      ] as const) {
        expect(topAt(x), `${x}`).toBeGreaterThan(floor + 0.8);
        expect(topAt(x), `${x}`).toBeLessThan(floor + 1.2);
      }
    }
    const { inside, tiers } = alchemiaGeometry(data);
    const over = (sink: GeometrySink, y: number) => {
      let n = 0;
      for (let k = 0; k < sink.positions.length / 3; k++) if (sink.positions[3 * k + 1]! > y && sink.positions[3 * k]! > MALL.x0 && sink.positions[3 * k]! < MALL.x1 && sink.positions[3 * k + 2]! > MALL.z0 && sink.positions[3 * k + 2]! < MALL.z1) n++;
      return n;
    };
    // Up on P2 and P3: the escalators, balustrades and cores, near only.
    expect(over(inside, MALL_LEVELS.p2 + 0.5)).toBeGreaterThan(1000);
    expect(over(tiers, MALL_LEVELS.p2 + 0.5)).toBeGreaterThan(500);
  });
});
