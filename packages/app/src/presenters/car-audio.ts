import { type AudioCue, type EngineSound, type EntityId, vehicleSpec } from "@seki/core";
import { type Simulation, carKmh, drivenCar } from "@seki/sim";

/** Where she is with the car she drives (ADR-0097). */
type Seat = "out" | "entering" | "in" | "exiting";

/** The sounds of a change of seat: the door as she opens and shuts it, the engine started and stopped. */
const CHANGES: Readonly<Record<`${Seat}>${Seat}`, readonly AudioCue[]>> = {
  "out>out": [],
  "out>entering": ["car-door-open"],
  "out>in": ["car-door-close", "engine-start"],
  "out>exiting": ["car-door-open"],
  "entering>out": ["car-door-close"],
  "entering>entering": [],
  "entering>in": ["car-door-close", "engine-start"],
  "entering>exiting": ["car-door-open"],
  "in>out": ["engine-stop", "car-door-open", "car-door-close"],
  "in>entering": [],
  "in>in": [],
  "in>exiting": ["engine-stop", "car-door-open"],
  "exiting>out": ["car-door-close"],
  "exiting>entering": [],
  "exiting>in": ["car-door-close", "engine-start"],
  "exiting>exiting": [],
};

/** Where the sounds go: one-shot cues and the audio adapter's engine loop (`SynthAudio.engine`). */
export interface CarAudioPorts {
  play(cue: AudioCue): void;
  readonly engine?: { set(engine: EngineSound | null): void };
}

/**
 * The car she drives as heard (ADR-0097), read once a frame from the simulation: the doors and
 * the engine's start and stop at the changes of her seat (getting in sounds when she reaches the
 * door, not when the act begins, which `VehicleEntered` marks; getting out when she opens the door),
 * and while she sits at the wheel the engine's revs and throttle for its loop. A state machine
 * over the seat, as the HUD's parts read the frame (`VehicleHud`).
 */
export class CarAudio {
  private seat: Seat = "out";
  private car: EntityId | null = null;

  constructor(private readonly audio: CarAudioPorts) {}

  frame(sim: Pick<Simulation, "session" | "world">): void {
    const s = sim.session;
    const seat: Seat = s.driving === null ? "out" : s.carAct?.kind === "enter" ? "entering" : s.carAct?.kind === "exit" ? "exiting" : "in";
    // Another car (a load, a new game) starts from outside it.
    const from = s.driving !== null && s.driving !== this.car && this.seat !== "out" ? "out" : this.seat;
    for (const cue of CHANGES[`${from}>${seat}`]) this.audio.play(cue);
    this.seat = seat;
    this.car = s.driving;
    this.audio.engine?.set(seat === "in" ? engineOf(sim) : null);
  }
}

/** The engine of the car she drives: its revs from idle to the limiter, its throttle; null with no car. */
export const engineOf = (sim: Pick<Simulation, "session" | "world">): EngineSound | null => {
  const car = drivenCar(sim);
  if (!car) return null;
  const { idle, limiter } = vehicleSpec(car.model).engine;
  return { rpm: Math.min(1, Math.max(0, (car.rpm - idle) / (limiter - idle))), throttle: car.controls.throttle, speed: Math.abs(carKmh(car)) / 3.6 };
};
