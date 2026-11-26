import { EMPTY_INPUT, type InputFrame } from "@seki/core";
import { describe, expect, it } from "vitest";
import { Simulation } from "../src";
import { BREAK_IN_PROMPT } from "../src/world/vehicle/break-in";
import { collect, sedanBeside, teleportPlayer } from "./helpers";

/**
 * Out of the car the camera is the one she had on foot (user's notes of 21.11 and 22.11): its mode, first or third
 * person, and her look up or down as she got in; the toggle at the wheel leaves it be (the chase camera is the car's).
 */
const press = (over: Partial<InputFrame>): InputFrame => ({ ...EMPTY_INPUT, ...over });

const atTheWheel = (mode: "FPP" | "TPP"): Simulation => {
  const sim = Simulation.create({ seed: 3, crowd: "off", traffic: "off" });
  teleportPlayer(sim, sedanBeside().stand, 0, 0.3);
  if (sim.domain.preferences.cameraMode !== mode) sim.step(press({ toggleCamera: true }));
  for (let i = 0; i < 120 && sim.session.focusPrompt !== BREAK_IN_PROMPT; i++) sim.step();
  sim.step(press({ interact: true }));
  for (let i = 0; i < 900 && (sim.session.driving === null || sim.session.carAct); i++) sim.step();
  expect(sim.session.driving).not.toBeNull();
  return sim;
};

const getOut = (sim: Simulation): void => {
  sim.step(press({ interact: true }));
  for (let i = 0; i < 900 && sim.session.driving !== null; i++) sim.step();
  expect(sim.session.driving).toBeNull();
};

describe("the camera out of the car (ADR-0097)", () => {
  it("gives back her mode and her look up or down from before she got in, whatever she did at the wheel", () => {
    for (const mode of ["FPP", "TPP"] as const) {
      const sim = atTheWheel(mode);
      const modes = collect<{ mode: string }>(sim, "CameraModeChanged");
      // At the wheel: the toggle pressed, the view out of the window looked down.
      sim.step(press({ toggleCamera: true }));
      for (let i = 0; i < 20; i++) sim.step(press({ lookPitch: -0.03 }));
      expect(sim.domain.preferences.cameraMode).toBe(mode);
      expect(sim.player()!.pitch).toBeLessThan(0);
      getOut(sim);
      expect(sim.domain.preferences.cameraMode, mode).toBe(mode);
      expect(sim.player()!.pitch).toBeCloseTo(0.3, 6);
      expect(modes).toEqual([]);
      expect(sim.session.onFoot).toBeNull();
    }
  });

  it("toggles on foot again once out", () => {
    const sim = atTheWheel("FPP");
    getOut(sim);
    sim.step(press({ toggleCamera: true }));
    expect(sim.domain.preferences.cameraMode).toBe("TPP");
  });
});
