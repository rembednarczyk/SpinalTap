import { describe, expect, it } from "vitest";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { COVER } from "../../orto/src/classify.ts";
import { type Cover, readCover } from "../../orto/src/cover.ts";
import { MAP_REGIONS } from "../../orto/src/region.ts";
import { THRESHOLDS } from "../../orto/src/thresholds.ts";
import { reviewedOnly } from "./reviewed-cells";
import { type WalkLawnChunk, walkLawnBare } from "./walk-lawn-bare";

/**
 * G-902: bare paving in a strip between a pavement and a lawn (`walk-lawn-bare.ts`). Before the
 * import laid such a strip's paving (`lawnStrips`) the tables held 14 760 samples of it (17.11.2026,
 * 3 690 m² in 556 squares of 10 m); the rule, laying only the regions that close their strip, leaves
 * 14 565. Too many places to take into the scan's base at once: the count may only come down.
 */
const MAX_LEFT = 14_600;

const flat = (minX: number, minZ: number, maxX: number, maxZ: number): number[] => [minX, minZ, maxX, minZ, maxX, maxZ, minX, maxZ];

describe("bare paving between a pavement and a lawn (walk-lawn-bare, G-902)", () => {
  // A 20 m chunk: a pavement south of z = 8, a lawn north of z = 11, paving on the cover everywhere.
  const cls = new Uint8Array(40 * 40).fill(COVER.paving);
  const cover: Cover = { header: { district: "t", x0: 0, z1: 20, step: 0.5, width: 40, height: 40, classes: [], source: "", tiles: [], thresholds: THRESHOLDS }, cls };
  const chunk = (ground: WalkLawnChunk["ground"], buildings: WalkLawnChunk["buildings"] = []): WalkLawnChunk => ({ id: "t", bounds: { minX: 0, maxX: 20, minZ: 0, maxZ: 20 }, ground, buildings });
  const pavement = { surface: "sidewalk", outline: flat(0, 0, 20, 8) };
  const lawn = { surface: "grass", outline: flat(0, 11, 20, 20) };

  it("names the bare samples of a strip up to 5 m across, and none between a pavement and a wall or with the strip laid", () => {
    expect(walkLawnBare([chunk([pavement, lawn])], [cover])).toHaveLength(6 * 40);
    expect(walkLawnBare([chunk([pavement])], [cover])).toEqual([]);
    expect(walkLawnBare([chunk([pavement], [{ x: 0, z: 0, outline: flat(0, 11, 20, 20) }])], [cover])).toEqual([]);
    expect(walkLawnBare([chunk([pavement, lawn, { surface: "square", outline: flat(0, 8, 20, 11) }])], [cover])).toEqual([]);
    // A strip 6 m across is wider than the band.
    expect(walkLawnBare([chunk([pavement, { surface: "grass", outline: flat(0, 14, 20, 20) }])], [cover])).toEqual([]);
  });

  it("names none where the cover shows other than light paving", () => {
    const green: Cover = { ...cover, cls: new Uint8Array(40 * 40).fill(COVER.green) };
    expect(walkLawnBare([chunk([pavement, lawn])], [green])).toEqual([]);
  });

  it(`leaves under ${MAX_LEFT} of them in the city`, () => {
    const covers = MAP_REGIONS.map((r) => readCover(r.slug)).filter((c) => c !== undefined);
    expect(walkLawnBare(reviewedOnly(MAP_CHUNKS), covers).length).toBeLessThan(MAX_LEFT);
  });
});
