import { describe, expect, it } from "vitest";
import { MICRO_EVENT_REWARD, streetDistrusts } from "../src";

/**
 * ADR-0070 stage 5: more crimes of the street while it thinks badly of the player. The entry roll's
 * 25% went with ADR-0091 stage 5b; the board holds two crimes per district below −10.
 */
describe("the street's distrust (ADR-0070, ADR-0091 stage 5b)", () => {
  it.each([
    [100, false],
    [11, false],
    [0, false],
    [-10, false],
    [-11, true],
    [-49, true],
    [-50, true],
    [-100, true],
  ])("at %i: %s", (civilians, distrusts) => {
    expect(streetDistrusts(civilians)).toBe(distrusts);
  });

  it("an aid +3, a mugging +3 as before", () => {
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
