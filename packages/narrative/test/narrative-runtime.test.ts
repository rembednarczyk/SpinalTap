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

describe("act I: Echo (M3)", () => {
  const echo = (stepIndex: number, patch: Partial<DomainState> = {}): DomainState => {
    const d = createDomainState();
    return {
      ...d,
      quests: { m0_first_contract: { status: "completed" }, m3_echo: { status: "active", stepIndex } },
      character: { ...d.character, alias: "Seki Senshi", memories: ["combat_reflex"] },
      ...patch,
    };
  };
  const withMemories = (d: DomainState, ...memories: DomainState["character"]["memories"]): DomainState => ({
    ...d,
    character: { ...d.character, memories: [...d.character.memories, ...memories] },
  });
  const text = (v: { lines: readonly { text: string }[] }) => v.lines.map((l) => l.text).join("\n");

  it.each([
    ["recall_courier_case", 0, { type: "story-choice", choice: "case", option: "opened" }, "chipów pamięci"],
    ["recall_courier_case", 1, { type: "story-choice", choice: "case", option: "sealed" }, "lżejsza, niż powinna"],
    ["recall_operating_table", 0, { type: "story-choice", choice: "name", option: "spoken" }, "Nazywam się Aya"],
    ["recall_operating_table", 1, { type: "story-choice", choice: "name", option: "silent" }, "nie podaje imienia"],
    ["recall_crash_night", 0, { type: "story-choice", choice: "crash", option: "wheel" }, "sama o tym zdecydowałaś"],
    ["recall_crash_night", 1, { type: "story-choice", choice: "crash", option: "ren" }, "zapis zakończony"],
  ] as const)("%s, choice %i: records the choice and marks the flashback played", (knot, pick, command, line) => {
    const { runtime, commands } = setup();
    const first = runtime.start(knot, echo(0));
    expect(first.choices).toHaveLength(2);
    const view = runtime.choose(pick);
    expect(view.ended).toBe(true);
    expect(text(view)).toContain(line);
    const memory = knot.replace("recall_", "");
    expect(commands).toEqual([command, { type: "set-flag", flag: `recalled:${memory}` }]);
  });

  it("names the people inside the memories", () => {
    const { runtime } = setup();
    expect(runtime.start("recall_courier_case", echo(0)).lines.find((l) => l.speaker)?.speaker).toBe("Ren");
    expect(runtime.start("recall_operating_table", echo(0)).lines.find((l) => l.speaker)?.speaker).toBe("Technik Kagami");
  });

  it("Mori explains the module once the first flashback was played", () => {
    const { runtime, commands } = setup();
    let view = runtime.start("mori", echo(1, { flags: ["recalled:courier_case"] }));
    expect(view.lines[0]?.speaker).toBe("Doktor Mori");
    expect(text(view)).toContain("Moduł pamięci Kagami");
    view = runtime.choose(1);
    expect(view.ended).toBe(true);
    expect(commands).toEqual([{ type: "set-flag", flag: "mori_module" }]);
  });

  it("Mori only small-talks before the flashback, and hints at implants on the implant step", () => {
    const { runtime, commands } = setup();
    expect(text(runtime.start("mori", echo(1)))).toContain("Coś boli?");
    expect(text(runtime.start("mori", echo(2)))).toContain("budzi się przy nowym chromie");
    expect(commands).toEqual([]);
  });

  const choices = (c: DomainState["story"]["choices"]): Partial<DomainState> => ({
    story: { choices: c, ending: null },
    flags: ["recalled:crash_night"],
  });

  it("finale: two owned memories keep the module and bring back the name Aya", () => {
    const { runtime, commands } = setup();
    const view = runtime.start("mori", echo(3, choices({ case: "opened", name: "spoken", crash: "ren" })));
    expect(view.ended).toBe(true);
    expect(text(view)).toContain("chip z moim imieniem");
    expect(text(view)).toContain("Czterdzieści razy");
    expect(text(view)).not.toContain("sama skręciłam");
    expect(text(view)).toContain("Zostaw go.");
    expect(view.lines.at(-2)?.speaker).toBe("Seki Senshi");
    expect(commands).toEqual([{ type: "set-alias", alias: "Aya" }, { type: "resolve-ending" }]);
  });

  it("finale: otherwise Mori cuts the module out and she stays Seki", () => {
    const { runtime, commands } = setup();
    const view = runtime.start("mori", echo(3, choices({ case: "sealed", name: "silent", crash: "wheel" })));
    expect(text(view)).toContain("Teraz też nie muszę");
    expect(text(view)).toContain("nie podałam im imienia");
    expect(text(view)).not.toContain("skończył jak ich maszyna");
    expect(text(view)).toContain("Wyjmij go.");
    expect(commands).toEqual([{ type: "resolve-ending" }]);
  });

  it("after the ending Mori remembers what was decided", () => {
    const { runtime } = setup();
    const done = (ending: "aya" | "seki") => ({ ...createDomainState(), story: { choices: {}, ending } });
    expect(text(runtime.start("mori", done("aya")))).toContain("Aya. Jak głowa?");
    expect(text(runtime.start("mori", done("seki")))).toContain("Fiolka");
  });

  it("Kaito notices the first glitch while paying for the act I contract", () => {
    const { runtime } = setup();
    const view = runtime.start("fixer", echo(0, { contracts: { active: { id: "c1", siteId: "east_lot", targets: 2, reward: 500, status: "cleared" }, completed: 0 } }));
    expect(text(view)).toContain("Gdzie odpłynęłaś?");
  });

  it("the stół memory unlocks a question about Kagami for Kaito", () => {
    const { runtime } = setup();
    const before = runtime.start("fixer", echo(2));
    expect(before.choices).toHaveLength(3);
    const view = runtime.start("fixer", withMemories(echo(2), "courier_case", "operating_table"));
    expect(view.choices.map((c) => c.text)).toContain("Co wiesz o Kagami Biotech?");
    const answer = runtime.choose(3);
    expect(text(answer)).toContain("Kupują od ludzi wspomnienia");
    expect(answer.choices).toHaveLength(3);
  });

  it("the walizka memory unlocks a question about Ren for Ume", () => {
    const { runtime, commands } = setup();
    let view = runtime.start("ume", withMemories(echo(1), "courier_case"));
    expect(view.choices.map((c) => c.text)).toEqual(["Znałaś mnie wcześniej?", "Muszę iść.", "Pamiętasz Rena?"]);
    view = runtime.choose(2);
    expect(text(view)).toContain("Ren Odagiri");
    expect(commands).toEqual([
      { type: "set-flag", flag: "ume_ren" },
      { type: "change-reputation", faction: "civilians", delta: 3 },
    ]);

    // After Ume's own memory she still offers the Ren talk, until it happened.
    view = runtime.start("ume", withMemories(echo(1, { flags: ["ume_memory"] }), "courier_case"));
    expect(view.choices.map((c) => c.text)).toEqual(["Pamiętasz Rena?", "Muszę iść."]);
    expect(text(runtime.choose(0))).toContain("ludzie w czystych butach");
    view = runtime.start("ume", withMemories(echo(1, { flags: ["ume_memory", "ume_ren"] }), "courier_case"));
    expect(view.ended).toBe(true);
  });

  it("rejects unknown memories and story choices coming from ink", () => {
    const run = (body: string) => new NarrativeRuntime(`${STORY_SOURCE}\n=== bad ===\n${body}\n-> END`, () => {}).start("bad", createDomainState());
    expect(() => run('{ has_memory("nope"): x }')).toThrow(/unknown memory/);
    expect(() => run('~ story_choice("case", "maybe")')).toThrow(/unknown story choice/);
    expect(() => run('~ story_choice("mood", "opened")')).toThrow(/unknown story choice/);
  });
});
