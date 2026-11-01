import { describe, expect, it, vi } from "vitest";
import type { DomainEvents, Locale } from "@seki/core";
import { SIM_DT, TAKEDOWN_TIME, clinicPoint, gangerEntity } from "@seki/sim";
import { patchUi } from "@seki/ui";
import type { GameSession } from "../src/game-session";
import { type Ui, frame, setup, steps, teleport } from "./story-helpers";

/**
 * Takedowns in a headless session (ADR-0065): the prompt with its hold action in the player's
 * language, and the interact key on it turned into the `takedown` command.
 */

const CROUCH = frame({ crouch: true });
const speak = (ui: Ui, locale: Locale) => patchUi(ui, { settings: { ...ui.getState().settings, locale } });

/** A new game out on the deptak, nobody else armed about, the player crouched behind a Tessen guard. */
const behindGuard = () => {
  const { session, ui } = setup();
  session.newGame();
  steps(session, 2);
  for (const g of [...session.sim.world.with("ai")]) session.sim.world.remove(g);
  const street = clinicPoint(-4, 0, 4.4);
  teleport(session, street.x, street.z, 0, 0, street.y);
  steps(session, 30, CROUCH);
  const p = session.sim.player()!;
  const at = { x: p.position.x, y: p.position.y, z: p.position.z + 1.2 };
  const guard = session.sim.world.add(gangerEntity(9000, { key: "test-guard", position: at, yaw: 0 }, null, 80, p.chunk ?? "", undefined, "tessen_guard"));
  return { session, ui, guard };
};

const collect = <K extends keyof DomainEvents>(session: GameSession, type: K): DomainEvents[K][] => {
  const out: DomainEvents[K][] = [];
  session.bus.on(type, (e) => out.push(e));
  return out;
};

describe("takedown in the session (ADR-0065)", () => {
  it("shows the takedown prompt with its hold action, in English and in Polish", () => {
    const { session, ui } = behindGuard();
    steps(session, 1, CROUCH);
    expect(ui.getState().prompt).toBe("Take down");
    expect(ui.getState().promptHold).toBe("hold attack to kill");
    speak(ui, "pl");
    expect(ui.getState().prompt).toBe("Obezwładnij");
    expect(ui.getState().promptHold).toBe("przytrzymaj atak, by zabić");
    // Out of reach: the prompt and its hold action go.
    const p = session.sim.player()!;
    teleport(session, p.position.x, p.position.z - 1, 0, 0, p.position.y);
    steps(session, 1, CROUCH);
    expect(ui.getState().prompt).toBeNull();
    expect(ui.getState().promptHold).toBeNull();
  });

  it("turns the interact key on the prompt into the command, and knocks the guard out", () => {
    const { session, guard } = behindGuard();
    const started = collect(session, "TakedownStarted");
    const done = collect(session, "TakedownDone");
    steps(session, 1, CROUCH);
    steps(session, 1, frame({ crouch: true, interact: true }));
    expect(started).toEqual([{ target: guard.id, duration: TAKEDOWN_TIME }]);
    steps(session, Math.ceil(TAKEDOWN_TIME / SIM_DT), CROUCH);
    expect(done).toEqual([{ target: guard.id, lethal: false, witnessed: false }]);
    expect(guard.unconscious).toBe(true);
  });

  it("talks to whoever is nearer than the guard instead of taking it down", () => {
    const { session, ui, guard } = behindGuard();
    const p = session.sim.player()!;
    const at = { x: p.position.x + 0.5, y: p.position.y, z: p.position.z };
    session.sim.world.add({ id: 99_999, position: at, prevPosition: at, yaw: 0, prevYaw: 0, pitch: 0, interactable: { kind: "dialogue", dialogueId: "fixer", prompt: "prompt.talk.kaito", radius: 2 } });
    const started = collect(session, "TakedownStarted");
    steps(session, 1, CROUCH);
    expect(ui.getState().prompt).toBe("Talk to Kaito");
    expect(ui.getState().promptHold).toBeNull();
    steps(session, 1, frame({ crouch: true, interact: true }));
    expect(started).toEqual([]);
    expect(guard.unconscious).toBeUndefined();
    expect(session.sim.session.dialogueActive).toBe(true);
  });

  it("sends the command only for the interact key on a takedown's target", () => {
    const { session, guard } = behindGuard();
    const enqueue = vi.spyOn(session.sim, "enqueue");
    steps(session, 1, CROUCH);
    expect(enqueue).not.toHaveBeenCalled();
    session.sim.world.remove(guard);
    steps(session, 1, CROUCH);
    steps(session, 1, frame({ crouch: true, interact: true }));
    expect(enqueue).not.toHaveBeenCalled();
  });
});
