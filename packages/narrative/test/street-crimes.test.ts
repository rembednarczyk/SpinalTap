import { describe, expect, it } from "vitest";
import { type GameCommand, createDomainState } from "@seki/core";
import { NarrativeRuntime, storySource } from "../src";

/*
 * The gang's offer at a street crime (ADR-0091 stage 5c): one knot per kind a gang runs, in both
 * languages; the lookout's choice takes the job (`assist-street-crime`), the other walks on and
 * sends nothing.
 */

const KINDS = ["extortion", "deal", "droneTheft", "kidnap"] as const;

describe("the gang's offer at a street crime (ADR-0091 stage 5c)", () => {
  for (const language of ["pl", "en"] as const) {
    it(`offers the lookout's part in ${language} and takes it with the first choice`, () => {
      for (const kind of KINDS) {
        const commands: GameCommand[] = [];
        const runtime = new NarrativeRuntime(storySource(language), (c) => commands.push(c));
        const view = runtime.start(`crime_assist_${kind}`, createDomainState());
        expect(view.lines[0]?.speaker, kind).toBe("Hebi");
        expect(view.choices, kind).toHaveLength(2);
        runtime.choose(view.choices[0]!.index);
        expect(commands, kind).toEqual([{ type: "assist-street-crime" }]);
      }
    });

    it(`sends nothing when she walks on (${language})`, () => {
      for (const kind of KINDS) {
        const commands: GameCommand[] = [];
        const runtime = new NarrativeRuntime(storySource(language), (c) => commands.push(c));
        const view = runtime.start(`crime_assist_${kind}`, createDomainState());
        runtime.choose(view.choices[1]!.index);
        expect(commands, kind).toEqual([]);
      }
    });
  }
});
