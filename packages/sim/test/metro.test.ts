import { describe, expect, it } from "vitest";
import { type SaveSnapshot, type Vec3, metroFare, metroRideSeconds } from "@seki/core";
import {
  CONTRACT_SITE_SPAWNS,
  ENCOUNTERS,
  KIOSK_SIZE,
  METRO_STATIONS,
  SCHEDULES,
  SECURITY_ENTRIES,
  SIM_HZ,
  Simulation,
  WORLD_NAV,
  WORLD_STASHES,
  metroStation,
  stateHash,
} from "../src";
import { lineOfSight } from "../src/world/hitscan";
import { circleTouchesPrism } from "../src/world/prism";
import { collect, input, run, teleportPlayer } from "./helpers";

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** A world with the player at `p` and the chunks around loaded. */
const sceneAt = (p: Vec3, seed = 5): Simulation => {
  const sim = Simulation.create({ seed });
  teleportPlayer(sim, p);
  run(sim, 2);
  return sim;
};

/** Distance from a point to a segment, horizontally. */
const toSegment = (p: Vec3, a: Vec3, b: Vec3): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = dx * dx + dz * dz;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len));
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz));
};

/** Every point other content relies on: routes, posts, entries, graph nodes, stashes, encounters. */
const busyPoints = (): Vec3[] => [
  ...Object.values(CONTRACT_SITE_SPAWNS).flat(),
  ...SECURITY_ENTRIES,
  ...WORLD_NAV.nodes.map((n) => n.at),
  ...WORLD_STASHES.map((s) => s.at),
  ...ENCOUNTERS.map((e) => ({ x: e.at.x, y: 0, z: e.at.z })),
];

describe("metro platforms (ADR-0034)", () => {
  it.each(METRO_STATIONS.map((s) => [s.id, s] as const))("%s: a kiosk against a wall, off every street, route and graph node", (_id, s) => {
    const sim = sceneAt(s.arrival);
    const kiosk = [...sim.world].find((e) => e.interactable?.kind === "metro" && e.interactable.station === s.id)!;
    expect(kiosk.solid).toBeDefined();
    const box = kiosk.solid!;
    // A building of the map (ADR-0045) is its prisms, not the box round them.
    const overlaps = [...sim.world].filter((e) => {
      if (!e.solid || e === kiosk) return false;
      if (e.prisms) return e.prisms.some((p) => p.bottom < box.max.y && p.top > box.min.y && circleTouchesPrism(p, s.kiosk.x, s.kiosk.z, KIOSK_SIZE.z / 2 - 0.05));
      const b = e.solid;
      return b.min.x < box.max.x && b.max.x > box.min.x && b.min.z < box.max.z && b.max.z > box.min.z && b.min.y < box.max.y && b.max.y > box.min.y;
    });
    expect(overlaps).toEqual([]);
    // Its back is to a wall: a solid within 0.1 m behind it.
    const back = { x: s.kiosk.x - Math.sin(s.yaw) * (KIOSK_SIZE.z / 2 + 0.1), y: 1, z: s.kiosk.z - Math.cos(s.yaw) * (KIOSK_SIZE.z / 2 + 0.1) };
    expect(lineOfSight(sim.world, { ...back, y: s.kiosk.y + 0.5 }, { ...back, y: s.kiosk.y + 1.5 })).toBe(false);
    // The rider comes up on open ground, with room to walk away.
    for (const [dx, dz] of [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.4]] as const) {
      const p = { x: s.arrival.x + dx, y: 0, z: s.arrival.z + dz };
      expect(lineOfSight(sim.world, { ...p, y: s.arrival.y + 0.3 }, { ...p, y: s.arrival.y + 1.7 })).toBe(true);
    }
    // Nothing anyone else uses is within 3 m of the kiosk or the arrival point.
    for (const p of busyPoints()) {
      expect(flat(p, s.kiosk), `${p.x},${p.z}`).toBeGreaterThan(3);
      expect(flat(p, s.arrival), `${p.x},${p.z}`).toBeGreaterThan(3);
    }
    // No daily plan walks through it.
    for (const def of Object.values(SCHEDULES)) {
      for (let i = 0; i < def.stops.length; i++) {
        const stop = def.stops[i]!;
        const prev = def.stops[(i + def.stops.length - 1) % def.stops.length]!;
        const path = [prev.path[prev.path.length - 1]!, ...stop.path];
        for (let k = 1; k < path.length; k++) expect(toSegment(s.kiosk, path[k - 1]!, path[k]!)).toBeGreaterThan(2);
      }
    }
  });
});

const atKiosk = (sim: Simulation, id: Parameters<typeof metroStation>[0]) => {
  const s = metroStation(id);
  teleportPlayer(sim, s.arrival, s.yaw + Math.PI);
  run(sim, 2);
};

describe("riding the metro (ADR-0034)", () => {
  it("the kiosk opens the line map for its station", () => {
    const sim = Simulation.create({ seed: 2 });
    const started = collect<{ kind: string; station?: string }>(sim, "InteractionStarted");
    atKiosk(sim, "shinsekai");
    sim.step(input({ interact: true }));
    expect(started).toEqual([expect.objectContaining({ kind: "metro", station: "shinsekai", dialogueId: "metro_shinsekai" })]);
    expect(sim.session.dialogueActive).toBe(true);
  });

  it("refuses away from a kiosk, to the same station, without the fare and on a watched platform", () => {
    const sim = Simulation.create({ seed: 2 });
    const refused = collect<{ reason: string }>(sim, "MetroRefused");
    sim.enqueue({ type: "travel-metro", to: "kanal" });
    run(sim, 1);
    atKiosk(sim, "shinsekai");
    sim.enqueue({ type: "travel-metro", to: "shinsekai" });
    run(sim, 1);
    const snap = sim.snapshot(null, "t", "");
    const poor = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, wallet: { eddies: 5 } } });
    const poorRefused = collect<{ reason: string }>(poor, "MetroRefused");
    poor.enqueue({ type: "travel-metro", to: "doki" });
    run(poor, 1);
    const job = { id: "c2", kind: "eliminate", siteId: "east_lot", targets: 2, reward: 400, status: "active" } as const;
    const hot = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, contracts: { active: job, completed: 1 }, heat: { ...snap.domain.heat, level: 1, faction: "hebi" } } });
    const hotRefused = collect<{ reason: string }>(hot, "MetroRefused");
    hot.enqueue({ type: "travel-metro", to: "doki" });
    run(hot, 1);
    expect(refused.map((r) => r.reason)).toEqual(["not-at-kiosk", "same-station"]);
    expect(poorRefused.map((r) => r.reason)).toEqual(["funds"]);
    expect(hotRefused.map((r) => r.reason)).toEqual(["watched"]);
    expect(hot.domain.wallet.eddies).toBe(snap.domain.wallet.eddies);
  });

  it("takes the player off the street, streams the destination in and brings them up on its platform", () => {
    const sim = Simulation.create({ seed: 2 });
    atKiosk(sim, "shinsekai");
    const departed = collect<{ from: string; to: string; seconds: number }>(sim, "MetroDeparted");
    const arrived = collect<{ station: string }>(sim, "MetroArrived");
    const before = sim.domain.wallet.eddies;
    const clock = sim.clock.seconds;
    sim.enqueue({ type: "travel-metro", to: "doki" });
    run(sim, 1);
    expect(departed).toEqual([{ from: "shinsekai", to: "doki", seconds: metroRideSeconds("shinsekai", "doki") }]);
    expect(sim.domain.wallet.eddies).toBe(before - metroFare("shinsekai", "doki"));
    expect(sim.player()).toBeUndefined();
    expect(sim.domain.metro.ride).toMatchObject({ from: "shinsekai", to: "doki" });
    run(sim, 3);
    expect(sim.streamer.isLoaded("nabrzeze-1-1")).toBe(true);
    run(sim, metroRideSeconds("shinsekai", "doki") * SIM_HZ);
    expect(arrived).toEqual([{ station: "doki" }]);
    const p = sim.player()!;
    expect(flat(p.position, metroStation("doki").arrival)).toBeLessThan(0.5);
    expect(sim.district).toBe("doki");
    // The world went on meanwhile.
    expect(sim.clock.seconds).toBeGreaterThan(clock + 60 * metroRideSeconds("shinsekai", "doki") - 60);
    expect(sim.domain.metro.ride).toBeNull();
  });

  it("a game saved in the carriage loads in it and arrives on the same step", () => {
    const sim = Simulation.create({ seed: 4 });
    atKiosk(sim, "kanal");
    sim.enqueue({ type: "travel-metro", to: "targ" });
    run(sim, 60);
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "ride", "")));
    expect(hash(loaded)).toBe(hash(sim));
    run(loaded, 1);
    expect(loaded.player()).toBeUndefined();
    const arrivals = [collect(sim, "MetroArrived"), collect(loaded, "MetroArrived")];
    for (let i = 0; i < metroRideSeconds("kanal", "targ") * SIM_HZ; i++) {
      sim.step();
      if (i > 0) loaded.step();
    }
    expect(arrivals.map((a) => a.length)).toEqual([1, 1]);
    expect(hash(loaded)).toBe(hash(sim));
    expect(loaded.district).toBe("targ");
  });
});
