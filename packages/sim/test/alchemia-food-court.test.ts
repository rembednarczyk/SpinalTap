import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import {
  ALCHEMIA_CHUNK,
  ALCHEMIA_LIFT,
  ALCHEMIA_LIFT_NE,
  ALCHEMIA_PIECES,
  ALCHEMIA_UNITS,
  ATRIUM,
  ESCALATORS,
  FOODHALL,
  FOUNTAIN_P0,
  FUMIKO_WINDOW,
  FUMIKO_WINDOW_SPOT,
  GALLERY,
  MALL_FLOORS,
  MALL_LEVELS,
  NE_CORE,
  NE_LIFT_SHAFT,
  SCHEDULES,
  STALL_KEEPERS,
  STAIR_CORES,
  SW_CORE,
  Simulation,
  beforeHatch,
  beforeKeeper,
  gangerEntity,
  groundY,
  interiorAt,
  kitchenPieces,
  opening,
  scheduledPose,
} from "../src";
import { FOODHALL_CROWD } from "../src/content/alchemia/crowd";
import { FOODHALL_FLOOR } from "../src/content/alchemia/units";
import { EYE_HEIGHT, lineOfSight } from "../src/world/hitscan";
import { PRISMS, type R, cellCentre, overlap, raster, within } from "./alchemia-raster";
import { teleportPlayer } from "./helpers";

/*
 * The food hall on the gallery's P3 (ADR-0093 O3), measured on the simulation's own solids: the
 * pattern of the mall's food court on its top floor, round the atrium. Its twelve units moved up from
 * the hall's floor with their counters, keepers and crowd, their ids and keys as they were; Fumiko's
 * second place with the hatch onto T1 stayed on P0, her daily walk between them; the north-east core
 * and its lift down to P0 where Oyaji's shop was; P0's fountain in the atrium off every way.
 */

const L = MALL_LEVELS;
const P3 = raster(L.p3);
/** From the gallery's south side by the escalators' landing. */
const REACHED = P3.reach(416.8, 38.5);
const P0 = raster(L.p0, true);
const REACHED_P0 = P0.reach(416, 51.6);
const rect = (q: { minX: number; maxX: number; minZ: number; maxZ: number }): R => ({ x0: q.minX, x1: q.maxX, z0: q.minZ, z1: q.maxZ });
const KEYS = Object.keys(STALL_KEEPERS) as (keyof typeof STALL_KEEPERS)[];

describe("the food hall on P3 (ADR-0093 O3)", () => {
  it("rings the atrium with the twelve units of the hall, their ids and keepers as they were, all of them between the gallery and the glass", () => {
    expect(ALCHEMIA_UNITS.map((u) => u.id).sort()).toEqual(["burger", "cafe", "fumiko", "georgian", "goro", "greek", "kenta", "korean", "oyaji", "sachiko", "thai", "wok"]);
    expect(ALCHEMIA_UNITS.filter((u) => u.keeper).map((u) => u.keeper).sort()).toEqual(["fumiko", "goro", "kenta", "oyaji", "sachiko"]);
    const shaft = (l: typeof ALCHEMIA_LIFT): R => ({ x0: l.centre.x - 1.2, x1: l.centre.x + 1.2, z0: l.centre.z - 1.2, z1: l.centre.z + 1.2 });
    const core = (c: typeof SW_CORE): R => ({ x0: c.x0 - 0.2, x1: c.x1 + 0.2, z0: c.z0 - 0.2, z1: c.z1 + 0.2 });
    // The cores' corridors and both lifts' lobbies stay clear, as on the shops' floors.
    const ways: R[] = [
      { x0: 400.2, x1: 408, z0: 37.9, z1: 39.8 },
      { x0: 425, x1: 427.5, z0: 53, z1: 57.8 },
      { x0: 428, x1: 435.8, z0: 49.4, z1: 51.9 },
      { x0: 412.2, x1: 414.8, z0: 34.8, z1: 37 },
    ];
    for (const u of ALCHEMIA_UNITS) {
      const q = rect(u.rect);
      expect(q.x0 >= 400.2 - 1e-6 && q.x1 <= 435.8 + 1e-6 && q.z0 >= 32.2 - 1e-6 && q.z1 <= 57.8 + 1e-6, u.id).toBe(true);
      for (const r of [GALLERY, ...ways, shaft(ALCHEMIA_LIFT), shaft(ALCHEMIA_LIFT_NE), ...STAIR_CORES.map(core)]) expect(overlap(q, r, 0.01), `${u.id} ${JSON.stringify(r)}`).toBe(false);
      for (const o of ALCHEMIA_UNITS) if (o !== u) expect(overlap(q, rect(o.rect), 0.01), `${u.id} ${o.id}`).toBe(false);
    }
    for (const k of KEYS) {
      const p = STALL_KEEPERS[k];
      const u = ALCHEMIA_UNITS.find((x) => x.keeper === k)!;
      expect(within(rect(u.rect), p.x, p.z), k).toBe(true);
      expect(p.y).toBe(L.p3);
    }
  });

  it("counts as the food hall in the HUD (ADR-0061) on P3, the gallery under it", () => {
    for (const k of KEYS) expect(interiorAt(beforeKeeper(k))?.id, k).toBe("alchemia-foodhall");
    expect(interiorAt({ x: 416.8, y: L.p3, z: 38.5 })?.id).toBe("alchemia-foodhall");
    expect(interiorAt({ x: 416.8, y: L.p2, z: 38.5 })?.id).toBe("alchemia-gallery");
  });

  it("brings every customer to a counter from the escalators' landing; the keepers behind theirs but Fumiko by her flap; nobody past a shutter", () => {
    for (const k of KEYS) expect(P3.near(REACHED, beforeKeeper(k).x, beforeKeeper(k).z, 0.3), `before ${k}`).toBe(true);
    for (const k of KEYS.filter((x) => x !== "fumiko")) expect(P3.near(REACHED, STALL_KEEPERS[k].x, STALL_KEEPERS[k].z, 0), `behind ${k}`).toBe(false);
    expect(P3.near(REACHED, STALL_KEEPERS.fumiko.x, STALL_KEEPERS.fumiko.z, 0.3)).toBe(true);
    for (const u of ALCHEMIA_UNITS.filter((x) => x.shut)) {
      const inside = [...REACHED].filter((c) => within(rect(u.rect), cellCentre(c).x, cellCentre(c).z, -0.6));
      expect(inside, u.id).toEqual([]);
    }
    // The still crowd at the counters and on the benches and stools, in reach (a sitter on its seat's solid).
    for (const c of FOODHALL_CROWD) {
      expect(c.at.y).toBe(L.p3);
      expect(P3.near(REACHED, c.at.x, c.at.z, c.does.includes("sit") ? 1.0 : 0.3), `${c.at.x},${c.at.z}`).toBe(true);
    }
  });

  it("keeps the escalators' landing, the cores' doors and both lifts' doors reached, the gallery round the atrium open", () => {
    const goals: [string, number, number][] = [
      ["landing", 416.6, 40.75],
      ["south-west core", (SW_CORE.door.a0 + SW_CORE.door.a1) / 2, SW_CORE.z1 + 1.2],
      ["north-east core", NE_CORE.x0 - 1.2, (NE_CORE.door.a0 + NE_CORE.door.a1) / 2],
      ["north-east lift", ALCHEMIA_LIFT_NE.centre.x, ALCHEMIA_LIFT_NE.centre.z - 2.2],
      ["hall's lift", ALCHEMIA_LIFT.centre.x, ALCHEMIA_LIFT.centre.z + 2.2],
      ["west gallery", 409.5, 50],
      ["east gallery", 426.5, 50],
      ["north gallery", 418, 51.5],
    ];
    for (const [name, x, z] of goals) expect(P3.near(REACHED, x, z), name).toBe(true);
  });

  it("builds every unit's walls 0.2 m thick, as a room's wall, where the player aims by them (G-275)", () => {
    const walls = ALCHEMIA_PIECES.filter((p) => p.kind === "partition" && Math.abs(p.box.y0 - (L.p3 - 0.05)) < 1e-6 && p.box.y1 - p.box.y0 > 2);
    expect(walls.length).toBeGreaterThan(15);
    for (const p of walls) expect(Math.min(p.box.x1 - p.box.x0, p.box.z1 - p.box.z0)).toBeCloseTo(0.2, 6);
  });

  it("fits every open unit's kitchen in three layers with a mark of its keeper just at it (docs/zasady-lokacji.md)", () => {
    const pieces = kitchenPieces();
    for (const u of ALCHEMIA_UNITS.filter((x) => !x.shut)) {
      const mine = pieces.filter((p) => within(rect(u.rect), (p.box.x0 + p.box.x1) / 2, (p.box.z0 + p.box.z1) / 2));
      const kinds = new Set(mine.map((p) => p.kind));
      // Big things at a body's height (solid), small ones on them, and steam off a pot or a cup (§5).
      expect(mine.some((p) => p.solid), u.id).toBe(true);
      expect(["cup", "carton", "goods"].some((k) => kinds.has(k as never)), u.id).toBe(true);
      expect(kinds.has("steam") || kinds.has("cup"), u.id).toBe(true);
    }
  });

  it("an alerted brawler on T1 gets up to the player before Kenta's counter, by the escalators or the north-east core", () => {
    const sim = Simulation.create({ seed: 3 });
    const to = beforeKeeper("kenta");
    teleportPlayer(sim, to);
    sim.step();
    const p = sim.player()!;
    const g = gangerEntity(9001, { key: "court-chaser", position: { x: 416, y: groundY(416, 62), z: 62 }, yaw: 0 }, null, 200, ALCHEMIA_CHUNK, undefined, "hebi_brawler");
    g.ai!.alerted = true;
    sim.world.add(g);
    const health = p.health!.current;
    let at: number | null = null;
    for (let i = 0; i < 60 * 45 && at === null; i++) {
      sim.step();
      if (p.health!.current < health || (Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z) < 2.5 && Math.abs(g.position.y - p.position.y) < 1)) at = i / 60;
    }
    expect(at).not.toBeNull();
  });
});

describe("Fumiko's second place on P0 (ADR-0093 O3)", () => {
  it("keeps the old corner's hatch and door onto T1, shut off from the gallery's shops", () => {
    const hatch = opening("fumiko-hatch");
    const door = opening("fumiko-door");
    for (const o of [hatch, door]) expect(o.x0 >= FUMIKO_WINDOW.minX && o.x1 <= FUMIKO_WINDOW.maxX, o.id).toBe(true);
    expect(FUMIKO_WINDOW_SPOT.y).toBe(FOODHALL.floor);
    expect(within(rect(FUMIKO_WINDOW), FUMIKO_WINDOW_SPOT.x, FUMIKO_WINDOW_SPOT.z)).toBe(true);
    // Not a cell of it reached from P0's walkways: its partitions have no door.
    const inside = [...REACHED_P0].filter((c) => within(rect(FUMIKO_WINDOW), cellCentre(c).x, cellCentre(c).z, -0.4));
    expect(inside).toEqual([]);
  });

  it("serves across the hatch: seen from T1 before it, her stools on the ground", () => {
    const sim = Simulation.create({ seed: 5 });
    teleportPlayer(sim, beforeHatch());
    sim.step();
    const eye = (p: Vec3) => ({ ...p, y: p.y + EYE_HEIGHT });
    expect(lineOfSight(sim.world, eye(beforeHatch()), eye(FUMIKO_WINDOW_SPOT))).toBe(true);
    for (const a of [-1.6, 0, 1.4]) expect(beforeHatch(1.2, a).y).toBeCloseTo(groundY(beforeHatch(1.2, a).x, beforeHatch(1.2, a).z), 6);
  });

  it("walks her between them: at her bar on P3 in the evening, behind the hatch after midnight, on her stool by day", () => {
    const def = SCHEDULES.fumiko!;
    const at = (h: number) => scheduledPose(def, { seconds: h * 3600 });
    expect(at(21)).toMatchObject({ arrived: true, position: STALL_KEEPERS.fumiko });
    expect(at(3)).toMatchObject({ arrived: true, position: FUMIKO_WINDOW_SPOT });
    const day = at(10);
    expect(day.arrived).toBe(true);
    expect(day.position.z).toBeGreaterThan(FOODHALL.maxZ);
    // On her way down after midnight she rides the escalators: some pose between P3 and P0 over the atrium.
    const riding = [0.3, 0.5, 0.7].map((h) => at(h).position).filter((p) => within(ATRIUM, p.x, p.z) && p.y < L.p3 - 0.5 && p.y > L.p0 + 0.5);
    expect(riding.length).toBeGreaterThan(0);
    // Each of her plan's points on a floor, the ground or a flight between two floors.
    for (const stop of def.stops)
      for (const p of stop.path) {
        const onFlight = ESCALATORS.some((e) => p.z > e.lane.z0 - 0.01 && p.z < e.lane.z1 + 0.01 && p.x > ATRIUM.x0 && p.x < ATRIUM.x1);
        const floors = [...MALL_FLOORS, groundY(p.x, p.z)];
        expect(onFlight || floors.some((f) => Math.abs(f - p.y) < 0.05), `${stop.label} ${p.x},${p.y},${p.z}`).toBe(true);
      }
  });
});

describe("the north-east core and its lift down to P0 (ADR-0093 O3)", () => {
  it("starts the core's stairs and the lift on P0, through P1's floor in holes of their own", () => {
    expect(NE_CORE.floors[0]).toBe(L.p0);
    expect(ALCHEMIA_LIFT_NE.levels[0]).toBe(L.p0);
    const l = ALCHEMIA_LIFT_NE;
    const shaft = { x0: l.centre.x - l.half - l.wall, x1: l.centre.x + l.half + l.wall, z0: l.centre.z - l.half - l.wall, z1: l.centre.z + l.half + l.wall };
    for (const k of ["x0", "x1", "z0", "z1"] as const) expect(NE_LIFT_SHAFT[k]).toBeCloseTo(shaft[k], 6);
    // No solid of P1's floor (the hall's old roof) across the stairwell past its landing or the shaft.
    const across = (x: number, z: number) => PRISMS.some((q) => q.top > L.p1 - 0.2 && q.bottom < L.p1 - 0.1 && q.box.min.x < x && q.box.max.x > x && q.box.min.z < z && q.box.max.z > z && q.top - q.bottom < 0.5);
    expect(across(l.centre.x, l.centre.z)).toBe(false);
    expect(across(NE_CORE.x1 - 1.0, (NE_CORE.z0 + NE_CORE.z1) / 2)).toBe(false);
    expect(across(420, 55)).toBe(true);
  });
});

describe("P0's fountain in the atrium (ADR-0093 §2, O3)", () => {
  it("stands in the atrium north of the escalators' lanes, P0's walkways reached all round it", () => {
    expect(FOUNTAIN_P0.minX).toBeGreaterThan(ATRIUM.x0);
    expect(FOUNTAIN_P0.maxX).toBeLessThan(ATRIUM.x1);
    expect(FOUNTAIN_P0.maxZ).toBeLessThan(ATRIUM.z1);
    expect(FOUNTAIN_P0.minZ).toBeGreaterThan(Math.max(...ESCALATORS.map((e) => e.lane.z1)) + 1.5);
    for (const [x, z] of [
      [FOUNTAIN_P0.minX - 1.0, (FOUNTAIN_P0.minZ + FOUNTAIN_P0.maxZ) / 2],
      [(FOUNTAIN_P0.minX + FOUNTAIN_P0.maxX) / 2, FOUNTAIN_P0.minZ - 1.0],
      [FOUNTAIN_P0.maxX + 1.0, FOUNTAIN_P0.minZ - 1.0],
      [418, 51.5],
    ] as const)
      expect(P0.near(REACHED_P0, x, z), `${x},${z}`).toBe(true);
    expect(FOODHALL_FLOOR).toBe(L.p3);
  });
});
