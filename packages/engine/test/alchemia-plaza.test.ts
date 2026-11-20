// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALCHEMIA_PIECES, ALCHEMIA_TIER_PIECES, CAFE_TABLES, PLAZA_KIOSKS, plazaCafePieces, plazaFloorPieces } from "@seki/sim";
import { parseCityKit, swatchUv } from "../src/renderer/city-kit-data";
import { alchemiaGeometry } from "../src/renderer/alchemia/alchemia-geometry";

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const kitData = parseCityKit(file("city-kit.glb"));

/** A mesh of Alchemia's at most (`alchemia.test.ts`: the user's decision of 19.11). */
const ALCHEMIA_TRIANGLES = 40000;

/**
 * The square before Alchemia's front (ADR-0074 C5) in the engine: drawn with the front in the tiers'
 * mesh (no draw call of its own), its umbrellas as cones and its kiosks' awnings sloping, as on the board.
 */
describe("the square before Alchemia's front in the engine (ADR-0074 C5)", () => {
  const key = (p: (typeof ALCHEMIA_TIER_PIECES)[number]) => `${p.kind}:${p.box.x0}:${p.box.x1}:${p.box.z0}:${p.box.z1}:${p.box.y0}:${p.box.y1}`;
  const fresh = [...plazaFloorPieces(), ...plazaCafePieces()];
  const keys = new Set(fresh.map(key));
  /** The square's pieces as the tiers hold them (the engine knows the tiers' pieces by themselves). */
  const square = ALCHEMIA_TIER_PIECES.filter((p) => keys.has(key(p)));

  it("draws the square in the tiers' mesh, within its budget", () => {
    expect(square.length).toBe(fresh.length);
    const all = alchemiaGeometry(kitData);
    const without = alchemiaGeometry(kitData, ALCHEMIA_PIECES.filter((p) => !keys.has(key(p))));
    const tris = (all.tiers.indices.length - without.tiers.indices.length) / 3;
    expect(tris).toBeGreaterThan(1000);
    expect(all.outside.indices.length).toBe(without.outside.indices.length);
    expect(all.inside.indices.length).toBe(without.inside.indices.length);
    expect(all.tiers.indices.length / 3).toBeLessThanOrEqual(ALCHEMIA_TRIANGLES);
  });

  it("draws each umbrella's canopy as a cone over its rim, lighter than its underside, and each awning sloping down from its kiosk", () => {
    const umbrellas = square.filter((p) => p.kind === "umbrella" && p.outline);
    expect(umbrellas.length).toBe(CAFE_TABLES.length);
    const g = alchemiaGeometry(kitData, umbrellas).tiers;
    const ys = new Set<number>();
    for (let i = 1; i < g.positions.length; i += 3) ys.add(Math.round(g.positions[i]! * 100));
    const u = umbrellas[0]!;
    // Its apex over the middle, its rim, the valance under the rim.
    expect(ys.has(Math.round(u.box.y1 * 100))).toBe(true);
    expect(ys.has(Math.round(u.box.y0 * 100))).toBe(true);
    // The cone's faces slope: normals neither flat up nor level.
    let sloped = 0;
    for (let i = 1; i < g.normals.length; i += 3) if (g.normals[i]! > 0.2 && g.normals[i]! < 0.95) sloped++;
    expect(sloped).toBeGreaterThan(8 * 3);
    const awnings = square.filter((p) => p.kind === "awning");
    expect(awnings.length).toBe(2 * PLAZA_KIOSKS.length);
    const a = alchemiaGeometry(kitData, [awnings[0]!]).tiers;
    // The edge against the kiosk high, the far edge low: the sheet's first two corners over the next two.
    expect(a.positions[1]!).toBeCloseTo(awnings[0]!.box.y1, 6);
    expect(a.positions[7]!).toBeCloseTo(awnings[0]!.box.y0, 6);
    const uvs = new Set<string>();
    for (let i = 0; i < a.uvs.length; i += 2) uvs.add(`${a.uvs[i]},${a.uvs[i + 1]}`);
    expect(uvs.has(swatchUv(kitData, "win-warm").join(","))).toBe(true);
  });

  it("paints the hologram and the kiosks' food lit, their sign bands neon, the podium dark", () => {
    const uvOf = (kind: string): string => {
      const g = alchemiaGeometry(kitData, square.filter((p) => p.kind === kind).slice(0, 1)).tiers;
      return `${g.uvs[0]},${g.uvs[1]}`;
    };
    // The hologram a picture of light: a pale glow with bands across it.
    const holo = alchemiaGeometry(kitData, square.filter((p) => p.kind === "holo")).tiers;
    const holoUvs = new Set<string>();
    for (let i = 0; i < holo.uvs.length; i += 2) holoUvs.add(`${holo.uvs[i]},${holo.uvs[i + 1]}`);
    for (const c of ["glass-blue", "win-teal", "neon-cyan", "neon-pink"]) expect(holoUvs.has(swatchUv(kitData, c).join(",")), c).toBe(true);
    expect(uvOf("food")).toBe(swatchUv(kitData, "win-warm").join(","));
    expect(uvOf("sign-red")).toBe(swatchUv(kitData, "neon-red").join(","));
    expect(uvOf("sign-amber")).toBe(swatchUv(kitData, "neon-amber").join(","));
    // The podium's paving: the kit's paint tinted dark (the board's wet stone), not the light trim of the steps.
    const deck = alchemiaGeometry(kitData, square.filter((p) => p.kind === "paving" && !p.outline)).tiers;
    expect(`${deck.uvs[0]},${deck.uvs[1]}`).toBe(swatchUv(kitData, "paint").join(","));
    expect(deck.colors[0]!).toBeLessThan(0.5);
  });
});
