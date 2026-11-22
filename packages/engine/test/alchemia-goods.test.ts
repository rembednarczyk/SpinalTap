// @ts-expect-error The engine is typed for the browser; the test reads the files off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CityKit } from "../src/renderer/city-kit";
import { parseCityKit } from "../src/renderer/city-kit-data";
import { mergeCityProps, parseCityProps } from "../src/renderer/city-props";
import { AlchemiaView } from "../src/renderer/alchemia/alchemia-view";

/**
 * The goods of Alchemia's shops (ADR-0098): Blender's models in a mesh of their own drawn with the hall's inside only,
 * as the boxes they stand for were, not in the city's furniture block (drawn from 170 m, Neon Koi's street too).
 */
describe("Alchemia's shops' goods in the drawing (ADR-0098)", () => {
  const buffer = (name: string): ArrayBuffer =>
    ((b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)((readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url)));
  const data = parseCityKit(buffer("city-kit.glb"));
  const props = ["room-detail-props.glb", "room-detail-galeria-props.glb"].map((f) => parseCityProps(buffer(f))).reduce((a, b) => mergeCityProps(a, b));
  const view = (quality: "high" | "low", eye: { x: number; y: number; z: number }) => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const kit = new CityKit(scene, materials, null, data, { labels: false });
    return new AlchemiaView({ scene, materials, kit: () => kit, city: () => true, eye: () => eye, props: () => props, quality });
  };

  it("draws them near the hall with its inside, never from Neon Koi's street, the phone's simpler", () => {
    const eye = { x: 418, y: 1.6, z: 30 };
    const v = view("high", eye);
    v.update();
    expect(v.goods.shown).toBe(true);
    const high = v.goods.triangles;
    expect(high).toBeGreaterThan(300_000);
    // By Neon Koi, 150 m off: the hall's inside off, the goods with it.
    [eye.x, eye.z] = [270, -81];
    v.update();
    expect(v.goods.shown).toBe(false);
    const phone = view("low", { x: 418, y: 1.6, z: 30 });
    phone.update();
    expect(phone.goods.triangles * 4).toBeLessThan(high);
  });

  it("draws nothing before the props files load", () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const kit = new CityKit(scene, materials, null, data, { labels: false });
    const v = new AlchemiaView({ scene, materials, kit: () => kit, city: () => true, eye: () => ({ x: 418, y: 1.6, z: 30 }), props: () => null });
    v.update();
    expect(v.goods.shown).toBe(false);
    expect(v.goods.triangles).toBe(0);
  });
});
