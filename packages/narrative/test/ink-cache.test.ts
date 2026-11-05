import type * as Ink from "inkjs/full";
import { describe, expect, it, vi } from "vitest";
import { type GameCommand, createDomainState } from "@seki/core";
import { InkCompileError, NarrativeRuntime, STORY_SOURCE, STORY_SOURCES, loadInk } from "../src";

/** Counts the ink compilations, so a test sees whether a runtime compiled its story again. */
const compiles = vi.hoisted(() => ({ count: 0 }));
vi.mock("inkjs/full", async (importOriginal) => {
  const ink = await importOriginal<typeof Ink>();
  // One compiler per compilation; Compile itself is an instance field, so it cannot be overridden.
  class CountingCompiler extends ink.Compiler {
    constructor(...args: ConstructorParameters<typeof ink.Compiler>) {
      super(...args);
      compiles.count += 1;
    }
  }
  return { ...ink, Compiler: CountingCompiler };
});

const runtime = (source: string | typeof STORY_SOURCES = STORY_SOURCE, commands: GameCommand[] = []) =>
  new NarrativeRuntime(source, (c) => commands.push(c), { locale: "pl" });

/** ink state without the seed inkjs rolls for every new story. */
const stateOf = (r: NarrativeRuntime): unknown => ({ ...(JSON.parse(r.saveState()) as object), storySeed: 0 });

/** The first line of Kaito's first meeting. */
const firstLine = (r: NarrativeRuntime) => r.start("fixer", createDomainState()).lines[0]?.text;

describe("compiled ink is shared, the story state is not (G-325)", () => {
  it("compiles a source once for any number of runtimes", () => {
    runtime();
    const before = compiles.count;
    for (let i = 0; i < 3; i++) runtime();
    expect(compiles.count).toBe(before);
  });

  it("compiles each language once and the switch back again not at all", () => {
    const r = runtime(STORY_SOURCES);
    r.setLanguage("en");
    r.setLanguage("pl");
    const before = compiles.count;
    const other = runtime(STORY_SOURCES);
    other.setLanguage("en");
    expect(compiles.count).toBe(before);
    expect(firstLine(other)).toBe("Well, look at that. The walking corpse from the wreck on Krakowskie.");
  });

  it("gives every runtime its own state and its own externals", () => {
    const aCommands: GameCommand[] = [];
    const bCommands: GameCommand[] = [];
    const a = runtime(STORY_SOURCE, aCommands);
    const b = runtime(STORY_SOURCE, bCommands);
    const fresh = stateOf(b);
    a.start("fixer", createDomainState());
    a.choose(0);
    a.choose(0);
    expect(aCommands.length).toBeGreaterThan(0);
    expect(bCommands).toEqual([]);
    expect(stateOf(b)).toEqual(fresh);
    expect(stateOf(a)).not.toEqual(fresh);
    // A runtime made after a's conversation starts from the beginning too.
    expect(stateOf(runtime())).toEqual(fresh);
    expect(firstLine(b)).toBe("No proszę. Chodzący trup z wraku na Krakowskim.");
  });

  it("returns a new story every time", () => {
    expect(loadInk(STORY_SOURCE) === loadInk(STORY_SOURCE)).toBe(false);
  });

  it("keeps different sources apart and does not keep a source that does not compile", () => {
    expect(loadInk("Small story.\n-> END").Continue()).toBe("Small story.\n");
    expect(firstLine(runtime())).toBe("No proszę. Chodzący trup z wraku na Krakowskim.");
    const broken = "=== a ===\n-> nowhere";
    expect(() => loadInk(broken)).toThrow(InkCompileError);
    const before = compiles.count;
    expect(() => loadInk(broken)).toThrow(InkCompileError);
    // A source that does not compile is compiled again, which also shows the count sees compilations.
    expect(compiles.count).toBe(before + 1);
  });
});
