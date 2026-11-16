import { describe, expect, it } from "vitest";
import { type Vec3, terrainHeightAt } from "@seki/core";
import {
  GENZO_SPOT,
  MAP_CHUNKS,
  PADS,
  RAMPS,
  SHAPED_TERRAIN,
  Simulation,
  W3_BASIN,
  W3_BASIN_FLOOR,
  W3_NAV,
  W3_PIPE_LADDER,
  W3_UNSEEN_WALLS,
  W3_WATER_Y,
  W3_Y,
  W3_ZONE,
  WORLD_CHUNKS,
  groundY,
  inW3Zone,
  rawHeight,
  w3,
} from "../src";
import { insidePolygon } from "../src/content/tessen-w3/site";
import { shapeHeight } from "../src/content/lublin/shape";
import { bridgeDeckAt } from "../src/content/lublin/decks";
import { straightWalk } from "../src/systems/ai/steering";
import { input, teleportPlayer } from "./helpers";

/**
 * Sector W-3's ground (ADR-0082 stage 1, with the curator's corrections P1-P13): the zone's floor
 * level, the basin dug and joined to the river inside the chunks, the river and the Lutosławski
 * bridge as the NMT has them, no building of the map behind the fence, and the ways of the level
 * graph from the metro past Genzō to the gate and from the bridge to the pipeline's ladder.
 */

const terrainAt = (x: number, z: number): number => {
  const c = MAP_CHUNKS.find((k) => x >= k.bounds.minX && x <= k.bounds.maxX && z >= k.bounds.minZ && z <= k.bounds.maxZ)!;
  return terrainHeightAt(SHAPED_TERRAIN.get(c.id)!, x, z);
};

describe("W-3's ground (ADR-0082 stage 1)", () => {
  it("levels the zone's floor within 5 cm, a terrain cell (2.5 m) in from the edges of its pads", () => {
    const padded = PADS.filter((p) => p.row === "T-002" && p.y === W3_Y).map((p) => p.rect);
    const inPad = (x: number, z: number) => padded.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
    const cellIn = (x: number, z: number) => [-2.5, 2.5].every((dx) => [-2.5, 2.5].every((dz) => inPad(x + dx, z + dz)));
    let samples = 0;
    for (let x = 2477; x <= 2606; x += 1) {
      for (let z = 392; z <= 452; z += 1) {
        if (!insidePolygon(W3_ZONE, x, z) || !cellIn(x, z)) continue;
        samples++;
        expect(Math.abs(terrainAt(x, z) - W3_Y), `${x},${z}`).toBeLessThanOrEqual(0.05);
      }
    }
    expect(samples).toBeGreaterThan(5000);
  });

  it("digs the basin 3 m down, inside the chunks, and joins it to the river at its mouth", () => {
    for (const [x, z] of [
      [2550, 465],
      [2520, 460],
      [2590, 476],
    ] as const) expect(terrainAt(x, z), `${x},${z}`).toBeCloseTo(W3_BASIN_FLOOR, 1);
    // The basin with its blend ends 0.5 m short of the chunks' north edge (z 480).
    const north = Math.max(...MAP_CHUNKS.filter((c) => c.district === "doki").map((c) => c.bounds.maxZ));
    expect(W3_BASIN.maxZ + 1.5).toBeLessThan(north);
    // From the basin's middle west to its mouth the bed stays under the water, and on into the
    // river no bank is left between them: the bed there is the river's own (the NMT, which reads
    // the water's surface 5-10 cm over the basin's by the bank).
    for (let x = 2550; x >= 2508; x -= 1) expect(terrainAt(x, 474), `${x}`).toBeLessThan(W3_WATER_Y);
    for (let x = 2507; x >= 2500; x -= 1) expect(terrainAt(x, 474), `${x}`).toBeLessThanOrEqual(Math.min(rawHeight(x, 474), W3_WATER_Y + 0.1) + 1e-6);
    // The water at the NMT's: the river by the mouth (P9).
    expect(Math.abs(rawHeight(2506, 476) - W3_WATER_Y)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(rawHeight(2458, 425) - W3_WATER_Y)).toBeLessThanOrEqual(0.1);
  });

  it("leaves the river west of the quay (x < 2477) as it was without W-3", () => {
    const others = PADS.filter((p) => p.row !== "T-002");
    for (let x = 2440; x < 2477; x += 1) {
      for (let z = 380; z <= 480; z += 1) {
        const h = rawHeight(x, z);
        expect(shapeHeight(x, z, h, PADS, RAMPS), `${x},${z}`).toBe(shapeHeight(x, z, h, others, RAMPS));
      }
    }
  });

  it("leaves the public strip, the metro's entrance and the bridge's east end on the NMT (P2)", () => {
    for (let x = 2476; x <= 2606; x += 2) {
      for (const z of [380, 384, 388]) expect(Math.abs(groundY(x, z) - rawHeight(x, z)), `${x},${z}`).toBeLessThan(0.02);
    }
    for (const [x, z] of [
      [2527, 388],
      [2512.3, 391.1],
      [2489.2, 405.8],
      [2484, 409],
    ] as const) expect(Math.abs(groundY(x, z) - rawHeight(x, z)), `${x},${z}`).toBeLessThan(0.02);
  });

  it("keeps the Lutosławski bridge whole: its deck from bank to bank at the map's height, a straight walk", () => {
    const sim = Simulation.create({ seed: 3 });
    teleportPlayer(sim, { x: 2462, y: groundY(2462, 421), z: 421 });
    sim.step();
    const west: Vec3 = { x: 2441, y: groundY(2441, 434.6), z: 434.6 };
    const east: Vec3 = { x: 2482, y: groundY(2482, 410.2), z: 410.2 };
    for (const p of [west, east, { x: 2462, y: 0, z: 422.5 }]) expect(bridgeDeckAt(p.x, p.z), `${p.x},${p.z}`).not.toBeNull();
    expect(straightWalk(sim.world, west, east)).toBe(true);
    expect(straightWalk(sim.world, east, { x: 2489.2, y: groundY(2489.2, 405.8), z: 405.8 })).toBe(true);
  });

  it("clears every building of the map out of the zone", () => {
    for (const c of WORLD_CHUNKS) {
      for (const p of c.props) {
        if (p.view.kind !== "building" || !p.scenery) continue;
        const ours = p.center.y === W3_Y;
        if (!ours) expect(inW3Zone(p.center.x, p.center.z), `${c.id} ${p.center.x},${p.center.z}`).toBe(false);
      }
    }
  });
});

describe("W-3's level graph (ADR-0082 stage 1)", () => {
  const reach = (from: string): ReadonlySet<string> => {
    const seen = new Set([from]);
    const todo = [from];
    while (todo.length > 0) {
      const n = todo.pop()!;
      for (const e of W3_NAV.edges) {
        const m = e.a === n ? e.b : e.b === n ? e.a : null;
        if (m && !seen.has(m)) {
          seen.add(m);
          todo.push(m);
        }
      }
    }
    return seen;
  };
  const at = (id: string) => W3_NAV.nodes.find((n) => n.id === id)!.at;

  it("leads from the metro past Genzō to the service gate and in", () => {
    const from = reach("w3-metro");
    for (const id of ["w3-genzo", "w3-wicket-out", "w3-wicket-in", "w3-office-door", "w3-quay", "w3-plat-sw", "w3-roof-n1"]) expect(from.has(id), id).toBe(true);
    expect(Math.hypot(at("w3-genzo").x - GENZO_SPOT.x, at("w3-genzo").z - GENZO_SPOT.z)).toBeLessThan(4);
    expect(inW3Zone(at("w3-wicket-out").x, at("w3-wicket-out").z)).toBe(false);
    expect(inW3Zone(at("w3-wicket-in").x, at("w3-wicket-in").z)).toBe(true);
  });

  it("leads from the bridge's west end along the west bank to the foot of the pipeline's ladder", () => {
    expect(reach("w3-bridge-w").has("w3-pipe-ladder")).toBe(true);
    const foot = at("w3-pipe-ladder");
    expect(Math.hypot(foot.x - W3_PIPE_LADDER.x, foot.z - W3_PIPE_LADDER.z)).toBeLessThan(0.5);
    const sim = Simulation.create({ seed: 3 });
    teleportPlayer(sim, { ...foot });
    sim.step();
    const ladder = [...sim.world.with("ladder")].find((e) => e.ladder.key === W3_PIPE_LADDER.key);
    expect(ladder?.ladder.top).toBeCloseTo(W3_Y + 10, 5);
    expect(ladder?.ladder.bottom).toBeCloseTo(groundY(W3_PIPE_LADDER.x, W3_PIPE_LADDER.z), 5);
  });
});

describe("W-3's edges on the river (ADR-0082 stage 1, curator's review round 2)", () => {
  /** A game with the player near the quay, everyone else gone. */
  const quaySim = (): Simulation => {
    const sim = Simulation.create({ seed: 3 });
    teleportPlayer(sim, w3(2482, 0, 428));
    sim.step();
    for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
    return sim;
  };

  it("keeps the quay's floor level up to the railing over the water, wall and pad alike (P3)", () => {
    const sim = quaySim();
    for (let x = 2477.4; x <= 2486.6; x += 0.4) {
      // From the quay's south end (z 418.5, its pad down to the grid's row under the bridge) to its north end.
      for (const z of [418.8, 419.4, 421, 425, 431, 436, 439.6]) {
        teleportPlayer(sim, w3(x, 0.3, z));
        delete sim.player()!.fall;
        for (let i = 0; i < 30; i++) sim.step();
        expect(Math.abs(sim.player()!.position.y - W3_Y), `${x.toFixed(1)},${z}`).toBeLessThanOrEqual(0.05);
      }
    }
  });

  it("puts no unseen wall over the Lutosławski bridge's deck (P7)", () => {
    for (const p of W3_UNSEEN_WALLS) {
      for (const q of p.prisms ?? []) {
        const top = p.center.y + q.top;
        const pts = [...q.points, { x: q.points.reduce((s, c) => s + c.x, 0) / q.points.length, z: q.points.reduce((s, c) => s + c.z, 0) / q.points.length }];
        for (const c of pts) {
          const deck = bridgeDeckAt(p.center.x + c.x, p.center.z + c.z);
          if (deck !== null) expect(top, `${(p.center.x + c.x).toFixed(1)},${(p.center.z + c.z).toFixed(1)}`).toBeLessThanOrEqual(deck);
        }
      }
    }
  });

  it("lets no jump from the bridge's deck land behind the fence, onto the pier (P7)", () => {
    for (const x of [2462.2, 2463.5, 2465, 2465.8]) {
      const sim = quaySim();
      const edge = 439.4 - 0.594 * (x - 2441.7);
      const start = { x, y: groundY(x, edge - 1.2), z: edge - 1.2 };
      for (const yaw of [0, 0.5, -0.4]) {
        teleportPlayer(sim, start, yaw);
        delete sim.player()!.fall;
        sim.step();
        sim.step(input({ moveZ: 1, sprint: true }));
        sim.step(input({ moveZ: 1, sprint: true, jump: true }));
        for (let i = 0; i < 90; i++) sim.step(input({ moveZ: 1, sprint: true }));
        const p = sim.player()!.position;
        expect(inW3Zone(p.x, p.z), `${x},${yaw}: ${p.x.toFixed(1)},${p.z.toFixed(1)}`).toBe(false);
      }
    }
  });
});
