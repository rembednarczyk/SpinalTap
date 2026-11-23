import { describe, expect, it } from "vitest";
import { TERRITORIES } from "@seki/core";
import { TERRITORY_ACTORS, TERRITORY_GROUPS, chunkAt, inBuilding, nearestWall } from "../src";
import { LUBLIN_CHUNKS } from "../src/content/lublin";
import { onRoad } from "../src/content/lublin/roads";

/*
 * The gangs' groups in the city (ADR-0091 stage 4, the curator's review of 18.11): 24 Hebi in nine
 * territories of the real places of the ADR's §1 table, each member in its territory's district,
 * on the pavement or a yard: out of the buildings, off the carriageway, clear of the walls.
 */

/** Churches, the castle and its chapel, and the places of memory, as the street's crimes keep off them. */
const SACRED = /Kości|Cerkiew|Kaplica|Synagog|Archikatedr|Bazylik|Klasztor|Zamek/;
const MEMORY = /Getto|Langfus|Chewra/;
const SACRED_OFF = 50;
/**
 * Cores nearer a church than SACRED_OFF, in the debt of their cards: the car wash's yard (M0's, 46 m from
 * Kościół Ducha), the Arkady's lookout (T2's scene, 49 m from Kościół św. Józefa), Panasa (37 m from św. Wojciech).
 */
const NEAR_SACRED_DEBT = new Set(["car-wash-yard", "alchemia-arcades", "panasa-lane"]);

/** Metres from (x, z) to the nearest corner of a building whose name or use matches. */
const nearestOf = (x: number, z: number, match: (b: (typeof LUBLIN_CHUNKS)[number]["buildings"][number]) => boolean): number => {
  let best = Infinity;
  for (const c of LUBLIN_CHUNKS)
    for (const b of c.buildings) {
      if (!match(b)) continue;
      for (let i = 0; i + 1 < b.outline.length; i += 2) best = Math.min(best, Math.hypot(b.x + b.outline[i]! - x, b.z + b.outline[i + 1]! - z));
    }
  return best;
};

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

  it("keeps the cores off the churches and the places of memory (ADR-0091 §1)", () => {
    for (const g of TERRITORY_GROUPS) {
      if (NEAR_SACRED_DEBT.has(g.territory)) continue;
      expect(nearestOf(g.core.x, g.core.z, (b) => b.use === "church" || SACRED.test(b.name ?? "")), `${g.territory} by a church`).toBeGreaterThanOrEqual(SACRED_OFF);
      expect(nearestOf(g.core.x, g.core.z, (b) => MEMORY.test(b.name ?? "")), `${g.territory} by a place of memory`).toBeGreaterThanOrEqual(SACRED_OFF);
    }
    // The barbed-wire installation of the ghetto: as far as the street's crimes keep (the decision of 23.11).
    const ruska = TERRITORY_GROUPS.find((g) => g.territory === "ruska-market")!;
    expect(nearestOf(ruska.core.x, ruska.core.z, (b) => /Getto/.test(b.name ?? ""))).toBeGreaterThanOrEqual(100);
  });

  it("brings the car wash's yard back to the gang only after the prologue", () => {
    const yard = TERRITORY_ACTORS.filter((a) => a.kind === "ganger" && a.territory === "car-wash-yard");
    expect(yard.map((a) => a.when)).toEqual(yard.map(() => ({ all: ["dead:courier"] })));
  });
});
