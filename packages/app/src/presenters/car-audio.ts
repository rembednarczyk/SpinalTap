import { type AudioCue, type EngineSound, type EntityId, vehicleSpec } from "@seki/core";
import { type Simulation, carKmh, carSkid, drivenCar } from "@seki/sim";

/** Where she is with the car she drives (ADR-0097). */
type Seat = "out" | "entering" | "in" | "exiting";

/**
 * The sounds of a change of seat: the door as she opens and shuts it, the engine stopped as she gets out.
 * Seated she hears no starter (user's notes of 21.11): the engine runs, and its revs rise a moment (`BLIP`).
 */
const CHANGES: Readonly<Record<`${Seat}>${Seat}`, readonly AudioCue[]>> = {
  "out>out": [],
  "out>entering": ["car-door-open"],
  "out>in": ["car-door-close"],
  "out>exiting": ["car-door-open"],
  "entering>out": ["car-door-close"],
  "entering>entering": [],
  "entering>in": ["car-door-close"],
  "entering>exiting": ["car-door-open"],
  "in>out": ["engine-stop", "car-door-open", "car-door-close"],
  "in>entering": [],
  "in>in": [],
  "in>exiting": ["engine-stop", "car-door-open"],
  "exiting>out": ["car-door-close"],
  "exiting>entering": [],
  "exiting>in": ["car-door-close"],
  "exiting>exiting": [],
};

/** Where the sounds go: one-shot cues and the audio adapter's engine loop (`SynthAudio.engine`). */
export interface CarAudioPorts {
  play(cue: AudioCue): void;
  readonly engine?: { set(engine: EngineSound | null): void };
}

/**
 * The car she drives as heard (ADR-0097), read once a frame from the simulation: the doors and
 * the engine's stop at the changes of her seat (getting in sounds when she reaches the door, not
 * when the act begins, which `VehicleEntered` marks; getting out when she opens the door), and while
 * she sits at the wheel the engine's revs and throttle for its loop, a blip of the throttle as she
 * sits down. A state machine
 * over the seat, as the HUD's parts read the frame (`VehicleHud`).
 */
export class CarAudio {
  private seat: Seat = "out";
  private car: EntityId | null = null;
  /** Seconds since she sat down at the wheel, while the blip of the revs runs; null after it. */
  private blip: number | null = null;

  constructor(private readonly audio: CarAudioPorts) {}

  /** One rendered frame, `dt` seconds after the last. */
  frame(sim: Pick<Simulation, "session" | "world">, dt: number): void {
    const s = sim.session;
    const seat: Seat = s.driving === null ? "out" : s.carAct?.kind === "enter" ? "entering" : s.carAct?.kind === "exit" ? "exiting" : "in";
    // Another car (a load, a new game) starts from outside it.
    const from = s.driving !== null && s.driving !== this.car && this.seat !== "out" ? "out" : this.seat;
    for (const cue of CHANGES[`${from}>${seat}`]) this.audio.play(cue);
    if (seat === "in" && from !== "in") this.blip = 0;
    else if (this.blip !== null) this.blip += Math.max(0, dt);
    if (this.blip !== null && (seat !== "in" || this.blip > BLIP.length)) this.blip = null;
    this.seat = seat;
    this.car = s.driving;
    const engine = seat === "in" ? engineOf(sim) : null;
    this.audio.engine?.set(engine && this.blip !== null ? blipped(engine, this.blip) : engine);
  }
}

/** The engine of the car she drives: its revs from idle to the limiter, its throttle; null with no car. */
/** The energy (J) from which a hit is a crash: some 24 km/h into a wall for the sedan's 1350 kg; under it a bump. */
export const CRASH_ENERGY = 30_000;

/** The sound of her car hitting something, by the kinetic energy taken out of it. */
export const hitCue = (energy: number): AudioCue => (energy >= CRASH_ENERGY ? "car-crash" : "car-bump");

/** The speed (km/h) from which the tyres' slide is heard in full. */
export const SQUEAL_PACE = 20;

export const engineOf = (sim: Pick<Simulation, "session" | "world">): EngineSound | null => {
  const car = drivenCar(sim);
  if (!car) return null;
  const { idle, limiter } = vehicleSpec(car.model).engine;
  // The tyres' slide for their squeal, none at a walking pace (a slip angle at a crawl is no slide).
  const pace = Math.min(1, Math.abs(carKmh(car)) / SQUEAL_PACE);
  return { rpm: Math.min(1, Math.max(0, (car.rpm - idle) / (limiter - idle))), throttle: car.controls.throttle, skid: carSkid(car) * pace };
};

/** The blip as she sits down: the revs up to `peak` of the range in `rise` seconds, back down with time constant `fall`, over in `length`. */
export const BLIP = { peak: 0.45, rise: 0.15, fall: 0.25, length: 1.2 } as const;

/** The engine with the blip `t` seconds after she sat down laid over it: the revs and the pedal, whichever is higher. */
export const blipped = (e: EngineSound, t: number): EngineSound => {
  const k = t < BLIP.rise ? t / BLIP.rise : Math.exp(-(t - BLIP.rise) / BLIP.fall);
  return { rpm: Math.max(e.rpm, BLIP.peak * k), throttle: Math.max(e.throttle, k) };
};
