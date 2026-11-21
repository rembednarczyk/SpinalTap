// @ts-expect-error The engine is typed for the browser; the test reads the file off disk.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCityProps } from "../src/renderer/city-props";
import { BLADE_HOUSINGS, bladeHousing } from "../src/renderer/mapcity/blade-housings";

/** The blade signs' housings (ADR-0096 rule 5): the panels the renderer lights lie on the models of the file. */
const bytes = (readFileSync as (url: URL) => Uint8Array)(new URL("../../app/public/city/extra-props.glb", import.meta.url));
const props = parseCityProps(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);

describe("the blade signs' housings (ADR-0096 rule 5)", () => {
  for (const h of BLADE_HOUSINGS) {
    const m = props.byStyle.get(h.kind)?.[0];

    it(`${h.kind}: the file's model has the measured size, its plates on the wall, the light's faces clear of it on its panel`, () => {
      expect(m, h.kind).toBeDefined();
      expect(m!.size.x).toBeCloseTo(h.size.x, 2);
      expect(m!.size.y).toBeCloseTo(h.size.y, 2);
      expect(m!.size.z).toBeCloseTo(h.size.z, 2);
      // Baked centred on its box (`onWall` puts its back on the wall): the plates at -z/2, the panel out from them.
      const pts: { x: number; y: number; z: number }[] = [];
      for (let i = 0; i < m!.positions.length; i += 3) pts.push({ x: m!.positions[i]!, y: m!.positions[i + 1]!, z: m!.positions[i + 2]! + h.size.z / 2 });
      expect(Math.min(...pts.map((p) => p.z))).toBeCloseTo(0, 2);
      // No part of it stands out past the light's faces over the panel (a low-poly box has its vertices at its corners only).
      const over = pts.filter((p) => p.z > h.panel.out0 + 0.02 && p.z < h.panel.out1 - 0.02 && p.y > h.panel.y0 + 0.02 && p.y < h.panel.y1 - 0.02);
      for (const p of over) expect(Math.abs(p.x)).toBeLessThan(h.face);
      // The panel's edges, across the wall and up it, within 6 cm of the measured ones.
      const near = (v: number, list: readonly number[]) => list.some((w) => Math.abs(w - v) < 0.06);
      expect(near(h.panel.out0, pts.map((p) => p.z))).toBe(true);
      expect(near(h.panel.out1, pts.map((p) => p.z))).toBe(true);
      expect(near(h.panel.y0, pts.map((p) => p.y))).toBe(true);
      expect(near(h.panel.y1, pts.map((p) => p.y))).toBe(true);
    });
  }

  it("picks each housing for some seeds, the same for the same seed", () => {
    const kinds = new Set(Array.from({ length: 60 }, (_, k) => bladeHousing(k / 60).kind));
    expect(kinds.size).toBe(BLADE_HOUSINGS.length);
    expect(bladeHousing(0.4242)).toBe(bladeHousing(0.4242));
  });
});
