// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserInput } from "../src/input/browser-input";
import { DEFAULT_PAD_TUNING, PAD_LOOK_SPEED, mapGamepad } from "../src/input/keymap";

/** Each device's own look sensitivity in the adapter (ADR-0072, stage 4). */
let input: BrowserInput | null = null;
let rightStick = [0, 0];

const lockTo = (el: Element | null) => Object.defineProperty(document, "pointerLockElement", { configurable: true, get: () => el });
const move = (dx: number) => {
  const e = new MouseEvent("mousemove");
  Object.defineProperties(e, { movementX: { value: dx }, movementY: { value: 0 } });
  window.dispatchEvent(e);
};
const withPad = (on: boolean) =>
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: () => (on ? [{ mapping: "standard", axes: [0, 0, ...rightStick], buttons: [] }] : []),
  });

afterEach(() => {
  input?.dispose();
  input = null;
  lockTo(null);
  withPad(false);
  rightStick = [0, 0];
  vi.restoreAllMocks();
});

describe("BrowserInput look tuning per device (ADR-0072)", () => {
  it("scales mouse and touch look each by its own sensitivity before they merge", () => {
    const canvas = document.createElement("canvas");
    input = new BrowserInput(canvas);
    input.enabled = true;
    input.setLookTuning({ mouse: 2, touch: 0.5, pad: DEFAULT_PAD_TUNING });
    lockTo(canvas);
    move(0);
    input.poll();
    move(10);
    expect(input.poll().lookYaw).toBeCloseTo(0.044, 12);
    input.virtualPad.look(0.3, -0.1);
    expect(input.poll()).toMatchObject({ lookYaw: 0.15, lookPitch: -0.05 });
  });

  it("turns with the pad's curve, dead zone and sensitivity, not the mouse's", () => {
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    input = new BrowserInput(document.createElement("canvas"));
    input.enabled = true;
    const pad = { sensitivity: 1.5, deadzone: 0.2, curve: "precise" } as const;
    input.setLookTuning({ mouse: 3, touch: 3, pad });
    withPad(true);
    rightStick = [0.6, 0];
    input.poll();
    now += 1000 / 60;
    const f = input.poll();
    const expected = mapGamepad({ axes: [0, 0, 0.6, 0], buttons: [], pressed: [] }, 1 / 60, pad).lookYaw;
    expect(f.lookYaw).toBeCloseTo(expected, 12);
    expect(f.lookYaw).toBeCloseTo(((0.6 - 0.2) / 0.75) ** 2.6 * PAD_LOOK_SPEED * 1.5 / 60, 12);
  });
});
