import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { RawTexture, Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { MapCity, type MapView } from "../src/renderer/mapcity/map-city";
import { MapSignMaterial, NAME_SLOTS } from "../src/renderer/mapcity/map-signs";

/*
 * G-916: the names atlas has `NAME_SLOTS` rows for the whole city's 126 building names. A row was
 * given a name the first time a cell asked for it and kept for good, so once the player had seen a
 * few districts every later district's name plaques went undrawn. A cell now gives its rows back
 * when it goes (its chunk streamed out), and a row nobody uses takes the next name.
 */

const makeCity = () => {
  const scene = new Scene(new NullEngine());
  const atlas = RawTexture.CreateRGBATexture(new Uint8Array(4), 1, 1, scene);
  return new MapCity({ scene, materials: new ToonMaterials(scene), shadow: null, quality: "high", signAtlas: atlas });
};

const square = [
  { x: -5, z: -5 },
  { x: 5, z: -5 },
  { x: 5, z: 5 },
  { x: -5, z: 5 },
];
const named = (name: string, look: number): MapView => ({ kind: "building", outline: square, height: 14, levels: 4, use: "residential", look, name });

/** Vertices of the city's sign meshes. */
const signVertices = (city: MapCity): number => city.meshes.filter((m) => m.name.startsWith("map-signs")).reduce((n, m) => n + m.getTotalVertices(), 0);

/** A row of `count` named buildings along x from `x0`, ids from `id0`, names `prefix 0..`. */
const street = (city: MapCity, id0: number, x0: number, count: number, prefix: string): number[] => {
  const ids = Array.from({ length: count }, (_, i) => id0 + i);
  ids.forEach((id, i) => city.spawn(id, named(`${prefix} ${i}`, id), { x: x0 + (i % 8) * 14, y: 0, z: 10 + Math.floor(i / 8) * 14 }));
  city.flush();
  return ids;
};

describe("the names atlas when the city streams (G-916)", () => {
  it("draws a district's plaques after more names than the atlas holds have come and gone", () => {
    const fresh = makeCity();
    street(fresh, 1000, 2000, 6, "Kamienica B");
    const expected = signVertices(fresh);
    expect(expected).toBeGreaterThan(0);

    const city = makeCity();
    // A district with more names than the atlas has rows, streamed in and out.
    const gone = street(city, 1, 0, NAME_SLOTS + 8, "Kamienica A");
    for (const id of gone) city.despawn(id);
    city.flush();
    street(city, 1000, 2000, 6, "Kamienica B");
    expect(signVertices(city)).toBe(expected);
  });

  it("keeps a row while any cell still uses its name, and the landmarks' rows for good", () => {
    const scene = new Scene(new NullEngine());
    const signs = new MapSignMaterial(scene, RawTexture.CreateRGBATexture(new Uint8Array(4), 1, 1, scene));
    const a = signs.slotFor("Hotel Europa");
    expect(signs.slotFor("Hotel Europa")).toBe(a);
    signs.release("Hotel Europa");
    // Still asked for once more: the row stays and a new name gets another.
    expect(signs.slotFor("Pałac Parysów")).not.toBe(a);
    signs.release("Hotel Europa");
    expect(signs.slotFor("Trybunał Koronny")).toBe(a);
    // Filled up, a name gets no row; one given back makes room.
    for (let k = 0; k < NAME_SLOTS; k++) signs.slotFor(`Kamienica ${k}`);
    expect(signs.slotFor("Wieża Trynitarska")).toBeNull();
    signs.release("Kamienica 3");
    expect(signs.slotFor("Wieża Trynitarska")).not.toBeNull();
    // A landmark's text is never given back.
    signs.release("MDCCLXXXV");
    expect(signs.slotFor("Kamienica X")).toBeNull();
    expect(signs.slotFor("MDCCLXXXV")).not.toBeNull();
  });
});
