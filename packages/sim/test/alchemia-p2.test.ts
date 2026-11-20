import { describe, expect, it } from "vitest";
import { VEHICLE_SIZE, type Vec3 } from "@seki/core";
import {
  ALCHEMIA_CHUNK,
  ALCHEMIA_NAV,
  ALCHEMIA_PIECES,
  ALCHEMIA_PROPS,
  MALL_PROPS,
  SHOP_SOLID_PROPS,
  FOODHALL_SOLID_PROPS,
  ALCHEMIA_T2,
  ALCHEMIA_VAULTS,
  FOODHALL,
  LIFT_HOLE,
  METRO_DOOR_PIECES,
  METRO_ENTRANCES,
  P1,
  P1_CABINS,
  P1_CARS,
  P1_PIECES,
  P1_STAIR_CUT,
  P1_STAIR_DOWN,
  P1_VAULT,
  P2,
  P2_ANNEX,
  P2_CORRIDOR,
  P2_CUT,
  P2_CUTTING,
  P2_CUTTING_PIECES,
  P2_EARTH_PIECES,
  P2_CARS,
  P2_PALLETS,
  LIFT_SHAFT_CUT,
  P2_PROPS,
  P2_ROBOTS,
  SHELTER_PROPS,
  CAR_LIFT_PROPS,
  P2_ROOMS,
  ROOM_ID_BASE,
  P2_SHELL_PIECES,
  P2_STAIR,
  P2_STAIR_PIECES,
  P2_STAIR_RISE,
  P2_STORE_PIECES,
  P2_STORE_SOLIDS,
  P2_VAULT,
  Simulation,
  WORLD_CHUNKS,
  WORLD_NAV,
  WORLD_SCENERY,
  type AlchemiaBox,
  type AlchemiaPiece,
  beforeKeeper,
  gangerEntity,
  groundY,
  interiorAt,
  p2StairY,
} from "../src";
import { lineOfSight } from "../src/world/hitscan";
import { routeAcrossLevels } from "../src/world/nav";
import { teleportPlayer } from "./helpers";

/**
 * P-2, the lower level of Alchemia's car park (ADR-0074 stage 5a), measured on the simulation's own
 * ground and solids: the automated store under P-1 on T2's level, the flight down from P-1's apron,
 * the corridor north under the food hall and T1 to its portal, the cutting out onto T2; in the
 * level graph with two ways out, an interior of its own. Robots, the lift's stop and the shelter
 * are later stages (5b-5d).
 */

const F = P2.floor;
const node = (id: string): Vec3 => ALCHEMIA_NAV.nodes.find((n) => n.id === id)!.at;
const up = (p: Vec3, dy: number): Vec3 => ({ ...p, y: p.y + dy });
const onGround = (x: number, z: number): Vec3 => ({ x, y: groundY(x, z), z });
/** In the robots' lane between the rows. */
const STORE = { x: 402.3, y: F, z: 16 } as const;
const MOUTH = { x: (P2_CUTTING.minX + P2_CUTTING.maxX) / 2, z: P2_CUTTING.maxZ + 3 };

/** The world with Alchemia's chunk loaded, nobody in it but the player. */
const loaded = (() => {
  let sim: Simulation | null = null;
  return (): Simulation => {
    if (sim) return sim;
    sim = Simulation.create({ seed: 5 });
    teleportPlayer(sim, onGround(416, 60));
    sim.step();
    for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
    return sim;
  };
})();

/** How much two boxes overlap in volume (0 when they only touch). */
const overlap = (a: AlchemiaBox, b: AlchemiaBox): number =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

const inCutting = (x: number, z: number): boolean => x >= P2_CUTTING.minX && x <= P2_CUTTING.maxX && z >= P2_CUTTING.minZ && z <= P2_CUTTING.maxZ;
const solidOf = (ps: readonly AlchemiaPiece[]) => ps.filter((p) => p.solid);

describe("P-2 under P-1 (ADR-0074 stage 5a)", () => {
  it("lies in the ground on T2's level, under P-1's floor slab, its ground under its floor", () => {
    expect(F).toBe(ALCHEMIA_T2);
    expect(P2.slab).toBeCloseTo(P1.floor - P1.slab, 6);
    expect(P2.ceiling - F).toBeGreaterThanOrEqual(2.2);
    expect(WORLD_CHUNKS.find((c) => c.id === ALCHEMIA_CHUNK)!.vaults).toEqual(ALCHEMIA_VAULTS);
    expect(ALCHEMIA_VAULTS).toContain(P2_VAULT);
    // P-1's vault holds the store: its ground 2 m under P-2's floor, as the corridor's.
    for (const v of [P1_VAULT, P2_VAULT]) expect(v.floor).toBe(F - 2);
    const g = loaded().streamer.ground;
    for (const [x, z] of [
      [398, 6],
      [415, 20],
      [419, 26],
      [417, 40],
      [418, 70],
    ] as const) {
      expect(g.underStreet({ x, y: F, z }), `${x},${z}`).toBe(true);
      expect(g.underStreet(onGround(x, z)), `${x},${z}`).toBe(false);
    }
    // In the cutting the ground is dug to P-2's floor: open to the sky.
    expect(g.heightAt(416, 85)).toBeCloseTo(F, 6);
    expect(g.underStreet({ x: 416, y: F, z: 85 })).toBe(false);
  });

  /** In the lift's shaft (stage 5c): dug down to its pit, the corridor's floor slab at its threshold under the open shaft. */
  const inShaft = (x: number, z: number) => x >= LIFT_SHAFT_CUT.bounds.minX && x <= LIFT_SHAFT_CUT.bounds.maxX && z >= LIFT_SHAFT_CUT.bounds.minZ && z <= LIFT_SHAFT_CUT.bounds.maxZ;

  it("keeps every solid of the store and the corridor under the ground (but in the lift's shaft), the corridor under the food hall's floor and T1", () => {
    const g = loaded().streamer.ground;
    for (const p of [...P2_SHELL_PIECES, ...P2_STORE_PIECES]) {
      const b = p.box;
      let low = Infinity;
      for (let x = b.x0; x <= b.x1 + 1e-9; x += 0.5)
        for (let z = b.z0; z <= b.z1 + 1e-9; z += 0.5) if (!inCutting(Math.min(x, b.x1), Math.min(z, b.z1)) && !inShaft(Math.min(x, b.x1), Math.min(z, b.z1))) low = Math.min(low, g.heightAt(Math.min(x, b.x1), Math.min(z, b.z1)));
      expect(b.y1, `${p.kind} ${b.x0},${b.z0}`).toBeLessThan(low - 0.1);
    }
    expect(P2_CORRIDOR.minX).toBeGreaterThanOrEqual(FOODHALL.minX);
    expect(P2_CORRIDOR.maxX).toBeLessThanOrEqual(FOODHALL.maxX);
  });

  it("stands clear of P-1's, the food hall's and the passage from metro B's solids, and of P-1's stair core", () => {
    const mine = solidOf([...P2_SHELL_PIECES, ...P2_EARTH_PIECES, ...P2_STAIR_PIECES, ...P2_STORE_PIECES, ...P2_STORE_SOLIDS, ...P2_CUTTING_PIECES]);
    const theirs = solidOf([...P1_PIECES, ...ALCHEMIA_PIECES, ...METRO_DOOR_PIECES]);
    const hits: string[] = [];
    for (const a of mine) for (const b of theirs) if (overlap(a.box, b.box) > 1e-6) hits.push(`${a.kind} ${a.box.x0},${a.box.z0} in ${b.kind} ${b.box.x0},${b.box.z0}`);
    expect(hits).toEqual([]);
    const c = P1_STAIR_CUT.bounds;
    for (const p of mine) expect(p.box.x1 <= c.minX || p.box.x0 >= c.maxX || p.box.z1 <= c.minZ || p.box.z0 >= c.maxZ || p.box.y1 <= P1_STAIR_CUT.floor, `${p.kind} ${p.box.x0},${p.box.z0}`).toBe(true);
    // 2 m off metro B's shaft and hall, as P-1 (the annex is nearest it).
    const b = METRO_ENTRANCES.find((e) => e.label === "B" && e.station === "kanal")!.outline;
    for (const r of [P2, P2_ANNEX, P2_CORRIDOR, P2_CUTTING]) expect(Math.max(r.minX - b.maxX, b.minX - r.maxX, r.minZ - b.maxZ, b.minZ - r.maxZ)).toBeGreaterThanOrEqual(2);
    // The lift's shaft (stage 5c down to P-2) stands west of the corridor, its east face the corridor's west wall's inner one, over the corridor's first metres.
    expect(P2_CORRIDOR.minX + P2.wall).toBeCloseTo(LIFT_HOLE.maxX, 6);
    expect(LIFT_HOLE.maxZ).toBeLessThan(P2_CORRIDOR.minZ + 4);
  });

  it("opens the hole for its stairs in P-1's apron clear of P-1's cars, cabins and level graph", () => {
    const h = P1_STAIR_DOWN;
    expect(P1_PIECES.filter((p) => p.kind === "floor" && overlap(p.box, { x0: h.minX, x1: h.maxX, z0: h.minZ, z1: h.maxZ, y0: P1.floor - 1, y1: P1.floor })).length).toBe(0);
    for (const c of [...P1_CARS, ...P1_CABINS.map((r) => ({ x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 }))]) expect(Math.hypot(Math.max(h.minX - c.x, 0, c.x - h.maxX), Math.max(h.minZ - c.z, 0, c.z - h.maxZ))).toBeGreaterThan(5);
    const sim = loaded();
    for (const e of ALCHEMIA_NAV.edges.filter((e) => e.a.startsWith("alchemia-p1-") && e.b.startsWith("alchemia-p1-") && !e.via)) {
      expect(lineOfSight(sim.world, up(node(e.a), 0.6), up(node(e.b), 0.6)), `${e.a} - ${e.b}`).toBe(true);
    }
  });

  it("has its flight in the stride, with headroom over every step and its landing level with P-1's floor", () => {
    expect(P2_STAIR_RISE).toBeLessThanOrEqual(0.18);
    expect(p2StairY(P2_STAIR.minX - 0.1)).toBe(P1.floor);
    expect(p2StairY(P2_STAIR.maxX + 0.1)).toBe(F);
    expect(P2_STAIR.maxX - P2_STAIR.minX - (P2_STAIR.risers - 1) * P2_STAIR.going).toBeCloseTo(0, 6);
    const overhead = [...P1_PIECES, ...P2_SHELL_PIECES, ...P2_STAIR_PIECES].filter((p) => p.solid);
    for (let x = P2_STAIR.minX - 0.6; x < P2_STAIR.maxX + 0.8; x += 0.07)
      for (const z of [P2_STAIR.minZ + 0.3, P2_STAIR.maxZ - 0.3]) {
        const y = p2StairY(x);
        const over = Math.min(...overhead.filter((p) => p.box.x0 <= x && p.box.x1 >= x && p.box.z0 <= z && p.box.z1 >= z && p.box.y0 > y + 0.01).map((p) => p.box.y0));
        expect(over - y, `${x.toFixed(2)},${z}`).toBeGreaterThanOrEqual(2.1);
      }
  });

  it("opens its cutting level onto T2's ground, off Świętoduska's footway and on no solid of the map", () => {
    expect(P2_CUT.floor).toBe(F);
    for (let x = P2_CUTTING.minX + 0.5; x < P2_CUTTING.maxX; x += 0.5) expect(Math.abs(groundY(x, P2_CUTTING.maxZ + 0.3) - F), `${x}`).toBeLessThan(0.25);
    // The footway w232464409 (403.4; 79.1)-(415.0; 102.1): its axis 2 m off the cutting's west wall where it nears it.
    const axisX = (z: number) => 403.4 + ((z - 79.1) * (415.0 - 403.4)) / (102.1 - 79.1);
    expect(P2_CUTTING.minX - axisX(P2_CUTTING.maxZ)).toBeGreaterThan(1.9);
    // No solid of the map's (buildings, furniture, barriers, parked cars) in it, nor any other of the game's own.
    const sim = loaded();
    const inside = { x0: P2_CUTTING.minX + P2.wall, x1: P2_CUTTING.maxX - P2.wall, z0: P2_CUTTING.minZ, z1: P2_CUTTING.maxZ, y0: F, y1: F + 3 };
    const map = [...sim.world.with("solid")].filter((e) => e.id < ROOM_ID_BASE && overlap({ x0: e.solid.min.x, x1: e.solid.max.x, z0: e.solid.min.z, z1: e.solid.max.z, y0: e.solid.min.y, y1: e.solid.max.y }, inside) > 0);
    expect(map.map((e) => `${e.key ?? e.id} ${e.view?.kind}`)).toEqual([]);
    expect(solidOf([...ALCHEMIA_PIECES, ...P1_PIECES, ...P2_SHELL_PIECES, ...P2_CUTTING_PIECES]).filter((p) => overlap(p.box, inside) > 0)).toEqual([]);
  });

  it("is the interior `alchemia-p2` in its store, its corridor and on its flight, not in the cutting, on P-1 or on T1 over it", () => {
    expect(interiorAt(STORE)?.id).toBe("alchemia-p2");
    expect(interiorAt({ x: 415, y: F, z: 60 })?.id).toBe("alchemia-p2");
    expect(interiorAt({ x: 417, y: p2StairY(417), z: 30.6 })?.id).toBe("alchemia-p2");
    expect(interiorAt({ x: 419.3, y: F, z: 27 })?.id).toBe("alchemia-p2");
    expect(interiorAt({ x: 416, y: F, z: 85 })).toBeNull();
    expect(interiorAt({ x: 402, y: P1.floor, z: 15 })?.id).toBe("alchemia-parking");
    expect(interiorAt(onGround(416, 66))).toBeNull();
    for (const r of P2_ROOMS) expect(r.bottom).toBe(F);
  });

  it("has its cars on their pallets, clear of the lane, the aisle and each other, drawn as the street's parked cars", () => {
    // No box of a car in P-2's mesh: its pallets only.
    expect(P2_STORE_PIECES.filter((p) => p.kind === "pallet").length).toBe(P2_PALLETS.length);
    expect(P2_CARS.length).toBe(P2_PALLETS.filter((p) => p.car).length);
    expect(P2_CARS.length).toBeGreaterThanOrEqual(12);
    const { width, length } = VEHICLE_SIZE.sedan;
    for (const c of P2_CARS) {
      // Along the row (yaw a quarter turn): its length in x, its width in z.
      const b = { x0: c.x - length / 2, x1: c.x + length / 2, z0: c.z - width / 2, z1: c.z + width / 2 };
      const pallet = P2_PALLETS.find((p) => b.x0 >= p.minX && b.x1 <= p.maxX && b.z0 >= p.minZ && b.z1 <= p.maxZ);
      expect(pallet, `${c.x},${c.z}`).toBeDefined();
      expect(c.y).toBeCloseTo(F + 0.15, 6);
      expect(Math.abs(c.yaw)).toBeCloseTo(Math.PI / 2, 6);
      expect(b.x1 < 400 || b.x0 > 404.6).toBe(true);
      expect(b.x1).toBeLessThan(410);
      const item = WORLD_SCENERY.find((s) => s.at.x === c.x && s.at.z === c.z && s.at.y === c.y)!;
      expect(item.view).toEqual({ kind: "vehicle", model: "sedan", tint: c.tint, parked: true });
      expect(item.chunk).toBe(ALCHEMIA_CHUNK);
    }
    // Solids of one prop each: the shell with the cutting, the flight, the store; the last of Alchemia's before the front's (B1).
    // The gallery round the atrium (ADR-0093 O1) last.
    const after = 1 + P2_ROBOTS.length + SHELTER_PROPS.length + CAR_LIFT_PROPS.length + MALL_PROPS.length + SHOP_SOLID_PROPS.length + FOODHALL_SOLID_PROPS.length;
    expect(ALCHEMIA_PROPS.slice(-P2_PROPS.length - after, -after)).toEqual(P2_PROPS);
  });
});

describe("P-2 in the level graph (ADR-0074 §5, stage 5a)", () => {
  it("is part of the city's graph, every node on its floor, its flight's landing or T2's ground", () => {
    const ids = new Set(WORLD_NAV.nodes.map((n) => n.id));
    const p2 = ALCHEMIA_NAV.nodes.filter((n) => n.id.startsWith("alchemia-p2-"));
    expect(p2.length).toBeGreaterThanOrEqual(6);
    const g = loaded().streamer.ground;
    for (const n of p2) {
      expect(ids.has(n.id), n.id).toBe(true);
      const floor = n.id === "alchemia-p2-stair-head" ? P1.floor : n.id === "alchemia-p2-mouth" ? g.heightAt(n.at.x, n.at.z) : F;
      expect(n.at.y, n.id).toBeCloseTo(floor, 1);
    }
  });

  it("has every edge but the flight's walkable in a straight line at knee height", () => {
    const sim = loaded();
    for (const e of ALCHEMIA_NAV.edges.filter((e) => (e.a.startsWith("alchemia-p2-") || e.b.startsWith("alchemia-p2-")) && !e.via)) {
      expect(lineOfSight(sim.world, up(node(e.a), 0.6), up(node(e.b), 0.6)), `${e.a} - ${e.b}`).toBe(true);
    }
  });

  it("leads from T2, P-1's deck and the food hall down to the store, and from the store back to all three", () => {
    const sim = loaded();
    const elsewhere = [onGround(MOUTH.x, MOUTH.z), { x: 402, y: P1.floor, z: 15 }, beforeKeeper("kenta")];
    for (const s of elsewhere) {
      expect(routeAcrossLevels(sim.world, WORLD_NAV, s, STORE), `${s.x},${s.z} to the store`).not.toBeNull();
      expect(routeAcrossLevels(sim.world, WORLD_NAV, STORE, s), `the store to ${s.x},${s.z}`).not.toBeNull();
    }
  });

  /** Seconds an alerted brawler at `from` takes to hurt the player at `to` or stand by her, or null. */
  const chase = (from: Vec3, to: Vec3, seconds: number, seed = 3): number | null => {
    const sim = Simulation.create({ seed });
    teleportPlayer(sim, to);
    sim.step();
    const p = sim.player()!;
    const g = gangerEntity(9001, { key: "p2-chaser", position: { ...from }, yaw: 0 }, null, 200, ALCHEMIA_CHUNK, undefined, "hebi_brawler");
    g.ai!.alerted = true;
    sim.world.add(g);
    const health = p.health!.current;
    for (let i = 0; i < 60 * seconds; i++) {
      sim.step();
      if (p.health!.current < health || (Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z) < 2.5 && Math.abs(g.position.y - p.position.y) < 1)) return i / 60;
    }
    return null;
  };

  it("an alerted brawler on P-1's apron gets to the player in the store down the flight, and one in the corridor to her on T2", () => {
    expect(chase({ x: 412, y: P1.floor, z: 27 }, { x: 412, y: F, z: 22 }, 20), "down").not.toBeNull();
    expect(chase({ x: 417, y: F, z: 66 }, onGround(MOUTH.x, MOUTH.z), 20), "out").not.toBeNull();
  });
});
