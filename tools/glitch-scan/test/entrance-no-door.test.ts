import { describe, expect, it } from "vitest";
import type { StreetPropItem } from "../../../packages/core/src";
import { entrancesWithoutDoor } from "./entrance-no-door";

const wall = { a: { x: 0, z: 0 }, b: { x: 10, z: 0 } };
const door = (x: number, z: number) => ({ prop: "door", x, y: 0, z, yaw: 0, variant: 0 }) as unknown as StreetPropItem;

describe("entrances without a door (G-781)", () => {
  it("finds an entrance by a drawn wall with no door within 2 m", () => {
    expect(entrancesWithoutDoor([{ id: "n1", p: { x: 5, z: 0.5 } }], [wall], [door(8, 0)], 1.5)).toEqual([{ at: "5.0,0.5", what: "entrance n1 on a drawn wall, no door within 2 m" }]);
  });

  it("finds none with its door near, or off every wall", () => {
    expect(entrancesWithoutDoor([{ id: "n1", p: { x: 5, z: 0.5 } }], [wall], [door(5.8, 0)], 1.5)).toEqual([]);
    expect(entrancesWithoutDoor([{ id: "n2", p: { x: 5, z: 3 } }], [wall], [], 1.5)).toEqual([]);
  });
});
