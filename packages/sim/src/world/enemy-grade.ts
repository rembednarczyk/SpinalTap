import {
  type ContractSiteId,
  type DomainState,
  ENEMY_TYPES,
  type EnemyRank,
  type EnemyType,
  MIN_LEVEL,
  type Vec3,
  enemyLevel,
  enemyScale,
  npcWeapon,
} from "@seki/core";
import type { World } from "miniplex";
import { CONTRACT_SITE_DISTRICTS, DISTRICT_BANDS, bandOf } from "../content/district-bands";
import type { DistrictId } from "../content/world-map";
import type { Entity } from "./components";

/**
 * What makes a hostile NPC as tough as it appears: the difficulty's `npcHealth` (ADR-0066) and
 * its level (ADR-0059), the player's kept within the band of the district it belongs to.
 */
export interface EnemyScaling {
  readonly npcHealth: number;
  readonly playerLevel: number;
  /** The district of a point; without it no band holds and an enemy is of the player's level. */
  readonly districtAt?: (p: Vec3) => DistrictId | null;
}

/** The scaling of the domain's difficulty and player, with the districts of `districtAt`. */
export const enemyScalingOf = (domain: DomainState, districtAt?: (p: Vec3) => DistrictId | null): EnemyScaling =>
  districtAt
    ? { npcHealth: domain.difficulty.npcHealth, playerLevel: domain.progression.level, districtAt }
    : { npcHealth: domain.difficulty.npcHealth, playerLevel: domain.progression.level };

/**
 * An enemy's rank (ADR-0059): Tessen's shift boss (the enforcer of a docks crew, ADR-0033) is a
 * boss, an elite type (a Hebi enforcer, Kagami's cleaners) an elite, everyone else a regular.
 */
export const enemyRankOf = (e: Entity): EnemyRank => {
  if (!e.enemy) return "regular";
  if (e.faction === "tessen" && e.ai?.enforcer) return "boss";
  return (ENEMY_TYPES[e.enemy.type] as EnemyType).rank ?? "regular";
};

/** Maximum health of an enemy of the content's `base` at `level`, in whole points. */
export const enemyMaxHp = (base: number, npcHealth: number, level: number): number => Math.max(1, Math.round(base * npcHealth * enemyScale(level)));

/** Its weapon hits as hard as its level makes it (ADR-0059): +4% a level, as an item's level does. */
const scaleDamage = (e: Entity, level: number): void => {
  const c = e.combatant;
  if (!c?.stats || !c.weapon) return;
  const base = npcWeapon(c.weapon);
  c.stats = { ...c.stats, damage: base.damage * enemyScale(level) };
};

/**
 * Gives a freshly built enemy its level: from the district of its home (where it was put, which
 * a save rebuilds it at) and the player's level, with its rank. Its weapon's damage follows;
 * the caller (`toughen`) scales its health. Returns the level.
 */
export const gradeEnemy = (e: Entity, s: EnemyScaling): number => {
  if (!e.enemy) return MIN_LEVEL;
  const band = bandOf(s.districtAt?.(e.ai?.home ?? e.position) ?? null);
  const level = enemyLevel(s.playerLevel, band, enemyRankOf(e));
  e.enemy = { ...e.enemy, level, band, npcHealth: s.npcHealth };
  if (level !== MIN_LEVEL) scaleDamage(e, level);
  return level;
};

/**
 * The player went up a level (ADR-0059): the world inside a band keeps up with her. Every graded
 * enemy whose level that changes gets the health it would be built with now, at the same share
 * of it, and its weapon's damage, so a save loaded later builds it exactly as it stands.
 */
export const regradeEnemies = (world: World<Entity>, playerLevel: number): void => {
  for (const e of world.with("enemy", "health")) {
    const g = e.enemy;
    if (g.level === undefined || e.baseHp === undefined) continue;
    const level = enemyLevel(playerLevel, g.band ?? null, enemyRankOf(e));
    if (level === g.level) continue;
    const max = enemyMaxHp(e.baseHp, g.npcHealth ?? 1, level);
    const hp = e.health.current;
    const current = hp <= 0 ? hp : Math.min(max, Math.max(1, Math.round((max * hp) / e.health.max)));
    e.health = { current, max };
    e.enemy = { ...g, level };
    scaleDamage(e, level);
  }
};

/** The level of a contract at `site` (ADR-0059): that of a regular enemy in its district. */
export const contractLevelOf = (playerLevel: number, site: ContractSiteId): number => enemyLevel(playerLevel, DISTRICT_BANDS[CONTRACT_SITE_DISTRICTS[site]]);
