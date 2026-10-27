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
  // v3 (M1): Doktor Mori's clinic was counted as a civilian. M2 makes it its own faction,
  // starting neutral; the other standings carry over unchanged.
  3: (old) => {
    const domain = isObject(old.domain) ? old.domain : {};
    const reputation = isObject(domain.reputation) ? domain.reputation : {};
    return {
      ...old,
      version: 4,
      domain: {
        ...domain,
        reputation: { ...reputation, clinic: typeof reputation.clinic === "number" ? reputation.clinic : 0 },
      },
    };
  },
  // v4 (M2): no main-thread story state. A save that already finished the first contract
  // starts act I ("Echo") at its first step, as a live game would on completing it.
  4: (old) => {
    const domain = isObject(old.domain) ? old.domain : {};
    const quests = isObject(domain.quests) ? domain.quests : {};
    // Ids are spelled out: a migration describes the schema of its time, not today's content.
    const first = quests.m0_first_contract;
    const startEcho = isObject(first) && first.status === "completed" && !("m3_echo" in quests);
    return {
      ...old,
      version: 5,
      domain: {
        ...domain,
        quests: startEcho ? { ...quests, m3_echo: { status: "active", stepIndex: 0 } } : quests,
        story: isObject(domain.story) ? domain.story : { choices: {}, ending: null },
      },
    };
  },
  // v5 (M3): one district, no world streaming. An empty chunk list is valid: the simulation
  // loads whatever lies around the saved player position, which before v6 is always Shinsekai 7.
  5: (old) => ({
    ...old,
    version: 6,
    streaming: isObject(old.streaming) ? old.streaming : { loadedChunks: [] },
  }),
  // v6 (M2 streaming): no day clock. Before v7 every game started at 21:00 and the clock would
  // have advanced one game second per 60 Hz tick, so the saved tick tells the time it was.
  6: (old) => {
    const domain = isObject(old.domain) ? old.domain : {};
    const tick = typeof old.tick === "number" && Number.isInteger(old.tick) && old.tick >= 0 ? old.tick : 0;
    return {
      ...old,
      version: 7,
      domain: { ...domain, clock: isObject(domain.clock) ? domain.clock : { seconds: 21 * 3600 + tick } },
    };
  },
  // v7 -> v8 (ADR-0015): the medkit counter becomes the slot inventory, and every save gets
  // the starter weapon and clothes, worn, plus 48 rounds of 9 mm and no loot lying around.
  7: (old) => {
    const domain = isObject(old.domain) ? old.domain : {};
    const inv = isObject(domain.inventory) ? domain.inventory : {};
    // Ids and numbers are spelled out: a migration describes the schema of its time.
    const upgraded = "stacks" in inv;
    const medkits = typeof inv.medkit === "number" && Number.isInteger(inv.medkit) && inv.medkit > 0 ? inv.medkit : 0;
    return {
      ...old,
      version: 8,
      domain: {
        ...domain,
        inventory: upgraded
          ? inv
          : {
              stacks: medkits > 0 ? { medkit: medkits } : {},
              items: [
                { uid: "i1", def: "unity9", rarity: "common", loaded: 12, mods: {} },
                { uid: "i2", def: "seki_jacket", rarity: "common", condition: 100 },
                { uid: "i3", def: "cargo_pants", rarity: "common", condition: 100 },
              ],
              keyItems: [],
              capacity: 24,
              nextUid: 4,
            },
        equipment: isObject(domain.equipment)
          ? domain.equipment
          : { primary: null, secondary: "i1", melee: null, head: null, torso: "i2", legs: "i3", active: "secondary" },
        ammo: isObject(domain.ammo) ? domain.ammo : { "9mm": 48 },
        loot: isObject(domain.loot) ? domain.loot : { containers: [], dropSeq: 0 },
      },
    };
  },
  // v8 -> v9 (ADR-0023, act II "Lustro"): Kagami Biotech becomes a faction, starting neutral; the
  // story gets an act-II ending; the act-I ending is also kept as a flag (`ending:aya`), and a
  // save that already finished act I starts act II at its first step, as a live game would.
  8: (old) => {
    const domain = isObject(old.domain) ? old.domain : {};
    const reputation = isObject(domain.reputation) ? domain.reputation : {};
    const story = isObject(domain.story) ? domain.story : { choices: {}, ending: null };
    const quests = isObject(domain.quests) ? domain.quests : {};
    const flags = Array.isArray(domain.flags) ? domain.flags.filter((f): f is string => typeof f === "string") : [];
    // Ids are spelled out: a migration describes the schema of its time, not today's content.
    const ending = typeof story.ending === "string" ? story.ending : null;
    const endingFlag = ending ? `ending:${ending}` : null;
    const echo = quests.m3_echo;
    const startMirror = isObject(echo) && echo.status === "completed" && !("m3_lustro" in quests);
    return {
      ...old,
      version: 9,
      domain: {
        ...domain,
        reputation: { ...reputation, kagami: typeof reputation.kagami === "number" ? reputation.kagami : 0 },
        story: { ...story, act2Ending: "act2Ending" in story ? story.act2Ending : null },
        quests: startMirror ? { ...quests, m3_lustro: { status: "active", stepIndex: 0 } } : quests,
        flags: endingFlag && !flags.includes(endingFlag) ? [...flags, endingFlag].sort() : flags,
      },
    };
  },
  // v9 -> v10 (ADR-0024): the docks bring Tessen's security as a faction, starting neutral.
  // Nothing before v10 could touch it; the other standings carry over unchanged.
  9: (old) => {
    const domain = isObject(old.domain) ? old.domain : {};
    const reputation = isObject(domain.reputation) ? domain.reputation : {};
    return {
      ...old,
      version: 10,
      domain: { ...domain, reputation: { ...reputation, tessen: typeof reputation.tessen === "number" ? reputation.tessen : 0 } },
    };
  },
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
