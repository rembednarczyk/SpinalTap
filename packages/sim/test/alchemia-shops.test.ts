import { describe, expect, it } from "vitest";
import {
  ALCHEMIA_LIFT,
  ALCHEMIA_LIFT_NE,
  ATRIUM,
  ESCALATOR_LANDINGS,
  GALLERY,
  GALLERY_CROWD,
  MALL,
  MALL_LEVELS,
  NE_CORE,
  GALLERY_SHOPS as SHOPS,
  SHOP_BUILDS,
  SHOP_DOOR,
  SHOP_PROPS,
  SHOP_RING_WAYS,
  STAIR_CORES,
  SW_CORE,
  WORLD_SCENERY,
  galleryShopAt as shopAt,
  galleryShopOpen as shopOpen,
} from "../src";
import { interiorAt } from "../src/content/interior-areas";
import { PRISMS, type R, cellCentre, outside, overlap, raster, within } from "./alchemia-raster";

/*
 * The gallery's shops on P1 and P2 (ADR-0093 O2) and on P0 (O3), measured on the simulation's own solids: a ring
 * of units between the gallery and the glass, a quarter of them shut or empty, each open one with
 * its door on the gallery, its way from the door to the counter clear for an NPC (its raster's
 * clearance, `nav-raster.ts`), its seller behind the counter; the cores, the lifts' lobbies and the
 * escalators' landings still reached on every floor; nothing in the atrium or on the gallery.
 */

const L = MALL_LEVELS;
const FLOORS = { p0: L.p0, p1: L.p1, p2: L.p2 } as const;
const prisms = PRISMS;
/** P0's floor runs on under the atrium (its landmark there, O3); P1's and P2's are holed by it. */
const RASTERS = { p0: raster(L.p0, true), p1: raster(L.p1), p2: raster(L.p2) };
/** From the gallery's south side by the escalators on P1 and P2, from the way in's aisle on P0. */
const REACHED = { p0: RASTERS.p0.reach(416, 51.6), p1: RASTERS.p1.reach(416.8, 38.5), p2: RASTERS.p2.reach(416.8, 38.5) };
/** The floor nearest a height. */
const floorOf = (y: number): keyof typeof FLOORS => (Object.keys(FLOORS) as (keyof typeof FLOORS)[]).reduce((a, b) => (Math.abs(FLOORS[b] - y) < Math.abs(FLOORS[a] - y) ? b : a));

describe("the gallery's shops on P0, P1 and P2 (ADR-0093 O2, O3)", () => {
  it("rings each floor with 8 to 12 units, about a quarter of them shut, barred or to let, every one of a trade and named but the empty ones", () => {
    for (const f of ["p0", "p1", "p2"] as const) {
      const on = SHOPS.filter((s) => s.floor === f);
      expect(on.length).toBeGreaterThanOrEqual(8);
      expect(on.length).toBeLessThanOrEqual(12);
      const closed = on.filter((s) => !shopOpen(s)).length / on.length;
      expect(closed).toBeGreaterThanOrEqual(0.2);
      expect(closed).toBeLessThanOrEqual(0.34);
      for (const s of on) expect(s.state === "vacant" || /^[A-Z][A-Z ]+$/.test(s.sign), s.id).toBe(true);
    }
    expect(new Set(SHOPS.map((s) => s.trade)).size).toBeGreaterThanOrEqual(10);
  });

  it("keeps every unit and all of it between the gallery and the glass, off the atrium, the gallery, the cores, the lifts and the ways through the ring", () => {
    const shaft = (l: typeof ALCHEMIA_LIFT): R => ({ x0: l.centre.x - 1.2, x1: l.centre.x + 1.2, z0: l.centre.z - 1.2, z1: l.centre.z + 1.2 });
    const core = (c: typeof SW_CORE): R => ({ x0: c.x0 - 0.2, x1: c.x1 + 0.2, z0: c.z0 - 0.2, z1: c.z1 + 0.2 });
    for (const b of SHOP_BUILDS) {
      const s = b.shop;
      expect(overlap(s.rect, GALLERY, 0.01), s.id).toBe(false);
      // The cores where they stand: the south-west one from P1 (P0's way up is the hall's stairs), the north-east one from P0 (O3).
      const cores = STAIR_CORES.filter((c) => c.floors.includes(FLOORS[s.floor])).map(core);
      for (const r of [...SHOP_RING_WAYS[s.floor], shaft(ALCHEMIA_LIFT), shaft(ALCHEMIA_LIFT_NE), ...cores]) expect(overlap(s.rect, r, 0.01), `${s.id} ${JSON.stringify(r)}`).toBe(false);
      for (const o of SHOP_BUILDS) if (o !== b && o.shop.floor === s.floor) expect(overlap(s.rect, o.shop.rect, 0.01), `${s.id} ${o.shop.id}`).toBe(false);
      for (const p of [...b.pieces, ...b.solids]) {
        const q = p.box;
        expect(q.x0 >= s.rect.x0 - 0.01 && q.x1 <= s.rect.x1 + 0.01 && q.z0 >= s.rect.z0 - 0.01 && q.z1 <= s.rect.z1 + 0.01, `${s.id} ${p.kind} ${JSON.stringify(q)}`).toBe(true);
        expect(q.y0 >= FLOORS[s.floor] - 0.06 && q.y1 <= FLOORS[s.floor] + 4.21, `${s.id} ${p.kind}`).toBe(true);
      }
    }
  });

  it("opens every shop but a shut one onto the gallery through a door 1.5 m wide, its way from the door to the counter clear for an NPC", () => {
    for (const b of SHOP_BUILDS.filter((x) => shopOpen(x.shop))) {
      const r = RASTERS[b.shop.floor];
      expect(b.layout!.door.u1 - b.layout!.door.u0).toBeGreaterThanOrEqual(SHOP_DOOR);
      expect(r.near(REACHED[b.shop.floor], b.customer!.x, b.customer!.z, 0.3), `${b.shop.id} customer ${b.customer!.x.toFixed(1)},${b.customer!.z.toFixed(1)}`).toBe(true);
    }
  });

  it("shuts a shut, barred or empty unit to its customers: nobody gets in past its shutter, grille or locked door", () => {
    for (const b of SHOP_BUILDS.filter((x) => !shopOpen(x.shop))) {
      const r = RASTERS[b.shop.floor];
      const q = b.shop.rect;
      const inside = [...REACHED[b.shop.floor]].filter((c) => {
        const { x, z } = cellCentre(c);
        return within(q, x, z, -0.6);
      });
      expect(inside, b.shop.id).toEqual([]);
      expect(r).toBeDefined();
    }
  });

  it("stands a seller behind the counter of every open shop (the still crowd's figure), a customer before every other one's (the crowd's)", () => {
    const figures = SHOP_PROPS.filter((p) => p.prop === "figure");
    // Drawn in one street-props view with the food hall's models (O3).
    expect(WORLD_SCENERY.some((s) => s.view.kind === "street-props" && SHOP_PROPS.every((p) => s.view.kind === "street-props" && s.view.items.includes(p)))).toBe(true);
    for (const b of SHOP_BUILDS) {
      const mine = figures.filter((f) => within(b.shop.rect, f.x, f.z) && Math.abs(f.y - FLOORS[b.shop.floor]) < 1);
      expect(mine.length, b.shop.id).toBe(shopOpen(b.shop) ? 1 : 0);
      if (!shopOpen(b.shop)) continue;
      const f = mine[0]!;
      expect(Math.abs(f.y - FLOORS[b.shop.floor])).toBeLessThan(1e-6);
      // Clear of every solid by a body (a figure's 0.24 m), and not on the customers' side.
      expect(prisms.every((q) => q.bottom > f.y + 1.6 || q.top < f.y + 0.3 || outside(q, f.x, f.z) > 0.2), b.shop.id).toBe(true);
      expect(RASTERS[b.shop.floor].near(REACHED[b.shop.floor], f.x, f.z, 0)).toBe(false);
    }
    const customers = GALLERY_CROWD.filter((c) => shopAt(c.at.x, c.at.y, c.at.z));
    expect(customers.length).toBeGreaterThanOrEqual(5);
    for (const c of GALLERY_CROWD) {
      const f = floorOf(c.at.y);
      // A sitter on a bench by P0's fountain sits on its solid: in reach of a free cell.
      expect(RASTERS[f].near(REACHED[f], c.at.x, c.at.z, c.does.includes("sit") ? 1.0 : 0.3), `${c.at.x},${c.at.z}`).toBe(true);
    }
  });

  it("leaves a mark of somebody just gone in every shop one sees into (docs/zasady-lokacji.md §5)", () => {
    for (const b of SHOP_BUILDS.filter((x) => x.shop.state !== "shut")) expect(b.traces.length, b.shop.id).toBeGreaterThan(0);
  });

  it("keeps the cores' doors, both lifts' lobbies and the escalators' landings reached along the gallery on P1 and P2, and P0's doors, lifts, escalators and stairs", () => {
    for (const f of ["p1", "p2"] as const) {
      const r = RASTERS[f];
      const y = FLOORS[f];
      const goals: [string, number, number][] = [
        ["south-west core", (SW_CORE.door.a0 + SW_CORE.door.a1) / 2, SW_CORE.z1 + 1.2],
        ["north-east core", NE_CORE.x0 - 1.2, (NE_CORE.door.a0 + NE_CORE.door.a1) / 2],
        ["north-east lift", ALCHEMIA_LIFT_NE.centre.x, ALCHEMIA_LIFT_NE.centre.z - 2.2],
        ["west gallery", 409.5, 50],
        ["east gallery", 426.5, 50],
        ...ESCALATOR_LANDINGS.filter((l) => Math.abs(l.y - y) < 0.01).map((l): [string, number, number] => ["landing", (l.x0 + l.x1) / 2, ATRIUM.z0 + 0.75]),
      ];
      if (f === "p2") goals.push(["hall's lift", ALCHEMIA_LIFT.centre.x, ALCHEMIA_LIFT.centre.z + 2.2]);
      if (f === "p1") goals.push(["east door", MALL.x1 - 1.4, 33.15], ["main doors", 420, MALL.z0 + 1.0]);
      for (const [name, x, z] of goals) expect(r.near(REACHED[f], x, z), `${f} ${name}`).toBe(true);
    }
    // P0 (O3): the way in from T1 and the east door, the north-east core's door, both lifts' doors, the escalators' foot, the stairs' foot by the door onto P-1.
    const p0: [string, number, number][] = [
      ["way in", 416, MALL.z1 - 1.4],
      ["east door", 426.35, MALL.z1 - 1.4],
      ["north-east core", NE_CORE.x0 - 1.2, (NE_CORE.door.a0 + NE_CORE.door.a1) / 2],
      ["north-east lift", ALCHEMIA_LIFT_NE.centre.x, ALCHEMIA_LIFT_NE.centre.z - 2.2],
      ["hall's lift", ALCHEMIA_LIFT.centre.x, ALCHEMIA_LIFT.centre.z + 2.2],
      ["escalators' foot", 425.0, 40.75],
      ["stairs' foot", 410.8, 33.6],
    ];
    for (const [name, x, z] of p0) expect(RASTERS.p0.near(REACHED.p0, x, z), `p0 ${name}`).toBe(true);
  });

  it("names the gallery in the HUD on P0..P2 (ADR-0061; P0 since O3), the food hall on P3 over it and nothing on its roof", () => {
    for (const b of SHOP_BUILDS.filter((x) => x.customer)) expect(interiorAt(b.customer!)?.id, b.shop.id).toBe("alchemia-gallery");
    expect(interiorAt({ x: 418, y: L.p0, z: 51 })?.id).toBe("alchemia-gallery");
    expect(interiorAt({ x: 426.5, y: L.p3, z: 46 })?.id).toBe("alchemia-foodhall");
    expect(interiorAt({ x: 418, y: L.roof, z: 52 })).toBeNull();
  });

  it("builds P0's partitions 0.2 m thick, as a room's wall, where the player aims by them (G-275); P1's and P2's as O2 left them", () => {
    for (const b of SHOP_BUILDS) {
      // Its side partitions, each a metre long at least (a door's jamb or lintel aside).
      const sides = b.pieces.filter((p) => p.kind === "partition" && Math.max(p.box.x1 - p.box.x0, p.box.z1 - p.box.z0) > 1 && p.box.y1 - p.box.y0 > 2.5);
      const thin = sides.map((p) => Math.min(p.box.x1 - p.box.x0, p.box.z1 - p.box.z0));
      expect(Math.min(...thin), b.shop.id).toBeCloseTo(b.shop.floor === "p0" ? 0.2 : 0.15, 6);
    }
  });
});
