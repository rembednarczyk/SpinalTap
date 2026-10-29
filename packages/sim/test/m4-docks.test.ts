import { describe, expect, it } from "vitest";
import {
  type Contract,
  type ContractKind,
  HACK_GRACE_SECONDS,
  HACK_SECONDS,
  type SaveSnapshot,
  contractAlarmFlag,
  contractEscortKey,
  contractFailedFlag,
  contractItemKey,
  contractTag,
  contractTerminalKey,
} from "@seki/core";
import {
  CONTRACT_SITE_SPAWNS,
  DOKI_ITEM_SPOTS,
  DOKI_TERMINAL_SPOTS,
  ESCORT_ROUTE,
  GENZO_SPOT,
  SIM_HZ,
  SNIPER_AIM_TIME,
  SNIPER_PERCHES,
  Simulation,
  WAREHOUSE_TOP,
  WORLD_CHUNKS,
  WORLD_NAV,
  type Rect,
  routeAcrossLevels,
  sniperEntity,
  stateHash,
  DOCKS_PLACE,
  docks,
  ground,
  market,
} from "../src";
import { byKey, collect, input, run, teleportPlayer, debriefExtras } from "./helpers";

/**
 * The docks keep their own coordinates, moved to the Bystrzyca by `DOCKS_PLACE` (ADR-0045): `at`
 * is a point of the docks, `w` a point on the ground in the world (next to a character).
 */
const at = (x: number, z: number, y = 0) => docks(x, y, z);
const w = (x: number, z: number) => ground(x, z);
const D = DOCKS_PLACE;
const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const reload = (sim: Simulation): Simulation => Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "mid", "")));
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));

/** Next to Genzō in the yard; one step streams the docks in around the player. */
const toGenzo = (sim: Simulation) => {
  teleportPlayer(sim, w(GENZO_SPOT.x + 0.4, GENZO_SPOT.z - 2), 0);
  sim.step();
};

const accept = (sim: Simulation, kind: ContractKind): Contract => {
  sim.enqueue({ type: "accept-contract", kind });
  sim.step();
  const c = sim.domain.contracts.active;
  if (!c) throw new Error(`no ${kind} contract`);
  return c;
};

const crew = (sim: Simulation, c: Contract) => [...sim.world].filter((e) => e.tag === contractTag(c.id));
/** The guard of target index `i` (world order is not index order). */
const guard = (sim: Simulation, c: Contract, i: number) => byKey(sim, `${c.id}-g${i}`)!;
const killCrew = (sim: Simulation, c: Contract) => {
  for (const e of crew(sim, c)) e.health = { current: 0, max: e.health!.max };
  sim.step();
};
const complete = (sim: Simulation) => {
  sim.enqueue({ type: "complete-contract" });
  sim.step();
};

describe("streaming into the docks (ADR-0024)", () => {
  it("walks in from the riverside through the yard's gate, with no other district around (ADR-0045)", () => {
    const sim = Simulation.create({ seed: 2 });
    teleportPlayer(sim, at(27, 84), 0);
    sim.step();
    expect(sim.district).toBe("doki");
    expect(sim.streamer.loadedChunks.every((id) => id.startsWith("nabrzeze-"))).toBe(true);
    // The gate is open: sprinting north crosses the yard's south wall.
    for (let i = 0; i < 300 && sim.player()!.position.z - D.z < 104; i++) sim.step(input({ moveZ: 1, sprint: true }));
    expect(sim.player()!.position.z - D.z).toBeGreaterThanOrEqual(104);
    expect(sim.district).toBe("doki");
    expect(byKey(sim, "genzo")).toBeDefined();
    teleportPlayer(sim, at(2, 145), Math.PI);
    sim.step();
    expect(sim.streamer.loadedChunks).toEqual(["nabrzeze-1-1"]);
    expect(byKey(sim, "doker")).toBeDefined();
    // Back in town the docks sleep; in the yard again, Genzō is where he was.
    teleportPlayer(sim, w(300, -84), 0);
    sim.step();
    expect(byKey(sim, "genzo")).toBeUndefined();
    toGenzo(sim);
    expect(byKey(sim, "genzo")!.position).toEqual(GENZO_SPOT);
  });

  it("the docks lie in a chunk of the riverside that overlaps no other; the yard's level graph leads in from the gate", () => {
    const docksChunks = WORLD_CHUNKS.filter((c) => c.district === "doki");
    expect(docksChunks.map((c) => c.id)).toEqual(["nabrzeze-0-0", "nabrzeze-1-0", "nabrzeze-0-1", "nabrzeze-1-1"]);
    const overlap = (a: Rect, b: Rect) => a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;
    for (const d of docksChunks) for (const c of WORLD_CHUNKS) if (c !== d) expect(overlap(d.bounds, c.bounds), `${d.id} / ${c.id}`).toBe(false);
    const sim = Simulation.create({ seed: 2 });
    teleportPlayer(sim, at(27, 84), 0);
    sim.step();
    // From outside the gate up onto the warehouse roof: through the gate, not straight at it.
    const route = routeAcrossLevels(sim.world, WORLD_NAV, at(27, 84), at(-30, 108, WAREHOUSE_TOP));
    expect(route).not.toBeNull();
    expect(route!.next.z - D.z).toBeLessThan(100);
  });

  it("a jump from the warehouse roof does not clear its outer parapet", () => {
    const sim = Simulation.create({ seed: 2 });
    toGenzo(sim);
    teleportPlayer(sim, at(-35.5, 107, WAREHOUSE_TOP), -Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      sim.step(input({ jump: true, moveZ: 1, sprint: true }));
      run(sim, 50, input({ moveZ: 1, sprint: true }));
    }
    const p = sim.player()!.position;
    expect(p.x - D.x).toBeGreaterThan(-38);
    expect(p.y - D.y).toBeCloseTo(WAREHOUSE_TOP, 1);
  });

  it("the level graph takes NPCs up the warehouse stairs and onto the crane", () => {
    const sim = Simulation.create({ seed: 2 });
    toGenzo(sim);
    const roof = routeAcrossLevels(sim.world, WORLD_NAV, at(10, 96), at(-30, 108, WAREHOUSE_TOP));
    expect(roof).not.toBeNull();
    expect(roof!.cost).toBeGreaterThan(Math.hypot(40, 12));
    const crane = routeAcrossLevels(sim.world, WORLD_NAV, at(2, 130), SNIPER_PERCHES[2]!);
    expect(crane).not.toBeNull();
    // First towards the foot of the crane stairs, not straight up.
    expect(crane!.next.y).toBeCloseTo(D.y, 5);
  });
});

describe("escort (Mika to the boat)", () => {
  it("Mika waits, walks with Seki, the ambush comes on the quay, the boat clears the job; Genzō pays", () => {
    const sim = Simulation.create({ seed: 6 });
    toGenzo(sim);
    const alarms = collect(sim, "ContractAlarm");
    const c = accept(sim, "escort");
    expect(c).toMatchObject({ kind: "escort", siteId: "docks_escort", status: "active" });
    const mika = () => byKey(sim, contractEscortKey(c.id))!;
    expect(Math.hypot(mika().position.x - ESCORT_ROUTE[0].x, mika().position.z - ESCORT_ROUTE[0].z)).toBeLessThan(0.1);
    // The ambush waits for the alarm.
    expect(crew(sim, c)).toHaveLength(0);
    // Seki far away: Mika stays put.
    teleportPlayer(sim, at(-10, 96), 0);
    sim.step();
    const waiting = mika().position;
    run(sim, 60);
    expect(mika().position).toEqual(waiting);
    let alarmAt = -1;
    for (let i = 0; i < 80 * SIM_HZ && sim.domain.contracts.active?.status === "active"; i++) {
      const m = mika().position;
      teleportPlayer(sim, w(m.x, m.z - 2.2), 0);
      sim.step();
      if (alarmAt < 0 && sim.domain.flags.includes(contractAlarmFlag(c.id))) {
        alarmAt = i;
        expect(crew(sim, c)).toHaveLength(c.targets);
        // They come for her.
        expect(crew(sim, c).every((g) => g.ai?.victim === contractEscortKey(c.id))).toBe(true);
        killCrew(sim, c);
      }
    }
    expect(alarms).toHaveLength(1);
    expect(alarmAt).toBeGreaterThan(0);
    expect(sim.domain.contracts.active?.status).toBe("cleared");
    const before = sim.domain.wallet.eddies;
    // The card adds the bonus condition and the fixer's style (ADR-0029).
    const extra = debriefExtras(sim);
    complete(sim);
    expect(sim.domain.wallet.eddies).toBe(before + c.reward + extra());
    expect(sim.domain.reputation.tessen).toBeLessThan(0);
  });

  it("fails when Mika dies: no pay, the street and the fixers remember", () => {
    const sim = Simulation.create({ seed: 6 });
    toGenzo(sim);
    const failed = collect<{ reason: string }>(sim, "ContractFailed");
    const c = accept(sim, "escort");
    const m = byKey(sim, contractEscortKey(c.id))!;
    // Shot by Tessen, not by Seki: her death itself is not held against the player.
    m.health = { current: 0, max: m.health!.max };
    m.lastHitBy = 9999;
    sim.step();
    expect(failed.map((f) => f.reason)).toEqual(["escort-killed"]);
    expect(sim.domain.contracts.active).toBeNull();
    expect(sim.domain.flags).toContain(contractFailedFlag(c.id));
    expect(sim.domain.reputation).toMatchObject({ civilians: -3, fixers: -2 });
  });

  it("a save after the ambush loads with Mika and the ambush where they were", () => {
    const sim = Simulation.create({ seed: 6 });
    toGenzo(sim);
    const c = accept(sim, "escort");
    for (let i = 0; i < 60 * SIM_HZ && !sim.domain.flags.includes(contractAlarmFlag(c.id)); i++) {
      const m = byKey(sim, contractEscortKey(c.id))!.position;
      teleportPlayer(sim, w(m.x, m.z - 2.2), 0);
      sim.step();
    }
    run(sim, 30);
    const restored = reload(sim);
    expect(crew(restored, c)).toHaveLength(c.targets);
    expect(byKey(restored, contractEscortKey(c.id))!.position).toEqual(byKey(sim, contractEscortKey(c.id))!.position);
    run(sim, 120);
    run(restored, 120);
    expect(hash(restored)).toBe(hash(sim));
  });
});

describe("infiltration (data from the Tessen office)", () => {
  const officeGuards = (sim: Simulation, c: Contract) => crew(sim, c).filter((g) => g.ai?.watch);

  it("the guards stand watch from the start; taking the data unseen clears the job", () => {
    const sim = Simulation.create({ seed: 8 });
    toGenzo(sim);
    const c = accept(sim, "infiltrate");
    expect(c).toMatchObject({ kind: "infiltrate", siteId: "tessen_office" });
    expect(officeGuards(sim, c)).toHaveLength(c.targets);
    expect(byKey(sim, contractItemKey(c.id))?.interactable?.prompt).toBe("Zgraj dane Tessen");
    const spot = DOKI_ITEM_SPOTS.tessen_office!;
    teleportPlayer(sim, w(spot.x + 1.1, spot.z), -Math.PI / 2);
    sim.step(input({ interact: true, crouch: true }));
    expect(sim.domain.contracts.active?.status).toBe("cleared");
    // Seen afterwards does not matter any more.
    for (const g of crew(sim, c)) g.ai!.alerted = true;
    sim.step();
    expect(sim.domain.contracts.active?.status).toBe("cleared");
    complete(sim);
    expect(sim.domain.contracts.completed).toBe(1);
    expect(sim.domain.reputation).toMatchObject({ fixers: 3, tessen: -1 });
  });

  it("standing in front of a guard gets Seki seen within a second or two, and the job fails", () => {
    const sim = Simulation.create({ seed: 8 });
    toGenzo(sim);
    const failed = collect<{ reason: string }>(sim, "ContractFailed");
    const c = accept(sim, "infiltrate");
    const door = guard(sim, c, 1);
    // Eight metres in front of the door guard, standing.
    teleportPlayer(sim, w(door.position.x + 8, door.position.z), -Math.PI / 2);
    sim.step();
    expect(door.ai!.alerted).toBe(false);
    expect(door.ai!.suspicion).toBeGreaterThan(0);
    run(sim, 2 * SIM_HZ);
    expect(failed.map((f) => f.reason)).toEqual(["detected"]);
    expect(sim.domain.reputation).toMatchObject({ fixers: -3, tessen: -5 });
  });

  it("crouching behind a guard is not seen", () => {
    const sim = Simulation.create({ seed: 8 });
    toGenzo(sim);
    const c = accept(sim, "infiltrate");
    const quay = guard(sim, c, 2);
    // Behind the quay guard (he looks east, over the quay), crouched, three metres off.
    teleportPlayer(sim, w(quay.position.x - 3, quay.position.z - 0.2), Math.PI / 2);
    run(sim, 4 * SIM_HZ, input({ crouch: true }));
    expect(quay.ai!.alerted).toBe(false);
    expect(crew(sim, c).every((g) => !g.ai!.alerted)).toBe(true);
    expect(sim.domain.contracts.active?.status).toBe("active");
  });
});

describe("hack (the quay terminal)", () => {
  const terminalSpot = () => DOKI_TERMINAL_SPOTS.quay_terminal!;
  const toTerminal = (sim: Simulation) => {
    const t = terminalSpot();
    teleportPlayer(sim, w(t.x, t.z - 1.4), 0);
  };
  const start = (sim: Simulation): Contract => {
    toGenzo(sim);
    const c = accept(sim, "hack");
    toTerminal(sim);
    sim.step(input({ interact: true }));
    return c;
  };

  it("the terminal starts the hack and the wave, sniper included; holding it clears the job", () => {
    const sim = Simulation.create({ seed: 9 });
    toGenzo(sim);
    const alarms = collect(sim, "ContractAlarm");
    const c = accept(sim, "hack");
    expect(byKey(sim, contractTerminalKey(c.id))?.interactable?.kind).toBe("terminal");
    expect(crew(sim, c)).toHaveLength(0);
    toTerminal(sim);
    sim.step(input({ interact: true }));
    expect(alarms).toHaveLength(1);
    expect(sim.domain.contracts.active?.progress).toBe(1);
    const wave = crew(sim, c);
    expect(wave).toHaveLength(c.targets);
    expect(wave.filter((e) => e.sniper)).toHaveLength(1);
    expect(wave.filter((e) => e.ai).every((g) => g.ai!.alerted)).toBe(true);
    // A second press does not restart anything.
    sim.step(input({ interact: true }));
    expect(sim.domain.contracts.active?.progress).toBe(2);
    killCrew(sim, c);
    const left = HACK_SECONDS * SIM_HZ - sim.domain.contracts.active!.progress!;
    run(sim, left - 1);
    expect(sim.domain.contracts.active?.status).toBe("active");
    sim.step();
    expect(sim.domain.contracts.active?.status).toBe("cleared");
    complete(sim);
    expect(sim.domain.reputation).toMatchObject({ fixers: 2, tessen: -5 - 4 * c.targets });
  });

  it("leaving the terminal for too long drops the connection", () => {
    const sim = Simulation.create({ seed: 9 });
    const failed = collect<{ reason: string }>(sim, "ContractFailed");
    const c = start(sim);
    killCrew(sim, c);
    const t = terminalSpot();
    teleportPlayer(sim, w(t.x, t.z - 12), 0);
    run(sim, HACK_GRACE_SECONDS * SIM_HZ - 1);
    expect(failed).toHaveLength(0);
    // Coming back in time resets the count.
    toTerminal(sim);
    sim.step();
    expect(sim.domain.contracts.active?.away).toBe(0);
    teleportPlayer(sim, w(t.x, t.z - 12), 0);
    run(sim, HACK_GRACE_SECONDS * SIM_HZ);
    expect(failed.map((f) => f.reason)).toEqual(["connection-lost"]);
  });

  it("the hack's clock survives a save", () => {
    const sim = Simulation.create({ seed: 9 });
    const c = start(sim);
    killCrew(sim, c);
    run(sim, 600);
    const restored = reload(sim);
    expect(restored.domain.contracts.active).toEqual(sim.domain.contracts.active);
    run(sim, 300);
    run(restored, 300);
    expect(hash(restored)).toBe(hash(sim));
  });
});

describe("sniper AI", () => {
  const withSniper = (perch = 0) => {
    const sim = Simulation.create({ seed: 12 });
    toGenzo(sim);
    const s = sniperEntity(9000, { key: "sniper", position: SNIPER_PERCHES[perch]!, yaw: 1 }, null, 70, "nabrzeze-1-1");
    sim.world.add(s);
    return { sim, s };
  };

  it("telegraphs with the laser, then fires after the aim time", () => {
    const { sim, s } = withSniper();
    const aims = collect<{ entityId: number; duration: number }>(sim, "SniperAimed");
    const shots = collect<{ shooterId: number }>(sim, "ShotFired");
    const t = DOKI_TERMINAL_SPOTS.quay_terminal!;
    teleportPlayer(sim, w(t.x, t.z - 1.4), 0);
    sim.step();
    expect(aims).toEqual([{ entityId: s.id, targetId: sim.player()!.id, duration: SNIPER_AIM_TIME }]);
    run(sim, Math.round(SNIPER_AIM_TIME * SIM_HZ) - 2);
    expect(shots.filter((x) => x.shooterId === s.id)).toHaveLength(0);
    run(sim, 3);
    expect(shots.filter((x) => x.shooterId === s.id)).toHaveLength(1);
    expect(aims.at(-1)?.duration).toBe(0);
  });

  it("breaking the line before the shot turns the laser off and nothing is fired", () => {
    const { sim, s } = withSniper();
    const aims = collect<{ duration: number }>(sim, "SniperAimed");
    const shots = collect<{ shooterId: number }>(sim, "ShotFired");
    const t = DOKI_TERMINAL_SPOTS.quay_terminal!;
    teleportPlayer(sim, w(t.x, t.z - 1.4), 0);
    sim.step();
    run(sim, 30);
    // Into the Tessen office: walls all round.
    teleportPlayer(sim, at(-24, 133), 0);
    run(sim, 60);
    expect(aims.map((a) => a.duration)).toEqual([SNIPER_AIM_TIME, 0]);
    expect(shots.filter((x) => x.shooterId === s.id)).toHaveLength(0);
  });

  it("falls back along the roof when Seki comes up the stairs", () => {
    const { sim, s } = withSniper();
    teleportPlayer(sim, at(-17, 116.2, WAREHOUSE_TOP), Math.PI);
    sim.step();
    expect(s.sniper!.phase).toBe("move");
    expect(s.sniper!.perch).toBe(1);
    run(sim, 8 * SIM_HZ);
    const far = SNIPER_PERCHES[1]!;
    expect(Math.hypot(s.position.x - far.x, s.position.z - far.z)).toBeLessThan(1);
    expect(s.position.y - D.y).toBeCloseTo(WAREHOUSE_TOP, 1);
  });

  it("from the crane it takes the stairs down and up to the roof", () => {
    const { sim, s } = withSniper(2);
    // On the crane walkway next to it.
    teleportPlayer(sim, at(14, 140, 8), Math.PI / 2);
    sim.step();
    expect(s.sniper!.phase).toBe("move");
    teleportPlayer(sim, at(26, 100), 0);
    let lowest = s.position.y;
    for (let i = 0; i < 60 * SIM_HZ && s.sniper!.phase === "move"; i++) {
      sim.step();
      lowest = Math.min(lowest, s.position.y);
    }
    expect(lowest - D.y).toBeLessThan(0.5);
    expect(s.position.y - D.y).toBeCloseTo(WAREHOUSE_TOP, 1);
  });
});

describe("no sniper outside the docks", () => {
  it("market and Krakowskie jobs never bring Tessen", () => {
    for (const kind of ["eliminate", "retrieve", "protect"] as const) {
      const sim = Simulation.create({ seed: 4 });
      teleportPlayer(sim, market(90.5, 0, 74), 0);
      sim.step();
      const c = accept(sim, kind);
      const site = CONTRACT_SITE_SPAWNS[c.siteId][0]!;
      teleportPlayer(sim, w(site.x + 1, site.z), 0);
      sim.step();
      const types = crew(sim, c).map((e) => e.enemy?.type);
      expect(types).toHaveLength(c.targets);
      expect(types.every((t) => t?.startsWith("hebi_"))).toBe(true);
    }
  });
});
