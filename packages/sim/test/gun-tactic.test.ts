import { describe, expect, it } from "vitest";
import { ENEMY_TYPES, type EnemyTypeId, type Vec3, npcBand } from "@seki/core";
import { type Entity, SIM_HZ, Simulation, gangerEntity, stateHash } from "../src";
import { PAUSE_MIN, sidestepProbes } from "../src/systems/ai/ganger-tactic";
import { BYSTRZYCA_FENCE, barrierFloor, barrierSim, off, pieceAt } from "./fixtures/barrier-floor";
import { byKey, collect, streetSim, teleportPlayer } from "./helpers";

/*
 * ADR-0089 stage 3: a gunner in its weapon's band steps aside round the player between its
 * bursts and pauses after each. In the band it goes 2 m or more aside in 5 s, stays in the band
 * and turns its way at most twice in 3 s; in every 4 s of its fire there is a gap of more than
 * 0.6 s. Its sidestep takes no way through a fence (the Bystrzyca's, `barrier-floor.ts`) nor
 * off the viaduct of Zamkowa (G-255). A game saved mid-sidestep or mid-pause goes on as the
 * unsaved one.
 */

const BANDED = (Object.keys(ENEMY_TYPES) as EnemyTypeId[]).filter((t) => npcBand(ENEMY_TYPES[t].weapon));
type Shot = { readonly shooterId: number };

/** The player standing (kept alive), an alerted `type` `d` m north of her, nobody else armed. */
const duel = (sim: Simulation, type: EnemyTypeId, d: number, from?: Vec3): Entity => {
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  const p = sim.player()!;
  const at = from ?? { ...p.position, z: p.position.z + d };
  const g = gangerEntity(90089, { key: "tactic", position: at, yaw: Math.PI }, null, 1e6, sim.streamer.chunkIdAt(at), undefined, type);
  g.ai!.alerted = true;
  sim.world.add(g);
  return g;
};

const step = (sim: Simulation): void => {
  const p = sim.player()!;
  p.health = { ...p.health!, current: p.health!.max };
  sim.step();
};

/** Its way round the player per step: + one way, - the other, 0 standing (m). */
const aside = (g: Entity, p: Entity, before: Vec3): number => {
  const dx = before.x - p.position.x;
  const dz = before.z - p.position.z;
  const d = Math.hypot(dx, dz) || 1;
  return ((g.position.x - before.x) * -dz + (g.position.z - before.z) * dx) / d;
};

describe("a gunner steps aside round the player in its band (ADR-0089 stage 3)", () => {
  for (const type of BANDED) {
    it(`${type}: 2 m aside in 5 s, in its band, at most two turns in 3 s`, () => {
      const band = npcBand(ENEMY_TYPES[type].weapon)!;
      const sim = streetSim({ seed: 3 });
      sim.step();
      const g = duel(sim, type, (band.min + band.max) / 2);
      const p = sim.player()!;
      let path = 0;
      const turns: number[] = [];
      let way = 0;
      for (let i = 0; i < 5 * SIM_HZ; i++) {
        const before = { ...g.position };
        step(sim);
        const a = aside(g, p, before);
        path += Math.abs(a);
        const d = Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z);
        expect(d, `step ${i}`).toBeGreaterThanOrEqual(band.min - 0.5);
        expect(d, `step ${i}`).toBeLessThanOrEqual(band.max + 0.5);
        if (Math.abs(a) > 1e-3) {
          const now = Math.sign(a);
          if (way !== 0 && now !== way) turns.push(i);
          way = now;
        }
      }
      expect(path).toBeGreaterThanOrEqual(2);
      for (const t of turns) expect(turns.filter((u) => u >= t && u < t + 3 * SIM_HZ).length, `turns from step ${t}`).toBeLessThanOrEqual(2);
    });
  }

  it.each(["hebi_ganger", "tessen_guard", "hebi_lookout"] as const)("%s pauses: every 4 s of its fire has a gap of more than 0.6 s", (type) => {
    const band = npcBand(ENEMY_TYPES[type].weapon)!;
    const sim = streetSim({ seed: 5 });
    sim.step();
    const g = duel(sim, type, (band.min + band.max) / 2);
    const shots = collect<Shot>(sim, "ShotFired");
    const at: number[] = [];
    for (let i = 0; i < 16 * SIM_HZ; i++) {
      const n = shots.length;
      step(sim);
      if (shots.slice(n).some((s) => s.shooterId === g.id)) at.push(i / SIM_HZ);
    }
    expect(at.length).toBeGreaterThan(6);
    const first = at[0]!;
    const last = at[at.length - 1]!;
    for (let t = first; t + 4 <= last; t += 0.5) {
      const inside = [t, ...at.filter((s) => s > t && s < t + 4), t + 4];
      const gap = Math.max(...inside.slice(1).map((s, k) => s - inside[k]!));
      expect(gap, `window from ${t.toFixed(2)} s`).toBeGreaterThan(PAUSE_MIN);
    }
  });

  it("takes no way through the Bystrzyca's fence: with the way on one side shut it goes the other", () => {
    const fence = pieceAt(barrierFloor(BYSTRZYCA_FENCE), BYSTRZYCA_FENCE.x, BYSTRZYCA_FENCE.z).item;
    const { sim, chunks } = barrierSim(off(fence, -0.9), BYSTRZYCA_FENCE);
    const { item } = pieceAt(chunks, BYSTRZYCA_FENCE.x, BYSTRZYCA_FENCE.z);
    // The fence's normal is (cos yaw, -sin yaw); the player 11 m along it from the ganger, which stands 0.9 m off it.
    const along = { x: Math.sin(item.yaw), z: Math.cos(item.yaw) };
    const start = off(item, -0.9);
    const p = sim.player()!;
    teleportPlayer(sim, { x: start.x + along.x * 11, y: p.position.y, z: start.z + along.z * 11 });
    const g = duel(sim, "hebi_ganger", 0, { x: start.x, y: p.position.y, z: start.z });
    const side = (q: Vec3) => (q.x - item.x) * Math.cos(item.yaw) - (q.z - item.z) * Math.sin(item.yaw);
    let path = 0;
    for (let i = 0; i < 6 * SIM_HZ; i++) {
      const before = { ...g.position };
      step(sim);
      path += Math.abs(aside(g, p, before));
      expect(side(g.position), `step ${i}`).toBeLessThan(0);
    }
    expect(path).toBeGreaterThan(1);
  });

  it("keeps off the edge of Zamkowa's viaduct over the steps (G-255): its feet stay on the deck", () => {
    const sim = Simulation.create({ seed: 3 });
    const TOP = { x: 742, z: 163 };
    teleportPlayer(sim, { x: TOP.x - 10, y: 0, z: TOP.z });
    sim.step();
    const ground = sim.streamer.ground;
    const p = sim.player()!;
    p.position = { x: TOP.x - 10, y: ground.heightAt(TOP.x - 10, TOP.z), z: TOP.z };
    p.prevPosition = p.position;
    const at = { x: TOP.x, y: ground.heightAt(TOP.x, TOP.z), z: TOP.z };
    const g = duel(sim, "hebi_ganger", 0, at);
    let lowest = Infinity;
    for (let i = 0; i < 8 * SIM_HZ; i++) {
      step(sim);
      lowest = Math.min(lowest, g.position.y - ground.heightAt(g.position.x, g.position.z));
    }
    expect(lowest).toBeGreaterThan(-0.05);
  });
});

describe("a gunner's burst and sidestep in the save (ADR-0089 stage 3)", () => {
  /** The alley's guard alerted 11 m from the player, the street as it is, until `when` holds; then the same game and its load, 600 steps on. */
  const goesOn = (when: (g: Entity) => boolean) => {
    const sim = Simulation.create({ seed: 11 });
    const guard = byKey(sim, "guard")!;
    teleportPlayer(sim, { x: guard.position.x, y: guard.position.y, z: guard.position.z - 11 });
    guard.ai!.alerted = true;
    let i = 0;
    for (; i < 20 * SIM_HZ && !when(guard); i++) step(sim);
    expect(when(guard), "the state was reached").toBe(true);
    const loaded = Simulation.fromSnapshot(JSON.parse(JSON.stringify(sim.snapshot(null, "t", ""))));
    expect(byKey(loaded, "guard")!.ai!.tactic).toEqual(guard.ai!.tactic);
    for (let k = 0; k < 600; k++) {
      step(sim);
      step(loaded);
    }
    expect(stateHash(loaded.snapshot(null, "t", ""))).toBe(stateHash(sim.snapshot(null, "t", "")));
  };

  it("saved mid-sidestep, the loaded game goes on as the saved one", () => goesOn((g) => (g.ai?.tactic?.stride ?? 0) > 0.5));

  it("saved mid-pause after a burst, the loaded game goes on as the saved one", () =>
    goesOn((g) => g.ai?.tactic !== undefined && g.ai.tactic.shots === g.ai.burst && (g.combatant?.cooldown ?? 0) > 1));
});

const host = globalThis as { console?: { info(s: string): void } };

describe("what the sidesteps cost a step (ADR-0089 stage 3, budget)", () => {
  /** `n` alerted Hebi gangers in a ring 11 m round the player on Krakowskie, 10 s of their fight. */
  const ring = (n: number) => {
    const sim = streetSim({ seed: 3 });
    sim.step();
    for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
    const p = sim.player()!;
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n;
      const at = { x: p.position.x + Math.sin(a) * 11, y: p.position.y, z: p.position.z + Math.cos(a) * 11 };
      const g = gangerEntity(90100 + i, { key: `ring-${i}`, position: at, yaw: a + Math.PI }, null, 1e6, sim.streamer.chunkIdAt(at), undefined, "hebi_ganger");
      g.ai!.alerted = true;
      sim.world.add(g);
    }
    const per: number[] = [];
    for (let i = 0; i < 10 * SIM_HZ; i++) {
      const before = sidestepProbes(sim.world);
      step(sim);
      per.push(sidestepProbes(sim.world) - before);
    }
    return { most: Math.max(...per), mean: per.reduce((a, b) => a + b, 0) / per.length };
  };

  /**
   * A gunner picks a sidestep at most once in 1.5 s (the shortest sidestep and rest) and tries two
   * ways at most: that bounds the mean. Measured 17.11: at most 2 and 3 a step, 0.08 and 0.14 on
   * average; a step's most is held at twice that.
   */
  it.each([
    [10, 4],
    [18, 6],
  ])("%i gunners: at most %i ways tried a step, two each in 1.5 s on average", (n, most) => {
    const cost = ring(n);
    host.console?.info(`sidestep probes, ${n} gunners: most ${cost.most} a step, ${cost.mean.toFixed(2)} on average`);
    expect(cost.most).toBeLessThanOrEqual(most);
    expect(cost.mean).toBeLessThanOrEqual((2 * n) / (1.5 * SIM_HZ));
  });
});
