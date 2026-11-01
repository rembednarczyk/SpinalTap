import { describe, expect, it } from "vitest";
import { DOKI_TERMINAL_SPOTS, GENZO_SPOT, type Simulation, ground } from "../src";
import { AWAY, byKey, input, run, teleportPlayer } from "./helpers";
import { hash, reload, taken } from "./contract-save-helpers";

/** Saving and loading while the hack's wave shoots at the player on the terminal (G-185 (a)). */

/** On the quay terminal, connected, `steps` steps into the hack: the wave is at her. */
const hacking = (seed: number, steps: number): { sim: Simulation; id: string } => {
  const { sim, c } = taken(seed, 0, ground(GENZO_SPOT.x + 0.4, GENZO_SPOT.z - 2), "hack");
  const t = DOKI_TERMINAL_SPOTS.quay_terminal!;
  teleportPlayer(sim, ground(t.x, t.z - 1.4), 0);
  sim.step(input({ interact: true }));
  run(sim, steps);
  // A save is made only with her alive (the app has no saving on the death screen).
  expect(sim.session.gameOver).toBe(false);
  expect(sim.domain.contracts.active?.status).toBe("active");
  return { sim, id: c.id };
};

/** What the wave's shooters carry between steps: the gun's state and the sniper's. */
const shooters = (sim: Simulation, id: string) =>
  [...sim.world]
    .filter((e) => e.key?.startsWith(`${id}-g`) && e.combatant)
    .sort((a, b) => a.key!.localeCompare(b.key!))
    .map((e) => ({ key: e.key, cooldown: e.combatant!.cooldown, loaded: e.combatant!.loaded, bloom: e.combatant!.bloom, sniper: e.sniper && { ...e.sniper, perches: undefined } }));

describe("save and load during a hack under fire (G-185)", () => {
  for (const [seed, steps] of [
    [9, 565],
    [9, 60],
    [9, 300],
    [21, 200],
  ] as const) {
    it(`the loaded game fights on as the saved one (seed ${seed}, ${steps} steps in)`, () => {
      const { sim, id } = hacking(seed, steps);
      const loaded = reload(sim);
      expect(shooters(loaded, id)).toEqual(shooters(sim, id));
      for (let i = 1; i <= 10 * 60; i++) {
        sim.step();
        loaded.step();
        expect({ i, hash: hash(loaded) }).toEqual({ i, hash: hash(sim) });
      }
      expect(shooters(loaded, id)).toEqual(shooters(sim, id));
      expect(loaded.player()!.health!.current).toBe(sim.player()!.health!.current);
    });
  }

  it("asleep with their chunk, the shooters wake as before: guns loaded and at rest, the sniper idle", () => {
    const { sim, id } = hacking(9, 300);
    expect(shooters(sim, id).some((s) => s.loaded < byKey(sim, s.key!)!.combatant!.stats!.magazine)).toBe(true);
    teleportPlayer(sim, AWAY);
    for (let i = 0; i < 60 * 60 && shooters(sim, id).length > 0; i++) sim.step();
    expect(shooters(sim, id)).toEqual([]);
    const loaded = reload(sim);
    for (const s of [sim, loaded]) {
      teleportPlayer(s, ground(GENZO_SPOT.x + 0.4, GENZO_SPOT.z - 2));
      s.step();
      const woken = shooters(s, id);
      expect(woken.length).toBeGreaterThan(0);
      for (const w of woken) {
        expect(w.loaded).toBe(byKey(s, w.key!)!.combatant!.stats!.magazine);
        expect(w.bloom).toBe(0);
        if (w.sniper) expect(w.sniper.phase).toBe("idle");
      }
    }
    expect(hash(loaded)).toBe(hash(sim));
  });

  it("the sniper about to fire fires in the loaded game too, in the same step", () => {
    const { sim, id } = hacking(9, 565);
    const sniper = byKey(sim, `${id}-g1`)!;
    expect(sniper.sniper?.phase).toBe("aim");
    const loaded = reload(sim);
    sim.step();
    loaded.step();
    expect(byKey(loaded, sniper.key!)!.combatant!.cooldown).toBeGreaterThan(2);
    expect(byKey(loaded, sniper.key!)!.combatant!.cooldown).toBe(sniper.combatant!.cooldown);
    expect(loaded.player()!.health!.current).toBe(sim.player()!.health!.current);
  });
});
