import { describe, expect, it } from "vitest";
import { type Contract, contractFailedFlag } from "@seki/core";
import { DOKI_ITEM_SPOTS, PINNED_AWAY_SECONDS, SIM_HZ, type Simulation, docks, ground } from "../src";
import { AWAY, byKey, input, run, teleportPlayer } from "./helpers";
import { alarmed, hash, peopleOf, reload, taken } from "./contract-save-helpers";
import { IdAllocator } from "../src/world/factory";
import { StreamCatalog, type Template } from "../src/world/stream-catalog";

/**
 * G-188: an AI pinned in the world (alerted when its chunk fell asleep) is not kept about for
 * good once the player is far: calm again outside every loaded chunk it falls asleep, and one
 * that never gives up does after `PINNED_AWAY_SECONDS`. A job not paid gets it back asleep at
 * its site, a paid one (G-195) never. A save gives the same as the game it was made of.
 */

const seconds = (s: number): number => Math.round(s * SIM_HZ);
const guardsOf = (sim: Simulation, id: string): string[] => peopleOf(sim, id).filter((k) => k.includes("-g"));
const awake = (sim: Simulation, key: string): boolean => {
  const ai = byKey(sim, key)?.ai;
  return !!ai && (ai.alerted || !!ai.lastKnown);
};

/** Sent after someone (as a wave is): it never gives the player up by itself. */
const neverGivesUp = (sim: Simulation, key: string): void => {
  const g = byKey(sim, key)!;
  g.ai = { ...g.ai!, alerted: true, victim: "nobody" };
};

const backAtDocks = (sim: Simulation): void => {
  teleportPlayer(sim, docks(0, 0, 120));
  run(sim, 30);
};

/** Steps both games for `steps`, comparing the job's people every second: the first second they part, or null. */
const parting = (a: Simulation, b: Simulation, id: string, steps: number): number | null => {
  for (let i = 1; i <= steps; i++) {
    a.step();
    b.step();
    if (i % SIM_HZ === 0 && peopleOf(a, id).join() !== peopleOf(b, id).join()) return i / SIM_HZ;
  }
  return hash(a) === hash(b) ? null : steps / SIM_HZ;
};

describe("an alerted guard far from the player falls asleep (G-188)", () => {
  it("the guards of a lost infiltration give up, fall asleep and wait at their site", () => {
    const { sim, id } = alarmed(10);
    const guards = guardsOf(sim, id);
    expect(guards.length).toBeGreaterThan(0);
    teleportPlayer(sim, AWAY);
    run(sim, seconds(5));
    // Still after her: pinned, outside every loaded chunk.
    expect(guardsOf(sim, id)).toEqual(guards);
    for (const k of guards) expect(awake(sim, k)).toBe(true);
    run(sim, seconds(PINNED_AWAY_SECONDS));
    expect(peopleOf(sim, id)).toEqual([]);
    expect(sim.snapshot(null, "t", "").formerContracts ?? []).toEqual([]);
    backAtDocks(sim);
    expect(guardsOf(sim, id)).toEqual(guards);
    for (const k of guards) expect(awake(sim, k)).toBe(false);
  });

  it("one that never gives up falls asleep after PINNED_AWAY_SECONDS outside the loaded chunks, calm", () => {
    // The job lost, not paid: for the streaming it is as one still running (its site not cleared).
    const { sim, id } = alarmed(10);
    const key = `${id}-g1`;
    neverGivesUp(sim, key);
    teleportPlayer(sim, AWAY);
    run(sim, seconds(PINNED_AWAY_SECONDS) - SIM_HZ);
    expect(awake(sim, key)).toBe(true);
    run(sim, 2 * SIM_HZ);
    expect(byKey(sim, key)).toBeUndefined();
    const asleep = sim.streamer.dormantSnapshots().find((s) => s.key === key);
    expect(asleep).toMatchObject({ alerted: false });
    expect(asleep?.lastKnown).toBeUndefined();
    backAtDocks(sim);
    expect(byKey(sim, key)).toBeDefined();
    expect(awake(sim, key)).toBe(false);
  });

  for (const at of [5, 24, 29]) {
    it(`saved ${at} s after she left, the loaded game puts the same guards to sleep at the same time`, () => {
      const { sim, id } = alarmed(10);
      teleportPlayer(sim, AWAY);
      run(sim, seconds(at));
      const loaded = reload(sim);
      expect(peopleOf(loaded, id)).toEqual(peopleOf(sim, id));
      expect(parting(sim, loaded, id, seconds(40 - at))).toBeNull();
      expect(peopleOf(sim, id)).toEqual([]);
    });
  }

  it("a calm guard whose chunk sleeps stays while he stands in a loaded one, after a load too, and sleeps once out of it", () => {
    const { sim, id } = alarmed(10);
    const key = `${id}-g1`;
    // Her in the west of the docks: the guards' chunk falls asleep with them pinned.
    teleportPlayer(sim, ground(2330, 300));
    sim.step();
    expect(sim.streamer.isLoaded(sim.streamer.chunkIdAt(byKey(sim, key)!.position))).toBe(false);
    // He came after her into the loaded west and gave up there.
    const g = byKey(sim, key)!;
    g.position = ground(2450, 400);
    g.prevPosition = g.position;
    g.ai = { ...g.ai!, alerted: false, lastKnown: null, search: 0, lost: 0, suspicion: 0 };
    sim.step();
    expect(sim.streamer.isLoaded(sim.streamer.chunkIdAt(byKey(sim, key)!.position))).toBe(true);
    const loaded = reload(sim);
    expect(byKey(loaded, key)).toBeDefined();
    expect(parting(sim, loaded, id, seconds(60))).toBeNull();
    // Walked home, out of the loaded chunks: asleep there in both.
    expect(byKey(sim, key)).toBeUndefined();
  });
});

describe("a paid job's guard far from the player is gone (G-188 with G-195)", () => {
  /** Seed 8: the office's data taken unseen and the job paid; then one of its guards alerted. */
  const paidAlerted = (): { sim: Simulation; c: Contract; key: string } => {
    const { sim, c } = taken(8, 0, docks(0, 0, 120), "infiltrate");
    const spot = DOKI_ITEM_SPOTS.tessen_office!;
    teleportPlayer(sim, ground(spot.x + 1.1, spot.z), -Math.PI / 2);
    sim.step(input({ interact: true, crouch: true }));
    sim.enqueue({ type: "complete-contract" });
    sim.step();
    expect(sim.domain.contracts.active).toBeNull();
    expect(sim.domain.flags).not.toContain(contractFailedFlag(c.id));
    const key = `${c.id}-g0`;
    byKey(sim, key)!.ai!.alerted = true;
    return { sim, c, key };
  };

  it("pinned while she is about, gone for good once he gives up far from her", () => {
    const { sim, c, key } = paidAlerted();
    teleportPlayer(sim, AWAY);
    run(sim, seconds(5));
    expect(peopleOf(sim, c.id)).toEqual([key]);
    run(sim, seconds(PINNED_AWAY_SECONDS));
    expect(peopleOf(sim, c.id)).toEqual([]);
    expect(sim.streamer.dormantSnapshots().filter((s) => s.key.startsWith(`${c.id}-`))).toEqual([]);
    backAtDocks(sim);
    expect(peopleOf(sim, c.id)).toEqual([]);
  });

  it("saved while he is pinned far away, the loaded game loses him at the same time", () => {
    const { sim, c } = paidAlerted();
    teleportPlayer(sim, AWAY);
    run(sim, seconds(10));
    const loaded = reload(sim);
    expect(parting(sim, loaded, c.id, seconds(30))).toBeNull();
    for (const s of [sim, loaded]) {
      expect(peopleOf(s, c.id)).toEqual([]);
      backAtDocks(s);
      expect(peopleOf(s, c.id)).toEqual([]);
    }
  });

  it("calm in a loaded chunk not his own, he is still there after a load (not gone before her eyes)", () => {
    const { sim, c, key } = paidAlerted();
    teleportPlayer(sim, ground(2330, 300));
    sim.step();
    const g = byKey(sim, key)!;
    expect(sim.streamer.isLoaded(g.chunk!)).toBe(false);
    g.position = ground(2450, 400);
    g.prevPosition = g.position;
    g.ai = { ...g.ai!, alerted: false, lastKnown: null, search: 0, lost: 0, suspicion: 0 };
    sim.step();
    expect(peopleOf(sim, c.id)).toEqual([key]);
    expect(peopleOf(reload(sim), c.id)).toEqual([key]);
  });
});

describe("a guard near the player stays when his chunk falls asleep (G-201)", () => {
  /** Where she stands outside every chunk, alive, on the terrain that goes on past them. */
  const OFF_MAP: readonly (readonly [number, number])[] = [
    [2440, 545],
    [490, 180],
  ];
  const calm = (e: NonNullable<ReturnType<typeof byKey>>): void => {
    e.ai = { ...e.ai!, alerted: false, lastKnown: null, search: 0, lost: 0, suspicion: 0 };
  };
  /**
   * The lost infiltration at the docks, her standing at (x, z) and its guard g1 calm 6 m from
   * her: calm already when his chunk falls asleep, or pinned (alerted then) and calm after.
   */
  const beside = (x: number, z: number, calmFirst: boolean): { sim: Simulation; id: string; key: string } => {
    const { sim, id } = alarmed(10);
    // The game's ground, not `ground()`: that is 0 outside the chunks.
    const y = sim.streamer.ground.heightAt(x, z);
    const calmAll = (): void => {
      for (const k of peopleOf(sim, id)) calm(byKey(sim, k)!);
    };
    if (calmFirst) calmAll();
    teleportPlayer(sim, { x, y, z });
    if (!calmFirst) {
      sim.step();
      expect(byKey(sim, `${id}-g1`)?.ai?.away).toBeDefined();
      calmAll();
    }
    const key = `${id}-g1`;
    const g = byKey(sim, key)!;
    g.position = { x: x + 6, y, z };
    g.prevPosition = g.position;
    sim.step();
    expect(sim.streamer.chunkIdAt(sim.player()!.position)).toBe("");
    expect(sim.streamer.isLoaded(g.chunk!)).toBe(false);
    return { sim, id, key };
  };

  for (const [x, z] of OFF_MAP) {
    for (const calmFirst of [false, true]) {
      it(`at (${x}; ${z}), calm ${calmFirst ? "when his chunk falls asleep" : "after it"}, he stays by her, after a load too`, () => {
        const { sim, id, key } = beside(x, z, calmFirst);
        run(sim, seconds(1));
        const p = sim.player()!;
        expect(p.health!.current).toBeGreaterThan(0);
        expect(Math.abs(p.position.y - p.prevPosition.y)).toBeLessThan(0.01);
        expect(byKey(sim, key)).toBeDefined();
        const loaded = reload(sim);
        expect(byKey(loaded, key)).toBeDefined();
        for (const s of [sim, loaded]) {
          run(s, seconds(1));
          expect(byKey(s, key)).toBeDefined();
        }
        // Walking home he leaves her: out of her reach (in ~10 s) he sleeps, in both at the same time.
        expect(parting(sim, loaded, id, seconds(15))).toBeNull();
        expect(byKey(sim, key)).toBeUndefined();
      });
    }
  }

  it("inside the chunks too: calm in a loaded chunk not his own when his falls asleep, by her, he stays, after a load too", () => {
    const { sim, id } = alarmed(10);
    for (const k of peopleOf(sim, id)) {
      const e = byKey(sim, k)!;
      e.ai = { ...e.ai!, alerted: false, lastKnown: null, search: 0, lost: 0, suspicion: 0 };
    }
    // Her in the west of the docks, him 6 m from her: his own chunk falls asleep in this step.
    teleportPlayer(sim, ground(2330, 300));
    const key = `${id}-g1`;
    const g = byKey(sim, key)!;
    g.position = ground(2336, 300);
    g.prevPosition = g.position;
    sim.step();
    expect(sim.streamer.isLoaded(g.chunk!)).toBe(false);
    expect(sim.streamer.isLoaded(sim.streamer.chunkIdAt(g.position))).toBe(true);
    expect(byKey(sim, key)).toBeDefined();
    const loaded = reload(sim);
    expect(byKey(loaded, key)).toBeDefined();
    expect(parting(sim, loaded, id, seconds(15))).toBeNull();
  });
});

describe("the templates of replaced jobs (G-188)", () => {
  it("are forgotten but those of people still about, so they do not pile up job after job", () => {
    const catalog = new StreamCatalog(new IdAllocator(), [], [], []);
    const of = (key: string): Template => ({ id: 1, chunk: "x", key, make: () => ({ id: 1, position: { x: 0, y: 0, z: 0 }, prevPosition: { x: 0, y: 0, z: 0 }, yaw: 0, prevYaw: 0, pitch: 0 }) });
    catalog.addFormer([of("c1-g0"), of("c1-g1"), of("c2-g0")]);
    catalog.keepFormer(new Set(["c2-g0"]));
    expect(["c1-g0", "c1-g1", "c2-g0"].map((k) => catalog.formerOf(k) !== undefined)).toEqual([false, false, true]);
  });
});
