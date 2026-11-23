import { describe, expect, it } from "vitest";
import { BAZAR_LAMPS, BAZAR_STALLS, METRO_STATIONS, PLAC_ZAMKOWY_AREA, PLAC_ZAMKOWY_LAMPS, PLAC_ZAMKOWY_STALLS, RUSKA_LAMPS, RUSKA_STALLS, SCENE_LAMP_GROUPS, TARG_MARKET_DETAIL, WORLD_SCENERY, groundY } from "../src";
import { roomDetailShape } from "@seki/core";
import { turnLocal } from "../src/content/lublin/furniture";

/*
 * Podzamcze's first lights of the game (`docs/lokacje/dzielnica-targ.md`, „Dług sceny” point 1; §13 of
 * `docs/zasady-lokacji.md`: no light from nowhere): each in a fitting the scene's models draw.
 */
describe("Plac Zamkowy's lights in their fittings (§13)", () => {
  const festoons = PLAC_ZAMKOWY_LAMPS.lamps.filter((l) => l.key.startsWith("targ-pz-festoon-"));

  it("hangs one warm light in each stall's festoon, between its front posts and under its roof", () => {
    expect(PLAC_ZAMKOWY_STALLS.length).toBeGreaterThanOrEqual(6);
    expect(festoons).toHaveLength(PLAC_ZAMKOWY_STALLS.length);
    festoons.forEach((l, i) => {
      const s = PLAC_ZAMKOWY_STALLS[i]!;
      // Back in the stall's own frame: in the plane of its front posts (z 0.7), between them (x ±1).
      const local = turnLocal(-s.yaw, l.at.x - s.x, l.at.z - s.z);
      expect(Math.abs(local.x), l.key).toBeLessThan(1);
      expect(local.z, l.key).toBeCloseTo(0.72, 6);
      const up = l.at.y - s.y;
      expect(up, l.key).toBeGreaterThan(1.8);
      expect(up, l.key).toBeLessThan(2.3);
      expect(l.color).toBe("#ffc27a");
    });
  });

  it("lights the way down green before the metro pavilion's opening, at its lamp", () => {
    const metro = PLAC_ZAMKOWY_LAMPS.lamps.find((l) => l.key === "targ-pz-metro")!;
    const pavilion = METRO_STATIONS.flatMap((s) => s.entrances).find((e) => e.name === "Plac Zamkowy")!.outline;
    expect(metro.at.x).toBeGreaterThan(pavilion.minX);
    expect(metro.at.x).toBeLessThan(pavilion.maxX);
    expect(metro.at.z - pavilion.maxZ).toBeGreaterThan(0);
    expect(metro.at.z - pavilion.maxZ).toBeLessThan(0.5);
    expect(metro.at.y - groundY(metro.at.x, metro.at.z)).toBeCloseTo(2.61, 1);
    expect(metro.color).toBe("#3dff86");
  });

  it("keeps every light on the square, within its group's reach, under one key each", () => {
    const keys = SCENE_LAMP_GROUPS.flatMap((g) => g.lamps.map((l) => l.key));
    expect(new Set(keys).size).toBe(keys.length);
    for (const l of PLAC_ZAMKOWY_LAMPS.lamps) {
      expect(l.at.x).toBeGreaterThan(PLAC_ZAMKOWY_AREA.minX - 3);
      expect(l.at.x).toBeLessThan(PLAC_ZAMKOWY_AREA.maxX + 3);
      expect(l.at.z).toBeGreaterThan(PLAC_ZAMKOWY_AREA.minZ - 3);
      expect(l.at.z).toBeLessThan(PLAC_ZAMKOWY_AREA.maxZ + 3);
      expect(Math.hypot(l.at.x - PLAC_ZAMKOWY_LAMPS.centre.x, l.at.z - PLAC_ZAMKOWY_LAMPS.centre.z)).toBeLessThan(PLAC_ZAMKOWY_LAMPS.near);
    }
  });
});

describe("the Bazaar's and Targ na Ruskiej's festoons and their lights (§13)", () => {
  it("hangs a festoon over every stall of the two markets and a warm light in each, under its roof between its front posts", () => {
    expect(BAZAR_STALLS.length).toBeGreaterThanOrEqual(40);
    expect(RUSKA_STALLS.length).toBeGreaterThanOrEqual(150);
    const stalls = [...BAZAR_STALLS, ...RUSKA_STALLS];
    expect(TARG_MARKET_DETAIL).toHaveLength(stalls.length);
    expect(TARG_MARKET_DETAIL.every((d) => d.prop === "room-detail" && d.variant === roomDetailShape("rd-targ-festoon"))).toBe(true);
    expect(WORLD_SCENERY.some((s) => s.view.kind === "street-props" && s.view.items === TARG_MARKET_DETAIL)).toBe(true);
    for (const [group, list] of [[BAZAR_LAMPS, BAZAR_STALLS], [RUSKA_LAMPS, RUSKA_STALLS]] as const) {
      expect(group.lamps).toHaveLength(list.length);
      group.lamps.forEach((l, i) => {
        const s = list[i]!;
        const local = turnLocal(-s.yaw, l.at.x - s.x, l.at.z - s.z);
        expect(Math.abs(local.x), l.key).toBeLessThan(1);
        expect(local.z, l.key).toBeCloseTo(0.72, 6);
        expect(l.at.y - s.y, l.key).toBeGreaterThan(1.8);
        expect(l.at.y - s.y, l.key).toBeLessThan(2.3);
        expect(Math.hypot(l.at.x - group.centre.x, l.at.z - group.centre.z), l.key).toBeLessThan(group.near);
      });
    }
  });

  it("leaves the flea market's stalls to Plac Zamkowy's own festoons", () => {
    const flea = new Set(PLAC_ZAMKOWY_STALLS);
    expect([...BAZAR_STALLS, ...RUSKA_STALLS].some((s) => flea.has(s))).toBe(false);
  });
});

