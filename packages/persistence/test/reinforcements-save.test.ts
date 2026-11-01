import { describe, expect, it } from "vitest";
import { SAVE_SCHEMA_VERSION, type ReinforcementSnapshot, type ReinforcementsSnapshot } from "@seki/core";
import { MIGRATIONS, checksum, decodeSave, encodeSave, findSchemaError } from "../src";
import { snapshot } from "./fixtures";

/** The heat's reinforcements in the save (G-179): schema v23 and the v22 -> v23 migration. */

const wrap = (payload: unknown) => {
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

const ONE: ReinforcementSnapshot = {
  n: 1,
  type: "hebi_ganger",
  home: { x: 423.5, y: 0.07, z: -99.8 },
  state: { key: "security:1", position: { x: 421, y: 0.07, z: -98 }, yaw: 0, pitch: 0, hp: 80, cooldown: 0, alerted: false, lastKnown: { x: 400, y: 0, z: -97 }, search: 0, lost: 0 },
};
const TWO: ReinforcementSnapshot = { ...ONE, n: 3, type: "hebi_brawler", state: { ...ONE.state, key: "security:3", hp: 12, maxHp: 108 } };
const SENT: ReinforcementsSnapshot = { sent: 3, wait: 3.5, people: [ONE, TWO] };

describe("the heat's reinforcements in the save (v22 to v23, G-179)", () => {
  it("is schema v23", () => {
    expect(SAVE_SCHEMA_VERSION).toBe(23);
  });

  it("a v22 save loads as it was, with none sent in", () => {
    const loaded = decodeSave("v22", wrap({ ...snapshot(), version: 22 }));
    expect(loaded.version).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded.reinforcements).toBeUndefined();
    expect(findSchemaError(loaded as unknown as Record<string, unknown>)).toBeNull();
    expect(MIGRATIONS[22]!({ version: 22, entities: [] })).toEqual({ version: 23, entities: [] });
  });

  it("keeps them, the count sent and the wait for the next one through the codec", () => {
    expect(decodeSave("slot", encodeSave(snapshot({ reinforcements: SENT }))).reinforcements).toEqual(SENT);
    // None about any more, the next one due.
    const due = { sent: 2, wait: 1, people: [] };
    expect(decodeSave("slot", encodeSave(snapshot({ reinforcements: due }))).reinforcements).toEqual(due);
  });

  it("keeps the body of one of them, dead where it lies, through the codec (G-193)", () => {
    const { lastKnown: _l, search: _s, lost: _o, ...still } = ONE.state;
    const downed = { playerAt: { x: 420, y: 0.07, z: -98 }, fought: false, found: true, reported: false, dead: true, carried: false, hidden: true };
    const body: ReinforcementSnapshot = { ...ONE, home: ONE.state.position, state: { ...still, hp: null, downed } };
    const withBody = { ...SENT, people: [body, TWO] };
    expect(decodeSave("slot", encodeSave(snapshot({ reinforcements: withBody }))).reinforcements).toEqual(withBody);
  });

  it("refuses reinforcements that are not whole, twice the same, or past the count sent", () => {
    const bad = (reinforcements: unknown) => findSchemaError({ ...snapshot(), reinforcements } as unknown as Record<string, unknown>);
    expect(bad(undefined)).toBeNull();
    expect(bad(SENT)).toBeNull();
    const one = (over: Record<string, unknown>) => ({ sent: 5, wait: 0, people: [{ ...ONE, ...over }] });
    const broken = [
      null,
      [],
      { sent: 1, wait: -1, people: [] },
      { sent: 1, wait: Number.NaN, people: [] },
      { sent: -1, wait: 0, people: [] },
      { sent: 1.5, wait: 0, people: [] },
      { wait: 0, people: [] },
      { sent: 1, wait: 0, people: null },
      one({ n: 0 }),
      one({ n: 2.5 }),
      one({ type: "cop" }),
      one({ home: { x: 1, y: 2 } }),
      one({ state: { ...ONE.state, key: "security:9" } }),
      one({ state: { ...ONE.state, hp: "80" } }),
      one({ state: { ...ONE.state, suspicion: 2 } }),
      { sent: 3, wait: 0, people: [ONE, ONE] },
      { ...SENT, sent: 2 },
    ];
    for (const v of broken) expect(bad(v)).toBe("reinforcements");
    expect(() => decodeSave("slot", encodeSave(snapshot({ reinforcements: { ...SENT, sent: 1 } })))).toThrow();
  });
});
