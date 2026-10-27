import { SAVE_SCHEMA_VERSION } from "@seki/core";

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Migration n upgrades a version-n payload to version n+1. Every schema change bumps
 * SAVE_SCHEMA_VERSION and adds an entry here; old saves are walked forward step by step.
 */
export const MIGRATIONS: Readonly<Record<number, (old: Json) => Json>> = {
  // v1 (pre-release prototype): currency was "credits", no camera preference,
  // no saved RNG state and no AI alert flags.
  1: (old) => {
    const domain = isObject(old.domain) ? old.domain : {};
    const wallet = isObject(domain.wallet) ? domain.wallet : {};
    const entities = Array.isArray(old.entities) ? old.entities : [];
    return {
      ...old,
      version: 2,
      rngState: typeof old.rngState === "number" ? old.rngState : old.seed,
      entities: entities.map((e: unknown) => (isObject(e) ? { alerted: false, ...e } : e)),
      domain: {
        ...domain,
        wallet: { eddies: typeof wallet.credits === "number" ? wallet.credits : (wallet.eddies ?? 0) },
        preferences: isObject(domain.preferences) ? domain.preferences : { cameraMode: "FPP" },
      },
    };
  },
  // v2 (M0): no inventory, fixer contracts or ability state. Old saves get the M1 starter kit.
  2: (old) => {
    const domain = isObject(old.domain) ? old.domain : {};
    return {
      ...old,
      version: 3,
      domain: {
        ...domain,
        inventory: isObject(domain.inventory) ? domain.inventory : { medkit: 1 },
        contracts: isObject(domain.contracts) ? domain.contracts : { active: null, completed: 0 },
        ability: isObject(domain.ability) ? domain.ability : { activeTime: 0, cooldown: 0 },
      },
    };
  },
  // v3 (M1): one district, no world streaming. An empty chunk list is valid: the simulation
  // loads whatever lies around the saved player position, which for v3 is always Shinsekai 7.
  3: (old) => ({
    ...old,
    version: 4,
    streaming: isObject(old.streaming) ? old.streaming : { loadedChunks: [] },
  }),
};

export class MigrationError extends Error {}

export const migrate = (payload: Json): Json => {
  let current = payload;
  let version = current.version;
  if (typeof version !== "number" || !Number.isInteger(version)) throw new MigrationError("missing schema version");
  if (version > SAVE_SCHEMA_VERSION) throw new MigrationError(`save is from a newer version (${version})`);
  while (version < SAVE_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new MigrationError(`no migration from version ${version}`);
    current = step(current);
    version = current.version;
    if (typeof version !== "number") throw new MigrationError("migration produced no version");
  }
  return current;
};
