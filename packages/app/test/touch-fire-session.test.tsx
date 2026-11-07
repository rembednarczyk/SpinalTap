// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import { type InputFrame, WEAPON_CATALOG } from "@seki/core";
import { BrowserInput } from "@seki/engine";
import { SIM_DT, type Entity, ground } from "@seki/sim";
import { DEFAULT_SETTINGS, type SettingsVm, patchUi } from "@seki/ui";
import { afterEach, describe, expect, it } from "vitest";
import { sanitizeSettings } from "../src/settings";
import { feedTouchFire } from "../src/touch-fire";
import { type Game, mountGame, run, unmountGame } from "./game-ui";

/**
 * The touch fire button that aims (ADR-0072 etap 1), through the real on-screen controls, the
 * engine's real input adapter and the session, without a renderer (ADR-0046). Each step runs as
 * the app's loop does: settings and weapon into the pad, poll, step.
 */
let input: BrowserInput | null = null;

const start = (settings: Partial<SettingsVm> = {}) => {
  input = new BrowserInput(document.createElement("canvas"));
  input.enabled = true;
  const game = mountGame({ seed: 7, touch: true, pad: input.virtualPad });
  fireEvent.click(screen.getByRole("button", { name: "New Game" }));
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  game.step(2);
  run(() => patchUi(game.ui, { settings: { ...game.ui.getState().settings, ...settings } }));
  return game;
};

afterEach(() => {
  unmountGame();
  input?.dispose();
  input = null;
  sent.length = 0;
});

/** The frames the steps sent, newest last. */
const sent: InputFrame[] = [];

/** One step of the app's loop (main.tsx): the pad learns the settings and the weapon, then the frame. */
const steps = (g: Game, n: number) =>
  act(() => {
    const i = input!;
    for (let k = 0; k < n; k++) {
      const s = g.ui.getState().settings;
      i.setButtonModes({ aim: s.aimMode, crouch: s.crouchMode, sprint: s.sprintMode });
      feedTouchFire(i.virtualPad, s, g.session.sim.player());
      const frame = i.poll();
      sent.push(frame);
      g.session.step(frame);
    }
    g.session.render(0);
  });

const fireButton = () => screen.getByRole("button", { name: "Fire" });
const aimButton = () => screen.getByTestId("touch-aim");
const down = (el: HTMLElement, pointerId: number) => fireEvent.pointerDown(el, { pointerId, clientX: 700, clientY: 250 });
const up = (el: HTMLElement, pointerId: number) => fireEvent.pointerUp(el, { pointerId, clientX: 700, clientY: 250 });
const player = (g: Game) => g.session.sim.player()!;
const ADS_STEPS = Math.ceil(WEAPON_CATALOG.unity9.ads.time / SIM_DT) + 1;

const faceGuard = (g: Game): Entity => {
  const guard = [...g.session.sim.world].find((e) => e.key === "guard")!;
  const p = player(g);
  p.position = ground(guard.position.x, guard.position.z - 4);
  p.prevPosition = p.position;
  p.yaw = 0;
  p.prevYaw = 0;
  p.pitch = -0.03;
  return guard;
};

describe("one-thumb fire from the sights on touch (ADR-0072, variant A)", () => {
  it("holding fire raises the sights to full within the weapon's ADS time and hits the target", () => {
    const g = start();
    expect(g.ui.getState().settings.touchFire).toBe("aims");
    faceGuard(g);
    down(fireButton(), 1);
    steps(g, ADS_STEPS);
    expect(player(g).posture).toMatchObject({ aiming: true, aim: 1 });
    expect(g.ui.getState().hitMarker).toBeGreaterThan(0);
    expect(screen.getByTestId("crosshair").classList.contains("crosshair--aiming")).toBe(true);
    up(fireButton(), 1);
    steps(g, ADS_STEPS);
    expect(player(g).posture).toMatchObject({ aiming: false, aim: 0 });
  });

  it("dragging from the fire button steers the view while it fires", () => {
    const g = start();
    const yaw0 = player(g).yaw;
    down(fireButton(), 1);
    fireEvent.pointerMove(fireButton(), { pointerId: 1, clientX: 760, clientY: 250 });
    steps(g, 2);
    expect(player(g).posture!.aiming).toBe(true);
    expect(Math.abs(player(g).yaw - yaw0)).toBeGreaterThan(0.1);
    up(fireButton(), 1);
  });

  it("with a melee weapon the fire button swings and never raises the guard", () => {
    const g = start();
    run(() => {
      const d = g.session.sim.domain;
      g.seki.jump({
        inventory: { ...d.inventory, items: [...d.inventory.items, { uid: "t-baton", def: "baton", rarity: "common" }] },
        equipment: { ...d.equipment, melee: "t-baton" },
      });
    });
    g.step(1, { weaponSlot: 3 });
    g.step(30);
    expect(player(g).combatant!.stats!.ads).toBeFalsy();
    down(fireButton(), 1);
    let guarded = false;
    for (let n = 0; n < 60; n++) {
      steps(g, 1);
      guarded ||= player(g).melee!.guard || player(g).posture!.aiming;
    }
    expect(player(g).melee!.phase).not.toBe("idle");
    expect(guarded).toBe(false);
    // The frames themselves never ask for the guard: fire alone, as a strike.
    expect(sent.filter((f) => f.fire)).toHaveLength(60);
    expect(sent.some((f) => f.aim)).toBe(false);
    up(fireButton(), 1);
  });
});

describe("fires only, a tap on the aim button holds the sights (ADR-0072, variant B)", () => {
  it("a tap aims and lights the button and the ring; fire then fires from the sights; a second tap lets go", () => {
    const g = start({ touchFire: "separate", aimMode: "toggle" });
    faceGuard(g);
    down(fireButton(), 1);
    steps(g, 2);
    expect(player(g).posture!.aiming).toBe(false);
    up(fireButton(), 1);
    steps(g, 2);

    down(aimButton(), 2);
    steps(g, 1);
    up(aimButton(), 2);
    steps(g, ADS_STEPS);
    expect(player(g).posture).toMatchObject({ aiming: true, aim: 1 });
    expect(aimButton().classList.contains("touch__btn--on")).toBe(true);
    expect(screen.queryByTestId("ads-ring")).not.toBeNull();

    const hits = g.ui.getState().hitMarker;
    down(fireButton(), 1);
    steps(g, 20);
    up(fireButton(), 1);
    steps(g, 2);
    expect(g.ui.getState().hitMarker).toBeGreaterThan(hits);
    expect(player(g).posture!.aiming).toBe(true);

    down(aimButton(), 2);
    steps(g, 1);
    up(aimButton(), 2);
    steps(g, ADS_STEPS);
    expect(player(g).posture).toMatchObject({ aiming: false, aim: 0 });
    expect(screen.queryByTestId("ads-ring")).toBeNull();
  });
});

describe("touch fire setting in the saved settings (ADR-0072)", () => {
  it("an entry saved before the setting aims with fire; a bad value falls back; a choice survives", () => {
    expect(DEFAULT_SETTINGS.touchFire).toBe("aims");
    expect(sanitizeSettings({ quality: "low" }).touchFire).toBe("aims");
    expect(sanitizeSettings({ touchFire: "both" }).touchFire).toBe("aims");
    expect(sanitizeSettings({ touchFire: "separate" }).touchFire).toBe("separate");
  });
});

describe("a tap on the fire button shorter than a step (ADR-0075)", () => {
  it("fires one shot with a firearm, and holding fires on as before", () => {
    const g = start({ touchFire: "separate" });
    faceGuard(g);
    const shots: unknown[] = [];
    g.session.bus.on("ShotFired", (e) => e.shooterId === player(g).id && shots.push(e));
    down(fireButton(), 1);
    up(fireButton(), 1);
    steps(g, 30);
    expect(shots).toHaveLength(1);
    down(fireButton(), 1);
    steps(g, 60);
    up(fireButton(), 1);
    expect(shots.length).toBeGreaterThan(2);
  });

  it("swings once with a melee weapon", () => {
    const g = start();
    run(() => {
      const d = g.session.sim.domain;
      g.seki.jump({
        inventory: { ...d.inventory, items: [...d.inventory.items, { uid: "t-baton", def: "baton", rarity: "common" }] },
        equipment: { ...d.equipment, melee: "t-baton" },
      });
    });
    g.step(1, { weaponSlot: 3 });
    g.step(30);
    const swings: unknown[] = [];
    g.session.bus.on("MeleeSwing", (e) => e.entityId === player(g).id && swings.push(e));
    down(fireButton(), 1);
    up(fireButton(), 1);
    steps(g, 90);
    expect(swings).toHaveLength(1);
  });
});
