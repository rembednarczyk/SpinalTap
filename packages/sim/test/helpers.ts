import { EMPTY_INPUT, type InputFrame, type Vec3 } from "@seki/core";
import { Simulation, type SimulationOptions, ground } from "../src";

export const input = (partial: Partial<InputFrame> = {}): InputFrame => ({ ...EMPTY_INPUT, ...partial });

export const run = (sim: Simulation, steps: number, frame: InputFrame = EMPTY_INPUT): void => {
  for (let i = 0; i < steps; i++) sim.step(frame);
};

export const teleportPlayer = (sim: Simulation, position: Vec3, yaw = 0, pitch = 0): void => {
  const p = sim.player();
  if (!p) throw new Error("no player");
  p.position = position;
  p.prevPosition = position;
  p.yaw = yaw;
  p.pitch = pitch;
};

/**
 * Open ground for the tests of movement, combat and the street: the south end of Plac Litewski
 * (ADR-0045), about 110 m of square to the north and 80 m east and west. A new game wakes up in
 * Mori's clinic on the deptak; these tests start out here instead.
 */
export const STREET_START: Vec3 = ground(70, -50);

/**
 * The deptak where it opens onto Plac Łokietka (ADR-0045): in the chunk of the clinic, Neon
 * Koi and the car wash, with the M0 courier and his guard in the yard behind the square, some
 * 70 m north.
 */
export const ALLEY_START: Vec3 = ground(400, -97);

/** A new game with the player on the deptak by Plac Łokietka, before the first step. */
export const alleySim = (options: SimulationOptions): Simulation => {
  const sim = Simulation.create(options);
  teleportPlayer(sim, ALLEY_START);
  return sim;
};

/** Plac Litewski's north end: far from the deptak's chunks, which stream out there. */
export const AWAY: Vec3 = ground(60, 40);

/** A new game with the player moved out onto the street, before the first step. */
export const streetSim = (options: SimulationOptions): Simulation => {
  const sim = Simulation.create(options);
  teleportPlayer(sim, STREET_START);
  return sim;
};

export const byKey =(sim: Simulation, key: string) => [...sim.world].find((e) => e.key === key);

export const collect = <T>(sim: Simulation, type: Parameters<Simulation["bus"]["on"]>[0]): T[] => {
  const out: T[] = [];
  sim.bus.on(type, (p) => out.push(p as T));
  return out;
};

/** What the debrief cards paid on top of the base rewards so far (ADR-0029), from now on. */
export const debriefExtras = (sim: Simulation): (() => number) => {
  const cards = collect<{ bonus: number; styleBonus: number }>(sim, "ContractDebrief");
  return () => cards.reduce((sum, c) => sum + c.bonus + c.styleBonus, 0);
};
