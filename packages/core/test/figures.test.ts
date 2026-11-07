import { describe, expect, it } from "vitest";
import { FIGURE_BODIES, FIGURE_LOOKS, FIGURE_POSES, FIGURE_SEATS, figureFootprint, figureLayout, figureVariant, isSitting } from "../src";

describe("the variant of a still figure (ADR-0058 stage 8)", () => {
  it("keeps the pose, the build, the seat to the centimetre and the look, in 16 bits", () => {
    for (const pose of FIGURE_POSES) {
      for (const body of FIGURE_BODIES) {
        for (const [seat, look] of [
          [0, 0],
          [0.45, 7],
          [0.52, 31],
          [1.27, 16],
        ] as const) {
          const v = figureVariant({ pose, body, seat, look });
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThan(1 << 16);
          expect(figureLayout(v)).toEqual({ pose, body, seat, look });
        }
      }
    }
  });

  it("clamps a seat past what the variant holds and wraps the look", () => {
    expect(figureLayout(figureVariant({ pose: "sit", body: "b", seat: 2, look: FIGURE_LOOKS + 3 }))).toEqual({ pose: "sit", body: "b", seat: 1.27, look: 3 });
    expect(figureLayout(figureVariant({ pose: "stand", body: "a", seat: -1, look: -1 })).seat).toBe(0);
  });

  it("gives a sitter its hips and its feet in front of them, a standing figure its feet", () => {
    for (const pose of FIGURE_POSES) {
      const f = figureFootprint({ pose, body: "a", seat: 0, look: 0 });
      expect(f.length).toBe(isSitting(pose) ? 2 : 1);
      if (isSitting(pose)) expect(f[1]!.z).toBeGreaterThan(f[0]!.z);
    }
  });

  it("seats people on the tops of the furniture, facing its front or the table", () => {
    for (const [kind, seats] of Object.entries(FIGURE_SEATS)) {
      for (const shape of [0, 1, 2]) {
        for (const s of seats!(shape)) {
          expect(s.top - s.floor, kind).toBeGreaterThan(0.3);
          expect(s.top, kind).toBeLessThan(0.6);
        }
      }
    }
  });
});
