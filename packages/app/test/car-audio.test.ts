import { type AudioCue, type EngineSound, vehicleSpec } from "@seki/core";
import type { Simulation } from "@seki/sim";
import { describe, expect, it } from "vitest";
import { CarAudio, engineOf } from "../src/presenters/car-audio";

/** A simulation as the car's sounds read it: the car she drives and her act at it. */
const fakeSim = () => {
  const spec = vehicleSpec("sedan");
  const car = { model: "sedan" as const, rpm: spec.engine.idle, controls: { throttle: 0, brake: 0, steer: 0, handbrake: false }, q: { w: 1, x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 } };
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
    audio.frame(sim);
    expect(ears.played).toEqual([]);
    session.driving = 900;
    session.carAct = { kind: "enter", t: 0 };
    audio.frame(sim);
    audio.frame(sim);
    expect(ears.played).toEqual(["car-door-open"]);
    // No engine while she climbs in.
    expect(ears.engine.at(-1)).toBeNull();
    session.carAct = null;
    audio.frame(sim);
    expect(ears.played.slice(1)).toEqual(["car-door-close", "engine-start"]);
    expect(ears.engine.at(-1)).not.toBeNull();
    session.carAct = { kind: "exit", t: 0 };
    audio.frame(sim);
    expect(ears.played.slice(3)).toEqual(["engine-stop", "car-door-open"]);
    expect(ears.engine.at(-1)).toBeNull();
    session.driving = null;
    session.carAct = null;
    audio.frame(sim);
    expect(ears.played.slice(5)).toEqual(["car-door-close"]);
  });

  it("gets out at once on the right side: the engine stops, the door opens and shuts", () => {
    const { sim, session } = fakeSim();
    const ears = listen();
    const audio = new CarAudio(ears.ports);
    session.driving = 900;
    audio.frame(sim);
    ears.played.length = 0;
    session.driving = null;
    audio.frame(sim);
    expect(ears.played).toEqual(["engine-stop", "car-door-open", "car-door-close"]);
  });

  it("sends the engine's revs from idle to the limiter, its throttle and its speed", () => {
    const { sim, session, car, spec } = fakeSim();
    expect(engineOf(sim)).toBeNull();
    session.driving = 900;
    expect(engineOf(sim)).toEqual({ rpm: 0, throttle: 0, speed: 0 });
    car.rpm = spec.engine.limiter;
    car.controls.throttle = 0.7;
    car.vel = { x: 0, y: 0, z: -12 };
    const e = engineOf(sim)!;
    expect(e).toMatchObject({ rpm: 1, throttle: 0.7 });
    // Its wheels' speed, forwards or back (the electric motor's whine).
    expect(e.speed).toBeCloseTo(12, 6);
  });
});
