import { describe, expect, it } from "vitest";
import { CONTRACT_SITE_IDS, INITIAL_PROGRESSION, type SaveSnapshot, contractPay, contractTag, enemyScale, npcWeapon, xpForLevel } from "@seki/core";
import {
  ALCHEMIA_MARKET_ACTORS,
  BAND_AREAS,
  CONTRACT_SITE_BANDS,
  CONTRACT_SITE_SPAWNS,
  GANGER_MAX_HP,
  HANA_SPOT,
  Simulation,
  TARG_CONTRACT_SITE_SPAWNS,
  TARG_OVERPASS_STASH,
  TARG_ROOF_STASH,
  WORLD_CHUNKS,
  bandDistrictAt,
  contractLevelOf,
  enemyRankOf,
  gangerEntity,
  ground,
} from "../src";
import { alleySim, byKey, teleportPlayer } from "./helpers";

/** A copy of `sim` with the player at `level` and `xp`, built the way a load builds it. */
const atLevel = (sim: Simulation, level: number, xp = xpForLevel(level)): Simulation => {
  const snap = sim.snapshot(null, "t", "");
  return Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, progression: { ...INITIAL_PROGRESSION, level, xp } } });
};

const reload = (sim: Simulation): Simulation => Simulation.fromSnapshot(JSON.parse(JSON.stringify(sim.snapshot(null, "t", ""))) as SaveSnapshot);

describe("enemy level by district band (ADR-0059, stage 5)", () => {
  it("every contract site lies where the band that gives the job its level holds", () => {
    const sim = Simulation.create({ seed: 1 });
    for (const site of CONTRACT_SITE_IDS) {
      const points = CONTRACT_SITE_SPAWNS[site];
      expect(points.length, site).toBeGreaterThan(0);
      for (const p of points) expect(bandDistrictAt(sim.streamer.districtAt(p), p), site).toBe(CONTRACT_SITE_BANDS[site]);
    }
  });

  it("the market's plot in Alchemia holds the market's band, on Krakowskie's ground, and nothing else of Krakowskie's", () => {
    const sim = Simulation.create({ seed: 1 });
    const market = new Set(ALCHEMIA_MARKET_ACTORS.map((a) => a.spawn.key));
    const points = [...ALCHEMIA_MARKET_ACTORS.map((a) => a.spawn.position), ...Object.values(TARG_CONTRACT_SITE_SPAWNS).flat(), TARG_ROOF_STASH.at, TARG_OVERPASS_STASH.at];
    for (const p of points) {
      expect(sim.streamer.districtAt(p)).toBe("shinsekai-7");
      expect(bandDistrictAt("shinsekai-7", p)).toBe("targ");
    }
    const area = BAND_AREAS.find((a) => a.id === "alchemia-market")!.area;
    expect(bandDistrictAt("kanal", { x: (area.minX + area.maxX) / 2, z: (area.minZ + area.maxZ) / 2 })).toBe("kanal");
    const others = WORLD_CHUNKS.filter((c) => c.district === "shinsekai-7")
      .flatMap((c) => c.actors)
      .filter((a) => !market.has(a.spawn.key) && bandDistrictAt("shinsekai-7", a.spawn.position) !== "shinsekai-7")
      .map((a) => a.spawn.key);
    expect(others).toEqual([]);
  });

  it("an enemy in the market in Alchemia is of the market's band (10-20), one elsewhere in Krakowskie of Krakowskie's (1-8)", () => {
    for (const [level, market, krakowskie] of [
      [1, 10, 1],
      [12, 12, 8],
      [25, 20, 8],
    ] as const) {
      const sim = atLevel(Simulation.create({ seed: 5 }), level);
      teleportPlayer(sim, ground(HANA_SPOT.x - 1.5, HANA_SPOT.z), Math.PI / 2);
      sim.step();
      expect(byKey(sim, "hebi-lookout")?.enemy?.level, `lookout at ${level}`).toBe(market);
      const alley = atLevel(alleySim({ seed: 5 }), level);
      expect(byKey(alley, "guard")?.enemy?.level, `guard at ${level}`).toBe(krakowskie);
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

  it("a job's level is its band's: the Hebi stash in Alchemia (the market's 10-20) for a level 12 player is of level 12", () => {
    const sim = atLevel(Simulation.create({ seed: 4 }), 12);
    teleportPlayer(sim, ground(HANA_SPOT.x - 1.5, HANA_SPOT.z), Math.PI / 2);
    sim.step();
    expect(contractLevelOf(12, "hebi_stash")).toBe(12);
    expect(contractLevelOf(1, "hebi_stash")).toBe(10);
    expect(contractLevelOf(12, "east_lot")).toBe(8);
    expect(contractLevelOf(1, "tessen_office")).toBe(16);
    sim.enqueue({ type: "accept-contract", kind: "retrieve" });
    sim.step();
    const c = sim.domain.contracts.active!;
    expect(c.reward).toBe(contractPay(250 + c.targets * 110, 12, sim.domain.reputation.civilians));
    const crew = [...sim.world].filter((e) => e.tag === contractTag(c.id));
    expect(crew.length).toBe(c.targets);
    for (const g of crew) expect(g.enemy?.level).toBe(12);
  });
});
