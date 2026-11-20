import { describe, expect, it } from "vitest";
import { ENTRANCE_ROOM, EntranceZones, KEEPS_OFF_ENTRANCES, boardDoor } from "../src/props-entrances.ts";

/*
 * The clear zones before the doors (ADR-0094 stage 1): a café's garden, a board, a bench keep
 * `ENTRANCE_ROOM` and their own reach off every door; a lamp at the kerb or a post in a row does
 * not keep off them (it stands where the street needs it).
 */
describe("the doors' clear zones (ADR-0094 stage 1)", () => {
  const zones = new EntranceZones([{ x: 0, z: 0 }]);

  it("keeps a café's garden off a door by the room and its own reach", () => {
    const r = ENTRANCE_ROOM + KEEPS_OFF_ENTRANCES["cafe-garden"]!;
    expect(zones.clear({ x: r - 0.05, z: 0 }, "cafe-garden")).toBe(false);
    expect(zones.clear({ x: r + 0.05, z: 0 }, "cafe-garden")).toBe(true);
  });

  it("lets a small board stand nearer than a garden, but not in the door", () => {
    expect(zones.clear({ x: 2.8, z: 0 }, "a-frame-sign")).toBe(true);
    expect(zones.clear({ x: 2.8, z: 0 }, "cafe-garden")).toBe(false);
    expect(zones.clear({ x: 1, z: 0 }, "a-frame-sign")).toBe(false);
  });

  it("does not move what stands where the street needs it (lamps, bollards, covers)", () => {
    for (const prop of ["lamp-pastoral", "bollard", "manhole", "tree"] as const) expect(zones.clear({ x: 0.5, z: 0 }, prop)).toBe(true);
  });

  it("finds a venue's door in the middle of its board", () => {
    const b = { a: { x: 2, z: 5 }, b: { x: 6, z: 5 }, nx: 0, nz: -1, bottom: 3, top: 3.6, wallA: { x: 0, z: 5 }, wallB: { x: 10, z: 5 }, text: "KAWA" };
    expect(boardDoor(b)).toEqual({ x: 4, z: 5 });
  });
});
