import { describe, expect, it } from "vitest";
import { levelExitsInGame, undergroundLevelExits } from "./level-exit-checks";

const room = { minX: 0, maxX: 10, minZ: 0, maxZ: 10, bottom: -6, top: -3 };
const node = (id: string, x: number, y: number, z: number) => ({ id, at: { x, y, z } });

describe("underground-level-exit (ADR-0074 stage 4)", () => {
  it("finds an interior under the ground with fewer than two ways out in the level graph", () => {
    const nodes = [node("in", 5, -6, 5), node("in2", 8, -6, 8), node("up", 5, 0, -3), node("side", 12, 0, 5)];
    const one = { interiors: [{ id: "room", rooms: [room], extra: 0 }], nodes, edges: [{ a: "in", b: "in2" }, { a: "in", b: "up" }] };
    expect(undergroundLevelExits(one)).toEqual([{ at: "5,5", what: "room: 1 way(s) out" }]);
    expect(undergroundLevelExits({ ...one, edges: [...one.edges, { a: "in2", b: "side" }] })).toEqual([]);
    // A metro platform's train is its second way.
    expect(undergroundLevelExits({ ...one, interiors: [{ id: "room", rooms: [room], extra: 1 }] })).toEqual([]);
  });

  it("finds none in the game: P-1 under Alchemia's car park has its ramp, its stair core and the hall's door, a metro platform its flight and its train", () => {
    const k = levelExitsInGame();
    expect(k.interiors.map((i) => i.id)).toContain("alchemia-parking");
    expect(k.interiors.map((i) => i.id)).toContain("metro-kanal");
    expect(undergroundLevelExits(k)).toEqual([]);
  });
});
