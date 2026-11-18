import { describe, expect, it } from "vitest";
import { ENEMY_TYPES, sightOf } from "../src";

/** ADR-0069's table, the meter slowed on 18.11 (as in Cyberpunk 2077): one sight profile per enemy type with the AI of a ganger. */
describe("sight profiles of the enemies (ADR-0069)", () => {
  it("are the table's numbers", () => {
    const hebi = { sight: 17, cone: 1.2, crouchSight: 0.5, near: 2, suspicionRate: 0.67 };
    const trained = { sight: 17, cone: 1.05, crouchSight: 0.5, near: 2.2, suspicionRate: 0.53 };
    expect(sightOf("hebi_ganger")).toEqual(hebi);
    expect(sightOf("hebi_lookout")).toEqual(hebi);
    expect(sightOf("hebi_brawler")).toEqual(hebi);
    expect(sightOf("hebi_enforcer")).toEqual(trained);
    expect(sightOf("kagami_cleaner")).toEqual(trained);
    expect(sightOf("tessen_guard")).toEqual({ sight: 18, cone: 1.05, crouchSight: 0.5, near: 2.2, suspicionRate: 0.47 });
  });

  it("leave the sniper its own sight, and anything untyped sees as a Hebi ganger", () => {
    expect("vision" in ENEMY_TYPES.tessen_sniper).toBe(false);
    expect(sightOf(undefined)).toBe(sightOf("hebi_ganger"));
    expect(sightOf("tessen_sniper")).toEqual(sightOf("hebi_ganger"));
  });
});
