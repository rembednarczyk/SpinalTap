import { describe, expect, it } from "vitest";
import { BREAKLINES, BREAK_FLIGHTS } from "../src/content/lublin/breaklines";
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
