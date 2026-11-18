import { describe, expect, it } from "vitest";
import { ENEMY_TYPES } from "@seki/core";
import { CLINIC_WAKE_SPOT, type ChunkDef, DISTRICTS, type DistrictId, MICRO_SPOTS, WORLD_CHUNKS } from "../src";

/*
 * The city between contracts, counted (ADR-0091 stage 1): who stands in each district, the Hebi
 * left after the prologue, the hiding places for bodies and the spots of the street's events, as
 * the content has them. Each number is a floor taken on 18.11 (the ADR's context): the city may
 * only fill up, and the nearest Hebi to where Seki wakes may only come closer. A drop is a
 * regression of the city's life to explain before it is taken in.
 */

/** M0's targets (the prologue): the courier and his guard die in it, so the city never keeps them. */
const PROLOGUE_TARGETS: ReadonlySet<string> = new Set(["courier", "guard"]);

type Census = Record<DistrictId, { readonly people: number; readonly hebi: number; readonly hides: number; readonly spots: number }>;

/** Floors of 18.11 (ADR-0091, „Kontekst”), raised by stage 4's groups (the car wash's yard counts once the prologue is over, so not here). */
const FLOOR: Census = {
  "shinsekai-7": { people: 28, hebi: 6, hides: 3, spots: 3 },
  kanal: { people: 12, hebi: 9, hides: 1, spots: 3 },
  targ: { people: 11, hebi: 11, hides: 0, spots: 3 },
  doki: { people: 2, hebi: 0, hides: 10, spots: 3 },
};

/** Metres from the clinic's wake spot to the nearest Hebi on 18.11: the Bramowa patrol. */
const NEAREST_HEBI = 185;

type Ganger = Extract<ChunkDef["actors"][number], { kind: "ganger" }>;

/** A Hebi of the city after the prologue: Hebi by type, no presence flag (no act, no ambush), not a prologue target. */
const cityHebi = (a: ChunkDef["actors"][number]): a is Ganger =>
  a.kind === "ganger" &&
  (a.enemy === undefined || ENEMY_TYPES[a.enemy].faction === "hebi") &&
  a.when === undefined &&
  !PROLOGUE_TARGETS.has(a.spawn.key ?? "");

const census = (): Census => {
  const out = Object.fromEntries(Object.keys(DISTRICTS).map((d) => [d, { people: 0, hebi: 0, hides: 0, spots: MICRO_SPOTS[d as DistrictId].length }])) as Record<
    DistrictId,
    { people: number; hebi: number; hides: number; spots: number }
  >;
  for (const c of WORLD_CHUNKS) {
    const d = out[c.district];
    d.people += c.actors.length;
    d.hebi += c.actors.filter(cityHebi).length;
    d.hides += [...c.props, ...(c.street ?? []), ...(c.rooms ?? [])].filter((p) => p.hide !== undefined).length;
  }
  return out;
};

describe("the city between contracts, counted (ADR-0091 stage 1)", () => {
  const now = census();

  it.each(Object.keys(DISTRICTS) as DistrictId[])("%s: no fewer people, Hebi, hiding places or street spots than on 18.11", (d) => {
    const floor = FLOOR[d];
    expect(now[d].people, `${d}: characters of the content`).toBeGreaterThanOrEqual(floor.people);
    expect(now[d].hebi, `${d}: Hebi after the prologue`).toBeGreaterThanOrEqual(floor.hebi);
    expect(now[d].hides, `${d}: hiding places for bodies`).toBeGreaterThanOrEqual(floor.hides);
    expect(now[d].spots, `${d}: spots of the street's events`).toBeGreaterThanOrEqual(floor.spots);
  });

  it("keeps a Hebi of the city no farther from the clinic's wake spot than on 18.11", () => {
    const distances = WORLD_CHUNKS.flatMap((c) => c.actors.filter(cityHebi)).map((a) =>
      Math.hypot(a.spawn.position.x - CLINIC_WAKE_SPOT.x, a.spawn.position.z - CLINIC_WAKE_SPOT.z),
    );
    expect(distances.length, "Hebi of the city after the prologue").toBeGreaterThanOrEqual(5);
    expect(Math.min(...distances), "metres to the nearest Hebi").toBeLessThanOrEqual(NEAREST_HEBI);
  });
});
