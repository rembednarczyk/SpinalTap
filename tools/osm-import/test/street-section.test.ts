import { describe, expect, it } from "vitest";
import { type Line } from "../src/features.ts";
import { lineBands } from "../src/ground.ts";
import { type StreetSection, carriagewaySource, laidStrips, reportLine, roadSection, streetWidths, widthReport } from "../src/street-section.ts";
import { generatedCity } from "./city.ts";

const axis = [
  { x: 0, z: 0 },
  { x: 40, z: 0 },
];
const way = (tags: Line["tags"], id = "w1"): Line => ({ id, osmId: 1, tags, line: axis });

describe("a street's cross section (ADR-0080 PR 5)", () => {
  it("is half the carriageway each side of the axis and a sidewalk past it on each side the tags give", () => {
    const s = roadSection(way({ highway: "primary", sidewalk: "left", lanes: "2" }), false, "default")!;
    expect(s.stations).toEqual([
      {
        from: 0,
        to: 40,
        left: [
          { kind: "carriageway", width: 3.25, source: "default" },
          { kind: "sidewalk", width: 3, source: "default" },
        ],
        right: [{ kind: "carriageway", width: 3.25, source: "default" }],
      },
    ]);
    expect(laidStrips(s)).toEqual([
      { kind: "carriageway", from: -3.25, width: 6.5 },
      { kind: "sidewalk", from: 3.25, width: 3 },
    ]);
  });

  it("takes `sidewalk:width` from the map, and keeps a bridge's deck", () => {
    const s = roadSection(way({ highway: "residential", sidewalk: "both", "sidewalk:width": "2", bridge: "yes" }), false)!;
    expect(s.deck).toEqual([axis[0], axis[1]]);
    expect(laidStrips(s)).toEqual([
      { kind: "carriageway", from: -3.25, width: 6.5 },
      { kind: "sidewalk", from: 3.25, width: 2 },
      { kind: "sidewalk", from: -5.25, width: 2 },
    ]);
    expect(s.stations[0]!.right[1]!.source).toBe("osm");
  });

  it("is none for a way that is not a road by type, nor for a road mapped as an area", () => {
    expect(roadSection(way({ highway: "footway" }), false)).toBeNull();
    expect(roadSection(way({ highway: "residential", area: "yes" }), false)).toBeNull();
  });

  it("lays the bands a street had before it: the carriageway and its sidewalks at the same offsets", () => {
    const bands = lineBands(way({ highway: "secondary", sidewalk: "both", width: "9" }), false);
    expect(bands.map((b) => [b.surface, b.kerb?.half, b.along?.from, b.along?.width])).toEqual([
      ["road", 4.5, undefined, undefined],
      ["sidewalk", undefined, 4.5, 3],
      ["sidewalk", undefined, -7.5, 3],
    ]);
  });

  it("says where a carriageway's width comes from: the map, a correction, the fit to the sidewalks, or the estimate", () => {
    const t = { highway: "residential" };
    expect(carriagewaySource({ ...t, width: "7" }, { ...t, width: "7" }, { ...t, width: "7" })).toEqual(["osm", "osm"]);
    expect(carriagewaySource(t, { ...t, width: "6.5" }, { ...t, width: "6.5" })).toEqual(["ortho", "ortho"]);
    expect(carriagewaySource(t, t, { ...t, "width:carriageway": "5.2" })).toEqual(["fitted", "fitted"]);
    expect(carriagewaySource({ ...t, lanes: "2" }, { ...t, lanes: "2" }, { ...t, lanes: "2" })).toEqual(["default", "default"]);
  });

  it("takes the orthophoto's sides before the fit and the estimate, and the map before both (PR 10)", () => {
    const t = { highway: "residential" };
    const measured = { ...t, "width:carriageway": "7.2" };
    expect(carriagewaySource(t, measured, measured, [true, false])).toEqual(["ortho", "default"]);
    expect(carriagewaySource(t, measured, measured, [true, true])).toEqual(["ortho", "ortho"]);
    expect(carriagewaySource({ ...t, width: "7" }, { ...t, width: "7" }, { ...t, width: "7" }, [true, true])).toEqual(["osm", "osm"]);
    const s = roadSection(way(measured), false, ["ortho", "default"])!;
    expect([s.stations[0]!.left[0], s.stations[0]!.right[0]]).toEqual([
      { kind: "carriageway", width: 3.6, source: "ortho" },
      { kind: "carriageway", width: 3.6, source: "default" },
    ]);
    const r = widthReport([s], new Map([["w1", 10]]));
    expect(r).toEqual({ osm: 0, ortho: 40, "mapped-way": 10, fitted: 0, default: 30 });
  });
});

describe("the report of the streets' width sources", () => {
  const section = (id: string, source: "default" | "fitted"): StreetSection => roadSection(way({ highway: "residential" }, id), false, source)!;

  it("counts both sides of each street and moves the widened edges from the estimate to the mapped way", () => {
    const r = widthReport([section("w1", "default"), section("w2", "fitted")], new Map([["w1", 15]]));
    expect(r).toEqual({ osm: 0, ortho: 0, "mapped-way": 15, fitted: 80, default: 65 });
    expect(reportLine(r)).toBe("osm 0.00 km (0.0%), ortho 0.00 km (0.0%), mapped-way 0.01 km (9.4%), fitted 0.08 km (50.0%), default 0.07 km (40.6%)");
  });

  it("reads the widened runs off the bands and leaves the service ways out of the streets", () => {
    const laid = [
      { piece: way({ highway: "residential" }, "w1"), mapped: false, atStreet: false, width: "default" as const },
      { piece: way({ highway: "service" }, "w2"), mapped: false, atStreet: false, width: "default" as const },
    ];
    const runs = [{ inner: [axis[0]!, { x: 10, z: 0 }] }, { inner: [axis[0]!, { x: 5, z: 0 }] }];
    const w = streetWidths(laid, () => true, [[{ source: "w1" }, { runs }]]);
    expect(w.streets).toEqual({ osm: 0, ortho: 0, "mapped-way": 15, fitted: 0, default: 65 });
    expect(w.all.default).toBe(145);
  });

  it("of the whole city: printed, every street side counted once", () => {
    const { widths } = generatedCity();
    console.log(`street sides: ${reportLine(widths.streets)}\nwith service ways: ${reportLine(widths.all)}`);
    const total = (r: typeof widths.all) => Object.values(r).reduce((n, v) => n + v, 0);
    expect(total(widths.streets)).toBeGreaterThan(0);
    expect(total(widths.all)).toBeGreaterThan(total(widths.streets));
    expect(Object.values(widths.all).every((v) => v >= 0)).toBe(true);
    // The orthophoto's widths (PR 10) halve the estimated share of PR 5 (87.3% of 37.7 km): at most 43.7%.
    expect(widths.streets.default / total(widths.streets)).toBeLessThanOrEqual(0.437);
  });
});
