import { describe, expect, it } from "vitest";
import { type KeptInputs, keptInGame, osmBuildingsKept } from "./alchemia-checks";

/** A 10 × 4 m building at (5; 2), and the game's solid rebuilt on it. */
const OUTLINE = [-5, -2, 5, -2, 5, 2, -5, 2];
const RING = [
  { x: 0, z: 0 },
  { x: 10, z: 0 },
  { x: 10, z: 4 },
  { x: 0, z: 4 },
];
const inputs = (over: Partial<KeptInputs["rebuilt"]> = {}, drawn = true): KeptInputs => ({
  kept: ["w1", "w2"],
  buildings: [
    { id: "w1", x: 5, z: 2, outline: OUTLINE },
    { id: "w2", x: 50, z: 2, outline: OUTLINE },
  ],
  drawn: (id) => drawn && id !== "w1",
  rebuilt: { id: "w1", outline: RING, corners: [...RING, { x: 0, z: 1 }, { x: 4, z: 4 }], floor: -9, top: -2, placed: true, ...over },
});

describe("osm-building-kept (ADR-0074 §11)", () => {
  it("passes a kept building drawn by the map and one rebuilt on its outline two storeys high", () => {
    expect(osmBuildingsKept(inputs())).toEqual([]);
  });

  it("finds a kept building without a solid, one rebuilt off its outline, short of it or past it, and one too low", () => {
    expect(osmBuildingsKept(inputs({}, false)).map((f) => f.what)).toEqual(["w2 has no solid of its own"]);
    expect(osmBuildingsKept(inputs({ outline: RING.map((p) => ({ ...p, x: p.x + 0.5 })) }))[0]?.what).toMatch(/off its OSM outline/);
    expect(osmBuildingsKept(inputs({ corners: RING.slice(0, 3) }))[0]?.what).toMatch(/fall short of/);
    expect(osmBuildingsKept(inputs({ corners: [...RING, { x: 12, z: 2 }] }))[0]?.what).toMatch(/reach past/);
    expect(osmBuildingsKept(inputs({ top: -4 }))[0]?.what).toMatch(/under two storeys/);
    expect(osmBuildingsKept({ ...inputs(), kept: ["w9"] })[0]?.what).toBe("w9 not in the map");
    expect(osmBuildingsKept(inputs({ placed: false }))[0]?.what).toBe("w1 rebuilt but not in the world");
    expect(osmBuildingsKept({ ...inputs(), drawn: () => true })[0]?.what).toBe("w1 drawn twice: the map's and the rebuilt");
  });

  it("finds the Arkady rebuilt on their OSM outline on two storeys and the shed by them kept", () => {
    expect(osmBuildingsKept(keptInGame())).toEqual([]);
  });
});
