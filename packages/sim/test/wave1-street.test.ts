import { describe, expect, it, vi } from "vitest";
import { type DomainEvents, HEAT_SEARCH_SECONDS, NO_HEAT, type SaveSnapshot, WITNESS_CALL_SECONDS } from "@seki/core";
import {
  COWER_SECONDS,
  FLEE_SECONDS,
  SEARCH_SECONDS,
  SIM_HZ,
  SPAWN_MIN,
  Simulation,
  gangerEntity,
  inPlayerView,
  stateHash,
} from "../src";
import { byKey, collect, input, run, teleportPlayer, streetSim } from "./helpers";

// Long runs of the street (a 20 s search, four directions of spawns): roomy on a busy machine.
vi.setConfig({ testTimeout: 20_000 });

const at = (x: number, z: number, y = 0) => ({ x, y, z });
const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** The player cannot die in these tests: they are about who sees what. */
const tough = (sim: Simulation) => {
  const p = sim.player()!;
  p.health = { current: 1e6, max: 1e6 };
};

/** One shot into the sky from where the player stands (the weapon is drawn after one step). */
const fireUp = (sim: Simulation) => {
  sim.player()!.pitch = -0.6;
  sim.step(input({ fire: true }));
};

describe("last known position (ADR-0029)", () => {
  it("a ganger that lost the player goes where it last saw them, looks around, then goes home", () => {
    const sim = streetSim({ seed: 3 });
    tough(sim);
    const home = at(0, 0);
    const g = gangerEntity(90001, { key: "watcher", position: home, yaw: 0 }, null, 80, "shinsekai-7");
    sim.world.add(g);
    const seen = collect<DomainEvents["AwarenessChanged"]>(sim, "AwarenessChanged");
    teleportPlayer(sim, at(0, 8), Math.PI);
    for (let i = 0; i < 60 && !g.ai!.alerted; i++) sim.step();
    expect(g.ai!.alerted).toBe(true);
    // Into the alley behind the west block, out of its sight, long enough for the trail to go cold.
    const hide = at(-10, 16);
    teleportPlayer(sim, hide, 0);
    run(sim, 2 * SIM_HZ);
    expect(flat(g.ai!.lastKnown!, hide)).toBeLessThan(0.5);
    // Then far away: it still goes to the alley, not to where the player really is.
    teleportPlayer(sim, at(0, -36), 0);
    let searchAt: { x: number; z: number } | null = null;
    for (let i = 0; i < 20 * SIM_HZ && !searchAt; i++) {
      sim.step();
      if ((g.ai!.search ?? 0) > 0) searchAt = { ...g.position };
    }
    expect(searchAt).not.toBeNull();
    expect(flat(searchAt!, hide)).toBeLessThan(2.5);
    expect(g.ai!.alerted).toBe(false);
    expect(seen.filter((e) => e.observerId === g.id).map((e) => e.state)).toContain("searching");
    run(sim, (SEARCH_SECONDS + 0.5) * SIM_HZ);
    expect(g.ai!.lastKnown).toBeNull();
    run(sim, 6 * SIM_HZ);
    expect(flat(g.position, home)).toBeLessThan(flat(g.position, hide));
    // Awareness went out on changes only: a handful of events, not one per tick.
    const mine = seen.filter((e) => e.observerId === g.id);
    expect(mine.length).toBeGreaterThan(2);
    expect(mine.length).toBeLessThan(12);
    expect(mine.at(-1)).toMatchObject({ state: "unaware", level: 0, lastKnown: null });
  });

  it("the search survives a save and continues the same", () => {
    const sim = streetSim({ seed: 3 });
    tough(sim);
    const guard = byKey(sim, "guard")!;
    guard.ai!.lastKnown = at(-2, 20);
    guard.ai!.search = 0;
    run(sim, 60);
    const restored = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "s", "")));
    expect(byKey(restored, "guard")!.ai!.lastKnown).toEqual(guard.ai!.lastKnown);
    for (let i = 0; i < 240; i++) {
      sim.step();
      restored.step();
    }
    expect(hash(restored)).toBe(hash(sim));
  });
});

describe("the crowd (ADR-0029)", () => {
  it("a shot sends a bystander running away from it, a close one floors it first; then it calms down", () => {
    const sim = streetSim({ seed: 4 });
    const ume = byKey(sim, "ume")!;
    const reacted = collect<DomainEvents["CrowdReacted"]>(sim, "CrowdReacted");
    const noise = collect<DomainEvents["Disturbance"]>(sim, "Disturbance");
    // South of her on the street: the way away from the shot is open, up the street.
    teleportPlayer(sim, at(ume.position.x + 1, ume.position.z - 9), 0);
    sim.step();
    const origin = { ...sim.player()!.position };
    fireUp(sim);
    expect(noise[0]).toMatchObject({ kind: "gunshot", sourceId: sim.player()!.id });
    sim.step();
    expect(reacted).toEqual([{ entityId: ume.id, state: "fleeing" }]);
    const d0 = flat(ume.position, origin);
    run(sim, 2 * SIM_HZ);
    expect(flat(ume.position, origin)).toBeGreaterThan(d0 + 3);
    run(sim, (FLEE_SECONDS + 1) * SIM_HZ);
    expect(reacted.at(-1)).toEqual({ entityId: ume.id, state: "calm" });

    // Point blank: cowering, then running, then calm.
    const close = streetSim({ seed: 4 });
    const u = byKey(close, "ume")!;
    const seen = collect<DomainEvents["CrowdReacted"]>(close, "CrowdReacted");
    teleportPlayer(close, at(u.position.x + 3, u.position.z), -Math.PI / 2);
    close.step();
    fireUp(close);
    // Looking away: a gun pointed at her would keep her down (intimidation).
    close.player()!.yaw = 0;
    close.step();
    expect(seen[0]).toEqual({ entityId: u.id, state: "cowering" });
    const still = { ...u.position };
    run(close, (COWER_SECONDS - 0.5) * SIM_HZ);
    expect(flat(u.position, still)).toBeLessThan(0.05);
    run(close, (FLEE_SECONDS + 1.5) * SIM_HZ);
    expect(seen.filter((e) => e.entityId === u.id).map((e) => e.state)).toEqual(["cowering", "fleeing", "calm"]);
  });
});

describe("the street people of ADR-0026 in the crowd", () => {
  it("everyone on Ulica Kanałowa and at the market stalls reacts to a shot nearby", () => {
    for (const keys of [["hideo", "tetsu", "mei", "sachiko"], ["kenta", "fumiko", "goro"]]) {
      for (const key of keys) {
        const sim = streetSim({ seed: 7 });
        const first = byKey(sim, key);
        // Stream the person's chunk in: stand on them first, then step back.
        const spot = first?.position ?? sim.streamer.chunks.flatMap((c) => c.actors).find((a) => a.spawn.key === key)!.spawn.position;
        teleportPlayer(sim, at(spot.x, spot.z), 0);
        sim.step();
        const npc = byKey(sim, key)!;
        teleportPlayer(sim, at(npc.position.x + 2, npc.position.z, npc.position.y), 0);
        sim.step();
        fireUp(sim);
        sim.step();
        // Floored by the close shot.
        expect(npc.civilian?.crowd?.state, key).toBe("cowering");
      }
    }
  });
});

describe("witnesses, the call and the heat (ADR-0028, ADR-0029)", () => {
  /** Seki fires into the sky in front of babcia Ume, with no gang fighting nearby: a crime. */
  const shootInFrontOfUme = (seed = 5) => {
    const sim = streetSim({ seed });
    tough(sim);
    const ume = byKey(sim, "ume")!;
    teleportPlayer(sim, at(ume.position.x + 9, ume.position.z), -Math.PI / 2);
    sim.step();
    const calls = collect<DomainEvents["WitnessCalling"]>(sim, "WitnessCalling");
    const reports = collect<DomainEvents["CrimeReported"]>(sim, "CrimeReported");
    const heat = collect<DomainEvents["HeatChanged"]>(sim, "HeatChanged");
    fireUp(sim);
    return { sim, ume, calls, reports, heat };
  };

  it("a civilian who saw it phones it in after a few seconds; the heat goes up for Hebi", () => {
    const { sim, ume, calls, reports, heat } = shootInFrontOfUme();
    expect(calls).toEqual([{ witnessId: ume.id, crime: "gunfire", duration: WITNESS_CALL_SECONDS }]);
    expect(reports).toHaveLength(0);
    run(sim, (WITNESS_CALL_SECONDS - 0.2) * SIM_HZ);
    expect(reports).toHaveLength(0);
    run(sim, 0.4 * SIM_HZ);
    expect(reports).toEqual([expect.objectContaining({ crime: "gunfire", channel: "civilian", witnessId: ume.id, offenderId: sim.player()!.id })]);
    expect(sim.domain.heat).toMatchObject({ level: 1, faction: "hebi" });
    expect(heat[0]).toMatchObject({ level: 1, previous: 0, faction: "hebi" });
  });

  it("a dead witness does not get through", () => {
    const { sim, ume, calls, reports } = shootInFrontOfUme();
    expect(calls).toHaveLength(1);
    sim.world.addComponent(ume, "health", { current: 0, max: 50 });
    run(sim, (WITNESS_CALL_SECONDS + 1) * SIM_HZ);
    expect(byKey(sim, "ume")).toBeUndefined();
    expect(reports).toHaveLength(0);
    expect(sim.domain.heat).toEqual(NO_HEAT);
  });

  it("a witness the player aims at from close by drops the phone", () => {
    const { sim, ume, reports } = shootInFrontOfUme();
    const reacted = collect<DomainEvents["CrowdReacted"]>(sim, "CrowdReacted");
    const p = sim.player()!;
    teleportPlayer(sim, at(ume.position.x + 3, ume.position.z), -Math.PI / 2);
    p.pitch = 0;
    sim.step();
    expect(reacted.at(-1)).toEqual({ entityId: ume.id, state: "cowering" });
    expect(ume.civilian!.crowd!.call).toBeNull();
    run(sim, (WITNESS_CALL_SECONDS + 1) * SIM_HZ);
    expect(reports).toHaveLength(0);
  });

  it("a witness who runs out of the loaded world does not get through", () => {
    const { sim, reports } = shootInFrontOfUme();
    // Far enough that Shinsekai unloads: Ume goes to sleep with her chunk, her call with her.
    teleportPlayer(sim, at(110, 100), 0);
    run(sim, 2);
    expect(sim.streamer.isLoaded("shinsekai-7")).toBe(false);
    run(sim, (WITNESS_CALL_SECONDS + 1) * SIM_HZ);
    expect(reports).toHaveLength(0);
  });

  it("reinforcements come in out of sight; losing them drops the heat after the search", () => {
    const { sim, reports, heat } = shootInFrontOfUme();
    run(sim, (WITNESS_CALL_SECONDS + 0.5) * SIM_HZ);
    expect(reports).toHaveLength(1);
    // Spawned at once (the first one does not wait), never in view, never close.
    const security = [...sim.world].filter((e) => e.security);
    expect(security).toHaveLength(1);
    const g = security[0]!;
    expect(g.key).toBeUndefined();
    expect(g.faction).toBe("hebi");
    expect(flat(g.position, sim.player()!.position)).toBeGreaterThanOrEqual(SPAWN_MIN);
    expect(heat.some((h) => h.searching)).toBe(true);
    // Away down Ulica Kanałowa, out of everyone's sight: the search runs out and the heat goes.
    teleportPlayer(sim, at(40, 78), Math.PI / 2);
    run(sim, (HEAT_SEARCH_SECONDS[1] + 1) * SIM_HZ);
    expect(sim.domain.heat).toEqual(NO_HEAT);
    expect(heat.at(-1)).toMatchObject({ level: 0, previous: 1, searching: false });
    run(sim, SIM_HZ);
    expect([...sim.world].filter((e) => e.security)).toHaveLength(0);
  });

  it("the heat and the search survive a save", () => {
    const { sim } = shootInFrontOfUme();
    run(sim, (WITNESS_CALL_SECONDS + 1) * SIM_HZ);
    const saved = sim.domain.heat;
    expect(saved.level).toBe(1);
    const restored = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "h", "")));
    expect(restored.domain.heat).toEqual(saved);
  });

  it("a reinforcement never comes in where the player looks", () => {
    const base = streetSim({ seed: 6 });
    const snap = base.snapshot(null, "t", "");
    const heat = { level: 2 as const, faction: "hebi" as const, searching: true, lastKnown: at(0, -20), searchLeft: 30, cooldown: 0 };
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const sim = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, heat } });
      teleportPlayer(sim, at(0, -20), yaw);
      const spawned: { x: number; z: number; inView: boolean }[] = [];
      for (let i = 0; i < 10 * SIM_HZ; i++) {
        const before = new Set([...sim.world].filter((e) => e.security).map((e) => e.id));
        sim.step();
        for (const e of sim.world) {
          if (e.security && !before.has(e.id)) spawned.push({ ...e.position, inView: inPlayerView({ world: sim.world } as never, sim.player()!, e.position) });
        }
        // The player stands still and looks the same way.
        teleportPlayer(sim, at(0, -20), yaw);
      }
      expect(spawned.length).toBeGreaterThan(0);
      for (const s of spawned) {
        expect(s.inView).toBe(false);
        expect(flat(s, at(0, -20))).toBeGreaterThanOrEqual(SPAWN_MIN);
      }
    }
  });
});
