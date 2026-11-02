import { describe, expect, it } from "vitest";
import type { SaveSnapshot } from "@seki/core";
import { SIM_HZ, Simulation, stateHash, type Entity } from "../src";
import { run, teleportPlayer } from "./helpers";
import { enterKanal } from "./micro-scenes";
import { CROUCH, takeDown } from "./takedown-scenes";

/**
 * The body of a won mugging's mugger when the player walks away (G-239): unkeyed, it has no state
 * to leave behind, so it does not fall asleep with the victim's chunk; it lies where it fell
 * until she comes back, in the game and after a load.
 */

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));
const CALM = 12 * SIM_HZ;

/** A mugger's body: an enemy's, of nobody keyed and none of the heat's. */
const bodies = (sim: Simulation) => sim.world.with("downed").entities.filter((b) => !b.key && !b.security && !!b.enemy);

/** Both muggers of the mugging by Brama Krakowska taken down from behind (`lethal` or not): it is won. */
const won = (seed: number, lethal: boolean): Simulation => {
  const { sim, ended } = enterKanal("mugging", seed);
  const run0 = sim.session.street2.micro!;
  for (const e of [...sim.world] as Entity[]) if (run0.attackers.includes(e.id)) e.hackFx = { pinged: 0, blind: 100, crippled: 0 };
  const p = sim.player()!;
  p.posture = { ...p.posture!, crouched: true, amount: 1, prevAmount: 1 };
  for (const id of run0.attackers) {
    const a = [...sim.world].find((e) => e.id === id)!;
    teleportPlayer(sim, { x: a.position.x - Math.sin(a.yaw), y: a.position.y, z: a.position.z - Math.cos(a.yaw) }, a.yaw);
    takeDown(sim, lethal);
  }
  sim.step(CROUCH);
  expect(ended).toEqual([{ encounterId: run0.id, outcome: "won" }]);
  run(sim, CALM, CROUCH);
  expect(bodies(sim)).toHaveLength(2);
  return sim;
};

const away = (sim: Simulation, dx: number): void => {
  const p = sim.player()!.position;
  teleportPlayer(sim, { ...p, x: p.x + dx }, Math.PI / 2);
  run(sim, 3 * SIM_HZ, CROUCH);
};

/** Where they lie, west to east (a load gives them new ids). */
const where = (sim: Simulation) =>
  bodies(sim)
    .map((b) => ({ at: b.position, dead: b.downed.dead }))
    .sort((a, b) => a.at.x - b.at.x);

describe("the body of a won mugging's mugger when the player walks away (G-239)", () => {
  for (const [seed, far] of [
    [13, 400],
    [7, 400],
    [13, 600],
  ] as const) {
    for (const lethal of [true, false]) {
      it(`seed ${seed}, ${far} m away and back (lethal: ${lethal}): the bodies lie where they fell`, () => {
        const sim = won(seed, lethal);
        const before = where(sim);
        const chunks = sim.snapshot(null, "t", "").streaming.loadedChunks;
        away(sim, far);
        // The victim's chunk is asleep: she is far enough.
        expect(sim.snapshot(null, "t", "").streaming.loadedChunks.filter((c) => chunks.includes(c))).toEqual([]);
        expect(where(sim)).toEqual(before);
        away(sim, -far);
        expect(where(sim)).toEqual(before);
      });
    }
  }

  it("saved and loaded far away, the game goes on the same and the bodies lie there on coming back", () => {
    const sim = won(13, false);
    const before = where(sim);
    away(sim, 400);
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
    expect(where(loaded)).toEqual(before);
    expect(hash(loaded)).toBe(hash(sim));
    for (let i = 0; i < 300; i++) {
      sim.step(CROUCH);
      loaded.step(CROUCH);
    }
    expect(hash(loaded)).toBe(hash(sim));
    for (const s of [sim, loaded]) away(s, -400);
    expect(where(loaded)).toEqual(before);
    expect(where(sim)).toEqual(before);
    expect(hash(loaded)).toBe(hash(sim));
  });

  it("loaded by the bodies, then walking away and back: they lie there in both", () => {
    const sim = won(7, true);
    const before = where(sim);
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
    for (const s of [sim, loaded]) {
      away(s, 400);
      expect(where(s)).toEqual(before);
      away(s, -400);
      expect(where(s)).toEqual(before);
    }
    expect(hash(loaded)).toBe(hash(sim));
  });
});
