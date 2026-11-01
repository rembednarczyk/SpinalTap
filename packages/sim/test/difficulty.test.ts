import { describe, expect, it, vi } from "vitest";
import { type Contract, type DifficultyProfile, type DomainEvents, type DomainState, ENEMY_TYPES, MICRO_EVENT_CHANCE, SECONDS_PER_HOUR, contractTag } from "@seki/core";
import {
  DOKI_TERMINAL_SPOTS,
  GANGER_MAX_HP,
  GENZO_SPOT,
  REINFORCE_INTERVAL,
  SIM_HZ,
  SNIPER_AIM_TIME,
  SNIPER_PERCHES,
  Simulation,
  contractGangerHp,
  deriveRandom,
  gangerEntity,
  ground,
  sniperEntity,
} from "../src";
import { byKey, collect, input, run, streetSim, teleportPlayer } from "./helpers";
import { DOCKS_CHUNK, profile, roundTrip, setProfile, tough, yardFight } from "./difficulty-scenes";

/*
 * The difficulty profile (ADR-0066, stage 1). Each multiplier is checked on its own: the same
 * scenario, the same seed, "normal" against a profile that differs in that one field only.
 */

// The heat's reinforcements run for ten seconds: roomy on a busy machine.
vi.setConfig({ testTimeout: 20_000 });

/** `seconds` of a fight, the player kept alive every step (her health follows her stats). */
const fight = (patch: Partial<DifficultyProfile>, type: "tessen_guard" | "hebi_brawler", distance: number, seconds: number) => {
  const { sim, g } = yardFight(patch, { type, distance });
  const hits = collect<DomainEvents["DamageDealt"]>(sim, "DamageDealt");
  const shots = collect<DomainEvents["ShotFired"]>(sim, "ShotFired");
  for (let i = 0; i < seconds * SIM_HZ; i++) {
    tough(sim);
    sim.step();
  }
  const me = sim.player()!.id;
  const fired = shots.filter((s) => s.shooterId === g.id);
  return { hits: hits.filter((h) => h.targetId === me).map((h) => h.amount), fired: fired.length, hit: fired.filter((s) => s.hitEntity === me).length };
};
const hitsOnPlayer = (patch: Partial<DifficultyProfile>, type: "tessen_guard" | "hebi_brawler", distance: number, seconds: number) => fight(patch, type, distance, seconds).hits;

describe("damageTaken: damage to the player after armour (ADR-0066)", () => {
  it("doubles every shot and every blow, rounded like the attack; halves them on 0.5", () => {
    for (const [type, distance] of [["tessen_guard", 14], ["hebi_brawler", 1.5]] as const) {
      const normal = hitsOnPlayer({}, type, distance, 4);
      expect(normal.length, type).toBeGreaterThan(0);
      expect(hitsOnPlayer({ damageTaken: 2 }, type, distance, 4), type).toEqual(normal.map((d) => Math.round(d * 2)));
      expect(hitsOnPlayer({ damageTaken: 0.5 }, type, distance, 4), type).toEqual(normal.map((d) => Math.round(d * 0.5)));
    }
  });
});

describe("npcAccuracy: the inverse of an NPC's aim cone (ADR-0066)", () => {
  /** Shots of a guard 14 m off over ten seconds, and how many of them hit the player. */
  const volley = (patch: Partial<DifficultyProfile>) => fight(patch, "tessen_guard", 14, 10);

  it("a sharper NPC hits more of its shots, a poorer one fewer", () => {
    const poor = volley({ npcAccuracy: 0.25 });
    const normal = volley({});
    const sharp = volley({ npcAccuracy: 3 });
    for (const v of [poor, normal, sharp]) expect(v.fired).toBeGreaterThan(5);
    expect(poor.hit / poor.fired).toBeLessThan(normal.hit / normal.fired);
    expect(sharp.hit / sharp.fired).toBeGreaterThan(normal.hit / normal.fired);
  });
});

describe("awareness: how fast NPCs and cameras notice (ADR-0066)", () => {
  /** An infiltration of the docks with the player next to Genzō, after `patch`. */
  const infiltration = (patch: Partial<DifficultyProfile>): { sim: Simulation; c: Contract } => {
    const sim = Simulation.create({ seed: 8 });
    teleportPlayer(sim, ground(GENZO_SPOT.x + 0.4, GENZO_SPOT.z - 2), 0);
    sim.step();
    setProfile(sim, patch);
    tough(sim);
    sim.enqueue({ type: "accept-contract", kind: "infiltrate" });
    sim.step();
    return { sim, c: sim.domain.contracts.active! };
  };

  it("a guard's suspicion fills twice as fast on 2", () => {
    const suspicion = (patch: Partial<DifficultyProfile>) => {
      const { sim, c } = infiltration(patch);
      const door = byKey(sim, `${c.id}-g1`)!;
      teleportPlayer(sim, ground(door.position.x + 8, door.position.z), -Math.PI / 2);
      sim.step();
      return door.ai!.suspicion ?? 0;
    };
    const normal = suspicion({});
    expect(normal).toBeGreaterThan(0);
    expect(normal).toBeLessThan(0.5);
    expect(suspicion({ awareness: 2 })).toBeCloseTo(2 * normal, 9);
    expect(suspicion({ awareness: 0.5 })).toBeCloseTo(0.5 * normal, 9);
  });

  it("a camera's spot meter fills twice as fast on 2", () => {
    const spot = (patch: Partial<DifficultyProfile>) => {
      const { sim, c } = infiltration(patch);
      // Nobody of the crew around: only the camera can see.
      for (const e of [...sim.world].filter((x) => x.tag === contractTag(c.id))) e.health = { current: 0, max: 1 };
      sim.step();
      const cam = byKey(sim, "dev:doki-office-cam")!;
      teleportPlayer(sim, { x: cam.position.x + Math.sin(cam.yaw) * 6, y: sim.player()!.position.y, z: cam.position.z + Math.cos(cam.yaw) * 6 }, 0);
      run(sim, 0.2 * SIM_HZ);
      return cam.device!.spot;
    };
    const normal = spot({});
    expect(normal).toBeGreaterThan(0);
    expect(normal).toBeLessThan(0.5);
    expect(spot({ awareness: 2 })).toBeCloseTo(2 * normal, 9);
  });
});

describe("reinforce: how often the heat brings security in (ADR-0066)", () => {
  /** Ten seconds of a level-3 heat on the deptak: the steps at which reinforcements came in. */
  const arrivals = (patch: Partial<DifficultyProfile>) => {
    const base = streetSim({ seed: 6 });
    const snap = base.snapshot(null, "t", "");
    const at = ground(300, -83);
    const heat = { level: 3 as const, faction: "hebi" as const, searching: true, lastKnown: at, searchLeft: 60, cooldown: 0 };
    const sim = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, heat, difficulty: profile(patch) } });
    const ticks: number[] = [];
    const intervals: number[] = [];
    for (let i = 0; i < 10 * SIM_HZ; i++) {
      const before = [...sim.world].filter((e) => e.security).length;
      teleportPlayer(sim, at, 0);
      sim.step();
      if ([...sim.world].filter((e) => e.security).length > before) {
        ticks.push(i);
        intervals.push(sim.session.watch.reinforce);
      }
    }
    return { ticks, intervals };
  };

  it("on 2 the next one may come in half the interval after the last", () => {
    const normal = arrivals({});
    const often = arrivals({ reinforce: 2 });
    expect(normal.ticks.length).toBeGreaterThanOrEqual(2);
    expect(normal.intervals[0]).toBe(REINFORCE_INTERVAL);
    expect(often.intervals[0]).toBe(REINFORCE_INTERVAL / 2);
    expect(often.ticks.length).toBeGreaterThan(normal.ticks.length);
    expect(often.ticks[1]! - often.ticks[0]!).toBeLessThan(normal.ticks[1]! - normal.ticks[0]!);
  });

  it("the reinforcements appear with the difficulty's health", () => {
    const base = streetSim({ seed: 6 });
    const snap = base.snapshot(null, "t", "");
    const heat = { level: 1 as const, faction: "hebi" as const, searching: true, lastKnown: ground(300, -83), searchLeft: 60, cooldown: 0 };
    const sim = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, heat, difficulty: profile({ npcHealth: 1.5 }) } });
    teleportPlayer(sim, ground(300, -83), 0);
    run(sim, SIM_HZ);
    const security = [...sim.world].filter((e) => e.security);
    expect(security).toHaveLength(1);
    const hp = Math.round(ENEMY_TYPES.hebi_ganger.hp * 1.5);
    expect(security[0]!.health).toEqual({ current: hp, max: hp });
  });
});

describe("npcHealth: hostile NPCs as they appear (ADR-0066)", () => {
  /** Kaito's elimination, taken on Plac Litewski after `patch`: its crew. */
  const eliminate = (patch: Partial<DifficultyProfile>) => {
    const sim = streetSim({ seed: 31 });
    setProfile(sim, patch);
    sim.enqueue({ type: "accept-contract", kind: "eliminate" });
    sim.step();
    const c = sim.domain.contracts.active!;
    return { sim, crew: [...sim.world].filter((e) => e.tag === contractTag(c.id)) };
  };

  it("a contract's crew has 1.5 times the health; the player and the passers-by do not", () => {
    const normal = eliminate({});
    const tougher = eliminate({ npcHealth: 1.5 });
    expect(normal.crew.length).toBeGreaterThan(0);
    expect(normal.crew.map((e) => e.health!.max)).toContain(contractGangerHp(0));
    expect(tougher.crew.map((e) => e.health)).toEqual(normal.crew.map((e) => ({ current: Math.round(e.health!.max * 1.5), max: Math.round(e.health!.max * 1.5) })));
    expect(tougher.sim.player()!.health).toEqual(normal.sim.player()!.health);
    const civilians = (s: Simulation) => [...s.world].filter((e) => e.civilian && e.health).map((e) => e.health!.max);
    expect(civilians(tougher.sim)).toEqual(civilians(normal.sim));
  });

  it("a hurt enemy keeps its saved health across a save, and its tougher maximum", () => {
    const { sim, crew } = eliminate({ npcHealth: 1.5 });
    const max = Math.round(contractGangerHp(0) * 1.5);
    const target = crew.find((e) => e.health?.max === max)!;
    expect(target).toBeDefined();
    // Hurt below the content's own health (100): loaded, it is not toughened a second time.
    target.health = { current: 40, max };
    const restored = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "d", "")));
    expect(byKey(restored, target.key!)?.health).toEqual({ current: 40, max });
  });
});

describe("snipeTell: how long a sniper's laser warns (ADR-0066)", () => {
  /** A Tessen sniper on its perch, the player in its line by the quay terminal, after `patch`. */
  const sniper = (patch: Partial<DifficultyProfile>) => {
    const sim = Simulation.create({ seed: 12 });
    teleportPlayer(sim, ground(GENZO_SPOT.x + 0.4, GENZO_SPOT.z - 2), 0);
    sim.step();
    setProfile(sim, patch);
    tough(sim);
    const s = sniperEntity(9000, { key: "sniper", position: SNIPER_PERCHES[0]!, yaw: 1 }, null, 70, DOCKS_CHUNK);
    sim.world.add(s);
    const aims = collect<DomainEvents["SniperAimed"]>(sim, "SniperAimed");
    const shots = collect<DomainEvents["ShotFired"]>(sim, "ShotFired");
    const t = DOKI_TERMINAL_SPOTS.quay_terminal!;
    teleportPlayer(sim, ground(t.x, t.z - 1.4), 0);
    sim.step();
    /** Steps from the laser to the shot. */
    let steps = 1;
    while (shots.filter((x) => x.shooterId === s.id).length === 0 && steps < 10 * SIM_HZ) {
      sim.step(input());
      steps++;
    }
    return { duration: aims[0]?.duration, steps };
  };

  it("on 1.6 the laser warns 1.6 times as long before the shot, on 0.8 shorter", () => {
    const normal = sniper({});
    expect(normal.duration).toBe(SNIPER_AIM_TIME);
    const long = sniper({ snipeTell: 1.6 });
    expect(long.duration).toBeCloseTo(SNIPER_AIM_TIME * 1.6, 9);
    // 0.84 s more is 50.4 steps: the timer runs out on the 51st.
    expect(long.steps - normal.steps).toBe(Math.ceil(SNIPER_AIM_TIME * 0.6 * SIM_HZ));
    const short = sniper({ snipeTell: 0.8 });
    expect(short.steps).toBeLessThan(normal.steps);
  });
});

describe("awareness and npcHealth off the beaten track (ADR-0066)", () => {
  it("an enforcer's suspicion of a disguise fills twice as fast on 2", () => {
    const suspicion = (patch: Partial<DifficultyProfile>) => {
      const base = streetSim({ seed: 9 });
      const snap = base.snapshot(null, "t", "");
      const d = snap.domain;
      const domain: DomainState = {
        ...d,
        inventory: { ...d.inventory, items: [...d.inventory.items, { uid: "i9", def: "tessen_uniform", rarity: "common", condition: 100 }], nextUid: d.inventory.nextUid + 1 },
        equipment: { ...d.equipment, torso: "i9" },
        difficulty: profile(patch),
      };
      const sim = Simulation.fromSnapshot({ ...snap, domain });
      for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
      for (const c of [...sim.world.with("device")]) sim.world.remove(c);
      sim.step(input({ toggleWeapon: true }));
      const p = sim.player()!;
      // The Tessen shift boss is an enforcer by key (ADR-0033).
      const boss = sim.world.add(gangerEntity(4000, { key: "c9-g0", position: { x: p.position.x, y: 0, z: p.position.z + 6 }, yaw: Math.PI }, null, 500, p.chunk ?? "", undefined, "tessen_guard"));
      run(sim, 10);
      return boss.ai!.suspicion ?? 0;
    };
    const normal = suspicion({});
    expect(normal).toBeGreaterThan(0);
    expect(normal).toBeLessThan(0.5);
    expect(suspicion({ awareness: 2 })).toBeCloseTo(2 * normal, 9);
  });

  it("a mugging's gang appears with the difficulty's health", () => {
    const muggers = (patch: Partial<DifficultyProfile>) => {
      const snap = Simulation.create({ seed: 13 }).snapshot(null, "t", "");
      const domain = { ...snap.domain, flags: ["met_fixer"], clock: { seconds: 21 * SECONDS_PER_HOUR }, difficulty: profile(patch) };
      const sim = Simulation.fromSnapshot({ ...snap, domain });
      run(sim, 1);
      teleportPlayer(sim, ground(450, -96));
      run(sim, 2);
      // The first step from here whose roll starts a mugging (as the street scenes test finds it).
      for (let t = sim.tick + 1; ; t++) {
        const r = deriveRandom(sim.seed, `micro:${t}`);
        const roll = r.next();
        if (roll < MICRO_EVENT_CHANCE && r.next() < 0.6) {
          while (sim.tick < t) sim.step();
          break;
        }
      }
      teleportPlayer(sim, ground(497, -79));
      sim.step();
      const attackers = sim.session.street2.micro?.attackers ?? [];
      return [...sim.world].filter((e) => attackers.includes(e.id)).map((e) => e.health);
    };
    const hp = Math.round(GANGER_MAX_HP * 1.5);
    expect(muggers({})).toEqual([{ current: GANGER_MAX_HP, max: GANGER_MAX_HP }, { current: GANGER_MAX_HP, max: GANGER_MAX_HP }]);
    expect(muggers({ npcHealth: 1.5 })).toEqual([{ current: hp, max: hp }, { current: hp, max: hp }]);
  });
});
