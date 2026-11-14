import { describe, expect, it } from "vitest";
import type { PropsPlan } from "../src/props-gen.ts";
import { CAR_COVER, COVER, isLitWay, lampLineOf, litFillItems, litItems, osmLampItems, withLitRule, yieldToRule } from "../src/props-lit.ts";

/** A way along x at `z`, from `x0` to `x1` (the strip of Krakowskie south of z = −200 is on the map, x −200..460). */
const way = (id: number, tags: Record<string, string>, x0: number, x1: number, z: number) => ({ id, tags: { lit: "yes", ...tags }, pts: [{ x: x0, z }, { x: x1, z }] });
const along = (x0: number, x1: number, z: number) => [x0, z, x1, z];

describe("the street lamps of the lit rule (G-798, ADR-0064 stage 3)", () => {
  it("lamps a lit way no lamp of the plan stands by, by its class", () => {
    const plan: PropsPlan = { items: [] };
    const items = litItems(plan, [way(1, { highway: "residential" }, 0, 120, -240), way(2, { highway: "secondary" }, 0, 120, -100), way(3, { highway: "footway" }, 0, 60, -160), way(4, { highway: "pedestrian" }, 300, 360, -230)]);
    expect(items.map((i) => [i.id, i.kind, i.spacing, i.note?.includes("obu stronach") ?? false])).toEqual([
      ["lit.w1", "lamp-road", 30, false],
      ["lit.w2", "lamp-road", 35, true],
      ["lit.w4", "lamp-modern-pole", 25, true],
      ["lit.w3", "lamp-park", 30, false],
    ]);
    expect(items[0]!.lines).toHaveLength(1);
    expect(items[0]!.lines![0]!.slice(0, 2)).toEqual([0, -240]);
    expect(items[0]!.lines![0]!.slice(-2)).toEqual([120, -240]);
  });

  it("leaves the ways OSM does not light, the crossings, the ways being built and those off the map", () => {
    expect(isLitWay({ highway: "residential", lit: "no" })).toBe(false);
    expect(isLitWay({ highway: "construction", lit: "yes" })).toBe(false);
    expect(isLitWay({ highway: "footway", lit: "yes", tunnel: "yes" })).toBe(false);
    expect(isLitWay({ highway: "footway", lit: "yes", covered: "yes" })).toBe(false);
    expect(lampLineOf({ highway: "footway", footway: "crossing" })).toBeNull();
    expect(lampLineOf({ highway: "pedestrian", area: "yes" })?.kind).toBe("lamp-park");
    const ways = [way(1, { highway: "residential", lit: "no" }, 0, 120, -240), way(2, { highway: "footway", footway: "crossing" }, 0, 60, -240), way(3, { highway: "residential" }, 0, 120, -900)];
    expect(litItems({ items: [] }, ways)).toEqual([]);
  });

  it("lamps only the stretch of a way further than COVER from the plan's lamps", () => {
    const plan: PropsPlan = { items: [{ id: "lamps.park", kind: "lamp-park", spacing: 30, lines: [along(0, 100, -240)] }] };
    // A path beside the plan's line, within COVER of it, and one past it, 100 m on.
    const items = litItems(plan, [way(1, { highway: "footway" }, 0, 100, -240 + COVER - 2), way(2, { highway: "footway" }, 0, 200, -240)]);
    expect(items.map((i) => i.id)).toEqual(["lit.w2"]);
    const line = items[0]!.lines![0]!;
    expect(line[0]).toBeGreaterThanOrEqual(100 + COVER - 2.5);
    expect(line[line.length - 2]).toBe(200);
  });

  it("lights both carriageways of a dual street, each from its own axis", () => {
    const items = litItems({ items: [] }, [way(1, { highway: "secondary" }, 0, 120, -240), way(2, { highway: "secondary" }, 0, 120, -240 + CAR_COVER + 6)]);
    expect(items.map((i) => i.id)).toEqual(["lit.w1", "lit.w2"]);
  });

  it("gives the plan's road lamp lines on lit car streets to the rule, keeps the styled ones and those on unlit ways", () => {
    const plan: PropsPlan = {
      items: [
        { id: "lamps.side", kind: "lamp-road", spacing: 30, count: 8, lines: [along(0, 120, -240), along(0, 120, -100)] },
        { id: "lamps.deptak", kind: "lamp-pastoral", spacing: 25, lines: [along(200, 300, -240)] },
      ],
    };
    const ways = [way(1, { highway: "residential" }, -5, 125, -240), way(2, { highway: "residential", lit: "no" }, 0, 120, -100), way(3, { highway: "pedestrian" }, 200, 400, -240)];
    const given = yieldToRule(plan, ways);
    expect(given.yielded).toEqual(["lamps.side#0"]);
    expect(given.plan.items.map((i) => [i.id, i.lines, i.count])).toEqual([
      ["lamps.side", [along(0, 120, -100)], 4],
      ["lamps.deptak", [along(200, 300, -240)], undefined],
    ]);
    // The street the plan gave way on is the rule's; the deptak's way goes on in its pastorals.
    const rule = withLitRule(plan, ways, []).plan.items.filter((i) => i.id.startsWith("lit."));
    expect(rule.map((i) => [i.id, i.kind, i.spacing])).toEqual([
      ["lit.w1", "lamp-road", 30],
      ["lit.w3", "lamp-pastoral", 25],
    ]);
    expect(rule[1]!.lines![0]![0]).toBeGreaterThanOrEqual(300 + COVER - 2.5);
  });

  it("sets the Old Town's lamps as pastorals", () => {
    const items = litItems({ items: [] }, [way(1, { highway: "residential" }, 560, 640, -60)]);
    expect(items.map((i) => i.kind)).toEqual(["lamp-pastoral"]);
  });

  it("stands the OSM street lamps the plan lacks at their nodes, and lamps round them", () => {
    const plan: PropsPlan = { items: [{ id: "grodzka.street-lamp", kind: "street-lamp", points: [[0, -240]], osm: ["n1"] }] };
    const points = [
      { id: "n1", p: { x: 0, z: -240 }, tag: "highway=street_lamp", detail: "" },
      { id: "n2", p: { x: 100.04, z: -240 }, tag: "highway=street_lamp", detail: "" },
      { id: "n3", p: { x: 100, z: -900 }, tag: "highway=street_lamp", detail: "" },
      { id: "n4", p: { x: 50, z: -240 }, tag: "natural=tree", detail: "" },
    ];
    expect(osmLampItems(plan, points).map((i) => [i.id, i.kind, i.points, i.osm])).toEqual([["osm.street-lamps", "street-lamp", [[100, -240]], ["n2"]]]);
    // The street between the two lamps, 100 m apart, is dark only in its middle.
    const rule = withLitRule(plan, [way(1, { highway: "residential" }, 0, 100, -240)], points).plan.items.filter((i) => i.id.startsWith("lit."));
    expect(rule).toHaveLength(1);
    const line = rule[0]!.lines![0]!;
    expect(line[0]).toBeGreaterThan(0);
    expect(line[line.length - 2]).toBeLessThan(100);
  });

  it("grows a short dark stretch to a spacing, so it gets a lamp", () => {
    const plan: PropsPlan = { items: [{ id: "lamps.park", kind: "lamp-park", spacing: 30, lines: [along(0, 100, -240), along(130, 230, -240)] }] };
    // Dark only round x = 115, 15 m from both lines: less than half a spacing.
    const items = litItems(plan, [way(1, { highway: "footway" }, 0, 230, -240 - COVER - 1)]);
    const line = items[0]!.lines![0]!;
    expect(line[line.length - 2]! - line[0]!).toBeGreaterThanOrEqual(30);
  });

  it("lamps in its second pass what the placed lamps left dark", () => {
    const plan: PropsPlan = { items: [] };
    const ways = [way(1, { highway: "residential" }, 0, 120, -240)];
    expect(litFillItems(plan, ways, [{ x: 15, z: -240 }, { x: 45, z: -240 }, { x: 75, z: -240 }, { x: 105, z: -240 }])).toEqual([]);
    const fill = litFillItems(plan, ways, [{ x: 15, z: -240 }]);
    expect(fill.map((i) => [i.id, i.kind])).toEqual([["lit.w1.fill", "lamp-road"]]);
    expect(fill[0]!.lines![0]![0]).toBeGreaterThan(15 + 20);
  });
});
