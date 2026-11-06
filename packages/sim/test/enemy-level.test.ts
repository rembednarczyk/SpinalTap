import { describe, expect, it } from "vitest";
import { CONTRACT_SITE_IDS, INITIAL_PROGRESSION, type SaveSnapshot, contractPay, contractTag, enemyScale, npcWeapon, xpForLevel } from "@seki/core";
import { CONTRACT_SITE_DISTRICTS, CONTRACT_SITE_SPAWNS, GANGER_MAX_HP, HANA_SPOT, Simulation, contractLevelOf, enemyRankOf, gangerEntity, ground } from "../src";
import { alleySim, byKey, teleportPlayer } from "./helpers";

/** A copy of `sim` with the player at `level` and `xp`, built the way a load builds it. */
const atLevel = (sim: Simulation, level: number, xp = xpForLevel(level)): Simulation => {
  const snap = sim.snapshot(null, "t", "");
  return Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, progression: { ...INITIAL_PROGRESSION, level, xp } } });
};

const reload = (sim: Simulation): Simulation => Simulation.fromSnapshot(JSON.parse(JSON.stringify(sim.snapshot(null, "t", ""))) as SaveSnapshot);

describe("enemy level by district band (ADR-0059, stage 5)", () => {
  it("every contract site lies in the district whose band gives the job its level", () => {
    const sim = Simulation.create({ seed: 1 });
    for (const site of CONTRACT_SITE_IDS) {
      const points = CONTRACT_SITE_SPAWNS[site];
      expect(points.length, site).toBeGreaterThan(0);
      for (const p of points) expect(sim.streamer.districtAt(p), site).toBe(CONTRACT_SITE_DISTRICTS[site]);
    }
  });

  it("an enemy is built of the band's level, its health and its weapon's damage 4% a level up", () => {
    const sim = atLevel(alleySim({ seed: 2 }), 6);
    const guard = byKey(sim, "guard")!;
    expect(guard.enemy?.level).toBe(6);
    const max = Math.round(GANGER_MAX_HP * enemyScale(6));
    expect(guard.health).toEqual({ current: max, max });
    expect(guard.combatant?.stats?.damage).toBeCloseTo(npcWeapon("hebi_smg").damage * enemyScale(6), 10);
  });

  it("an elite type and Tessen's shift boss rank above a regular", () => {
    const spawn = { key: "x", position: { x: 0, y: 0, z: 0 }, yaw: 0 };
    expect(enemyRankOf(gangerEntity(1, spawn, null, 80, ""))).toBe("regular");
    expect(enemyRankOf(gangerEntity(1, spawn, null, 140, "", undefined, "hebi_enforcer"))).toBe("elite");
    expect(enemyRankOf(gangerEntity(1, { ...spawn, key: "c4-g0" }, null, 110, "", undefined, "tessen_guard"))).toBe("boss");
    expect(enemyRankOf(gangerEntity(1, { ...spawn, key: "c4-g1" }, null, 110, "", undefined, "tessen_guard"))).toBe("regular");
  });

  it("a level-up regrades the enemies about at the same share of health, and a load builds them the same", () => {
    // One kill short of level 2: the courier pays 60 XP.
    const sim = atLevel(alleySim({ seed: 3 }), 1, 90);
    const player = sim.player()!;
    const guard = byKey(sim, "guard")!;
    guard.health = { current: 40, max: GANGER_MAX_HP };
    const courier = byKey(sim, "courier")!;
    courier.health = { ...courier.health!, current: 0 };
    courier.lastHitBy = player.id;
    sim.step();
    // The kill (and whatever quest step it ends) takes her past level 1, still within Krakowskie's 1-8.
    const level = sim.domain.progression.level;
    expect(level).toBeGreaterThan(1);
    expect(level).toBeLessThanOrEqual(8);
    const max = Math.round(GANGER_MAX_HP * enemyScale(level));
    expect(byKey(sim, "guard")).toMatchObject({ enemy: { level }, health: { current: Math.round((max * 40) / GANGER_MAX_HP), max } });
    const loaded = byKey(reload(sim), "guard")!;
    expect(loaded.enemy?.level).toBe(level);
    expect(loaded.health).toEqual(byKey(sim, "guard")!.health);
  });

  it("a job's level is its district's: Hana's stash in Alchemia (Krakowskie, 1-8) for a level 12 player is of level 8", () => {
    const sim = atLevel(Simulation.create({ seed: 4 }), 12);
    teleportPlayer(sim, ground(HANA_SPOT.x - 1.5, HANA_SPOT.z), Math.PI / 2);
    sim.step();
    expect(contractLevelOf(12, "hebi_stash")).toBe(8);
    expect(contractLevelOf(1, "tessen_office")).toBe(16);
    sim.enqueue({ type: "accept-contract", kind: "retrieve" });
    sim.step();
    const c = sim.domain.contracts.active!;
    expect(c.reward).toBe(contractPay(250 + c.targets * 110, 8, sim.domain.reputation.civilians));
    const crew = [...sim.world].filter((e) => e.tag === contractTag(c.id));
    expect(crew.length).toBe(c.targets);
    for (const g of crew) expect(g.enemy?.level).toBe(8);
  });
});
