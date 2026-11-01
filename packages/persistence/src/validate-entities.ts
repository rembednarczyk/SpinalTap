import { ENEMY_TYPES } from "@seki/core";

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isVec = (v: unknown): boolean => isObject(v) && isNum(v.x) && isNum(v.y) && isNum(v.z);
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

const isTime = (v: unknown): boolean => isNum(v) && v >= 0;
const SNIPER_PHASES: readonly unknown[] = ["idle", "aim", "rest", "move"];

/** G-185: an NPC's gun between shots, and a sniper's phase, seconds left and perch. */
const isGun = (v: unknown): boolean => isObject(v) && Number.isInteger(v.loaded) && (v.loaded as number) >= 0 && isTime(v.reloading) && isTime(v.drawing) && isTime(v.bloom);
const isSniper = (v: unknown): boolean => isObject(v) && SNIPER_PHASES.includes(v.phase) && isTime(v.timer) && Number.isInteger(v.perch) && (v.perch as number) >= 0;

const BODY_FLAGS = ["fought", "found", "reported", "dead", "carried", "hidden"] as const;

/** A body of ADR-0065: where the player stood, and its flags. */
const isBody = (v: unknown): boolean => isObject(v) && isVec(v.playerAt) && BODY_FLAGS.every((k) => typeof v[k] === "boolean");

/** The saved state of one entity: keyed, or one of the heat's reinforcements (G-179). */
export const findEntityError = (e: unknown): string | null => {
  if (!isObject(e) || typeof e.key !== "string" || !isVec(e.position)) return "entity shape";
  if (!isNum(e.yaw) || !isNum(e.pitch) || !isNum(e.cooldown) || typeof e.alerted !== "boolean") return `entity ${e.key}`;
  if (e.hp !== null && !isNum(e.hp)) return `entity ${e.key} hp`;
  if (e.maxHp !== undefined && !(isNum(e.maxHp) && e.maxHp > 0)) return `entity ${e.key} hp`;
  if ((e.lastKnown !== undefined && !isVec(e.lastKnown)) || (e.search !== undefined && !isNum(e.search)) || (e.lost !== undefined && !isNum(e.lost))) {
    return `entity ${e.key} search`;
  }
  if (e.downed !== undefined && !isBody(e.downed)) return `entity ${e.key} downed`;
  // G-174: a guard not sure yet, between nothing seen (not saved) and sure.
  if (e.suspicion !== undefined && !(isNum(e.suspicion) && e.suspicion > 0 && e.suspicion <= 1)) return `entity ${e.key} suspicion`;
  // G-188: seconds outside every loaded chunk of an AI pinned in the world.
  if (e.away !== undefined && !(isNum(e.away) && e.away >= 0)) return `entity ${e.key} away`;
  if (e.gun !== undefined && !isGun(e.gun)) return `entity ${e.key} gun`;
  if (e.sniper !== undefined && !isSniper(e.sniper)) return `entity ${e.key} sniper`;
  return null;
};

/**
 * One reinforcement (G-179): which of the heat's, the tick it came in at (G-202), a known enemy
 * type, its entry and its state, keyed by `n`.
 */
const findReinforcementError = (p: unknown): string | null => {
  if (!isObject(p) || !isCount(p.n) || !Number.isInteger(p.since) || (p.since as number) < 0) return "reinforcements";
  if (typeof p.type !== "string" || !Object.hasOwn(ENEMY_TYPES, p.type) || !isVec(p.home)) return "reinforcements";
  if (findEntityError(p.state) || (p.state as Json).key !== `security:${p.n}`) return "reinforcements";
  return null;
};

/** The heat's reinforcements (G-179): a count sent and a wait not negative, none twice and none past the count. */
export const findReinforcementsError = (r: unknown): string | null => {
  if (r === undefined) return null;
  if (!isObject(r) || !Number.isInteger(r.sent) || (r.sent as number) < 0 || !isNum(r.wait) || r.wait < 0 || !Array.isArray(r.people)) return "reinforcements";
  const seen = new Set<number>();
  for (const p of r.people) {
    const error = findReinforcementError(p);
    if (error) return error;
    const n = (p as Json).n as number;
    if (seen.has(n) || n > (r.sent as number)) return "reinforcements";
    seen.add(n);
  }
  return null;
};
