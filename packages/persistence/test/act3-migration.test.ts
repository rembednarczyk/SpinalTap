import { describe, expect, it } from "vitest";
import { MIGRATIONS } from "../src/migrations";

/*
 * v50 -> v51 (ADR-0095): act III's ending in the story (none), and "Źródło" started for a save with
 * act II over, never restarted for one already in it, nor for one still in act II.
 */

const v50 = (quests: Record<string, unknown>, story: Record<string, unknown> = { choices: {}, ending: "aya", act2Ending: "street" }) => ({
  version: 50,
  domain: { story, quests, flags: [] },
});

describe("act III migration (v50 to v51, ADR-0095)", () => {
  it("adds act III's ending and starts Źródło after act II", () => {
    const out = MIGRATIONS[50]!(v50({ m3_lustro: { status: "completed" } }));
    expect(out.version).toBe(51);
    expect(out.domain).toMatchObject({ story: { act2Ending: "street", act3Ending: null }, quests: { m3_lustro: { status: "completed" }, m3_zrodlo: { status: "active", stepIndex: 0 } } });
  });

  it("does not start it during act II, nor restart it, and tolerates a missing domain", () => {
    const during = MIGRATIONS[50]!(v50({ m3_lustro: { status: "active", stepIndex: 3 } }, { choices: {}, ending: "aya", act2Ending: null }));
    expect(during.domain).toEqual({ story: { choices: {}, ending: "aya", act2Ending: null, act3Ending: null }, quests: { m3_lustro: { status: "active", stepIndex: 3 } }, flags: [] });
    const ahead = { m3_lustro: { status: "completed" }, m3_zrodlo: { status: "active", stepIndex: 2 } };
    expect(MIGRATIONS[50]!(v50(ahead)).domain).toMatchObject({ quests: ahead });
    expect(MIGRATIONS[50]!({ version: 50 })).toEqual({ version: 51, domain: { story: { act3Ending: null }, quests: {} } });
  });
});
