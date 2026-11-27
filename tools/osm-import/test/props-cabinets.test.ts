import { describe, expect, it } from "vitest";
import { LUBLIN_PROP_TABLE } from "../../../packages/sim/src/content/lublin/props.generated.ts";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites.ts";
import { Site } from "../src/props-site.ts";

/**
 * The street cabinets by the kerbs (power, telecoms, signals) stand on the ground their cables run
 * in, not on a bridge's deck: one on the deck of Zamkowa's viaduct (740.4; 167.6) stood in the way
 * of the chase down its steps (G-255, `flight-chase.test.ts`) once the stations moved with E3.
 */
describe("the street cabinets", () => {
  it("stand on no bridge's deck", () => {
    const site = new Site(MAP_CHUNKS);
    const onDecks: string[] = [];
    for (const kinds of Object.values(LUBLIN_PROP_TABLE)) {
      const a = kinds["street-cabinet"] ?? [];
      for (let i = 0; i + 4 < a.length; i += 5) if (site.deckAt({ x: a[i]!, z: a[i + 2]! }) !== null) onDecks.push(`${a[i]},${a[i + 2]}`);
    }
    expect(onDecks).toEqual([]);
  });
});
