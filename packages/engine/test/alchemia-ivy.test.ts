import { describe, expect, it } from "vitest";
import { ALCHEMIA_TIER_PIECES } from "@seki/sim";
import { GeometrySink } from "../src/renderer/city-kit-data";
import { IVY_STRAND_EVERY, ivyCurtain } from "../src/renderer/alchemia/ivy-curtain";

/** The curtains of green over the storeys' edges (`front-green.ts`): thin prisms of four corners. */
const curtains = ALCHEMIA_TIER_PIECES.filter((p) => p.kind === "green" && p.outline?.length === 4);
const UV = [0.5, 0.5] as const;

const draw = (p: (typeof curtains)[number]): GeometrySink => {
  const sink = new GeometrySink();
  ivyCurtain(sink, UV, p.outline!, p.box.y0, p.box.y1);
  return sink;
};

/** The quads' normals, rounded: a box has five or six, ivy one per leaf near enough. */
const facings = (s: GeometrySink): number => {
  const seen = new Set<string>();
  for (let v = 0; v < s.vertexCount; v += 4) seen.add([0, 1, 2].map((k) => s.normals[v * 3 + k]!.toFixed(1)).join(","));
  return seen.size;
};

describe("ivy over Alchemia's slab edges (20.11)", () => {
  it("draws every curtain as strands of leaves, many facings, no box", () => {
    expect(curtains.length).toBeGreaterThan(100);
    for (const p of curtains) {
      const s = draw(p);
      const w = Math.hypot(p.outline![2]!.x - p.outline![3]!.x, p.outline![2]!.z - p.outline![3]!.z);
      // Some 13 leaves a strand per metre of drop, a strand every 15 cm: far more quads than a prism's six.
      expect(s.vertexCount / 4).toBeGreaterThan(Math.max(2, Math.round(w / IVY_STRAND_EVERY)) * 3);
      expect(facings(s)).toBeGreaterThan(8);
    }
  });

  it("hangs within its curtain's place: from a hand over the slab down to its bottom, a hand out of the edge at most", () => {
    for (const p of curtains) {
      const s = draw(p);
      const b = p.box;
      let low = Infinity;
      for (let v = 0; v < s.vertexCount; v++) {
        const [x, y, z] = [s.positions[v * 3]!, s.positions[v * 3 + 1]!, s.positions[v * 3 + 2]!];
        low = Math.min(low, y);
        expect(y).toBeLessThanOrEqual(b.y1 + 0.1);
        expect(y).toBeGreaterThanOrEqual(b.y0 - 0.15);
        expect(x).toBeGreaterThan(b.x0 - 0.35);
        expect(x).toBeLessThan(b.x1 + 0.35);
        expect(z).toBeGreaterThan(b.z0 - 0.35);
        expect(z).toBeLessThan(b.z1 + 0.35);
      }
      // Its longest strands reach the curtain's bottom: the board's green hangs, it does not stop at the slab.
      expect(low).toBeLessThan(b.y0 + 0.25);
    }
  });

  it("is the same every time (a hash of the place, no randomness)", () => {
    const p = curtains[7]!;
    expect(draw(p).positions).toEqual(draw(p).positions);
  });
});
