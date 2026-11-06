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

/**
 * Made on first use and kept: the long runs are split into one case per stretch, each asking for
 * the stretches before it, as one case of the whole run went past the 20 s limit under coverage
 * (G-357). The cases note what they check when the stretch is made, so their order does not matter.
 */
const once = <T>(make: () => T): (() => T) => {
  let made: { value: T } | undefined;
  return () => (made ??= { value: make() }).value;
};

/** `parting` of the two games `both` gives, a stretch of `lengths` (s) at a time: up to the `n`-th made once, its result. */
const stretches = (both: () => { a: Simulation; b: Simulation; id: string }, lengths: readonly number[]) => {
  const parted: (number | null)[] = [];
  return (n: number): number | null => {
    const { a, b, id } = both();
    while (parted.length < n) parted.push(parting(a, b, id, seconds(lengths[parted.length]!)));
    return parted[n - 1]!;
  };
};

describe("an alerted guard far from the player falls asleep (G-188)", () => {
  const lost = once(() => {
    const { sim, id } = alarmed(10);
    const guards = guardsOf(sim, id);
    teleportPlayer(sim, AWAY);
    run(sim, seconds(5));
    return { sim, id, guards, pinned: guardsOf(sim, id), awake: guards.map((k) => awake(sim, k)) };
  });
  const lostAway = once(() => {
    const { sim, id } = lost();
    run(sim, seconds(PINNED_AWAY_SECONDS));
    return { people: peopleOf(sim, id), former: sim.snapshot(null, "t", "").formerContracts ?? [] };
  });
  const lostBack = once(() => {
    const { sim, id, guards } = lost();
    lostAway();
    backAtDocks(sim);
    return { guards: guardsOf(sim, id), awake: guards.map((k) => awake(sim, k)) };
  });

  it("the guards of a lost infiltration, still after her, are pinned outside every loaded chunk", () => {
    const { guards, pinned, awake: after } = lost();
    expect(guards.length).toBeGreaterThan(0);
    expect(pinned).toEqual(guards);
    expect(after).toEqual(guards.map(() => true));
  });

  it("the guards of a lost infiltration give up and fall asleep", () => {
    expect(lostAway()).toEqual({ people: [], former: [] });
  });

  it("the guards of a lost infiltration wait at their site, calm", () => {
    const { guards } = lost();
    expect(lostBack()).toEqual({ guards, awake: guards.map(() => false) });
  });

  // The job lost, not paid: for the streaming it is as one still running (its site not cleared).
  const neverAway = once(() => {
    const { sim, id } = alarmed(10);
    const key = `${id}-g1`;
    neverGivesUp(sim, key);
    teleportPlayer(sim, AWAY);
    run(sim, seconds(PINNED_AWAY_SECONDS / 2));
    return { sim, key, awake: awake(sim, key) };
  });
  const neverAlmost = once(() => {
    const { sim, key } = neverAway();
    run(sim, seconds(PINNED_AWAY_SECONDS / 2) - SIM_HZ);
    return awake(sim, key);
  });
  const neverAsleep = once(() => {
    const { sim, key } = neverAway();
    neverAlmost();
    run(sim, 2 * SIM_HZ);
    const there = byKey(sim, key) !== undefined;
    const asleep = sim.streamer.dormantSnapshots().find((s) => s.key === key);
    backAtDocks(sim);
    return { there, asleep, back: byKey(sim, key) !== undefined, awake: awake(sim, key) };
  });

  it("one that never gives up is still after her half PINNED_AWAY_SECONDS outside the loaded chunks", () => {
    expect(neverAway().awake).toBe(true);
  });

  it("one that never gives up is still after her a second before PINNED_AWAY_SECONDS", () => {
    expect(neverAlmost()).toBe(true);
  });

  it("one that never gives up falls asleep after PINNED_AWAY_SECONDS outside the loaded chunks, calm", () => {
    const { there, asleep, back, awake: after } = neverAsleep();
    expect(there).toBe(false);
    expect(asleep).toMatchObject({ alerted: false });
    expect(asleep?.lastKnown).toBeUndefined();
    expect(back).toBe(true);
    expect(after).toBe(false);
  });

  // One game she left, saved on the way: each save goes on alone, compared to it second by second.
  const SAVED_AT = [5, 24, 29];
  const LEFT_FOR = 40;
  const left = once(() => {
    const { sim, id } = alarmed(10);
    teleportPlayer(sim, AWAY);
    const people: string[][] = [];
    const saves = new Map<number, Simulation>();
    for (let s = 1; s <= LEFT_FOR; s++) {
      run(sim, SIM_HZ);
      people[s] = peopleOf(sim, id);
      if (SAVED_AT.includes(s)) saves.set(s, reload(sim));
    }
    return { id, people, saves, hash: hash(sim) };
  });
  /** Steps the game saved `at` s after she left to the end of `left`: the first second they part, or null. */
  const partingFromLeft = (at: number): number | null => {
    const { id, people, saves, hash: end } = left();
    const loaded = saves.get(at)!;
    for (let s = at + 1; s <= LEFT_FOR; s++) {
      run(loaded, SIM_HZ);
      if (peopleOf(loaded, id).join() !== people[s]!.join()) return s - at;
    }
    return hash(loaded) === end ? null : LEFT_FOR - at;
  };

  it(`the game she left has its guards asleep ${LEFT_FOR} s after`, () => {
    expect(left().people[LEFT_FOR]).toEqual([]);
  });

  for (const at of SAVED_AT) {
    it(`saved ${at} s after she left, the loaded game puts the same guards to sleep at the same time`, () => {
      const { id, people, saves } = left();
      expect(peopleOf(saves.get(at)!, id)).toEqual(people[at]);
      expect(partingFromLeft(at)).toBeNull();
    });
  }

  const calmWest = once(() => {
    const { sim, id } = alarmed(10);
    const key = `${id}-g1`;
    // Her in the west of the docks: the guards' chunk falls asleep with them pinned.
    teleportPlayer(sim, ground(2330, 300));
    sim.step();
    const ownLoaded = sim.streamer.isLoaded(sim.streamer.chunkIdAt(byKey(sim, key)!.position));
    // He came after her into the loaded west and gave up there.
    const g = byKey(sim, key)!;
    g.position = ground(2450, 400);
    g.prevPosition = g.position;
    g.ai = { ...g.ai!, alerted: false, lastKnown: null, search: 0, lost: 0, suspicion: 0 };
    sim.step();
    const standsLoaded = sim.streamer.isLoaded(sim.streamer.chunkIdAt(byKey(sim, key)!.position));
    const loaded = reload(sim);
    return { sim, id, key, loaded, ownLoaded, standsLoaded, loadedHasHim: byKey(loaded, key) !== undefined };
  });
  // 60 s of both games, most of it the first 20 s while he walks home: a stretch a case.
  const CALM_WALK = [6, 7, 7, 40];
  const calmWalk = stretches(() => {
    const { sim, loaded, id } = calmWest();
    return { a: sim, b: loaded, id };
  }, CALM_WALK);

  it("a calm guard whose chunk sleeps stays while he stands in a loaded one, after a load too", () => {
    const { ownLoaded, standsLoaded, loadedHasHim } = calmWest();
    expect({ ownLoaded, standsLoaded, loadedHasHim }).toEqual({ ownLoaded: false, standsLoaded: true, loadedHasHim: true });
  });

  for (const [i, length] of CALM_WALK.entries()) {
    const after = CALM_WALK.slice(0, i).reduce((t, l) => t + l, length);
    it(`a calm guard whose chunk sleeps walks home the same in both games, ${after} s after the load`, () => {
      expect(calmWalk(i + 1)).toBeNull();
    });
  }

  it("a calm guard whose chunk sleeps sleeps once out of the loaded chunks", () => {
    calmWalk(CALM_WALK.length);
    // Walked home, out of the loaded chunks: asleep there in both.
    const { sim, key } = calmWest();
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

  // Both games for 30 s after the save in two stretches, a stretch a case.
  const paidSaved = once(() => {
    const { sim, c } = paidAlerted();
    teleportPlayer(sim, AWAY);
    run(sim, seconds(10));
    return { a: sim, b: reload(sim), id: c.id };
  });
  const paidStretch = stretches(paidSaved, [15, 15]);
  const paidBack = once(() => {
    paidStretch(2);
    const { a, b, id } = paidSaved();
    return [a, b].map((s) => {
      const gone = peopleOf(s, id);
      backAtDocks(s);
      return { gone, back: peopleOf(s, id) };
    });
  });

  it("saved while he is pinned far away, the loaded game goes on the same for 15 s", () => {
    expect(paidStretch(1)).toBeNull();
  });

  it("saved while he is pinned far away, the loaded game loses him at the same time", () => {
    expect(paidStretch(2)).toBeNull();
    expect(paidBack()).toEqual([0, 1].map(() => ({ gone: [], back: [] })));
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
