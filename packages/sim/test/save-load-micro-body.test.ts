import { describe, expect, it } from "vitest";
import type { SaveSnapshot } from "@seki/core";
import { SEARCH_SECONDS, SIM_HZ, Simulation, WAKE_TIME, stateHash, type Entity } from "../src";
import { isEngaged } from "../src/world/street";
import { run, teleportPlayer } from "./helpers";
import { enterKanal } from "./micro-scenes";
import { CROUCH, takeDown, ticks } from "./takedown-scenes";

/**
 * The body of a mugger of a micro-event (G-233): once the mugging is won, an ordinary body in the
 * save, as a reinforcement's is (G-193): it lies, or is carried, where it was after a load.
 */

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));
/** Steps for the street to calm down after the fight (the fleeing passers-by). */
const CALM = 12 * SIM_HZ;
const load = (sim: Simulation) => Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));

/** A mugger's body: an enemy's, of nobody keyed and none of the heat's. */
const bodies = (sim: Simulation) => sim.world.with("downed").entities.filter((b) => !b.key && !b.security && !!b.enemy);

/** The mugging by Brama Krakowska (seed 13) with its first mugger taken down from behind, the second still up. */
const oneDown = (lethal: boolean, seed = 13) => {
  const { sim, ended } = enterKanal("mugging", seed);
  const run0 = sim.session.street2.micro!;
  const [m0, m1] = run0.attackers;
  const a = [...sim.world].find((e) => e.id === m0)!;
  // Blinded by a hack, both: the second does not turn on her while she takes down the first.
  for (const e of [...sim.world] as Entity[]) if (run0.attackers.includes(e.id)) e.hackFx = { pinged: 0, blind: 100, crippled: 0 };
  const p = sim.player()!;
  p.posture = { ...p.posture!, crouched: true, amount: 1, prevAmount: 1 };
  teleportPlayer(sim, { x: a.position.x - Math.sin(a.yaw), y: a.position.y, z: a.position.z - Math.cos(a.yaw) }, a.yaw);
  takeDown(sim, lethal);
  expect([...sim.world].find((e) => e.id === m0)?.downed).toBeDefined();
  return { sim, ended, run0, m1: m1! };
};

const carry = (sim: Simulation): void => {
  sim.step(CROUCH);
  sim.enqueue({ type: "carry-body" });
  sim.step(CROUCH);
};

/** The second mugger shot down: the mugging is won. */
const win = (sim: Simulation, m1: number): void => {
  for (const e of [...sim.world] as Entity[]) if (e.id === m1) e.health = { current: 0, max: 80 };
  sim.step(CROUCH);
  sim.step(CROUCH);
};

describe("the body of a micro-event's mugger in the save (G-233)", () => {
  for (const seed of [13, 7]) {
    for (const lethal of [true, false]) {
      it(`won, on her shoulder (lethal: ${lethal}, seed ${seed}): still carried after a load`, () => {
        const { sim, ended, run0, m1 } = oneDown(lethal, seed);
        carry(sim);
        win(sim, m1);
        expect(ended).toEqual([{ encounterId: run0.id, outcome: "won" }]);
        expect(sim.session.carrying).not.toBeNull();
        // The street's panic at the fight is not saved: she waits for it to calm down.
        run(sim, CALM, CROUCH);
        expect(sim.session.carrying).not.toBeNull();
        const loaded = load(sim);
        const back = bodies(loaded);
        expect(back).toHaveLength(1);
        expect(back[0]!.downed).toMatchObject({ dead: lethal, carried: true, hidden: false });
        expect(back[0]!.body).toBeUndefined();
        expect(loaded.session.carrying).toBe(back[0]!.id);
        expect(hash(loaded)).toBe(hash(sim));
        for (let i = 0; i < 60; i++) {
          sim.step(CROUCH);
          loaded.step(CROUCH);
        }
        expect(hash(loaded)).toBe(hash(sim));
        // Put down, it lies at her feet in both.
        for (const s of [sim, loaded]) s.enqueue({ type: "drop-body" });
        sim.step(CROUCH);
        loaded.step(CROUCH);
        expect(bodies(loaded).map((b) => b.position)).toEqual(bodies(sim).map((b) => b.position));
        expect(hash(loaded)).toBe(hash(sim));
      });
    }
  }

  it("won, lying in the street: it lies where it was after a load", () => {
    const { sim, m1 } = oneDown(true);
    win(sim, m1);
    const [body] = bodies(sim);
    expect(body).toBeDefined();
    const back = bodies(load(sim));
    expect(back.map((b) => ({ at: b.position, dead: b.downed.dead, carried: b.downed.carried, type: b.enemy?.type }))).toEqual([
      { at: body!.position, dead: true, carried: false, type: body!.enemy?.type },
    ]);
    expect(hash(load(sim))).toBe(hash(sim));
  });

  it("a save while the mugging runs ends it as walking away does (ADR-0034): its people, the body carried too, are not in it", () => {
    const { sim } = oneDown(true);
    carry(sim);
    expect(sim.session.carrying).not.toBeNull();
    const loaded = load(sim);
    expect([loaded.session.carrying, bodies(loaded).length, loaded.session.street2.micro]).toEqual([null, 0, null]);
  });

  it("won, knocked out: woken after a load or without one, the mugger is the same (G-242)", () => {
    const { sim, m1 } = oneDown(false);
    win(sim, m1);
    run(sim, CALM, CROUCH);
    // The scene's hack is not saved (ADR-0029): it wakes seeing in both.
    for (const b of bodies(sim)) b.hackFx = { pinged: 0, blind: 0, crippled: 0 };
    const loaded = load(sim);
    // Its victim went with the mugging: sent after nobody, in the game as after a load.
    expect(bodies(sim).map((b) => b.ai?.victim)).toEqual([undefined]);
    for (const s of [sim, loaded]) {
      // The security sent to the body (it fought her) leaves; a passer-by both games have comes by and wakes it.
      const [body] = bodies(s);
      for (const g of [...s.world.with("ai")]) if (g.key && g.ai.alerted) s.world.remove(g);
      const mei = s.world.with("civilian").entities.find((c) => c.key === "mei")!;
      mei.position = { ...body!.position, x: body!.position.x + 1 };
      mei.prevPosition = { ...mei.position };
      delete mei.civilian!.crowd;
    }
    const woken = (s: Simulation) => [...s.world].find((e) => !e.key && !!e.enemy && !!e.ai && !e.downed && (e.health?.current ?? 0) > 0)!;
    run(sim, ticks(WAKE_TIME + 1), CROUCH);
    run(loaded, ticks(WAKE_TIME + 1), CROUCH);
    expect([woken(sim), woken(loaded)].map((e) => [e.ai?.alerted, isEngaged(e)])).toEqual([
      [true, true],
      [true, true],
    ]);
    // Blinded by her hack, it loses her; past giving up the search it calms down in both: no longer
    // fighting, so hitting it is an assault.
    for (const s of [sim, loaded]) woken(s).hackFx = { pinged: 0, blind: 60, crippled: 0 };
    const states = () => [woken(sim), woken(loaded)].map((e) => [e.ai?.alerted, isEngaged(e)]);
    // Stepped together up to the moment it calms down (G-660: not a fixed 40 s, most of the test's
    // time), so both games calm on the same step; then past its search it is still calm.
    for (let i = 0, now = states(); i < ticks(40) && now.some(([alerted]) => alerted); i++, now = states()) {
      expect(now[0]).toEqual(now[1]);
      sim.step(CROUCH);
      loaded.step(CROUCH);
    }
    expect(states()).toEqual([
      [false, false],
      [false, false],
    ]);
    expect(hash(loaded)).toBe(hash(sim));
    run(sim, ticks(SEARCH_SECONDS + 1), CROUCH);
    run(loaded, ticks(SEARCH_SECONDS + 1), CROUCH);
    expect(states()).toEqual([
      [false, false],
      [false, false],
    ]);
    expect(hash(loaded)).toBe(hash(sim));
  });
});
