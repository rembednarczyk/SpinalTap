import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import {
  ALCHEMIA_CHUNK,
  ALCHEMIA_CUTS,
  ALCHEMIA_LIFT,
  ALCHEMIA_NAV,
  ALCHEMIA_PIECES,
  ALCHEMIA_T0,
  ALCHEMIA_T1,
  ALCHEMIA_UNITS,
  FOODHALL,
  FOODHALL_INNER,
  METRO_ENTRANCES,
  STALL_KEEPERS,
  Simulation,
  WORLD_NAV,
  beforeKeeper,
  gangerEntity,
  groundY,
  heightApart,
  interiorAt,
  opening,
} from "../src";
import { EYE_HEIGHT, lineOfSight } from "../src/world/hitscan";
import { routeAcrossLevels } from "../src/world/nav";
import { MAX_WALK_SLOPE } from "../src/world/ground";
import { teleportPlayer } from "./helpers";

/**
 * The food hall of Alchemia under its terrace (ADR-0074 stage 1), measured on the simulation's own
 * ground and solids: dug into the slope between T0 (its roof, level with the car park) and T1 (its
 * floor, level with the square in front), its doors and stairs in the level graph, the keepers in
 * their units, the way in seen from T1 through the doors and not through the glass.
 */

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

const F = FOODHALL.floor;
const R = FOODHALL.roof;
const node = (id: string) => ALCHEMIA_NAV.nodes.find((n) => n.id === id)!.at;
const up = (p: Vec3, dy: number): Vec3 => ({ ...p, y: p.y + dy });

describe("the food hall of Alchemia under its terrace (ADR-0074 stage 1)", () => {
  it("is dug to its floor, T1 in front of it, its roof level with the car park behind it", () => {
    const g = loaded().streamer.ground;
    expect(ALCHEMIA_CUTS.map((c) => c.floor)).toEqual([ALCHEMIA_T1, ALCHEMIA_T1]);
    for (const [x, z] of [
      [418, 45],
      [401, 33],
      [435, 57],
    ] as const)
      expect(g.heightAt(x, z, F + 0.5)).toBeCloseTo(F, 6);
    // T1 a step out of the front, level; T0 along the back wall, flush with the roof.
    for (const x of [401, 416, 431.7]) expect(g.heightAt(x, FOODHALL.maxZ + 0.6)).toBeCloseTo(ALCHEMIA_T1, 2);
    for (const x of [402, 420, 434]) expect(Math.abs(g.heightAt(x, FOODHALL.minZ - 0.3) - ALCHEMIA_T0)).toBeLessThan(0.1);
  });

  it("keeps 2 m off the shaft and the hall of metro B's pavilion", () => {
    const b = METRO_ENTRANCES.find((e) => e.label === "B" && e.station === "kanal")!.cut.bounds;
    const gap = Math.max(FOODHALL.minX - b.maxX, b.minX - FOODHALL.maxX, FOODHALL.minZ - b.maxZ, b.minZ - FOODHALL.maxZ);
    expect(gap).toBeGreaterThanOrEqual(2);
  });

  it("has walkable ramps beside it from T0 down to T1", () => {
    const g = loaded().streamer.ground;
    for (const x of [397, 439]) {
      for (let z = FOODHALL.minZ; z <= FOODHALL.maxZ - 2; z += 1) expect(g.slopeAt(x, z), `${x},${z}`).toBeLessThan(MAX_WALK_SLOPE);
      expect(g.heightAt(x, FOODHALL.minZ - 0.5)).toBeGreaterThan(ALCHEMIA_T0 - 0.3);
      expect(g.heightAt(x, FOODHALL.maxZ - 1)).toBeCloseTo(ALCHEMIA_T1, 1);
    }
  });

  it("has twelve units, five of them with their keepers behind the counters inside", () => {
    expect(ALCHEMIA_UNITS).toHaveLength(12);
    const kept = ALCHEMIA_UNITS.filter((u) => u.keeper);
    expect(kept.map((u) => u.keeper).sort()).toEqual(["fumiko", "goro", "kenta", "oyaji", "sachiko"]);
    for (const u of kept) {
      const p = STALL_KEEPERS[u.keeper!];
      expect(p.x > u.rect.minX && p.x < u.rect.maxX && p.z > u.rect.minZ && p.z < u.rect.maxZ, u.id).toBe(true);
      expect(p.y).toBe(F);
    }
    // Every unit inside the walls.
    for (const u of ALCHEMIA_UNITS) {
      expect(u.rect.minX).toBeGreaterThanOrEqual(FOODHALL_INNER.minX);
      expect(u.rect.maxX).toBeLessThanOrEqual(FOODHALL_INNER.maxX);
    }
  });

  it("counts as an interior inside its walls, not on its roof or on T1", () => {
    expect(interiorAt({ x: 418, y: F, z: 45 })?.id).toBe("alchemia-foodhall");
    expect(interiorAt({ x: 418, y: R, z: 45 })).toBeNull();
    expect(interiorAt({ x: 418, y: ALCHEMIA_T1, z: 62 })).toBeNull();
  });

  it("is a floor of its own: apart from T1 at any height, its roof apart from its floor", () => {
    const sim = loaded();
    expect(heightApart(sim.world, { x: 416, y: F, z: 55 }, { x: 416, y: F, z: 60 })).toBe(Infinity);
    expect(heightApart(sim.world, { x: 418, y: F, z: 45 }, { x: 418, y: R, z: 45 })).toBeCloseTo(R - F, 6);
    expect(heightApart(sim.world, { x: 418, y: F, z: 45 }, { x: 428, y: F, z: 40 })).toBe(0);
  });

  it("sees in from T1 through the way in and Oyaji's back door, not through the glass", () => {
    const sim = loaded();
    const eye = (p: Vec3) => up(p, EYE_HEIGHT);
    const x = (opening("entrance").x0 + opening("entrance").x1) / 2;
    expect(lineOfSight(sim.world, eye({ x, y: ALCHEMIA_T1, z: 64 }), eye({ x, y: F, z: 47 }))).toBe(true);
    const back = (opening("oyaji-door").x0 + opening("oyaji-door").x1) / 2;
    expect(lineOfSight(sim.world, eye({ x: back, y: ALCHEMIA_T1, z: 62 }), eye({ x: back, y: F, z: 55 }))).toBe(true);
    // Through the glass beside the way in, to the same point inside: no.
    expect(lineOfSight(sim.world, eye({ x: x + 6.5, y: ALCHEMIA_T1, z: 64 }), eye({ x: x + 6.5, y: F, z: 49 }))).toBe(false);
    // Fumiko across her hatch from the stools on T1.
    expect(lineOfSight(sim.world, eye(beforeKeeper("fumiko")), eye(STALL_KEEPERS.fumiko))).toBe(true);
  });
});

describe("Alchemia in the level graph (ADR-0074 §5)", () => {
  it("is part of the city's graph, every node on its floor", () => {
    const ids = new Set(WORLD_NAV.nodes.map((n) => n.id));
    for (const n of ALCHEMIA_NAV.nodes) expect(ids.has(n.id), n.id).toBe(true);
    const g = loaded().streamer.ground;
    for (const n of ALCHEMIA_NAV.nodes) {
      const inHall = n.at.x >= FOODHALL.minX && n.at.x <= FOODHALL.maxX && n.at.z >= FOODHALL.minZ && n.at.z <= FOODHALL.maxZ;
      const floor = inHall ? (n.at.y > F + 1 ? R : F) : g.heightAt(n.at.x, n.at.z);
      expect(n.at.y, n.id).toBeCloseTo(floor, 1);
    }
  });

  it("has every edge but the stairs and the ramps walkable in a straight line at knee height", () => {
    const sim = loaded();
    for (const e of ALCHEMIA_NAV.edges) {
      if (e.via) continue;
      const [a, b] = [node(e.a), node(e.b)];
      expect(lineOfSight(sim.world, up(a, 0.6), up(b, 0.6)), `${e.a} - ${e.b}`).toBe(true);
    }
  });

  it("leads from T1, the car park and the roof to every keeper", () => {
    const sim = loaded();
    const starts = [node("alchemia-t1-west"), node("alchemia-t0-roof"), { x: 419, y: R, z: 50 }, { x: 397, y: groundY(397, 44), z: 44 }];
    for (const s of starts) {
      // Before the counters; Fumiko and Oyaji behind theirs, through their own doors.
      for (const key of Object.keys(STALL_KEEPERS) as (keyof typeof STALL_KEEPERS)[]) {
        const p = key === "fumiko" || key === "oyaji" ? STALL_KEEPERS[key] : beforeKeeper(key);
        expect(routeAcrossLevels(sim.world, WORLD_NAV, s, p), `${s.x},${s.z} to ${key}`).not.toBeNull();
      }
    }
  });

  /** Seconds an alerted brawler at `from` takes to hurt the player at `to` or stand by her, or null. */
  const chase = (from: Vec3, to: Vec3, seconds: number, seed = 3): number | null => {
    const sim = Simulation.create({ seed });
    teleportPlayer(sim, to);
    sim.step();
    const p = sim.player()!;
    const g = gangerEntity(9001, { key: "alch-chaser", position: { ...from }, yaw: 0 }, null, 200, ALCHEMIA_CHUNK, undefined, "hebi_brawler");
    g.ai!.alerted = true;
    sim.world.add(g);
    const health = p.health!.current;
    for (let i = 0; i < 60 * seconds; i++) {
      sim.step();
      if (p.health!.current < health || (Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z) < 2.5 && Math.abs(g.position.y - p.position.y) < 1)) return i / 60;
    }
    return null;
  };
  const onGround = (x: number, z: number): Vec3 => ({ x, y: groundY(x, z), z });

  it("an alerted brawler on the car park gets to the player at Kenta's counter down the stairs", () => {
    for (const seed of [3, 11]) expect(chase(onGround(425, 22), beforeKeeper("kenta"), 30, seed), `seed ${seed}`).not.toBeNull();
  });

  it("an alerted brawler on T1 gets to the player in the hall through the way in, and one in the hall to her on T1", () => {
    expect(chase(onGround(397, 62), beforeKeeper("goro"), 20)).not.toBeNull();
    expect(chase(beforeKeeper("goro"), onGround(430, 66), 20)).not.toBeNull();
  });

  it("an alerted brawler in the hall gets to the player on the green roof, up the stairs", () => {
    expect(chase(beforeKeeper("kenta"), { x: 424, y: FOODHALL.roof, z: 50 }, 30)).not.toBeNull();
  });

  it("the lift goes from the hall's floor to the roof, its top door onto the car park", () => {
    expect(ALCHEMIA_LIFT.levels).toEqual([F, R]);
    const top = ALCHEMIA_LIFT.doors[1];
    expect(top.z).toBeLessThan(FOODHALL.minZ);
    expect(Math.abs(groundY(top.x, top.z) - R)).toBeLessThan(0.1);
    expect(ALCHEMIA_PIECES.length).toBeGreaterThan(100);
  });
});
