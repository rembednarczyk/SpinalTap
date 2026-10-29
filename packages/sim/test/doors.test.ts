import { describe, expect, it } from "vitest";
import { type Contract, type SaveSnapshot, type Vec3, SECONDS_PER_HOUR, contractAlarmFlag } from "@seki/core";
import {
  CLINIC_DOOR,
  CLINIC_WAKE_SPOT,
  DOOR_CLOSE_DELAY,
  DOOR_MOVE_TIME,
  FIXER_CLINIC_SPAWN,
  FIXER_SPAWN,
  KOI_DOOR,
  MORI_SPAWN,
  PLAYER_SPAWN,
  SIM_HZ,
  Simulation,
  TESSEN_OFFICE_DOOR,
  type DoorDef,
  type Entity,
  doorParts,
  gangerEntity,
  stateHash,
} from "../src";
import { doorForcedFlag } from "../src/systems/door-system";
import { propEntity } from "../src/world/factory";
import { lineOfSight } from "../src/world/hitscan";
import { byKey, collect, input, run, teleportPlayer } from "./helpers";

const at = (x: number, z: number, y = 0): Vec3 => ({ x, y, z });
const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));

/** The leaves of `door` in the world, in leaf order. */
const leaves = (sim: Simulation, door: DoorDef) =>
  [...sim.world.with("door")].filter((e) => e.door.door === door.key).sort((a, b) => a.door.key.localeCompare(b.door.key));
const openness = (sim: Simulation, door: DoorDef) => leaves(sim, door)[0]?.door.open ?? NaN;

/** A new game with the player at `p`, every AI of the street taken out. */
const quietAt = (p: Vec3, yaw = 0): Simulation => {
  const sim = Simulation.create({ seed: 3 });
  teleportPlayer(sim, p, yaw);
  run(sim, 2);
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return sim;
};

/** A game loaded with `job` running, the player at `p` and the office guards gone. */
const withJob = (job: Contract, p: Vec3, hooks: string[] = []): Simulation => {
  const snap = Simulation.create({ seed: 9 }).snapshot(null, "t", "");
  const player = { ...snap.entities.find((e) => e.key === "player")!, position: p };
  const entities = [...snap.entities.filter((e) => e.key !== "player"), player];
  const clock = { seconds: 21 * SECONDS_PER_HOUR };
  const sim = Simulation.fromSnapshot({ ...snap, entities, domain: { ...snap.domain, clock, contracts: { active: job, completed: 2, hooks } } });
  run(sim, 2);
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return sim;
};
const INFILTRATION: Contract = { id: "c7", kind: "infiltrate", siteId: "tessen_office", targets: 3, reward: 600, status: "active" };

describe("automatic doors (ADR-0038)", () => {
  it("opens for someone in the sensor in about 0.4 s and slides the leaf into the wall", () => {
    const sim = quietAt(at(-3.4, 4.4), -Math.PI / 2);
    expect(openness(sim, CLINIC_DOOR)).toBe(0);
    const [leaf] = leaves(sim, CLINIC_DOOR);
    const closedZ = leaf!.position.z;
    // 2.2 m from the door: still shut. One step closer: it starts to open.
    run(sim, 1, input({ moveZ: 1 }));
    teleportPlayer(sim, at(-5.3, 4.4), -Math.PI / 2);
    run(sim, 1);
    expect(openness(sim, CLINIC_DOOR)).toBeGreaterThan(0);
    run(sim, Math.ceil(DOOR_MOVE_TIME * SIM_HZ));
    expect(openness(sim, CLINIC_DOOR)).toBe(1);
    expect(leaf!.position.z).toBeCloseTo(closedZ - CLINIC_DOOR.width, 5);
    expect(leaf!.solid!.max.z).toBeLessThanOrEqual(3.6 + 1e-6);
  });

  it("walks through, then closes 1.5 s after the sensor empties", () => {
    const sim = quietAt(at(-3, 4.4), -Math.PI / 2);
    // Into the waiting room, through the door.
    run(sim, 2 * SIM_HZ, input({ moveZ: 1 }));
    const p = sim.player()!;
    expect(p.position.x).toBeLessThan(-8);
    // Just inside, in the sensor; then by the reception desk, out of it: open for the delay, then closing.
    teleportPlayer(sim, at(-8.2, 4.4));
    run(sim, Math.ceil(DOOR_MOVE_TIME * SIM_HZ) + 1);
    teleportPlayer(sim, at(-10, 6.6));
    run(sim, Math.floor(DOOR_CLOSE_DELAY * SIM_HZ) - 2);
    expect(openness(sim, CLINIC_DOOR)).toBe(1);
    run(sim, Math.ceil(DOOR_MOVE_TIME * SIM_HZ) + 4);
    expect(openness(sim, CLINIC_DOOR)).toBe(0);
  });

  it("a closed door blocks the way and the line of sight; an open one does neither", () => {
    const sim = quietAt(at(-10, 6.6));
    const outside = at(-4, 4.4, 1.5);
    const inside = at(-10, 4.4, 1.5);
    expect(lineOfSight(sim.world, outside, inside)).toBe(false);
    // NPCs open it too: Mori walks up to it.
    const mori = byKey(sim, "mori")!;
    mori.position = at(-8.2, 4.4);
    run(sim, Math.ceil(DOOR_MOVE_TIME * SIM_HZ) + 1);
    expect(openness(sim, CLINIC_DOOR)).toBe(1);
    expect(lineOfSight(sim.world, outside, inside)).toBe(true);
  });

  it("never closes on a body in the doorway", () => {
    const sim = quietAt(at(-7.15, 4.4));
    run(sim, Math.ceil(DOOR_MOVE_TIME * SIM_HZ) + 1);
    expect(openness(sim, CLINIC_DOOR)).toBe(1);
    // Nobody may open it any more, but the player stands in the opening.
    for (const l of leaves(sim, CLINIC_DOOR)) l.door = { ...l.door, lock: { kind: "code", staff: "tessen", during: "infiltrate" } };
    run(sim, 3 * SIM_HZ);
    expect(openness(sim, CLINIC_DOOR)).toBe(1);
  });

  it("a sealed door stays shut and is a wall for everyone", () => {
    const sim = quietAt(at(0, -20));
    const sealed: DoorDef = { key: "door:test", at: at(0, -16), along: "x", width: 2, height: 2.6, leaves: 2, lock: { kind: "sealed" } };
    doorParts(sealed).forEach((p, i) => sim.world.add(propEntity(9000 + i, p, "shinsekai-7")));
    expect(leaves(sim, sealed).every((l) => l.velocity === undefined)).toBe(true);
    run(sim, 2 * SIM_HZ, input({ moveZ: 1 }));
    expect(openness(sim, sealed)).toBe(0);
    expect(sim.player()!.position.z).toBeLessThan(-16 - 0.38 + 0.01);
  });

  it("the double door of Neon Koi parts from the middle", () => {
    const sim = quietAt(at(6, 1.5), Math.PI / 2);
    run(sim, Math.ceil(DOOR_MOVE_TIME * SIM_HZ) + 1);
    const [a, b] = leaves(sim, KOI_DOOR);
    expect(openness(sim, KOI_DOOR)).toBe(1);
    expect(a!.solid!.max.z).toBeLessThanOrEqual(0.4 + 1e-6);
    expect(b!.solid!.min.z).toBeGreaterThanOrEqual(2.6 - 1e-6);
  });
});

describe("the coded door of Tessen's office (ADR-0038, the hook of ADR-0034)", () => {
  const outside = at(-16.6, 132);

  it("stays shut for the player without the code; a Tessen guard opens it", () => {
    const sim = withJob(INFILTRATION, outside);
    run(sim, SIM_HZ);
    expect(openness(sim, TESSEN_OFFICE_DOOR)).toBe(0);
    const guard = sim.world.add(gangerEntity(9100, { key: "test-guard", position: at(-19.5, 132), yaw: Math.PI / 2 }, null, 100, "doki-quay", undefined, "tessen_guard"));
    guard.ai!.alerted = false;
    run(sim, Math.ceil(DOOR_MOVE_TIME * SIM_HZ) + 1);
    expect(openness(sim, TESSEN_OFFICE_DOOR)).toBe(1);
  });

  it("opens for the player with the code from the hook", () => {
    const sim = withJob(INFILTRATION, outside, ["hook_infiltrate_1"]);
    run(sim, Math.ceil(DOOR_MOVE_TIME * SIM_HZ) + 1);
    expect(openness(sim, TESSEN_OFFICE_DOOR)).toBe(1);
    // The panel has nothing to offer then.
    expect([...sim.world.with("doorPanel")][0]?.interactable).toBeUndefined();
  });

  it("is locked outside the job; during it the panel breaks the lock and raises the alarm", () => {
    const idle = withJob({ ...INFILTRATION, kind: "hack", siteId: "quay_terminal" }, outside);
    run(idle, 2);
    expect(openness(idle, TESSEN_OFFICE_DOOR)).toBe(0);
    idle.step(input({ interact: true }));
    run(idle, SIM_HZ);
    expect(openness(idle, TESSEN_OFFICE_DOOR)).toBe(0);

    const sim = withJob(INFILTRATION, at(-17.4, 133.6), []);
    const alarms = collect(sim, "ContractAlarm");
    run(sim, 1);
    expect(sim.session.focusPrompt).toBe("Wyłam zamek (podniesie alarm)");
    sim.step(input({ interact: true }));
    expect(sim.domain.flags).toContain(doorForcedFlag(TESSEN_OFFICE_DOOR.key, INFILTRATION));
    expect(sim.domain.flags).toContain(contractAlarmFlag(INFILTRATION.id));
    expect(alarms).toHaveLength(1);
    run(sim, Math.ceil(DOOR_MOVE_TIME * SIM_HZ) + 1);
    expect(openness(sim, TESSEN_OFFICE_DOOR)).toBe(1);
  });
});

describe("navigation through doors (ADR-0038, ADR-0025)", () => {
  it("an alerted ganger follows Seki from the street into Neon Koi", () => {
    const sim = quietAt(at(11, -3), Math.PI);
    const brawler: Entity = sim.world.add(
      gangerEntity(9200, { key: "test-brawler", position: at(1, -3), yaw: Math.PI / 2 }, null, 500, "shinsekai-7", undefined, "hebi_brawler"),
    );
    brawler.ai!.alerted = true;
    let inside = false;
    for (let i = 0; i < 12 * SIM_HZ && !inside; i++) {
      sim.step();
      inside = brawler.position.x > 7.6;
    }
    expect(inside).toBe(true);
  });
});

describe("the opening in the clinic (ADR-0038)", () => {
  it("a new game wakes Seki on the chair, with Kaito in reach and Mori at his monitors", () => {
    const sim = Simulation.create({ seed: 1 });
    const focus = collect<{ prompt: string | null }>(sim, "InteractionFocusChanged");
    expect(sim.player()!.position).toEqual(PLAYER_SPAWN.position);
    expect(PLAYER_SPAWN.position).toEqual(CLINIC_WAKE_SPOT);
    sim.step();
    expect(sim.player()!.position.y).toBeCloseTo(CLINIC_WAKE_SPOT.y, 5);
    expect(byKey(sim, "fixer")!.position).toEqual(FIXER_CLINIC_SPAWN.position);
    expect(byKey(sim, "mori")!.position).toEqual(MORI_SPAWN.position);
    expect(focus.at(-1)?.prompt).toBe("Rozmawiaj z Kaito");
    for (const key of ["koi-barman", "koi-regular-1", "koi-regular-2"]) expect(byKey(sim, key), key).toBeDefined();
  });

  it("after the first talk Kaito waits at the bar, under the same key", () => {
    const sim = Simulation.create({ seed: 1 });
    sim.enqueue({ type: "set-flag", flag: "met_fixer" });
    run(sim, 2);
    const kaito = [...sim.world].filter((e) => e.key === "fixer");
    expect(kaito).toHaveLength(1);
    expect(kaito[0]!.position).toEqual(FIXER_SPAWN.position);
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
    expect([...loaded.world].filter((e) => e.key === "fixer").map((e) => e.position)).toEqual([FIXER_SPAWN.position]);
  });
});

describe("saving with a door in motion (ADR-0038)", () => {
  it("keeps the door's state, and the loaded game goes on exactly like the original", () => {
    // Every character stays: the loaded game has to bring back the same world.
    const sim = Simulation.create({ seed: 3 });
    teleportPlayer(sim, at(-3, 4.4), -Math.PI / 2);
    run(sim, 36, input({ moveZ: 1 }));
    const open = openness(sim, CLINIC_DOOR);
    expect(open).toBeGreaterThan(0);
    expect(open).toBeLessThan(1);
    const snap = roundTrip(sim.snapshot(null, "door", ""));
    expect(snap.doors).toEqual([expect.objectContaining({ key: `${CLINIC_DOOR.key}#0`, open })]);
    const loaded = Simulation.fromSnapshot(snap);
    expect(openness(loaded, CLINIC_DOOR)).toBe(open);
    expect(hash(loaded)).toBe(hash(sim));
    for (let i = 0; i < 4 * SIM_HZ; i++) {
      const f = input({ moveZ: i < 60 ? 1 : 0 });
      sim.step(f);
      loaded.step(f);
    }
    expect(hash(loaded)).toBe(hash(sim));
    expect(openness(loaded, CLINIC_DOOR)).toBe(openness(sim, CLINIC_DOOR));
  });
});
