import { describe, expect, it } from "vitest";
import type { HeatState, SaveSnapshot } from "@seki/core";
import { SIM_HZ, Simulation, stateHash } from "../src";
import { reinforcementEntity } from "../src/world/reinforcements";
import { run, teleportPlayer } from "./helpers";
import { CROUCH, offset, quietStreet, takeDown } from "./takedown-scenes";

/**
 * A reinforcement knocked out, alive (G-196): it still has its mind, but once the heat is over
 * only those on their feet go home; the one lying there stays, as a body, and takes no place.
 */

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));
const HEAT: HeatState = { level: 1, faction: "hebi", searching: true, lastKnown: null, searchLeft: 4, cooldown: 0 };
const ID = 4000;

/** Plac Litewski with Hebi's heat up and its first reinforcement 1.2 m north of the player, its back to her, knocked out. */
const knockedOut = (seed: number): Simulation => {
  const start = quietStreet(seed);
  const fresh = roundTrip(start.snapshot(null, "t", ""));
  const sim = Simulation.fromSnapshot({ ...fresh, domain: { ...fresh.domain, heat: { ...HEAT, lastKnown: start.player()!.position } } });
  const p = sim.player()!;
  p.posture!.crouched = true;
  p.posture!.amount = 1;
  p.posture!.prevAmount = 1;
  const g = sim.world.add(reinforcementEntity(ID, 1, "hebi_ganger", offset(sim, 0, 1.2), sim.domain.difficulty.npcHealth));
  g.hackFx = { pinged: 0, blind: 100, crippled: 0 };
  sim.session.watch.sent = 1;
  takeDown(sim, false);
  expect(g.downed?.dead).toBe(false);
  expect(g.ai).toBeDefined();
  return sim;
};

/** Far from the body (beyond the entries' minimum) with her back to it, until the heat is over. */
const awayTillCold = (sim: Simulation): void => {
  teleportPlayer(sim, offset(sim, 30, 0), Math.PI / 2);
  for (let i = 0; i < 120 * SIM_HZ && sim.domain.heat.level > 0; i++) sim.step(CROUCH);
  expect(sim.domain.heat.level).toBe(0);
  run(sim, 3 * SIM_HZ, CROUCH);
};

const theDowned = (sim: Simulation) => sim.world.with("downed").entities.find((b) => b.security?.n === 1);

describe("a reinforcement knocked out when the heat is over (G-196)", () => {
  for (const seed of [7, 3]) {
    it(`seed ${seed}: it lies where it fell, the ones on their feet are gone home`, () => {
      const sim = knockedOut(seed);
      const at = { ...theDowned(sim)!.position };
      awayTillCold(sim);
      const body = theDowned(sim);
      expect(body).toBeDefined();
      expect(body!.downed.dead).toBe(false);
      expect(body!.position).toEqual(at);
      // Nobody on their feet stayed behind; the body keeps its number from coming round again.
      expect(sim.world.with("security").entities.filter((e) => !e.downed)).toEqual([]);
      expect(sim.session.watch.sent).toBe(Math.max(...sim.world.with("security").entities.map((e) => e.security.n)));
    });
  }

  it("hidden alive in a dumpster: it is still in there when the heat is over", () => {
    const sim = knockedOut(11);
    const p = sim.player()!.position;
    const c = { x: p.x + 2, y: p.y + 0.7, z: p.z };
    sim.world.add({
      id: 4500,
      position: c,
      prevPosition: c,
      yaw: 0,
      prevYaw: 0,
      pitch: 0,
      view: { kind: "block", size: { x: 2.4, y: 1.4, z: 1.4 }, material: "metal" },
      solid: { min: { x: c.x - 1.2, y: p.y, z: c.z - 0.7 }, max: { x: c.x + 1.2, y: p.y + 1.4, z: c.z + 0.7 } },
      hide: "dumpster",
    });
    sim.step(CROUCH);
    sim.enqueue({ type: "carry-body" });
    sim.step(CROUCH);
    sim.enqueue({ type: "drop-body" });
    sim.step(CROUCH);
    expect(theDowned(sim)!.downed).toMatchObject({ hidden: true, dead: false });
    awayTillCold(sim);
    expect(theDowned(sim)?.downed.hidden).toBe(true);
  });

  it("lying there, it takes no place: the heat brings in another on its feet", () => {
    const sim = knockedOut(7);
    teleportPlayer(sim, offset(sim, 30, 0), Math.PI / 2);
    const standing = () => sim.world.with("security").entities.filter((e) => !e.downed);
    for (let i = 0; i < 10 * SIM_HZ && standing().length === 0 && sim.domain.heat.level > 0; i++) sim.step(CROUCH);
    expect(standing().map((e) => e.security.n)).toEqual([2]);
  });

  it("saved and loaded after the heat: it is still there and the game runs on as the saved one", () => {
    const sim = knockedOut(7);
    awayTillCold(sim);
    const snap = roundTrip(sim.snapshot(null, "t", ""));
    expect(snap.reinforcements?.people.map((p) => [p.n, p.state.downed?.dead])).toEqual([[1, false]]);
    const loaded = Simulation.fromSnapshot(snap);
    const back = theDowned(loaded);
    expect(back).toBeDefined();
    expect(back!.position).toEqual(theDowned(sim)!.position);
    expect(back!.unconscious).toBe(true);
    expect(loaded.session.watch.sent).toBe(sim.session.watch.sent);
    expect(hash(loaded)).toBe(hash(sim));
    for (let i = 0; i < 5 * SIM_HZ; i++) {
      sim.step(CROUCH);
      loaded.step(CROUCH);
    }
    expect(theDowned(loaded)).toBeDefined();
    expect(hash(loaded)).toBe(hash(sim));
  });
});
