import { describe, expect, it } from "vitest";
import { INITIAL_PROGRESSION, QUEST_DEFINITIONS, type QuestLog, SAVE_SCHEMA_VERSION, type SaveSnapshot, levelForXp, questLogXp, xpForLevel } from "@seki/core";
import { MIGRATIONS, V17_CONTRACT_XP, checksum, decodeSave, findSchemaError, retroactiveXp } from "../src";
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
    expect(bad({ ...INITIAL_PROGRESSION, xp: xpForLevel(31) })).toBeNull();
    expect(bad(undefined)).toBe("progression");
    expect(bad({ ...INITIAL_PROGRESSION, level: 31 })).toBe("progression level");
    expect(bad({ ...INITIAL_PROGRESSION, attributes: { ...INITIAL_PROGRESSION.attributes, net: 16 } })).toBe("progression attributes");
    expect(bad({ ...INITIAL_PROGRESSION, attributes: { might: 3 } })).toBe("progression attributes");
    expect(bad({ ...INITIAL_PROGRESSION, perks: { x: -1 } })).toBe("progression perks");
    expect(bad({ ...INITIAL_PROGRESSION, unspent: { attribute: 1.5, perk: 0 } })).toBe("progression points");
  });
});
