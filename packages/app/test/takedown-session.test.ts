import { describe, expect, it, vi } from "vitest";
import { type DomainEvents, type Locale, WITNESS_CALL_SECONDS } from "@seki/core";
import { GRAB_TIME, SIM_DT, TAKEDOWN_TIME, clinicPoint, gangerEntity } from "@seki/sim";
import { patchUi } from "@seki/ui";
import type { GameSession } from "../src/game-session";
import { type Ui, frame, setup, steps, teleport } from "./story-helpers";

/**
 * Takedowns in a headless session (ADR-0065, ADR-0075): the interact key on the prompt grabs;
 * in the grab the prompt offers the knock-out (the interact key again) and the kill (a press of
 * the attack button), in the player's language; with nothing chosen in time the grab knocks out.
 */

const CROUCH = frame({ crouch: true });
const USE = frame({ crouch: true, interact: true });
const FIRE = frame({ crouch: true, fire: true });
const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT - 1e-9);
const speak = (ui: Ui, locale: Locale) => patchUi(ui, { settings: { ...ui.getState().settings, locale } });

/**
 * A new game out on the deptak, nobody else armed about, the player crouched behind a Tessen
 * guard. Ume at her stall sees the spot; with `alone` the bystanders are gone.
 */
const behindGuard = (alone = false) => {
  const { session, ui } = setup();
  session.newGame();
  steps(session, 2);
  const world = session.sim.world;
  for (const g of [...world.with("ai")]) world.remove(g);
  if (alone) for (const c of [...world.with("civilian")]) if (!c.passerby) world.remove(c);
  const street = clinicPoint(-4, 0, 4.4);
  teleport(session, street.x, street.z, 0, 0, street.y);
  steps(session, 30, CROUCH);
  const p = session.sim.player()!;
  const at = { x: p.position.x, y: p.position.y, z: p.position.z + 1.2 };
  const guard = world.add(gangerEntity(9000, { key: "test-guard", position: at, yaw: 0 }, null, 80, p.chunk ?? "", undefined, "tessen_guard"));
  steps(session, 1, CROUCH);
  return { session, ui, guard };
};

const collect = <K extends keyof DomainEvents>(session: GameSession, type: K): DomainEvents[K][] => {
  const out: DomainEvents[K][] = [];
  session.bus.on(type, (e) => out.push(e));
  return out;
};

describe("takedown in the session (ADR-0065, ADR-0075)", () => {
  it("offers the grab, then in the grab the knock-out and the kill, in English and in Polish", () => {
    const { session, ui } = behindGuard();
    expect(ui.getState().prompt).toBe("Grab");
    expect(ui.getState().promptHold).toBeNull();
    speak(ui, "pl");
    expect(ui.getState().prompt).toBe("Chwyć");
    steps(session, 1, USE);
    expect(ui.getState().prompt).toBe("Ogłusz");
    expect(ui.getState().promptHold).toBe("Zabij");
    speak(ui, "en");
    expect(ui.getState().prompt).toBe("Knock out");
    expect(ui.getState().promptHold).toBe("Kill");
    // Chosen: nothing more to choose while the end plays.
    steps(session, 1, USE);
    expect(ui.getState().prompt).toBeNull();
    expect(ui.getState().promptHold).toBeNull();
  });

  it("knocks out from the grab with the interact key", () => {
    const { session, guard } = behindGuard();
    const started = collect(session, "TakedownStarted");
    const chosen = collect(session, "TakedownChosen");
    const done = collect(session, "TakedownDone");
    steps(session, 1, USE);
    expect(started).toEqual([{ target: guard.id, duration: TAKEDOWN_TIME, window: GRAB_TIME }]);
    steps(session, ticks(1), CROUCH);
    expect(guard.unconscious).toBeUndefined();
    steps(session, 1, USE);
    expect(chosen).toEqual([{ target: guard.id, lethal: false, timedOut: false }]);
    steps(session, ticks(TAKEDOWN_TIME), CROUCH);
    // Ume at her stall on the deptak sees it (the witnesses: takedown-witness-session.test.ts).
    expect(done).toEqual([{ target: guard.id, lethal: false, witnessed: true }]);
    expect(guard.unconscious).toBe(true);
  });

  it("kills from the grab with a press of the attack button, which then fires nothing until let go", () => {
    const { session, guard } = behindGuard(true);
    const chosen = collect(session, "TakedownChosen");
    const done = collect(session, "TakedownDone");
    const shots = collect(session, "ShotFired");
    steps(session, 1, USE);
    steps(session, ticks(0.5), CROUCH);
    steps(session, ticks(TAKEDOWN_TIME) + 1, FIRE);
    expect(chosen).toEqual([{ target: guard.id, lethal: true, timedOut: false }]);
    expect(done).toEqual([{ target: guard.id, lethal: true, witnessed: false }]);
    expect(session.sim.domain.flags).toContain("dead:test-guard");
    steps(session, 20, FIRE);
    expect(shots).toHaveLength(0);
  });

  it("an attack button held from before the grab chooses nothing: the grab runs out into a knock-out", () => {
    const { session, guard } = behindGuard(true);
    const chosen = collect(session, "TakedownChosen");
    const done = collect(session, "TakedownDone");
    steps(session, 1, frame({ crouch: true, fire: true, interact: true }));
    steps(session, ticks(GRAB_TIME) - 2, FIRE);
    expect(chosen).toEqual([]);
    expect(session.sim.session.takedown?.phase).toBe("grab");
    steps(session, 1, FIRE);
    expect(chosen).toEqual([{ target: guard.id, lethal: false, timedOut: true }]);
    steps(session, ticks(TAKEDOWN_TIME), CROUCH);
    expect(done).toEqual([{ target: guard.id, lethal: false, witnessed: false }]);
    expect(guard.unconscious).toBe(true);
  });

  it("a bystander who sees the grab end in a kill phones it in; nothing is reported while she holds it", () => {
    const { session, ui, guard } = behindGuard();
    const done = collect(session, "TakedownDone");
    const calls = collect(session, "WitnessCalling");
    const reports = collect(session, "CrimeReported");
    steps(session, 1, USE);
    steps(session, ticks(2), CROUCH);
    expect(calls).toEqual([]);
    steps(session, 1, FIRE);
    steps(session, ticks(TAKEDOWN_TIME), CROUCH);
    expect(done).toEqual([{ target: guard.id, lethal: true, witnessed: true }]);
    expect(calls.length).toBeGreaterThan(0);
    steps(session, ticks(WITNESS_CALL_SECONDS + 0.5), CROUCH);
    expect(reports.map((r) => r.crime)).toContain("assault");
    expect(ui.getState().heat.level).toBeGreaterThan(0);
  });

  it("talks to whoever is nearer than the guard instead of grabbing it", () => {
    const { session, ui, guard } = behindGuard();
    const p = session.sim.player()!;
    const at = { x: p.position.x + 0.5, y: p.position.y, z: p.position.z };
    session.sim.world.add({ id: 99_999, position: at, prevPosition: at, yaw: 0, prevYaw: 0, pitch: 0, interactable: { kind: "dialogue", dialogueId: "fixer", prompt: "prompt.talk.kaito", radius: 2 } });
    const started = collect(session, "TakedownStarted");
    steps(session, 1, CROUCH);
    expect(ui.getState().prompt).toBe("Talk to Kaito");
    expect(ui.getState().promptHold).toBeNull();
    steps(session, 1, USE);
    expect(started).toEqual([]);
    expect(guard.unconscious).toBeUndefined();
    expect(session.sim.session.dialogueActive).toBe(true);
  });

  it("sends the commands only for the interact key on a takedown's target, and the choice only in the grab", () => {
    const { session, guard } = behindGuard();
    const enqueue = vi.spyOn(session.sim, "enqueue");
    steps(session, 1, FIRE);
    steps(session, 1, CROUCH);
    expect(enqueue).not.toHaveBeenCalled();
    steps(session, 1, USE);
    expect(enqueue.mock.calls.map(([c]) => c)).toEqual([{ type: "takedown" }]);
    steps(session, 1, USE);
    steps(session, 1, FIRE);
    expect(enqueue.mock.calls.map(([c]) => c)).toEqual([{ type: "takedown" }, { type: "takedown-choose", lethal: false }]);
    // Knocked out, the guard is a body to carry: the key is no takedown's any more.
    steps(session, ticks(TAKEDOWN_TIME), CROUCH);
    expect(guard.unconscious).toBe(true);
    enqueue.mockClear();
    steps(session, 1, USE);
    expect(enqueue.mock.calls.map(([c]) => c.type)).toEqual(["carry-body"]);
  });
});
