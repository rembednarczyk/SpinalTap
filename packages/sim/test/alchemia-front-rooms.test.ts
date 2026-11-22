import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type Vec3 } from "@seki/core";
import {
  ALCHEMIA_PIECES,
  EAST_WING,
  FRONT_CROWD,
  FRONT_FLOORS,
  FRONT_GLASS,
  FRONT_STEPS_FOOTPRINTS,
  FRONT_ROOM_MODELS,
  FRONT_SHOP_BUILDS,
  FRONT_TREES,
  GALLERY_FRONT_DOOR,
  L1E_DOOR,
  L1_DOORS,
  L2_SLABS,
  L3,
  L3_DOORS,
  L3_ROOF_WAY,
  MALL_LEVELS,
  PLAZA_TOP,
  SHOP_BUILDS,
  STEP_GOING,
  Simulation,
  WEST_WING,
  WORLD_NAV,
  WORLD_SCENERY,
  galleryShopFrame,
  galleryShopOpen as shopOpen,
  groundY,
  interiorAt,
  ROOM_DETAILS,
} from "../src";
import { routeAcrossLevels } from "../src/world/nav";
import { PRISMS, outside } from "./alchemia-raster";
import { teleportPlayer } from "./helpers";

/*
 * The front's storeys as rooms of the gallery's arcade (ADR-0093 O5), measured on the simulation's own
 * solids and level graph: floors under the rooms, the glass a wall with doors, every unit reached from
 * the gallery and the gallery from every unit, the terraces from the rooms, the routes from T1, T0 and
 * P-1, nobody through the glass.
 */

const F = FRONT_FLOORS;
const L = MALL_LEVELS;
type R = { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number };
const inPrism = (q: (typeof PRISMS)[number], x: number, z: number): boolean => outside(q, x, z) <= 0;
/** The highest solid top at (x, z) within `reach` under `y`. */
const topUnder = (x: number, y: number, z: number, reach = 0.3): number | null => {
  let best: number | null = null;
  for (const q of PRISMS) if (q.top <= y + 1e-6 && q.top >= y - reach && inPrism(q, x, z)) best = Math.max(best ?? -Infinity, q.top);
  return best;
};

/**
 * A floor at `y` over `b` as an NPC's raster sees it (`alchemia-raster.ts`'s, over any bounds): a cell is
 * free with a solid top within a step under its middle (a floor, a slab, a terrace) and nothing from the
 * knee to the head within a body's clearance.
 */
const CELL = 0.5;
const CLEAR = 0.48;
const floorRaster = (b: R, y: number) => {
  const nx = Math.round((b.x1 - b.x0) / CELL);
  const nz = Math.round((b.z1 - b.z0) / CELL);
  const centre = (i: number, k: number) => ({ x: b.x0 + (i + 0.5) * CELL, z: b.z0 + (k + 0.5) * CELL });
  const floors = PRISMS.filter((q) => q.top >= y - 0.2 && q.top <= y + 0.05 && q.box.max.x > b.x0 && q.box.min.x < b.x1 && q.box.max.z > b.z0 && q.box.min.z < b.z1);
  const free = new Array<boolean>(nx * nz).fill(false);
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) free[i * nz + k] = floors.some((q) => inPrism(q, centre(i, k).x, centre(i, k).z));
  for (const q of PRISMS) {
    if (q.bottom > y + 1.7 || q.top < y + 0.3) continue;
    const [i0, i1] = [Math.max(0, Math.floor((q.box.min.x - CLEAR - b.x0) / CELL)), Math.min(nx - 1, Math.floor((q.box.max.x + CLEAR - b.x0) / CELL))];
    const [k0, k1] = [Math.max(0, Math.floor((q.box.min.z - CLEAR - b.z0) / CELL)), Math.min(nz - 1, Math.floor((q.box.max.z + CLEAR - b.z0) / CELL))];
    for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) if (outside(q, centre(i, k).x, centre(i, k).z) < CLEAR) free[i * nz + k] = false;
  }
  const cellOf = (x: number, z: number) => (x < b.x0 || x >= b.x1 || z < b.z0 || z >= b.z1 ? -1 : Math.floor((x - b.x0) / CELL) * nz + Math.floor((z - b.z0) / CELL));
  const reach = (x: number, z: number): Set<number> => {
    const seen = new Set<number>();
    const start = cellOf(x, z);
    if (start < 0 || !free[start]) return seen;
    const todo = [start];
    seen.add(start);
    while (todo.length > 0) {
      const c = todo.pop()!;
      const [i, k] = [Math.floor(c / nz), c % nz];
      for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        const [a, d] = [i + di, k + dk];
        if (a < 0 || d < 0 || a >= nx || d >= nz) continue;
        const n = a * nz + d;
        if (seen.has(n) || !free[n]) continue;
        if (di !== 0 && dk !== 0 && (!free[a * nz + k] || !free[i * nz + d])) continue;
        seen.add(n);
        todo.push(n);
      }
    }
    return seen;
  };
  const near = (cells: Set<number>, x: number, z: number, r = 0.5): boolean => {
    for (let dx = -r; dx <= r + 1e-9; dx += CELL / 2) for (let dz = -r; dz <= r + 1e-9; dz += CELL / 2) if (cells.has(cellOf(x + dx, z + dz))) return true;
    return false;
  };
  return { reach, near };
};

/** L2 with the gallery's P2 north of it, from the gallery's south side by the escalators; L3 with P3 and L2's terraces, from P3's. */
const L2_AREA: R = { x0: 393.5, x1: 436.5, z0: 3.5, z1: 40 };
const L3_AREA: R = { x0: 393.5, x1: 436.5, z0: -2.5, z1: 40 };
const R2 = floorRaster(L2_AREA, L.p2);
const R3 = floorRaster(L3_AREA, L.p3);
const REACHED2 = R2.reach(416.8, 38.5);
const REACHED3 = R3.reach(416.8, 38.5);

/** The units of the front, the gallery's TOKYO DRIP among them. */
const UNITS = [...FRONT_SHOP_BUILDS, ...SHOP_BUILDS.filter((b) => b.shop.floor === "l2")];

/** The world with Alchemia's chunk loaded, nobody in it but the player. */
const loaded = (() => {
  let sim: Simulation | null = null;
  return (): Simulation => {
    if (sim) return sim;
    sim = Simulation.create({ seed: 5 });
    teleportPlayer(sim, { x: 418, y: groundY(418, 28) + 0.05, z: 28 });
    sim.step();
    for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
    return sim;
  };
})();

describe("the front's storeys as rooms of the gallery's arcade (ADR-0093 O5)", () => {
  it("floors every storey level under its rooms: L1's over the slope, L2 on the gallery's P2, L3 on its P3", () => {
    expect(F.l2).toBe(L.p2);
    expect(F.l3).toBe(L.p3);
    const probes: [string, number, number, number][] = [
      ["L1 west, by the arcade", 397, 5, F.l1],
      ["L1 west, north", 398, 24, F.l1],
      ["L1 east", 431, 18, F.l1e],
      ["L2 café", 405, 7, F.l2],
      ["L2 cross", 430, 19.6, F.l2],
      ["L3 by the south glass", 401, 13.6, F.l3],
      // Where L3 overhangs L2's slab (x 422-428, z 12-13.5): its own piece of floor.
      ["L3 over the overhang", 424, 12.8, F.l3],
    ];
    for (const [name, x, z, y] of probes) expect(topUnder(x, y + 0.01, z), name).toBeCloseTo(y, 2);
    // L1's floors over the terrain under them (not under it), a few steps up from the ground at their doors.
    for (const [r, y] of [...WEST_WING.map((w) => [w, F.l1] as const), [EAST_WING, F.l1e] as const]) {
      for (let x = r.minX + 0.3; x < r.maxX; x += 1) for (let z = r.minZ + 0.3; z < r.maxZ; z += 1) expect(groundY(x, z), `${x},${z}`).toBeLessThan(y - 0.05);
    }
  });

  it("walls every storey with glass as deep as the gallery's, its frame drawn, the gallery's glass its wall towards it", () => {
    const panes = ALCHEMIA_PIECES.filter((p) => p.kind === "pane" && p.outline && p.box.z1 < 32.01 && p.box.y1 - p.box.y0 > 1);
    expect(panes.length).toBeGreaterThan(60);
    for (const p of panes) {
      expect(p.solid).toBe(true);
      // A quad whose first edge is its outer face, the glass's depth inwards.
      const [a, b, c] = [p.outline![0]!, p.outline![1]!, p.outline![2]!];
      expect(Math.hypot(c.x - b.x, c.z - b.z), `${a.x},${a.z}`).toBeCloseTo(FRONT_GLASS, 3);
    }
    // No solid box of glass is left: nothing of the front's storeys is a glass block a body stands in.
    expect(ALCHEMIA_PIECES.filter((p) => p.kind === "glass" && p.outline)).toEqual([]);
  });

  it("opens the gallery's south glass into L2 on P2 and L3 on P3 through doors 4 m wide, and every unit of theirs is reached from the gallery", () => {
    expect(GALLERY_FRONT_DOOR.x1 - GALLERY_FRONT_DOOR.x0).toBeGreaterThanOrEqual(1.5);
    // Through the doors into the spine's and the hall's middle.
    expect(R2.near(REACHED2, 419.2, 30.5), "L2's spine").toBe(true);
    expect(R2.near(REACHED2, 400, 19.6), "L2's cross, west").toBe(true);
    expect(R2.near(REACHED2, 432, 19.6), "L2's cross, east").toBe(true);
    expect(R2.near(REACHED2, 410, 7.2), "the café").toBe(true);
    expect(R3.near(REACHED3, 419.2, 24), "L3's hall").toBe(true);
    for (const b of UNITS.filter((u) => u.shop.floor === "l2" || u.shop.floor === "l3")) {
      const r = b.shop.floor === "l2" ? { R: R2, reached: REACHED2 } : { R: R3, reached: REACHED3 };
      if (shopOpen(b.shop)) expect(r.R.near(r.reached, b.customer!.x, b.customer!.z, 0.3), `${b.shop.id} customer`).toBe(true);
      else {
        const q = b.shop.rect;
        // Nobody past its shutter, grille or papered glass.
        expect(r.R.near(r.reached, (q.x0 + q.x1) / 2, (q.z0 + q.z1) / 2, 0.5), b.shop.id).toBe(false);
      }
    }
  });

  it("walks out of L3 onto L2's terraces by its doors, and from the gallery's green roof onto L3's", () => {
    // L2's south terrace through L3's south door, its east one through the east door; the house with arcades' roof stays behind
    // L2's hedge (its balustrade drawn only: solid, it hid St Joseph's top from two more eyes of the street).
    expect(R3.near(REACHED3, (L3_DOORS.south.x0 + L3_DOORS.south.x1) / 2, 8, 0.5), "south terrace").toBe(true);
    expect(R3.near(REACHED3, 400, 0.5, 0.5), "the house with arcades' roof").toBe(false);
    expect(R3.near(REACHED3, 432, 24, 0.5), "east terrace").toBe(true);
    // The terraces railed: none of the raster's cells off L2's slabs.
    const onL2 = (x: number, z: number) => L2_SLABS.some((r) => x > r.minX - 0.35 && x < r.maxX + 0.35 && z > r.minZ - 0.35 && z < r.maxZ + 0.35) || (x > 393.9 && x < 409.1 && z > -2.1 && z < 4);
    for (const [x, z] of [[392.5, 10], [415, 2.8], [437.2, 24], [425, 12.5]] as const) expect(onL2(x, z) && R3.near(REACHED3, x, z, 0), `${x},${z}`).toBe(false);
    // L3's roof from the gallery's roof through the gap in its balustrade.
    const roof = floorRaster({ x0: 396, x1: 436.5, z0: 10, z1: 40 }, L.roof);
    const fromRoof = roof.reach(426.5, 38.5);
    expect(roof.near(fromRoof, (L3_ROOF_WAY.x0 + L3_ROOF_WAY.x1) / 2, 31.2), "the way onto L3's roof").toBe(true);
    expect(roof.near(fromRoof, 414, 20), "L3's roof among its tables").toBe(true);
    // Its trees and planters stand on the terraces off the doors' ways.
    for (const t of FRONT_TREES) expect(topUnder(t.x + 0.7, t.y + 0.01, t.z), `${t.x},${t.z}`).toBeCloseTo(t.y, 2);
  });

  it("leads from T1, T0 and P-1 to every storey, its terraces and L3's roof; and back from every open unit", () => {
    const sim = loaded();
    const starts: [string, Vec3][] = [
      ["T1", { x: 416, y: groundY(416, 62), z: 62 }],
      ["T0", { x: 420, y: groundY(420, 30.6), z: 30.6 }],
      ["P-1", { x: 409, y: L.p0, z: 27 }],
    ];
    const goals: [string, Vec3][] = [
      ["L1 west", { x: 402, y: F.l1, z: 18 }],
      ["L2 cross", { x: 410, y: F.l2, z: 19.6 }],
      ["L2 café", { x: 404, y: F.l2, z: 7.2 }],
      ["L3 hall", { x: 418, y: F.l3, z: 20 }],
      ["L2 south terrace", { x: 412, y: F.l3, z: 8 }],
      ["L2 east terrace", { x: 432, y: F.l3, z: 24 }],
      ["L3 roof", { x: 414, y: L.roof, z: 22 }],
    ];
    for (const [a, from] of starts) for (const [b, to] of goals) expect(routeAcrossLevels(sim.world, WORLD_NAV, from, to), `${a} to ${b}`).not.toBeNull();
    // From before each open unit's door to the gallery's south side on P1 (the main doors' way), up or down, and back (inside
    // a unit one walks to its counter on one's own level: the rasters above, and L1's below).
    const gallery = { x: 416.8, y: L.p1, z: 38.5 };
    for (const b of UNITS.filter((u) => shopOpen(u.shop))) {
      const f = galleryShopFrame(b.shop);
      const d = b.layout!.door;
      // A street unit's door opens on the arcade's podium (NIGHT SILK: from the square before its arches) or the walk (KONBINI), the
      // others' on their storey's arcade.
      const out = f.point((d.u0 + d.u1) / 2, b.shop.street && b.shop.floor === "l1" ? -3.6 : -0.9);
      const y = !b.shop.street ? b.customer!.y : b.shop.floor === "l1" ? PLAZA_TOP : groundY(out.x, out.z);
      const before = { ...out, y };
      expect(routeAcrossLevels(sim.world, WORLD_NAV, before, gallery), `${b.shop.id} out`).not.toBeNull();
      expect(routeAcrossLevels(sim.world, WORLD_NAV, gallery, before), `${b.shop.id} in`).not.toBeNull();
    }
  });

  it("puts the street units' doors in the storey's glass where their shop doors are: NIGHT SILK on the arcade, KONBINI on the walk", () => {
    for (const [id, door] of [["l1-1", L1_DOORS.shop], ["l1e-1", null]] as const) {
      const b = FRONT_SHOP_BUILDS.find((q) => q.shop.id === id)!;
      expect(b.shop.street, id).toBe(true);
      const f = galleryShopFrame(b.shop);
      const [p, q] = [f.point(b.layout!.door.u0, 0), f.point(b.layout!.door.u1, 0)];
      if (door) expect([Math.min(p.x, q.x), Math.max(p.x, q.x)], id).toEqual([expect.closeTo(door.x0, 2), expect.closeTo(door.x1, 2)]);
      else expect([Math.min(p.z, q.z), Math.max(p.z, q.z)], id).toEqual([expect.closeTo(L1E_DOOR.z0, 2), expect.closeTo(L1E_DOOR.z1, 2)]);
    }
  });

  it("steps up and down at L1's doors by the rules: risers 0.15-0.18 m, treads 0.29 m", () => {
    const flightsAt = [
      ...FRONT_STEPS_FOOTPRINTS.map((r) => ({ x0: r.minX, x1: r.maxX, z0: r.minZ, z1: r.maxZ })),
      ...[L1_DOORS.arcade, L1_DOORS.shop].map((d) => ({ x0: d.x0, x1: d.x1, z0: 1.29, z1: 2.1 })),
    ];
    const steps = ALCHEMIA_PIECES.filter((p) => p.kind === "step" && flightsAt.some((r) => p.box.x0 >= r.x0 - 0.01 && p.box.x1 <= r.x1 + 0.01 && p.box.z0 >= r.z0 - 0.01 && p.box.z1 <= r.z1 + 0.01));
    expect(steps.length).toBeGreaterThanOrEqual(10);
    for (const p of steps) expect(Math.min(p.box.x1 - p.box.x0, p.box.z1 - p.box.z0), `${p.box.x0},${p.box.z0}`).toBeCloseTo(STEP_GOING, 2);
    // Between a door's floor and the ground at its foot, every riser within the rules.
    const flights: [string, number, number, number][] = [
      ["west wing, east door", F.l1, groundY(404.9, (L1_DOORS.east.z0 + L1_DOORS.east.z1) / 2), 1],
      ["west wing, north door", F.l1, groundY((L1_DOORS.north.x0 + L1_DOORS.north.x1) / 2, 29.6), 1],
      ["east wing", F.l1e, groundY(436.6, (L1E_DOOR.z0 + L1E_DOOR.z1) / 2), 1],
    ];
    for (const [name, top, ground] of flights) {
      const n = Math.round((top - ground) / 0.17);
      expect((top - ground) / n, name).toBeGreaterThanOrEqual(0.145);
      expect((top - ground) / n, name).toBeLessThanOrEqual(0.18);
    }
  });

  it("keeps the player in: from L2's spine into its glass over the square; walks her through L1's arcade and out of L3 by its doors", () => {
    const sim = Simulation.create({ seed: 3 });
    const walk = (x: number, z: number, steps = 300) => {
      for (let i = 0; i < steps; i++) {
        const p = sim.player()!;
        if (Math.hypot(x - p.position.x, z - p.position.z) < 0.3) return;
        const want = Math.atan2(x - p.position.x, z - p.position.z);
        sim.step({ ...EMPTY_INPUT, moveZ: 1, sprint: true, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) });
      }
    };
    const at = () => sim.player()!.position;
    // From the spine's south end south into the glass over the square: stopped by it, on L2's floor.
    teleportPlayer(sim, { x: 417.4, y: F.l2, z: 7 }, Math.PI);
    sim.step();
    walk(417.4, 2, 120);
    expect(at().z).toBeGreaterThan(L2_SLABS[0]!.minZ + FRONT_GLASS);
    expect(at().z).toBeLessThan(L2_SLABS[0]!.minZ + 0.7);
    expect(at().y).toBeCloseTo(F.l2, 1);
    // Into NIGHT SILK from the arcade under the house with arcades, down its steps to its counter.
    const silk = FRONT_SHOP_BUILDS.find((q) => q.shop.id === "l1-1")!;
    teleportPlayer(sim, { x: (L1_DOORS.shop.x0 + L1_DOORS.shop.x1) / 2, y: PLAZA_TOP, z: -0.6 }, 0);
    sim.step();
    walk((L1_DOORS.shop.x0 + L1_DOORS.shop.x1) / 2, 3.2);
    walk(silk.customer!.x, silk.customer!.z);
    expect(Math.hypot(at().x - silk.customer!.x, at().z - silk.customer!.z)).toBeLessThan(0.5);
    expect(at().y).toBeCloseTo(F.l1, 1);
    // In from the arcade under the house with arcades, down its steps, on along L1's arcade and out by its north door down to T0.
    teleportPlayer(sim, { x: 401.3, y: PLAZA_TOP, z: -0.6 }, 0);
    sim.step();
    walk(401.3, 4);
    expect(at().y).toBeCloseTo(F.l1, 1);
    walk(401.3, 26);
    walk(401.3, 30.5);
    expect(at().z).toBeGreaterThan(30);
    expect(at().y).toBeLessThan(F.l1 - 0.8);
    // From L3's hall down the aisle and out by the south door onto the terrace, on its level.
    teleportPlayer(sim, { x: 410.2, y: F.l3, z: 22 }, Math.PI);
    sim.step();
    walk(410.2, 13.2);
    walk(410.2, 9.5);
    expect(at().z).toBeLessThan(L3.minZ - 1);
    expect(at().y).toBeCloseTo(F.l3, 1);
  });

  it("dresses the units by O2's pattern: a quarter shut, a seller in every open one, a trace of somebody just gone in each one sees into", () => {
    expect(UNITS.length).toBeGreaterThanOrEqual(15);
    const closed = UNITS.filter((b) => !shopOpen(b.shop)).length / UNITS.length;
    expect(closed).toBeGreaterThanOrEqual(0.2);
    expect(closed).toBeLessThanOrEqual(0.34);
    const sellers = FRONT_ROOM_MODELS.filter((p) => p.prop === "figure");
    for (const b of UNITS) {
      const mine = sellers.filter((f) => f.x > b.shop.rect.x0 && f.x < b.shop.rect.x1 && f.z > b.shop.rect.z0 && f.z < b.shop.rect.z1 && Math.abs(f.y - FRONT_FLOORS[b.shop.floor as keyof typeof FRONT_FLOORS]) < 1);
      expect(mine.length, b.shop.id).toBe(shopOpen(b.shop) ? 1 : 0);
      if (b.shop.state !== "shut") expect(b.traces.length, b.shop.id).toBeGreaterThan(0);
    }
    // The models in the last view of the scenery.
    expect(WORLD_SCENERY.at(-1)!.view).toEqual({ kind: "street-props", items: FRONT_ROOM_MODELS });
  });

  it("names the storeys the gallery in the HUD and puts their still crowd on their floors, in reach", () => {
    for (const [x, y, z] of [[402, F.l1, 18], [431, F.l1e, 18], [410, F.l2, 19.6], [418, F.l3, 20]] as const) expect(interiorAt({ x, y, z })?.id, `${x},${z}`).toBe("alchemia-gallery");
    expect(interiorAt({ x: 412, y: F.l3, z: 8 })).toBeNull();
    expect(FRONT_CROWD.length).toBeGreaterThanOrEqual(20);
    for (const c of FRONT_CROWD) {
      expect([F.l1, F.l1e, F.l2, F.l3].some((y) => Math.abs(c.at.y - y) < 1e-6), `${c.at.x},${c.at.z}`).toBe(true);
      if (c.at.y === F.l2) expect(R2.near(REACHED2, c.at.x, c.at.z, c.does.includes("sit") ? 1.0 : 0.5), `${c.at.x},${c.at.z}`).toBe(true);
      if (c.at.y === F.l3) expect(R3.near(REACHED3, c.at.x, c.at.z, c.does.includes("sit") ? 1.0 : 0.5), `${c.at.x},${c.at.z}`).toBe(true);
    }
  });
});
