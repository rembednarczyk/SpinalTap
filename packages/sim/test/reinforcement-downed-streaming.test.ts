import { describe, expect, it } from "vitest";
import type { HeatState, SaveSnapshot } from "@seki/core";
import { SIM_HZ, Simulation, stateHash } from "../src";
import { reinforcementEntity } from "../src/world/reinforcements";
import { run, teleportPlayer } from "./helpers";
import { CROUCH, offset, quietStreet, takeDown } from "./takedown-scenes";

/**
 * A reinforcement knocked out, alive, when the player walks away (G-219): the heat's people have
 * no chunk of their own, so it stays in the world as their bodies do, wherever she goes, and the
 * count sent stays with it.
 */

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));
const HEAT: HeatState = { level: 1, faction: "hebi", searching: true, lastKnown: null, searchLeft: 4, cooldown: 0 };

const theDowned = (sim: Simulation) => sim.world.with("downed").entities.find((b) => b.security?.n === 1);

/** Plac Litewski with Hebi's heat up and its first reinforcement knocked out (or killed), the player then `far` metres east of it. */
const leftBehind = (seed: number, dead: boolean, far: number): Simulation => {
  const start = quietStreet(seed);
  const fresh = roundTrip(start.snapshot(null, "t", ""));
  const sim = Simulation.fromSnapshot({ ...fresh, domain: { ...fresh.domain, heat: { ...HEAT, lastKnown: start.player()!.position } } });
  const p = sim.player()!;
  p.posture!.crouched = true;
  p.posture!.amount = 1;
  p.posture!.prevAmount = 1;
  const g = sim.world.add(reinforcementEntity(4000, 1, sim.tick, "hebi_ganger", offset(sim, 0, 1.2), sim.domain.difficulty.npcHealth));
  g.hackFx = { pinged: 0, blind: 100, crippled: 0 };
  sim.session.watch.sent = 1;
  takeDown(sim, dead);
  expect(theDowned(sim)?.downed.dead).toBe(dead);
  teleportPlayer(sim, offset(sim, far, 0), Math.PI / 2);
  run(sim, 3 * SIM_HZ, CROUCH);
  return sim;
};

describe("a reinforcement knocked out when the player walks away (G-219)", () => {
  for (const [seed, far] of [
    [7, 300],
    [7, 600],
    [3, 400],
  ] as const) {
    it(`seed ${seed}, ${far} m away: alive or dead, it still lies there and keeps the count sent`, () => {
      for (const dead of [false, true]) {
        const sim = leftBehind(seed, dead, far);
        const body = theDowned(sim);
        expect(body, `dead ${dead}`).toBeDefined();
        expect(body!.downed.dead).toBe(dead);
        expect(sim.session.watch.sent).toBe(1);
      }
    });
  }

  it("back where it fell, and through a save and a load far away, it is the same body", () => {
    const sim = leftBehind(7, false, 300);
    const at = { ...theDowned(sim)!.position };
    const snap = roundTrip(sim.snapshot(null, "t", ""));
    expect(snap.reinforcements?.people.map((p) => [p.n, p.state.downed?.dead])).toEqual([[1, false]]);
    const loaded = Simulation.fromSnapshot(snap);
    expect(hash(loaded)).toBe(hash(sim));
    for (const s of [sim, loaded]) {
      teleportPlayer(s, offset(s, -300, 0), -Math.PI / 2);
      run(s, 3 * SIM_HZ, CROUCH);
      expect(theDowned(s)?.position).toEqual(at);
      expect(theDowned(s)?.unconscious).toBe(true);
    }
    expect(hash(loaded)).toBe(hash(sim));
  });
});
