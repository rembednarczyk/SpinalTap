import { describe, expect, it } from "vitest";
import { createDomainState } from "@seki/core";
import { NarrativeRuntime, STORY_SOURCE, STORY_SOURCES } from "../src";

/**
 * The runtime in two languages (ADR-0056): it reads the source of the language asked for, keeps
 * the ink state when the language changes (from the next line on, mid-conversation too) and
 * plays Polish where a language has no source.
 */

const story = (base: string, hello: string, a: string, b: string, after: string, again: string) => `${base}
=== lang_probe ===
{ lang_probe > 1:
    UME: ${again}
}
UME: ${hello}
* [${a} #tone:main]
    SEKI: ${a}
    ~ set_flag("asked")
* [${b} #tone:leave]
    -> END
- UME: ${after}
-> END
`;

const SOURCES = {
  pl: story(STORY_SOURCE, "Dzień dobry.", "Kim jesteś?", "Idę.", "Jestem Ume.", "Znowu ty."),
  en: story(STORY_SOURCES.en ?? "", "Good morning.", "Who are you?", "Leaving.", "I'm Ume.", "You again."),
};

const domain = () => createDomainState();
const texts = (view: { lines: readonly { text: string }[] }) => view.lines.map((l) => l.text);

describe("narrative language (ADR-0056)", () => {
  it("speaks the language asked for, with the speakers named in it", () => {
    const en = new NarrativeRuntime(SOURCES, () => {}, "en").start("lang_probe", domain());
    expect(texts(en)).toEqual(["Good morning."]);
    expect(en.lines[0]?.speaker).toBe("Grandma Ume");
    expect(en.choices.map((c) => [c.text, c.tone])).toEqual([["Who are you?", "main"], ["Leaving.", "leave"]]);
    const pl = new NarrativeRuntime(SOURCES, () => {}, "pl").start("lang_probe", domain());
    expect(texts(pl)).toEqual(["Dzień dobry."]);
    expect(pl.lines[0]?.speaker).toBe("Babcia Ume");
  });

  it("switches from the next line on, in the middle of a conversation", () => {
    const flags: string[] = [];
    const runtime = new NarrativeRuntime(SOURCES, (c) => c.type === "set-flag" && flags.push(c.flag), "pl");
    runtime.start("lang_probe", domain());
    runtime.setLanguage("en");
    expect(runtime.language).toBe("en");
    expect(runtime.inConversation).toBe(true);
    const view = runtime.choose(0);
    expect(texts(view)).toEqual(["Who are you?", "I'm Ume."]);
    expect(view.lines[0]?.speaker).toBe("You");
    expect(flags).toEqual(["asked"]);
  });

  it("loads a save written in the other language, visit counts and all", () => {
    const pl = new NarrativeRuntime(SOURCES, () => {}, "pl");
    pl.start("lang_probe", domain());
    pl.choose(0);
    const save = pl.saveState();
    const en = new NarrativeRuntime(SOURCES, () => {}, "en");
    en.loadState(save);
    expect(texts(en.start("lang_probe", domain()))).toEqual(["You again.", "Good morning."]);
  });

  it("keeps the state across a switch and back, and rolls an interrupted talk back in either", () => {
    const runtime = new NarrativeRuntime(SOURCES, () => {}, "en");
    runtime.start("lang_probe", domain());
    runtime.setLanguage("pl");
    expect(runtime.interrupt()).toBe(true);
    runtime.setLanguage("en");
    expect(texts(runtime.start("lang_probe", domain()))).toEqual(["Good morning."]);
  });

  it("plays Polish where a language has no source of its own", () => {
    const plain = new NarrativeRuntime(SOURCES.pl, () => {}, "en");
    expect(plain.language).toBe("pl");
    expect(plain.start("lang_probe", domain()).lines[0]?.speaker).toBe("Babcia Ume");
    const partial = new NarrativeRuntime({ pl: SOURCES.pl }, () => {});
    partial.setLanguage("en");
    expect(partial.language).toBe("pl");
  });

  it("has both languages of the game's story", () => {
    expect(STORY_SOURCES.pl.length).toBeGreaterThan(0);
    expect(STORY_SOURCES.en?.length).toBeGreaterThan(0);
  });
});
