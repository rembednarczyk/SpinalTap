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
} from "../src";
import type { Entity } from "../src";
import { asideFor } from "../src/systems/ai/crowd-walk";
import { byKey, input, run, teleportPlayer } from "./helpers";

vi.setConfig({ testTimeout: 30_000 });

const at = (x: number, z: number) => ({ x, y: 0, z });
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

/** Solids at foot level: what a walker would bump into. */
const solids = WORLD_CHUNKS.flatMap((c) => c.props.flatMap((p) => (p.solid && p.view.kind === "block" ? [aabbFromCenter(p.center, p.view.size)] : []))).filter(
  (b) => b.max.y > 0.3 && b.min.y < 1.8,
);
const clearance = (x: number, z: number) =>
  Math.min(...solids.map((b) => Math.hypot(Math.max(b.min.x - x, 0, x - b.max.x), Math.max(b.min.z - z, 0, z - b.max.z))));

describe("sidewalks (ADR-0041)", () => {
  it("lie in their chunk, flat and low, and every crossing joins two of them across a road", () => {
    expect(SIDEWALK_HEIGHT).toBeLessThan(0.2);
    for (const w of SIDEWALKS) {
      const b = WORLD_CHUNKS.find((c) => c.id === w.chunk)!.bounds;
      expect(w.minX >= b.minX && w.maxX <= b.maxX && w.minZ >= b.minZ && w.maxZ <= b.maxZ, `${w.chunk} ${w.minX},${w.minZ}`).toBe(true);
      expect(w.maxX - w.minX).toBeGreaterThan(1);
      expect(w.maxZ - w.minZ).toBeGreaterThan(1);
    }
    for (const c of CROSSINGS) expect(WORLD_CHUNKS.some((k) => k.id === c.chunk)).toBe(true);
    expect(new Set(SIDEWALKS.map((w) => w.chunk))).toEqual(new Set(["shinsekai-7", "kanal", "targ-south", "targ-north", "doki-yard", "doki-quay"]));
    expect(onSidewalk(-6, 0)).toBe(true);
    expect(onSidewalk(0, 0)).toBe(false);
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

  it("both sides of every route stay clear of the walls, the stalls and the parked cars", () => {
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
  it("the market is full in the evening, the docks are empty at night, Shinsekai lives at night", () => {
    const high = CROWD_CAP.high;
    expect(crowdCount("targ-south", high, clockAt(19))).toBe(high);
    expect(crowdCount("targ-south", high, clockAt(3))).toBeLessThan(3);
    expect(crowdCount("doki-quay", high, clockAt(23))).toBe(0);
    expect(crowdCount("doki-quay", high, clockAt(10))).toBeGreaterThan(4);
    expect(crowdCount("shinsekai-7", high, clockAt(22))).toBe(high);
    expect(crowdCount("shinsekai-7", high, clockAt(5))).toBeLessThan(crowdCount("shinsekai-7", high, clockAt(22)) / 3);
    // Phones: a few per chunk at most.
    for (const chunk of Object.keys(CROWD_CHUNKS)) for (let h = 0; h < 24; h++) expect(crowdCount(chunk, CROWD_CAP.low, clockAt(h))).toBeLessThanOrEqual(4);
    expect(crowdCount("shinsekai-7", CROWD_CAP.off, clockAt(22))).toBe(0);
    expect(crowdCount("nowhere", high, clockAt(22))).toBe(0);
  });

  it("who a resident is depends on the seed, the chunk and its index only; nobody indoors carries an umbrella", () => {
    const a = residentOf(7, "shinsekai-7", 4);
    expect(residentOf(7, "shinsekai-7", 4)).toBe(a);
    expect(residentOf(8, "shinsekai-7", 4)?.look).not.toBe(a?.look);
    const all = Array.from({ length: 200 }, (_, seed) => Array.from({ length: CROWD_CAP.high }, (_, i) => residentOf(seed, "shinsekai-7", i)!)).flat();
    const indoor = all.filter((r) => r.role.kind === "stander" && r.role.spot.indoor);
    expect(indoor.length).toBeGreaterThan(0);
    expect(indoor.every((r) => !r.umbrella)).toBe(true);
    const outdoor = all.filter((r) => !(r.role.kind === "stander" && r.role.spot.indoor));
    const share = outdoor.filter((r) => r.umbrella).length / outdoor.length;
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.45);
    // A third stands, the rest walk, both ways round the routes.
    const roles = Array.from({ length: CROWD_CAP.high }, (_, i) => residentOf(3, "targ-south", i)!.role);
    expect(roles.filter((r) => r.kind === "stander")).toHaveLength(4);
    const walkers = roles.flatMap((r) => (r.kind === "walker" ? [r] : []));
    expect(new Set(walkers.map((w) => `${w.lane.id}:${w.dir}`)).size).toBe(4);
    // Without a route a chunk's residents all stand, as many as there are spots.
    expect(residentOf(3, "doki-yard", 0)?.role.kind).toBe("stander");
    expect(residentOf(3, "doki-yard", 5)).toBeNull();
  });

  it("walkers one way round a lane keep apart and never catch up", () => {
    const groups = new Map<string, { phase: number; speed: number; length: number }[]>();
    for (let i = 0; i < CROWD_CAP.high; i++) {
      const r = residentOf(12, "shinsekai-7", i)!.role;
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
  it("is not there without a crowd density, and is there with one: residents of the night in Shinsekai", () => {
    const none = Simulation.create({ seed: 4 });
    run(none, 2);
    expect(residents(none)).toHaveLength(0);
    const sim = Simulation.create({ seed: 4, crowd: "high" });
    run(sim, 2);
    const here = residents(sim, "shinsekai-7");
    expect(here).toHaveLength(crowdCount("shinsekai-7", CROWD_CAP.high, sim.clock));
    for (const r of here) {
      expect(r.id).toBeGreaterThanOrEqual(CROWD_ID_BASE);
      expect(r.key).toBeUndefined();
      expect(r.health).toBeUndefined();
    }
    const low = Simulation.create({ seed: 4, crowd: "low" });
    run(low, 2);
    expect(residents(low, "shinsekai-7").length).toBeLessThanOrEqual(CROWD_CAP.low);
  });

  it("walkers go round their route on their own side, standers stand at their spot doing something", () => {
    const sim = Simulation.create({ seed: 6, crowd: "high" });
    teleportPlayer(sim, at(0, -30), 0);
    run(sim, 2);
    const walkers = residents(sim, "shinsekai-7").filter((r) => r.passerby?.lane);
    const standers = residents(sim, "shinsekai-7").filter((r) => !r.passerby?.lane);
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
    teleportPlayer(sim, at(0, 0), 0);
    run(sim, 2);
    const reacted: DomainEvents["CrowdReacted"][] = [];
    sim.bus.on("CrowdReacted", (e) => reacted.push(e));
    sim.player()!.pitch = -0.6;
    sim.step(input({ fire: true }));
    run(sim, 2);
    // The shooter walks off, so nobody stays pinned down by a gun pointed at them.
    teleportPlayer(sim, at(0, -34), Math.PI);
    const near = residents(sim, "shinsekai-7").filter((r) => flat(r.position, at(0, 0)) < 15);
    expect(near.length).toBeGreaterThan(0);
    expect(reacted.some((e) => e.entityId >= CROWD_ID_BASE)).toBe(true);
    expect(near.some((r) => r.civilian?.crowd?.state !== "calm")).toBe(true);
    run(sim, 40 * SIM_HZ);
    for (const r of residents(sim, "shinsekai-7")) {
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
    teleportPlayer(sim, at(10, 135), Math.PI);
    run(sim, 5);
    const day = residents(sim, "doki-quay").length;
    expect(day).toBeGreaterThan(3);
    skipTo(sim, hm(23));
    run(sim, 2 * SIM_HZ);
    expect(residents(sim, "doki-quay").length).toBeLessThan(day);
    // Far from anyone's eyes they are all gone after a while.
    teleportPlayer(sim, at(-30, 100), 0);
    run(sim, 2 * SIM_HZ);
    expect(residents(sim, "doki-quay")).toHaveLength(0);
  });

  it("does not change the saved state: same hash with and without, out of the save, back after a load", () => {
    const frames = (sim: Simulation) => {
      for (let i = 0; i < 20 * SIM_HZ; i++) sim.step(input({ moveZ: 1, lookYaw: i % 200 < 100 ? 0.003 : -0.003, fire: i % 90 === 0 }));
    };
    const plain = Simulation.create({ seed: 31 });
    const busy = Simulation.create({ seed: 31, crowd: "high" });
    teleportPlayer(plain, at(0, -25));
    teleportPlayer(busy, at(0, -25));
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
    teleportPlayer(sim, at(-5, -30), 0);
    run(sim, 2);
    const r = residents(sim, "shinsekai-7").find((e) => e.passerby?.lane)!;
    // Hold one in the doorway's sensor for a while.
    for (let i = 0; i < 60; i++) {
      r.position = at(6.2, 1.5);
      sim.step();
    }
    const door = [...sim.world].find((e) => e.door?.key === "koi-door" || (e.door && Math.abs(e.position.x - 7.15) < 0.3));
    expect(door?.door?.open ?? 0).toBe(0);
    expect(byKey(sim, "player")).toBeDefined();
  });
});
