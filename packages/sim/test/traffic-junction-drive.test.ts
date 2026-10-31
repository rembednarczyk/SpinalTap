import { describe, expect, it } from "vitest";
import { hm } from "@seki/core";
import { Simulation, ground, type Entity } from "../src";
import { TRAFFIC_ROUTES } from "../src/content/traffic";
import { teleportPlayer } from "./helpers";

/**
 * The traffic driving through the junctions the lanes now turn at (ADR-0055), against the city
 * before them (7e034bb, the verifier's probe of G-006): no vehicle stacked in one of its own route,
 * no more vehicles driving into each other, no more held up on the way.
 */

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
const drive = (seed: number, x: number, z: number) => {
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

/** The city before the turns (7e034bb), the same minute: collisions and vehicle-seconds stood. */
const BEFORE: readonly (readonly [string, number, number, number, number, number])[] = [
  ["Ruska and Lwowska", 3, 1081, 448, 22, 113],
  ["Ruska and Lwowska", 7, 1081, 448, 24, 106],
  ["Mełgiewska and Aleja Andersa", 3, 2401, 282, 12, 348],
  ["Mełgiewska and Aleja Andersa", 7, 2401, 282, 12, 338],
  ["Peowiaków and Kołłątaja", 3, -98.7, -168.6, 0, 0],
  ["Peowiaków and Kołłątaja", 7, -98.7, -168.6, 0, 0],
  ["3 Maja", 3, -105, 90, 6, 59],
  ["3 Maja", 7, -105, 90, 2, 40],
];

describe("the traffic through the junctions (ADR-0055, G-006)", () => {
  it.each(BEFORE)("by %s (seed %i): none in one of its own route, no more collisions or hold-ups than before", (_, seed, x, z, collisions, stood) => {
    const after = drive(seed, x, z);
    expect(after.stacked).toBe(0);
    expect(after.collisions).toBeLessThanOrEqual(collisions);
    expect(after.stood).toBeLessThanOrEqual(stood);
  }, 120_000);

  // 3 Maja's left lane shifts across into the lane its right one turns out of into Żołnierzy
  // Niepodległej: vehicles appeared beside one on its way there and drove into it (G-075; measured
  // before the fix: 3 collisions in these seeds, 8 with Krakowskie reaching z = -270).
  it("by 3 Maja at Żołnierzy Niepodległej, a dozen seeds: no two vehicles meet (G-075)", () => {
    const collisions = Array.from({ length: 12 }, (_, k) => drive(k + 1, -105, 90).collisions);
    expect(collisions).toEqual(Array.from({ length: 12 }, () => 0));
  }, 240_000);
});
