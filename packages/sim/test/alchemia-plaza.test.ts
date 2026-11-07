import { describe, expect, it } from "vitest";
import {
  ALCHEMIA_MEMORIAL,
  ALCHEMIA_PROPS,
  ALCHEMIA_T1,
  ALCHEMIA_T2,
  ARKADY,
  ARKADY_ARCADE_FLOOR,
  ARKADY_OSM_ID,
  ARKADY_OUTLINE,
  ARKADY_PROP,
  CONTRACT_ITEM_SPOTS,
  HEBI_LOOKOUT_POST,
  HEBI_STASH_ZONE,
  TARG_CONTRACT_SITE_SPAWNS,
  TARG_OVERPASS_STASH,
  T2_PADS,
  T2_STAIRS,
  arkadyLocal,
  arkadyPoint,
  groundY,
} from "../src";
import { chunkBuildings } from "../src/content/lublin/city";
import { SITE_PLANS } from "../src/content/contract-plans";
import { MAP_CHUNKS, PADS, RAMPS } from "../src/content/lublin/sites";

/**
 * The lower square T2 and the rebuilt Arkady (ADR-0074 stage 2) as content: T2 levelled where the
 * Hebi hollow was, the arcade's floor level with it, the stairs from T1 laid over the pads, the
 * memorial stone clear of every job, the Arkady on their OSM outline in the map ruin's place, the
 * Hebi stash, its bag and the lookout on T2 by them.
 */
describe("T2 and the Arkady (ADR-0074 stage 2)", () => {
  it("levels T2 under its own row, without the Hebi hollow's pad, the stairs laid over the pads", () => {
    expect(T2_PADS.length).toBeGreaterThan(10);
    for (const p of T2_PADS) expect(p).toMatchObject({ y: ALCHEMIA_T2, row: "T-217" });
    expect(PADS.filter((p) => p.row === "T-186")).toEqual([]);
    expect(RAMPS).toContain(T2_STAIRS);
    expect(T2_STAIRS).toMatchObject({ ya: ALCHEMIA_T1, yb: ALCHEMIA_T2, over: true });
    // The stairs keep their grade where T1's blend reaches over them, up to their foot on T2.
    for (let z = T2_STAIRS.a.z; z <= T2_STAIRS.b.z; z += 1) {
      const want = ALCHEMIA_T1 + ((ALCHEMIA_T2 - ALCHEMIA_T1) * (z - T2_STAIRS.a.z)) / (T2_STAIRS.b.z - T2_STAIRS.a.z);
      expect(groundY(T2_STAIRS.a.x, z), `z ${z}`).toBeCloseTo(want, 1);
    }
  });

  it("keeps the arcade's floor level on T2 under its paving, from its first pier to its north end", () => {
    const span = ARKADY.length / ARKADY.spans;
    for (let a = span; a <= ARKADY.length - ARKADY.pier; a += 0.5) {
      for (let c = 0; c <= ARKADY.arcade; c += 0.4) {
        const p = arkadyPoint(a, c);
        expect(groundY(p.x, p.z), `${a},${c}`).toBeCloseTo(ALCHEMIA_T2, 2);
      }
    }
    expect(ARKADY_ARCADE_FLOOR - ALCHEMIA_T2).toBeLessThan(0.05);
  });

  it("stands the Arkady on their OSM outline, two storeys, in the map's ruin's place among the chunk's buildings", () => {
    const chunk = MAP_CHUNKS.find((c) => c.buildings.some((b) => b.id === ARKADY_OSM_ID))!;
    const ruin = chunk.buildings.find((b) => b.id === ARKADY_OSM_ID)!;
    for (let i = 0; i < ruin.outline.length; i += 2) {
      const p = { x: ruin.outline[i]! + ruin.x, z: ruin.outline[i + 1]! + ruin.z };
      expect(Math.min(...ARKADY_OUTLINE.map((q) => Math.hypot(p.x - q.x, p.z - q.z)))).toBeLessThan(0.01);
    }
    const props = chunkBuildings(chunk, []);
    expect(props.indexOf(ARKADY_PROP)).toBeGreaterThanOrEqual(0);
    expect(props).toHaveLength(chunk.buildings.length);
    expect(ALCHEMIA_PROPS).not.toContain(ARKADY_PROP);
    expect(ARKADY.roof - ARKADY.ground).toBeGreaterThan(6);
  });

  it("leaves the memorial stone with the square's name clear of every job's people and things (§6)", () => {
    const m = { x: (ALCHEMIA_MEMORIAL.x0 + ALCHEMIA_MEMORIAL.x1) / 2, z: (ALCHEMIA_MEMORIAL.z0 + ALCHEMIA_MEMORIAL.z1) / 2 };
    const plans = (["hana_stall", "hebi_stash", "raid_north", "raid_east"] as const).flatMap((k) => {
      const p = SITE_PLANS[k];
      return p ? [...(p.guards ?? []), ...(p.ambush ?? []), ...(p.lookout ? [p.lookout] : []), ...(p.twin ? [p.twin] : [])] : [];
    });
    const spots = [...Object.values(TARG_CONTRACT_SITE_SPAWNS).flat(), ...Object.values(CONTRACT_ITEM_SPOTS), ...plans];
    expect(plans.length).toBeGreaterThan(5);
    for (const s of spots) expect(Math.hypot(s!.x - m.x, s!.z - m.z)).toBeGreaterThan(10);
    expect(groundY(m.x, m.z)).toBeCloseTo(ALCHEMIA_T2, 1);
  });

  it("keeps the Hebi stash, the blockade's bag and the lookout on T2 by the Arkady, the lookout under their arches", () => {
    const crate = CONTRACT_ITEM_SPOTS.hebi_stash!;
    expect(groundY(crate.x, crate.z)).toBeCloseTo(ALCHEMIA_T2, 2);
    expect(crate.x).toBeGreaterThan(HEBI_STASH_ZONE.minX);
    expect(crate.x).toBeLessThan(HEBI_STASH_ZONE.maxX);
    expect(crate.z).toBeGreaterThan(HEBI_STASH_ZONE.minZ);
    expect(crate.z).toBeLessThan(HEBI_STASH_ZONE.maxZ);
    for (const s of TARG_CONTRACT_SITE_SPAWNS.hebi_stash) expect(s.y).toBeCloseTo(ALCHEMIA_T2, 1);
    expect(TARG_OVERPASS_STASH.at.y - 0.2).toBeCloseTo(ALCHEMIA_T2, 2);
    const look = arkadyLocal(HEBI_LOOKOUT_POST.x, HEBI_LOOKOUT_POST.z);
    expect(look.c).toBeGreaterThan(0.5);
    expect(look.c).toBeLessThan(ARKADY.arcade);
    expect(HEBI_LOOKOUT_POST.y).toBe(ARKADY_ARCADE_FLOOR);
  });
});
