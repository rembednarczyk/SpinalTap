import { describe, expect, it } from "vitest";
import type { BuildingUse } from "@seki/core";
import { LUBLIN_CHUNKS, type LublinBuildingData, buildingView } from "@seki/sim/lublin";
import { DAY_RIG } from "../src/npr/lighting";
import { facadeFrame } from "../src/renderer/mapcity/facade-frame";
import { facadeStyle } from "../src/renderer/mapcity/facade-style";
import { type BuildingSource, mapBuilding } from "../src/renderer/mapcity/map-building";
import { cleanRing } from "../src/renderer/mapcity/polygon";

/**
 * White facades burn out in the sun (G-742): at 12:00 a cream or pale grey wall facing the sun
 * came out pure white, 3-3.5% of the bottom half of the frame on the pavements by Plac Litewski.
 * The toon shader lights a wall turned to the sun with the day's ambient plus its sun (about
 * 1.27 red, 1.32 green); grading then takes the frame (exposure 1.08 in linear light, contrast
 * 1.18, `Grading`). A pixel is burnt when red and green both reach 250 (`tools/shots/metrics.ts`).
 */

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const SUN = rgb(DAY_RIG.sunColor).map((s, i) => s + (rgb(DAY_RIG.ambient)[i] as number));

/** One channel of the frame buffer (clipped at 1) through `Grading`'s exposure and contrast, 0-255. */
const graded = (x: number): number => {
  const e = Math.min(1, Math.min(1, x) * 1.08 ** (1 / 2.2));
  return 255 * (e + 0.18 * (e * e * (3 - 2 * e) - e));
};

/** A wall of this colour turned full to the day sun is burnt on screen. */
const burns = (hex: string): boolean => {
  const c = rgb(hex);
  return graded((c[0] as number) * (SUN[0] as number)) >= 250 && graded((c[1] as number) * (SUN[1] as number)) >= 250;
};

const USES: readonly BuildingUse[] = ["residential", "commercial", "civic", "church", "historic", "industrial", "garage", "other"];
const all = LUBLIN_CHUNKS.flatMap((c) => c.buildings);
const sourceOf = (b: LublinBuildingData): BuildingSource | null => {
  const view = buildingView(b);
  if (view.kind !== "building") return null;
  return { ring: cleanRing(view.outline.map((p) => ({ x: p.x + b.x, z: p.z + b.z }))), view, at: { x: b.x, y: b.y, z: b.z } };
};

describe("facades in the day sun (G-742)", () => {
  it("no wall or trim of the city burns out white where the sun falls on it", () => {
    const sources = all.map(sourceOf).filter((s): s is BuildingSource => s !== null);
    const lifted = all.filter((b) => b.soffit !== undefined).map(sourceOf).filter((s): s is BuildingSource => s !== null);
    const burnt: string[] = [];
    for (const s of sources) {
      const { style } = facadeFrame(mapBuilding(1, s, () => null, lifted), () => null);
      if (burns(style.plaster) || burns(style.trim)) burnt.push(`${style.plaster}/${style.trim}`);
    }
    expect(sources.length).toBeGreaterThan(500);
    expect(burnt.length, `burnt walls or trims of ${sources.length} buildings: ${[...new Set(burnt)].join(" ")}`).toBe(0);
  });

  it("no use's plaster or a colour of the map burns, whatever the look", () => {
    const burnt = new Set<string>();
    for (const use of USES) {
      for (const colour of [undefined, "#ffffff", "#f5f5dc", "#d3d3d3", "#ffff00"]) {
        for (let look = 0; look < 64; look++) {
          const s = facadeStyle({ use, levels: 4, height: 15, look, area: 300, width: 12, ...(colour ? { colour } : {}) });
          for (const c of [s.plaster, s.trim]) if (burns(c)) burnt.add(`${use} ${colour ?? "-"}: ${c}`);
        }
      }
    }
    expect([...burnt]).toEqual([]);
  });

  it("the sun still lights them: a white wall in the sun stays near white, not grey", () => {
    const white = facadeStyle({ use: "civic", levels: 4, height: 15, look: 0, area: 300, width: 12, colour: "#ffffff" });
    const c = rgb(white.plaster);
    expect(graded((c[1] as number) * (SUN[1] as number))).toBeGreaterThan(225);
  });
});
