import { describe, expect, it, vi } from "vitest";
import { ACTIVITY_IDS, type SaveSnapshot, hm } from "@seki/core";
import {
  ACTIVITY_SPOTS,
  ACTOR_ACTIVITIES,
  FLEE_SECONDS,
  KANAL_SPOTS,
  MAX_PASSERSBY_PER_CHUNK,
  PASSERSBY,
  ROUTINE_SLOT_SECONDS,
  SCHEDULES,
  SIM_HZ,
  SPOT_ACTIVITIES,
  Simulation,
  WORLD_CHUNKS,
  aabbFromCenter,
  activityOf,
  passerbyStop,
  planActivity,
  routineOf,
  spotNear,
  spotsOf,
  stateHash,
} from "../src";
import type { Entity } from "../src";
import { byKey, input, run, teleportPlayer } from "./helpers";

// Runs of a minute of game time and more: roomy on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

const at = (x: number, z: number) => ({ x, y: 0, z });
/** Hideo's stool at the SAKE bar on the Rynek. */
const SAKE = KANAL_SPOTS.hideoSake;
/** The chunk of the deptak with the clinic and Neon Koi, and the Rynek's (ADR-0045). */
const DEPTAK = "krakowskie-2-0";
const RYNEK = "stare-miasto-0-0";
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));
const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;

/** Skips time to the given minute of the day, in one step. */
const skipTo = (sim: Simulation, minute: number) => {
  const now = Math.floor((sim.clock.seconds % 86400) / 60);
  const minutes = (minute - now + 1440) % 1440;
  if (minutes > 0) sim.enqueue({ type: "wait", minutes });
  sim.step();
};

const passersby = (sim: Simulation, chunk?: string): Entity[] =>
  [...sim.world].filter((e) => e.passerby && (chunk === undefined || e.chunk === chunk)).sort((a, b) => a.id - b.id);

const fireUp = (sim: Simulation) => {
  sim.player()!.pitch = -0.6;
  sim.step(input({ fire: true }));
};

describe("activity plans (ADR-0040)", () => {
  it("a cycle changes every few minutes from the start of the stop and wraps", () => {
    const plan = { cycle: ["cook", "sweep"], minutes: 20 } as const;
    expect(planActivity("drink", { seconds: 0 })).toBe("drink");
    expect(planActivity(plan, { seconds: hm(16, 5) * 60 }, hm(16))).toBe("cook");
    expect(planActivity(plan, { seconds: hm(16, 25) * 60 }, hm(16))).toBe("sweep");
    expect(planActivity(plan, { seconds: hm(16, 45) * 60 }, hm(16))).toBe("cook");
    // Past midnight the stop still counts from its own start.
    expect(planActivity(plan, { seconds: hm(0, 15) * 60 }, hm(23, 50))).toBe("sweep");
  });

  it("every activity of the content is a known one", () => {
    const known = new Set(ACTIVITY_IDS);
    const plans = [...Object.values(ACTOR_ACTIVITIES), ...Object.values(SCHEDULES).flatMap((d) => d.stops.flatMap((s) => (s.activity ? [s.activity] : [])))];
    for (const p of plans) for (const a of typeof p === "string" ? [p] : p.cycle) expect(known.has(a)).toBe(true);
    for (const list of Object.values(SPOT_ACTIVITIES)) for (const a of list) expect(known.has(a)).toBe(true);
  });

  it("the stops of the named characters carry the activities the brief asks for", () => {
    const stop = (key: string, label: string) => SCHEDULES[key]?.stops.find((s) => s.label === label)?.activity;
    expect(stop("hideo", "sake")).toBe("drink");
    expect(stop("mei", "karaoke")).toMatchObject({ cycle: expect.arrayContaining(["smoke"]) });
    expect(stop("fumiko", "stragan")).toMatchObject({ cycle: ["cook", "sweep"] });
    expect(stop("oyaji", "stragan")).toMatchObject({ cycle: expect.arrayContaining(["cook", "sweep"]) });
    expect(ACTOR_ACTIVITIES.mori).toBe("terminal");
  });
});

describe("activities from the daily plan", () => {
  it("Hideo drinks at SAKE in the evening, stops when a shot sends him running and goes back to it", () => {
    const sim = Simulation.create({ seed: 5 });
    skipTo(sim, hm(22));
    // On the Rynek, a few steps from the SAKE bar (ADR-0045).
    teleportPlayer(sim, spotNear(SAKE.x + 3, SAKE.z + 3), 0);
    run(sim, 3);
    const hideo = byKey(sim, "hideo")!;
    expect(flat(hideo.position, SAKE)).toBeLessThan(0.1);
    expect(hideo.activity).toBe("drink");
    fireUp(sim);
    run(sim, 2);
    expect(hideo.civilian?.crowd?.state).not.toBe("calm");
    expect(hideo.activity).toBeUndefined();
    run(sim, (FLEE_SECONDS + 12) * SIM_HZ);
    expect(hideo.civilian?.crowd?.state).toBe("calm");
    // Calm again, he walks back to the bar and picks his drink up again.
    run(sim, 12 * SIM_HZ);
    expect(flat(hideo.position, SAKE)).toBeLessThan(0.35);
    expect(hideo.activity).toBe("drink");
  });

  it("a guard on a post stands watch; an alerted one does not", () => {
    const sim = Simulation.create({ seed: 1 });
    const clock = sim.clock;
    const guard = { id: 1, position: at(0, 0), prevPosition: at(0, 0), yaw: 0, prevYaw: 0, pitch: 0, ai: { home: at(0, 0), aggroRange: 18, attackRange: 20, alerted: false, cone: true, watch: { yaw: 0, phase: 0 } } } as Entity;
    expect(activityOf(guard, clock)).toBe("guard");
    expect(activityOf({ ...guard, ai: { ...guard.ai!, alerted: true } }, clock)).toBeNull();
    // Talking with the player is talking, whatever the habit.
    expect(activityOf({ ...guard, key: "mori" }, clock, true)).toBe("talk");
  });
});

describe("activity spots", () => {
  const solids = WORLD_CHUNKS.flatMap((c) => c.props.flatMap((p) => (p.solid && p.view.kind === "block" ? [aabbFromCenter(p.center, p.view.size)] : [])));
  const actors = WORLD_CHUNKS.flatMap((c) => c.actors.map((a) => a.spawn.position));

  it("stand inside their chunk, clear of every solid and of the named characters' places", () => {
    expect(ACTIVITY_SPOTS.length).toBeGreaterThanOrEqual(20);
    for (const s of ACTIVITY_SPOTS) {
      const chunk = WORLD_CHUNKS.find((c) => c.id === s.chunk)!;
      expect(chunk, s.id).toBeDefined();
      const b = chunk.bounds;
      expect(s.at.x >= b.minX && s.at.x <= b.maxX && s.at.z >= b.minZ && s.at.z <= b.maxZ, s.id).toBe(true);
      for (const box of solids) {
        if (box.max.y - s.at.y <= 0.3 || box.min.y - s.at.y >= 1.8) continue;
        const dx = Math.max(box.min.x - s.at.x, 0, s.at.x - box.max.x);
        const dz = Math.max(box.min.z - s.at.z, 0, s.at.z - box.max.z);
        expect(Math.hypot(dx, dz), s.id).toBeGreaterThanOrEqual(0.38);
      }
      for (const p of actors) if (Math.abs(p.y - s.at.y) < 1) expect(flat(p, s.at), s.id).toBeGreaterThan(1.5);
    }
    expect(new Set(ACTIVITY_SPOTS.map((s) => s.id)).size).toBe(ACTIVITY_SPOTS.length);
  });

  it("every chunk with passers-by has more spots than passers-by, and none has more than the cap", () => {
    for (const [chunk, count] of Object.entries(PASSERSBY)) {
      expect(count).toBeLessThanOrEqual(MAX_PASSERSBY_PER_CHUNK);
      expect(spotsOf(chunk).length, chunk).toBeGreaterThan(count);
    }
  });
});

describe("routines of the background passers-by (ADR-0040)", () => {
  it("a slot's plan is a pure function of seed, chunk and slot, with distinct spots", () => {
    const a = routineOf(7, RYNEK, 3, 1234);
    expect(routineOf(7, RYNEK, 3, 1234)).toEqual(a);
    expect(new Set(a.map((s) => s.spot.id)).size).toBe(3);
    for (const s of a) expect((s.spot.only ?? SPOT_ACTIVITIES[s.spot.kind]).includes(s.activity)).toBe(true);
    const many = Array.from({ length: 40 }, (_, slot) => routineOf(7, RYNEK, 3, slot).map((s) => s.spot.id).join());
    expect(new Set(many).size).toBeGreaterThan(10);
  });

  it("nights go to the bars, mornings to the vending machines", () => {
    const slotAt = (day: number, hour: number) => Math.floor((day * 86400 + hour * 3600) / ROUTINE_SLOT_SECONDS);
    const kinds = (hour: number) => Array.from({ length: 60 }, (_, day) => routineOf(11, DEPTAK, 3, slotAt(day, hour))).flat().map((s) => s.spot.kind);
    const count = (list: string[], kind: string) => list.filter((k) => k === kind).length;
    const night = kinds(23);
    const morning = kinds(7);
    expect(count(night, "bar")).toBeGreaterThan(count(night, "vending"));
    expect(count(morning, "bar")).toBe(0);
    expect(count(morning, "vending")).toBeGreaterThan(count(morning, "stall"));
  });

  it("come in with their chunk, at most the cap of them, and walk on to the next spot of the routine", () => {
    const sim = Simulation.create({ seed: 9 });
    expect(passersby(sim)).toHaveLength(0);
    sim.step();
    const here = passersby(sim, DEPTAK);
    expect(here).toHaveLength(PASSERSBY[DEPTAK]!);
    for (const p of here) {
      expect(p.key).toBeUndefined();
      expect(p.health).toBeUndefined();
      expect(flat(p.position, p.passerby!.goal)).toBeLessThan(0.05);
    }
    run(sim, 2);
    expect(here.every((p) => p.activity === p.passerby!.activity)).toBe(true);
    const first = here.map((p) => p.passerby!.goal);
    // Two slots later everyone has had a new leg of the routine, and some have walked off.
    run(sim, 2 * ROUTINE_SLOT_SECONDS);
    expect(here.some((p, i) => p.passerby!.goal !== first[i])).toBe(true);
    for (const p of here) {
      const stop = passerbyStop(sim.seed, DEPTAK, p.passerby!.index, here.length, sim.clock)!;
      expect(p.passerby!.goal).toBe(stop.spot.at);
    }
  });

  it("are left out of the save and come back on their routine after a load, without changing the run", () => {
    const sim = Simulation.create({ seed: 21 });
    run(sim, 30 * SIM_HZ, input({ moveZ: 1 }));
    const snap = roundTrip(sim.snapshot(null, "t", ""));
    expect(snap.entities.every((e) => !e.key.startsWith("passer"))).toBe(true);
    const loaded = Simulation.fromSnapshot(snap);
    loaded.step();
    sim.step();
    const goals = (s: Simulation) => passersby(s).map((p) => `${p.chunk}:${p.passerby!.index}:${p.passerby!.goal.x},${p.passerby!.goal.z}`);
    expect(goals(loaded)).toEqual(goals(sim));
    for (let i = 0; i < 600; i++) {
      loaded.step(input({ moveZ: 1, lookYaw: 0.002 }));
      sim.step(input({ moveZ: 1, lookYaw: 0.002 }));
    }
    expect(hash(loaded)).toBe(hash(sim));
  });

  it("run from a shot like anyone, but never phone it in, and go back to their routine", () => {
    const sim = Simulation.create({ seed: 9 });
    sim.step();
    const p = passersby(sim, DEPTAK)[0]!;
    // On the deptak the car wash crew would hear the shot and Ume would phone it in, and the
    // alarm would send everyone running again (ADR-0045): only the passers-by stay.
    for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
    for (const c of [...sim.world.with("civilian")]) if (!c.passerby) sim.world.remove(c);
    teleportPlayer(sim, spotNear(p.position.x + 4, p.position.z), 0);
    run(sim, 2);
    fireUp(sim);
    run(sim, 2);
    expect(p.civilian?.crowd?.state).not.toBe("calm");
    expect(p.activity).toBeUndefined();
    expect(p.civilian?.crowd?.call ?? null).toBeNull();
    run(sim, (FLEE_SECONDS + 35) * SIM_HZ);
    expect(p.civilian?.crowd?.state).toBe("calm");
    expect(flat(p.position, p.passerby!.goal)).toBeLessThan(0.4);
    expect(p.activity).toBe(p.passerby!.activity);
  });
});
