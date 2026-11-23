import { describe, expect, it } from "vitest";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { RUIN_STANDING } from "../src/barriers.ts";

/**
 * The ruins mapped as buildings (`building=ruins`, G-053), once left out of the import: their
 * standing walls round the outline, walls of the map's barriers, as high as GUGiK's LoD1 block
 * over them (w1330433247: 3.3 m), else `RUIN_STANDING`; open inside, no building of the chunk.
 */
const CHUNKS = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];
const RUINS = ["w232362881", "w1330433247", "w813194693", "w67498742"];

describe("ruins mapped as buildings (G-053)", () => {
  it("stand as walls round their outlines, none of them a building", () => {
    const walls = CHUNKS.flatMap((c) => (c.barriers ?? []).filter((b) => RUINS.includes(b.id)));
    expect([...new Set(walls.map((w) => w.id))].sort()).toEqual([...RUINS].sort());
    for (const w of walls) {
      expect(w.kind).toBe("wall");
      expect(w.height, w.id).toBeGreaterThanOrEqual(RUIN_STANDING);
      expect(w.height, w.id).toBeLessThanOrEqual(4);
    }
    expect(walls.find((w) => w.id === "w1330433247")!.height).toBe(3.3);
    const buildings = new Set(CHUNKS.flatMap((c) => c.buildings.map((b) => b.id)));
    for (const id of RUINS) expect(buildings.has(id), id).toBe(false);
  });
});
