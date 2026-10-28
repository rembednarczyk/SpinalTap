import {
  FACTIONS,
  QUICKHACK_IDS,
  isFactionId,
  isContractKind,
  isContractSiteId,
  SAVE_SCHEMA_VERSION,
  type SaveSnapshot,
  isCyberwareId,
  isMemoryId,
  isEndingId,
  isActTwoEndingId,
  isStoryChoiceId,
  isStoryOption,
} from "@seki/core";
import { findItemsError } from "./validate-items";

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
    if ((e.lastKnown !== undefined && !isVec(e.lastKnown)) || (e.search !== undefined && !isNum(e.search)) || (e.lost !== undefined && !isNum(e.lost))) {
      return `entity ${e.key} search`;
    }
  }
  const st = s.streaming;
  if (!isObject(st) || !Array.isArray(st.loadedChunks) || !st.loadedChunks.every((c) => typeof c === "string")) return "streaming";
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
  const itemsError = findItemsError(d);
  if (itemsError) return itemsError;
  const contracts = d.contracts;
  if (!isObject(contracts) || !Number.isInteger(contracts.completed) || (contracts.completed as number) < 0) return "contracts";
  const active = contracts.active;
  if (active !== null) {
    if (!isObject(active) || typeof active.id !== "string" || typeof active.siteId !== "string" || !isContractSiteId(active.siteId)) {
      return "contracts";
    }
    if (!Number.isInteger(active.targets) || !Number.isInteger(active.reward) || (active.status !== "active" && active.status !== "cleared")) {
      return "contracts";
    }
    // M4 fields are optional, so v6 saves from before them stay valid as they are.
    if (active.kind !== undefined && (typeof active.kind !== "string" || !isContractKind(active.kind))) return "contract kind";
    if (active.deadlineTick !== undefined && (!Number.isInteger(active.deadlineTick) || (active.deadlineTick as number) < 0)) return "contract deadline";
    // A hack's clock (ADR-0024): ticks connected and ticks away, both whole and not negative.
    for (const field of ["progress", "away"] as const) {
      const n = active[field];
      if (n !== undefined && (!Number.isInteger(n) || (n as number) < 0)) return "contract progress";
    }
    if (active.breach !== undefined && (!Array.isArray(active.breach) || !active.breach.every((x) => typeof x === "string"))) return "contract breach";
  }
  if (contracts.tally !== undefined && contracts.tally !== null && findTallyError(contracts.tally)) return "contract tally";
  const heatError = findHeatError(d.heat) ?? findNetrunError(d.netrun);
  if (heatError) return heatError;
  if (!isObject(d.ability) || !isNum(d.ability.activeTime) || !isNum(d.ability.cooldown)) return "ability";
  const story = d.story;
  if (!isObject(story) || !isObject(story.choices)) return "story";
  for (const [choice, option] of Object.entries(story.choices)) {
    if (!isStoryChoiceId(choice) || typeof option !== "string" || !isStoryOption(choice, option)) return "story choices";
  }
  if (!(story.ending === null || (typeof story.ending === "string" && isEndingId(story.ending)))) return "story ending";
  if (!(story.act2Ending === null || (typeof story.act2Ending === "string" && isActTwoEndingId(story.act2Ending)))) return "story ending";
  const clock = d.clock;
  if (!isObject(clock) || !Number.isInteger(clock.seconds) || (clock.seconds as number) < 0) return "clock";
  if (!(s.narrative === null || typeof s.narrative === "string")) return "narrative";
  if (!isObject(s.meta) || typeof s.meta.label !== "string" || typeof s.meta.objective !== "string") return "meta";
  return null;
};

/** The contract's debrief counters (ADR-0029). */
const findTallyError = (t: unknown): string | null => {
  if (!isObject(t) || !Number.isInteger(t.startTick) || (t.clearedTick !== undefined && !Number.isInteger(t.clearedTick))) return "tally";
  if (!Number.isInteger(t.extraKills) || (t.extraKills as number) < 0) return "tally";
  for (const flag of ["detected", "alarm", "damaged", "hacked", "bonusLost"] as const) if (typeof t[flag] !== "boolean") return "tally";
  return null;
};

/** Heat (ADR-0029): level 0..3, the hunting faction, the search. */
const findHeatError = (h: unknown): string | null => {
  if (!isObject(h) || !Number.isInteger(h.level) || (h.level as number) < 0 || (h.level as number) > 3) return "heat";
  if (!(h.faction === null || (typeof h.faction === "string" && isFactionId(h.faction)))) return "heat";
  if (typeof h.searching !== "boolean" || !(h.lastKnown === null || isVec(h.lastKnown)) || !isNum(h.searchLeft) || !isNum(h.cooldown)) return "heat";
  return null;
};

/** The cyberdeck (ADR-0029): RAM and the upload in progress. */
const findNetrunError = (n: unknown): string | null => {
  if (!isObject(n) || !isNum(n.ram) || n.ram < 0) return "netrun";
  const u = n.upload;
  if (u === null) return null;
  if (!isObject(u) || typeof u.hackId !== "string" || !(QUICKHACK_IDS as readonly string[]).includes(u.hackId)) return "netrun upload";
  if (typeof u.target !== "string" || !isNum(u.left) || !isNum(u.ram)) return "netrun upload";
  return null;
};

export const isSaveSnapshot = (s: Json): s is Json & SaveSnapshot => findSchemaError(s) === null;
