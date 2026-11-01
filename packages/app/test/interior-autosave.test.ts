import { describe, expect, it } from "vitest";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { INTERIORS, SIM_HZ, clinicPoint, koiPoint } from "@seki/sim";
import { createUiStore, isMessageKey, translate } from "@seki/ui";
import { AUTOSAVE_PLACE_COOLDOWN_TICKS, AUTOSAVE_SLOT } from "../src/controllers/autosave-controller";
import { GameSession, RECALL_CALM_TICKS } from "../src/game-session";
import { FakeRender, steps, teleport } from "./story-helpers";

/**
 * Autosave on stepping into an interior (ADR-0061), headless: the session's `interior` system
 * sends `InteriorEntered` once per crossing, the autosave waits for a safe moment as for its other
 * triggers, and a load or a new game inside a room saves nothing.
 */

class CountingStore extends MemorySaveStore {
  readonly puts: string[] = [];
  override async put(slot: string, value: string) {
    this.puts.push(slot);
    await super.put(slot, value);
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const autos = (store: CountingStore) => store.puts.filter((s) => s === AUTOSAVE_SLOT).length;

/** A new game, woken in the clinic, with the AI of the street taken out unless a test needs it. */
const start = (quiet = true) => {
  const store = new CountingStore();
  const ui = createUiStore();
  const session = new GameSession({ render: new FakeRender(), audio: { play() {}, stopAll() {} }, persistence: new SavePersistence(store), ui, story: STORY_SOURCE, seed: () => 77, now: () => new Date(2026, 9, 27) });
  session.newGame();
  steps(session, 2);
  if (quiet) for (const g of [...session.sim.world.with("ai")]) session.sim.world.remove(g);
  const seen: string[] = [];
  session.bus.on("InteriorEntered", (e) => seen.push(`in:${e.interiorId}`));
  session.bus.on("InteriorLeft", (e) => seen.push(`out:${e.interiorId}`));
  return { session, store, seen };
};

/** Out of the clinic onto the deptak, then into a room at `p`, a step each. */
const outAndInto = (session: GameSession, p: { x: number; y: number; z: number }) => {
  const street = clinicPoint(-4, 0, 4.4);
  teleport(session, street.x, street.z, 0, 0, street.y);
  steps(session, 1);
  teleport(session, p.x, p.z, 0, 0, p.y);
  steps(session, 1);
};

describe("autosave on entering an interior (ADR-0061)", () => {
  it("saves nothing for waking up in the clinic, once for leaving and coming back in", async () => {
    const { session, store, seen } = start();
    await flush();
    expect(seen).toEqual([]);
    expect(autos(store)).toBe(0);
    const inside = clinicPoint(-10, 0, 6.6);
    outAndInto(session, inside);
    await flush();
    expect(seen).toEqual(["out:clinic", "in:clinic"]);
    expect(autos(store)).toBe(1);
    // Staying in: nothing more.
    steps(session, 30);
    await flush();
    expect(seen).toHaveLength(2);
    expect(autos(store)).toBe(1);
  });

  it("holds the save while in combat and writes it once the fight is over", async () => {
    const { session, store } = start(false);
    const npc = [...session.sim.world].find((e) => e.health && !e.player)!;
    session.sim.session.lastThreat = { tick: session.sim.tick, sourceId: npc.id };
    outAndInto(session, koiPoint(12.6, 0, 1.2));
    await flush();
    expect(session.sim.session.interior).toBe("neon-koi");
    expect(autos(store)).toBe(0);
    steps(session, RECALL_CALM_TICKS);
    await flush();
    expect(autos(store)).toBe(1);
  });

  it("saves once for a run of 20 crossings of the clinic's door a second apart, again after the cooldown", async () => {
    const { session, store, seen } = start();
    const inside = clinicPoint(-10, 0, 4.4);
    for (let k = 0; k < 20; k++) {
      outAndInto(session, inside);
      steps(session, SIM_HZ - 2);
      await flush();
    }
    expect(seen.filter((e) => e === "in:clinic")).toHaveLength(20);
    expect(autos(store)).toBe(1);
    steps(session, AUTOSAVE_PLACE_COOLDOWN_TICKS);
    outAndInto(session, inside);
    await flush();
    expect(autos(store)).toBe(2);
  });

  it("saves at most once for a stick trembling on the threshold, 0.35 m in and out every 20 ticks", async () => {
    const { session, store, seen } = start();
    const [a, b] = [clinicPoint(-7.0, 0, 4.4), clinicPoint(-7.35, 0, 4.4)];
    for (let k = 0; k < 20; k++) {
      const p = k % 2 === 0 ? a : b;
      teleport(session, p.x, p.z, 0, 0, p.y);
      steps(session, 20);
      await flush();
    }
    expect(seen.length).toBeGreaterThan(2);
    expect(autos(store)).toBeLessThanOrEqual(1);
  });

  it("saves once for a run back and forth over a district's border", async () => {
    const { session, store } = start();
    const street = clinicPoint(-4, 0, 4.4);
    for (let k = 0; k < 10; k++) {
      teleport(session, 717.5, 296);
      steps(session, 15);
      expect(session.sim.district).toBe("targ");
      teleport(session, street.x, street.z, 0, 0, street.y);
      steps(session, 15);
      await flush();
    }
    expect(autos(store)).toBe(1);
  });

  it("does not save on a load that lands inside a room", async () => {
    const { session, store, seen } = start();
    expect(await session.saves.saveAsync("t")).toBe(true);
    expect(await session.saves.loadAsync("t")).toBe(true);
    steps(session, 3);
    await flush();
    expect(seen).toEqual([]);
    expect(session.sim.session.interior).toBe("clinic");
    expect(autos(store)).toBe(0);
  });

  it("names every interior in English and in Polish", () => {
    for (const i of INTERIORS) {
      expect(isMessageKey(i.name), i.id).toBe(true);
      if (!isMessageKey(i.name)) continue;
      expect(translate("en", i.name)).not.toBe("");
      expect(translate("pl", i.name)).not.toBe("");
    }
    expect(translate("pl", "interior.clinic")).toBe("Klinika doktora Mori");
  });
});
