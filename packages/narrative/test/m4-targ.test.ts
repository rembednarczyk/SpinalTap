import { describe, expect, it } from "vitest";
import { type Contract, type DomainState, type GameCommand, createDomainState } from "@seki/core";
import { type DialogueView, NarrativeRuntime, STORY_SOURCE, storySource } from "../src";

const setup = () => {
  const commands: GameCommand[] = [];
  const runtime = new NarrativeRuntime(STORY_SOURCE, (c) => commands.push(c));
  return { runtime, commands };
};

const text = (v: DialogueView) => v.lines.map((l) => l.text).join("\n");

/** After M0: Seki has a name, the first quest is done, `completed` contracts are paid. */
const domain = (patch: Partial<DomainState> & { active?: Contract | null; completed?: number } = {}): DomainState => {
  const d = createDomainState();
  const { active = null, completed = 1, ...rest } = patch;
  return {
    ...d,
    quests: { m0_first_contract: { status: "completed" } },
    character: { ...d.character, alias: "Seki Senshi" },
    contracts: { active, completed },
    ...rest,
  };
};

const rep = (r: Partial<DomainState["reputation"]>): Pick<DomainState, "reputation"> => ({ reputation: { ...createDomainState().reputation, ...r } });

const delivery = (status: Contract["status"]): Contract => ({ id: "c2", kind: "delivery", siteId: "hana_stall", targets: 0, reward: 325, status, deadlineTick: 6000 });
const retrieve = (status: Contract["status"]): Contract => ({ id: "c2", kind: "retrieve", siteId: "hebi_stash", targets: 2, reward: 470, status });
const protect = (status: Contract["status"]): Contract => ({ id: "c2", kind: "protect", siteId: "raid_north", targets: 3, reward: 675, status });

describe("Hana (M4, market)", () => {
  it("introduces herself once and offers her two jobs", () => {
    const { runtime, commands } = setup();
    const view = runtime.start("hana", domain());
    expect(view.lines[0]).toEqual({ speaker: "Hana", text: expect.stringContaining("Jestem Hana") });
    expect(text(view)).toContain("Jeszcze cię nie znam");
    expect(view.choices.map((c) => c.text)).toEqual(["Co trzeba odzyskać?", "Ktoś potrzebuje ochrony?", "Nie teraz."]);
    expect(commands).toEqual([{ type: "set-flag", flag: "met_hana" }]);
    const again = runtime.start("hana", domain({ flags: ["met_hana"] }));
    expect(text(again)).not.toContain("Jestem Hana");
  });

  it("speaks to Seki by reputation: the street first, then Kaito's word", () => {
    const { runtime } = setup();
    const known = { flags: ["met_hana"] };
    expect(text(runtime.start("hana", domain({ ...known, ...rep({ civilians: 20 }) })))).toContain("Seki Senshi, dobrze, że jesteś");
    expect(text(runtime.start("hana", domain({ ...known, ...rep({ fixers: 20 }) })))).toContain("Kaito dobrze o tobie mówi");
    expect(text(runtime.start("hana", domain({ ...known, ...rep({ civilians: 20, fixers: 20 }) })))).not.toContain("Kaito dobrze");
  });

  // ADR-0070: Hana never refuses. Hostile: she sells nothing but offers her two jobs as the way back.
  it("offers her jobs even to someone the street fears, and says why", () => {
    const { runtime } = setup();
    const known = { flags: ["met_hana"] };
    const feared = runtime.start("hana", domain({ ...known, ...rep({ civilians: -60 }) }));
    expect(text(feared)).toContain("Nie sprzedam ci nawet śrubki");
    expect(text(feared)).toContain("Udowodnij, że jesteś po naszej stronie");
    expect(feared.ended).toBe(false);
    expect(feared.choices.map((c) => c.text)).toEqual(["Co trzeba odzyskać?", "Ktoś potrzebuje ochrony?", "Nie teraz."]);
    const wary = runtime.start("hana", domain({ ...known, ...rep({ civilians: -30 }) }));
    expect(text(wary)).toContain("spode łba");
    expect(text(wary)).not.toContain("śrubki");
    expect(wary.choices).toHaveLength(3);
    const en = new NarrativeRuntime(storySource("en"), () => {}).start("hana", domain({ ...known, ...rep({ civilians: -60 }) }));
    expect(text(en)).toContain("Prove you're on our side.");
    expect(en.choices.map((c) => c.text)).toEqual(["What needs recovering?", "Anyone need protecting?", "Not now."]);
  });

  it("a feared Seki can still take a job and get paid for it", () => {
    const { runtime, commands } = setup();
    runtime.start("hana", domain({ flags: ["met_hana"], ...rep({ civilians: -80 }) }));
    runtime.choose(0);
    expect(commands).toEqual([{ type: "accept-contract", kind: "retrieve" }]);
    const paid = runtime.start("hana", domain({ active: retrieve("cleared"), ...rep({ civilians: -80 }) }));
    expect(text(paid)).toContain("Jest moja skrzynka");
    expect(commands).toContainEqual({ type: "complete-contract" });
  });

  // G-304, ADR-0070: Hana is always the way back, so she takes Kaito's run whatever the street thinks.
  // Both cold tiers: wary (-30) and hostile (-60), where the greeting refuses to sell.
  it("takes Kaito's package even when the street fears Seki", () => {
    for (const [source, refusal, coldWelcome, civilians] of [
      [storySource("pl"), "Nie sprzedam ci", "Przyjdź popracować dla mnie", -30],
      [storySource("en"), "I won't sell you", "Come and work for me", -30],
      [storySource("pl"), "Nie sprzedam ci", "Przyjdź popracować dla mnie", -60],
      [storySource("en"), "I won't sell you", "Come and work for me", -60],
    ] as const) {
      const commands: GameCommand[] = [];
      const runtime = new NarrativeRuntime(source, (c) => commands.push(c));
      const view = runtime.start("hana", domain({ active: delivery("active"), ...rep({ civilians }) }));
      expect(commands).toEqual([{ type: "deliver-contract" }]);
      expect(text(view)).not.toContain(refusal);
      expect(text(view)).toContain(coldWelcome);
      expect(view.ended).toBe(true);
      runtime.start("hana", domain({ active: delivery("cleared"), ...rep({ civilians }) }));
      expect(commands).toHaveLength(1);
    }
  });

  it("accepting a job asks the domain for that kind", () => {
    for (const [index, kind] of [
      [0, "retrieve"],
      [1, "protect"],
    ] as const) {
      const { runtime, commands } = setup();
      runtime.start("hana", domain({ flags: ["met_hana"] }));
      const view = runtime.choose(index);
      expect(view.ended).toBe(true);
      expect(commands).toEqual([{ type: "accept-contract", kind }]);
    }
  });

  it("has nobody to protect once Oyaji is dead", () => {
    const { runtime } = setup();
    const view = runtime.start("hana", domain({ flags: ["met_hana", "dead:oyaji"] }));
    expect(view.choices.map((c) => c.text)).toEqual(["Co trzeba odzyskać?", "Nie teraz."]);
  });

  it("offers no protection while Oyaji's stall is shut for the night", () => {
    const { runtime } = setup();
    const night = runtime.start("hana", domain({ flags: ["met_hana"], clock: { seconds: 23 * 3600 } }));
    expect(night.choices.map((c) => c.text)).toEqual(["Co trzeba odzyskać?", "Nie teraz."]);
    expect(text(night)).toContain("Oyaji już zamknął stragan");
    const day = runtime.start("hana", domain({ flags: ["met_hana"], clock: { seconds: 12 * 3600 } }));
    expect(day.choices.map((c) => c.text)).toContain("Ktoś potrzebuje ochrony?");
    expect(text(day)).not.toContain("zamknął");
  });

  it("takes Kaito's package and sends Seki back to him for the money", () => {
    const { runtime, commands } = setup();
    const view = runtime.start("hana", domain({ active: delivery("active") }));
    expect(commands).toEqual([{ type: "deliver-contract" }]);
    expect(text(view)).toContain("zapłatę odbierzesz u niego");
    const after = runtime.start("hana", domain({ active: delivery("cleared") }));
    expect(text(after)).toContain("idź do Kaito");
    expect(commands).toHaveLength(1);
  });

  it("reminds Seki of a running job and pays for a finished one", () => {
    const { runtime, commands } = setup();
    expect(text(runtime.start("hana", domain({ active: retrieve("active") })))).toContain("przy ruinie za straganami");
    expect(text(runtime.start("hana", domain({ active: protect("active") })))).toContain("pilnuj Oyajiego");
    expect(commands).toEqual([]);
    const paid = runtime.start("hana", domain({ active: retrieve("cleared"), ...rep({ civilians: 20 }) }));
    expect(commands).toEqual([{ type: "complete-contract" }]);
    expect(text(paid)).toContain("470 eddies");
    expect(text(paid)).toContain("Ludzie z targu zaczynają o tobie mówić");
    expect(paid.choices.map((c) => c.text)).toContain("Co trzeba odzyskać?");
    expect(text(runtime.start("hana", domain({ active: protect("cleared") })))).toContain("Oyaji żyje");
  });

  it("sends Seki back to Kaito while one of his jobs runs", () => {
    const { runtime } = setup();
    const kill: Contract = { id: "c2", siteId: "east_lot", targets: 2, reward: 500, status: "active" };
    expect(text(runtime.start("hana", domain({ active: kill })))).toContain("Robisz teraz dla Kaito");
  });

  it("rejects unknown contract kinds coming from ink", () => {
    const bad = new NarrativeRuntime(`${STORY_SOURCE}\n=== bad ===\n~ offer_contract("heist")\n-> END`, () => {});
    expect(() => bad.start("bad", createDomainState())).toThrow(/unknown contract kind/);
  });
});

describe("Kaito and the market (M4)", () => {
  it("after the first contract he mentions Hana and offers a delivery", () => {
    const { runtime, commands } = setup();
    const view = runtime.start("fixer", domain());
    expect(text(view)).toContain("handluje Hana");
    expect(view.choices.map((c) => c.text).slice(0, 2)).toEqual(["Biorę robotę.", "Masz coś do przewiezienia?"]);
    const accepted = runtime.choose(1);
    expect(text(accepted)).toContain("Chłodzone moduły");
    expect(commands).toEqual([{ type: "accept-contract", kind: "delivery" }]);
    // Once Seki knows Hana he stops pointing her out.
    expect(text(runtime.start("fixer", domain({ flags: ["met_hana"] })))).not.toContain("handluje Hana");
  });

  it("no delivery before Seki has proved herself", () => {
    const { runtime } = setup();
    const view = runtime.start("fixer", domain({ completed: 0 }));
    expect(view.choices.map((c) => c.text)).not.toContain("Masz coś do przewiezienia?");
  });

  it("hurries a running delivery with the time left on the clock", () => {
    const { runtime } = setup();
    const view = runtime.start("fixer", domain({ active: delivery("active") }), { tick: 6000 - 42 * 60, ticksPerSecond: 60 });
    expect(text(view)).toContain("Zostało ci 42 s");
    expect(text(runtime.start("fixer", domain({ active: delivery("active") })))).not.toContain("Zostało ci");
  });

  it("pays for a delivered package and leaves Hana's jobs to her", () => {
    const { runtime, commands } = setup();
    const paid = runtime.start("fixer", domain({ active: delivery("cleared") }));
    expect(text(paid)).toContain("moduły doszły zimne");
    expect(commands).toEqual([{ type: "complete-contract" }]);
    const busy = runtime.start("fixer", domain({ active: retrieve("cleared") }));
    expect(text(busy)).toContain("robisz coś dla Hany");
    expect(commands).toHaveLength(1);
  });
});
