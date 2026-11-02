import { describe, expect, it } from "vitest";
import { type StreetPropItem, doorLayout } from "../../../packages/core/src";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { type DoorContext, type DoorWall, type Entrance, type PlacedDoor, type WallSlot, entranceModel, placeDoors } from "../src/props-doors.ts";
import type { OsmData, Tags } from "../src/osm.ts";
import { undergroundWays } from "../src/props-roads.ts";
import { Site } from "../src/props-site.ts";

/**
 * The rules of the doors on the facades (ADR-0058 stage 9) on a small map of their own: a house at
 * x 0..20, z 0..10 whose north wall (z 10, facing +z) has a slot between the panes every 2 m
 * (x 2..18) and one over a pane at x 11, a pavement in front of it (z 10..30) and a street along
 * z 20. Each rule moves a door to another slot or leaves none.
 */

type Extra = Partial<Pick<LublinChunkData, "streets" | "ground" | "passages" | "buildings">>;

const PAVEMENT = { surface: "sidewalk", outline: [-30, 10, 50, 10, 50, 30, -30, 30] } as const;
const STREET = { name: "S", kind: "residential", line: [-30, 20, 50, 20] } as const;

const chunk = (extra: Extra = {}): LublinChunkData =>
  ({
    id: "t-0-0",
    district: "targ",
    bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 },
    buildings: [{ id: "w1", x: 10, z: 5, outline: [-10, -5, 10, -5, 10, 5, -10, 5] }, ...(extra.buildings ?? [])],
    streets: extra.streets ?? [STREET],
    markings: [],
    pois: [],
    terrain: { originX: -100, originZ: -100, cell: 200, cols: 2, rows: 2, heights: [0, 0, 0, 0] },
    ...(extra.passages ? { passages: extra.passages } : {}),
    ground: [PAVEMENT, ...(extra.ground ?? [])],
  }) as unknown as LublinChunkData;

/** Slots from x 18 down to x 2 every 2 m (u 2..18 from the wall's east end), and one over a pane at u 9 (x 11). */
const SLOTS: WallSlot[] = [...[2, 4, 6, 8, 10, 12, 14, 16, 18].map((u) => ({ u, width: 1.2, top: 2.3, max: 2.4, cover: false })), { u: 9, width: 1.4, top: 3.0, max: 3.2, cover: true }];

const wall = (over: Partial<DoorWall> = {}): DoorWall => ({
  building: "10.0,5.0",
  use: "commercial",
  a: { x: 20, z: 10 },
  b: { x: 0, z: 10 },
  nx: 0,
  nz: 1,
  length: 20,
  base: 0,
  slots: SLOTS,
  boards: [],
  ...over,
});

const entrance = (x: number, over: Partial<Entrance> = {}): Entrance => ({ id: "1", p: { x, z: 10.2 }, entrance: "yes", door: "", level: "", ...over });

const doors = (walls: DoorWall[], entrances: Entrance[] = [], ctx: DoorContext = {}, extra: Extra = {}): PlacedDoor[] => placeDoors(new Site([chunk(extra)]), walls, entrances, ctx);
const xs = (list: PlacedDoor[]) => list.map((d) => d.item.x);

describe("the doors on the facades (ADR-0058 stage 9)", () => {
  it("an entrance of the map gets a door on its wall, in the slot nearest it, facing out", () => {
    const [d] = doors([wall()], [entrance(13.4)]);
    expect(d!.rule).toBe("entrance");
    expect(d!.item).toMatchObject({ prop: "door", x: 14, z: 10, yaw: 0 });
    expect(doorLayout(d!.item.variant)).toEqual({ model: "steel", width: 1.2, height: 2.3 });
  });

  it("only within 1.5 m of the wall and 1.5 m of a slot along it, and not a cellar's", () => {
    expect(doors([wall()], [{ ...entrance(14), p: { x: 14, z: 11.8 } }])).toEqual([]);
    expect(doors([wall({ slots: SLOTS.filter((s) => s.u <= 2) })], [entrance(14)])).toEqual([]);
    expect(doors([wall()], [entrance(14, { level: "-1" })])).toEqual([]);
  });

  it("the model by the tags and the slot", () => {
    const pier = SLOTS[0]!;
    expect(entranceModel({ entrance: "main", door: "" }, pier, false)).toBe("steel-double");
    expect(entranceModel({ entrance: "service", door: "" }, { ...pier, width: 1.8 }, false)).toBe("shutter");
    expect(entranceModel({ entrance: "garage", door: "" }, pier, false)).toBe("steel");
    expect(entranceModel({ entrance: "yes", door: "sliding" }, pier, false)).toBe("shop");
    expect(entranceModel({ entrance: "yes", door: "" }, SLOTS[9]!, true)).toBe("shop");
    expect(entranceModel({ entrance: "yes", door: "" }, SLOTS[9]!, false)).toBe("tall");
  });

  it("a venue's board without a door gets a shop's door under it; a bank's a door on a code", () => {
    const [d] = doors([wall({ boards: [{ u0: 5, u1: 9.5, kind: "shop" }] })]);
    expect(d!.rule).toBe("venue");
    // Nearest the board's middle (u 7.25) within its span: the slot at u 8 (x 12).
    expect(d!.item.x).toBe(12);
    expect(doorLayout(d!.item.variant).model).toBe("shop");
    const [bank] = doors([wall({ boards: [{ u0: 5, u1: 9.5, kind: "bank" }] })]);
    expect(doorLayout(bank!.item.variant).model).toBe("code");
  });

  it("only in a slot under the board's span: none under a board between two slots", () => {
    expect(doors([wall({ boards: [{ u0: 4.5, u1: 5.5, kind: "shop" }] })])).toEqual([]);
  });

  it("a board over an entrance's door takes no second door", () => {
    const list = doors([wall({ boards: [{ u0: 5, u1: 9.5, kind: "shop" }] })], [entrance(13.9)]);
    expect(list.map((d) => d.rule)).toEqual(["entrance"]);
  });

  it("a tenement without a door gets its staircase's door on its wall facing a street, nearest the middle", () => {
    const [d] = doors([wall({ use: "residential" })]);
    expect(d!.rule).toBe("staircase");
    expect(d!.item.x).toBe(10);
    // Not without a street in front, nor on a building of another use.
    expect(doors([wall({ use: "residential" })], [], {}, { streets: [] })).toEqual([]);
    expect(doors([wall({ use: "commercial" })])).toEqual([]);
    // Not when it has a door already.
    expect(xs(doors([wall({ use: "historic" })], [entrance(3.9)]))).toEqual([4]);
  });

  it("a way under ground in front of a tenement is no street: no staircase's door facing only it (G-197)", () => {
    // The street along z 20 is a tunnel (Trasa Podziemna: `tunnel=yes`, `layer=-1`, a footway in the chunks).
    const under = { underground: [[{ x: -30, z: 20 }, { x: 10, z: 20 }, { x: 50, z: 20 }]] };
    expect(doors([wall({ use: "residential" })], [], under)).toEqual([]);
    // A tunnel crossing under the street, or beside it, leaves the street a street.
    const across = { underground: [[{ x: 10, z: 30 }, { x: 10, z: 0 }]] };
    expect(xs(doors([wall({ use: "residential" })], [], across))).toEqual([10]);
    const beside = { underground: [[{ x: -30, z: 23 }, { x: 50, z: 23 }]] };
    expect(xs(doors([wall({ use: "residential" })], [], beside))).toEqual([10]);
    // Only the staircases' rule looks at the street: an entrance and a board keep their doors.
    expect(xs(doors([wall({ use: "residential" })], [entrance(13.4)], under))).toEqual([14]);
    expect(doors([wall({ boards: [{ u0: 5, u1: 9.5, kind: "shop" }] })], [], under)).toHaveLength(1);
  });

  it("the ways under ground of the map data: a tunnel or a negative layer, not a gateway's passage", () => {
    const ways: { id: number; tags: Tags }[] = [
      { id: 10, tags: { highway: "footway", name: "Trasa Podziemna", tunnel: "yes", layer: "-1" } },
      { id: 11, tags: { highway: "path", layer: "-1" } },
      { id: 12, tags: { highway: "pedestrian", name: "Bramowa", tunnel: "building_passage" } },
      { id: 13, tags: { highway: "residential", name: "Złota" } },
      { id: 14, tags: { highway: "service", tunnel: "yes" } },
    ];
    const osm: OsmData = {
      nodes: new Map([1, 2, 3].map((id) => [id, { id, lat: 51.248 + id * 1e-4, lon: 22.568 }])),
      ways: new Map(ways.map((w) => [w.id, { ...w, nodes: [1, 2, 3] }])),
      relations: new Map(),
    };
    expect(undergroundWays(osm)).toHaveLength(3);
  });

  // A long board over the wall's middle: its door goes to the slot nearest u 10 (x 10) the rules let it.
  const shop = () => wall({ boards: [{ u0: 3, u1: 17, kind: "shop" }] });

  it("keeps 3 m from the game's doors", () => {
    expect(doors([shop()])[0]!.item.x).toBe(10);
    const game = { a: { x: 9.5, z: 10 }, b: { x: 10.5, z: 10 } };
    const [d] = doors([shop()], [], { gameDoors: [game] });
    expect(d!.item.x).toBe(14);
  });

  it("keeps 3 m from a passage's axis", () => {
    const passages = [{ building: "w1", from: { x: 10, z: 10 }, to: { x: 10, z: 0 }, width: 3, height: 3, rise: 0 }];
    const [d] = doors([shop()], [], {}, { passages } as Extra);
    expect(Math.abs(d!.item.x - 10)).toBeGreaterThanOrEqual(3);
  });

  it("needs open ground in front: none with a building standing out before the wall", () => {
    const shed = { id: "w2", x: 10, z: 11, outline: [-3, -0.8, 3, -0.8, 3, 0.8, -3, 0.8] };
    const [d] = doors([shop()], [], {}, { buildings: [shed] } as unknown as Extra);
    expect(Math.abs(d!.item.x - 10)).toBeGreaterThan(3);
  });

  it("needs the paving within 0.8 m of the ground floor and level across the door", () => {
    expect(doors([shop()], [], { surfaceY: () => -0.9 })).toEqual([]);
    expect(doors([shop()], [], { surfaceY: () => -0.7 })).toHaveLength(1);
    // A fall of 0.2 m across a door east of x 7: the door goes to x 6, on the flat.
    const [d] = doors([shop()], [], { surfaceY: (p) => (p.x > 7 ? (p.x - 7) * 0.17 : 0) });
    expect(d!.item.x).toBe(6);
  });

  it("no door under 2 m: paving 0.5 m over the ground floor leaves a pier's door 1.8 m", () => {
    expect(doors([wall()], [entrance(14)], { surfaceY: () => 0.5 })).toEqual([]);
    expect(doors([wall()], [entrance(14)], { surfaceY: () => 0.25 })).toHaveLength(1);
  });

  it("stands on the paving: its foot at the surface's height, its top where the slot puts it", () => {
    const [d] = doors([wall()], [entrance(14)], { surfaceY: () => -0.3 });
    expect(d!.item.y).toBe(-0.3);
    expect(doorLayout(d!.item.variant).height).toBe(2.6);
  });

  it("keeps the furniture's solids out of the ground in front of it", () => {
    const bench: StreetPropItem = { prop: "bench", x: 10, y: 0, z: 10.6, yaw: 0, variant: 0 };
    const [d] = doors([shop()], [], { furniture: [bench] });
    expect(Math.abs(d!.item.x - 10)).toBeGreaterThanOrEqual(2);
  });

  it("keeps 0.6 m between two doors: a second entrance beside a door moves to the next slot", () => {
    expect(xs(doors([wall()], [entrance(14), entrance(14.5, { id: "2" })]))).toEqual([14, 16]);
  });

  it("a door rounded up to the variant's height must stay under the slot's highest top", () => {
    const tight = SLOTS.map((s) => ({ ...s, max: s.top }));
    // Paving 1 cm down: 2.31 m rounds up to 2.32 m, over the slot's 2.3 m.
    expect(doors([wall({ slots: tight })], [entrance(14)], { surfaceY: () => -0.01 })).toEqual([]);
    expect(doors([wall({ slots: tight })], [entrance(14)], { surfaceY: () => 0 })).toHaveLength(1);
  });
});
