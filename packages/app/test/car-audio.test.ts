import { type AudioCue, type EngineSound, vehicleSpec } from "@seki/core";
import type { Simulation } from "@seki/sim";
import { describe, expect, it } from "vitest";
import { BLIP, CRASH_ENERGY, CarAudio, SQUEAL_PACE, engineOf, hitCue } from "../src/presenters/car-audio";

/** A simulation as the car's sounds read it: the car she drives and her act at it. */
const fakeSim = () => {
  const spec = vehicleSpec("sedan");
  const wheel = () => ({ load: 3000, slipRatio: 0, slipAngle: 0 });
  const car = { model: "sedan" as const, rpm: spec.engine.idle, controls: { throttle: 0, brake: 0, steer: 0, handbrake: false }, q: { w: 1, x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, wheels: [wheel(), wheel(), wheel(), wheel()] };
  const session: { driving: number | null; carAct: { kind: "enter" | "exit"; t: number } | null } = { driving: null, carAct: null };
  const world = { with: () => ({ entities: session.driving === null ? [] : [{ id: session.driving, car }] }) };
  return { sim: { session, world } as unknown as Pick<Simulation, "session" | "world">, session, car, spec };
};

const listen = () => {
  const played: AudioCue[] = [];
  const engine: (EngineSound | null)[] = [];
  return { played, engine, ports: { play: (c: AudioCue) => played.push(c), engine: { set: (e: EngineSound | null) => engine.push(e) } } };
};

describe("the car she drives as heard (ADR-0097)", () => {
  it("opens the door as she gets in, shuts it and starts the engine once seated, stops it and opens the door to get out", () => {
    const { sim, session } = fakeSim();
    const ears = listen();
    const audio = new CarAudio(ears.ports);
    audio.frame(sim, 1 / 60);
    expect(ears.played).toEqual([]);
    session.driving = 900;
    session.carAct = { kind: "enter", t: 0 };
    audio.frame(sim, 1 / 60);
    audio.frame(sim, 1 / 60);
    expect(ears.played).toEqual(["car-door-open"]);
    // No engine while she climbs in.
    expect(ears.engine.at(-1)).toBeNull();
    session.carAct = null;
    audio.frame(sim, 1 / 60);
    // No starter (user's notes of 21.11): the door shuts and the engine's revs rise a moment.
    expect(ears.played.slice(1)).toEqual(["car-door-close"]);
    expect(ears.engine.at(-1)).not.toBeNull();
    session.carAct = { kind: "exit", t: 0 };
    audio.frame(sim, 1 / 60);
    expect(ears.played.slice(2)).toEqual(["engine-stop", "car-door-open"]);
    expect(ears.engine.at(-1)).toBeNull();
    session.driving = null;
    session.carAct = null;
    audio.frame(sim, 1 / 60);
    expect(ears.played.slice(4)).toEqual(["car-door-close"]);
  });

  it("gets out at once on the right side: the engine stops, the door opens and shuts", () => {
    const { sim, session } = fakeSim();
    const ears = listen();
    const audio = new CarAudio(ears.ports);
    session.driving = 900;
    audio.frame(sim, 1 / 60);
    ears.played.length = 0;
    session.driving = null;
    audio.frame(sim, 1 / 60);
    expect(ears.played).toEqual(["engine-stop", "car-door-open", "car-door-close"]);
  });

  it("sends the engine's revs from idle to the limiter and its throttle", () => {
    const { sim, session, car, spec } = fakeSim();
    expect(engineOf(sim)).toBeNull();
    session.driving = 900;
    expect(engineOf(sim)).toEqual({ rpm: 0, throttle: 0, skid: 0 });
    car.rpm = spec.engine.limiter;
    car.controls.throttle = 0.7;
    car.vel = { x: 0, y: 0, z: -12 };
    expect(engineOf(sim)).toEqual({ rpm: 1, throttle: 0.7, skid: 0 });
  });

  it("sends the tyres' slide for their squeal, none at a walking pace", () => {
    const { sim, session, car } = fakeSim();
    session.driving = 900;
    car.wheels[2]!.slipAngle = 0.3;
    // At a standstill a slip angle is no slide.
    expect(engineOf(sim)?.skid).toBe(0);
    car.vel = { x: 0, y: 0, z: -((SQUEAL_PACE / 2) / 3.6) };
    expect(engineOf(sim)?.skid).toBeCloseTo(0.5, 6);
    car.vel = { x: 0, y: 0, z: -((2 * SQUEAL_PACE) / 3.6) };
    expect(engineOf(sim)?.skid).toBeCloseTo(1, 6);
  });

  it("sounds a bump for a knock and a crash for a hard hit", () => {
    expect(hitCue(5_000)).toBe("car-bump");
    expect(hitCue(CRASH_ENERGY - 1)).toBe("car-bump");
    expect(hitCue(CRASH_ENERGY)).toBe("car-crash");
  });

  it("blips the revs as she sits down, up and back to idle within the blip's length, and then follows the engine", () => {
    const { sim, session } = fakeSim();
    const ears = listen();
    const audio = new CarAudio(ears.ports);
    session.driving = 900;
    session.carAct = { kind: "enter", t: 0 };
    audio.frame(sim, 1 / 60);
    session.carAct = null;
    const revs: number[] = [];
    for (let t = 0; t < BLIP.length + 0.5; t += 1 / 60) {
      audio.frame(sim, 1 / 60);
      revs.push(ears.engine.at(-1)!.rpm);
    }
    const peak = Math.max(...revs);
    expect(peak).toBeGreaterThan(0.4);
    expect(revs.indexOf(peak)).toBeLessThan(15);
    // Back to the engine's own idle once the blip is over.
    expect(revs.at(-1)).toBe(0);
  });
});
