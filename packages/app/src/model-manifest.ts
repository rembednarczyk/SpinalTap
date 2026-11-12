import { type CastKey, isCastKey } from "@seki/core";
import { type CharacterModelKey, type CharacterModelManifest, type CharacterModelSpec, MODEL_POOL_ROLES, type ModelPoolRole, type PooledModelSpec } from "@seki/engine";

const KEYS: readonly CharacterModelKey[] = ["heroine", "fixer", "civilian", "ripperdoc", "ganger"];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * An entry with its URL resolved against the manifest; null without a URL, or with a `lends` that
 * is no boolean (G-580, as a bad `weight`): `lends: "true"` must not pass for a file that lends
 * nothing, since the donors (`donorFiles`, ADR-0076 stage 4a) decide the background's cloth.
 */
const specOf = (entry: unknown, base: string): CharacterModelSpec | null => {
  if (!isObject(entry) || typeof entry.url !== "string") return null;
  if (entry.lends !== undefined && typeof entry.lends !== "boolean") return null;
  return { ...(entry as Partial<CharacterModelSpec>), url: new URL(entry.url, base).href };
};

/** `cast`: a named character of the story → its model (ADR-0076); unknown names are dropped. */
const castOf = (json: unknown, base: string): Partial<Record<CastKey, CharacterModelSpec>> | null => {
  if (!isObject(json)) return null;
  const out: Partial<Record<CastKey, CharacterModelSpec>> = {};
  for (const [key, entry] of Object.entries(json)) {
    const spec = isCastKey(key) ? specOf(entry, base) : null;
    if (spec) out[key as CastKey] = spec;
  }
  return Object.keys(out).length > 0 ? out : null;
};

/** A pool entry's weight, if given, is a finite number of 0 or more; otherwise the entry is dropped (G-488). */
const validWeight = (entry: unknown): boolean => !isObject(entry) || entry.weight === undefined || (typeof entry.weight === "number" && Number.isFinite(entry.weight) && entry.weight >= 0);

/** `pools`: a background role → its files with weights (ADR-0076); unknown roles and empty pools are dropped. */
const poolsOf = (json: unknown, base: string): Partial<Record<ModelPoolRole, readonly PooledModelSpec[]>> | null => {
  if (!isObject(json)) return null;
  const out: Partial<Record<ModelPoolRole, readonly PooledModelSpec[]>> = {};
  for (const role of MODEL_POOL_ROLES) {
    const list = json[role];
    if (!Array.isArray(list)) continue;
    const specs = list.filter(validWeight).map((e) => specOf(e, base)).filter((s): s is PooledModelSpec => s !== null);
    if (specs.length > 0) out[role] = specs;
  }
  return Object.keys(out).length > 0 ? out : null;
};

/**
 * Reads models/manifest.json: `{ "heroine": { "url": "seki.vrm", "scale": 1 }, ...,
 * "cast": { "ume": { ... } }, "pools": { "civilian": [{ "url": ..., "weight": 2 }] } }`.
 * Model URLs are relative to the manifest. The role keys are the fallback; unknown keys and
 * entries without a URL are dropped; a missing or broken manifest means the procedural cast.
 */
export const parseModelManifest = (json: unknown, base: string): CharacterModelManifest => {
  const out: Partial<Record<CharacterModelKey, CharacterModelSpec>> = {};
  if (!isObject(json)) return out;
  for (const key of KEYS) {
    const spec = specOf(json[key], base);
    if (spec) out[key] = spec;
  }
  const cast = castOf(json.cast, base);
  const pools = poolsOf(json.pools, base);
  return { ...out, ...(cast ? { cast } : {}), ...(pools ? { pools } : {}) };
};

export const loadModelManifest = async (url: string, fetchImpl: typeof fetch = fetch): Promise<CharacterModelManifest> => {
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return {};
    return parseModelManifest(await res.json(), new URL(url, location.href).href);
  } catch {
    return {};
  }
};
