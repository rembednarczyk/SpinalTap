import { describe, expect, it } from "vitest";
import { type DomainState, type GameCommand, M0_TARGET_TAG, createDomainState, killedFlag } from "@seki/core";
import { InkCompileError, NarrativeRuntime, STORY_SOURCE, compileInk } from "../src";

const setup = () => {
  const commands: GameCommand[] = [];
  const runtime = new NarrativeRuntime(STORY_SOURCE, (c) => commands.push(c));
  return { runtime, commands };
};

const atStep = (stepIndex: number, patch: Partial<DomainState> = {}): DomainState => ({
  ...createDomainState(),
  quests: { m0_first_contract: { status: "active", stepIndex } },
  ...patch,
});

describe("ink content", () => {
  it("compiles without errors", () => {
    expect(() => compileInk(STORY_SOURCE)).not.toThrow();
  });

  it("reports compile errors", () => {
    expect(() => compileInk("=== a ===\n-> nowhere")).toThrow(InkCompileError);
  });
});

describe("fixer conversation", () => {
  it("first meeting: names Seki, gives the contract and raises met_fixer", () => {
    const { runtime, commands } = setup();
    let view = runtime.start("fixer", createDomainState());
    expect(view.lines[0]).toEqual({ speaker: "Kaito", text: "No proszę. Chodzący trup z wraku na Siódmej." });
    expect(view.choices.map((c) => c.text)).toEqual(["Kim jesteś?", "Co mi się stało?"]);

    view = runtime.choose(0);
    expect(view.lines[0]?.speaker).toBe("Ty");
    expect(view.choices).toHaveLength(2);

    view = runtime.choose(0);
    expect(view.lines[0]).toEqual({ speaker: "Seki Senshi", text: "Niech będzie. Na razie." });
    expect(view.ended).toBe(true);
    expect(commands).toEqual([
      { type: "set-alias", alias: "Seki Senshi" },
      { type: "change-reputation", faction: "fixers", delta: 5 },
      { type: "set-flag", flag: "met_fixer" },
    ]);
  });

  it("refusing the name still sets the alias but skips the reputation bonus", () => {
    const { runtime, commands } = setup();
    runtime.start("fixer", createDomainState());
    runtime.choose(1);
    runtime.choose(1);
    expect(commands.map((c) => c.type)).toEqual(["set-alias", "set-flag"]);
  });

  it("while the contract is open, Kaito sends her to the alley", () => {
    const { runtime, commands } = setup();
    const view = runtime.start("fixer", atStep(1));
    expect(view.lines[0]?.text).toContain("Kurier dalej oddycha");
    expect(runtime.choose(1).ended).toBe(true);
    expect(commands).toEqual([]);
  });

  it("payday raises reported_back and costs standing with Hebi", () => {
    const { runtime, commands } = setup();
    runtime.start("fixer", atStep(2, { flags: ["met_fixer", killedFlag(M0_TARGET_TAG)] }));
    const view = runtime.choose(0);
    expect(view.ended).toBe(true);
    expect(commands).toEqual([
      { type: "change-reputation", faction: "fixers", delta: 5 },
      { type: "change-reputation", faction: "hebi", delta: -15 },
      { type: "set-flag", flag: "reported_back" },
    ]);
  });

  it("after the quest, Kaito uses the alias when offering more work", () => {
    const { runtime } = setup();
    const domain = createDomainState();
    const view = runtime.start("fixer", {
      ...domain,
      quests: { m0_first_contract: { status: "completed" } },
      character: { ...domain.character, alias: "Seki Senshi" },
      contracts: { active: null, completed: 1 },
    });
    expect(view.lines[0]?.text).toBe("Hebi znowu wystawili ludzi na moją ulicę. Robota czeka, Seki Senshi.");
  });
});

describe("Ume conversation", () => {
  it("returns a memory once, then remembers she told it", () => {
    const { runtime, commands } = setup();
    let view = runtime.start("ume", createDomainState());
    expect(view.lines.some((l) => l.text.includes("Neon Koi"))).toBe(true);
    view = runtime.choose(0);
    expect(view.lines.find((l) => l.speaker === null)?.text).toContain("deszcz");
    expect(commands).toContainEqual({ type: "unlock-memory", memoryId: "street_runner" });

    view = runtime.start("ume", { ...createDomainState(), flags: ["ume_memory"] });
    expect(view.ended).toBe(true);
    expect(view.lines).toHaveLength(1);
  });

  it("refuses to talk when the street fears Seki", () => {
    const { runtime, commands } = setup();
    const d = createDomainState();
    const view = runtime.start("ume", { ...d, reputation: { ...d.reputation, civilians: -30 } });
    expect(view.lines).toEqual([{ speaker: "Babcia Ume", text: "Nie podchodź do mnie. Widziałam, co robisz na tej ulicy." }]);
    expect(view.ended).toBe(true);
    expect(commands).toEqual([]);
  });
});

describe("reputation in Kaito's offer", () => {
  const offer = (reputation: Partial<DomainState["reputation"]>) => {
    const d = createDomainState();
    return setup().runtime.start("fixer", {
      ...d,
      quests: { m0_first_contract: { status: "completed" } },
      character: { ...d.character, alias: "Seki Senshi" },
      reputation: { ...d.reputation, ...reputation },
    });
  };
  const texts = (r: Partial<DomainState["reputation"]>) => offer(r).lines.map((l) => l.text);

  it("says nothing extra while everyone is neutral", () => {
    expect(texts({})).toHaveLength(1);
  });

  it("warns about a hostile gang, or teases about a friendly one", () => {
    expect(texts({ hebi: -20 }).some((t) => t.includes("strzelają do ciebie bez gadania"))).toBe(true);
    expect(texts({ hebi: 20 }).some((t) => t.includes("już do ciebie nie strzelają"))).toBe(true);
  });

  it("acknowledges a good standing with the fixers", () => {
    expect(texts({ fixers: 40 }).some((t) => t.includes("lepsze stawki"))).toBe(true);
  });
});

describe("state persistence", () => {
  it("saves and restores ink state", () => {
    const { runtime } = setup();
    runtime.start("fixer", createDomainState());
    runtime.choose(0);
    const json = runtime.saveState();
    const other = setup().runtime;
    other.loadState(json);
    expect(other.saveState()).toBe(json);
    other.resetState();
    expect(other.saveState()).not.toBe(json);
  });
});

describe("fixer contracts (M1)", () => {
  const afterM0 = (contracts: DomainState["contracts"]): DomainState => {
    const d = createDomainState();
    return {
      ...d,
      quests: { m0_first_contract: { status: "completed" } },
      character: { ...d.character, alias: "Seki Senshi" },
      contracts,
    };
  };

  it("offers a job and accepts it", () => {
    const { runtime, commands } = setup();
    const view = runtime.start("fixer", afterM0({ active: null, completed: 0 }));
    expect(view.choices.map((c) => c.text)).toEqual([
      "Biorę robotę.",
      "Jeśli chcesz lepszego sprzętu, idź do doktora Mori.",
      "Nie dziś.",
    ]);
    expect(runtime.choose(0).ended).toBe(true);
    expect(commands).toEqual([{ type: "accept-contract" }]);
  });

  it("points to the ripperdoc and comes back to the offer", () => {
    const { runtime } = setup();
    runtime.start("fixer", afterM0({ active: null, completed: 0 }));
    const view = runtime.choose(1);
    expect(view.lines.some((l) => l.text.includes("doktora Mori"))).toBe(true);
    expect(view.choices).toHaveLength(3);
  });

  it("names the site of a running contract", () => {
    const { runtime } = setup();
    const view = runtime.start(
      "fixer",
      afterM0({ active: { id: "c1", siteId: "east_lot", targets: 2, reward: 500, status: "active" }, completed: 0 }),
    );
    expect(view.lines[0]?.text).toContain("parking przy furgonetce");
    expect(view.ended).toBe(true);
  });

  it("pays for a cleared contract and offers the next one", () => {
    const { runtime, commands } = setup();
    const view = runtime.start(
      "fixer",
      afterM0({ active: { id: "c3", siteId: "car_wash", targets: 3, reward: 800, status: "cleared" }, completed: 2 }),
    );
    expect(commands).toEqual([{ type: "complete-contract" }]);
    expect(view.lines.some((l) => l.text.includes("nie chybia"))).toBe(true);
    expect(view.choices[0]?.text).toBe("Biorę robotę.");
  });
});
