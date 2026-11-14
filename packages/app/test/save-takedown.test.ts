import { describe, expect, it } from "vitest";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { FixedStepLoop, GRAB_TIME, SIM_DT, Simulation, TAKEDOWN_TIME, clinicPoint, gangerEntity, stateHash } from "@seki/sim";
import { AUTOSAVE_SLOT } from "../src/controllers/autosave-controller";
import { createDebugApi } from "../src/debug-api";
import type { GameSession } from "../src/game-session";
import { frame, setup, steps, teleport } from "./story-helpers";

/**
 * No save in the middle of a takedown (G-253): the grip is not in the save, so a game loaded from
 * it would have no grip while the game saved from finishes it. The slot save refuses, as in a
 * conversation; the autosave waits for the grip's end and is written then.
 */

class CountingStore extends MemorySaveStore {
  readonly puts: string[] = [];
  override async put(slot: string, value: string) {
    this.puts.push(slot);
    await super.put(slot, value);
  }
}

const CROUCH = frame({ crouch: true });
// The grab waits for the choice (ADR-0075); left alone it knocks out after the window.
const GRIP = Math.ceil((GRAB_TIME + TAKEDOWN_TIME) / SIM_DT);
const settle = () => new Promise((r) => setTimeout(r, 0));

/**
 * A new game, the player crouched behind a Tessen guard on the street 40 m south of the clinic,
 * out of every bystander's sight: no witness's call (G-240) runs across the save, only the grip.
 * The guard has no key, so its body is saved as a stray one and the loaded game has it too.
 */
const behindGuard = (store: CountingStore) => {
  const { session, ui } = setup(store);
  session.newGame();
  steps(session, 2);
  const street = clinicPoint(-4, 0, -40);
  teleport(session, street.x, street.z, 0, 0, street.y);
  steps(session, 30, CROUCH);
  const p = session.sim.player()!;
  const at = { x: p.position.x, y: p.position.y, z: p.position.z + 1.2 };
  const guard = gangerEntity(9000, { key: "test-guard", position: at, yaw: 0 }, null, 80, p.chunk ?? "", undefined, "tessen_guard");
  delete guard.key;
  session.sim.world.add(guard);
  steps(session, 1, CROUCH);
  expect(session.sim.session.takedownTarget?.id).toBe(guard.id);
  return { session, ui };
};

/** Starts the takedown and goes a few steps into the grip. */
const grip = (session: GameSession) => {
  steps(session, 1, frame({ crouch: true, interact: true }));
  steps(session, 3, CROUCH);
  expect(session.sim.session.takedown).not.toBeNull();
};

const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));

describe("a save during a takedown (G-253)", () => {
  it("the slot save is refused in the grip, with the toast of the other refusals, and goes through after", async () => {
    const store = new CountingStore();
    const { session, ui } = behindGuard(store);
    grip(session);
    expect(await session.saves.saveAsync("quick")).toBe(false);
    expect(store.puts).not.toContain("quick");
    expect(ui.getState().toasts.map((t) => t.title)).toContain("Can't save right now");
    steps(session, GRIP, CROUCH);
    expect(session.sim.session.takedown).toBeNull();
    expect(await session.saves.saveAsync("quick")).toBe(true);
  });

  it("the autosave waits for the grip's end, is written then, and the loaded game goes on as the saved one", async () => {
    const store = new CountingStore();
    const { session } = behindGuard(store);
    grip(session);
    const before = store.puts.length;
    session.bus.emit("InteriorEntered", { interiorId: "x" });
    let gripped = 0;
    while (session.sim.session.takedown) {
      steps(session, 1, CROUCH);
      await settle();
      if (!session.sim.session.takedown) break;
      gripped += 1;
      // Not one autosave while she still holds the guard.
      expect(store.puts.slice(before), `grip step ${gripped}`).not.toContain(AUTOSAVE_SLOT);
    }
    expect(gripped).toBeGreaterThan(0);
    // The one asked for is written in the step the grip ends.
    expect(store.puts.slice(before)).toContain(AUTOSAVE_SLOT);
    const saved = session.sim.tick;

    const loaded = Simulation.fromSnapshot((await new SavePersistence(store).load(AUTOSAVE_SLOT))!);
    expect(loaded.session.takedown).toBeNull();
    expect(loaded.tick).toBe(saved);
    // The knocked-out guard lies in both games.
    const down = (sim: Simulation) => sim.world.with("downed").entities.filter((e) => e.unconscious).length;
    expect(down(loaded)).toBe(1);
    expect(down(session.sim)).toBe(1);
    for (let i = 0; i < 5 / SIM_DT; i++) {
      session.sim.step(CROUCH);
      loaded.step(CROUCH);
      expect(hash(loaded), `step ${i}`).toBe(hash(session.sim));
    }
  });

  it("the debug jump goes through the same gate (G-256): refused in the grip, as before out of it", () => {
    const { session, ui } = behindGuard(new CountingStore());
    const loop = new FixedStepLoop({ now: () => 0 }, { update() {}, render() {} });
    const seki = createDebugApi(session, ui, loop, () => ({ fps: 0, frameTimeMs: 0, drawCalls: 0, activeMeshes: 0, activeTriangles: 0, totalMeshes: 0, materials: 0, textures: 0, skeletons: 0, nodes: 0, particles: 0, byName: {} }), () => {});
    const rich = () => ({ wallet: { ...session.sim.domain.wallet, eddies: 4321 } });
    grip(session);
    const tick = session.sim.tick;
    expect(() => seki.jump(rich())).toThrow(/can't save/i);
    // Nothing restored: the grip goes on in the same game.
    expect(session.sim.session.takedown).not.toBeNull();
    expect(session.sim.tick).toBe(tick);
    expect(session.sim.domain.wallet.eddies).not.toBe(4321);
    steps(session, GRIP, CROUCH);
    expect(session.sim.session.takedown).toBeNull();
    seki.jump(rich());
    expect(session.sim.domain.wallet.eddies).toBe(4321);
  });
});
