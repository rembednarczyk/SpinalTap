import { describe, expect, it } from "vitest";
import { docks } from "../src";
import { AWAY, byKey, run, teleportPlayer } from "./helpers";
import { firstDivergence, hash, reload, taken } from "./contract-save-helpers";

/**
 * Saved away from the docks with the office's guards after her or half sure of her (G-185 (b),
 * (c)): the loaded game goes on as the saved one, there and back at the office. She is alive
 * and standing on the map (Plac Litewski): the game makes no save on the death screen.
 */

/** Seed 77, two jobs done: `metres` in front of the door guard, until the alarm or for a sixth of a second. */
const atTheDoor = (metres: number, alarm: boolean) => {
  const { sim, c } = taken(77, 2, docks(6, 0, 110), "infiltrate");
  const door = byKey(sim, `${c.id}-g1`)!;
  teleportPlayer(sim, { x: door.position.x + metres, y: door.position.y, z: door.position.z }, -Math.PI / 2);
  if (alarm) for (let i = 0; i < 600 && sim.domain.contracts.active; i++) sim.step();
  run(sim, 10);
  return { sim, id: c.id, door };
};

describe("save and load away from the docks (G-185)", () => {
  for (const away of [1, 120]) {
    for (const back of [false, true]) {
      it(`the guards of the alarm (lost her ${away} steps ago${back ? ", then back at the office" : ""}) go on as saved`, () => {
        const { sim, id, door } = atTheDoor(6, true);
        expect(sim.domain.contracts.active).toBeNull();
        expect(door.ai!.alerted).toBe(true);
        teleportPlayer(sim, AWAY);
        run(sim, away);
        expect(sim.session.gameOver).toBe(false);
        const loaded = reload(sim);
        expect(hash(loaded)).toBe(hash(sim));
        expect(byKey(loaded, door.key!)?.ai?.lost).toBe(byKey(sim, door.key!)?.ai?.lost);
        if (back) for (const s of [sim, loaded]) teleportPlayer(s, docks(0, 0, 120));
        expect(firstDivergence(sim, loaded, 10 * 60, id)).toBeNull();
      });
    }
  }

  for (const away of [1, 120]) {
    it(`a guard half sure of her, asleep with his chunk (${away} steps away), is as sure when she comes back`, () => {
      const { sim, id, door } = atTheDoor(8, false);
      expect(door.ai!.alerted).toBe(false);
      expect(door.ai!.suspicion).toBeGreaterThan(0.05);
      teleportPlayer(sim, AWAY);
      run(sim, away);
      const loaded = reload(sim);
      for (const s of [sim, loaded]) teleportPlayer(s, docks(0, 0, 120));
      run(sim, 5);
      run(loaded, 5);
      expect(byKey(loaded, door.key!)?.ai?.suspicion).toBe(byKey(sim, door.key!)?.ai?.suspicion);
      expect(hash(loaded)).toBe(hash(sim));
      expect(firstDivergence(sim, loaded, 10 * 60, id)).toBeNull();
    });
  }
});
