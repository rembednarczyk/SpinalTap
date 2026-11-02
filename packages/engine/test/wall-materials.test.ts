import { describe, expect, it } from "vitest";
import { LUBLIN_CHUNKS, type LublinBuildingData, buildingView } from "@seki/sim/lublin";
import { facadeFrame } from "../src/renderer/mapcity/facade-frame";
import { PLASTER_SWATCHES, facadeStyle } from "../src/renderer/mapcity/facade-style";
import { type BuildingSource, mapBuilding } from "../src/renderer/mapcity/map-building";
import { cleanRing } from "../src/renderer/mapcity/polygon";

/**
 * Brick walls of the map (G-244): the Gothic keep, the Gothic bastion and the Trinity Chapel are
 * `building:material=brick` in OSM and bare brick in Lublin; they were drawn in a church's pale
 * plaster. The map's material and `building:colour` come before the palette of the building's use.
 */

const all = LUBLIN_CHUNKS.flatMap((c) => c.buildings);
const byId = (id: string): LublinBuildingData => {
  const b = all.find((o) => o.id === id);
  if (!b) throw new Error(`no ${id}`);
  return b;
};

const sourceOf = (b: LublinBuildingData): BuildingSource => {
  const view = buildingView(b);
  if (view.kind !== "building") throw new Error("not a building");
  return { ring: cleanRing(view.outline.map((p) => ({ x: p.x + b.x, z: p.z + b.z }))), view, at: { x: b.x, y: b.y, z: b.z } };
};

const lifted = all.filter((b) => b.soffit !== undefined).map(sourceOf);
const frameOf = (id: string) => facadeFrame(mapBuilding(1, sourceOf(byId(id)), () => null, lifted), () => null);

/** Hue in degrees, saturation and value of a `#rrggbb` colour. */
const hsv = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1, 7), 16);
  const [r, g, b] = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, max === 0 ? 0 : d / max, max];
};

/** Fired brick: a red to orange-brown, saturated and darker than any plaster. */
const isBrick = (hex: string): boolean => {
  const [h, s, v] = hsv(hex);
  return h <= 30 && s >= 0.45 && v >= 0.35 && v <= 0.65;
};

const PLASTERS = new Set(PLASTER_SWATCHES);

describe("brick walls of the map (G-244)", () => {
  it("a building of brick has a brick wall whatever its use and look, and no light plaster trims", () => {
    for (const use of ["church", "historic", "residential", "civic"] as const) {
      for (let look = 0; look < 40; look++) {
        const s = facadeStyle({ use, levels: 3, height: 12, look, area: 120, width: 8, material: "brick" });
        expect(isBrick(s.plaster), `${use} ${look}: ${s.plaster}`).toBe(true);
        expect(PLASTERS.has(s.plaster)).toBe(false);
        expect(hsv(s.trim)[2], "the trims are darker than the wall").toBeLessThan(hsv(s.plaster)[2]);
      }
    }
  });

  it("the rest of a building's looks stay as they were; without a material its plaster too", () => {
    for (let look = 0; look < 40; look++) {
      const base = { use: "historic", levels: 3, height: 12, look, area: 120, width: 8 } as const;
      const plain = facadeStyle(base);
      const brick = facadeStyle({ ...base, material: "brick" });
      expect({ ...brick, plaster: plain.plaster, trim: plain.trim, plinth: plain.plinth }).toEqual(plain);
      expect(facadeStyle({ ...base, material: "plaster" }), "plaster: the use's palette").toEqual(plain);
    }
  });

  it("a colour of the map picks the nearest plaster, a stone wall stays stone", () => {
    const beige = facadeStyle({ use: "residential", levels: 3, height: 12, look: 7, area: 120, width: 8, colour: "#f5f5dc" });
    expect(PLASTERS.has(beige.plaster)).toBe(true);
    expect(hsv(beige.plaster)[2], "beige is a light plaster").toBeGreaterThan(0.8);
    const green = facadeStyle({ use: "residential", levels: 3, height: 12, look: 7, area: 120, width: 8, colour: "#008000" });
    const [h, , v] = hsv(green.plaster);
    expect(h > 90 && h < 150 && v > 0.6, `green is a mint plaster: ${green.plaster}`).toBe(true);
    const stone = facadeStyle({ use: "church", levels: 3, height: 12, look: 7, area: 120, width: 8, material: "stone" });
    expect(PLASTERS.has(stone.plaster)).toBe(false);
    expect(hsv(stone.plaster)[1], "limestone is greyish").toBeLessThan(0.2);
  });

  it("the keep, the bastion and the Trinity Chapel are brick in the city; a building the map is silent on keeps its plaster", () => {
    for (const id of ["w450180469", "w66286376", "w66258167"]) {
      expect(byId(id).material, id).toBe("brick");
      expect(isBrick(frameOf(id).style.plaster), `${id}: ${frameOf(id).style.plaster}`).toBe(true);
    }
    const silent = all.find((b) => b.material === undefined && b.colour === undefined && b.use === "residential" && b.soffit === undefined)!;
    expect(PLASTERS.has(frameOf(silent.id).style.plaster)).toBe(true);
  });
});
