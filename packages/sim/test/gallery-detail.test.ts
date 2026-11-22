import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { FRONT_SHOP_BUILDS, FRONT_SHOP_DETAIL, GALLERY_DETAIL, ROOM_DETAIL_SCENERY, SHOP_BUILDS } from "../src";
import { newFit, shelves } from "../src/content/alchemia/shop-fittings";

/**
 * The gallery's goods after its card (ADR-0098, `docs/pomieszczenia/alchemia-gallery.md`): half a metre of a shelf's goods,
 * Blender's model of the shop's trade, where the shelves had boxes of goods; the back rooms' stock in cartons.
 */
describe("Alchemia's gallery's shelf goods (ADR-0098)", () => {
  const key = (variant: number) => ROOM_DETAIL_SHAPES[variant]!.key;
  const builds = [...SHOP_BUILDS, ...FRONT_SHOP_BUILDS];

  it("stands each shop's goods in it, on a shelf's board, by its trade or as stock", () => {
    expect(GALLERY_DETAIL.length).toBeGreaterThan(1000);
    for (const b of builds) {
      const r = b.shop.rect;
      const shelf = b.detail.filter((p) => !/^rd-gl-(case-|garments|mannequin)/.test(key(p.variant)));
      const board = (y: number) => ((y - (shelf[0]?.y ?? y)) / 0.45) % 1;
      for (const p of shelf) {
        const k = key(p.variant);
        expect(k.startsWith("rd-gl-"), k).toBe(true);
        expect(p.x >= Math.min(r.x0, r.x1) && p.x <= Math.max(r.x0, r.x1) && p.z >= Math.min(r.z0, r.z1) && p.z <= Math.max(r.z0, r.z1), `${b.shop.id} ${p.x},${p.z}`).toBe(true);
        expect(Math.abs(board(p.y)) < 1e-6 || Math.abs(board(p.y)) > 1 - 1e-6, `${b.shop.id} ${p.y}`).toBe(true);
      }
      const trades = new Set(b.detail.map((p) => key(p.variant)));
      if (b.shop.trade === "pharmacy" && b.shop.state === "open") expect(trades.has("rd-gl-pharmacy"), b.shop.id).toBe(true);
    }
  });

  it("turns the goods' fronts away from the shelf's back, to the customers; no box of goods on the shelves", () => {
    const k = newFit(SHOP_BUILDS.find((b) => b.shop.trade === "electronics" && b.shop.state === "open")!.shop);
    const s = { u0: 1, u1: 3.2, v0: 2, v1: 2.5 };
    shelves(k, s, 2.0, "v1", 1);
    expect(k.pieces.filter((p) => p.kind === "goods")).toEqual([]);
    expect(k.detail.length).toBeGreaterThanOrEqual(3 * 4 - 3);
    const p = k.f.point(2, 2.25);
    const out = k.f.point(2, 1.25);
    for (const d of k.detail) {
      expect(key(d.variant)).toMatch(/^rd-gl-electronics(-b)?$/);
      expect(Math.sin(d.yaw) * (out.x - p.x) + Math.cos(d.yaw) * (out.z - p.z)).toBeCloseTo(1, 6);
    }
    const stock = newFit(k.shop);
    shelves(stock, s, 2.0, "v1", 80, true);
    expect(stock.detail.every((d) => key(d.variant).startsWith("rd-gl-stock"))).toBe(true);
    // Both the model and its mirror, so no two runs of a shelf need be the same.
    expect(new Set(k.detail.map((d) => key(d.variant))).size).toBe(2);
  });

  it("lays the trade's goods in the glass cases, hangs garments on the rails and dresses the windows' mannequins", () => {
    const floor = (b: (typeof builds)[number]) => b.detail.reduce((y, p) => Math.min(y, p.y), Infinity);
    let cases = 0;
    let rails = 0;
    let mannequins = 0;
    for (const b of builds) {
      const y0 = b.pieces.find((p) => p.kind === "counter")?.box.y0;
      for (const p of b.detail) {
        const k = key(p.variant);
        if (k.startsWith("rd-gl-case-") && y0 !== undefined) {
          cases++;
          expect(p.y - y0, b.shop.id).toBeCloseTo(0.58, 6);
        }
        if (k === "rd-gl-garments") {
          rails++;
          expect(b.shop.trade).toBe("clothing");
        }
        if (k === "rd-gl-mannequin") {
          mannequins++;
          expect(p.y).toBeCloseTo(floor(b), 6);
        }
      }
      if (b.shop.trade === "crypto" && b.layout?.islands.length) expect(b.detail.some((p) => key(p.variant) === "rd-gl-case-crypto"), b.shop.id).toBe(true);
    }
    expect(cases).toBeGreaterThan(50);
    expect(rails).toBeGreaterThan(10);
    expect(mannequins).toBeGreaterThan(2);
    // What is left of the goods as boxes: on the counters, the shallow shops' cabinets, the spills; never a garment, a case's or a shelf's.
    expect(builds.flatMap((b) => b.pieces).filter((p) => p.kind === "goods").length).toBeLessThan(600);
  });

  it("gives every goods' model a phone's of its own, and is two of the rooms' detail's views", () => {
    for (const s of ROOM_DETAIL_SHAPES.filter((x) => x.key.startsWith("rd-gl-"))) expect(s.lod).toBe(`${s.key.replace(/-b$/, "")}-lod`);
    expect(ROOM_DETAIL_SCENERY.map((s) => s.view)).toContainEqual({ kind: "street-props", items: GALLERY_DETAIL });
    expect(ROOM_DETAIL_SCENERY.map((s) => s.view)).toContainEqual({ kind: "street-props", items: FRONT_SHOP_DETAIL });
  });
});
