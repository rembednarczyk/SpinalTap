import { describe, expect, it } from "vitest";
import { BAZAR_FESTOONS, BAZAR_STALLS, MARKET_FESTOONS, PLAC_ZAMKOWY_FESTOONS, RUSKA_FESTOONS, RUSKA_STALLS, festoonAt, groundY, inBuilding } from "../src";
import { turnLocal } from "../src/content/lublin/furniture";
import { surfacesAt } from "../src/content/lublin/roads";

/*
 * Festoons across the aisles of Targ na Ruskiej and the Bazaar (decision of the user 24.11): from a stall's front to the
 * front of the stall facing it, over the walkers' heads, never over a carriageway or into a building.
 */
const fronts = [...RUSKA_STALLS, ...BAZAR_STALLS].map((s) => {
  const d = turnLocal(s.yaw, 0, 0.72);
  return { x: s.x + d.x, z: s.z + d.z };
});
const spans = [...RUSKA_FESTOONS, ...BAZAR_FESTOONS];

describe("the night markets' festoons across their aisles (24.11)", () => {
  it("cross the aisles of both markets, bulbs and now and then a neon strip", () => {
    expect(RUSKA_FESTOONS.length).toBeGreaterThanOrEqual(15);
    expect(BAZAR_FESTOONS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(spans.map((s) => s.style))).toEqual(new Set(["bulbs", "strip"]));
    expect(MARKET_FESTOONS).toHaveLength(PLAC_ZAMKOWY_FESTOONS.length + spans.length);
  });

  it("hang from stall fronts 2.5-7 m apart, each stall's front in one at most", () => {
    const used: string[] = [];
    for (const s of spans) {
      const len = Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z);
      expect(len).toBeGreaterThanOrEqual(2.5);
      expect(len).toBeLessThanOrEqual(7);
      for (const e of [s.a, s.b]) {
        const f = fronts.findIndex((p) => Math.hypot(p.x - e.x, p.z - e.z) < 1e-9);
        expect(f).toBeGreaterThanOrEqual(0);
        used.push(String(f));
      }
    }
    expect(new Set(used).size).toBe(used.length);
  });

  it("hang 2.2 m over the ground at least, over no carriageway or building", () => {
    for (const s of spans)
      for (let t = 0.05; t < 1; t += 0.1) {
        const p = festoonAt(s, t);
        expect(p.y - groundY(p.x, p.z), `${p.x},${p.z}`).toBeGreaterThanOrEqual(2.2);
        expect(inBuilding(p.x, p.z)).toBe(false);
        expect(surfacesAt(p.x, p.z)).not.toContain("road");
      }
  });
});
