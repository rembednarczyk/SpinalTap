import { describe, expect, it, vi } from "vitest";
import { type DomainEvents, type SaveSnapshot, hm } from "@seki/core";
import {
  ACTIVITY_SPOTS,
  CROSSINGS,
  CROWD_BY_HOUR,
  CROWD_CAP,
  CROWD_CHUNKS,
  CROWD_ID_BASE,
  CROWD_LANES,
  CROWD_SPOTS,
  LANE_HALF_GAP,
  SIDEWALKS,
  SIDEWALK_HEIGHT,
  SIM_HZ,
  Simulation,
  WORLD_CHUNKS,
  aabbFromCenter,
  crowdCount,
  laneGeom,
  lanePoint,
  laneTarget,
  nearestArc,
  onSidewalk,
  residentOf,
  roundCorners,
  stateHash,
  ROOM_SITES,
  WORLD_SCENERY,
  docks,
  ground,
  groundY,
  inBuilding,
  koiPoint,
  nearestWall,
} from "../src";

/** The chunks of Lublin with the market and the docks (ADR-0045). */
const MARKET = "podzamcze-1-0";
const DOCKS = "nabrzeze-1-1";
import type { Entity } from "../src";
import { asideFor } from "../src/systems/ai/crowd-walk";
import { furnitureClearance } from "../src/content/crowd";
import { byKey, input, run, teleportPlayer } from "./helpers";

vi.setConfig({ testTimeout: 30_000 });

const at = (x: number, z: number) => ({ x, y: 0, z });
/** The deptak between the clinic and Neon Koi (ADR-0045), and the chunk it lies in. */
const DEPTAK = ground(300, -84);
const S7 = "krakowskie-2-0";
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));
const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const clockAt = (hour: number) => ({ seconds: hour * 3600 });

const residents = (sim: Simulation, chunk?: string): Entity[] =>
  [...sim.world].filter((e) => e.view?.kind === "crowd" && (chunk === undefined || e.chunk === chunk)).sort((a, b) => a.id - b.id);

const skipTo = (sim: Simulation, minute: number) => {
  const now = Math.floor((sim.clock.seconds % 86400) / 60);
  const minutes = (minute - now + 1440) % 1440;
  if (minutes > 0) sim.enqueue({ type: "wait", minutes });
  sim.step();
};

/** Solids at foot level: what a walker would bump into (blocks above their ground, ADR-0045). */
const solids = WORLD_CHUNKS.flatMap((c) =>
  c.props.flatMap((p) => {
    if (!p.solid || p.view.kind !== "block") return [];
    const b = aabbFromCenter(p.center, p.view.size);
    const floor = groundY(p.center.x, p.center.z);
    return b.max.y > floor + 0.3 && b.min.y < floor + 1.8 ? [b] : [];
  }),
);
/** In a room cut into a tenement (ADR-0045): its own shell of blocks are its walls. */
const inRoom = (x: number, z: number) => ROOM_SITES.some((r) => x >= r.rect.minX && x <= r.rect.maxX && z >= r.rect.minZ && z <= r.rect.maxZ);
/** Distance to the nearest solid: a block, a piece of street furniture (ADR-0050), or a wall of the map's buildings (0 inside one). */
const clearance = (x: number, z: number) =>
  Math.min(
    inRoom(x, z) ? Infinity : inBuilding(x, z) ? 0 : nearestWall(x, z).d,
    furnitureClearance(x, z),
    ...solids.map((b) => Math.hypot(Math.max(b.min.x - x, 0, x - b.max.x), Math.max(b.min.z - z, 0, z - b.max.z))),
  );

describe("sidewalks (ADR-0041, ADR-0045)", () => {
  it("come from the map in Lublin: the game keeps no hand-made strips of its own", () => {
    expect(SIDEWALK_HEIGHT).toBeLessThan(0.2);
    expect(SIDEWALKS).toEqual([]);
    expect(CROSSINGS).toEqual([]);
    expect(onSidewalk(DEPTAK.x, DEPTAK.z)).toBe(false);
    // The map's own sidewalks and squares are the scenery's surfaces.
    const surfaces = new Set(WORLD_SCENERY.flatMap((s) => (s.view.kind === "ground" ? [s.view.surface] : [])));
    for (const s of ["sidewalk", "footway", "square", "road"]) expect(surfaces.has(s as never), s).toBe(true);
  });
});

describe("routes and spots of the crowd", () => {
  it("rounded corners keep the route closed and close to its polygon", () => {
    const pts = roundCorners([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
    expect(pts.length).toBe(15);
    const g = laneGeom({ id: "t-square", chunk: "x", points: [[0, 0], [10, 0], [10, 10], [0, 10]] });
    expect(g.length).toBeGreaterThan(37);
    expect(g.length).toBeLessThan(40);
    const s = nearestArc(g, 5, -2);
    expect(lanePoint(g, s)).toMatchObject({ z: 0, tx: 1, tz: 0 });
    expect(lanePoint(g, s).x).toBeCloseTo(5);
    expect(lanePoint(g, s + g.length).x).toBeCloseTo(5);
    expect(lanePoint(g, s - 3 * g.length).x).toBeCloseTo(5);
  });

  it("both sides of every route stay clear of the walls, the stalls, the parked cars and the street furniture", () => {
    for (const lane of CROWD_LANES) {
      const g = laneGeom(lane);
      for (let s = 0; s < g.length; s += 0.5) {
        for (const dir of [1, -1] as const) {
          const t = laneTarget(lane, { phase: s, speed: 0, dir, shift: 0 }, { seconds: 0 });
          expect(clearance(t.x, t.z), `${lane.id} at ${s.toFixed(1)} (${dir})`).toBeGreaterThan(0.25);
        }
      }
    }
  });

  it("spots stand in their chunk, clear of the solids, the passers-by's spots and the named characters", () => {
    const actors = WORLD_CHUNKS.flatMap((c) => c.actors.map((a) => a.spawn.position)).filter((p) => Math.abs(p.y) < 1);
    for (const s of CROWD_SPOTS) {
      const b = WORLD_CHUNKS.find((c) => c.id === s.chunk)!.bounds;
      const name = `${s.chunk} ${s.at.x},${s.at.z}`;
      expect(s.at.x >= b.minX && s.at.x <= b.maxX && s.at.z >= b.minZ && s.at.z <= b.maxZ, name).toBe(true);
      expect(clearance(s.at.x, s.at.z), name).toBeGreaterThanOrEqual(0.38);
      for (const a of ACTIVITY_SPOTS) expect(flat(a.at, s.at), name).toBeGreaterThan(1.2);
      for (const p of actors) expect(flat(p, s.at), name).toBeGreaterThan(1.2);
    }
  });

  it("every chunk with a crowd has a profile for every hour", () => {
    for (const [chunk, c] of Object.entries(CROWD_CHUNKS)) {
      expect(WORLD_CHUNKS.some((k) => k.id === chunk)).toBe(true);
      expect(CROWD_BY_HOUR[c.profile]).toHaveLength(24);
    }
  });
});

describe("how many and who (ADR-0041)", () => {
  it("the market is full in the evening, the docks are empty at night, the deptak lives at night", () => {
    const high = CROWD_CAP.high;
    expect(crowdCount(MARKET, high, clockAt(19))).toBe(high);
    expect(crowdCount(MARKET, high, clockAt(3))).toBeLessThan(3);
    expect(crowdCount(DOCKS, high, clockAt(23))).toBe(0);
    expect(crowdCount(DOCKS, high, clockAt(10))).toBeGreaterThan(4);
    expect(crowdCount(S7, high, clockAt(22))).toBe(high);
    expect(crowdCount(S7, high, clockAt(5))).toBeLessThan(crowdCount(S7, high, clockAt(22)) / 3);
    // Phones: a few per chunk at most (ADR-0050: six).
    expect(CROWD_CAP.low).toBeLessThanOrEqual(6);
    for (const chunk of Object.keys(CROWD_CHUNKS)) for (let h = 0; h < 24; h++) expect(crowdCount(chunk, CROWD_CAP.low, clockAt(h))).toBeLessThanOrEqual(CROWD_CAP.low);
    expect(crowdCount(S7, CROWD_CAP.off, clockAt(22))).toBe(0);
    expect(crowdCount("nowhere", high, clockAt(22))).toBe(0);
  });

  it("who a resident is depends on the seed, the chunk and its index only; nobody indoors carries an umbrella", () => {
    const a = residentOf(7, S7, 4);
    expect(residentOf(7, S7, 4)).toBe(a);
    expect(residentOf(8, S7, 4)?.look).not.toBe(a?.look);
    const all = Array.from({ length: 200 }, (_, seed) => Array.from({ length: CROWD_CAP.high }, (_, i) => residentOf(seed, S7, i)!)).flat();
    const indoor = all.filter((r) => r.role.kind === "stander" && r.role.spot.indoor);
    expect(indoor.length).toBeGreaterThan(0);
    expect(indoor.every((r) => !r.umbrella)).toBe(true);
    const outdoor = all.filter((r) => !(r.role.kind === "stander" && r.role.spot.indoor));
    const share = outdoor.filter((r) => r.umbrella).length / outdoor.length;
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.45);
    // Two of five stand (ADR-0050), the rest walk, both ways round the routes.
    const roles = Array.from({ length: CROWD_CAP.high }, (_, i) => residentOf(3, MARKET, i)!.role);
    expect(roles.filter((r) => r.kind === "stander")).toHaveLength(Math.floor(CROWD_CAP.high / 5) * 2 + (CROWD_CAP.high % 5 > 1 ? 1 : 0) + (CROWD_CAP.high % 5 > 3 ? 1 : 0));
    const walkers = roles.flatMap((r) => (r.kind === "walker" ? [r] : []));
    // Three routes in the market, both ways round each.
    expect(new Set(walkers.map((w) => `${w.lane.id}:${w.dir}`)).size).toBe(6);
    // A chunk without routes or spots has nobody.
    expect(residentOf(3, "nowhere", 0)).toBeNull();
  });

  it("walkers one way round a lane keep apart and never catch up", () => {
    const groups = new Map<string, { phase: number; speed: number; length: number }[]>();
    for (let i = 0; i < CROWD_CAP.high; i++) {
      const r = residentOf(12, S7, i)!.role;
      if (r.kind !== "walker") continue;
      const key = `${r.lane.id}:${r.dir}`;
      groups.set(key, [...(groups.get(key) ?? []), { phase: r.phase, speed: r.speed, length: laneGeom(r.lane).length }]);
    }
    for (const list of groups.values()) {
      expect(new Set(list.map((w) => w.speed)).size).toBe(1);
      const sorted = list.map((w) => w.phase).sort((a, b) => a - b);
      const length = list[0]!.length;
      for (let i = 0; i < sorted.length; i++) {
        const gap = ((sorted[(i + 1) % sorted.length]! - sorted[i]! + length) % length) || length;
        expect(gap).toBeGreaterThan(8);
      }
    }
  });

  it("a walker steps aside for someone on its line ahead, and back once it is clear", () => {
    const line = { x: 0, z: 0, tx: 0, tz: 1 };
    // Someone 1.5 m ahead, a little to the walker's left (west): it goes right.
    expect(asideFor([{ id: 2, x: -0.2, z: 1.5 }], 1, at(0, 0), line)).toBeCloseTo(-0.42);
    expect(asideFor([{ id: 2, x: 0.3, z: 1.5 }], 1, at(0, 0), line)).toBeCloseTo(0.32);
    expect(asideFor([{ id: 2, x: 0, z: 5 }], 1, at(0, 0), line)).toBe(0);
    expect(asideFor([{ id: 1, x: 0, z: 1 }], 1, at(0, 0), line)).toBe(0);
    expect(asideFor([{ id: 2, x: 1, z: 1 }], 1, at(0, 0), line)).toBe(0);
  });
});

describe("the crowd in the simulation", () => {
  it("is not there without a crowd density, and is there with one: residents of the night on the deptak", () => {
    const none = Simulation.create({ seed: 4 });
    run(none, 2);
    expect(residents(none)).toHaveLength(0);
    const sim = Simulation.create({ seed: 4, crowd: "high" });
    run(sim, 2);
    const here = residents(sim, S7);
    expect(here).toHaveLength(crowdCount(S7, CROWD_CAP.high, sim.clock));
    for (const r of here) {
      expect(r.id).toBeGreaterThanOrEqual(CROWD_ID_BASE);
      expect(r.key).toBeUndefined();
      expect(r.health).toBeUndefined();
    }
    const low = Simulation.create({ seed: 4, crowd: "low" });
    run(low, 2);
    expect(residents(low, S7).length).toBeLessThanOrEqual(CROWD_CAP.low);
  });

  it("walkers go round their route on their own side, standers stand at their spot doing something", () => {
    const sim = Simulation.create({ seed: 6, crowd: "high" });
    teleportPlayer(sim, DEPTAK, 0);
    run(sim, 2);
    const walkers = residents(sim, S7).filter((r) => r.passerby?.lane);
    const standers = residents(sim, S7).filter((r) => !r.passerby?.lane);
    expect(walkers.length).toBeGreaterThan(4);
    expect(standers.length).toBeGreaterThan(0);
    const start = walkers.map((w) => ({ ...w.position }));
    run(sim, 10 * SIM_HZ);
    walkers.forEach((w, i) => {
      // About ten metres in ten seconds, still on the route (unless someone was in the way).
      expect(flat(w.position, start[i]!)).toBeGreaterThan(6);
      const lane = CROWD_LANES.find((l) => l.id === w.passerby!.lane!.lane)!;
      const t = laneTarget(lane, w.passerby!.lane!, sim.clock, w.passerby!.lane!.avoid);
      expect(flat(w.position, t)).toBeLessThan(1.2);
      expect(w.activity).toBeUndefined();
    });
    for (const s of standers) {
      expect(flat(s.position, s.passerby!.goal)).toBeLessThan(0.3);
      expect(s.activity).toBe(s.passerby!.activity);
    }
    expect(LANE_HALF_GAP).toBeGreaterThan(0.2);
  });

  it("a shot sends them running; calm again, they walk back to the route and carry on", () => {
    const sim = Simulation.create({ seed: 8, crowd: "high" });
    teleportPlayer(sim, DEPTAK, Math.PI / 2);
    run(sim, 2);
    const reacted: DomainEvents["CrowdReacted"][] = [];
    sim.bus.on("CrowdReacted", (e) => reacted.push(e));
    sim.player()!.pitch = -0.6;
    sim.step(input({ fire: true }));
    run(sim, 2);
    // The shooter walks off, so nobody stays pinned down by a gun pointed at them.
    teleportPlayer(sim, ground(266, -73), -Math.PI / 2);
    const near = residents(sim, S7).filter((r) => flat(r.position, DEPTAK) < 15);
    expect(near.length).toBeGreaterThan(0);
    expect(reacted.some((e) => e.entityId >= CROWD_ID_BASE)).toBe(true);
    expect(near.some((r) => r.civilian?.crowd?.state !== "calm")).toBe(true);
    run(sim, 40 * SIM_HZ);
    for (const r of residents(sim, S7)) {
      expect(r.civilian?.crowd?.state ?? "calm").toBe("calm");
      const w = r.passerby!.lane;
      if (!w) continue;
      const lane = CROWD_LANES.find((l) => l.id === w.lane)!;
      expect(flat(r.position, laneTarget(lane, w, sim.clock, w.avoid))).toBeLessThan(1.2);
    }
  });

  it("thins out by the hour, and nobody leaves or comes where the player is looking", () => {
    const sim = Simulation.create({ seed: 2, crowd: "high" });
    skipTo(sim, hm(15));
    teleportPlayer(sim, docks(10, 0, 135), Math.PI);
    run(sim, 5);
    const day = residents(sim, DOCKS).length;
    expect(day).toBeGreaterThan(3);
    skipTo(sim, hm(23));
    run(sim, 2 * SIM_HZ);
    expect(residents(sim, DOCKS).length).toBeLessThan(day);
    // Far from anyone's eyes they are all gone after a while.
    teleportPlayer(sim, docks(-30, 0, 100), 0);
    run(sim, 2 * SIM_HZ);
    expect(residents(sim, DOCKS)).toHaveLength(0);
  });

  it("does not change the saved state: same hash with and without, out of the save, back after a load", () => {
    const frames = (sim: Simulation) => {
      for (let i = 0; i < 20 * SIM_HZ; i++) sim.step(input({ moveZ: 1, lookYaw: i % 200 < 100 ? 0.003 : -0.003, fire: i % 90 === 0 }));
    };
    const plain = Simulation.create({ seed: 31 });
    const busy = Simulation.create({ seed: 31, crowd: "high" });
    teleportPlayer(plain, DEPTAK);
    teleportPlayer(busy, DEPTAK);
    frames(plain);
    frames(busy);
    expect(residents(busy).length).toBeGreaterThan(5);
    expect(hash(busy)).toBe(hash(plain));
    const snap = roundTrip(busy.snapshot(null, "t", ""));
    expect(JSON.stringify(snap)).not.toContain(`${CROWD_ID_BASE}`);
    const loaded = Simulation.fromSnapshot(snap, undefined, "high");
    loaded.step();
    busy.step();
    expect(residents(loaded).map((r) => r.id)).toEqual(residents(busy).map((r) => r.id));
  });

  it("residents by the Neon Koi door never open it", () => {
    const sim = Simulation.create({ seed: 3, crowd: "high" });
    teleportPlayer(sim, DEPTAK, 0);
    run(sim, 2);
    const r = residents(sim, S7).find((e) => e.passerby?.lane)!;
    // Hold one in the doorway's sensor for a while.
    for (let i = 0; i < 60; i++) {
      r.position = koiPoint(6.2, 0, 1.5);
      sim.step();
    }
    const door = [...sim.world].find((e) => e.door?.door === "door:neon-koi");
    expect(door).toBeDefined();
    expect(door?.door?.open ?? 0).toBe(0);
    expect(byKey(sim, "player")).toBeDefined();
  });
});
