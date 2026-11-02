import { describe, expect, it } from "vitest";
import { LUBLIN_CHUNKS, type LublinBuildingData, buildingView } from "@seki/sim/lublin";
import { facadeFrame } from "../src/renderer/mapcity/facade-frame";
import { WINDOW_STYLE, facadeStyle } from "../src/renderer/mapcity/facade-style";
import { type BuildingSource, mapBuilding } from "../src/renderer/mapcity/map-building";
import { cleanRing } from "../src/renderer/mapcity/polygon";

/**
 * Towers of the map standing as buildings of their own (G-232): St Nicholas's belfry and St
 * Josaphat's tower are short and slender, under the 20 m a tower must reach to be told by its
 * shape, so they were drawn as tenements: rows of lit flats' windows. Tagged a tower in the map,
 * each gets a tower's facade whatever its size; the Trinity Tower keeps the one it had.
 */

const all = LUBLIN_CHUNKS.flatMap((c) => c.buildings);
const byId = (id: string): LublinBuildingData => {
  const b = all.find((o) => o.id === id);
  if (!b) throw new Error(`no ${id}`);
  return b;
};

/** A building of the generated centre as the renderer gets it (ADR-0044). */
const sourceOf = (b: LublinBuildingData): BuildingSource => {
  const view = buildingView(b);
  if (view.kind !== "building") throw new Error("not a building");
  return { ring: cleanRing(view.outline.map((p) => ({ x: p.x + b.x, z: p.z + b.z }))), view, at: { x: b.x, y: b.y, z: b.z } };
};

const lifted = all.filter((b) => b.soffit !== undefined).map(sourceOf);

/** The frame of a building of the generated centre as the map city frames it, with the parts lifted onto it. */
const frameOf = (id: string) => facadeFrame(mapBuilding(1, sourceOf(byId(id)), () => null, lifted), () => null);

const DWELLING: ReadonlySet<number> = new Set([WINDOW_STYLE.tenement, WINDOW_STYLE.modern, WINDOW_STYLE.block]);

describe("a tower of the map (G-232)", () => {
  it("gets a tower's facade whatever its size: no flats' windows, no shops, no signs", () => {
    for (let look = 0; look < 20; look++) {
      const s = facadeStyle({ use: "historic", levels: 1, height: 6, look, area: 15, width: 2.2, tower: true });
      expect(s.freeTower).toBe(true);
      expect(s.window).toBe(WINDOW_STYLE.civic);
      expect(s.shopfront).toBe(false);
      expect(s.signs).toBe(0);
      expect(facadeStyle({ use: "historic", levels: 1, height: 6, look, area: 15, width: 2.2 }).freeTower, "untagged, as it was").toBe(false);
    }
  });

  it("St Nicholas's belfry, St Josaphat's tower and the defensive towers have no flats' windows", () => {
    for (const id of ["w680377807", "w1382552285", "w66286376", "w450180469"]) {
      const f = frameOf(id);
      expect(f.style.freeTower, id).toBe(true);
      expect(DWELLING.has(f.style.window), id).toBe(false);
      expect(f.style.shopfront, id).toBe(false);
    }
  });

  it("the belfries have a tented roof, the keep its flat top, the Trinity Tower its parts", () => {
    for (const id of ["w680377807", "w1382552285"]) {
      expect(frameOf(id).style.roof, id).toBe("pyramid");
      expect(byId(id).roof ?? 0, id).toBeGreaterThan(0.3);
    }
    expect(frameOf("w450180469").style.roof, "the keep's crown is flat in the map").toBe("flat");
    const trinity = frameOf("w66286371");
    expect(trinity.b.carriesParts).toBe(true);
    expect(trinity.style.roof, "its helmet and lantern are its parts").toBe("flat");
    expect(trinity.style.window).toBe(WINDOW_STYLE.civic);
  });
});
