import { describe, expect, it } from "vitest";
import { Simulation, runReplay, stateHash, type ReplayFrame } from "../src";
import { input, run } from "./helpers";

/**
 * A scripted run: walk north into the alley, look around, creep forward crouched, then fire at
 * whatever is ahead while strafing, half of the time crouched.
 */
const script = (): ReplayFrame[] => {
  const frames: ReplayFrame[] = [];
  frames.push({ input: input(), commands: [{ type: "set-flag", flag: "met_fixer" }] });
  for (let i = 0; i < 420; i++) frames.push({ input: input({ moveZ: 1, sprint: true }) });
  for (let i = 0; i < 30; i++) frames.push({ input: input({ lookYaw: 0.01, lookPitch: 0.002 }) });
  for (let i = 0; i < 60; i++) frames.push({ input: input({ moveZ: 1, crouch: true }) });
  for (let i = 0; i < 360; i++) {
    frames.push({ input: input({ fire: true, crouch: i % 180 >= 90, moveX: i % 120 < 60 ? 1 : -1, lookYaw: i % 90 < 45 ? -0.004 : 0.004 }) });
  }
  // Weapon handling (ADR-0015): reload, an empty slot, holster, draw again and keep firing.
  frames.push({ input: input({ reload: true }) });
  for (let i = 0; i < 40; i++) frames.push({ input: input() });
  frames.push({ input: input({ weaponSlot: 3 }) });
  frames.push({ input: input({ toggleWeapon: true }) });
  frames.push({ input: input({ weaponSlot: 2 }) });
  for (let i = 0; i < 120; i++) frames.push({ input: input({ fire: true, lookYaw: i % 60 < 30 ? 0.003 : -0.003 }) });
  return frames;
};

const hashOf = (sim: Simulation) => stateHash(sim.snapshot(null, "test", ""));

describe("determinism", () => {
  it("same seed + same input stream = same end state", () => {
    const a = runReplay(1234, script());
    const b = runReplay(1234, script());
    expect(hashOf(a)).toBe(hashOf(b));
    expect(a.tick).toBe(1035);
  });

  it("a different seed diverges once randomness is involved", () => {
    expect(hashOf(runReplay(1234, script()))).not.toBe(hashOf(runReplay(4321, script())));
  });

  it("matches the recorded golden hash (update deliberately when rules change)", () => {
    expect(hashOf(runReplay(1234, script()))).toMatchInlineSnapshot(`"95bb028c"`);
  });

  it("a loaded snapshot continues exactly like the original run", () => {
    const frames = script();
    // Split while standing with a settled aim: crouch and bloom are transient and not saved (ADR-0016).
    const original = runReplay(1234, frames.slice(0, 451));
    const restored = Simulation.fromSnapshot(original.snapshot(null, "mid", ""));
    expect(hashOf(restored)).toBe(hashOf(original));
    for (const f of frames.slice(451)) {
      original.step(f.input);
      restored.step(f.input);
    }
    expect(hashOf(restored)).toBe(hashOf(original));
  });

  it("restores killed NPCs as absent", () => {
    const sim = Simulation.create({ seed: 1 });
    sim.enqueue({ type: "set-flag", flag: "dead:guard" });
    run(sim, 1);
    const restored = Simulation.fromSnapshot(sim.snapshot(null, "x", ""));
    expect([...restored.world].some((e) => e.key === "guard")).toBe(false);
    expect([...restored.world].some((e) => e.key === "courier")).toBe(true);
  });
});
