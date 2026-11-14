import { hm } from "@seki/core";
import { Simulation, ground, type Entity } from "../src";
import { TRAFFIC_ROUTES } from "../src/content/traffic";
import { teleportPlayer } from "./helpers";

/** A minute of the traffic by a junction or a bend, as the traffic tests drive it (ADR-0055, G-006, G-744). */

type V = Entity & { vehicle: NonNullable<Entity["vehicle"]> };

const vehicles = (sim: Simulation): V[] => [...sim.world].filter((e): e is V => e.vehicle !== undefined);

const corners = (v: V) => {
  const [fx, fz] = [Math.sin(v.yaw), Math.cos(v.yaw)];
  const { l, w } = v.vehicle.half;
  return [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ].map(([a, b]) => [v.position.x + fx * l * a! + fz * w * b!, v.position.z + fz * l * a! - fx * w * b!] as const);
};

/** Do two vehicles' footprints overlap by more than 5 cm (separating axes)? */
const overlap = (a: V, b: V): boolean => {
  if (Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) > 12) return false;
  const [A, B] = [corners(a), corners(b)];
  for (const P of [A, B])
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = P[i]!;
      const [x2, z2] = P[(i + 1) % 4]!;
      const [nx, nz] = [z2 - z1, x1 - x2];
      const pa = A.map(([x, z]) => x * nx + z * nz);
      const pb = B.map(([x, z]) => x * nx + z * nz);
      if (Math.max(...pa) < Math.min(...pb) + 0.05 || Math.max(...pb) < Math.min(...pa) + 0.05) return false;
    }
  return true;
};

/**
 * One minute of the morning rush with the player 25 m south of a junction looking at it: the
 * times two vehicles came to overlap, the times two of one route did, and the vehicle-seconds
 * stood within 60 m of it, away from the last 40 m of a lane (held at a lane's end in view is
 * ADR-0050's rule, and a lane fed through the junctions now reaches its end in view).
 */
export const drive = (seed: number, x: number, z: number) => {
  const sim = Simulation.create({ seed, crowd: "high" });
  const now = Math.floor((sim.clock.seconds % 86400) / 60);
  sim.enqueue({ type: "wait", minutes: (hm(8) - now + 1440) % 1440 });
  sim.step();
  teleportPlayer(sim, ground(x, z - 25), 0);
  const pairs = new Set<string>();
  let collisions = 0;
  let stacked = 0;
  let stood = 0;
  for (let t = 0; t < 60 * 60; t++) {
    sim.step();
    const vs = vehicles(sim);
    const now = new Set<string>();
    for (let i = 0; i < vs.length; i++)
      for (let j = i + 1; j < vs.length; j++) {
        const [a, b] = [vs[i]!, vs[j]!];
        if (!overlap(a, b)) continue;
        const key = `${a.id}-${b.id}`;
        now.add(key);
        if (pairs.has(key)) continue;
        collisions++;
        // Stacked: two of one route at one place along it (a long route may also cross itself at a roundabout).
        if (a.vehicle.route === b.vehicle.route && Math.abs(a.vehicle.s - b.vehicle.s) < a.vehicle.half.l + b.vehicle.half.l + 1) stacked++;
      }
    pairs.clear();
    for (const k of now) pairs.add(k);
    for (const v of vs) {
      if (Math.hypot(v.position.x - x, v.position.z - z) > 60 || Math.abs(v.vehicle.v) >= 0.1) continue;
      if (v.vehicle.s < TRAFFIC_ROUTES[v.vehicle.route]!.length - 40) stood++;
    }
  }
  return { collisions, stacked, stood: stood / 60 };
};
