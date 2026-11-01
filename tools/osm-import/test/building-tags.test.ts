import { describe, expect, it } from "vitest";
import { buildingUse, landmarkName, lookOf, massing, parseLength, parseLevels, roofHeight, roofShapeOf } from "../src/building-tags.ts";
import { partTier } from "../src/building-parts.ts";
import { type Area } from "../src/features.ts";

const opts = { area: 200, shops: false, range: [3, 4] as const, look: 0 };

describe("heights from tags", () => {
  it("parses lengths and levels", () => {
    expect(parseLength("12")).toBe(12);
    expect(parseLength("12.5 m")).toBe(12.5);
    expect(parseLength("12,5")).toBe(12.5);
    expect(parseLength("40 ft")).toBeNull();
    expect(parseLength(undefined)).toBeNull();
    expect(parseLevels("3")).toBe(3);
    expect(parseLevels("3;4")).toBe(4);
    expect(parseLevels("x")).toBeNull();
  });

  it("reads a decimal comma in storeys and rounds half storeys down on every path (G-134)", () => {
    expect(parseLevels("4,5")).toBe(4.5);
    expect(parseLevels("4,5;5")).toBe(5);
    expect(massing({ building: "yes", "building:levels": "4,5" }, opts)).toMatchObject({ levels: 4, source: "levels" });
    // With a height the walls come from it, the rows of windows from the storeys: 4.5 is 4 rows, as without one.
    expect(massing({ building: "yes", height: "17", "building:levels": "4.5" }, opts)).toMatchObject({ levels: 4, source: "height" });
  });

  it("takes `height` first, including the roof", () => {
    const m = massing({ building: "yes", height: "40", historic: "city_gate" }, opts);
    expect(m).toMatchObject({ walls: 40, roof: 0, source: "height" });
    const gabled = massing({ building: "yes", height: "20", "roof:height": "5" }, opts);
    expect(gabled).toMatchObject({ walls: 15, roof: 5, source: "height" });
  });

  it("counts storeys of 3.2 m, a shop floor of 4 m", () => {
    const flats = massing({ building: "apartments", "building:levels": "3" }, opts);
    expect(flats).toMatchObject({ levels: 3, source: "levels" });
    expect(flats.walls).toBeCloseTo(9.6, 9);
    const shops = massing({ building: "apartments", "building:levels": "3" }, { ...opts, shops: true });
    expect(shops.walls).toBeCloseTo(4 + 2 * 3.2, 9);
  });

  it("builds half a storey as half, with the whole storeys' rows of windows (G-116)", () => {
    const townHall = massing({ building: "public", "building:levels": "4.5" }, opts);
    expect(townHall.walls).toBeCloseTo(14.4, 9);
    expect(townHall.levels).toBe(4);
    const shop = massing({ building: "retail", "building:levels": "3.5" }, { ...opts, shops: true });
    expect(shop.walls).toBeCloseTo(4 + 2.5 * 3.2, 9);
    expect(shop.levels).toBe(3);
    expect(massing({ building: "yes", "building:levels": "0.5" }, opts)).toMatchObject({ walls: 3.2, levels: 1 });
  });

  it("falls back on the district's floors, picked by the look", () => {
    expect(massing({ building: "yes" }, { ...opts, look: 0 }).levels).toBe(3);
    expect(massing({ building: "yes" }, { ...opts, look: 1 }).levels).toBe(4);
    expect(massing({ building: "yes" }, { ...opts, range: [3, 3], look: 7 }).levels).toBe(3);
    expect(massing({ building: "garage" }, opts).levels).toBe(1);
    expect(massing({ building: "yes" }, { ...opts, area: 12 }).levels).toBe(1);
    expect(massing({ building: "yes" }, opts).source).toBe("default");
  });

  it("gives churches a nave and towers their height", () => {
    const church = massing({ building: "church" }, opts);
    expect(church.walls).toBe(16);
    expect(church.roof).toBeGreaterThanOrEqual(4);
    expect(massing({ building: "church", "tower:type": "bell_tower" }, opts).walls).toBe(30);
  });

  it("keeps shelters and carports to one low storey without flats (G-017)", () => {
    // The bus shelters on Aleja Tysiąclecia (w672635874: 14 m x 2 m, about 28 m²).
    const stop = { amenity: "shelter", building: "yes", shelter_type: "public_transport" };
    for (const tags of [stop, { building: "shelter" }, { building: "carport" }]) {
      expect(buildingUse(tags)).toBe("garage");
      const m = massing(tags, { ...opts, area: 28, look: 1 });
      expect(m).toMatchObject({ levels: 1, roof: 0, source: "default" });
      expect(m.walls).toBeLessThanOrEqual(3.5);
    }
    expect(massing(stop, { ...opts, area: 28, shops: true }).walls).toBeLessThanOrEqual(3.5);
  });

  it("raises roofs by shape", () => {
    expect(roofHeight({ "roof:shape": "flat" }, "residential", 10)).toBe(0);
    expect(roofHeight({ "roof:shape": "gabled" }, "residential", 10)).toBe(3);
    expect(roofHeight({ "roof:shape": "dome" }, "historic", 10)).toBe(4);
    expect(roofHeight({ "roof:levels": "1" }, "residential", 10)).toBe(3.2);
    expect(roofHeight({}, "residential", 10)).toBe(0);
  });
});

describe("roof shapes from tags (ADR-0064)", () => {
  it("reads roof:shape and roof:orientation into the game's shapes", () => {
    expect(roofShapeOf({ "roof:shape": "gabled" })).toEqual({ shape: "gabled" });
    expect(roofShapeOf({ "roof:shape": "gabled", "roof:orientation": "across" })).toEqual({ shape: "gabled", across: true });
    expect(roofShapeOf({ "roof:shape": "gabled", "roof:orientation": "along" })).toEqual({ shape: "gabled" });
    for (const s of ["half-hipped", "mansard", "hipped", "pyramidal", "dome", "onion", "flat", "skillion"] as const) expect(roofShapeOf({ "roof:shape": s }).shape).toBe(s);
    expect(roofShapeOf({ "roof:shape": "lean_to" }).shape).toBe("skillion");
    expect(roofShapeOf({ "roof:shape": "gambrel" }).shape).toBe("mansard");
    expect(roofShapeOf({ "roof:shape": "cone" }).shape).toBe("pyramidal");
  });

  it("leaves untagged and unknown shapes to the renderer, as before", () => {
    expect(roofShapeOf({})).toEqual({});
    expect(roofShapeOf({ "roof:shape": "crosspitched" })).toEqual({});
    // An orientation alone says nothing without a shape.
    expect(roofShapeOf({ "roof:orientation": "across" })).toEqual({});
  });

  it("carries the shape in the massing without changing the heights", () => {
    const tags = { building: "apartments", "building:levels": "3", "roof:shape": "mansard" };
    const m = massing(tags, opts);
    expect(m).toMatchObject({ shape: "mansard", levels: 3 });
    expect(m.roof).toBe(roofHeight(tags, "residential", Math.sqrt(opts.area)));
    expect(massing({ building: "apartments", "building:levels": "3" }, opts).shape).toBeUndefined();
  });
});

describe("use, names and looks", () => {
  it("reads the use from tags", () => {
    expect(buildingUse({ building: "church" })).toBe("church");
    expect(buildingUse({ building: "yes", amenity: "place_of_worship" })).toBe("church");
    expect(buildingUse({ building: "castle" })).toBe("historic");
    // The cloister by the church is no church: no towers of its own (G-067).
    expect(buildingUse({ building: "monastery" })).toBe("historic");
    expect(buildingUse({ building: "convent" })).toBe("historic");
    expect(buildingUse({ building: "yes", historic: "city_gate" })).toBe("historic");
    expect(buildingUse({ building: "government" })).toBe("civic");
    expect(buildingUse({ building: "retail" })).toBe("commercial");
    expect(buildingUse({ building: "warehouse" })).toBe("industrial");
    expect(buildingUse({ building: "garages" })).toBe("garage");
    expect(buildingUse({ building: "apartments" })).toBe("residential");
    expect(buildingUse({ building: "yes" })).toBe("residential");
    expect(buildingUse({ building: "yes", historic: "yes" })).toBe("historic");
    expect(buildingUse({ building: "bunker" })).toBe("other");
  });

  it("makes an office of government a public building with its name, not a block of flats (G-120)", () => {
    const townHall = { building: "yes", office: "government", name: "Urząd Miasta Lublin" };
    expect(buildingUse(townHall)).toBe("civic");
    expect(landmarkName(townHall, buildingUse(townHall))).toBe("Urząd Miasta Lublin");
    expect(buildingUse({ building: "yes", government: "education", name: "Kuratorium Oświaty" })).toBe("civic");
    expect(buildingUse({ building: "yes", office: "company" })).toBe("residential");
  });

  it("names landmarks, not blocks of flats", () => {
    expect(landmarkName({ name: "Trybunał Koronny" }, "civic")).toBe("Trybunał Koronny");
    expect(landmarkName({ name: "Kamienica X" }, "residential")).toBeUndefined();
    expect(landmarkName({ name: "Kamienica Y", historic: "building" }, "residential")).toBe("Kamienica Y");
  });

  it("hashes the id into a stable look", () => {
    expect(lookOf("w66286371")).toBe(lookOf("w66286371"));
    expect(lookOf("w66286371")).not.toBe(lookOf("w66286372"));
    expect(lookOf("")).toBe(0x811c9dc5);
  });
});

describe("a part's storeys (G-134)", () => {
  it("rounds half storeys down with a height too, as the building itself does", () => {
    const part: Area = { id: "w1", osmId: 1, tags: { "building:part": "yes", height: "15", "building:levels": "4.5" }, ring: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }], holes: 0 };
    expect(partTier(part, "residential")!.levels).toBe(4);
  });
});
