import type { CharacterModelKey, CharacterModelManifest, CharacterModelSpec } from "@seki/engine";

const KEYS: readonly CharacterModelKey[] = ["heroine", "fixer", "civilian", "ripperdoc", "ganger"];

/**
 * Reads models/manifest.json: `{ "heroine": { "url": "seki.vrm", "scale": 1 }, ... }`.
 * Model URLs are relative to the manifest. Unknown keys and entries without a URL are
 * dropped; a missing or broken manifest means the procedural cast.
 */
export const parseModelManifest = (json: unknown, base: string): CharacterModelManifest => {
  const out: Partial<Record<CharacterModelKey, CharacterModelSpec>> = {};
  if (typeof json !== "object" || json === null) return out;
  const entries = json as Record<string, unknown>;
  for (const key of KEYS) {
    const entry = entries[key] as Partial<CharacterModelSpec> | undefined;
    if (!entry || typeof entry.url !== "string") continue;
    out[key] = { ...entry, url: new URL(entry.url, base).href };
  }
  return out;
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
