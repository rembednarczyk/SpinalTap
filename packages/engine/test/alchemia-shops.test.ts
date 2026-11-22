import { describe, expect, it } from "vitest";
import { SHOPFRONT_HEAD, SHOP_BUILDS, galleryShopCeiling, galleryShopFloor } from "@seki/sim";
import { GeometrySink, parseCityKit, swatchUv } from "../src/renderer/city-kit-data";
import { alchemiaGeometry } from "../src/renderer/alchemia/alchemia-geometry";
import { shopPiece, shopSigns } from "../src/renderer/alchemia/shop-geometry";
// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";

/**
 * The gallery's shops in the drawing (ADR-0093 O2): every unit in the inside's mesh, its shopfront a
 * frame the eye looks through at its goods, its name in neon on its fascia in its trade's colour (off
 * when its shutter is down), a vacant unit without one.
 */
describe("Alchemia's gallery shops in the drawing (ADR-0093 O2)", () => {
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

  it("draws every shop in the inside's mesh, nothing of them in the outside's or the storeys'", () => {
    const pieces = SHOP_BUILDS.flatMap((b) => b.pieces);
    const { outside, inside, tiers } = alchemiaGeometry(data, pieces);
    // What the drawing adds without any piece (the front's frame, the Arkady, the pavilion): no more with the shops.
    const bare = alchemiaGeometry(data, []);
    expect(outside.indices.length + tiers.indices.length).toBe(bare.outside.indices.length + bare.tiers.indices.length);
    for (const b of SHOP_BUILDS) {
      const q = b.shop.rect;
      const [y0, y1] = [galleryShopFloor(b.shop), galleryShopCeiling(b.shop)];
      let n = 0;
      for (let k = 0; k < inside.positions.length; k += 3) {
        const [x, y, z] = [inside.positions[k]!, inside.positions[k + 1]!, inside.positions[k + 2]!];
        if (x > q.x0 - 0.1 && x < q.x1 + 0.1 && z > q.z0 - 0.1 && z < q.z1 + 0.1 && y > y0 - 0.1 && y < y1 + 0.1) n++;
      }
      // A shut one is its shell and its shutter; a vacant one its shell, papered glass and cartons; an open one full of
      // fittings, and of goods: Blender's on its shelves, in its cases and on its rails (ADR-0098), the back room's stock too.
      expect(n, b.shop.id).toBeGreaterThan(b.shop.state === "shut" ? 100 : b.shop.state === "vacant" ? 1000 : 1500);
      if (b.shop.state !== "shut") expect(b.detail.length, b.shop.id).toBeGreaterThan(15);
    }
  });

  it("draws a shopfront's glass as its frame only: sill, head, posts and mullions, no pane", () => {
    const fronts = SHOP_BUILDS.flatMap((b) => b.pieces.filter((p) => p.kind === "shopfront" && p.box.y1 - p.box.y0 > 2 && Math.max(p.box.x1 - p.box.x0, p.box.z1 - p.box.z0) > 1.5));
    expect(fronts.length).toBeGreaterThan(20);
    for (const p of fronts) {
      const s = new GeometrySink();
      expect(shopPiece(s, data, p)).toBe(true);
      const face = Math.max(p.box.x1 - p.box.x0, p.box.z1 - p.box.z0) * (p.box.y1 - p.box.y0);
      expect(area(s) / 2).toBeLessThan(0.45 * face);
    }
  });

  it("names every shop but the vacant ones in neon on its fascia, over its window, in its trade's colour, a shut one's sign off", () => {
    const s = new GeometrySink();
    shopSigns(s, data);
    const dead = swatchUv(data, "trim");
    for (const b of SHOP_BUILDS) {
      const q = b.shop.rect;
      const y = galleryShopFloor(b.shop);
      const fascia = (x: number, yy: number, z: number) => x > q.x0 - 0.1 && x < q.x1 + 0.1 && z > q.z0 - 0.1 && z < q.z1 + 0.1 && yy >= y + SHOPFRONT_HEAD - 0.01 && yy <= galleryShopCeiling(b.shop) + 0.01;
      let lit = 0;
      let off = 0;
      for (let k = 0; k < s.positions.length / 3; k++) {
        if (!fascia(s.positions[3 * k]!, s.positions[3 * k + 1]!, s.positions[3 * k + 2]!)) continue;
        if (s.uvs[2 * k] === dead[0] && s.uvs[2 * k + 1] === dead[1]) off++;
        else lit++;
      }
      if (b.shop.state === "vacant") expect(lit + off, b.shop.id).toBe(0);
      else if (b.shop.state === "shut") expect([lit, off > 100], b.shop.id).toEqual([0, true]);
      else expect(lit, b.shop.id).toBeGreaterThan(100);
    }
  });
});
