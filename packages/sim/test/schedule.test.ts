import { describe, expect, it } from "vitest";
import { type GameClock, type SaveSnapshot, START_CLOCK, type Vec3, formatClock, hm } from "@seki/core";
import {
  OYAJI_HOURS,
  market,
  SCHEDULES,
  type ScheduleDef,
  Simulation,
  currentStopIndex,
  gameSecondsPerStep,
  scheduledPose,
  stateHash,
  SIM_DT,
} from "../src";
import { AWAY, byKey, collect, input, run, teleportPlayer } from "./helpers";

/** The chunk of Podzamcze the market stands in. */
const MARKET_CHUNK = "podzamcze-1-0";
const clockAt = (h: number, m = 0, s = 0): GameClock => ({ seconds: h * 3600 + m * 60 + s });
const plan = (key: string): ScheduleDef => {
  const def = SCHEDULES[key];
  if (!def) throw new Error(key);
  return def;
};
const stopOf = (key: string, i: number) => {
  const s = plan(key).stops[i];
  if (!s) throw new Error(`${key} has no stop ${i}`);
  return s;
};
const last = <T>(xs: readonly T[]): T => xs[xs.length - 1] as T;
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

const OYAJI_STALL = last(plan("oyaji").stops[0].path);
const OYAJI_DOOR = last(stopOf("oyaji", 1).path);
const HEBI_POST = plan("hebi-lookout").stops[0].path[0];

/** Teleports and runs one step, which is when streaming reacts. */
const goTo = (sim: Simulation, p: Vec3) => {
  teleportPlayer(sim, p);
  sim.step();
};
/** The market keeps its own coordinates, moved under the viaduct by `MARKET_PLACE` (ADR-0045). */
const inMarket = (x: number, z: number): Vec3 => market(x, 0, z);
/** Beside Oyaji's door, where its prompt is in reach. */
const byDoor = (): Vec3 => ({ x: OYAJI_DOOR.x + 1.5, y: OYAJI_DOOR.y, z: OYAJI_DOOR.z + 0.8 });

/** Skips time to the given minute of the day (today or tomorrow), in one step. */
const skipTo = (sim: Simulation, minute: number) => {
  const now = Math.floor((sim.clock.seconds % 86400) / 60);
  const minutes = (minute - now + 1440) % 1440;
  if (minutes > 0) sim.enqueue({ type: "wait", minutes });
  sim.step();
};

const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));
const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;

describe("day clock in the simulation", () => {
  it("one fixed step is one game second: a real minute is a game hour", () => {
    expect(gameSecondsPerStep(SIM_DT)).toBe(1);
    const sim = Simulation.create({ seed: 1 });
    expect(sim.clock).toEqual(START_CLOCK);
    run(sim, 3600);
    expect(formatClock(sim.clock)).toBe("22:00");
    expect(sim.clock.seconds).toBe(START_CLOCK.seconds + sim.tick);
  });

  it("wait jumps the clock by whole minutes and ignores nonsense", () => {
    const sim = Simulation.create({ seed: 1 });
    const skipped = collect<{ minutes: number }>(sim, "TimeSkipped");
    sim.enqueue({ type: "wait", minutes: 0 });
    sim.enqueue({ type: "wait", minutes: Number.NaN });
    sim.step();
    expect(skipped).toHaveLength(0);
    sim.enqueue({ type: "wait", minutes: 90.7 });
    sim.step();
    expect(skipped).toEqual([{ minutes: 90, clock: { seconds: START_CLOCK.seconds + 90 * 60 + 1 } }]);
    expect(formatClock(sim.clock)).toBe("22:30");
  });

  it("is saved and loaded with the game", () => {
    const sim = Simulation.create({ seed: 1 });
    skipTo(sim, hm(3, 15));
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
    expect(loaded.clock).toEqual(sim.clock);
    expect(formatClock(loaded.clock)).toBe("03:15");
  });
});

describe("daily plans", () => {
  it("pick the stop in force, wrapping from the last stop of the day to the first", () => {
    const def = plan("oyaji");
    expect(currentStopIndex(def, clockAt(12))).toBe(0);
    expect(currentStopIndex(def, clockAt(23))).toBe(1);
    expect(currentStopIndex(def, clockAt(3))).toBe(1);
    expect(currentStopIndex(def, clockAt(8))).toBe(0);
  });

  it("walk a straight path from the previous stop and then stand facing the stop's way", () => {
    const def = plan("oyaji");
    expect(scheduledPose(def, clockAt(21))).toMatchObject({ stop: 0, position: OYAJI_STALL, arrived: true });
    const walking = scheduledPose(def, clockAt(22, 1));
    expect(walking.arrived).toBe(false);
    expect(dist(walking.position, OYAJI_STALL)).toBeGreaterThan(0.5);
    expect(dist(walking.position, OYAJI_DOOR)).toBeGreaterThan(0.5);
    expect(scheduledPose(def, clockAt(23))).toMatchObject({ stop: 1, position: OYAJI_DOOR, arrived: true, heading: stopOf("oyaji", 1).yaw });
    // Before opening time he is still at home from the night before.
    expect(scheduledPose(def, clockAt(7, 59))).toMatchObject({ stop: 1, position: OYAJI_DOOR });
  });

  it("a patrol keeps walking its loop until the next stop", () => {
    const def = plan("hebi-lookout");
    const poses = [10, 20, 30, 40].map((m) => scheduledPose(def, clockAt(22, m)));
    expect(poses.every((p) => !p.arrived && p.stop === 1)).toBe(true);
    expect(new Set(poses.map((p) => `${p.position.x.toFixed(2)},${p.position.z.toFixed(2)}`)).size).toBe(4);
    expect(scheduledPose(def, clockAt(12))).toMatchObject({ position: HEBI_POST, arrived: true });
  });

  it("a new game starts with everyone exactly at their spawn (the M0 street is unchanged)", () => {
    const sim = Simulation.create({ seed: 1 });
    const ume = byKey(sim, "ume")!;
    expect(ume.position).toEqual(last(plan("ume").stops[0].path));
    expect(ume.yaw).toBe(plan("ume").stops[0].yaw);
    run(sim, 600);
    expect(ume.position).toEqual(last(plan("ume").stops[0].path));
  });
});

describe("daily plans in a loaded chunk", () => {
  it("Oyaji closes at 22:00, walks home along his path and is closed when spoken to", () => {
    const sim = Simulation.create({ seed: 1 });
    goTo(sim, inMarket(76, 66));
    const oyaji = byKey(sim, "oyaji")!;
    const prompts = collect<{ prompt: string | null }>(sim, "InteractionFocusChanged");
    const started = collect<{ dialogueId: string }>(sim, "InteractionStarted");
    expect(oyaji.position).toEqual(OYAJI_STALL);
    expect(oyaji.interactable?.dialogueId).not.toBe("oyaji_closed");

    skipTo(sim, OYAJI_HOURS.close - 1);
    teleportPlayer(sim, inMarket(40, 78));
    run(sim, 60);
    expect(oyaji.position).toEqual(OYAJI_STALL);
    expect(oyaji.interactable?.dialogueId).toBe("oyaji_closed");
    // Walks, does not jump: never far from where his plan is at each step.
    let worst = 0;
    for (let i = 0; i < 60 * 30; i++) {
      sim.step();
      worst = Math.max(worst, dist(oyaji.position, oyaji.schedule!.pose!.position));
    }
    expect(worst).toBeLessThan(1);
    expect(dist(oyaji.position, OYAJI_DOOR)).toBeLessThan(0.1);

    teleportPlayer(sim, byDoor());
    sim.step();
    expect(prompts.at(-1)?.prompt).toMatch(/zamknięte/);
    sim.step(input({ interact: true }));
    expect(started.at(-1)?.dialogueId).toBe("oyaji_closed");
  });

  it("the prompt changes in place when the hour changes under a focused player", () => {
    const sim = Simulation.create({ seed: 1 });
    skipTo(sim, OYAJI_HOURS.open - 1);
    goTo(sim, byDoor());
    const prompts = collect<{ targetId: number | null; prompt: string | null }>(sim, "InteractionFocusChanged");
    expect(byKey(sim, "oyaji")!.position).toEqual(OYAJI_DOOR);
    run(sim, 2);
    expect(sim.session.focusPrompt).toMatch(/zamknięte/);
    run(sim, 60);
    // 8:00: he opens and sets off for the stall; the closed sign goes away while he is still in reach.
    expect(sim.session.focusPrompt ?? "").not.toMatch(/zamknięte/);
    expect(prompts.some((p) => p.prompt === null || !/zamknięte/.test(p.prompt))).toBe(true);
  });

  it("the Hebi lookout patrols the loop round the pillars at night and returns to his post by day", () => {
    const sim = Simulation.create({ seed: 1 });
    goTo(sim, inMarket(40, 78));
    skipTo(sim, hm(22, 20));
    const hebi = byKey(sim, "hebi-lookout")!;
    expect(hebi.ai?.alerted).toBe(false);
    const visited: { x: number; z: number }[] = [];
    for (let i = 0; i < 60 * 20; i++) {
      sim.step();
      if (i % 60 === 0) visited.push({ ...hebi.position });
    }
    expect(Math.max(...visited.map((p) => dist(p, HEBI_POST)))).toBeGreaterThan(5);
    expect(dist(hebi.position, hebi.schedule!.pose!.position)).toBeLessThan(1);
    skipTo(sim, hm(12));
    run(sim, 10);
    expect(hebi.position).toEqual(HEBI_POST);
  });
});

describe("daily plans and streaming", () => {
  it("an NPC asleep in an unloaded chunk turns up where its plan says when the chunk returns", () => {
    const sim = Simulation.create({ seed: 1 });
    goTo(sim, inMarket(30, 78));
    goTo(sim, inMarket(90, 70));
    expect(byKey(sim, "oyaji")!.position).toEqual(OYAJI_STALL);
    goTo(sim, inMarket(30, 78));
    // Out on Plac Litewski, far from the market.
    goTo(sim, AWAY);
    expect(sim.streamer.isLoaded(MARKET_CHUNK)).toBe(false);
    expect(sim.streamer.dormantSnapshots().find((s) => s.key === "oyaji")?.position).toEqual(OYAJI_STALL);

    // Time passes while the market sleeps; it is past midnight when Seki comes back.
    run(sim, 60);
    skipTo(sim, hm(0, 40));
    goTo(sim, inMarket(40, 78));
    const oyaji = byKey(sim, "oyaji")!;
    expect(oyaji.position).toEqual(OYAJI_DOOR);
    expect(oyaji.prevPosition).toEqual(OYAJI_DOOR);
    expect(oyaji.yaw).toBe(stopOf("oyaji", 1).yaw);
    expect(oyaji.interactable?.dialogueId).toBe("oyaji_closed");
  });

  it("a chunk loading for the first time late at night already has its NPCs where they belong", () => {
    const sim = Simulation.create({ seed: 1 });
    skipTo(sim, hm(23, 30));
    goTo(sim, inMarket(40, 78));
    expect(byKey(sim, "oyaji")!.position).toEqual(OYAJI_DOOR);
    const hebi = byKey(sim, "hebi-lookout")!;
    expect(hebi.position).toEqual(scheduledPose(plan("hebi-lookout"), sim.clock).position);
  });

  it("a wait puts NPCs of loaded chunks on their plan at once", () => {
    const sim = Simulation.create({ seed: 1 });
    skipTo(sim, hm(23, 45));
    expect(byKey(sim, "ume")!.position).toEqual(last(stopOf("ume", 1).path));
  });
});

describe("daily plans: saves and determinism", () => {
  it("a game saved mid-walk continues exactly like the original", () => {
    const sim = Simulation.create({ seed: 9 });
    goTo(sim, inMarket(40, 78));
    skipTo(sim, OYAJI_HOURS.close);
    run(sim, 120);
    const oyaji = byKey(sim, "oyaji")!;
    expect(dist(oyaji.position, OYAJI_STALL)).toBeGreaterThan(0.3);
    expect(dist(oyaji.position, OYAJI_DOOR)).toBeGreaterThan(0.3);
    const restored = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "mid", "")));
    expect(hash(restored)).toBe(hash(sim));
    for (let i = 0; i < 1500; i++) {
      sim.step();
      restored.step();
    }
    expect(hash(restored)).toBe(hash(sim));
    expect(byKey(restored, "oyaji")!.position).toEqual(byKey(sim, "oyaji")!.position);
  });

  it("the same run across closing time and the night patrol gives the same state twice", () => {
    const play = () => {
      const sim = Simulation.create({ seed: 5 });
      goTo(sim, inMarket(40, 78));
      skipTo(sim, hm(21, 58));
      run(sim, 60 * 30);
      return hash(sim);
    };
    expect(play()).toBe(play());
  });
});
