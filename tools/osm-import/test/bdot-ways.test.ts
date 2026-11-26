import { describe, expect, it } from "vitest";
import { type Line } from "../src/features.ts";
import { bdotWays } from "../src/streets/bdot-ways.ts";

/** ADR-0104 pkt 4: BDOT10k measures the streets in the districts on the street graph, after the map's own width. */

// Along Bajkowskiego's carriageway in BDOT10k (6 m), in Krakowskie Przedmieście.
const along = [{ x: 385, z: -17 }, { x: 433, z: -16.2 }];
const street = (id: string, tags: Record<string, string>): Line => ({ id, osmId: 1, tags: { highway: "residential", ...tags }, line: along });

describe("the ways BDOT10k measures (ADR-0104 pkt 4)", () => {
  it("takes BDOT10k's width for a street the map gives none, not for one it gives a width (OSM first)", () => {
    const ways = bdotWays([street("plain", {}), street("mapped", { width: "3.5" }), street("lane", { "width:carriageway": "4" })], new Set(["krakowskie"]));
    expect([...ways.keys()]).toEqual(["plain"]);
    expect(ways.get("plain")!.width).toBe(6);
  });

  it("measures no street the game closes to cars: the deptak keeps its setts out to its bays' kerb (T-324)", () => {
    expect(bdotWays([{ ...street("w216497220", {}), id: "w216497220" }], new Set(["krakowskie"])).size).toBe(0);
  });

  it("measures none while the street graph is off", () => {
    expect(bdotWays([street("plain", {})], new Set()).size).toBe(0);
  });
});
