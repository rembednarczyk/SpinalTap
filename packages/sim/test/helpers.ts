import { type Contract, EMPTY_INPUT, type InputFrame, VEHICLE_SIZE, type Vec3, contractTag } from "@seki/core";
import { type Entity, type LaneWalk, Simulation, type SimulationOptions, ground, laneGeom, laneTarget, nearestArc, realSeconds } from "../src";
import { CROWD_LANES } from "../src/content/crowd";
import { PARKED_CARS } from "../src/content/parked-cars";

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
 * The parked sedan nearest the street tests' square whose left side is clear, and where she stands
 * beside it: a car in a car park's bays has its neighbours 2.5 m off, and she would stand in one.
 */
export const sedanBeside = (): { index: number; stand: Vec3 } => {
  const out = VEHICLE_SIZE.sedan.width / 2 + 0.7;
  // The car's left in the world (left-handed, y up): its heading (sin, cos) turned to (-cos, sin).
  const standOf = (c: (typeof PARKED_CARS)[number]): Vec3 => ({ x: c.x - Math.cos(c.yaw) * out, y: c.y + 0.05, z: c.z + Math.sin(c.yaw) * out });
  const d = (c: (typeof PARKED_CARS)[number]) => Math.hypot(c.x - STREET_START.x, c.z - STREET_START.z);
  const clear = (i: number) => {
    const s = standOf(PARKED_CARS[i]!);
    return PARKED_CARS.every((o, k) => k === i || Math.hypot(o.x - s.x, o.z - s.z) > 3.5);
  };
  const index = PARKED_CARS.map((c, i) => [c, i] as const)
    .filter(([c, i]) => c.model === "sedan" && clear(i))
    .sort(([a], [b]) => d(a) - d(b))[0]![1];
  return { index, stand: standOf(PARKED_CARS[index]!) };
};

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

/** A walker of a crowd route (ADR-0041): its pace (m/s) and the heading it walked it on (rad). */
export interface RouteWalk {
  readonly speed: number;
  readonly heading: number;
}

/** How far a route may have moved off a walker's place with the map (m): the street graph's pavements moved one by 1.2 m. */
const ROUTE_MOVED = 2;

/**
 * The route walk of a walker at `x`, `z` heading `heading`: the route nearest the place (the crowd's
 * routes are numbered anew with the map), and the phase that has the walker there on the clock.
 */
const walkThrough = (sim: Simulation, x: number, z: number, { speed, heading }: RouteWalk): LaneWalk => {
  let best: { walk: LaneWalk; off: number } | null = null;
  for (const lane of CROWD_LANES) {
    const arc = nearestArc(laneGeom(lane), x, z);
    for (const dir of [1, -1] as const) {
      const walk: LaneWalk = { lane: lane.id, phase: arc - dir * speed * realSeconds(sim.clock), speed, dir, shift: 0, avoid: 0, rejoin: null };
      const t = laneTarget(lane, walk, sim.clock);
      const off = Math.hypot(t.x - x, t.z - z);
      if (Math.cos(Math.atan2(t.tx, t.tz) - heading) > 0.9 && off < (best?.off ?? ROUTE_MOVED)) best = { walk, off };
    }
  }
  if (!best) throw new Error(`no crowd route by (${x}; ${z})`);
  return best.walk;
};

/**
 * Sets a passer-by down at `x`, `z` as if the crowd had put it there: standing at its spot, or with
 * `walk` on the route by the place, which it walks on from there. New objects, not the walker's own: its position, home and
 * goal are one object (`residentEntity`), so moving one in place moves all three, and a walker of
 * a route left on its own route walks back to it.
 */
export const setWalkerDown = (sim: Simulation, walker: Entity, x: number, z: number, walk?: RouteWalk): void => {
  const route = walk && walkThrough(sim, x, z, walk);
  const at = ground(x, z);
  walker.position = { ...at };
  walker.prevPosition = { ...at };
  walker.civilian = { ...walker.civilian!, home: { ...at } };
  const { lane: _, ...spot } = walker.passerby!;
  walker.passerby = { ...spot, goal: { ...at }, waypoint: null, ...(route ? { lane: route } : {}) };
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

/**
 * Stands the player `metres` in front of a character, along the facing of its post (a guard on
 * watch looks round it) or its own, turned to it: in its sight, whatever way its post faces
 * (W-3's posts, ADR-0082, face every way).
 */
export const standInFront = (sim: Simulation, e: Entity, metres: number): void => {
  const yaw = e.ai?.watch?.yaw ?? e.yaw;
  const [dx, dz] = [Math.sin(yaw), Math.cos(yaw)];
  teleportPlayer(sim, { x: e.position.x + dx * metres, y: e.position.y, z: e.position.z + dz * metres }, Math.atan2(-dx, -dz));
};

/**
 * Steps until the job's crew is all in the world: a raid on its way turns up after its site's delay
 * (`SitePlan.delay`, ADR-0093 O3). The steps it took; a guard of a minute.
 */
export const untilCrew = (sim: Simulation, c: Contract, frame: InputFrame = EMPTY_INPUT): number => {
  const here = () => [...sim.world].filter((e) => e.tag === contractTag(c.id)).length >= c.targets;
  let n = 0;
  for (; n < 60 * 60 && !here(); n++) sim.step(frame);
  return n;
};
