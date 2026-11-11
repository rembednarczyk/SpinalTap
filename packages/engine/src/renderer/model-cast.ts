import type { CastKey, ViewDescriptor } from "@seki/core";
import type { CharacterModelKey, CharacterModelManifest, CharacterModelSpec, ModelPoolRole, PooledModelSpec } from "./model-library";
import { variantOf } from "./model-variant";

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

/** A file's weight in its pool: 1 by default and for anything but a finite number, never below 0 (G-488). */
const weightOf = (p: PooledModelSpec): number => (typeof p.weight === "number" && Number.isFinite(p.weight) ? Math.max(0, p.weight) : 1);

/** The file of a pool a look draws, by the weights; null for an empty pool. */
export const pickFromPool = (pool: readonly PooledModelSpec[], look: number): PooledModelSpec | null => {
  const weights = pool.map(weightOf);
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

/** The first spec of every file, in order. */
const oneByUrl = (specs: Iterable<CharacterModelSpec | undefined>): CharacterModelSpec[] => {
  const byUrl = new Map<string, CharacterModelSpec>();
  for (const spec of specs) if (spec && !byUrl.has(spec.url)) byUrl.set(spec.url, spec);
  return [...byUrl.values()];
};

/** Every model the manifest names, one per file, the role models first. */
export const manifestFiles = (manifest: CharacterModelManifest): CharacterModelSpec[] => {
  const { cast, pools, ...roles } = manifest;
  return oneByUrl([...Object.values(roles), ...Object.values(cast ?? {}), ...Object.values(pools ?? {}).flat()]);
};

/**
 * A character whose variant comes from its look within the file's budget (ADR-0076 §3): not a
 * named one, nor a file whose spec fixes the variant or the dress.
 */
export const isBackgroundLook = (spec: CharacterModelSpec, choice: ModelChoice): boolean =>
  choice.cast === undefined && choice.look !== undefined && spec.variant === undefined && spec.dress === undefined;

/** The character may wear another file's top or trousers: any background look, a named one by its dress. */
const mayBorrow = (spec: CharacterModelSpec, choice: ModelChoice): boolean => {
  if (isBackgroundLook(spec, choice)) return true;
  const v = variantOf(spec.variant ?? 0, spec.dress);
  return v.topFrom !== null || v.bottomFrom !== null;
};

/**
 * The files the loading screen waits for (ADR-0057, ADR-0076 stage 4a): the heroine's and those
 * of the characters already in the scene round the start, one per file, and the donors' files
 * (`donorFiles`) if one of them may borrow cloth, so it is dressed before the game shows. The
 * rest load later.
 */
export const startFiles = (manifest: CharacterModelManifest, choices: Iterable<ModelChoice | null>): CharacterModelSpec[] => {
  const wanted: (CharacterModelSpec | undefined)[] = [manifest.heroine];
  let borrows = false;
  for (const choice of choices) {
    const spec = choice ? resolveModel(manifest, choice) : undefined;
    if (!spec || !choice) continue;
    wanted.push(spec);
    borrows ||= mayBorrow(spec, choice);
  }
  return oneByUrl(borrows ? [...wanted, ...donorFiles(manifest)] : wanted);
};

/**
 * The files fetched in the background once the game is on screen (ADR-0076 stage 4a): the role
 * models and the background pools, since passers-by, vendors and gangers stream in in every
 * district. A file only named characters wear (Kurosawa's, in the second act) loads when one of
 * them first appears.
 */
export const backgroundFiles = (manifest: CharacterModelManifest): CharacterModelSpec[] => {
  const { cast: _cast, pools, ...roles } = manifest;
  return oneByUrl([...Object.values(roles), ...Object.values(pools ?? {}).flat()]);
};

/**
 * The files whose tops and trousers the variants may borrow (ADR-0076 §3, G-560, G-575): the
 * heroine's, the background roles' and those a cast entry marks `lends` (`base-female.vrm`), a set
 * fixed by the manifest alone, so a look wears the same cloth however many files have loaded. Any
 * other file only named characters wear (Kurosawa's) lends nothing.
 */
export const donorFiles = (manifest: CharacterModelManifest): CharacterModelSpec[] => {
  const lending = Object.values(manifest.cast ?? {}).filter((spec) => spec?.lends === true);
  return oneByUrl([manifest.heroine, ...backgroundFiles(manifest), ...lending]);
};
