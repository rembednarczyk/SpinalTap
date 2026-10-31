import { describe, expect, it } from "vitest";
import { INITIAL_PROGRESSION, QUEST_DEFINITIONS, type QuestLog, SAVE_SCHEMA_VERSION, type SaveSnapshot, capacityMax, levelForXp, progressionFromXp, questLogXp, xpForLevel } from "@seki/core";
import { MIGRATIONS, V17_CONTRACT_XP, checksum, compensatingShards, decodeSave, findSchemaError, retroactiveXp } from "../src";
import { snapshot } from "./fixtures";

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

/** A v16 save: today's snapshot without the progression. */
const v16 = (domain: Partial<SaveSnapshot["domain"]>) => {
  const s = snapshot();
  const { progression: _p, ...old } = { ...s.domain, ...domain };
  return { ...s, version: 16, domain: old };
};

const actOneDone = { m0_first_contract: { status: "completed" }, m3_echo: { status: "completed" }, m3_lustro: { status: "active", stepIndex: 1 } } as const;

describe("character progression in the save (v16 to v17, ADR-0059)", () => {
  it("counts an old save's XP back from its quests and contracts: level from the curve, every point to spend", () => {
    const loaded = decodeSave("v16", wrap(v16({ quests: actOneDone, contracts: { active: null, completed: 9 } })));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    const xp = questLogXp(actOneDone, QUEST_DEFINITIONS) + 9 * V17_CONTRACT_XP;
    const level = levelForXp(xp);
    expect(level).toBe(10);
    expect(loaded.domain.progression).toEqual({ ...INITIAL_PROGRESSION, xp, level, unspent: { attribute: level - 1, perk: level - 1 } });
  });

  it("keeps the old cyberware pool: capacity shards make up what the level does not give yet", () => {
    // 10 contracts and 1 shard was a pool of 12 + 9 + 2 = 23; 8 500 XP is level 8, 12 + 4 + 2 = 18.
    const loaded = decodeSave("v16", wrap(v16({ quests: {}, contracts: { active: null, completed: 10 }, capacityShards: 1 })));
    expect(loaded.domain.progression.level).toBe(8);
    expect(loaded.domain.capacityShards).toBe(1 + 3);
    expect(capacityMax(loaded.domain.progression.level, loaded.domain.capacityShards)).toBeGreaterThanOrEqual(23);
    // Below three contracts the pool was the base: nothing to make up.
    expect(compensatingShards(2, 0, 1)).toBe(0);
    // A high level already gives more than the old pool.
    expect(compensatingShards(10, 0, 30)).toBe(0);
    for (let completed = 0; completed <= 40; completed++) {
      const level = levelForXp(completed * V17_CONTRACT_XP);
      const old = 12 + [3, 6, 10].filter((n) => completed >= n).length * 3;
      expect(capacityMax(level, compensatingShards(completed, 0, level)), `${completed} contracts`).toBeGreaterThanOrEqual(old);
    }
  });

  it("the migration's quest table is the XP the quests pay today", () => {
    const done: QuestLog = Object.fromEntries(QUEST_DEFINITIONS.map((q) => [q.id, { status: "completed" as const }]));
    expect(retroactiveXp({ quests: done })).toBe(questLogXp(done, QUEST_DEFINITIONS));
    for (const q of QUEST_DEFINITIONS) {
      for (let i = 0; i <= q.steps.length; i++) {
        const log = { [q.id]: { status: "active", stepIndex: i } } as const;
        expect(retroactiveXp({ quests: log }), `${q.id}@${i}`).toBe(questLogXp(log, QUEST_DEFINITIONS));
      }
    }
  });

  it("a fresh old save starts at level 1; a broken one does not throw", () => {
    expect(MIGRATIONS[16]!(v16({ quests: {}, contracts: { active: null, completed: 0 } }))).toMatchObject({ version: 17, domain: { progression: INITIAL_PROGRESSION } });
    expect(MIGRATIONS[16]!({ version: 16 })).toEqual({ version: 17, domain: { progression: INITIAL_PROGRESSION } });
    expect(retroactiveXp({ quests: { m3_echo: { status: "active", stepIndex: "x" } }, contracts: { completed: -3 } })).toBe(0);
  });

  it("the migrated save is a valid v17 snapshot", () => {
    const loaded = decodeSave("v16", wrap(v16({})));
    expect(findSchemaError(loaded as unknown as Record<string, unknown>)).toBeNull();
  });

  it("refuses a progression out of range", () => {
    const s = snapshot();
    const bad = (progression: unknown) => findSchemaError({ ...s, domain: { ...s.domain, progression } } as unknown as Record<string, unknown>);
    expect(bad(s.domain.progression)).toBeNull();
    expect(bad(progressionFromXp(xpForLevel(30) + 5000))).toBeNull();
    // Level 30 at 0 XP, a level behind its XP, more points than the levels gave: edited saves.
    expect(bad({ ...INITIAL_PROGRESSION, level: 30 })).toBe("progression level");
    expect(bad({ ...INITIAL_PROGRESSION, xp: xpForLevel(5) })).toBe("progression level");
    expect(bad({ ...INITIAL_PROGRESSION, unspent: { attribute: 29, perk: 29 } })).toBe("progression level");
    expect(bad({ ...INITIAL_PROGRESSION, hacked: ["dev:a", 3] })).toBe("progression hacked");
    expect(bad({ ...INITIAL_PROGRESSION, hacked: ["dev:a"] })).toBeNull();
    expect(bad(undefined)).toBe("progression");
    expect(bad({ ...INITIAL_PROGRESSION, level: 31 })).toBe("progression level");
    expect(bad({ ...INITIAL_PROGRESSION, attributes: { ...INITIAL_PROGRESSION.attributes, net: 16 } })).toBe("progression attributes");
    expect(bad({ ...INITIAL_PROGRESSION, attributes: { might: 3 } })).toBe("progression attributes");
    expect(bad({ ...INITIAL_PROGRESSION, perks: { x: -1 } })).toBe("progression perks");
    expect(bad({ ...INITIAL_PROGRESSION, unspent: { attribute: 1.5, perk: 0 } })).toBe("progression points");
  });
});
