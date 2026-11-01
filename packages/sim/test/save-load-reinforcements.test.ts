import { describe, expect, it } from "vitest";
import { DIFFICULTY_PRESETS, type DifficultyProfile, type HeatState, type SaveSnapshot, type Vec3 } from "@seki/core";
import { Simulation, SIM_HZ, docks, stateHash } from "../src";
import { ALLEY_START, alleySim, run, teleportPlayer } from "./helpers";

/** Saving and loading while the heat's reinforcements are about (G-179): the loaded game goes on as the saved one. */

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));
const HEAT: HeatState = { level: 2, faction: "hebi", searching: true, lastKnown: ALLEY_START, searchLeft: 30, cooldown: 0 };

/**
 * The reinforcements as the world has them (no key): which of the heat's, where, how hurt and
 * what they know. Not the entity id: a loaded game gives its own (bags take new ones on loading).
 */
const reinforcements = (sim: Simulation) =>
  [...sim.world.with("security")]
    .sort((a, b) => a.security.n - b.security.n)
    .map((e) => ({
      type: e.enemy?.type,
      position: e.position,
      yaw: e.yaw,
      hp: e.health,
      // The whole AI state; unset after a load is 0 or false (the sight is the step's own).
      ai: e.ai && { ...e.ai, search: e.ai.search ?? 0, lost: e.ai.lost ?? 0, sees: e.ai.sees ?? false, suspicion: e.ai.suspicion ?? 0 },
      cooldown: e.combatant?.cooldown,
      view: e.view,
      security: e.security,
    }));

interface Scene {
  readonly seed: number;
  readonly heat?: HeatState;
  /** Where the player stands; the deptak by Plac Łokietka without. */
  readonly at?: Vec3;
  readonly difficulty?: DifficultyProfile;
}

/** With the heat up, `after` steps after the first reinforcement came in. */
const withReinforcements = ({ seed, heat = HEAT, at, difficulty }: Scene, after: number): Simulation => {
  const start = alleySim({ seed, ...(difficulty ? { difficulty } : {}) });
  if (at) teleportPlayer(start, at);
  const fresh = start.snapshot(null, "t", "");
  const sim = Simulation.fromSnapshot(roundTrip({ ...fresh, domain: { ...fresh.domain, heat } }));
  for (let i = 0; i < 10 * SIM_HZ && sim.world.with("security").entities.length === 0; i++) sim.step();
  expect(sim.world.with("security").entities.length).toBeGreaterThan(0);
  run(sim, after);
  return sim;
};

/** JSON with every object's keys in order: the same state, whatever order its fields were set in. */
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

/** The first step (1-based) after which the two runs differ, null when they never do in `steps`. */
const firstDivergence = (a: Simulation, b: Simulation, steps: number): number | null => {
  for (let i = 1; i <= steps; i++) {
    a.step();
    b.step();
    if (hash(a) !== hash(b) || canonical(reinforcements(a)) !== canonical(reinforcements(b))) return i;
    if (a.session.watch.reinforce !== b.session.watch.reinforce || a.session.watch.sent !== b.session.watch.sent) return i;
  }
  return null;
};

describe("save and load with the heat's reinforcements about (G-179)", () => {
  it("they are loaded where and as they were, with the wait for the next one", () => {
    const sim = withReinforcements({ seed: 21 }, 30);
    const before = reinforcements(sim);
    expect(before).toHaveLength(1);
    expect(sim.session.watch.reinforce).toBeGreaterThan(0);
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
    expect(reinforcements(loaded)).toEqual(before);
    expect(loaded.session.watch.reinforce).toBeCloseTo(sim.session.watch.reinforce, 9);
    expect(loaded.session.watch.sent).toBe(1);
    expect(hash(loaded)).toBe(hash(sim));
  });

  it("the loaded game runs as the saved one, step by step, the next reinforcement too", () => {
    const sim = withReinforcements({ seed: 21 }, 30);
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
    expect(firstDivergence(sim, loaded, 10 * SIM_HZ)).toBeNull();
    // The second of two stars came in meanwhile, in both.
    expect(reinforcements(sim)).toHaveLength(2);
  });

  it("the saved game's hash sees them: a game without them hashes otherwise", () => {
    const sim = withReinforcements({ seed: 21 }, 30);
    const snap = sim.snapshot(null, "t", "");
    const g = sim.world.with("security").first!;
    sim.world.remove(g);
    expect(hash(sim)).not.toBe(stateHash(snap));
  });

  const TESSEN: HeatState = { ...HEAT, level: 3, faction: "tessen", lastKnown: docks(0, 0, 112) };
  const scenes: readonly (Scene & { readonly name: string })[] = [
    { name: "another seed, three stars", seed: 5, heat: { ...HEAT, level: 3 } },
    { name: "on 'hard'", seed: 21, difficulty: DIFFICULTY_PRESETS.hard },
    { name: "Tessen's in the docks", seed: 8, heat: TESSEN, at: docks(0, 0, 112) },
  ];
  for (const scene of scenes) {
    it(`${scene.name}: the loaded game runs as the saved one`, () => {
      const sim = withReinforcements(scene, 90);
      const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
      expect(reinforcements(loaded)).toEqual(reinforcements(sim));
      expect(firstDivergence(sim, loaded, 10 * SIM_HZ)).toBeNull();
    });
  }

  it("hurt and knocked out: the health and the body are loaded as saved", () => {
    const sim = withReinforcements({ seed: 21 }, 30);
    const snap = roundTrip(sim.snapshot(null, "t", ""));
    const [one] = snap.reinforcements!.people;
    const body = { playerAt: ALLEY_START, fought: true, found: false, reported: false, dead: false, carried: false, hidden: false };
    // A body knows of no search (`restoreDowned`), so the saved one has none.
    const { lastKnown: _l, search: _s, lost: _o, ...state } = one!.state;
    const hurt = { ...snap, reinforcements: { ...snap.reinforcements!, people: [{ ...one!, state: { ...state, hp: 17, downed: body } }] } };
    const loaded = Simulation.fromSnapshot(hurt);
    const g = loaded.world.with("security").first!;
    expect(g.health?.current).toBe(17);
    expect(g.downed).toMatchObject({ fought: true, dead: false });
    expect(g.unconscious).toBe(true);
    expect(roundTrip(loaded.snapshot(null, "t", "")).reinforcements).toEqual(hurt.reinforcements);
  });

  it("with the heat gone and all of them home, nothing is saved and the next heat counts from 1", () => {
    const sim = withReinforcements({ seed: 21 }, 30);
    const snap = roundTrip(sim.snapshot(null, "t", ""));
    const cooled = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, heat: { level: 0, faction: null, searching: false, lastKnown: null, searchLeft: 0, cooldown: 0 } } });
    teleportPlayer(cooled, docks(0, 0, 112));
    run(cooled, 5 * SIM_HZ);
    expect(cooled.world.with("security").entities).toHaveLength(0);
    expect(cooled.session.watch.sent).toBe(0);
    expect(cooled.snapshot(null, "t", "").reinforcements).toBeUndefined();
  });

  it("a save from before them (v22) loads with none, as it did", () => {
    const sim = withReinforcements({ seed: 21 }, 30);
    const { reinforcements: _r, ...old } = roundTrip(sim.snapshot(null, "t", ""));
    const loaded = Simulation.fromSnapshot(old as SaveSnapshot);
    expect(loaded.world.with("security").entities).toHaveLength(0);
    expect(loaded.session.watch).toMatchObject({ reinforce: 0, sent: 0 });
  });
});
