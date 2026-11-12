import { describe, expect, it } from "vitest";
import type { Line } from "../../osm-import/src/features.ts";
import { type StripWorld, kerbStripBare } from "./kerb-strip-bare";

/**
 * The glitch scan's check `kerb-strip-bare` (G-655) on a street 30 m long along x: 6 m by its
 * tags, a footway 2.5 m off its axis on its left (+z), and the game's ground as bands across z.
 */
const line = (id: string, tags: Record<string, string>, z: number): Line => ({ id, osmId: 0, tags, line: [{ x: 0, z }, { x: 30, z }] });
const STREET = line("w1", { highway: "residential", sidewalk: "separate" }, 0);
const FOOTWAY = line("w2", { highway: "footway" }, 2.5);

/** A world whose ground at z is `bands`' surface ([from z, to z, surface]), nothing elsewhere. */
const world = (bands: readonly (readonly [number, number, string])[], lines: readonly Line[] = [STREET, FOOTWAY]): StripWorld => ({
  lines,
  carriageways: new Set(["residential"]),
  roadWidth: () => 6,
  surfacesAt: (_x, z) => bands.filter(([a, b]) => z >= a && z < b).map(([, , s]) => s),
  inBuilding: () => false,
  deep: () => true,
});

describe("bare ground past the kerb of a fitted street (kerb-strip-bare)", () => {
  it("finds every metre of either edge with a metre and more of bare ground before the paving or lawn past it", () => {
    // Asphalt 2 m each side, then bare: 1.2 m to the footway north, 0.5 m to a lawn south.
    const found = kerbStripBare(world([[-2, 2, "road"], [3.2, 5, "footway"], [-4, -2.5, "grass"]]));
    expect(found).toHaveLength(30);
    expect(found[0]!.what).toBe("w1: 1.2 m bare past the kerb");
    // Both sides bare 1.5 m: both count.
    expect(kerbStripBare(world([[-2, 2, "road"], [3.5, 5, "footway"], [-5, -3.5, "grass"]]))).toHaveLength(60);
  });

  it("finds none where the paving meets the asphalt, the bare reaches past 5 m or ends at a road", () => {
    expect(kerbStripBare(world([[-2, 2, "road"], [2, 5, "footway"], [-4, -2, "grass"]]))).toEqual([]);
    expect(kerbStripBare(world([[-2, 2, "road"], [7.5, 9, "footway"]]))).toEqual([]);
    expect(kerbStripBare(world([[-2, 2, "road"], [3.5, 5, "road"]]))).toEqual([]);
  });

  it("looks only at streets of estimated width with a footway the import fits them to", () => {
    const bands = [[-2, 2, "road"], [3.5, 5, "footway"]] as const;
    // A width from the map; a plain footway on a side not tagged separate; none at all.
    expect(kerbStripBare(world(bands, [line("w1", { highway: "residential", sidewalk: "separate", width: "4" }, 0), FOOTWAY]))).toEqual([]);
    expect(kerbStripBare(world(bands, [line("w1", { highway: "residential" }, 0), FOOTWAY]))).toEqual([]);
    expect(kerbStripBare(world(bands, [STREET]))).toEqual([]);
    // A mapped sidewalk counts on any side.
    expect(kerbStripBare(world(bands, [line("w1", { highway: "residential" }, 0), line("w2", { highway: "footway", footway: "sidewalk" }, 2.5)]))).toHaveLength(30);
  });
});
