import { describe, expect, it } from "vitest";
import { type DomainEvents, type DomainState, type HeatState, QUICKHACKS, type SaveSnapshot } from "@seki/core";
import { type Entity, SIM_HZ, Simulation, gangerEntity } from "../src";
import { ALLEY_START, alleySim, collect, input } from "./helpers";

/**
 * A quickhack saved in the middle of its upload into one of the heat's reinforcements (G-194):
 * they have no key and a loaded game gives them other ids (bags take new ones on loading), so the
 * upload must go on into the same one or be cut off, never land in another.
 */

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const HEAT: HeatState = { level: 2, faction: "hebi", searching: true, lastKnown: ALLEY_START, searchLeft: 30, cooldown: 0 };

const security = (sim: Simulation, n: number): Entity => sim.world.with("security").entities.find((e) => e.security.n === n)!;

const lookAt = (sim: Simulation, e: Entity): void => {
  const me = sim.player()!;
  const dx = e.position.x - me.position.x;
  const dz = e.position.z - me.position.z;
  me.yaw = Math.atan2(dx, dz);
  me.pitch = Math.atan2(me.position.y + 1.62 - (e.position.y + 1.25), Math.hypot(dx, dz));
};

/**
 * A bag lying by the player before the heat comes up, then two reinforcements, then `ping` into
 * the first: saved, its id is the bag's + 1, which the loaded game gives the second.
 */
const midUpload = (): { snap: SaveSnapshot; ids: readonly number[] } => {
  const fresh = alleySim({ seed: 21 }).snapshot(null, "t", "");
  const bag = { key: "drop:g194", position: ALLEY_START, chunk: "", expiresAtTick: 1e9, lines: [] };
  const sim = Simulation.fromSnapshot(roundTrip({ ...fresh, domain: { ...fresh.domain, loot: { ...fresh.domain.loot, containers: [bag] } } }));
  sim.step();
  const holder = sim as unknown as { holder: { domain: DomainState } };
  holder.holder.domain = { ...holder.holder.domain, heat: HEAT };
  for (let i = 0; i < 20 * SIM_HZ && sim.world.with("security").entities.length < 2; i++) sim.step();
  expect(sim.world.with("security").entities).toHaveLength(2);
  lookAt(sim, security(sim, 1));
  sim.step(input({ scan: true, quickhack: 1 }));
  expect(sim.domain.netrun.upload?.hackId).toBe("ping");
  return { snap: roundTrip(sim.snapshot(null, "t", "")), ids: [security(sim, 1).id, security(sim, 2).id] };
};

interface Outcome {
  readonly applied: readonly DomainEvents["QuickhackApplied"][];
  readonly failed: readonly DomainEvents["QuickhackFailed"][];
  readonly loaded: Simulation;
}

/** Loads `snap` and holds the scanner on the `n`-th reinforcement until the upload would land. */
const scanAfterLoad = (snap: SaveSnapshot, n: number): Outcome => {
  const loaded = Simulation.fromSnapshot(snap);
  const applied = collect<DomainEvents["QuickhackApplied"]>(loaded, "QuickhackApplied");
  const failed = collect<DomainEvents["QuickhackFailed"]>(loaded, "QuickhackFailed");
  // The two stand in a line from the player, the second at the end of the scanner's range: the
  // one scanned comes nearer, the other steps aside, out of the scanner's cone.
  const place = (e: Entity, dx: number, dz: number): void => {
    e.position = { x: ALLEY_START.x + dx, y: e.position.y, z: ALLEY_START.z + dz };
    e.prevPosition = { ...e.position };
  };
  place(security(loaded, n), 12, -1.5);
  place(security(loaded, 3 - n), 16, 6);
  for (let i = 0; i < Math.ceil(QUICKHACKS.ping.upload * SIM_HZ) + 2; i++) {
    lookAt(loaded, security(loaded, n));
    loaded.step(input({ scan: true }));
    expect(loaded.session.watch.focus).toBe(security(loaded, n).id);
  }
  return { applied, failed, loaded };
};

const pinged = (sim: Simulation, n: number): number => security(sim, n).hackFx?.pinged ?? 0;

describe("an upload into a reinforcement, saved and loaded (G-194)", () => {
  it("the loaded game gives the second reinforcement the first one's old id", () => {
    const { snap, ids } = midUpload();
    const loaded = Simulation.fromSnapshot(snap);
    loaded.step();
    expect(security(loaded, 2).id).toBe(ids[0]);
  });

  it("is saved by the reinforcement's place in the heat, not by its id", () => {
    expect(midUpload().snap.domain.netrun.upload?.target).toBe("security:1");
  });

  it("goes on into the same one and lands on it", () => {
    const { applied, failed, loaded } = scanAfterLoad(midUpload().snap, 1);
    expect(failed).toEqual([]);
    expect(applied).toEqual([{ hackId: "ping", targetId: security(loaded, 1).id, duration: QUICKHACKS.ping.duration }]);
    expect(pinged(loaded, 1)).toBeGreaterThan(0);
  });

  it("never lands in the other one, which holds the old id now: scanning that cuts it off", () => {
    const { applied, failed, loaded } = scanAfterLoad(midUpload().snap, 2);
    expect(applied).toEqual([]);
    expect(failed.map((f) => f.reason)).toEqual(["lost-target"]);
    expect(pinged(loaded, 2)).toBe(0);
    expect(loaded.domain.netrun.upload).toBeNull();
  });

  it("an older save naming it by `#<id>` is cut off on loading, never landing in the one with that id now", () => {
    const { snap, ids } = midUpload();
    const upload = { ...snap.domain.netrun.upload!, target: `#${ids[0]}` };
    const old = { ...snap, domain: { ...snap.domain, netrun: { ...snap.domain.netrun, upload } } };
    for (const n of [1, 2]) {
      const { applied, failed, loaded } = scanAfterLoad(old, n);
      expect(applied).toEqual([]);
      expect(failed.map((f) => f.reason)).toEqual(["lost-target"]);
      expect(loaded.domain.netrun.ram).toBeCloseTo(snap.domain.netrun.ram + QUICKHACKS.ping.ram / 2, 9);
    }
  });

  it("an unkeyed one goes by its id in the session that started the upload, and lands", () => {
    const sim = alleySim({ seed: 21 });
    sim.step();
    const g = gangerEntity(90020, { key: "", position: { ...ALLEY_START, x: ALLEY_START.x + 12, z: ALLEY_START.z - 1.5 }, yaw: 0 }, null, 110, "");
    delete g.key;
    sim.world.add(g);
    const applied = collect<DomainEvents["QuickhackApplied"]>(sim, "QuickhackApplied");
    lookAt(sim, g);
    sim.step(input({ scan: true, quickhack: 1 }));
    expect(sim.domain.netrun.upload?.target).toBe("#90020");
    for (let i = 0; i < Math.ceil(QUICKHACKS.ping.upload * SIM_HZ) + 1; i++) sim.step(input({ scan: true }));
    expect(applied.map((a) => a.targetId)).toEqual([90020]);
  });
});
