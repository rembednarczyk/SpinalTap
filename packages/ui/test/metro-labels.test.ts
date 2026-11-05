import { describe, expect, it } from "vitest";
import { fitChart } from "../src/metro/metro-kiosk";
import { type NameItem, liftDistricts, placeNames } from "../src/metro/metro-labels";
import { METRO_LAYER } from "./metro-fixture";

/** Where the metro layer writes its names and how the kiosk frames its map (ADR-0071). */

const station = (id: string, name: string, x: number, z: number, prefer: NameItem["prefer"] = "above"): NameItem => ({ id, name, x, z, ring: 7, size: 11, prefer });

describe("the names of the metro layer", () => {
  it("writes the platform under its ring and the destination over its own when they are close", () => {
    // Plac Litewski and Brama Krakowska 330 m apart at 7 m a pixel: 47 px.
    const places = placeNames([station("kanal", "Brama Krakowska", 490, -76, "below"), station("shinsekai", "Plac Litewski", 158, -58)], 7);
    expect(places.get("kanal")).toBe("below");
    expect(places.get("shinsekai")).toBe("above");
  });

  it("drops the names that would run into the ones placed first, far out", () => {
    const items = [station("a", "Brama Krakowska", 490, -76), station("b", "Plac Litewski", 158, -58), station("c", "Plac Zamkowy", 717, 297)];
    // At 20 m a pixel the first name, about 2 km wide, covers Plac Litewski's places: it gives way.
    const far = placeNames(items, 20);
    expect(far.get("a")).not.toBeNull();
    expect(far.get("b")).toBeNull();
    const near = placeNames(items, 1);
    expect([...near.values()].every((p) => p !== null)).toBe(true);
  });

  it("keeps a name off another station's ring", () => {
    // B's name over its ring would cover A's ring 20 m to the north: it goes under.
    const places = placeNames([station("a", "A", 0, 20, null), station("b", "Long name here", 0, 0)], 1);
    expect(places.get("a")).toBeNull();
    expect(places.get("b")).toBe("below");
  });

  it("moves a district's name off a station on the map tab", () => {
    const labels = [
      { kind: "district", text: "Krakowskie Przedmieście", x: 130, z: -55, angle: 0 },
      { kind: "street", text: "Zielona", x: 150, z: -60, angle: 0 },
      { kind: "district", text: "Nabrzeże Bystrzycy", x: 2500, z: 270, angle: 0 },
    ];
    const out = liftDistricts(labels, METRO_LAYER.stations, 1, 13);
    expect(out[0]!.z).toBeGreaterThan(-58 + 21 + 6);
    expect(out[1]).toBe(labels[1]);
    expect(out[2]).toBe(labels[2]);
  });
});

describe("the kiosk's map", () => {
  const inside = (box: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number) => x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ;

  it("frames the line in the chart's proportions with room for the names at both ends", () => {
    for (const [w, h] of [
      [530, 330],
      [748, 220],
    ] as const) {
      const { box, k } = fitChart(METRO_LAYER, w, h);
      expect((box.maxX - box.minX) / (box.maxZ - box.minZ)).toBeCloseTo(w / h, 5);
      expect(k).toBeCloseTo((box.maxX - box.minX) / w, 5);
      // "Nabrzeże Bystrzycy" centred on its ring, 11 px letters: it fits on the east side.
      const half = ("Nabrzeże Bystrzycy".length * 0.66 * 11 * k) / 2;
      expect(box.maxX).toBeGreaterThanOrEqual(2527 + half);
      expect(inside(box, -810, 180)).toBe(true);
      // Lublin Główny, far south, is pinned to the edge instead of shrinking the line.
      expect(inside(box, 590, -1840)).toBe(false);
    }
  });

  it("keeps the stations of a phone's chart at least 40 px apart", () => {
    const { k } = fitChart(METRO_LAYER, 748, 220);
    expect(Math.hypot(490 - 158, -76 + 58) / k).toBeGreaterThan(40);
  });
});
