// @ts-expect-error The engine is typed for the browser; the test reads the props off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CityKit } from "../src/renderer/city-kit";
import { parseCityKit } from "../src/renderer/city-kit-data";
import { mergeCityProps, parseCityProps } from "../src/renderer/city-props";
import { DRONE_SIZE } from "../src/renderer/drones/drone-flight";
import { type DroneLane, MIN_AGL } from "../src/renderer/drones/drone-lanes";
import { DroneViews, PATROL_LOD } from "../src/renderer/drones/drone-views";
import { PatrolAir } from "../src/renderer/drones/patrol-air";
import {
  BEAM_FROM,
  PATROL_ALTITUDE,
  PATROL_BOB,
  PATROL_CEILING,
  PATROL_COUNT,
  PATROL_PAUSE,
  PATROL_POP,
  PATROL_SCALE,
  PATROL_SOAR,
  PATROL_SIZE,
  type PatrolLane,
  patrolCycle,
  patrolFleet,
  patrolOf,
  patrolPose,
} from "../src/renderer/drones/patrol-flight";
import { MIN_LANE, type PatrolWorld, ROOF_ROOM, planPatrolLanes } from "../src/renderer/drones/patrol-lanes";
import { POOL_SEGMENTS, patrolTemplates } from "../src/renderer/drones/patrol-models";
import { BEAM_SPREAD, PAVING_READ, POOL_LIFT, poolDrop, poolRadius } from "../src/renderer/drones/patrol-pool";
import type { P2 } from "../src/renderer/mapcity/polygon";

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const kitData = parseCityKit(file("city-kit.glb"));
const props = mergeCityProps(parseCityProps(file("city-props.glb")), parseCityProps(file("drone-props.glb")));

/** A straight lane along +x from (0, 0), `length` m, the paving at `ground`. */
const lane = (length: number, ground = 0, quiet = false, seed = 7): PatrolLane => {
  const n = length / 4;
  return { points: Array.from({ length: n + 1 }, (_, i) => ({ x: i * 4, z: 0 })), grounds: Array.from({ length: n + 1 }, () => ground), length, seed, quiet, square: 0, ceilings: [ground + PATROL_CEILING, ground + PATROL_CEILING + 6], roofs: [ground + PATROL_CEILING, ground + PATROL_CEILING] };
};

const rect = (x0: number, z0: number, x1: number, z1: number): P2[] => [
  { x: x0, z: z0 },
  { x: x1, z: z0 },
  { x: x1, z: z1 },
  { x: x0, z: z1 },
];

/** A pedestrian street along x from 0 to 200 m, 14 m wide between two rows of 15 m houses; `air` adds to the houses. */
const street = (air: { posts?: ConstructorParameters<typeof PatrolAir>[1] } = {}): PatrolWorld => {
  const houses = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((i) => [rect(i * 20, 7, i * 20 + 18, 20), rect(i * 20, -20, i * 20 + 18, -7)]);
  return {
    axes: [[{ x: 0, z: 0 }, { x: 200, z: 0 }]],
    roads: [rect(-10, -7, 210, 7)],
    air: new PatrolAir(
      houses.map((ring) => ({ ring, bottom: 0, top: 15, pad: 1 })),
      air.posts ?? [],
    ),
    groundAt: () => 0,
    surfaceAt: () => 0,
    quietAt: () => false,
  };
};

describe("low patrol models (ADR-0058 stage 7b)", () => {
  it("are the patrol drone at its scale, with a searchlight of a unit drop after it", () => {
    for (const t of Object.values(patrolTemplates(kitData, props))) {
      let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
      for (let i = 0; i < t.beam * 3; i += 3) {
        minX = Math.min(minX, t.positions[i]!);
        maxX = Math.max(maxX, t.positions[i]!);
        minY = Math.min(minY, t.positions[i + 1]!);
        maxY = Math.max(maxY, t.positions[i + 1]!);
      }
      expect(maxX - minX).toBeLessThanOrEqual(PATROL_SIZE.width + 1e-3);
      expect(minY).toBeGreaterThanOrEqual(-1e-3);
      expect(maxY).toBeLessThanOrEqual(PATROL_SIZE.height + 1e-3);
      // The searchlight's pool: a unit under the foot, a unit wide.
      for (let i = t.beam * 3; i < t.positions.length; i += 3) {
        expect(t.positions[i + 1]!).toBeGreaterThanOrEqual(-1 - 1e-6);
        expect(t.positions[i + 1]!).toBeLessThanOrEqual(1e-6);
        expect(Math.hypot(t.positions[i]!, t.positions[i + 2]!)).toBeLessThanOrEqual(1 + 1e-6);
      }
      expect(t.vertexCount).toBeGreaterThan(t.beam);
      for (const i of t.indices) expect(i).toBeLessThan(t.vertexCount);
    }
    expect(PATROL_SIZE.width).toBeCloseTo(DRONE_SIZE.patrol.width * PATROL_SCALE, 9);
  });
});

describe("low patrol flight (ADR-0058 stage 7b)", () => {
  it("comes into sight at its ceilings, flies the lane over the heads, hangs, climbs away and stays away a while", () => {
    // Its ceilings: 18 m over the start, 24 m over the end (the roofs round it).
    const p = patrolOf(lane(80, 3));
    const cycle = patrolCycle(p);
    let prev = patrolPose(p, -p.offset);
    let away = 0;
    let low = 0;
    let flights = 0;
    const dt = 0.05;
    for (let t = dt; t < cycle; t += dt) {
      const q = patrolPose(p, t - p.offset);
      if (!q) {
        away += dt;
        // It goes only once shrunk to nothing.
        if (prev) expect(prev.scale).toBeLessThan(0.01);
        if (prev) flights++;
        prev = q;
        continue;
      }
      expect(q.y - q.ground).toBeGreaterThanOrEqual(PATROL_ALTITUDE - PATROL_BOB - 1e-6);
      expect(q.y - q.ground).toBeLessThanOrEqual(PATROL_CEILING + 6 + PATROL_BOB + 1e-6);
      // It grows from nothing and shrinks to nothing only at a ceiling, never under it.
      if (q.scale < 1) expect(Math.min(Math.abs(q.y - p.lane.ceilings[0]), Math.abs(q.y - p.lane.ceilings[1]))).toBeLessThanOrEqual(PATROL_BOB + 1e-6);
      if (!prev) expect(q.scale).toBeLessThan(0.01);
      expect(q.ground).toBe(3);
      if (q.y - q.ground < PATROL_ALTITUDE + PATROL_BOB + 1e-6) low += dt;
      // No jump: at most the fast climb over the roofs (`PATROL_SOAR`) in a step, and the bob.
      if (prev) expect(Math.hypot(q.x - prev.x, q.y - prev.y, q.z - prev.z)).toBeLessThan(PATROL_SOAR * dt + 0.05);
      if (prev) expect(Math.abs(q.scale - prev.scale)).toBeLessThan(0.1);
      // On the lane's axis, never past its ends.
      expect(q.z).toBeCloseTo(0, 9);
      expect(q.x).toBeGreaterThanOrEqual(-1e-6);
      expect(q.x).toBeLessThanOrEqual(80 + 1e-6);
      prev = q;
    }
    // Out and back, away for both pauses, low for both ways along with their hovers.
    expect(flights).toBe(2);
    expect(away).toBeCloseTo(p.pauses[0] + p.pauses[1], 0);
    expect(low).toBeGreaterThan((2 * 80) / 3.5 + 2 * p.hover - 2);
    // Its least ceiling lies under the canyon drones' lowest level.
    expect(PATROL_CEILING + PATROL_SIZE.height + PATROL_BOB).toBeLessThan(MIN_AGL - 0.35);
  });

  it("stays away longer over the Old Town than over the deptak, and its searchlight shows only low", () => {
    for (let seed = 1; seed < 50; seed++) {
      const quiet = patrolOf(lane(60, 0, true, seed));
      const busy = patrolOf(lane(60, 0, false, seed));
      for (const t of quiet.pauses) expect(t).toBeGreaterThanOrEqual(PATROL_PAUSE.quiet[0]);
      for (const t of busy.pauses) expect(t).toBeLessThanOrEqual(PATROL_PAUSE.busy[1]);
    }
    expect(PATROL_PAUSE.busy[1]).toBeLessThanOrEqual(PATROL_PAUSE.quiet[0]);
    expect(BEAM_FROM).toBeLessThan(PATROL_CEILING);
  });

  it("spends longer over the street than coming down from its ceiling and climbing back, and most of it in sight", () => {
    // The shortest lane, its roofs 30 m over the paving, its ceilings at `PATROL_POP`.
    const short: PatrolLane = { ...lane(40), ceilings: [PATROL_POP, PATROL_POP], roofs: [30, 30] };
    for (let seed = 1; seed < 50; seed++) {
      const p = patrolOf({ ...short, seed });
      const cycle = patrolCycle(p);
      let street = 0;
      let column = 0;
      let unseen = 0;
      const dt = 0.1;
      for (let t = 0; t < cycle; t += dt) {
        const q = patrolPose(p, t - p.offset);
        if (!q) continue;
        if (q.y - q.ground <= PATROL_ALTITUDE + PATROL_BOB + 1e-6) street += dt;
        else column += dt;
        if (q.y - q.ground > PATROL_LOD.high.draw) unseen += dt;
      }
      // Four columns of some 40 s each, a minute or more twice over the street.
      expect(column, `seed ${seed}`).toBeGreaterThan(160);
      expect(column, `seed ${seed}`).toBeLessThan(180);
      expect(street, `seed ${seed}`).toBeGreaterThan(column - unseen);
      expect(column / cycle, `seed ${seed}`).toBeLessThan(0.55);
    }
  });

  it("grows its searchlight's pool from nothing as it comes down under the beam's height, never wider than under the hanging drone", () => {
    expect(poolRadius(BEAM_FROM)).toBe(0);
    expect(poolRadius(BEAM_FROM - 0.05)).toBeLessThan(0.05);
    // Hanging, bob included: its full radius, unstirred by the bob's 5 cm steps.
    const hang = poolRadius(PATROL_ALTITUDE);
    expect(hang).toBeCloseTo(PATROL_ALTITUDE * BEAM_SPREAD, 6);
    // Down a patrol's descent, step by step: from nothing, no jump, never wider than 10 % over its hanging pool.
    const p = patrolOf(lane(80, 3));
    let prev: number | null = null;
    let lit = 0;
    for (let t = 0; t < patrolCycle(p); t += 0.01) {
      const q = patrolPose(p, t - p.offset);
      const drop = q && poolDrop(q);
      const r = drop === null || drop === undefined ? null : poolRadius(drop);
      if (r !== null && prev === null) expect(r, `t ${t}`).toBeLessThan(0.05);
      if (r !== null && prev !== null) expect(Math.abs(r - prev), `t ${t}`).toBeLessThan(0.05);
      if (r !== null) expect(r).toBeLessThanOrEqual(hang * 1.1);
      if (r !== null && prev === null) lit++;
      prev = r;
    }
    // Lit on both ways down.
    expect(lit).toBe(2);
  });

  it("puts about ten on high, three of them over the Old Town, half on medium and none on a phone", () => {
    const lanes = [...Array.from({ length: 6 }, (_, i) => lane(40 + i * 8, 0, true, i + 1)), ...Array.from({ length: 9 }, (_, i) => lane(40 + i * 8, 0, false, i + 20))];
    const high = patrolFleet(lanes, "high");
    expect(high).toHaveLength(PATROL_COUNT.high.total);
    expect(high.filter((p) => p.lane.quiet)).toHaveLength(PATROL_COUNT.high.quiet);
    const medium = patrolFleet(lanes, "medium");
    expect(medium).toHaveLength(PATROL_COUNT.medium.total);
    expect(medium.filter((p) => p.lane.quiet)).toHaveLength(PATROL_COUNT.medium.quiet);
    // The longest lanes, the same ones on both.
    for (const p of medium) expect(high.map((h) => h.lane)).toContain(p.lane);
    expect(patrolFleet(lanes, "low")).toEqual([]);
    // Over the Old Town a short lane over a square (the Rynek) comes before the longer side streets.
    const rynek = { ...lane(40, 0, true, 99), square: 1 };
    expect(patrolFleet([...lanes, rynek], "medium").map((p) => p.lane)).toContain(rynek);
  });
});

describe("low patrol lanes (ADR-0058 stage 7b)", () => {
  it("follow the pedestrian street over its paving, clear of the facades' room", () => {
    const lanes = planPatrolLanes(street());
    expect(lanes).toHaveLength(1);
    expect(lanes[0]!.length).toBeGreaterThanOrEqual(MIN_LANE);
    for (const p of lanes[0]!.points) expect(Math.abs(p.z)).toBeLessThan(1e-6);
  });

  it("break where a lamp or a cable stands in their band, and keep their ends' columns clear up to the ceiling", () => {
    // A lamp on the axis at x 100: the lane stops short of it on both sides.
    const lamp = { x: 100, z: 0, r: 0.6, bottom: 0, top: 4.6 };
    const split = planPatrolLanes(street({ posts: [lamp] }));
    expect(split.length).toBe(2);
    for (const l of split) for (const p of l.points) expect(Math.abs(p.x - 100)).toBeGreaterThan(2);
    // A low bench under the band changes nothing.
    expect(planPatrolLanes(street({ posts: [{ ...lamp, top: 0.6 }] }))).toHaveLength(1);
    // A cable across the street at 12 m, over the band: the lane runs under it, but no patrol comes down
    // or climbs through it, so neither end is there.
    const cable = Array.from({ length: 29 }, (_, i) => ({ x: 20, z: -7 + i * 0.5, r: 0.05, bottom: 11.95, top: 12.05 }));
    const under = planPatrolLanes(street({ posts: cable }));
    expect(under).toHaveLength(1);
    expect(Math.abs(under[0]!.points[0]!.x - 20)).toBeGreaterThan(2);
    // The same cable at 5 m cuts the lane.
    const low = planPatrolLanes(street({ posts: cable.map((c) => ({ ...c, bottom: 4.95, top: 5.05 })) }));
    for (const l of low) for (const p of l.points) expect(Math.abs(p.x - 20)).toBeGreaterThan(2);
  });
});

describe("low patrol ceilings (ADR-0058 stage 7b)", () => {
  it("climb slowly over the roofs round the lane's ends, come into sight out of draw from everyone, and keep clear of the canyon drones", () => {
    const plain = planPatrolLanes(street());
    // 15 m roofs: the least roof height, 18 m over the paving.
    expect(plain[0]!.roofs).toEqual([PATROL_CEILING, PATROL_CEILING]);
    // Its ceilings: `PATROL_POP` over the paving, whatever the street round it.
    expect(plain[0]!.ceilings).toEqual([PATROL_POP, PATROL_POP]);
    const hilly = { ...street(), surfaceAt: (x: number) => x * 0.1 };
    const sloped = planPatrolLanes(hilly)[0]!;
    for (const [k, end] of [sloped.points[0]!, sloped.points.at(-1)!].entries()) expect(sloped.ceilings[k]).toBeCloseTo(end.x * 0.1 + PATROL_POP, 6);
    // There it is past every quality's draw distance from the street under it, with room for the terrain round it.
    for (const q of Object.values(PATROL_LOD)) expect(PATROL_POP - 100).toBeGreaterThan(q.draw);
    // A 30 m tower by the street's west end: that end's roofs 2 m over it.
    const world = street();
    const tall = { ...world, air: new PatrolAir([...world.air.prisms, { ring: rect(0, 7, 18, 20), bottom: 0, top: 30, pad: 1 }], []) };
    const lanes = planPatrolLanes(tall);
    const west = lanes[0]!.points[0]!.x < lanes[0]!.points.at(-1)!.x ? 0 : 1;
    expect(lanes[0]!.roofs[west]).toBeCloseTo(30 + ROOF_ROOM, 6);
    expect(lanes[0]!.roofs[1 - west]).toBe(PATROL_CEILING);
    // A canyon drone lane at 20 m over the west half (the columns reach far over it): no end under it.
    const canyon: DroneLane = { points: Array.from({ length: 26 }, (_, i) => ({ x: i * 4, z: 0 })), levels: Array.from({ length: 26 }, () => 20), length: 100, seed: 1 };
    const under = planPatrolLanes(tall, [canyon]);
    for (const l of under) for (const end of [l.points[0]!, l.points.at(-1)!]) expect(end.x).toBeGreaterThan(100);
  });
});

describe("low patrol views (ADR-0058 stage 7b)", () => {
  it("draw the patrols in the drones' one mesh, their searchlight down to the paving, none on a phone", () => {
    const setup = (quality: "high" | "low") => {
      const scene = new Scene(new NullEngine());
      const kit = new CityKit(scene, new ToonMaterials(scene), null, kitData, { labels: false });
      const world = { ...street(), surfaceAt: (x: number) => 2 + (x - 40) * 0.01 };
      const patrol = lane(80, 2);
      const views = new DroneViews({ scene, kit: () => kit, props: () => props, world: () => null, patrolWorld: () => world, patrolPlan: () => [patrol], eye: () => ({ x: 40, y: 2, z: 10 }), quality });
      return { scene, views };
    };
    const { scene, views } = setup("high");
    views.update(0.016, false);
    expect(views.stats.patrols).toBe(1);
    // Step until it is low over the lane.
    let pose = views.patrolPoses()[0];
    for (let i = 0; i < 4000 && !(pose && pose.y - pose.ground < PATROL_ALTITUDE + 0.2); i++) {
      views.update(0.25, false);
      pose = views.patrolPoses()[0];
    }
    expect(pose).toBeTruthy();
    expect(views.stats.patrolsDrawn).toBe(1);
    const meshes = scene.meshes.filter((m) => m.name === "drones");
    expect(meshes).toHaveLength(1);
    const pos = meshes[0]!.getVerticesData("position")!;
    // The patrol's slot round it (the empty slots lie folded at the origin): its pool's points lie on
    // the sloping paving, each just over it, not flat at the height under the drone.
    let pool = 0;
    for (let i = 0; i < pos.length; i += 3) {
      if (Math.hypot(pos[i]! - pose!.x, pos[i + 2]! - pose!.z) > 4 || pos[i + 1]! > pose!.y - 2) continue;
      pool++;
      // Read the highest round it (`pavingAt`): on this slope, the paving `PAVING_READ` uphill.
      expect(pos[i + 1]!).toBeCloseTo(2 + (pos[i]! + PAVING_READ - 40) * 0.01 + POOL_LIFT, 4);
    }
    expect(pool).toBeGreaterThan(POOL_SEGMENTS);
    // Frozen, it holds still.
    const before = views.patrolPoses();
    views.update(1, true);
    expect(views.patrolPoses()).toEqual(before);
    const phone = setup("low");
    phone.views.update(0.016, false);
    expect(phone.views.stats).toMatchObject({ patrols: 0, meshes: 0 });
    expect(PATROL_LOD.low.nearSlots + PATROL_LOD.low.farSlots).toBe(0);
  });
});
