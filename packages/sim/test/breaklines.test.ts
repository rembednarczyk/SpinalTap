import { describe, expect, it } from "vitest";
import { VEHICLE_SIZE, barrierLayout } from "@seki/core";
import { BREAKLINES, BREAK_FLIGHTS, breaklineDistance } from "../src/content/lublin/breaklines";
import { distanceToBarrier } from "../src/content/lublin/barriers";
import { PARKED_CARS } from "../src/content/parked-cars";
import { WORLD_BARRIERS } from "../src";
import { groundY } from "../src/content/lublin/terrain";

/**
 * The terrace of Plac Katedralny over Królewska (T-351, G-968): the NMT steps 1.0-2.8 m within a
 * metre or two under the retaining walls; the game's ground steps there too instead of sloping over
 * 8 m, and the flight between the walls' ends climbs the step.
 */

/** Points along a line every `step` metres, with the unit normal to its left. */
const along = (line: readonly { x: number; z: number }[], step: number) =>
  line.slice(1).flatMap((b, i) => {
    const a = line[i]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = { x: -(b.z - a.z) / len, z: (b.x - a.x) / len };
    return Array.from({ length: Math.floor(len / step) }, (_, k) => ({ x: a.x + ((b.x - a.x) * (k + 0.5) * step) / len, z: a.z + ((b.z - a.z) * (k + 0.5) * step) / len, n }));
  });

describe("the terrace's step under the walls along Królewska (T-351)", () => {
  it("steps within a cell and a half of the wall, each side at its level from 1.5 m out", () => {
    for (const l of BREAKLINES) {
      // Off the lines' ends (where the shaping fades) and off the flight between them.
      const pts = along(l.line, 2).filter((p) => !l.skip?.some((b) => p.x >= b.minX - 2 && p.x <= b.maxX + 2) && Math.hypot(p.x - l.line[0]!.x, p.z - l.line[0]!.z) > 4 && Math.hypot(p.x - l.line[l.line.length - 1]!.x, p.z - l.line[l.line.length - 1]!.z) > 4);
      expect(pts.length, l.id).toBeGreaterThan(3);
      for (const p of pts) {
        const at = (d: number) => groundY(p.x + p.n.x * d, p.z + p.n.z * d);
        // The terrace (left, north) 1.5 m from the wall as high as 4 m from it; the pavement likewise.
        expect(Math.abs(at(1.5) - at(4)), `${l.id} ${p.x.toFixed(1)} upper`).toBeLessThan(0.15);
        expect(Math.abs(at(-1.5) - at(-4)), `${l.id} ${p.x.toFixed(1)} lower`).toBeLessThan(0.25);
        // The NMT's step, 1.0-2.8 m, between the two.
        expect(at(1.5) - at(-1.5), `${l.id} ${p.x.toFixed(1)} step`).toBeGreaterThan(0.9);
      }
    }
  });

  it("steps at the wall itself: no bank before its face, no ditch behind its parapet (G-971)", () => {
    let samples = 0;
    for (const l of BREAKLINES) {
      // Every 0.5 m beside the line, off its fading ends and the flight's box.
      const pts = along(l.line, 0.5).filter((p) => !l.skip?.some((b) => p.x >= b.minX - 1 && p.x <= b.maxX + 1 && p.z >= b.minZ - 1 && p.z <= b.maxZ + 1) && Math.hypot(p.x - l.line[0]!.x, p.z - l.line[0]!.z) > 4 && Math.hypot(p.x - l.line[l.line.length - 1]!.x, p.z - l.line[l.line.length - 1]!.z) > 4);
      for (const p of pts) {
        const at = (d: number) => groundY(p.x + p.n.x * d, p.z + p.n.z * d);
        // At either face (0.25 m from the axis, the wall 0.4 m thick) the ground of its side, as 1.5 m out.
        for (const side of [1, -1]) expect(Math.abs(at(side * 0.25) - at(side * 1.5)), `${l.id} ${p.x.toFixed(1)},${p.z.toFixed(1)} side ${side}`).toBeLessThan(0.15);
        samples++;
      }
    }
    expect(samples).toBeGreaterThan(60);
  });

  it("keeps the wall whole along the terrace's edge, the parked cars clear of it (G-971)", () => {
    const walls = Object.values(WORLD_BARRIERS).flat().filter((i) => barrierLayout(i.variant).kind === "retaining-wall");
    for (const l of BREAKLINES) {
      const pts = along(l.line, 0.5).filter((p) => !l.skip?.some((b) => p.x >= b.minX - 1 && p.x <= b.maxX + 1 && p.z >= b.minZ - 1 && p.z <= b.maxZ + 1) && Math.hypot(p.x - l.line[0]!.x, p.z - l.line[0]!.z) > 4 && Math.hypot(p.x - l.line[l.line.length - 1]!.x, p.z - l.line[l.line.length - 1]!.z) > 4);
      for (const p of pts) expect(walls.some((w) => distanceToBarrier(w, p.x, p.z) < 0.05), `${l.id} ${p.x.toFixed(1)},${p.z.toFixed(1)}`).toBe(true);
    }
    for (const c of PARKED_CARS) expect(breaklineDistance(c.x, c.z), `${c.x},${c.z}`).toBeGreaterThan(VEHICLE_SIZE[c.model].width / 2);
  });

  it("lays the flight between the walls' ends from the pavement to the terrace", () => {
    for (const f of BREAK_FLIGHTS) {
      const rise = groundY(f.top.x, f.top.z) - groundY(f.foot.x, f.foot.z);
      // 15 steps; the NMT climbs about 2.1 m from foot to top (the probe of 25.11).
      expect(rise, f.id).toBeGreaterThan(1.8);
      expect(rise, f.id).toBeLessThan(2.5);
      // An even grade: its middle halfway.
      const mid = groundY((f.foot.x + f.top.x) / 2, (f.foot.z + f.top.z) / 2);
      expect(Math.abs(mid - (groundY(f.foot.x, f.foot.z) + rise / 2)), f.id).toBeLessThan(0.15);
    }
  });
});
