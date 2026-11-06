import { ATTRIBUTE_IDS, ATTRIBUTE_MAX, ATTRIBUTE_START, type Attributes, HACKED_MEMORY, MAX_LEVEL, MIN_LEVEL, type ProgressionState, isConsistentProgression, validPerks } from "@seki/core";

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const isCount = (v: unknown): boolean => Number.isInteger(v) && (v as number) >= 0;

/** Character progression (ADR-0059): whole XP, a level in 1..30, attributes in 3..15, whole points. */
export const findProgressionError = (p: unknown): string | null => {
  if (!isObject(p) || !isCount(p.xp) || !Number.isInteger(p.level)) return "progression";
  if ((p.level as number) < MIN_LEVEL || (p.level as number) > MAX_LEVEL) return "progression level";
  const a = p.attributes;
  if (!isObject(a)) return "progression attributes";
  for (const id of ATTRIBUTE_IDS) {
    const v = a[id];
    if (!Number.isInteger(v) || (v as number) < ATTRIBUTE_START || (v as number) > ATTRIBUTE_MAX) return "progression attributes";
  }
  // A perk that exists, within its ranks, on a tier its attribute opens (ADR-0059, stage 3).
  if (!isObject(p.perks) || !Object.values(p.perks).every(isCount) || !validPerks(a as unknown as Attributes, p.perks as Readonly<Record<string, number>>)) return "progression perks";
  const u = p.unspent;
  if (!isObject(u) || !isCount(u.attribute) || !isCount(u.perk)) return "progression points";
  const h = p.hacked;
  if (h !== undefined && (!Array.isArray(h) || h.length > HACKED_MEMORY || !h.every((k) => typeof k === "string"))) return "progression hacked";
  // Level 30 at 0 XP, or more points than the levels gave, is an edited save.
  if (!isConsistentProgression(p as unknown as ProgressionState)) return "progression level";
  return null;
};
