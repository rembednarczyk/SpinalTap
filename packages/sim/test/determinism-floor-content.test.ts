import { describe, expect, it, vi } from "vitest";
import * as current from "../src";
import type { LublinChunkData, LublinPropTable } from "../src/content/lublin/types";
import * as currentFloor from "./fixtures/determinism-floor";

/**
 * The floor's golden hash depends on the rules and the floor alone (decision of 16.11): the same
 * run with Lublin's content changed under it ends in the same state. Each table of the map
 * (`tools/osm-import`, ADR-0083) is swapped for a changed copy: the terrain 3 m higher, every
 * building 2 m taller, the street furniture without its benches. The city's ground does change
 * with it, the floor does not. The changed modules are loaded once beside the file's own and
 * dropped after (`vi.resetModules`), so no other file of the worker sees them. They load while
 * the file is collected, as every file of the package loads the city it imports: the test itself
 * only plays the floor once more.
 */

type Sim = typeof current;
type Floor = typeof currentFloor;

const CHUNK_TABLES = [
  ["../src/content/lublin/krakowskie.generated", "KRAKOWSKIE_CHUNKS"],
  ["../src/content/lublin/stare-miasto.generated", "STARE_MIASTO_CHUNKS"],
  ["../src/content/lublin/podzamcze.generated", "PODZAMCZE_CHUNKS"],
  ["../src/content/lublin/nabrzeze.generated", "NABRZEZE_CHUNKS"],
] as const;
const PROP_TABLE = "../src/content/lublin/props.generated";

const changedChunk = (c: LublinChunkData): LublinChunkData => ({
  ...c,
  terrain: { ...c.terrain, heights: c.terrain.heights.map((h) => h + 3) },
  buildings: c.buildings.map((b) => ({ ...b, height: b.height + 2 })),
});

const changedProps = (t: LublinPropTable): LublinPropTable =>
  Object.fromEntries(Object.entries(t).map(([chunk, kinds]) => [chunk, Object.fromEntries(Object.entries(kinds).filter(([kind]) => kind !== "bench"))]));

/** The floor's run and the city's first ground height, from the given copy of the modules. */
const measure = (sim: Sim, floor: Floor) => ({
  floor: sim.stateHash(floor.floorRun(1234).snapshot(null, "test", "")),
  firstHeight: sim.WORLD_CHUNKS.find((c) => c.terrain)?.terrain?.heights[0] ?? Number.NaN,
});

/** The modules again, with Lublin's tables changed; the mocks and the copies are gone after. */
const withChangedCity = async (): Promise<ReturnType<typeof measure>> => {
  vi.resetModules();
  for (const [path, name] of CHUNK_TABLES) {
    vi.doMock(path, async (importOriginal) => {
      const m = await importOriginal<Record<string, readonly LublinChunkData[]>>();
      return { ...m, [name]: (m[name] ?? []).map(changedChunk) };
    });
  }
  vi.doMock(PROP_TABLE, async (importOriginal) => {
    const m = await importOriginal<{ LUBLIN_PROP_TABLE: LublinPropTable }>();
    return { ...m, LUBLIN_PROP_TABLE: changedProps(m.LUBLIN_PROP_TABLE) };
  });
  try {
    return measure(await import("../src"), await import("./fixtures/determinism-floor"));
  } finally {
    for (const [path] of CHUNK_TABLES) vi.doUnmock(path);
    vi.doUnmock(PROP_TABLE);
    vi.resetModules();
  }
};

const after = await withChangedCity();

describe("the floor's determinism without the city", () => {
  it("ends in the same state with Lublin's tables changed, while the city's ground moves", () => {
    const before = measure(current, currentFloor);
    // The swap took: the city's ground is 3 m higher.
    expect(after.firstHeight).toBeCloseTo(before.firstHeight + 3, 6);
    // The floor stands.
    expect(after.floor).toBe(before.floor);
  });
});
