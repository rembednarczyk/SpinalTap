import { describe, expect, it } from "vitest";
import {
  ALCHEMIA_LIFT,
  ALCHEMIA_LIFT_NE,
  ALCHEMIA_PROPS,
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
import { prismsAt, type Prism } from "../src/world/prism";

/*
 * The gallery's shops on P1 and P2 (ADR-0093 O2), measured on the simulation's own solids: a ring
 * of units between the gallery and the glass, a quarter of them shut or empty, each open one with
 * its door on the gallery, its way from the door to the counter clear for an NPC (its raster's
 * clearance, `nav-raster.ts`), its seller behind the counter; the cores, the lifts' lobbies and the
 * escalators' landings still reached on every floor; nothing in the atrium or on the gallery.
 */

const L = MALL_LEVELS;
const FLOORS = { p1: L.p1, p2: L.p2 } as const;
type R = { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number };
const within = (r: R, x: number, z: number, pad = 0): boolean => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
const overlap = (a: R, b: R, pad = 0): boolean => a.x0 < b.x1 - pad && b.x0 < a.x1 - pad && a.z0 < b.z1 - pad && b.z0 < a.z1 - pad;

/** An NPC's body round a cell's middle on its raster (`nav-raster.ts`: 0.5 m cells, 0.48 m clearance). */
const CELL = 0.5;
const CLEARANCE = 0.48;
const prisms: readonly Prism[] = ALCHEMIA_PROPS.flatMap((p) => prismsAt(p.prisms ?? [], p.center));
/** The distance outside a prism along its farthest edge's normal (under the true distance at its corners: the stricter). */
const outside = (q: Prism, x: number, z: number): number => Math.max(...q.normals.map((n, i) => n.x * x + n.z * z - q.offsets[i]!));

/** Which cells of a floor an NPC stands in: on the gallery's body, off the atrium, clear of the solids from the knee to the head. */
const raster = (y: number) => {
  const nx = Math.round((MALL.x1 - MALL.x0) / CELL);
  const nz = Math.round((MALL.z1 - MALL.z0) / CELL);
  const free = new Array<boolean>(nx * nz).fill(true);
  const centre = (i: number, k: number) => ({ x: MALL.x0 + (i + 0.5) * CELL, z: MALL.z0 + (k + 0.5) * CELL });
  // The atrium is open but for the escalators' landings on this floor.
  const landings = ESCALATOR_LANDINGS.filter((l) => Math.abs(l.y - y) < 0.01);
  for (let i = 0; i < nx; i++)
    for (let k = 0; k < nz; k++) {
      const c = centre(i, k);
      if (within(ATRIUM, c.x, c.z) && !landings.some((l) => within(l, c.x, c.z))) free[i * nz + k] = false;
    }
  for (const q of prisms) {
    if (q.bottom > y + 1.7 || q.top < y + 0.3) continue;
    const [i0, i1] = [Math.max(0, Math.floor((q.box.min.x - CLEARANCE - MALL.x0) / CELL)), Math.min(nx - 1, Math.floor((q.box.max.x + CLEARANCE - MALL.x0) / CELL))];
    const [k0, k1] = [Math.max(0, Math.floor((q.box.min.z - CLEARANCE - MALL.z0) / CELL)), Math.min(nz - 1, Math.floor((q.box.max.z + CLEARANCE - MALL.z0) / CELL))];
    for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) if (outside(q, centre(i, k).x, centre(i, k).z) < CLEARANCE) free[i * nz + k] = false;
  }
  const cellOf = (x: number, z: number) => Math.floor((x - MALL.x0) / CELL) * nz + Math.floor((z - MALL.z0) / CELL);
  /** The cells reached from (x, z) through free cells, to their eight neighbours (a diagonal only past two free ones). */
  const reach = (x: number, z: number): Set<number> => {
    const seen = new Set<number>();
    const start = cellOf(x, z);
    if (!free[start]) return seen;
    const todo = [start];
    seen.add(start);
    while (todo.length > 0) {
      const c = todo.pop()!;
      const [i, k] = [Math.floor(c / nz), c % nz];
      for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        const [a, b] = [i + di, k + dk];
        if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
        const n = a * nz + b;
        if (seen.has(n) || !free[n]) continue;
        if (di !== 0 && dk !== 0 && (!free[a * nz + k] || !free[i * nz + b])) continue;
        seen.add(n);
        todo.push(n);
      }
    }
    return seen;
  };
  /** Is a free cell within `r` of (x, z) among `cells`? */
  const near = (cells: Set<number>, x: number, z: number, r = 0.5): boolean => {
    for (let dx = -r; dx <= r + 1e-9; dx += CELL / 2) for (let dz = -r; dz <= r + 1e-9; dz += CELL / 2) if (cells.has(cellOf(x + dx, z + dz))) return true;
    return false;
  };
  return { reach, near, free, cellOf };
};
const RASTERS = { p1: raster(L.p1), p2: raster(L.p2) };
/** From the gallery's south side by the escalators, on each floor. */
const REACHED = { p1: RASTERS.p1.reach(416.8, 38.5), p2: RASTERS.p2.reach(416.8, 38.5) };

describe("the gallery's shops on P1 and P2 (ADR-0093 O2)", () => {
  it("rings each floor with 8 to 12 units, about a quarter of them shut, barred or to let, every one of a trade and named but the empty ones", () => {
    for (const f of ["p1", "p2"] as const) {
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
      for (const r of [...SHOP_RING_WAYS[s.floor], shaft(ALCHEMIA_LIFT), shaft(ALCHEMIA_LIFT_NE), ...STAIR_CORES.map(core)]) expect(overlap(s.rect, r, 0.01), `${s.id} ${JSON.stringify(r)}`).toBe(false);
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
        const x = MALL.x0 + (Math.floor(c / Math.round((MALL.z1 - MALL.z0) / CELL)) + 0.5) * CELL;
        const z = MALL.z0 + ((c % Math.round((MALL.z1 - MALL.z0) / CELL)) + 0.5) * CELL;
        return within(q, x, z, -0.6);
      });
      expect(inside, b.shop.id).toEqual([]);
      expect(r).toBeDefined();
    }
  });

  it("stands a seller behind the counter of every open shop (the still crowd's figure), a customer before every other one's (the crowd's)", () => {
    const figures = SHOP_PROPS.filter((p) => p.prop === "figure");
    expect(WORLD_SCENERY.some((s) => s.view.kind === "street-props" && s.view.items === SHOP_PROPS)).toBe(true);
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
      const f = c.at.y < 0 ? "p1" : "p2";
      expect(RASTERS[f].near(REACHED[f], c.at.x, c.at.z, 0.3), `${c.at.x},${c.at.z}`).toBe(true);
    }
  });

  it("leaves a mark of somebody just gone in every shop one sees into (docs/zasady-lokacji.md §5)", () => {
    for (const b of SHOP_BUILDS.filter((x) => x.shop.state !== "shut")) expect(b.traces.length, b.shop.id).toBeGreaterThan(0);
  });

  it("keeps the cores' doors, both lifts' lobbies and the escalators' landings reached along the gallery on P1 and P2", () => {
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
  });
});
