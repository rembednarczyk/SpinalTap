import { describe, expect, it } from "vitest";
import { deckSteps } from "./deck-step";

/** The glitch scan's check `deck-step-face` (G-340, G-344) on two pieces side by side along x, sharing the edge z = 4. */

type Piece = { readonly ring: readonly { x: number; z: number }[]; readonly y: number };
const road = (y: number): Piece => ({ ring: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 4 }, { x: 0, z: 4 }], y });
const walk = (y: number): Piece => ({ ring: [{ x: 0, z: 4 }, { x: 10, z: 4 }, { x: 10, z: 7 }, { x: 0, z: 7 }], y });
const scan = (pieces: Piece[], skip?: (p: { x: number; z: number }) => boolean) =>
  deckSteps(
    pieces,
    (p) => p.y,
    (x, z) => {
      const on = pieces.filter((p) => x >= p.ring[0]!.x && x <= p.ring[2]!.x && z >= p.ring[0]!.z && z <= p.ring[2]!.z);
      return on.length === 0 ? null : Math.max(...on.map((p) => p.y));
    },
    skip,
  );

describe("steps between a bridge's pieces (G-340, G-344)", () => {
  it("finds the edge of a piece over another more than 0.3 m lower, every 0.5 m, a point once", () => {
    const found = scan([road(0), walk(1)]);
    // The sidewalk's south edge from x 0 to 10: 20 pieces between the world's 0.5 m grid lines, each sampled at its middle.
    expect(found).toHaveLength(20);
    expect(found[0]).toEqual({ at: "0.3,4.0", what: "deck 1.00 over a deck at 0.00 0.3 m beyond" });
    expect(found[19]!.at).toBe("9.8,4.0");
  });

  it("finds nothing at a kerb, off the bridge's edges or skipped", () => {
    expect(scan([road(0), walk(0.25)])).toEqual([]);
    expect(scan([road(0.25), walk(0)])).toEqual([]);
    expect(scan([road(0)])).toEqual([]);
    expect(scan([road(0), walk(1)], (p) => p.x < 20)).toEqual([]);
  });
});
