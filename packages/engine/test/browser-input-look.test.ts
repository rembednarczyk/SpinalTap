// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserInput } from "../src/input/browser-input";
import { DEFAULT_PAD_TUNING, PAD_LOOK_SPEED, mapGamepad } from "../src/input/keymap";

/** Each device's own look sensitivity in the adapter (ADR-0072, stage 4). */
let input: BrowserInput | null = null;
let rightStick = [0, 0];
let padButtons: boolean[] = [];

const lockTo = (el: Element | null) => Object.defineProperty(document, "pointerLockElement", { configurable: true, get: () => el });
const move = (dx: number) => {
  const e = new MouseEvent("mousemove");
  Object.defineProperties(e, { movementX: { value: dx }, movementY: { value: 0 } });
  window.dispatchEvent(e);
};
const withPad = (on: boolean) =>
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: () => (on ? [{ mapping: "standard", axes: [0, 0, ...rightStick], buttons: padButtons.map((pressed) => ({ pressed })) }] : []),
  });

afterEach(() => {
  input?.dispose();
  input = null;
  lockTo(null);
  withPad(false);
  rightStick = [0, 0];
  padButtons = [];
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

describe("BrowserInput aim assist on the pad (ADR-0072, stages 3 and 4)", () => {
  /** A target 3° right of the crosshair, its silhouette 2.3° wide either side. */
  const assisted = () => {
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => (now += 1000 / 60));
    input = new BrowserInput(document.createElement("canvas"));
    input.enabled = true;
    input.aimAssist.adsWeapon = true;
    input.aimAssist.targets = [{ yaw: 0.0524, pitch: 0, angle: 0.0524, radius: 0.04, distance: 12 }];
    withPad(true);
    return input;
  };

  it("slows the pad's look over a target as touch's", () => {
    const i = assisted();
    rightStick = [0.6, 0];
    i.poll();
    const slowed = i.poll().lookYaw;
    i.aimAssist.targets = [];
    const plain = i.poll().lookYaw;
    expect(slowed / plain).toBeCloseTo(0.55 + 0.45 * (0.0524 / 0.06), 6);
  });

  it("LT raising the sights pulls to the target", () => {
    const i = assisted();
    i.poll();
    padButtons = [false, false, false, false, false, false, true];
    expect(i.poll().aim).toBe(true);
    expect(i.aimAssist.pulling).toBe(true);
  });
});
