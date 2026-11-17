import { describe, expect, it } from "vitest";
import { DIFFICULTY_PRESETS, type DifficultyPresetId, ENEMY_TYPES, type EnemyTypeId, INITIAL_PROGRESSION, type Vec3, xpForLevel } from "@seki/core";
import { type Entity, SIM_HZ, Simulation, gangerEntity } from "../src";
import { enemyScalingOf } from "../src/world/enemy-grade";
import { toughen } from "../src/world/factory";
import { aimOrigin, chestOf, eyeOf, lineOfSight } from "../src/world/hitscan";
import { EAST_YARD, setProfile } from "./difficulty-scenes";
import { STREET_START, input, teleportPlayer } from "./helpers";

/*
 * The pace of a fight with one enemy (ADR-0089, stage 1): how long a bot of the player takes to
 * kill it, and how long it takes to kill a player who stands and does nothing. The bot aims at
 * where the enemy was 0.15 s before (its reaction) and fires through the spread of her own gun;
 * the enemy starts alerted 20 m off, alone. Stage 1 writes down today's numbers; stage 5 tunes
 * the enemy to `PACE_TARGETS` and turns these bands into them.
 *
 * The scenes stand the player in the enemy's band with a gun of her level (the ADR's condition for
 * the targets): Plac Litewski at level 1 (Krakowskie's band 1-8) and W-3's east yard at 16 (the
 * docks' band 16-30), her Unity-9 and clothes of that level. The audit of 17.11 fought in the yard
 * at level 1, 14 m off, against enemies of level 16: Hebi down in 1.4-1.7 s and she in 39-48 s,
 * Tessen 2.3-3.1 s and 9-13.5 s (this bot); in the band she lasts two to three times longer.
 */

/** Stage 5's targets (ADR-0089, the user's decision of 17.11): on Normal, in the band, seconds. */
export const PACE_TARGETS = {
  hebi_ganger: { kill: [1.8, 3], die: [10, 14] },
  hebi_enforcer: { kill: [3, 4.5], die: [6, 9] },
  tessen_guard: { kill: [3, 4.5], die: [7, 10] },
  /** Hard against Normal: death in at most 0.65 of the time, the kill in at least 1.25. */
  hard: { die: 0.65, kill: 1.25 },
  /** Story against Normal: death in at least 1.6 of the time. */
  story: { die: 1.6 },
} as const;

type Scene = "plac" | "w3";
type Foe = "hebi_ganger" | "hebi_enforcer" | "tessen_guard";

const SCENES: Readonly<Record<Scene, { readonly at: Vec3; readonly level: number }>> = {
  plac: { at: STREET_START, level: 1 },
  w3: { at: EAST_YARD, level: 16 },
};
const SEEDS = [1, 2, 3] as const;
/** The bot's reaction: it aims at where the enemy was this many steps before (0.15 s). */
const REACTION = Math.round(0.15 * SIM_HZ);
const DISTANCE = 20;
/** Longest a kill may take before the test gives up. */
const KILL_CAP = 10;
/** The passive player is watched this long, not to her death (ADR-0083: short tests); past it she "outlives the cap". */
const DIE_CAP = 30;

/**
 * Bands of today in seconds: the range over seeds 1-10 with about a shot (0.29 s) or 10% to spare
 * (the test plays seeds 1-3; the bands hold the others too).
 * `die: [lo, null]`: no death before `lo`, and she may outlive the cap; `[DIE_CAP, null]`: she outlives it.
 */
interface Pace {
  readonly kill: readonly [number, number];
  readonly die: readonly [number, number | null];
}

/*
 * Today (origin/main 9473b76), seconds; per seed 1, 2, 3 (the test's), then the range over seeds
 * 1-10 (a probe; deaths of seeds 4-10 watched to 60 s, of 1-3 to 150 s; ">": still alive).
 * Kill: the bot's; death: the passive player's.
 * Plac Litewski, level 1
 *   hebi_ganger    story  kill 0.87 0.87 0.87 (0.58-0.87)  death >150 >150 >150
 *                  normal kill 1.15 1.15 0.87 (0.87-1.15)  death 88.7 92.2 103.8 (>60 for 4-10)
 *                  hard   kill 1.43 1.43 1.15 (1.15-1.43)  death 39.3 68.6 51.0 (34.2->60)
 *   hebi_enforcer  story  kill 1.43 1.72 1.43 (1.43-1.72)  death >150 >150 >150
 *                  normal kill 2.00 2.00 2.00 (1.43-2.00)  death 44.0 49.8 49.5 (36.7->60)
 *                  hard   kill 2.28 2.57 2.00 (2.00-2.57)  death 26.0 25.2 31.0 (20.9-31.4)
 *   tessen_guard   story  kill 1.15 1.43 1.43 (1.15-1.43)  death >150 113.1 122.4
 *                  normal kill 1.72 1.43 2.00 (1.43-2.00)  death 27.2 52.5 32.9 (27.1-52.5)
 *                  hard   kill 2.00 2.00 2.28 (2.00-2.28)  death 15.4 13.2 20.4 (7.1-22.2)
 * W-3's east yard, level 16
 *   hebi_ganger    story  kill 0.87 0.87 0.87 (0.58-0.87)  death >150 >150 >150
 *                  normal kill 1.15 0.87 0.87 (0.87-1.15)  death 67.5 73.9 78.9 (56.6->60)
 *                  hard   kill 1.43 1.15 1.15 (0.87-1.43)  death 34.9 62.2 41.4 (32.1->60)
 *   hebi_enforcer  story  kill 1.43 1.43 1.43 (1.15-1.43)  death >150 110.9 146.4
 *                  normal kill 1.72 2.00 1.72 (1.43-2.00)  death 30.9 36.6 32.9 (27.1-49.5)
 *                  hard   kill 2.28 2.28 2.00 (1.72-2.28)  death 16.8 20.1 19.6 (12.7-21.0)
 *   tessen_guard   story  kill 1.15 1.15 1.43 (1.15-1.43)  death 124.5 94.1 113.1
 *                  normal kill 1.43 1.43 1.72 (1.43-1.72)  death 21.3 41.0 30.8 (21.3-41.0)
 *                  hard   kill 1.72 1.72 2.00 (1.72-2.00)  death 13.3 10.9 16.1 (6.0-20.9)
 * Against the targets: every kill is fast (0.9-2.0 s on Normal against 1.8-4.5 s) and the passive
 * player lives far too long against Hebi (57-104 s against 10-14 s); the enforcer, which today
 * closes to 10.8 m (G-917), kills her in 27-57 s against 6-9 s; Tessen in 21-53 s against 7-10 s.
 * Hard kills her in 0.4-0.7 of Normal's time and takes 1.0-1.3 of it to kill the enemy; Story
 * keeps her alive two to four times as long or more.
 *
 * Stage 3 (17.11, the bursts with a pause and the sidesteps) moved five of them, all the longer
 * way, and the bands with them (seeds 1-10, as above): Plac Litewski, tessen_guard normal kill
 * 1.43-2.57, hard kill 1.72-2.85 and death 9.9-28.4; hebi_enforcer hard death 16.8-38.2; W-3,
 * hebi_enforcer hard death 13.0-24.3, tessen_guard hard kill 1.72-2.57. The rest holds.
 */
const TODAY: Readonly<Record<Scene, Readonly<Record<Foe, Readonly<Record<DifficultyPresetId, Pace>>>>>> = {
  plac: {
    hebi_ganger: { story: { kill: [0.3, 1.2], die: [DIE_CAP, null] }, normal: { kill: [0.55, 1.45], die: [DIE_CAP, null] }, hard: { kill: [0.85, 1.75], die: [DIE_CAP, null] } },
    hebi_enforcer: { story: { kill: [1.1, 2.0], die: [DIE_CAP, null] }, normal: { kill: [1.1, 2.3], die: [DIE_CAP, null] }, hard: { kill: [1.7, 2.9], die: [15, null] } },
    tessen_guard: { story: { kill: [0.85, 1.75], die: [DIE_CAP, null] }, normal: { kill: [1.1, 2.9], die: [24, null] }, hard: { kill: [1.4, 3.15], die: [6, 30] } },
  },
  w3: {
    hebi_ganger: { story: { kill: [0.3, 1.2], die: [DIE_CAP, null] }, normal: { kill: [0.55, 1.45], die: [DIE_CAP, null] }, hard: { kill: [0.55, 1.75], die: [28, null] } },
    hebi_enforcer: { story: { kill: [0.85, 1.75], die: [DIE_CAP, null] }, normal: { kill: [1.1, 2.3], die: [24, null] }, hard: { kill: [1.4, 2.6], die: [11, 27] } },
    tessen_guard: { story: { kill: [0.85, 1.75], die: [DIE_CAP, null] }, normal: { kill: [1.1, 2.0], die: [19, null] }, hard: { kill: [1.4, 2.9], die: [5, 24] } },
  },
};

const alive = (e: Entity): boolean => (e.health?.current ?? 0) > 0;

/** A new game of `seed` with the player at `level`, her kit of that level, as a load builds it. */
const gameAt = (seed: number, level: number): Simulation => {
  const sim = Simulation.create({ seed });
  if (level === INITIAL_PROGRESSION.level) return sim;
  const snap = sim.snapshot(null, "t", "");
  const items = snap.domain.inventory.items.map((i) => (i.level === undefined ? i : { ...i, level }));
  const domain = { ...snap.domain, inventory: { ...snap.domain.inventory, items }, progression: { ...INITIAL_PROGRESSION, level, xp: xpForLevel(level) } };
  return Simulation.fromSnapshot({ ...snap, domain });
};

/** The player in `scene` on `preset`, at full health, and one alerted `type` of the band 20 m north of her, nobody else hostile. */
const duel = (scene: Scene, type: Foe, preset: DifficultyPresetId, seed: number) => {
  const sim = gameAt(seed, SCENES[scene].level);
  teleportPlayer(sim, SCENES[scene].at, 0);
  sim.step();
  setProfile(sim, DIFFICULTY_PRESETS[preset]);
  for (const e of [...sim.world.with("enemy")]) sim.world.remove(e);
  const p = sim.player()!;
  p.health = { current: p.health!.max, max: p.health!.max };
  const at: Vec3 = { ...p.position, z: p.position.z + DISTANCE };
  const g = gangerEntity(90089, { key: "pace", position: at, yaw: Math.PI }, null, ENEMY_TYPES[type].hp, sim.streamer.chunkIdAt(at), undefined, type as EnemyTypeId);
  toughen(g, enemyScalingOf(sim.domain, (q) => sim.streamer.districtAt(q)));
  g.ai!.alerted = true;
  sim.world.add(g);
  return { sim, p, g };
};

/** Points the player's aim at `target`'s chest standing at `at`, from where her shots start. */
const aimAt = (sim: Simulation, p: Entity, target: Entity, at: Vec3): void => {
  const o = aimOrigin(p, sim.domain.preferences.cameraMode);
  const c = chestOf({ ...target, position: at });
  p.yaw = Math.atan2(c.x - o.x, c.z - o.z);
  p.pitch = -Math.atan2(c.y - o.y, Math.hypot(c.x - o.x, c.z - o.z));
};

/** Seconds the bot takes to kill the enemy, sights up, firing whenever it sees it; null past `KILL_CAP` or at her death. */
const timeToKill = (scene: Scene, type: Foe, preset: DifficultyPresetId, seed: number): number | null => {
  const { sim, p, g } = duel(scene, type, preset, seed);
  const seen: Vec3[] = [];
  for (let t = 0; t < KILL_CAP * SIM_HZ; t++) {
    if (!alive(g)) return t / SIM_HZ;
    if (!alive(p)) return null;
    seen.push({ ...g.position });
    aimAt(sim, p, g, seen[Math.max(0, seen.length - 1 - REACTION)]!);
    sim.step(input({ fire: lineOfSight(sim.world, eyeOf(p), chestOf(g)), aim: true }));
  }
  return null;
};

/** Seconds the enemy takes to kill a player who does nothing; null if she outlives `DIE_CAP`. */
const timeToDie = (scene: Scene, type: Foe, preset: DifficultyPresetId, seed: number): number | null => {
  const { sim, p } = duel(scene, type, preset, seed);
  for (let t = 0; t < DIE_CAP * SIM_HZ; t++) {
    if (!alive(p)) return t / SIM_HZ;
    sim.step();
  }
  return alive(p) ? null : DIE_CAP;
};

const CASES = (["plac", "w3"] as const).flatMap((scene) =>
  (["hebi_ganger", "hebi_enforcer", "tessen_guard"] as const).flatMap((type) => (["story", "normal", "hard"] as const).map((preset) => [scene, type, preset] as const)),
);

describe("the pace of a fight with one enemy, today (ADR-0089, stage 1)", () => {
  it.each(CASES)("%s, %s on %s: the bot's kill and the passive player's death in today's bands", (scene, type, preset) => {
    const pace = TODAY[scene][type][preset];
    const [dieLo, dieHi] = pace.die;
    for (const seed of SEEDS) {
      const kill = timeToKill(scene, type, preset, seed);
      expect(kill, `kill, seed ${seed}`).not.toBeNull();
      expect(kill!, `kill, seed ${seed}`).toBeGreaterThanOrEqual(pace.kill[0]);
      expect(kill!, `kill, seed ${seed}`).toBeLessThanOrEqual(pace.kill[1]);
      const die = timeToDie(scene, type, preset, seed);
      if (dieHi === null) {
        if (die !== null) expect(die, `death, seed ${seed}`).toBeGreaterThanOrEqual(dieLo);
      } else {
        expect(die, `death, seed ${seed}`).not.toBeNull();
        expect(die!, `death, seed ${seed}`).toBeGreaterThanOrEqual(dieLo);
        expect(die!, `death, seed ${seed}`).toBeLessThanOrEqual(dieHi);
      }
    }
  });
});
