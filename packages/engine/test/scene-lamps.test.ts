import { describe, expect, it } from "vitest";
import { PLAC_ZAMKOWY_LAMPS } from "@seki/sim";
import type { PointLightDef } from "../src/npr/lighting";
import { SceneLamps } from "../src/renderer/mapcity/scene-lamps";

/** The scenes' lights on the map (ADR-0102 point 5): on near their place, off elsewhere and in a closed hall. */
describe("the scenes' lamps", () => {
  const fake = () => {
    const lights = new Map<string, PointLightDef>();
    return { lights, materials: { addLight: (k: string, l: PointLightDef) => void lights.set(k, l), removeLight: (k: string) => void lights.delete(k) } };
  };
  const { x, z } = PLAC_ZAMKOWY_LAMPS.centre;

  it("turns Plac Zamkowy's lights on near the square and off past its reach and a margin", () => {
    const { lights, materials } = fake();
    const lamps = new SceneLamps(materials);
    lamps.update({ x: x + 200, y: 0, z }, true);
    expect(lights.size).toBe(0);
    lamps.update({ x: x + 20, y: 0, z }, true);
    expect(lamps.lit).toEqual([PLAC_ZAMKOWY_LAMPS.id]);
    expect(lights.size).toBe(PLAC_ZAMKOWY_LAMPS.lamps.length);
    expect(lights.get("targ-pz-metro")?.color).toBe("#3dff86");
    // Just past its reach it holds, a margin farther it goes.
    lamps.update({ x: x + PLAC_ZAMKOWY_LAMPS.near + 2, y: 0, z }, true);
    expect(lights.size).toBe(PLAC_ZAMKOWY_LAMPS.lamps.length);
    lamps.update({ x: x + PLAC_ZAMKOWY_LAMPS.near + 10, y: 0, z }, true);
    expect(lights.size).toBe(0);
  });

  it("keeps them off in a closed hall, however near", () => {
    const { lights, materials } = fake();
    const lamps = new SceneLamps(materials);
    lamps.update({ x, y: 0, z }, true);
    lamps.update({ x, y: 0, z }, false);
    expect(lights.size).toBe(0);
    expect(lamps.lit).toEqual([]);
  });
});
