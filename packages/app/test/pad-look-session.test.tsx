// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import { EMPTY_INPUT } from "@seki/core";
import { BrowserInput, PAD_LOOK_SPEED, PAD_OUTER_DEADZONE } from "@seki/engine";
import { SIM_DT } from "@seki/sim";
import { DEFAULT_SETTINGS, type SettingsVm, patchUi } from "@seki/ui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { feedLookTuning, viewLook } from "../src/look-tuning";
import { loadSettings, sanitizeSettings } from "../src/settings";
import { type Game, mountGame, run, unmountGame } from "./game-ui";

/**
 * The gamepad's look (ADR-0072, stage 4) through the engine's real input adapter and the
 * session, without a renderer (ADR-0046). A synthetic standard pad holds the right stick; each
 * step runs as the app's loop does: the look settings into the adapter, poll, the zoom and ADS
 * scaling, step. The clock under the adapter advances one simulation step per poll.
 */
let input: BrowserInput | null = null;
let axes = [0, 0, 0, 0];
let now = 0;

beforeEach(() => {
  now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [{ mapping: "standard", axes, buttons: [] }] });
});

afterEach(() => {
  unmountGame();
  input?.dispose();
  input = null;
  axes = [0, 0, 0, 0];
  Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [] });
  vi.restoreAllMocks();
});

const start = (settings: Partial<SettingsVm> = {}) => {
  input = new BrowserInput(document.createElement("canvas"));
  input.enabled = true;
  const game = mountGame({ seed: 7 });
  fireEvent.click(screen.getByRole("button", { name: "New Game" }));
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  game.step(2);
  run(() => patchUi(game.ui, { settings: { ...game.ui.getState().settings, ...settings } }));
  return game;
};

/** One step of the app's loop (main.tsx), with the hip view's zoom of 1. */
const steps = (g: Game, n: number) =>
  act(() => {
    const i = input!;
    for (let k = 0; k < n; k++) {
      const s = g.ui.getState().settings;
      feedLookTuning(i, s);
      now += SIM_DT * 1000;
      g.session.step(viewLook(i.poll(), s, 1));
    }
  });

/** Yaw turned over `n` steps with the right stick held at `x`. */
const turn = (g: Game, x: number, n = 30): number => {
  steps(g, 1);
  const yaw0 = g.session.sim.player()!.yaw;
  axes = [0, 0, x, 0];
  steps(g, n);
  axes = [0, 0, 0, 0];
  return g.session.sim.player()!.yaw - yaw0;
};

const travel = (x: number, deadzone = 0.12) => (x - deadzone) / (PAD_OUTER_DEADZONE - deadzone);
const perStep = PAD_LOOK_SPEED * SIM_DT;

describe("gamepad look in the session (ADR-0072, stage 4)", () => {
  it("turns at the classic curve by default, with the pad's sensitivity and not the mouse's or touch one", () => {
    const g = start({ mouseSensitivity: 3, touchSensitivity: 0.2 });
    expect(g.ui.getState().settings).toMatchObject({ padCurve: "classic", padSensitivity: 1, padDeadzone: 0.12 });
    expect(turn(g, 0.5)).toBeCloseTo(30 * travel(0.5) ** 1.8 * perStep, 9);
  });

  it.each([
    ["linear", 1],
    ["classic", 1.8],
    ["precise", 2.6],
  ] as const)("the %s curve turns at the travel to the power %s", (padCurve, exponent) => {
    const g = start({ padCurve });
    expect(turn(g, 0.5)).toBeCloseTo(30 * travel(0.5) ** exponent * perStep, 9);
  });

  it("the pad sensitivity scales the turn, and the dead zone setting holds a light push", () => {
    const g = start({ padSensitivity: 2.5, padCurve: "linear" });
    expect(turn(g, 0.7)).toBeCloseTo(30 * travel(0.7) * perStep * 2.5, 9);
    run(() => patchUi(g.ui, { settings: { ...g.ui.getState().settings, padDeadzone: 0.3 } }));
    expect(turn(g, 0.25)).toBe(0);
  });

  it("a small diagonal turns both ways at once instead of snapping to one axis", () => {
    const g = start({ padCurve: "linear" });
    steps(g, 1);
    const p0 = { ...g.session.sim.player()! };
    axes = [0, 0, 0.3, 0.1];
    steps(g, 10);
    const p = g.session.sim.player()!;
    expect(p.pitch - p0.pitch).toBeGreaterThan(0);
    expect((p.pitch - p0.pitch) / (p.yaw - p0.yaw)).toBeCloseTo(1 / 3, 6);
  });
});

describe("what the app still scales after the adapter (ADR-0019, ADR-0072)", () => {
  it("zoomed in, the look slows with the zoom and the ADS setting; an inverted Y flips the pitch", () => {
    const frame = { ...EMPTY_INPUT, lookYaw: 0.2, lookPitch: 0.1 };
    expect(viewLook(frame, { adsSensitivity: 1.5, invertY: false }, 1)).toBe(frame);
    expect(viewLook(frame, { adsSensitivity: 1.5, invertY: true }, 0.5)).toMatchObject({ lookYaw: 0.2 * 0.75, lookPitch: -0.1 * 0.75 });
  });
});

describe("gamepad settings in the saved settings (ADR-0072, stage 4)", () => {
  it("an entry saved before them takes the radial 0.12 zone, the classic curve and sensitivity 1", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ padSensitivity: 1, padDeadzone: 0.12, padCurve: "classic" });
    const old = { rev: 2, mouseSensitivity: 2.4, touchSensitivity: 0.6, quality: "low" };
    const storage = { getItem: () => JSON.stringify(old), setItem: () => {} };
    expect(loadSettings(storage)).toMatchObject({ mouseSensitivity: 2.4, touchSensitivity: 0.6, padSensitivity: 1, padDeadzone: 0.12, padCurve: "classic" });
  });

  it("clamps the ranges, rounds the dead zone and drops an unknown curve; a choice survives", () => {
    expect(sanitizeSettings({ padSensitivity: 9, padDeadzone: 0.01, padCurve: "cubic" })).toMatchObject({ padSensitivity: 3, padDeadzone: 0.05, padCurve: "classic" });
    expect(sanitizeSettings({ padSensitivity: 0, padDeadzone: 0.9 })).toMatchObject({ padSensitivity: 0.2, padDeadzone: 0.3 });
    expect(sanitizeSettings({ padSensitivity: "fast", padDeadzone: Number.NaN })).toMatchObject({ padSensitivity: 1, padDeadzone: 0.12 });
    expect(sanitizeSettings({ padSensitivity: 1.7, padDeadzone: 0.173, padCurve: "linear" })).toMatchObject({ padSensitivity: 1.7, padDeadzone: 0.17, padCurve: "linear" });
    expect(sanitizeSettings({ padCurve: "precise" }).padCurve).toBe("precise");
  });
});
