import { EMPTY_INPUT, type InputFrame, type Vec3 } from "@seki/core";
import { type Entity, Simulation, type SimulationOptions, ground } from "../src";

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

type Passer = Entity & { passerby: NonNullable<Entity["passerby"]> };

/** A passer-by standing at its stop (ADR-0040), not one walking a crowd route (ADR-0041). */
export const atStop = (e: Passer): boolean => !e.passerby.lane;

/**
 * A background passer-by on the deptak, with no shop and no conversation: the street's opinion
 * moves it (ADR-0070). By default one standing at its stop; `pick` chooses another kind (a
 * walker of a crowd route, one sitting on a bench). The player stands `gap` metres from it.
 */
export const passerbyOnDeptak = (sim: Simulation, gap = 2, pick: (e: Passer) => boolean = atStop): Entity => {
  teleportPlayer(sim, ground(300, -84));
  run(sim, 5);
  const walker = [...sim.world]
    .filter((e): e is Passer => !!e.civilian && !!e.passerby && !e.interactable && !e.vehicle)
    .filter(pick)
    .sort((a, b) => a.id - b.id)[0];
  if (!walker) throw new Error("no passer-by on the deptak");
  teleportPlayer(sim, { x: walker.position.x + gap, y: walker.position.y, z: walker.position.z });
  return walker;
};

/**
 * Watches the civilian `id` for `steps` steps with the player standing still (the measurement of
 * ADR-0070): how often its movement relative to the player turns between "away" and "towards",
 * how far from the player it keeps after the first five seconds and how fast it went.
 */
export const watchStandOff = (sim: Simulation, id: number, steps: number) => {
  let flips = 0;
  let last = 0;
  let min = Infinity;
  let max = 0;
  let speed = 0;
  for (let i = 0; i < steps; i++) {
    run(sim, 1);
    const e = [...sim.world].find((x) => x.id === id)!;
    const p = sim.player()!;
    const dx = e.position.x - p.position.x;
    const dz = e.position.z - p.position.z;
    const d = Math.hypot(dx, dz);
    const vx = e.velocity?.x ?? 0;
    const vz = e.velocity?.z ?? 0;
    speed = Math.max(speed, Math.hypot(vx, vz));
    const radial = (vx * dx + vz * dz) / Math.max(d, 1e-6);
    const s = Math.abs(radial) < 0.05 ? 0 : Math.sign(radial);
    if (s !== 0 && last !== 0 && s !== last) flips++;
    if (s !== 0) last = s;
    if (i > 300) {
      min = Math.min(min, d);
      max = Math.max(max, d);
    }
  }
  return { flips, min, max, speed };
};

/** How far `e`'s facing is off looking at the player (radians). */
export const offFacingPlayer = (sim: Simulation, e: Entity): number => {
  const p = sim.player()!;
  const facing = Math.atan2(p.position.x - e.position.x, p.position.z - e.position.z);
  return Math.abs(Math.atan2(Math.sin(e.yaw - facing), Math.cos(e.yaw - facing)));
};
