import { type AudioCue, type EngineSound, vehicleSpec } from "@seki/core";
import type { Simulation } from "@seki/sim";
import { describe, expect, it } from "vitest";
import { SENSOR_RANGE } from "@seki/sim";
import { BLIP, BUMP_ENERGY, CRASH_ENERGY, CarAudio, HEAVY_ENERGY, SENSOR_SOLID, SQUEAL_PACE, beepInterval, engineOf, hitCue } from "../src/presenters/car-audio";

/** A simulation as the car's sounds read it: the car she drives and her act at it. */
const fakeSim = () => {
  const spec = vehicleSpec("sedan");
  const wheel = () => ({ load: 3000, slipRatio: 0, slipAngle: 0 });
  const car = { model: "sedan" as const, gear: 1, scrape: 0, rpm: spec.engine.idle, controls: { throttle: 0, brake: 0, steer: 0, handbrake: false }, q: { w: 1, x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, wheels: [wheel(), wheel(), wheel(), wheel()] };
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
    expect(engineOf(sim)).toEqual({ rpm: 0, throttle: 0, skid: 0, speed: 0, scrape: 0 });
    car.rpm = spec.engine.limiter;
    car.controls.throttle = 0.7;
    car.vel = { x: 0, y: 0, z: -12 };
    car.scrape = 3;
    // Its speed over the road (m/s) for the roll and the wind, its slide along a wall for the scrape (22.11).
    expect(engineOf(sim)).toEqual({ rpm: 1, throttle: 0.7, skid: 0, speed: expect.closeTo(12, 6) as number, scrape: 3 });
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

  it("sounds a tap at a crawl, a bump, a crash and a heavy crash by the hit's energy (22.11)", () => {
    expect(hitCue(4_000)).toBe("car-tap");
    expect(hitCue(BUMP_ENERGY)).toBe("car-bump");
    expect(hitCue(CRASH_ENERGY - 1)).toBe("car-bump");
    expect(hitCue(CRASH_ENERGY)).toBe("car-crash");
    expect(hitCue(HEAVY_ENERGY - 1)).toBe("car-crash");
    expect(hitCue(HEAVY_ENERGY)).toBe("car-crash-heavy");
  });

  it("clunks the gearbox as the gear changes, not as she sits down (22.11)", () => {
    const { sim, session, car } = fakeSim();
    const ears = listen();
    const audio = new CarAudio(ears.ports);
    session.driving = 900;
    car.gear = 2;
    audio.frame(sim, 1 / 60);
    audio.frame(sim, 1 / 60);
    expect(ears.played).not.toContain("car-shift");
    car.gear = 3;
    audio.frame(sim, 1 / 60);
    expect(ears.played.filter((c) => c === "car-shift")).toHaveLength(1);
    audio.frame(sim, 1 / 60);
    expect(ears.played.filter((c) => c === "car-shift")).toHaveLength(1);
  });

  it("beeps the parking sensor faster the nearer what is behind, one tone touching it, silent past its range (22.11)", () => {
    expect(beepInterval(SENSOR_RANGE + 0.1)).toBeNull();
    const far = beepInterval(1.5)!;
    const near = beepInterval(0.6)!;
    expect(near).toBeLessThan(far);
    expect(beepInterval(SENSOR_SOLID)).toBeLessThan(near);
    expect(far).toBeLessThanOrEqual(0.6);
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
