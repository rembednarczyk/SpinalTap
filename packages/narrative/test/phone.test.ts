import { describe, expect, it } from "vitest";
import { STORY_SOURCE } from "../src/content";
import { compileInk } from "../src/narrative-runtime";

describe("phone texts (ADR-0029)", () => {
  it("has a knot for every fixer and situation the simulation sends", () => {
    const story = compileInk(STORY_SOURCE);
    // Phone texts call no external functions; the rest of the story does, so bind no-ops.
    for (const name of ["has_flag", "set_alias", "change_rep", "set_flag", "has_memory", "accept_contract", "offer_contract", "story_choice", "complete_contract", "unlock_memory", "end_act", "end_act2", "deliver_contract"])
      story.BindExternalFunction(name, () => 0);
    for (const fixer of ["kaito", "hana", "genzo"])
      for (const situation of ["offer", "paid", "failed"]) {
        story.ChoosePathString(`phone_${fixer}_${situation}`);
        const text = story.ContinueMaximally();
        expect(text.trim().length).toBeGreaterThan(10);
        expect(story.currentChoices).toHaveLength(0);
      }
  });
});
