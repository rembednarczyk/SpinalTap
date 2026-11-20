// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { ALCHEMIA_TIER_PIECES, FRONT_ROOM_DRAWN, FRONT_SHOP_BUILDS, FRONT_VENUE_SIGNS, MALL } from "@seki/sim";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CityKit } from "../src/renderer/city-kit";
import { GeometrySink, parseCityKit } from "../src/renderer/city-kit-data";
import { alchemiaGeometry } from "../src/renderer/alchemia/alchemia-geometry";
import { AlchemiaView } from "../src/renderer/alchemia/alchemia-view";
import { paneFrame } from "../src/renderer/alchemia/storey-facade";
import { venueSigns } from "../src/renderer/alchemia/venue-signs";

/**
 * The front's storeys as rooms in the drawing (ADR-0093 O5): their glass a frame the eye looks through
 * (no lit backdrop with figures any more), their rooms in the inside's mesh (no mesh or draw call of
 * their own), drawn too when the eye is on the square before the front, their venues' names in neon.
 */
describe("Alchemia's front rooms in the drawing (ADR-0093 O5)", () => {
  const bytes = (readFileSync as (url: URL) => Uint8Array)(new URL("../../app/public/city/city-kit.glb", import.meta.url));
  const data = parseCityKit(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const area = (s: GeometrySink): number => {
    let sum = 0;
    for (let i = 0; i < s.indices.length; i += 3) {
      const [a, b, c] = [s.indices[i]!, s.indices[i + 1]!, s.indices[i + 2]!].map((k) => [s.positions[3 * k]!, s.positions[3 * k + 1]!, s.positions[3 * k + 2]!]) as [number[], number[], number[]];
      const [u, v] = [a.map((x, j) => b[j]! - x), a.map((x, j) => c[j]! - x)];
      sum += Math.hypot(u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!) / 2;
    }
    return sum;
  };

  it("draws the storeys' glass as its frame only: the rooms behind it seen through it", () => {
    const panes = ALCHEMIA_TIER_PIECES.filter((p) => p.kind === "pane" && p.outline && p.box.z1 < MALL.z0 + 0.01 && p.box.y1 - p.box.y0 > 2);
    expect(panes.length).toBeGreaterThan(40);
    for (const p of panes) {
      const s = new GeometrySink();
      const [a, b] = [p.outline![0]!, p.outline![1]!];
      paneFrame(s, data, p.outline!, p.box.y0, p.box.y1);
      const face = Math.hypot(b.x - a.x, b.z - a.z) * (p.box.y1 - p.box.y0);
      // Both sides of a frame of mullions, a sill and a head: well under the pane's face.
      if (face > 4) expect(area(s) / 2, `${a.x},${a.z}`).toBeLessThan(0.45 * face);
    }
  });

  it("draws the rooms and their units in the inside's mesh, nothing of them in the outside's or the storeys'", () => {
    const pieces = [...FRONT_ROOM_DRAWN, ...FRONT_SHOP_BUILDS.flatMap((b) => b.pieces)];
    const { outside, inside, tiers } = alchemiaGeometry(data, pieces);
    const bare = alchemiaGeometry(data, []);
    expect(outside.indices.length + tiers.indices.length).toBe(bare.outside.indices.length + bare.tiers.indices.length);
    expect(inside.indices.length - bare.inside.indices.length).toBeGreaterThan(20_000 * 3);
  });

  it("names the café, the bar and the grill in neon within their spans", () => {
    expect(FRONT_VENUE_SIGNS.map((s) => s.text)).toEqual(["KISSA NEKO", "SKY BAR", "YAKITORI"]);
    for (const s of FRONT_VENUE_SIGNS) {
      const sink = new GeometrySink();
      venueSigns(sink, data, [s]);
      expect(sink.indices.length, s.text).toBeGreaterThan(36 * 10);
      for (let k = 0; k < sink.positions.length; k += 3) {
        const [x, y, z] = [sink.positions[k]!, sink.positions[k + 1]!, sink.positions[k + 2]!];
        const a = s.axis === "x" ? x : z;
        expect(a, s.text).toBeGreaterThan(s.a0 - 0.01);
        expect(a, s.text).toBeLessThan(s.a1 + 0.01);
        expect(y, s.text).toBeGreaterThan(s.y0 - 0.01);
        expect(y, s.text).toBeLessThan(s.y1 + 0.01);
      }
    }
  });

  it("draws the inside from the square before the front, not from Bajkowskiego's far end", () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const kit = new CityKit(scene, materials, null, data, { labels: false });
    const eye = { x: 412, y: 1.6, z: -25 };
    const view = new AlchemiaView({ scene, materials, kit: () => kit, city: () => true, eye: () => eye });
    view.update();
    expect(view.stats.meshes).toBe(3);
    eye.z = -60;
    view.update();
    expect(view.stats.meshes).toBe(2);
  });
});
