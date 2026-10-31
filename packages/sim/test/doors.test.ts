import { describe, expect, it } from "vitest";
import { type Contract, type SaveSnapshot, type Vec3, SECONDS_PER_HOUR, contractAlarmFlag } from "@seki/core";
import {
  CLINIC_DOOR,
  CLINIC_WAKE_SPOT,
  DOOR_CLOSE_DELAY,
  DOOR_MOVE_TIME,
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
  clinicPoint,
  docks,
  ground,
  koiPoint,
  stateHash,
} from "../src";
import { doorForcedFlag } from "../src/systems/door-system";
import { propEntity } from "../src/world/factory";
import { lineOfSight } from "../src/world/hitscan";
import { byKey, collect, input, run, teleportPlayer } from "./helpers";

/**
 * The rooms keep their old layout turned onto their facades (ADR-0045): a point of the clinic
 * or the bar in its old coordinates, `y` above its floor, and the old yaw turned with it.
 */
const clinic = (x: number, z: number, y = 0): Vec3 => clinicPoint(x, y, z);
const koi = (x: number, z: number, y = 0): Vec3 => koiPoint(x, y, z);
const turned = (yaw: number) => yaw + Math.PI / 2;
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
    const sim = quietAt(clinic(-3.4, 4.4), turned(-Math.PI / 2));
    expect(openness(sim, CLINIC_DOOR)).toBe(0);
    const [leaf] = leaves(sim, CLINIC_DOOR);
    const closedX = leaf!.position.x;
    // 2.2 m from the door: still shut. One step closer: it starts to open.
    run(sim, 1, input({ moveZ: 1 }));
    teleportPlayer(sim, clinic(-5.3, 4.4), turned(-Math.PI / 2));
    run(sim, 1);
    expect(openness(sim, CLINIC_DOOR)).toBeGreaterThan(0);
    run(sim, Math.ceil(DOOR_MOVE_TIME * SIM_HZ));
    expect(openness(sim, CLINIC_DOOR)).toBe(1);
    // The facade runs along x on the deptak: the leaf slides west into its pocket.
    expect(leaf!.position.x).toBeCloseTo(closedX - CLINIC_DOOR.width, 5);
    expect(leaf!.solid!.max.x).toBeLessThanOrEqual(clinic(0, 3.6).x + 1e-6);
  });

  it("walks through, then closes 1.5 s after the sensor empties", () => {
    const sim = quietAt(clinic(-3, 4.4), turned(-Math.PI / 2));
    // Into the waiting room, through the door.
    run(sim, 2 * SIM_HZ, input({ moveZ: 1 }));
    const p = sim.player()!;
    expect(p.position.z).toBeGreaterThan(clinic(-8, 4.4).z);
    // Just inside, in the sensor; then by the reception desk, out of it: open for the delay, then closing.
    teleportPlayer(sim, clinic(-8.2, 4.4));
    run(sim, Math.ceil(DOOR_MOVE_TIME * SIM_HZ) + 1);
    teleportPlayer(sim, clinic(-10, 6.6));
    run(sim, Math.floor(DOOR_CLOSE_DELAY * SIM_HZ) - 2);
    expect(openness(sim, CLINIC_DOOR)).toBe(1);
    run(sim, Math.ceil(DOOR_MOVE_TIME * SIM_HZ) + 4);
    expect(openness(sim, CLINIC_DOOR)).toBe(0);
  });

  it("a closed door blocks the way and the line of sight; an open one does neither", () => {
    const sim = quietAt(clinic(-10, 6.6));
    const outside = clinic(-4, 4.4, 1.5);
    const inside = clinic(-10, 4.4, 1.5);
    expect(lineOfSight(sim.world, outside, inside)).toBe(false);
    // NPCs open it too: Mori walks up to it.
    const mori = byKey(sim, "mori")!;
    mori.position = clinic(-8.2, 4.4);
    run(sim, Math.ceil(DOOR_MOVE_TIME * SIM_HZ) + 1);
    expect(openness(sim, CLINIC_DOOR)).toBe(1);
    expect(lineOfSight(sim.world, outside, inside)).toBe(true);
  });

  it("never closes on a body in the doorway", () => {
    const sim = quietAt(clinic(-7.15, 4.4));
    run(sim, Math.ceil(DOOR_MOVE_TIME * SIM_HZ) + 1);
    expect(openness(sim, CLINIC_DOOR)).toBe(1);
    // Nobody may open it any more, but the player stands in the opening.
    for (const l of leaves(sim, CLINIC_DOOR)) l.door = { ...l.door, lock: { kind: "code", staff: "tessen", during: "infiltrate" } };
    run(sim, 3 * SIM_HZ);
    expect(openness(sim, CLINIC_DOOR)).toBe(1);
  });

  it("a sealed door stays shut and is a wall for everyone", () => {
    // On Plac Litewski, a door standing alone on the square.
    const sim = quietAt(ground(70, -50));
    const sealed: DoorDef = { key: "door:test", at: ground(70, -46), along: "x", width: 2, height: 2.6, leaves: 2, lock: { kind: "sealed" } };
    doorParts(sealed).forEach((p, i) => sim.world.add(propEntity(9000 + i, p, "krakowskie-1-0")));
    expect(leaves(sim, sealed).every((l) => l.velocity === undefined)).toBe(true);
    run(sim, 2 * SIM_HZ, input({ moveZ: 1 }));
    expect(openness(sim, sealed)).toBe(0);
    expect(sim.player()!.position.z).toBeLessThan(-46 - 0.38 + 0.01);
  });

  it("the double door of Neon Koi parts from the middle", () => {
    const sim = quietAt(koi(6, 1.5), turned(Math.PI / 2));
    run(sim, Math.ceil(DOOR_MOVE_TIME * SIM_HZ) + 1);
    const [a, b] = leaves(sim, KOI_DOOR);
    expect(openness(sim, KOI_DOOR)).toBe(1);
    expect(a!.solid!.max.x).toBeLessThanOrEqual(koi(0, 0.4).x + 1e-6);
    expect(b!.solid!.min.x).toBeGreaterThanOrEqual(koi(0, 2.6).x - 1e-6);
  });
});

describe("the coded door of Tessen's office (ADR-0038, the hook of ADR-0034)", () => {
  const outside = docks(-16.6, 0, 132);

  it("stays shut for the player without the code; a Tessen guard opens it", () => {
    const sim = withJob(INFILTRATION, outside);
    run(sim, SIM_HZ);
    expect(openness(sim, TESSEN_OFFICE_DOOR)).toBe(0);
    const guard = sim.world.add(gangerEntity(9100, { key: "test-guard", position: docks(-19.5, 0, 132), yaw: Math.PI / 2 }, null, 100, "nabrzeze-1-1", undefined, "tessen_guard"));
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

    const sim = withJob(INFILTRATION, docks(-17.4, 0, 133.6), []);
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
    const sim = quietAt(koi(11, -3), turned(Math.PI));
    const brawler: Entity = sim.world.add(
      gangerEntity(9200, { key: "test-brawler", position: koi(1, -3), yaw: turned(Math.PI / 2) }, null, 500, "krakowskie-2-0", undefined, "hebi_brawler"),
    );
    brawler.ai!.alerted = true;
    let inside = false;
    for (let i = 0; i < 12 * SIM_HZ && !inside; i++) {
      sim.step();
      inside = brawler.position.z < koi(7.6, 0).z;
    }
    expect(inside).toBe(true);
  });
});

describe("the opening in the clinic (ADR-0038)", () => {
  it("a new game wakes Seki on the chair, with Mori at his monitors and Kaito at the Neon Koi counter (G-034)", () => {
    const sim = Simulation.create({ seed: 1 });
    const focus = collect<{ prompt: string | null }>(sim, "InteractionFocusChanged");
    expect(sim.player()!.position).toEqual(PLAYER_SPAWN.position);
    expect(PLAYER_SPAWN.position).toEqual(CLINIC_WAKE_SPOT);
    sim.step();
    expect(sim.player()!.position.y).toBeCloseTo(CLINIC_WAKE_SPOT.y, 5);
    expect(byKey(sim, "fixer")!.position).toEqual(FIXER_SPAWN.position);
    expect(byKey(sim, "mori")!.position).toEqual(MORI_SPAWN.position);
    // Kaito is across the deptak, out of reach of the chair.
    expect(focus.at(-1)?.prompt ?? null).not.toBe("Rozmawiaj z Kaito");
    for (const key of ["koi-barman", "koi-regular-1", "koi-regular-2"]) expect(byKey(sim, key), key).toBeDefined();
  });

  it("the first talk leaves Kaito where he stands, one of him, also after a load", () => {
    const sim = Simulation.create({ seed: 1 });
    run(sim, 1);
    const before = byKey(sim, "fixer")!;
    sim.enqueue({ type: "set-flag", flag: "met_fixer" });
    run(sim, 2);
    const kaito = [...sim.world].filter((e) => e.key === "fixer");
    expect(kaito).toHaveLength(1);
    expect(kaito[0]!.id).toBe(before.id);
    expect(kaito[0]!.position).toEqual(FIXER_SPAWN.position);
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
    expect([...loaded.world].filter((e) => e.key === "fixer").map((e) => e.position)).toEqual([FIXER_SPAWN.position]);
  });
});

describe("saving with a door in motion (ADR-0038)", () => {
  it("keeps the door's state, and the loaded game goes on exactly like the original", () => {
    // Every character stays: the loaded game has to bring back the same world.
    const sim = Simulation.create({ seed: 3 });
    teleportPlayer(sim, clinic(-3, 4.4), turned(-Math.PI / 2));
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
