import {
  type Contract,
  type ContractKind,
  type ContractLog,
  type ContractSiteId,
  ENEMY_TYPES,
  type EnemyRank,
  type EnemyType,
  type EnemyTypeId,
  HIT_ZONES,
  type HitZone,
  INITIAL_PROGRESSION,
  LOOT_TABLES,
  type LevelBand,
  type LootLine,
  type ProgressionState,
  QUICKHACK_XP,
  type QuestDefinition,
  type RandomPort,
  type Rarity,
  RARITIES,
  type WeaponId,
  type GarmentId,
  BASE_STATS,
  HP_PER_LEVEL,
  breachXp,
  contractXp,
  createReputation,
  defenseOf,
  effectiveWeapon,
  enemyLevel,
  enemyScale,
  gainXp,
  generateContractOfKind,
  killXp,
  mitigate,
  npcWeapon,
  outfitDefense,
  rollLootFor,
  armorFor,
  type DefenderProfile,
  UNDETECTED_CONTRACT_XP,
  MIN_LEVEL,
} from "@seki/core";
import { CONTRACT_SITE_BANDS, DISTRICT_BANDS, contractLevelOf, deriveRandom } from "../src";
import type { DistrictId } from "../src/content/world-map";

/**
 * The balance model of ADR-0059 stage 8: a run through the game's content, quests and contracts
 * in order, on the sim's own formulas (contract generator, enemy level by band, XP sources, loot
 * rolls with style and bad luck) instead of the ECS, so a whole passage takes milliseconds.
 *
 * What is modelled and what is assumed (written into the ADR with the results):
 * - a district's pass is its main-thread quests and ten jobs of its givers, in order;
 * - every man a job sends is a fight the player wins (an infiltration is done unseen, without
 *   kills), each job lands one quickhack, a hack wins two daemons, four jobs in ten go unseen;
 * - the player fights with a common gun and wears a common jacket of her own level (a shop's
 *   stock, ADR-0059 stage 4), so time of combat shows the levels, not the luck of the loot;
 * - a fight's time is hits to down the other side, mixed over the zones by `HIT_MIX`;
 * - the player's style is empty, so the loot is the tables' own (style moves weights only).
 */

/** Where shots land in a fight, for the time of combat: mostly the body. */
export const HIT_MIX: Readonly<Record<HitZone, number>> = { head: 0.1, torso: 0.5, arm: 0.2, leg: 0.2 };

/** One district of the passage. */
export interface DistrictPass {
  readonly district: DistrictId;
  /** The district's main thread, in order; each step's XP comes after a job, spread evenly. */
  readonly quests: readonly QuestDefinition[];
  /** Fights of the quests themselves (the courier and his guard, Kagami's cleaners). */
  readonly questFights: readonly { readonly type: EnemyTypeId; readonly count: number; readonly band: DistrictId }[];
  /** Jobs in order. */
  readonly jobs: readonly ContractKind[];
  /** Sites a job may fall on here (Kaito's eliminations roll among five, two districts). */
  readonly sites?: readonly ContractSiteId[];
  /** Who the jobs send. */
  readonly foe: EnemyTypeId;
  /** The player's gun and jacket for the time of combat. */
  readonly gun: WeaponId;
  readonly jacket: GarmentId;
}

/** A fight of the passage: levels and the time of combat against the band's floor. */
export interface FightSample {
  readonly district: DistrictId;
  readonly player: number;
  readonly enemy: number;
  /** Time the player needs to down the enemy, over the same at the band's floor. */
  readonly ttk: number;
  /** Time the enemy needs to down the player, over the same at the band's floor. */
  readonly ttd: number;
}

export interface DistrictResult {
  readonly district: DistrictId;
  readonly from: number;
  readonly to: number;
  readonly xp: number;
}

export interface PassageResult {
  readonly districts: readonly DistrictResult[];
  readonly fights: readonly FightSample[];
  /** Rolled pieces of the player's bags, in order. */
  readonly pieces: readonly { readonly level: number; readonly rarity: Rarity }[];
  /** Longest run of rolled pieces below rare. */
  readonly worstRun: number;
}

const mixed = (perZone: (zone: HitZone) => number): number => HIT_ZONES.reduce((sum, z) => sum + HIT_MIX[z] * perZone(z), 0);

/** Mean damage of a hit after armor, over the hit mix. */
const meanHit = (damage: number, zones: Readonly<Record<HitZone, number>> | undefined, defender: DefenderProfile): number =>
  mixed((z) => mitigate(damage * (zones?.[z] ?? 1), armorFor(defender, z)));

/** Seconds of fire the player needs against `type` at `enemy`, with her common `gun` of `player`. */
export const timeToKill = (type: EnemyTypeId, enemy: number, gun: WeaponId, player: number): number => {
  const def: EnemyType = ENEMY_TYPES[type];
  const w = effectiveWeapon(gun, "common", [], { level: player });
  const hp = def.hp * enemyScale(enemy);
  return (hp / meanHit(w.damage, w.zones, outfitDefense(def.outfit))) * w.interval;
};

/** Seconds of fire `type` at `enemy` needs against the player of `player` in her common `jacket`. */
export const timeToDie = (type: EnemyTypeId, enemy: number, jacket: GarmentId, player: number): number => {
  const def: EnemyType = ENEMY_TYPES[type];
  const w = npcWeapon(def.weapon);
  const hp = BASE_STATS.maxHp + HP_PER_LEVEL * (player - MIN_LEVEL);
  const worn = defenseOf(BASE_STATS, [{ def: jacket, rarity: "common", condition: 100, level: player }]);
  return (hp / meanHit(w.damage * enemyScale(enemy), w.zones, worn)) * w.interval;
};

const rankOf = (type: EnemyTypeId): EnemyRank => (ENEMY_TYPES[type] as EnemyType).rank ?? "regular";

/** The run's state as it goes. */
interface Run {
  progression: ProgressionState;
  pity: number;
  worstRun: number;
  run: number;
  log: ContractLog;
  readonly fights: FightSample[];
  readonly pieces: { level: number; rarity: Rarity }[];
  readonly rng: RandomPort;
  readonly seed: number;
  drops: number;
}

const gain = (r: Run, xp: number): void => {
  r.progression = gainXp(r.progression, xp).state;
};

const lootOf = (r: Run, type: EnemyTypeId, level: number): void => {
  const def: EnemyType = ENEMY_TYPES[type];
  const key = `drop-${r.drops++}`;
  const grade = { source: level, player: r.progression.level, rng: deriveRandom(r.seed, `${key}:grade`) };
  const out = rollLootFor(LOOT_TABLES[def.loot], deriveRandom(r.seed, key), grade, { style: [], pity: r.pity });
  r.pity = out.pity ?? r.pity;
  for (const line of out.lines) recordPiece(r, line, def.loot);
};

const recordPiece = (r: Run, line: LootLine, table: keyof typeof LOOT_TABLES): void => {
  if (line.kind !== "item") return;
  const rolled = [...LOOT_TABLES[table].entries, ...LOOT_TABLES[table].guaranteed].some((e) => e.item === line.item && e.rarity === "roll");
  if (!rolled) return;
  r.pieces.push({ level: line.level ?? MIN_LEVEL, rarity: line.rarity });
  r.run = RARITIES.indexOf(line.rarity) >= RARITIES.indexOf("rare") ? 0 : r.run + 1;
  r.worstRun = Math.max(r.worstRun, r.run);
};

/** One fight won against `type` in the band of `band`: kill XP, the bag and the time of combat. */
const fight = (r: Run, pass: DistrictPass, type: EnemyTypeId, band: LevelBand): void => {
  const player = r.progression.level;
  const enemy = enemyLevel(player, band, rankOf(type));
  const floor = enemyLevel(band.min, band, rankOf(type));
  const ttk = timeToKill(type, enemy, pass.gun, player) / timeToKill(type, floor, pass.gun, band.min);
  const ttd = timeToDie(type, enemy, pass.jacket, player) / timeToDie(type, floor, pass.jacket, band.min);
  r.fights.push({ district: pass.district, player, enemy, ttk, ttd });
  gain(r, killXp(type, enemy, player));
  lootOf(r, type, enemy);
};

const contractOf = (r: Run, kind: ContractKind, sites: readonly ContractSiteId[] | undefined): Contract => {
  const ctx = {
    log: r.log,
    reputation: createReputation(),
    flags: [],
    tick: 0,
    ticksPerSecond: 60,
    levelAt: (site: ContractSiteId) => contractLevelOf(r.progression.level, site),
  };
  for (;;) {
    const c = generateContractOfKind(kind, ctx, r.rng);
    if (!sites || sites.includes(c.siteId)) return c;
  }
};

/** One job done: its fights, a quickhack, the breach of a hack, the pay in XP and the unseen bonus. */
const job = (r: Run, pass: DistrictPass, kind: ContractKind, index: number): void => {
  const c = contractOf(r, kind, pass.sites);
  const band = DISTRICT_BANDS[CONTRACT_SITE_BANDS[c.siteId]];
  if (kind !== "infiltrate") for (let i = 0; i < c.targets; i++) fight(r, pass, pass.foe, band);
  gain(r, QUICKHACK_XP);
  if (kind === "hack") gain(r, breachXp(2));
  gain(r, contractXp(kind, c.targets, contractLevelOf(r.progression.level, c.siteId)));
  if (kind === "infiltrate" || index % 5 === 1 || index % 5 === 3) gain(r, UNDETECTED_CONTRACT_XP);
  r.log = { ...r.log, active: null, completed: r.log.completed + 1 };
};

/** The quest XP of a district in the order it comes: each step, then the quest itself after its last. */
const questGains = (quests: readonly QuestDefinition[]): number[] =>
  quests.flatMap((q) => q.steps.map((s, i) => (s.xp ?? 0) + (i === q.steps.length - 1 ? (q.xp ?? 0) : 0)));

const district = (r: Run, pass: DistrictPass): DistrictResult => {
  const from = r.progression.level;
  const xp0 = r.progression.xp;
  for (const f of pass.questFights) for (let i = 0; i < f.count; i++) fight(r, pass, f.type, DISTRICT_BANDS[f.band]);
  const steps = questGains(pass.quests);
  let next = 0;
  pass.jobs.forEach((kind, i) => {
    job(r, pass, kind, i);
    while (next < steps.length && next * pass.jobs.length <= i * steps.length) gain(r, steps[next++] ?? 0);
  });
  while (next < steps.length) gain(r, steps[next++] ?? 0);
  return { district: pass.district, from, to: r.progression.level, xp: r.progression.xp - xp0 };
};

/** The whole passage with one seed. */
export const runPassage = (passes: readonly DistrictPass[], seed: number): PassageResult => {
  const r: Run = {
    progression: INITIAL_PROGRESSION,
    pity: 0,
    worstRun: 0,
    run: 0,
    log: { active: null, completed: 0 },
    fights: [],
    pieces: [],
    rng: deriveRandom(seed, "balance:contracts"),
    seed,
    drops: 0,
  };
  const districts = passes.map((p) => district(r, p));
  return { districts, fights: r.fights, pieces: r.pieces, worstRun: r.worstRun };
};

/** Shares of the rolled tiers, common to legendary, and the longest run below rare. */
export interface RarityShares {
  readonly shares: Readonly<Record<Rarity, number>>;
  readonly worstRun: number;
}

const ENFORCER_ROLLED = new Set<string>(
  [...LOOT_TABLES.hebi_enforcer.entries, ...LOOT_TABLES.hebi_enforcer.guaranteed].filter((e) => e.rarity === "roll").map((e) => e.item),
);

/**
 * `count` rolled pieces of item level `level` from Hebi enforcers' bags (a guaranteed shotgun and
 * three draws) of an enemy and a player of that level: with `pity` the player's own bags with the
 * protection against bad luck, without it the tables alone. Only pieces of exactly `level` count
 * to the shares, since an enemy's loot is its level ±1; every rolled piece counts to the run.
 */
export const raritySample = (level: number, count: number, seed: number, pity: boolean): RarityShares => {
  const tally: Record<Rarity, number> = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, unique: 0 };
  let luck = 0;
  let run = 0;
  let worstRun = 0;
  let pieces = 0;
  for (let bag = 0; pieces < count; bag++) {
    const key = `sample-${level}-${bag}`;
    const grade = { source: level, player: level, rng: deriveRandom(seed, `${key}:grade`) };
    const out = rollLootFor(LOOT_TABLES.hebi_enforcer, deriveRandom(seed, key), grade, pity ? { style: [], pity: luck } : { style: [] });
    luck = out.pity ?? luck;
    for (const line of out.lines) {
      if (line.kind !== "item" || !ENFORCER_ROLLED.has(line.item)) continue;
      run = RARITIES.indexOf(line.rarity) >= RARITIES.indexOf("rare") ? 0 : run + 1;
      worstRun = Math.max(worstRun, run);
      if (line.level !== level) continue;
      tally[line.rarity]++;
      pieces++;
    }
  }
  const shares = Object.fromEntries(RARITIES.map((t) => [t, tally[t] / pieces])) as Record<Rarity, number>;
  return { shares, worstRun };
};
