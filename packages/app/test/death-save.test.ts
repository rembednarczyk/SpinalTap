import { describe, expect, it } from "vitest";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { createUiStore } from "@seki/ui";
import { AUTOSAVE_SLOT } from "../src/controllers/autosave-controller";
import { GameSession } from "../src/game-session";
import { FakeRender, steps, teleport } from "./story-helpers";

/**
 * No save of a dead player (G-180): a save at 0 HP loads with `gameOver` false and flatlines a
 * second time, so every way to write a slot must be shut once the player dies. Headless
 * (ADR-0046): quicksave (F5), the menus' save intent, the autosave triggers of the same step
 * (a district, ADR-0061) and the page hiding, the pause menu reached from the death screen.
 */

class CountingStore extends MemorySaveStore {
  readonly puts: string[] = [];
  override async put(slot: string, value: string) {
    this.puts.push(slot);
    await super.put(slot, value);
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

const start = () => {
  const store = new CountingStore();
  const ui = createUiStore();
  const session = new GameSession({ render: new FakeRender(), audio: { play() {}, stopAll() {} }, persistence: new SavePersistence(store), ui, story: STORY_SOURCE, seed: () => 77, now: () => new Date(2026, 9, 27) });
  session.newGame();
  steps(session, 2);
  for (const g of [...session.sim.world.with("ai")]) session.sim.world.remove(g);
  return { session, store, ui };
};

/** A fatal fall onto the deptak: the movement system deals the damage, the death system ends the run. */
const fallToDeath = (session: GameSession): number => {
  const p = session.sim.player()!;
  teleport(session, p.position.x, p.position.z, 0, 0, p.position.y + 40);
  p.health = { ...p.health!, current: 1 };
  for (let i = 0; i < 600; i++) {
    steps(session, 1);
    const hp = session.sim.player()?.health?.current ?? 0;
    // Damage comes before the death system in a step, so no step ends at 0 HP and still alive.
    if (hp <= 0) {
      expect(session.sim.session.gameOver).toBe(true);
      expect(session.screen).toBe("dead");
      return i;
    }
    expect(session.screen).toBe("playing");
  }
  throw new Error("the fall did not kill the player");
};

describe("no save after the player dies (G-180)", () => {
  it("refuses quicksave and the slot menu right after a fatal fall, and writes no slot", async () => {
    const { session, store, ui } = start();
    fallToDeath(session);
    expect(await session.saves.saveAsync("quick")).toBe(false);
    expect(ui.getState().toasts.at(-1)?.title).toBe("Can't save right now");
    session.intents.save("slot-1");
    await flush();
    expect(store.puts.filter((s) => s !== AUTOSAVE_SLOT)).toEqual([]);
  });

  it("keeps the death screen: no pause menu to save from, and not on the title screen either", async () => {
    const { session, store } = start();
    fallToDeath(session);
    session.pause();
    expect(session.screen).toBe("dead");
    session.resume();
    expect(session.screen).toBe("dead");
    steps(session, 5);
    expect(session.screen).toBe("dead");
    session.quitToTitle();
    expect(await session.saves.saveAsync("quick")).toBe(false);
    expect(store.puts).toEqual([]);
  });

  it("writes no autosave for a district crossed in the step of the death, nor when the page hides", async () => {
    const { session, store } = start();
    expect(session.sim.district).toBe("shinsekai-7");
    // Into the Targ with a lethal wound: the crossing and the death fall into one step.
    teleport(session, 717.5, 296);
    session.sim.player()!.health = { current: 0, max: 100 };
    steps(session, 1);
    expect(session.sim.district).toBe("targ");
    expect(session.screen).toBe("dead");
    session.pageHidden();
    await flush();
    expect(store.puts).toEqual([]);
  });
});
