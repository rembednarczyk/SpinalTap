import { describe, expect, it } from "vitest";
import type { StreetPropItem } from "../../../packages/core/src";
import { osmFurnitureMissing } from "./osm-furniture";

const piece = (prop: string, x: number, z: number) => ({ prop, x, y: 0, z, yaw: 0, variant: 0 }) as unknown as StreetPropItem;
const tree = { id: "n1", p: { x: 100, z: -240 }, tag: "natural=tree", detail: "" };

describe("OSM furniture missing from the game (G-099)", () => {
  it("finds a node of the extract with no piece of its kind within 3 m", () => {
    expect(osmFurnitureMissing([tree], [piece("bench", 100, -240), piece("tree", 104, -240)])).toEqual([{ at: "100.0,-240.0", what: "n1 natural=tree: no tree within 3 m" }]);
  });

  it("finds none with its piece near, off the map, or for kinds of their own rules", () => {
    expect(osmFurnitureMissing([tree], [piece("tree", 101.5, -241)])).toEqual([]);
    expect(osmFurnitureMissing([{ ...tree, p: { x: 100, z: -400 } }], [])).toEqual([]);
    expect(osmFurnitureMissing([{ ...tree, tag: "highway=street_lamp" }, { ...tree, tag: "emergency=fire_hydrant", detail: "pillar" }], [])).toEqual([]);
  });

  it("reads parcel lockers as machines and parking meters as ticket machines", () => {
    const locker = { ...tree, tag: "amenity=parcel_locker" };
    const meter = { ...tree, tag: "amenity=vending_machine", detail: "parking_tickets" };
    expect(osmFurnitureMissing([locker, meter], [piece("vending-machine", 100, -240), piece("ticket-machine", 100, -239)])).toEqual([]);
    expect(osmFurnitureMissing([meter], [piece("vending-machine", 100, -240)])).toHaveLength(1);
  });
});
