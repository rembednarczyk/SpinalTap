import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import {
  ALCHEMIA_CHUNK,
  ALCHEMIA_CUTS,
  ALCHEMIA_NAV,
  ALCHEMIA_VAULTS,
  FOODHALL,
  METRO_ENTRANCES,
  P1,
  P1_CABINS,
  P1_CARS,
  P1_HALL_DOOR,
  P1_PIECES,
  P1_RAMP,
  P1_RAMP_CUT,
  P1_RAMP_GRADE,
  P1_RAMP_PROPS,
  P1_ROOMS,
  P1_STAIR,
  P1_STAIR_CUT,
  P1_STAIR_RISE,
  Simulation,
  WORLD_CHUNKS,
  WORLD_NAV,
  beforeKeeper,
  gangerEntity,
  groundY,
  interiorAt,
  p1RampY,
} from "../src";
import { lineOfSight } from "../src/world/hitscan";
import { routeAcrossLevels } from "../src/world/nav";
import { teleportPlayer } from "./helpers";

/**
 * P-1, the upper level of Alchemia's car park under T0 (ADR-0074 stage 4), measured on the
 * simulation's own ground and solids: a room in the ground with the car park whole over it, its
 * ramp from Bajkowskiego, its stair core by metro B and its door into the food hall, in the level
 * graph, with its way out each way for an NPC.
 */

const F = P1.floor;
const node = (id: string): Vec3 => ALCHEMIA_NAV.nodes.find((n) => n.id === id)!.at;
const up = (p: Vec3, dy: number): Vec3 => ({ ...p, y: p.y + dy });
const onGround = (x: number, z: number): Vec3 => ({ x, y: groundY(x, z), z });

/** The world with Alchemia's chunk loaded, nobody in it but the player. */
const loaded = (() => {
  let sim: Simulation | null = null;
  return (): Simulation => {
    if (sim) return sim;
    sim = Simulation.create({ seed: 5 });
    teleportPlayer(sim, onGround(405, 20));
    sim.step();
    for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
    return sim;
  };
})();

const inCut = (x: number, z: number): boolean => ALCHEMIA_CUTS.some((c) => x >= c.bounds.minX && x <= c.bounds.maxX && z >= c.bounds.minZ && z <= c.bounds.maxZ);

describe("P-1 under Alchemia's car park (ADR-0074 stage 4)", () => {
  it("lies in the ground with the car park whole over it, the hall's floor its own", () => {
    const sim = loaded();
    const g = sim.streamer.ground;
    expect(WORLD_CHUNKS.find((c) => c.id === ALCHEMIA_CHUNK)!.vaults).toEqual(ALCHEMIA_VAULTS);
    expect(F).toBe(FOODHALL.floor);
    for (const [x, z] of [
      [400, 6],
      [405, 20],
      [414, 28],
      [420, 30],
    ] as const) {
      expect(g.heightAt(x, z), `${x},${z}`).toBeCloseTo(groundY(x, z), 6);
      expect(g.underStreet({ x, y: F, z }), `${x},${z}`).toBe(true);
      expect(g.underStreet({ x, y: groundY(x, z), z }), `${x},${z}`).toBe(false);
    }
  });

  it("keeps every solid of the room under the car park's ground", () => {
    for (const p of P1_PIECES.filter((q) => q.inside)) {
      const b = p.box;
      if (inCut((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2)) continue;
      let low = Infinity;
      for (let x = b.x0; x <= b.x1 + 1e-9; x += 0.5) for (let z = b.z0; z <= b.z1 + 1e-9; z += 0.5) low = Math.min(low, groundY(Math.min(x, b.x1), Math.min(z, b.z1)));
      expect(b.y1, `${p.kind} ${b.x0},${b.z0}`).toBeLessThan(low - 0.1);
    }
  });

  it("keeps 2 m off the shaft and the hall of metro B's pavilion", () => {
    const b = METRO_ENTRANCES.find((e) => e.label === "B" && e.station === "kanal")!.outline;
    const gap = Math.max(P1.minX - b.maxX, b.minX - P1.maxX, P1.minZ - b.maxZ, b.minZ - P1.maxZ);
    expect(gap).toBeGreaterThanOrEqual(2);
    for (const c of [P1_RAMP_CUT, P1_STAIR_CUT]) expect(Math.max(c.bounds.minX - b.maxX, b.minX - c.bounds.maxX, c.bounds.minZ - b.maxZ, b.minZ - c.bounds.maxZ)).toBeGreaterThanOrEqual(2);
  });

  it("has its ramp from the car park's ground at the top to P-1's floor at the foot, at under 20%, with headroom", () => {
    expect(P1_RAMP_GRADE).toBeGreaterThan(0.15);
    expect(P1_RAMP_GRADE).toBeLessThan(0.2);
    for (const x of [P1_RAMP.minX + 0.5, (P1_RAMP.minX + P1_RAMP.maxX) / 2, P1_RAMP.maxX - 0.5]) expect(Math.abs(p1RampY(P1_RAMP.top) - groundY(x, P1_RAMP.top - 0.5)), `${x}`).toBeLessThan(0.15);
    expect(p1RampY(P1_RAMP.foot)).toBe(F);
    // The wedges meet: each one's low end at the next one's high end.
    for (let i = 1; i < P1_RAMP_PROPS.length; i++) {
      const a = P1_RAMP_PROPS[i - 1]!;
      const b = P1_RAMP_PROPS[i]!;
      const lowA = a.center.y - (a.view.kind === "block" ? a.view.size.y / 2 : 0) + (a.view.kind === "block" ? a.view.slope!.low : 0);
      const highB = b.center.y + (b.view.kind === "block" ? b.view.size.y / 2 : 0);
      expect(lowA).toBeCloseTo(highB, 6);
    }
    // Under every piece of its ceiling a car and a walker pass.
    for (const p of P1_PIECES.filter((q) => q.kind === "roof" && q.box.x0 === P1_RAMP.minX)) expect(p.box.y0 - p1RampY(p.box.z0)).toBeGreaterThanOrEqual(P1_RAMP.headroom - 1e-6);
  });

  it("has its stair core's landing level with the car park outside its door, at an even rise", () => {
    expect(Math.abs(P1_STAIR.top - groundY((P1_STAIR.door.x0 + P1_STAIR.door.x1) / 2, P1_STAIR.minZ - 0.6))).toBeLessThan(0.1);
    expect(P1_STAIR_RISE).toBeLessThan(0.19);
  });

  it("opens its door onto the hall's floor by Sachiko's kiosk, level", () => {
    expect(P1_HALL_DOOR.x1 - P1_HALL_DOOR.x0).toBeGreaterThan(1.5);
    const sachiko = beforeKeeper("sachiko");
    expect(Math.hypot(sachiko.x - (P1_HALL_DOOR.x0 + P1_HALL_DOOR.x1) / 2, sachiko.z - FOODHALL.minZ)).toBeLessThan(5.5);
    const sim = loaded();
    expect(lineOfSight(sim.world, up(node("alchemia-p1-door"), 0.6), up(node("alchemia-p1-door-in"), 0.6))).toBe(true);
  });

  it("is the interior `alchemia-parking` on its deck and its apron, not on the car park over it", () => {
    expect(interiorAt({ x: 402, y: F, z: 15 })?.id).toBe("alchemia-parking");
    expect(interiorAt({ x: 412, y: F, z: 28 })?.id).toBe("alchemia-parking");
    expect(interiorAt(onGround(402, 15))).toBeNull();
    for (const r of P1_ROOMS) expect(r.top).toBeLessThan(groundY((r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2) - 1);
  });

  it("has its cars on its floor in their bays, clear of each other and of the cabins", () => {
    const sim = loaded();
    const cars = [...sim.world.with("solid")].filter((e) => e.chunk === ALCHEMIA_CHUNK && e.solid.min.y > F - 0.5 && e.solid.max.y < F + 2.5 && e.solid.max.x - e.solid.min.x > 3);
    expect(cars.length).toBeGreaterThanOrEqual(P1_CARS.length);
    for (const c of P1_CARS) {
      expect(c.y).toBe(F);
      expect(P1_CABINS.some((r) => c.x >= r.minX && c.x <= r.maxX && c.z >= r.minZ && c.z <= r.maxZ)).toBe(false);
      for (const d of P1_CARS) if (d !== c) expect(Math.hypot(c.x - d.x, c.z - d.z)).toBeGreaterThan(2.4);
    }
  });
});

describe("P-1 in the level graph (ADR-0074 §5, stage 4)", () => {
  it("is part of the city's graph, every node on its floor, ramp or stairs", () => {
    const ids = new Set(WORLD_NAV.nodes.map((n) => n.id));
    const p1 = ALCHEMIA_NAV.nodes.filter((n) => n.id.startsWith("alchemia-p1-"));
    expect(p1.length).toBeGreaterThan(8);
    for (const n of p1) {
      expect(ids.has(n.id), n.id).toBe(true);
      const onRamp = n.at.x > P1_RAMP.minX && n.at.x < P1_RAMP.maxX && n.at.z > P1_RAMP.top && n.at.z < P1_RAMP.foot;
      const deep = n.at.y < groundY(n.at.x, n.at.z) - 1.5;
      const floor = onRamp ? p1RampY(n.at.z) : n.id.endsWith("stair-head") ? P1_STAIR.top : deep ? F : groundY(n.at.x, n.at.z);
      expect(n.at.y, n.id).toBeCloseTo(floor, 1);
    }
  });

  it("has every edge but the ramp's and the stairs' walkable in a straight line at knee height", () => {
    const sim = loaded();
    for (const e of ALCHEMIA_NAV.edges.filter((e) => e.a.startsWith("alchemia-p1-") && !e.via)) {
      const [a, b] = [node(e.a), node(e.b)];
      expect(lineOfSight(sim.world, up(a, 0.6), up(b, 0.6)), `${e.a} - ${e.b}`).toBe(true);
    }
  });

  it("leads from the car park, the hall and the green roof down to its deck, and from its deck up to all three", () => {
    const sim = loaded();
    const deck = { x: 402, y: F, z: 15 };
    const elsewhere = [onGround(405, -3), onGround(424, 18), beforeKeeper("kenta"), { x: 419, y: FOODHALL.roof, z: 50 }];
    for (const s of elsewhere) {
      expect(routeAcrossLevels(sim.world, WORLD_NAV, s, deck), `${s.x},${s.z} to the deck`).not.toBeNull();
      expect(routeAcrossLevels(sim.world, WORLD_NAV, deck, s), `the deck to ${s.x},${s.z}`).not.toBeNull();
    }
  });

  /** Seconds an alerted brawler at `from` takes to hurt the player at `to` or stand by her, or null. */
  const chase = (from: Vec3, to: Vec3, seconds: number, seed = 3): number | null => {
    const sim = Simulation.create({ seed });
    teleportPlayer(sim, to);
    sim.step();
    const p = sim.player()!;
    const g = gangerEntity(9001, { key: "p1-chaser", position: { ...from }, yaw: 0 }, null, 200, ALCHEMIA_CHUNK, undefined, "hebi_brawler");
    g.ai!.alerted = true;
    sim.world.add(g);
    const health = p.health!.current;
    for (let i = 0; i < 60 * seconds; i++) {
      sim.step();
      if (p.health!.current < health || (Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z) < 2.5 && Math.abs(g.position.y - p.position.y) < 1)) return i / 60;
    }
    return null;
  };

  it("an alerted brawler on the deck gets to the player on the car park", () => {
    for (const seed of [3, 11]) expect(chase({ x: 402, y: F, z: 15 }, onGround(424, 16), 40, seed), `up, seed ${seed}`).not.toBeNull();
  });

  it("an alerted brawler in the hall gets to the player on the apron through the door, and back", () => {
    expect(chase(beforeKeeper("goro"), { x: 409, y: F, z: 27 }, 30)).not.toBeNull();
    expect(chase({ x: 409, y: F, z: 27 }, beforeKeeper("goro"), 30)).not.toBeNull();
  });
});
