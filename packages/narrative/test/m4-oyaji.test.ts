import { describe, expect, it } from "vitest";
import { type DomainState, type GameCommand, createDomainState } from "@seki/core";
import { type DialogueView, NarrativeRuntime, STORY_SOURCE } from "../src";

const setup = () => {
  const commands: GameCommand[] = [];
  const runtime = new NarrativeRuntime(STORY_SOURCE, (c) => commands.push(c));
  return { runtime, commands };
};

const text = (v: DialogueView) => v.lines.map((l) => l.text).join("\n");

/** Midday on the market, after M0. */
const domain = (patch: Partial<DomainState> = {}): DomainState => {
  const d = createDomainState();
  return {
    ...d,
    quests: { m0_first_contract: { status: "completed" } },
    character: { ...d.character, alias: "Seki Senshi" },
    clock: { seconds: 12 * 3600 },
    ...patch,
  };
};

const civilians = (value: number): Pick<DomainState, "reputation"> => ({ reputation: { ...createDomainState().reputation, civilians: value } });

describe("Oyaji (E10, market stall)", () => {
  it("introduces himself once, then talks shop", () => {
    const { runtime, commands } = setup();
    const view = runtime.start("oyaji", domain());
    expect(view.lines[0]).toEqual({ speaker: "Oyaji", text: expect.stringContaining("Tak mnie wołają") });
    expect(text(view)).toContain("Kupuję złom");
    expect(view.choices.map((c) => c.text)).toEqual(["Co skupujesz?", "Masz większy plecak?", "Hebi ci nie dokuczają?", "Na razie wystarczy."]);
    expect(commands).toEqual([{ type: "set-flag", flag: "met_oyaji" }]);
    expect(text(runtime.start("oyaji", domain({ flags: ["met_oyaji"] })))).not.toContain("Tak mnie wołają");
  });

  it("answers about the trade and comes back to the choices", () => {
    const { runtime } = setup();
    runtime.start("oyaji", domain({ flags: ["met_oyaji"] }));
    const buys = runtime.choose(0);
    expect(text(buys)).toContain("po pełnej cenie");
    expect(buys.ended).toBe(false);
    const bag = runtime.choose(1);
    expect(text(bag)).toContain("sześćset");
    const bye = runtime.choose(bag.choices.length - 1);
    expect(text(bye)).toContain("do dziesiątej");
    expect(bye.ended).toBe(true);
  });

  it("speaks to Seki by the street's opinion", () => {
    const { runtime } = setup();
    const known = { flags: ["met_oyaji"] };
    expect(text(runtime.start("oyaji", domain({ ...known, ...civilians(30) })))).toContain("Seki Senshi! Dla ciebie zawsze coś odłożę");
    expect(text(runtime.start("oyaji", domain({ ...known, ...civilians(-30) })))).toContain("lubić nie muszę");
    expect(text(runtime.start("oyaji", domain(known)))).toContain("Kupuję złom");
  });

  it("asks about Hebi once, and the answer follows the street's opinion", () => {
    for (const [value, line] of [
      [30, "Hana mówi, że to twoja zasługa"],
      [0, "Co miesiąc chcą swoje"],
    ] as const) {
      const { runtime, commands } = setup();
      runtime.start("oyaji", domain({ flags: ["met_oyaji"], ...civilians(value) }));
      const view = runtime.choose(2);
      expect(text(view)).toContain(line);
      expect(view.choices.map((c) => c.text)).not.toContain("Hebi ci nie dokuczają?");
      expect(commands).toContainEqual({ type: "set-flag", flag: "oyaji_hebi" });
    }
  });

  it("no line uses a dash for a pause", () => {
    const { runtime } = setup();
    const seen: string[] = [];
    for (const value of [-30, 0, 30]) {
      const first = runtime.start("oyaji", domain(civilians(value)));
      seen.push(text(first));
      for (let i = 0; i < 3; i++) {
        runtime.start("oyaji", domain(civilians(value)));
        seen.push(text(runtime.choose(i)));
      }
    }
    expect(seen.join("\n")).not.toMatch(/[–—]/);
  });
});
