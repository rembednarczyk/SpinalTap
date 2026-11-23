import { describe, expect, it } from "vitest";
import { PLAC_ZAMKOWY_LAMPS, RUSKA_LAMPS } from "@seki/sim";
import type { PointLightDef } from "../src/npr/lighting";
import { SCENE_LAMP_SLOTS, SceneLamps } from "../src/renderer/mapcity/scene-lamps";

/** The scenes' lights on the map (ADR-0102 point 5): the nearest few of the groups near their place, none elsewhere or in a closed hall. */
describe("the scenes' lamps", () => {
  const fake = () => {
    const lights = new Map<string, PointLightDef>();
    let adds = 0;
    return {
      lights,
      adds: () => adds,
      materials: {
        addLight: (k: string, l: PointLightDef) => {
          adds++;
          lights.set(k, l);
        },
        removeLight: (k: string) => void lights.delete(k),
      },
    };
  };
  const { x, z } = PLAC_ZAMKOWY_LAMPS.centre;

  it("turns Plac Zamkowy's lights on near the square and off past its reach and a margin", () => {
    const { lights, materials } = fake();
    const lamps = new SceneLamps(materials);
    lamps.update({ x: x + 200, y: 0, z }, true);
    expect(lights.size).toBe(0);
    lamps.update({ x: x + 20, y: 0, z }, true);
    expect(lamps.groupsOn).toEqual([PLAC_ZAMKOWY_LAMPS.id]);
    expect(lights.size).toBe(Math.min(SCENE_LAMP_SLOTS, PLAC_ZAMKOWY_LAMPS.lamps.length));
    // Just past its reach it holds, a margin farther it goes.
    lamps.update({ x: x + PLAC_ZAMKOWY_LAMPS.near + 2, y: 0, z }, true);
    expect(lights.size).toBeGreaterThan(0);
    lamps.update({ x: x + PLAC_ZAMKOWY_LAMPS.near + 10, y: 0, z }, true);
    expect(lights.size).toBe(0);
  });

  it("lights the stalls round the eye, not the market's first ones, and follows the eye", () => {
    const { lights, materials, adds } = fake();
    const lamps = new SceneLamps(materials);
    const nearestTo = (p: { x: number; y: number; z: number }) =>
      [...RUSKA_LAMPS.lamps].sort((a, b) => Math.hypot(a.at.x - p.x, a.at.y - p.y, a.at.z - p.z) - Math.hypot(b.at.x - p.x, b.at.y - p.y, b.at.z - p.z)).slice(0, SCENE_LAMP_SLOTS).map((l) => l.key);
    for (const l of [RUSKA_LAMPS.lamps[0]!, RUSKA_LAMPS.lamps[RUSKA_LAMPS.lamps.length - 1]!]) {
      const eye = { x: l.at.x, y: l.at.y - 0.3, z: l.at.z + 3 };
      lamps.update(eye, true);
      expect(new Set(lights.keys())).toEqual(new Set(nearestTo(eye)));
    }
    // A few lights registered at a time, not the market's 171 at once.
    expect(adds()).toBeLessThanOrEqual(2 * SCENE_LAMP_SLOTS);
  });

  it("keeps them off in a closed hall, however near", () => {
    const { lights, materials } = fake();
    const lamps = new SceneLamps(materials);
    lamps.update({ x, y: 0, z }, true);
    lamps.update({ x, y: 0, z }, false);
    expect(lights.size).toBe(0);
    expect(lamps.groupsOn).toEqual([]);
  });
});
