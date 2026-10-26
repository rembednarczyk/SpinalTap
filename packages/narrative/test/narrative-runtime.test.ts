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

  it("after the quest, Kaito uses the alias", () => {
    const { runtime } = setup();
    const domain = createDomainState();
    const view = runtime.start("fixer", {
      ...domain,
      quests: { m0_first_contract: { status: "completed" } },
      character: { ...domain.character, alias: "Seki Senshi" },
    });
    expect(view.lines[0]?.text).toBe("Na dziś koniec, Seki Senshi. Odpocznij, póki możesz.");
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
