import { describe, expect, it } from "vitest";
import { MICRO_EVENT_CHANCE, MICRO_EVENT_CHANCE_DISTRUSTED, MICRO_EVENT_REWARD, microEventChance } from "../src";

/** ADR-0070 stage 5: micro-events more often while the street thinks badly of the player. */
describe("the chance of a micro-event (ADR-0070)", () => {
  it.each([
    [100, 0.12],
    [11, 0.12],
    [0, 0.12],
    [-10, 0.12],
    [-11, 0.25],
    [-49, 0.25],
    [-50, 0.25],
    [-100, 0.25],
  ])("at %i: %f", (civilians, chance) => {
    expect(microEventChance(civilians)).toBe(chance);
  });

  it("12% and 25%; an aid +3, a mugging +3 as before", () => {
    expect([MICRO_EVENT_CHANCE, MICRO_EVENT_CHANCE_DISTRUSTED]).toEqual([0.12, 0.25]);
    // The extortion of the street's board came with ADR-0091 stage 5a, the deal, the drone and the kidnap with 5b.
    expect(MICRO_EVENT_REWARD).toEqual({
      mugging: { eddies: 70, civilians: 3 },
      aid: { eddies: 25, civilians: 3 },
      extortion: { eddies: 90, civilians: 3 },
      deal: { eddies: 110, civilians: 2 },
      droneTheft: { eddies: 80, civilians: 3 },
      kidnap: { eddies: 120, civilians: 4 },
    });
  });
});
