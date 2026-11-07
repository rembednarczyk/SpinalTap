// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import type { DomainEvents } from "@seki/core";
import { BrowserInput, DEFAULT_KEYMAP, remap } from "@seki/engine";
import { SIM_DT, TAKEDOWN_TIME, clinicPoint, gangerEntity, type Entity } from "@seki/sim";
import { afterEach, describe, expect, it } from "vitest";
import { feedTouchFire } from "../src/touch-fire";
import { type Game, mountGame, unmountGame } from "./game-ui";
import { teleport } from "./story-helpers";

/**
 * The grab with a choice on touch (ADR-0075), through the real on-screen controls, the engine's
 * real input adapter and the session, without a renderer (ADR-0046): "Use" grabs, then "Use"
 * knocks out and the fire button, which names the kill meanwhile, kills. No new button.
 */
let input: BrowserInput | null = null;

afterEach(() => {
  unmountGame();
  input?.dispose();
  input = null;
});

/** One step of the app's loop (main.tsx): the pad learns the settings and the weapon, then the frame. */
const steps = (g: Game, n: number) =>
  act(() => {
    const i = input!;
    for (let k = 0; k < n; k++) {
      const s = g.ui.getState().settings;
      i.setButtonModes({ aim: s.aimMode, crouch: s.crouchMode, sprint: s.sprintMode });
      feedTouchFire(i.virtualPad, s, g.session.sim.player());
      g.session.step(i.poll());
    }
    g.session.render(0);
  });

const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT - 1e-9);

/** A new game (on touch by default), out on the deptak with nobody about, a Tessen guard 1.2 m ahead with its back to her. */
const start = (touch = true): { g: Game; guard: Entity; done: DomainEvents["TakedownDone"][] } => {
  input = new BrowserInput(document.createElement("canvas"));
  input.enabled = true;
  const g = mountGame({ seed: 7, touch, pad: input.virtualPad });
  fireEvent.click(screen.getByRole("button", { name: "New Game" }));
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  steps(g, 2);
  const world = g.session.sim.world;
  for (const e of [...world.with("ai")]) world.remove(e);
  for (const c of [...world.with("civilian")]) if (!c.passerby) world.remove(c);
  const street = clinicPoint(-4, 0, 4.4);
  act(() => teleport(g.session, street.x, street.z, 0, 0, street.y));
  steps(g, 5);
  const p = g.session.sim.player()!;
  const at = { x: p.position.x, y: p.position.y, z: p.position.z + 1.2 };
  const guard = world.add(gangerEntity(9000, { key: "test-guard", position: at, yaw: 0 }, null, 80, p.chunk ?? "", undefined, "tessen_guard"));
  const done: DomainEvents["TakedownDone"][] = [];
  g.session.bus.on("TakedownDone", (e) => done.push(e));
  steps(g, 1);
  return { g, guard, done };
};

/** A tap: the finger goes down for one step and comes up. */
const tap = (g: Game, el: HTMLElement) => {
  fireEvent.pointerDown(el, { pointerId: 5, clientX: 700, clientY: 250 });
  steps(g, 1);
  fireEvent.pointerUp(el, { pointerId: 5, clientX: 700, clientY: 250 });
  steps(g, 1);
};

describe("the grab with a choice on touch (ADR-0075)", () => {
  it("'Use' grabs; the fire button names the kill, and a tap on it kills", () => {
    const { g, guard, done } = start();
    expect(screen.getByTestId("touch-use").textContent).toContain("Grab");
    expect(screen.getByTestId("touch-fire").textContent).toBe("●");
    const buttons = document.querySelectorAll("button").length;
    tap(g, screen.getByTestId("touch-use"));
    expect(g.session.sim.session.takedown?.phase).toBe("grab");
    expect(screen.getByTestId("touch-use").textContent).toContain("Knock out");
    expect(screen.getByTestId("touch-fire").textContent).toContain("Kill");
    expect(screen.getByRole("button", { name: "Attack: Kill" })).toBe(screen.getByTestId("touch-fire"));
    expect(document.querySelectorAll("button").length).toBe(buttons);
    tap(g, screen.getByTestId("touch-fire"));
    steps(g, ticks(TAKEDOWN_TIME));
    expect(done).toEqual([{ target: guard.id, lethal: true, witnessed: false }]);
    expect(screen.getByTestId("touch-fire").textContent).toBe("●");
  });

  it("'Use' a second time knocks out", () => {
    const { g, guard, done } = start();
    tap(g, screen.getByTestId("touch-use"));
    tap(g, screen.getByTestId("touch-use"));
    steps(g, ticks(TAKEDOWN_TIME));
    expect(done).toEqual([{ target: guard.id, lethal: false, witnessed: false }]);
    expect(guard.unconscious).toBe(true);
  });
});

const key = (type: "keydown" | "keyup", code: string) => window.dispatchEvent(new KeyboardEvent(type, { code }));

/**
 * A press shorter than a step (ADR-0075): the finger, the mouse button or the key goes down and
 * comes up between two reads of the input, as at 15 to 20 frames a second on a phone. It still kills.
 */
describe("a press of the attack button shorter than a step kills in the grab (ADR-0075)", () => {
  it("touch: the fire button down and up with no step between", () => {
    const { g, guard, done } = start();
    tap(g, screen.getByTestId("touch-use"));
    expect(g.session.sim.session.takedown?.phase).toBe("grab");
    const fire = screen.getByTestId("touch-fire");
    fireEvent.pointerDown(fire, { pointerId: 6, clientX: 700, clientY: 250 });
    fireEvent.pointerUp(fire, { pointerId: 6, clientX: 700, clientY: 250 });
    steps(g, 1 + ticks(TAKEDOWN_TIME));
    expect(done).toEqual([{ target: guard.id, lethal: true, witnessed: false }]);
  });

  it("mouse: a click between two steps", () => {
    const { g, guard, done } = start(false);
    document.dispatchEvent(new Event("pointerlockerror"));
    key("keydown", "KeyE");
    steps(g, 1);
    key("keyup", "KeyE");
    expect(g.session.sim.session.takedown?.phase).toBe("grab");
    window.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
    window.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    steps(g, 1 + ticks(TAKEDOWN_TIME));
    expect(done).toEqual([{ target: guard.id, lethal: true, witnessed: false }]);
  });

  it("keyboard: the attack bound to a key, struck between two steps", () => {
    const { g, guard, done } = start(false);
    input!.keymap = remap(DEFAULT_KEYMAP, "fire", ["KeyJ"]);
    key("keydown", "KeyE");
    steps(g, 1);
    key("keyup", "KeyE");
    key("keydown", "KeyJ");
    key("keyup", "KeyJ");
    steps(g, 1 + ticks(TAKEDOWN_TIME));
    expect(done).toEqual([{ target: guard.id, lethal: true, witnessed: false }]);
  });
});
