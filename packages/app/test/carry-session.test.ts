import { describe, expect, it } from "vitest";
import type { Locale } from "@seki/core";
import { SIM_DT, TAKEDOWN_TIME, clinicPoint, gangerEntity } from "@seki/sim";
import { patchUi } from "@seki/ui";
import { type Ui, frame, setup, steps, teleport } from "./story-helpers";

/**
 * Bodies in a headless session (ADR-0065, stage 3): the prompt "Pick up / Drop / Hide" in the
 * player's language, and the interact key on it turned into `carry-body` and `drop-body`.
 */

const CROUCH = frame({ crouch: true });
const USE = frame({ crouch: true, interact: true });
const speak = (ui: Ui, locale: Locale) => patchUi(ui, { settings: { ...ui.getState().settings, locale } });

/** A new game out on the deptak, a Tessen guard knocked out right in front of the player. */
const knockedOut = () => {
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
  steps(session, 1, CROUCH);
  steps(session, 1, USE);
  steps(session, Math.ceil(TAKEDOWN_TIME / SIM_DT) + 1, CROUCH);
  expect(guard.unconscious).toBe(true);
  return { session, ui, guard };
};

describe("carrying a body in the session (ADR-0065)", () => {
  it("offers to pick it up, then to drop it, in English and in Polish", () => {
    const { session, ui, guard } = knockedOut();
    expect(ui.getState().prompt).toBe("Pick up");
    expect(ui.getState().promptHold).toBeNull();
    speak(ui, "pl");
    expect(ui.getState().prompt).toBe("Podnieś");
    steps(session, 1, USE);
    expect(session.sim.session.carrying).toBe(guard.id);
    steps(session, 1, CROUCH);
    expect(ui.getState().prompt).toBe("Upuść");
    speak(ui, "en");
    expect(ui.getState().prompt).toBe("Drop");
    steps(session, 1, USE);
    expect(session.sim.session.carrying).toBeNull();
    expect(guard.downed?.carried).toBe(false);
  });

  it("offers to hide it by a hiding place, and the key puts it in", () => {
    const { session, ui, guard } = knockedOut();
    const p = session.sim.player()!.position;
    const c = { x: p.x + 2, y: p.y + 0.7, z: p.z };
    session.sim.world.add({
      id: 99_998,
      position: c,
      prevPosition: c,
      yaw: 0,
      prevYaw: 0,
      pitch: 0,
      view: { kind: "block", size: { x: 2.4, y: 1.4, z: 1.4 }, material: "metal" },
      solid: { min: { x: c.x - 1.2, y: p.y, z: c.z - 0.7 }, max: { x: c.x + 1.2, y: p.y + 1.4, z: c.z + 0.7 } },
      hide: "dumpster",
    });
    steps(session, 1, USE);
    steps(session, 1, CROUCH);
    expect(ui.getState().prompt).toBe("Hide");
    speak(ui, "pl");
    expect(ui.getState().prompt).toBe("Ukryj");
    steps(session, 1, USE);
    expect(guard.downed?.hidden).toBe(true);
    steps(session, 1, CROUCH);
    expect(ui.getState().prompt).toBeNull();
  });
});
