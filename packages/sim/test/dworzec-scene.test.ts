import { describe, expect, it } from "vitest";
import { DWORZEC_DETAIL, KIKU_SPOT, KIKU_TABLE, METRO_STATIONS, WORLD_SCENERY, inBuilding } from "../src";
import { ENCOUNTERS } from "../src/content/encounters";

/*
 * The bus station after its card (`docs/lokacje/dworzec-autobusowy.md`, ADR-0102 point 5): Kiku's table at her
 * encounter, out of the houses and of the metro pavilion B.
 */
describe("the bus station's scene (ADR-0102 point 5)", () => {
  it("stands Kiku's table at her encounter, before her, out of the pavilion", () => {
    const fortune = ENCOUNTERS.find((e) => e.id === "targ_fortune")!;
    expect(fortune.at).toEqual(KIKU_SPOT);
    const table = DWORZEC_DETAIL[0]!;
    expect(Math.hypot(table.x - KIKU_TABLE.x, table.z - KIKU_TABLE.z)).toBeLessThan(1e-9);
    expect(Math.hypot(table.x - fortune.at.x, table.z - fortune.at.z)).toBeLessThan(fortune.radius);
    expect(inBuilding(table.x, table.z)).toBe(false);
    const pavilion = METRO_STATIONS.flatMap((s) => s.entrances).find((e) => e.name === "Dworzec Autobusowy")!.roof;
    expect(table.x + 1 < pavilion.minX || table.x - 1 > pavilion.maxX || table.z + 1 < pavilion.minZ || table.z - 1 > pavilion.maxZ).toBe(true);
    expect(WORLD_SCENERY.some((s) => s.view.kind === "street-props" && s.view.items === DWORZEC_DETAIL)).toBe(true);
  });
});
