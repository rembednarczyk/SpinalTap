import { describe, expect, it } from "vitest";
import {
  ALCHEMIA_MEMORIAL,
  ALCHEMIA_PROPS,
  ALCHEMIA_T1,
  ALCHEMIA_T2,
  ARKADY,
  ARKADY_ARCADE_FLOOR,
  ARKADY_ARCADE_SPAN,
  ARKADY_BUILDING,
  ARKADY_OSM_ID,
  ARKADY_OUTLINE,
  ARKADY_PROP,
  ARKADY_RESTAURANTS,
  CONTRACT_ITEM_SPOTS,
  HEBI_LOOKOUT_POST,
  HEBI_STASH_ZONE,
  TARG_CONTRACT_SITE_SPAWNS,
  TARG_OVERPASS_STASH,
  T2_PADS,
  T2_STAIRS,
  arkadyLocal,
  arkadyPoint,
  arkadySpanMid,
  groundY,
} from "../src";
import { DEVICES } from "../src/content/devices";
import { chunkBuildings } from "../src/content/lublin/city";
import { SITE_PLANS } from "../src/content/contract-plans";
import { MAP_CHUNKS, PADS, RAMPS } from "../src/content/lublin/sites";

/** The middles of the arcade's piers from the south corner on the PZGiK orthophoto (5 cm/px, ±0.15 m, review of #357). */
const ORTHO_PIERS = [2.95, 6.25, 9.9, 13.6, 17.2, 20.8, 24.55, 28.25, 31.75, 35.4, 39.1, 42.95, 46.4];

/** The arcade's piers as built: the walls on the west face, at most a metre on a side, from under the floor; not the north corner's. */
const builtPiers = () =>
  ARKADY_BUILDING.filter((p) => p.kind === "wall" && p.solid)
    .map((p) => p.box)
    .filter((b) => b.z0 === 0 && b.z1 <= 1 && b.x1 - b.x0 <= 1 && b.y0 < ARKADY.ground && b.x1 < ARKADY.length - 1e-6);

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

  it("stands the arcade's 13 piers where the orthophoto has them, 14 spans (G-461)", () => {
    const piers = builtPiers();
    expect(piers).toHaveLength(ORTHO_PIERS.length);
    expect(ARKADY.spans).toBe(14);
    piers.forEach((b, i) => {
      expect(Math.abs((b.x0 + b.x1) / 2 - ORTHO_PIERS[i]!), `pier ${i}`).toBeLessThanOrEqual(0.3);
      expect(b.x1 - b.x0).toBeGreaterThanOrEqual(0.5);
      expect(b.x1 - b.x0).toBeLessThanOrEqual(0.6);
    });
    expect(arkadySpanMid(0)).toBeCloseTo(2.95 / 2, 2);
    expect(ARKADY.length - ORTHO_PIERS.at(-1)!).toBeCloseTo(3.35, 1);
  });

  it("keeps the restaurants' doors, the Hebi stash, its camera, neon, speaker and bag and the lookout in spans, off the piers (G-461)", () => {
    const along = (p: { x: number; z: number }) => arkadyLocal(p.x, p.z).a;
    const off = (a: number) => Math.min(...ORTHO_PIERS.map((m) => Math.abs(m - a)));
    const hebi = DEVICES.filter((d) => d.key.startsWith("dev:targ-")).map((d) => d.position);
    expect(hebi).toHaveLength(3);
    const points = [...hebi, CONTRACT_ITEM_SPOTS.hebi_stash!, TARG_OVERPASS_STASH.at, HEBI_LOOKOUT_POST];
    // Clear of the pier along the face by more than half a crate.
    for (const p of points) expect(off(along(p)), `${p.x.toFixed(1)},${p.z.toFixed(1)}`).toBeGreaterThan(ARKADY.pier / 2 + 0.3);
    for (const r of ARKADY_RESTAURANTS) expect(off(arkadySpanMid(r.door)), r.id).toBeGreaterThan(1.2);
  });

  it("keeps the arcade's floor level on T2 under its paving, from its first pier to its north end", () => {
    for (let a = ARKADY_ARCADE_SPAN.a0; a <= ARKADY.length - ARKADY.pier; a += 0.5) {
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
