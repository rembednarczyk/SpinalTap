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
import { MIN_AGL } from "../src/renderer/drones/drone-lanes";
import { DroneViews, PATROL_LOD } from "../src/renderer/drones/drone-views";
import { PatrolAir } from "../src/renderer/drones/patrol-air";
import {
  BEAM_FROM,
  PATROL_ALTITUDE,
  PATROL_BOB,
  PATROL_CEILING,
  PATROL_COUNT,
  PATROL_PAUSE,
  PATROL_SCALE,
  PATROL_SIZE,
  type PatrolLane,
  patrolCycle,
  patrolFleet,
  patrolOf,
  patrolPose,
} from "../src/renderer/drones/patrol-flight";
import { MIN_LANE, type PatrolWorld, planPatrolLanes } from "../src/renderer/drones/patrol-lanes";
import { POOL_SEGMENTS, patrolTemplates } from "../src/renderer/drones/patrol-models";
import { POOL_LIFT } from "../src/renderer/drones/patrol-pool";
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
  return { points: Array.from({ length: n + 1 }, (_, i) => ({ x: i * 4, z: 0 })), grounds: Array.from({ length: n + 1 }, () => ground), length, seed, quiet };
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
  it("comes down from the ceiling, flies the lane over the heads, hangs, climbs away and stays away a while", () => {
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
        if (prev) flights++;
        prev = q;
        continue;
      }
      expect(q.y - q.ground).toBeGreaterThanOrEqual(PATROL_ALTITUDE - PATROL_BOB - 1e-6);
      expect(q.y - q.ground).toBeLessThanOrEqual(PATROL_CEILING + PATROL_BOB + 1e-6);
      expect(q.ground).toBe(3);
      if (q.y - q.ground < PATROL_ALTITUDE + PATROL_BOB + 1e-6) low += dt;
      if (prev) expect(Math.hypot(q.x - prev.x, q.y - prev.y, q.z - prev.z)).toBeLessThan(0.3);
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
    // Its climb ends under the canyon drones' lowest level.
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
      expect(pos[i + 1]!).toBeCloseTo(2 + (pos[i]! - 40) * 0.01 + POOL_LIFT, 4);
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
