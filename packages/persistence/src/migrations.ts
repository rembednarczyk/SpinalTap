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
  // v10 -> v11 (ADR-0029): no heat, a full starting cyberdeck with nothing uploading, and a
  // running contract starts its debrief counters at the save's tick (nothing seen, nothing lost).
  10: (old) => {
    const domain = isObject(old.domain) ? old.domain : {};
    const contracts = isObject(domain.contracts) ? domain.contracts : { active: null, completed: 0 };
    const active = isObject(contracts.active) ? contracts.active : null;
    const tick = typeof old.tick === "number" && Number.isInteger(old.tick) && old.tick >= 0 ? old.tick : 0;
    // Numbers are spelled out: a migration describes the schema of its time (BASE_RAM was 8).
    const tally = { startTick: tick, detected: false, alarm: false, extraKills: 0, damaged: false, hacked: false, bonusLost: false };
    return {
      ...old,
      version: 11,
      domain: {
        ...domain,
        heat: isObject(domain.heat) ? domain.heat : { level: 0, faction: null, searching: false, lastKnown: null, searchLeft: 0, cooldown: 0 },
        netrun: isObject(domain.netrun) ? domain.netrun : { ram: 8, upload: null },
        contracts: active && !isObject(contracts.tally) ? { ...contracts, tally } : contracts,
      },
    };
  },
  // v11 -> v12 (ADR-0034): nobody was on the metro and no street encounter had played. A running
  // contract stays plain (no variation) with no hooks found: both are optional fields.
  11: (old) => {
    const domain = isObject(old.domain) ? old.domain : {};
    return {
      ...old,
      version: 12,
      domain: {
        ...domain,
        metro: isObject(domain.metro) ? domain.metro : { ride: null },
        encounters: isObject(domain.encounters) ? domain.encounters : { used: [], nights: {} },
      },
    };
  },
  // v12 -> v13 (ADR-0033): no buffs running, no capacity shard used yet, and no disguise seen
  // through. The role itself follows the worn torso garment on the first step (a Hebi jacket
  // worn in an old save becomes a disguise then).
  12: (old) => {
    const domain = isObject(old.domain) ? old.domain : {};
    return {
      ...old,
      version: 13,
      domain: {
        ...domain,
        buffs: Array.isArray(domain.buffs) ? domain.buffs : [],
        capacityShards: typeof domain.capacityShards === "number" ? domain.capacityShards : 0,
        disguise: isObject(domain.disguise) ? domain.disguise : { role: null, blown: false },
      },
    };
  },
  // v13 -> v14 (ADR-0038): every door was shut. Kaito and Mori moved indoors: the street spots an
  // old save remembers for them are dropped, so they stand where the content puts them now.
  13: (old) => {
    const entities = Array.isArray(old.entities) ? old.entities : [];
    return {
      ...old,
      version: 14,
      entities: entities.filter((e: unknown) => !(isObject(e) && (e.key === "fixer" || e.key === "mori"))),
      doors: Array.isArray(old.doors) ? old.doors : [],
    };
  },
  // v14 -> v15 (ADR-0045): the city moved to Lublin, so no position of an older save means
  // anything any more. The player wakes on the chair in Mori's clinic on Krakowskie
  // Przedmieście, as in a new game; everyone else stands where the content puts them (the dead
  // stay dead by their flags); every door is shut and the chunks load round the player. Bags
  // lying in the old streets are put down in the clinic with what is in them; stashes not yet
  // emptied are placed again where the new content has them, full. The heat's last known
  // position goes with the old map. A metro ride goes on: it arrives at the new station.
  14: (old) => {
    const domain = isObject(old.domain) ? old.domain : {};
    const flags = Array.isArray(domain.flags) ? domain.flags : [];
    const loot = isObject(domain.loot) ? domain.loot : { containers: [], dropSeq: 0 };
    const containers = Array.isArray(loot.containers) ? loot.containers : [];
    // Numbers are spelled out: a migration describes the world of its time.
    const chair = { x: 319.6, y: -0.05, z: -64.86 };
    const isStash = (c: unknown) => isObject(c) && typeof c.key === "string" && c.key.startsWith("stash:");
    const stashes = new Set(containers.filter(isStash).map((c: unknown) => (c as { key: string }).key));
    const bags = containers.filter((c: unknown) => isObject(c) && !isStash(c));
    const entities = Array.isArray(old.entities) ? old.entities : [];
    const player = entities.find((e: unknown) => isObject(e) && e.key === "player");
    return {
      ...old,
      version: 15,
      entities: isObject(player) ? [{ ...player, position: chair, yaw: Math.PI / 2, pitch: 0, alerted: false }] : [],
      streaming: { loadedChunks: [] },
      doors: [],
      domain: {
        ...domain,
        flags: flags.filter((f: unknown) => !(typeof f === "string" && f.startsWith("placed:") && stashes.has(f.slice("placed:".length)))),
        loot: {
          ...loot,
          // In a row along the clinic's floor, 0.6 m apart, east of the chair.
          containers: bags.map((c: Record<string, unknown>, i: number) => ({ ...c, position: { x: 320.4 + (i % 6) * 0.6, y: -0.5, z: -67.2 - Math.floor(i / 6) * 0.6 }, chunk: "krakowskie-2-0" })),
        },
        heat: { level: 0, faction: null, searching: false, lastKnown: null, searchLeft: 0, cooldown: 0 },
      },
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
