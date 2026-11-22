import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { ALCHEMIA_CENTRE, MALL_FLOORS, MALL_LEVELS } from "@seki/sim";
import { Scene } from "../src/babylon";
import { ALCHEMIA_NIGHT_RIG, NIGHT_RIG, indoorRig } from "../src/npr/lighting";
import { ToonMaterials } from "../src/npr/toon-material";
import { ToonPointLights, pointLightAt, pointLightOn } from "../src/npr/toon-point-lights";
import { MAX_POINT_LIGHTS, TOON_FRAGMENT } from "../src/npr/toon-shader";
import { AlchemiaInterior } from "../src/renderer/alchemia/alchemia-interior";
import { ALCHEMIA_LAMPS, ALCHEMIA_LAMPS_ON, ALCHEMIA_LAMP_PREFIX, alchemiaLampsFor } from "../src/renderer/alchemia/alchemia-lights";

const luma = (hex: string): number => [1, 3, 5].reduce((s, i) => s + parseInt(hex.slice(i, i + 2), 16), 0);

/**
 * Alchemia's moodier light (the user's note of 22.11): in its gallery and food hall its own warm
 * rig with no cold moon, and its lamps (shops by trade, the gallery's sodium, the atrium's strips, the
 * lanterns and kitchens) clipped to their room and their storey, the nearest few on.
 */
describe("Alchemia's interior light (22.11)", () => {
  it("hangs every lamp just over its room's ceiling and keeps its light on its own storey", () => {
    expect(ALCHEMIA_LAMPS.length).toBeGreaterThan(60);
    expect(new Set(ALCHEMIA_LAMPS.map((l) => l.key)).size).toBe(ALCHEMIA_LAMPS.length);
    for (const { key, light } of ALCHEMIA_LAMPS) {
      const c = light.clip;
      expect(key.startsWith(ALCHEMIA_LAMP_PREFIX)).toBe(true);
      expect(light.position.y, key).toBeCloseTo(c.maxY - 0.05, 6);
      // No other floor one walks on between its storey's floor and its ceiling.
      expect(MALL_FLOORS.filter((f) => f > c.minY + 0.1 && f < c.maxY - 0.1), key).toEqual([]);
      // The floor over its ceiling (a slab higher) and the one under its floor get none of it.
      const at = { x: light.position.x, z: light.position.z };
      expect(pointLightAt(light, { ...at, y: c.maxY + 0.25 }), key).toBe(0);
      expect(pointLightAt(light, { ...at, y: c.minY - 0.3 }), key).toBe(0);
      // Its own floor under it lit.
      expect(pointLightOn(light, { ...at, y: c.minY + 0.05 }, { x: 0, y: 1, z: 0 }, { ...at, y: c.minY + 1.6 }).diffuse, key).toBeGreaterThan(0.03);
    }
  });

  it("never lights the ceiling over a lamp from the floor (G-509)", () => {
    const down = { x: 0, y: -1, z: 0 };
    for (const { key, light } of ALCHEMIA_LAMPS) {
      const y = light.clip.maxY - 0.1;
      const eye = { x: light.position.x + 2, y: light.clip.minY + 1.6, z: light.position.z + 2 };
      for (const [dx, dz] of [[0, 0], [1, 1], [-2, 1], [3, -2]] as const) {
        const on = pointLightOn(light, { x: light.position.x + dx, y, z: light.position.z + dz }, down, eye);
        expect(on.diffuse + on.specular, key).toBe(0);
      }
    }
  });

  it("puts on the lamps of the eye's own storey first, never more than the shader's slots leave", () => {
    for (const [name, y] of [["p0", MALL_LEVELS.p0], ["p1", MALL_LEVELS.p1], ["p2", MALL_LEVELS.p2], ["p3", MALL_LEVELS.p3]] as const) {
      const eye = { x: 409.5, y: y + 1.6, z: 45 };
      const on = alchemiaLampsFor(eye);
      expect(on).toHaveLength(ALCHEMIA_LAMPS_ON);
      expect(ALCHEMIA_LAMPS_ON).toBeLessThan(MAX_POINT_LIGHTS);
      expect(on[0]!.key, name).toBe(`${ALCHEMIA_LAMP_PREFIX}${name}-w`);
      for (const l of on) expect(l.light.clip.minY, `${name} ${l.key}`).toBeLessThan(eye.y);
      expect(on.filter((l) => l.light.clip.maxY > eye.y).length, name).toBeGreaterThanOrEqual(4);
    }
  });

  it("goes into its interior mode in the gallery and the food hall, out of it on the square and far off", () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const rooms = new AlchemiaInterior(materials);
    rooms.update({ x: 409.5, y: MALL_LEVELS.p1 + 1.6, z: 45 }, true);
    expect(rooms.interior).toBe(true);
    expect(rooms.lightScope).toBe(ALCHEMIA_LAMP_PREFIX);
    expect(rooms.on).toHaveLength(ALCHEMIA_LAMPS_ON);
    for (const l of rooms.on) expect(materials.light(l.key)).toBe(l.light);
    rooms.update({ x: 418, y: MALL_LEVELS.p3 + 1.6, z: 38.5 }, true);
    expect(rooms.interior).toBe(true);
    // Not drawn: no interior mode, its lamps off.
    rooms.update({ x: 418, y: MALL_LEVELS.p3 + 1.6, z: 38.5 }, false);
    expect(rooms.interior).toBe(false);
    expect(rooms.lightScope).toBeNull();
    expect(ALCHEMIA_LAMPS.filter((l) => materials.light(l.key))).toEqual([]);
    // On the roof and on the street before it.
    for (const eye of [{ x: 418, y: MALL_LEVELS.roof + 1.6, z: 45 }, { x: ALCHEMIA_CENTRE.x, y: 1.6, z: ALCHEMIA_CENTRE.z + 40 }]) {
      rooms.update(eye, true);
      expect(rooms.interior, JSON.stringify(eye)).toBe(false);
    }
  });

  it("lights it with a warm rig, no cold moon, the sky's night left outside", () => {
    const night = indoorRig("alchemia", 0);
    expect(night).toBe(ALCHEMIA_NIGHT_RIG);
    // No cold moon: a dim warm key, under half its light.
    expect(luma(night.sunColor)).toBeLessThan(luma(NIGHT_RIG.sunColor) / 2);
    expect(parseInt(night.sunColor.slice(1, 3), 16)).toBeGreaterThan(parseInt(night.sunColor.slice(5, 7), 16));
    // About as bright as the street's night, its shade plum and warm in place of the street's violet.
    expect(Math.abs(luma(night.ambient) - luma(NIGHT_RIG.ambient))).toBeLessThan(40);
    // Warm: more red than blue in its ambient and haze.
    for (const c of [night.ambient, night.fogColor]) expect(parseInt(c.slice(1, 3), 16)).toBeGreaterThan(parseInt(c.slice(5, 7), 16));
    expect(luma(indoorRig("alchemia", 1).ambient)).toBeGreaterThan(luma(night.ambient));
  });

  it("binds a lamp's storey into the toon shader's slot", () => {
    const slots = new ToonPointLights();
    const lamp = ALCHEMIA_LAMPS[0]!;
    slots.add(lamp.key, lamp.light);
    const arrays = new Map<string, number[]>();
    const sink = (k: string, v: number[]) => arrays.set(k, v);
    slots.apply({ setArray4: sink, setArray2: sink, setFloat: () => undefined } as unknown as Parameters<ToonPointLights["apply"]>[0]);
    const y = arrays.get("pointClipY")!;
    expect(y).toHaveLength(MAX_POINT_LIGHTS * 2);
    expect(y.slice(0, 2)).toEqual([lamp.light.clip.minY, lamp.light.clip.maxY]);
    expect(y[2]).toBeLessThan(-1e6);
    expect(TOON_FRAGMENT).toMatch(/uniform vec2 pointClipY\[/);
    expect(TOON_FRAGMENT).toMatch(/att \*= step\(pointClipY\[i\]\.x, vWorldPos\.y\)/);
  });
});
