import {
  FACTIONS,
  SAVE_SCHEMA_VERSION,
  type SaveSnapshot,
  isCyberwareId,
  isMemoryId,
} from "@seki/core";

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isVec = (v: unknown): boolean => isObject(v) && isNum(v.x) && isNum(v.y) && isNum(v.z);

/** Returns a description of the first problem found, or null when the payload is a valid current-version snapshot. */
export const findSchemaError = (s: Json): string | null => {
  if (s.version !== SAVE_SCHEMA_VERSION) return "wrong version";
  if (!isNum(s.seed) || !isNum(s.rngState) || !isNum(s.tick)) return "seed/rngState/tick";
  if (!Array.isArray(s.entities)) return "entities";
  for (const e of s.entities) {
    if (!isObject(e) || typeof e.key !== "string" || !isVec(e.position)) return "entity shape";
    if (!isNum(e.yaw) || !isNum(e.pitch) || !isNum(e.cooldown) || typeof e.alerted !== "boolean") return `entity ${e.key}`;
    if (e.hp !== null && !isNum(e.hp)) return `entity ${e.key} hp`;
  }
  const d = s.domain;
  if (!isObject(d)) return "domain";
  const c = d.character;
  if (!isObject(c) || !(c.alias === null || typeof c.alias === "string")) return "character";
  if (!Array.isArray(c.memories) || !c.memories.every((m) => typeof m === "string" && isMemoryId(m))) return "memories";
  if (!isObject(c.cyberware) || !Object.values(c.cyberware).every((id) => typeof id === "string" && isCyberwareId(id))) return "cyberware";
  if (!isObject(d.wallet) || !Number.isInteger(d.wallet.eddies) || (d.wallet.eddies as number) < 0) return "wallet";
  if (!isObject(d.reputation) || !Object.keys(FACTIONS).every((f) => isNum((d.reputation as Json)[f]))) return "reputation";
  if (!isObject(d.quests)) return "quests";
  for (const q of Object.values(d.quests)) {
    if (!isObject(q)) return "quest progress";
    if (q.status === "active" ? !Number.isInteger(q.stepIndex) : q.status !== "completed") return "quest progress";
  }
  if (!Array.isArray(d.flags) || !d.flags.every((f) => typeof f === "string")) return "flags";
  if (!isObject(d.preferences) || (d.preferences.cameraMode !== "FPP" && d.preferences.cameraMode !== "TPP")) return "preferences";
  if (!(s.narrative === null || typeof s.narrative === "string")) return "narrative";
  if (!isObject(s.meta) || typeof s.meta.label !== "string" || typeof s.meta.objective !== "string") return "meta";
  return null;
};

export const isSaveSnapshot = (s: Json): s is Json & SaveSnapshot => findSchemaError(s) === null;
