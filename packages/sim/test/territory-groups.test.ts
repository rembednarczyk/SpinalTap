import { describe, expect, it } from "vitest";
import { TERRITORIES } from "@seki/core";
import { TERRITORY_ACTORS, TERRITORY_GROUPS, chunkAt, inBuilding, nearestWall } from "../src";
import { onRoad } from "../src/content/lublin/roads";

/*
 * The gangs' groups in the city (ADR-0091 stage 4, the curator's review of 18.11): 24 Hebi in nine
 * territories of the real places of the ADR's §1 table, each member in its territory's district,
 * on the pavement or a yard: out of the buildings, off the carriageway, clear of the walls.
 */

describe("the gangs' groups in the city (ADR-0091 stage 4)", () => {
  it("stands 24 members in nine territories, with the Rynek's patrols 28 Hebi", () => {
    expect(TERRITORY_GROUPS).toHaveLength(9);
    expect(TERRITORY_ACTORS).toHaveLength(24);
    expect(new Set(TERRITORY_ACTORS.map((a) => a.spawn.key)).size).toBe(24);
  });

  it.each(TERRITORY_ACTORS.map((a) => [a.spawn.key, a] as const))("%s stands in its district, on the pavement, clear of walls", (_key, a) => {
    if (a.kind !== "ganger" || !a.territory) throw new Error("not a member");
    const { x, z } = a.spawn.position;
    expect(chunkAt(x, z)?.district).toBe(TERRITORIES[a.territory].district);
    expect(inBuilding(x, z)).toBe(false);
    expect(onRoad(x, z)).toBe(false);
    expect(nearestWall(x, z).d).toBeGreaterThanOrEqual(0.6);
  });

  it("brings the car wash's yard back to the gang only after the prologue", () => {
    const yard = TERRITORY_ACTORS.filter((a) => a.kind === "ganger" && a.territory === "car-wash-yard");
    expect(yard.map((a) => a.when)).toEqual(yard.map(() => ({ all: ["dead:courier"] })));
  });
});
