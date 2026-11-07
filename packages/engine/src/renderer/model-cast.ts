import type { CastKey, ViewDescriptor } from "@seki/core";
import type { CharacterModelKey, CharacterModelManifest, CharacterModelSpec, ModelPoolRole, PooledModelSpec } from "./model-library";

/** The player, NPCs and enemies. */
export type CharacterDescriptor = Extract<ViewDescriptor, { kind: "heroine" | "npc" | "enemy" }>;

/**
 * Which model a character asks for (ADR-0076), independent of the manifest, which may arrive
 * later: its name in the story, its background role's pool with the seed of its look, and the
 * role's own model as the fallback.
 */
export interface ModelChoice {
  readonly fallback: CharacterModelKey;
  readonly cast?: CastKey;
  readonly pool?: ModelPoolRole;
  readonly look?: number;
}

const fallbackOf = (view: CharacterDescriptor): CharacterModelKey => {
  switch (view.kind) {
    case "heroine":
      return "heroine";
    case "enemy":
      return "ganger";
    case "npc":
      return view.preset === "fixer" ? "fixer" : view.preset === "ripperdoc" ? "ripperdoc" : "civilian";
  }
};

/** Background roles by the view: the fixer and the ripperdoc are characters of their own, not a pool. */
const poolOf = (view: CharacterDescriptor): ModelPoolRole | undefined =>
  view.kind === "enemy" ? view.preset : view.kind === "npc" && view.preset === "civilian" ? "civilian" : undefined;

export const modelChoiceOf = (view: CharacterDescriptor): ModelChoice => {
  const fallback = fallbackOf(view);
  if (view.kind === "heroine") return { fallback };
  const pool = poolOf(view);
  return {
    fallback,
    ...(view.cast !== undefined ? { cast: view.cast } : {}),
    ...(pool !== undefined ? { pool } : {}),
    ...(view.look !== undefined ? { look: view.look } : {}),
  };
};

/** A fraction in [0, 1) from a look seed: one round of a 32-bit integer mix, so close seeds land apart. */
const fractionOf = (look: number): number => {
  let h = look >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
};

/** The file of a pool a look draws, by the weights; null for an empty pool. */
export const pickFromPool = (pool: readonly PooledModelSpec[], look: number): PooledModelSpec | null => {
  const weights = pool.map((p) => Math.max(0, p.weight ?? 1));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let r = fractionOf(look) * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]!;
    if (r < 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
};

/** The model a character wears: by its name, else from its role's pool by its look, else its role's model. */
export const resolveModel = (manifest: CharacterModelManifest, choice: ModelChoice): CharacterModelSpec | undefined => {
  const named = choice.cast !== undefined ? manifest.cast?.[choice.cast] : undefined;
  if (named) return named;
  const pool = choice.pool !== undefined ? manifest.pools?.[choice.pool] : undefined;
  if (pool && choice.look !== undefined) {
    const drawn = pickFromPool(pool, choice.look);
    if (drawn) return drawn;
  }
  return manifest[choice.fallback];
};

/** Instances are interchangeable only with the same file, scale, turn and variant. */
export const modelPoolKey = (spec: CharacterModelSpec): string => `${spec.url}|${spec.scale ?? 1}|${spec.yaw ?? 0}|${spec.variant ?? 0}`;

/** Every model the manifest names, one per file, the role models first (the loading screen, ADR-0057). */
export const manifestFiles = (manifest: CharacterModelManifest): CharacterModelSpec[] => {
  const { cast, pools, ...roles } = manifest;
  const all = [...Object.values(roles), ...Object.values(cast ?? {}), ...Object.values(pools ?? {}).flat()];
  const byUrl = new Map<string, CharacterModelSpec>();
  for (const spec of all) if (spec && !byUrl.has(spec.url)) byUrl.set(spec.url, spec);
  return [...byUrl.values()];
};
