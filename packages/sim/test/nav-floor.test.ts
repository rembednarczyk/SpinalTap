import { describe, expect, it } from "vitest";
import { type EnemyTypeId, type Vec3, contractTag } from "@seki/core";
import { DOCKS_PLACE, MARKET_PLACE, OYAJI_MAX_HP, Simulation, docks, gangerEntity, market, stateHash } from "../src";
import { chestOf, eyeOf, lineOfSight } from "../src/world/hitscan";
import { detourStep, steerPoint, straightWalk } from "../src/systems/ai/steering";
import { byKey, teleportPlayer } from "./helpers";

/**
 * The market and the docks keep their own coordinates, moved into Lublin by `MARKET_PLACE` and
 * `DOCKS_PLACE` (ADR-0045): `atM` and `atD` are points of them.
 */
const atM = (x: number, z: number, y = 0): Vec3 => market(x, y, z);
const atD = (x: number, z: number, y = 0): Vec3 => docks(x, y, z);
const M = MARKET_PLACE;
const D = DOCKS_PLACE;

/** Keeps the player alive and in place: the tests are about where the gangers go. */
const hold = (sim: Simulation, steps: number, each?: () => boolean): number => {
  for (let i = 0; i < steps; i++) {
    const me = sim.player()!;
    me.health = { ...me.health!, current: me.health!.max };
    sim.step();
    if (each?.()) return i;
  }
  return steps;
};

/** The player stands at `p`; every other ganger is gone. */
const scene = (p: Vec3, seed = 5): Simulation => {
  const sim = Simulation.create({ seed });
  teleportPlayer(sim, p);
  sim.step();
  sim.step();
  teleportPlayer(sim, p);
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return sim;
};

let nextId = 9500;
const spawn = (sim: Simulation, where: Vec3, type: EnemyTypeId = "hebi_brawler", home: Vec3 = where) => {
  const g = gangerEntity(nextId++, { key: `floor-${nextId}`, position: home, yaw: 0 }, null, 400, sim.streamer.chunkIdAt(where), undefined, type);
  g.position = where;
  g.prevPosition = where;
  g.ai!.alerted = true;
  sim.world.add(g);
  return g;
};

const sees = (sim: Simulation, g: { position: Vec3 }) => lineOfSight(sim.world, eyeOf(g as never), chestOf(sim.player()!));
const flat = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);

describe("walking around obstacles on one floor (ADR-0025, audit W3)", () => {
  it("W3: after Oyaji dies, the raid wave gets Seki in sight from behind the overpass stairs", () => {
    // Seed 2 with six jobs done: a raid of four (two gunners, a brawler, a gunner).
    const base = Simulation.create({ seed: 2 });
    const snap = base.snapshot(null, "t", "");
    const sim = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, contracts: { active: null, completed: 6 } } });
    teleportPlayer(sim, atM(90.5, 74), Math.PI / 2);
    sim.step();
    sim.enqueue({ type: "accept-contract", kind: "protect" });
    sim.step();
    const c = sim.domain.contracts.active!;
    expect(c).toMatchObject({ kind: "protect", targets: 4 });
    const wave = [...sim.world.with("ai")].filter((e) => e.tag === contractTag(c.id));
    // Hebi kill Oyaji; the job fails, the wave stays and turns on Seki.
    const oyaji = byKey(sim, "oyaji")!;
    oyaji.lastHitBy = wave[0]!.id;
    oyaji.health = { current: 0, max: OYAJI_MAX_HP };
    sim.step();
    expect(sim.domain.flags).toContain("dead:oyaji");
    // The audit's stand: all four under the south rail of the stairs, Seki north of the flight.
    wave.forEach((g, i) => {
      g.position = atM(71.3 + i * 0.65, 96.6);
      g.prevPosition = g.position;
      g.ai.alerted = true;
    });
    const seki = atM(70, 104);
    teleportPlayer(sim, seki);
    // The straight walk runs into the rail: the old pursuit pressed against it for good.
    for (const g of wave) expect(straightWalk(sim.world, g.position, seki)).toBe(false);
    expect(wave.filter((g) => !sees(sim, g)).length).toBeGreaterThanOrEqual(2);
    const seen = new Map<number, number>();
    const start = sim.tick;
    const brawler = wave.find((g) => g.combatant?.stats?.melee)!;
    let brawlerAt = -1;
    hold(sim, 60 * 20, () => {
      for (const g of wave) if (!seen.has(g.id) && sees(sim, g)) seen.set(g.id, sim.tick - start);
      if (brawlerAt < 0 && flat(brawler.position, seki) < 2.5) brawlerAt = sim.tick - start;
      return seen.size === wave.length && brawlerAt >= 0;
    });
    // Every one of them has a line on Seki within 6 s (the audit measured over 20 s without one)...
    expect(seen.size).toBe(wave.length);
    expect(Math.max(...seen.values())).toBeLessThan(60 * 6);
    // ...and the brawler went round the end of the flight to her.
    expect(brawlerAt).toBeGreaterThan(0);
    expect(brawlerAt).toBeLessThan(60 * 8);
  });

  it("goes round the west end of the overpass stairs to a target on the far side", () => {
    const target = atM(76, 102);
    const sim = scene(target);
    const g = spawn(sim, atM(80, 95));
    const reached = hold(sim, 60 * 15, () => flat(g.position, target) < 2.5);
    expect(reached).toBeLessThan(60 * 15);
    // On the street the whole way: it went round the flight, not over it.
    expect(g.position.y - M.y).toBeLessThan(0.5);
  });

  it("the way round is a pure function: same query, same step, with or without the memo", () => {
    const sim = scene(atM(70, 104));
    const a = detourStep(sim.world, atM(72, 96.6), atM(70, 104));
    const fresh = Simulation.create({ seed: 5 });
    teleportPlayer(fresh, atM(70, 104));
    fresh.step();
    fresh.step();
    const b = detourStep(fresh.world, atM(72, 96.6), atM(70, 104));
    expect(a).not.toBeNull();
    expect(a).toEqual(b);
    // It leads west, towards the gap between the wall and the end of the stairs.
    expect(a!.x - M.x).toBeLessThan(72);
    // A free line is walked straight; a goal on another floor is the level graph's business.
    expect(steerPoint(sim.world, atM(80, 92), atM(90, 92))).toEqual(atM(90, 92));
    expect(detourStep(sim.world, atM(80, 92), atM(90, 92, 9.9))).toBeNull();
  });

  it("a save while walking round the stairs continues exactly like the original", () => {
    const target = atM(76, 102);
    const sim = Simulation.create({ seed: 5 });
    teleportPlayer(sim, target);
    sim.step();
    sim.step();
    teleportPlayer(sim, target);
    // The market's own lookout (a keyed ganger, so the save carries it), sent round the flight.
    const g = byKey(sim, "hebi-lookout")!;
    g.position = atM(80, 95);
    g.prevPosition = g.position;
    g.ai!.alerted = true;
    hold(sim, 90);
    expect(g.position.x - M.x).toBeLessThan(78);
    const restored = Simulation.fromSnapshot(JSON.parse(JSON.stringify(sim.snapshot(null, "mid", ""))));
    hold(sim, 240);
    hold(restored, 240);
    expect(stateHash(restored.snapshot(null, "t", ""))).toBe(stateHash(sim.snapshot(null, "t", "")));
    expect(byKey(restored, "hebi-lookout")!.position).toEqual(g.position);
  });
});

describe("the docks (ADR-0025)", () => {
  it("crosses the container rows in the yard without getting stuck", () => {
    // Seki in the north aisle, the ganger south of the first row: a wall of containers between.
    const target = atD(0, 113.5);
    const sim = scene(target);
    const g = spawn(sim, atD(-4, 97));
    let anchor = g.position;
    let anchorTick = sim.tick;
    const reached = hold(sim, 60 * 25, () => {
      if (flat(g.position, target) < 2.5) return true;
      if (flat(g.position, anchor) >= 0.5) {
        anchor = g.position;
        anchorTick = sim.tick;
      }
      // Never 2 s without covering half a metre.
      expect(sim.tick - anchorTick).toBeLessThan(60 * 2);
      return false;
    });
    expect(reached).toBeLessThan(60 * 25);
  });

  it("walks round the containers on the quay and the office to a target behind them", () => {
    const target = atD(-13, 148.4);
    const sim = scene(target);
    const g = spawn(sim, atD(-13, 141));
    const reached = hold(sim, 60 * 20, () => flat(g.position, target) < 2.5);
    expect(reached).toBeLessThan(60 * 20);
  });

  it("takes the warehouse stairs in the docks", () => {
    const target = atD(-23, 116.8, 9);
    const sim = scene(target);
    const g = spawn(sim, atD(10, 105));
    const reached = hold(sim, 60 * 40, () => g.position.y - D.y > 8.9 && flat(g.position, target) < 2.5);
    expect(reached).toBeLessThan(60 * 40);
  });
});
