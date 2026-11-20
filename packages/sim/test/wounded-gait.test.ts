import { describe, expect, it } from "vitest";
import { WOUNDED_PACE } from "@seki/core";
import { SIM_HZ } from "../src";
import { input, run, streetSim } from "./helpers";

/** Metres she covers in a second of the stick held ahead (sprinting or not) at `share` of her health. */
const metres = (share: number, sprint: boolean): { readonly d: number; readonly sprinting: boolean } => {
  const sim = streetSim({ seed: 3 });
  const p = sim.player()!;
  p.health = { ...p.health!, current: p.health!.max * share };
  run(sim, 5);
  const from = { ...p.position };
  let sprinting = false;
  for (let i = 0; i < SIM_HZ; i++) {
    sim.step(input({ moveZ: 1, sprint }));
    sprinting ||= p.posture?.sprinting ?? false;
  }
  return { d: Math.hypot(p.position.x - from.x, p.position.z - from.z), sprinting };
};

describe("a wounded Seki (user notes of 18.11)", () => {
  it("walks as fast as ever from half her health up, slower below, and cannot run badly hurt", () => {
    const whole = metres(1, false);
    expect(metres(0.6, false).d).toBeCloseTo(whole.d, 2);
    expect(metres(0.1, false).d).toBeCloseTo(whole.d * WOUNDED_PACE, 1);
    expect(metres(1, true).sprinting).toBe(true);
    const crit = metres(0.1, true);
    expect(crit.sprinting).toBe(false);
    expect(crit.d).toBeCloseTo(whole.d * WOUNDED_PACE, 1);
  });
});
