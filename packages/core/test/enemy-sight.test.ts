import { describe, expect, it } from "vitest";
import { ENEMY_TYPES, sightOf } from "../src";

/** The start values of ADR-0069's table: one sight profile per enemy type with the AI of a ganger. */
describe("sight profiles of the enemies (ADR-0069)", () => {
  it("are the table's numbers", () => {
    const hebi = { sight: 17, cone: 1.2, crouchSight: 0.5, near: 2, suspicionRate: 2 };
    const trained = { sight: 17, cone: 1.05, crouchSight: 0.5, near: 2.2, suspicionRate: 1.6 };
    expect(sightOf("hebi_ganger")).toEqual(hebi);
    expect(sightOf("hebi_lookout")).toEqual(hebi);
    expect(sightOf("hebi_brawler")).toEqual(hebi);
    expect(sightOf("hebi_enforcer")).toEqual(trained);
    expect(sightOf("kagami_cleaner")).toEqual(trained);
    expect(sightOf("tessen_guard")).toEqual({ sight: 18, cone: 1.05, crouchSight: 0.5, near: 2.2, suspicionRate: 1.4 });
  });

  it("give the sniper a guard's eyes out to 40 m (W-3's observer, ADR-0082), and anything untyped sees as a Hebi ganger", () => {
    expect(ENEMY_TYPES.tessen_sniper.vision).toEqual({ ...sightOf("tessen_guard"), sight: 40 });
    expect(sightOf(undefined)).toBe(sightOf("hebi_ganger"));
  });
});
