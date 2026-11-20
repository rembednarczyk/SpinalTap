import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import {
  ALCHEMIA_CHUNK,
  ALCHEMIA_CUTS,
  ALCHEMIA_LIFT,
  P2,
  P2_CORRIDOR,
  P2_SHELL_PIECES,
  ALCHEMIA_NAV,
  ALCHEMIA_PIECES,
  ALCHEMIA_T0,
  ALCHEMIA_T1,
  FUMIKO_WINDOW_SPOT,
  beforeHatch,
  FOODHALL,
  METRO_ENTRANCES,
  STALL_KEEPERS,
  MALL_FLOORS,
  STAIR_CORES,
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
/** On P0, the hall's floor, on the north walkway by the way in (its shops round it since ADR-0093 O3). */
const IN_HALL: Vec3 = { x: 420, y: F, z: 51.6 };
const up = (p: Vec3, dy: number): Vec3 => ({ ...p, y: p.y + dy });

describe("the food hall of Alchemia under its terrace (ADR-0074 stage 1)", () => {
  it("is dug to its floor, T1 in front of it, its roof level with the car park behind it", () => {
    const g = loaded().streamer.ground;
    // The lift's shaft down to P-2 (stage 5c), the hall's stairs and the hall; then P-1's ramp trench and stair core (stage 4, `alchemia-parking.test.ts`).
    expect(ALCHEMIA_CUTS[0]!.floor).toBeLessThan(P2.floor);
    expect(ALCHEMIA_CUTS.slice(1, 3).map((c) => c.floor)).toEqual([ALCHEMIA_T1, ALCHEMIA_T1]);
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
      for (let z = FOODHALL.minZ; z <= FOODHALL.maxZ; z += 1) expect(g.slopeAt(x, z), `${x},${z}`).toBeLessThan(MAX_WALK_SLOPE);
      expect(g.heightAt(x, FOODHALL.minZ - 0.5)).toBeGreaterThan(ALCHEMIA_T0 - 0.3);
      expect(g.heightAt(x, FOODHALL.maxZ - 2)).toBeCloseTo(ALCHEMIA_T1, 1);
    }
    // Past its foot the east ramp is on T1. The west one ends by Świętoduska's sidewalk, whose cell of
    // the 4 m grid keeps the NMT (T-209): a metre past its foot the ground is 0.1 m under T1 at most.
    expect(g.heightAt(439, FOODHALL.maxZ - 1)).toBeCloseTo(ALCHEMIA_T1, 1);
    expect(Math.abs(g.heightAt(397, FOODHALL.maxZ - 1) - ALCHEMIA_T1)).toBeLessThan(0.1);
  });

  it("counts as an interior of the gallery inside its walls (its shops' floor since ADR-0093 O3), not on T1", () => {
    expect(interiorAt({ x: 418, y: F, z: 51 })?.id).toBe("alchemia-gallery");
    // Its roof is P1 of the gallery round the atrium since ADR-0093 (an interior of its own since O2).
    expect(interiorAt({ x: 418, y: R, z: 45 })?.id).toBe("alchemia-gallery");
    expect(interiorAt({ x: 418, y: ALCHEMIA_T1, z: 62 })).toBeNull();
  });

  it("is a floor of its own: apart from T1 at any height, its roof apart from its floor", () => {
    const sim = loaded();
    expect(heightApart(sim.world, { x: 416, y: F, z: 55 }, { x: 416, y: F, z: 60 })).toBe(Infinity);
    expect(heightApart(sim.world, { x: 418, y: F, z: 45 }, { x: 418, y: R, z: 45 })).toBeCloseTo(R - F, 6);
    expect(heightApart(sim.world, { x: 418, y: F, z: 45 }, { x: 428, y: F, z: 40 })).toBe(0);
  });

  it("sees in from T1 through the way in and the east door, not through the glass", () => {
    const sim = loaded();
    const eye = (p: Vec3) => up(p, EYE_HEIGHT);
    const x = (opening("entrance").x0 + opening("entrance").x1) / 2;
    expect(lineOfSight(sim.world, eye({ x, y: ALCHEMIA_T1, z: 64 }), eye({ x, y: F, z: 50 }))).toBe(true);
    // The east door into the north-east core's corridor (ADR-0093 O3, where Oyaji's back door was).
    const east = (opening("east-door").x0 + opening("east-door").x1) / 2;
    expect(lineOfSight(sim.world, eye({ x: east, y: ALCHEMIA_T1, z: 62 }), eye({ x: east, y: F, z: 54 }))).toBe(true);
    // Through the glass beside the way in, to the same point inside: no.
    expect(lineOfSight(sim.world, eye({ x: x + 6.5, y: ALCHEMIA_T1, z: 64 }), eye({ x: x + 6.5, y: F, z: 49 }))).toBe(false);
    // Fumiko across the hatch of her second place on P0 from before it on T1 (O3).
    expect(lineOfSight(sim.world, eye(beforeHatch()), eye(FUMIKO_WINDOW_SPOT))).toBe(true);
  });
});

describe("Alchemia in the level graph (ADR-0074 §5)", () => {
  it("is part of the city's graph, every node on its floor", () => {
    const ids = new Set(WORLD_NAV.nodes.map((n) => n.id));
    for (const n of ALCHEMIA_NAV.nodes) expect(ids.has(n.id), n.id).toBe(true);
    const g = loaded().streamer.ground;
    // P-1's nodes (stage 4) stand on its floor, ramp and stairs: `alchemia-parking.test.ts`; P-2's (stage 5a): `alchemia-p2.test.ts`; the shelter's (5d1): `alchemia-shelter.test.ts`.
    for (const n of ALCHEMIA_NAV.nodes.filter((n) => !n.id.startsWith("alchemia-p1-") && !n.id.startsWith("alchemia-p2-") && !n.id.startsWith("alchemia-shelter-"))) {
      const inHall = n.at.x >= FOODHALL.minX && n.at.x <= FOODHALL.maxX && n.at.z >= FOODHALL.minZ && n.at.z <= FOODHALL.maxZ;
      // Over the hall the gallery's floors and its cores' mid landings (ADR-0093 O1; each node on a solid top: `alchemia-mall.test.ts`).
      const floors = [F, ...MALL_FLOORS, ...STAIR_CORES.flatMap((c) => c.floors.slice(0, -1).map((y, i) => (y + c.floors[i + 1]!) / 2))];
      const floor = inHall ? floors.reduce((a, b) => (Math.abs(b - n.at.y) < Math.abs(a - n.at.y) ? b : a)) : g.heightAt(n.at.x, n.at.z);
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

  it("leads from T1, the car park and the roof to every keeper in the food hall on P3, and to Fumiko's hatch on P0 (ADR-0093 O3)", () => {
    const sim = loaded();
    const starts = [node("alchemia-t1-west"), node("alchemia-t0-roof"), { x: 434.9, y: R, z: 50 }, { x: 397, y: groundY(397, 44), z: 44 }];
    for (const s of starts) {
      // Before the counters (behind Fumiko's by its flap: the floor's raster, `alchemia-food-court.test.ts`), and behind her hatch on P0 through its own door.
      for (const key of Object.keys(STALL_KEEPERS) as (keyof typeof STALL_KEEPERS)[]) {
        expect(routeAcrossLevels(sim.world, WORLD_NAV, s, beforeKeeper(key)), `${s.x},${s.z} to ${key}`).not.toBeNull();
      }
      expect(routeAcrossLevels(sim.world, WORLD_NAV, s, FUMIKO_WINDOW_SPOT), `${s.x},${s.z} behind her hatch`).not.toBeNull();
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

  it("an alerted brawler on the car park gets to the player in the hall (P0) down the stairs", () => {
    // Before Kenta's counter until ADR-0093 O3 took it up to P3: the hall's floor is P0's shops' now (`alchemia-food-court.test.ts` chases up there).
    for (const seed of [3, 11]) expect(chase(onGround(428, 10), IN_HALL, 30, seed), `seed ${seed}`).not.toBeNull();
  });

  it("an alerted brawler on T1 gets to the player in the hall through the way in, and one in the hall to her on T1", () => {
    expect(chase(onGround(397, 62), IN_HALL, 20)).not.toBeNull();
    expect(chase(IN_HALL, onGround(430, 66), 20)).not.toBeNull();
  });

  it("an alerted brawler in the hall gets to the player on the green roof, up the stairs", () => {
    // On the roof's east strip, beside tier A (15.11).
    expect(chase(IN_HALL, { x: 434.9, y: FOODHALL.roof, z: 50 }, 30)).not.toBeNull();
  });

  it("the lift goes from P-2 by the hall's floor to the roof, its top door onto the car park, its bottom one into P-2's corridor (stage 5c)", () => {
    // On up through the gallery's P2, P3 and roof since ADR-0093 O1 (`alchemia-mall.test.ts`).
    expect(ALCHEMIA_LIFT.levels).toEqual([P2.floor, F, R, ...MALL_FLOORS.slice(2)]);
    const pit = ALCHEMIA_LIFT.doors[0]!;
    expect(pit.x).toBeGreaterThan(P2_CORRIDOR.minX + 0.5);
    expect(pit.x).toBeLessThan(P2_CORRIDOR.maxX - 0.5);
    expect(pit.y).toBe(P2.floor);
    // The corridor's west wall is open where the shaft stops: the shell leaves the span the gate fills.
    const p2 = ALCHEMIA_LIFT.p2Door;
    const wallInDoor = P2_SHELL_PIECES.filter((p) => p.kind === "wall" && p.box.x0 < P2_CORRIDOR.minX + 0.4 && p.box.x1 > P2_CORRIDOR.minX && p.box.z1 > p2.z0 + 0.01 && p.box.z0 < p2.z1 - 0.01 && p.box.y0 < p2.top - 0.01);
    expect(wallInDoor).toEqual([]);
    const top = ALCHEMIA_LIFT.doors[2]!;
    expect(top.z).toBeLessThan(FOODHALL.minZ);
    expect(Math.abs(groundY(top.x, top.z) - R)).toBeLessThan(0.1);
    expect(ALCHEMIA_PIECES.length).toBeGreaterThan(100);
  });
});
