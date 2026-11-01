import { describe, expect, it } from "vitest";
import { type DomainEvents, type Locale, WITNESS_CALL_SECONDS } from "@seki/core";
import { SIM_DT, TAKEDOWN_TIME, WAKE_TIME, clinicPoint, gangerEntity } from "@seki/sim";
import { patchUi } from "@seki/ui";
import type { GameSession } from "../src/game-session";
import { type Ui, frame, setup, steps, teleport } from "./story-helpers";

/**
 * Stage 2 of ADR-0065 in a headless session (ADR-0046): a takedown seen on the deptak is an
 * assault the HUD reports in the player's language; one unseen is no crime; a body found by
 * the security brings the call and the search, and the guard is woken after 6 s.
 */

const CROUCH = frame({ crouch: true });
const INTERACT = frame({ crouch: true, interact: true });
const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT - 1e-9);
const speak = (ui: Ui, locale: Locale) => patchUi(ui, { settings: { ...ui.getState().settings, locale } });

const collect = <K extends keyof DomainEvents>(session: GameSession, type: K): DomainEvents[K][] => {
  const out: DomainEvents[K][] = [];
  session.bus.on(type, (e) => out.push(e));
  return out;
};

/**
 * A new game on the deptak, nobody armed about, the player crouched behind a Tessen guard. With
 * `alone` the bystanders who would phone it in (Ume at her stall) are gone as well.
 */
const behindGuard = (alone: boolean) => {
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
  return { session, ui, guard };
};

const takeDown = (session: GameSession): void => {
  steps(session, 1, CROUCH);
  steps(session, 1, INTERACT);
  steps(session, ticks(TAKEDOWN_TIME), CROUCH);
};

describe("takedown witnesses and bodies in the session (ADR-0065)", () => {
  it("unseen it brings no heat; seen by a bystander it is an assault, reported in the player's language", () => {
    const quiet = behindGuard(true);
    const quietDone = collect(quiet.session, "TakedownDone");
    takeDown(quiet.session);
    steps(quiet.session, ticks(WITNESS_CALL_SECONDS + 1), CROUCH);
    expect(quietDone).toEqual([{ target: quiet.guard.id, lethal: false, witnessed: false }]);
    expect(quiet.ui.getState().heat.level).toBe(0);

    const { session, ui, guard } = behindGuard(false);
    const done = collect(session, "TakedownDone");
    const reports = collect(session, "CrimeReported");
    takeDown(session);
    expect(done).toEqual([{ target: guard.id, lethal: false, witnessed: true }]);
    speak(ui, "pl");
    steps(session, ticks(WITNESS_CALL_SECONDS + 0.5), CROUCH);
    expect(reports.map((r) => [r.crime, r.channel])).toEqual([["assault", "civilian"]]);
    expect(ui.getState().heat.level).toBe(1);
    expect(ui.getState().toasts).toContainEqual(expect.objectContaining({ kind: "heat", title: "Świadek zadzwonił: napaść", text: "Zgłoszone ochronie" }));
  });

  it("a Hebi patrol finds the body: the call, the heat from where she stood, and the guard woken alerted after 6 s", () => {
    const { session, ui, guard } = behindGuard(true);
    takeDown(session);
    const stood = { ...session.sim.player()!.position };
    // She slips away east down the deptak, out of sight.
    teleport(session, stood.x + 40, stood.z, -Math.PI / 2, 0, stood.y);
    steps(session, 5, CROUCH);
    expect(ui.getState().heat.level).toBe(0);
    const found = collect(session, "BodyFound");
    const p = session.sim.player()!;
    const at = { x: guard.position.x - 1.2, y: guard.position.y, z: guard.position.z };
    const g = gangerEntity(9100, { key: "test-patrol", position: at, yaw: Math.PI / 2 }, null, 80, p.chunk ?? "");
    g.ai = { ...g.ai!, patrol: true };
    const finder = session.sim.world.add(g);
    steps(session, 1, CROUCH);
    expect(found).toEqual([{ body: guard.id, finder: finder.id }]);
    expect(ui.getState().heat.level).toBe(1);
    expect(ui.getState().toasts).toContainEqual(expect.objectContaining({ kind: "heat", title: "A patrol saw it: assault" }));
    expect(session.sim.domain.heat.lastKnown?.x).toBeCloseTo(stood.x, 6);
    steps(session, ticks(WAKE_TIME) - 2, CROUCH);
    expect(guard.unconscious).toBe(true);
    steps(session, 1, CROUCH);
    expect(guard.unconscious).toBeUndefined();
    expect(guard.ai!.alerted).toBe(true);
    expect(guard.ai!.lastKnown?.x).toBeCloseTo(stood.x, 6);
    expect(finder.ai!.lastKnown?.x).toBeCloseTo(stood.x, 6);
  });
});
