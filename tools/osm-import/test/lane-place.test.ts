import { describe, expect, it } from "vitest";
import { DISTRICTS } from "../src/config.ts";
import { withoutReplaced } from "../src/corrections-alchemia.ts";
import { correctedLine } from "../src/corrections.ts";
import { type Line, extractFeatures } from "../src/features.ts";
import { generate } from "../src/generate.ts";
import { type Pt, lineLength, pointAlong, pointInRing } from "../src/geometry.ts";
import { lanePlaces, placedPieces, placementOffset } from "../src/lane-place.ts";
import { loadInputs } from "../src/load.ts";

describe("placementOffset (G-825)", () => {
  const off = (placement: string, lanes = "3") => placementOffset({ highway: "secondary", oneway: "yes", lanes, placement });

  it("puts the middle of three lanes half a lane left of a line on the left edge of the third", () => {
    expect(off("left_of:3")).toBeCloseTo(1.625, 1);
    expect(off("right_of:2")).toBeCloseTo(1.625, 1);
  });

  it("puts it right of a line on the first lane's right edge or middle", () => {
    expect(off("right_of:1")).toBeCloseTo(-1.625, 1);
    expect(off("middle_of:1", "2")).toBeCloseTo(-1.625, 1);
    expect(off("left_of:3", "4")).toBe(0);
  });

  it("reads no offset for a transition, a lane the way does not have, or no lanes", () => {
    expect(off("transition")).toBe(0);
    expect(off("left_of:5")).toBe(0);
    expect(placementOffset({ highway: "secondary", placement: "left_of:2" })).toBe(0);
  });
});

describe("lanePlaces (G-825)", () => {
  const way = (id: string, line: Pt[], lanes: number, highway = "primary"): Line => ({ id, osmId: 1, tags: { highway, name: "Aleja", oneway: "yes", lanes: String(lanes) }, line });
  const node = { x: 0, z: 0 };

  it("shares five lanes out to the three going on and the two turning off on the left", () => {
    const five = way("w1", [{ x: 100, z: 0 }, node], 5);
    const three = way("w2", [node, { x: -100, z: 0 }], 3);
    const two = way("w3", [node, { x: -60, z: -30 }], 2, "primary_link");
    const places = lanePlaces([five, three, two], () => 0);
    // Driving -x: left is -z, where the two lanes turn off; the three keep the right ones (-3.25),
    // laid halfway to their own line, while the two run within the five's width of them (36 m).
    expect(places.get("w2")?.start).toEqual({ kind: "ramp", centre: -1.625, hold: 36 });
    expect(places.get("w3")?.start).toMatchObject({ kind: "beside", centre: 4.875 });
    expect(places.has("w1")).toBe(false);
  });

  it("lays a link's lane joining two inside them and one going off beside them, and none where a way turns off square", () => {
    const main = way("w1", [{ x: 100, z: 0 }, node, { x: -100, z: 0 }], 2);
    const link = way("w2", [{ x: 60, z: 20 }, node], 1, "primary_link");
    // Joining, its lane has tapered to nothing: its outer edge on the two's edge, 3.25 m off their line.
    expect(lanePlaces([main, link], () => 0).get("w2")?.end).toMatchObject({ kind: "beside", centre: -1.625 });
    // Going off, its deceleration lane begins beside them: its middle on their edge.
    const off = way("w4", [node, { x: -60, z: 20 }], 1, "primary_link");
    expect(lanePlaces([main, off], () => 0).get("w4")?.start).toMatchObject({ kind: "beside", centre: -3.25 });
    // A measured way's carriageway off its line at the node moves the place with it.
    expect(lanePlaces([main, link], (l) => (l.id === "w1" ? 0.5 : 0)).get("w2")?.end).toMatchObject({ kind: "beside", centre: -1.125 });
    const turn = way("w3", [{ x: 0, z: 60 }, node], 1);
    expect(lanePlaces([main, turn], () => 0).size).toBe(0);
    // A street of another name, as the one-way corner of a T junction, is no lane of the main road.
    const corner = { ...link, tags: { ...link.tags, highway: "residential", name: "Boczna" } };
    expect(lanePlaces([main, corner], () => 0).size).toBe(0);
  });

  it("moves no piece of a way without placement or places", () => {
    const l = way("w1", [{ x: 0, z: 0 }, { x: 10, z: 0 }], 2);
    expect(placedPieces(l, [l], 0, undefined, 0)[0]).toBe(l);
  });
});

/** The city's three places of G-825: the game's carriageway against the lanes OSM maps there. */
describe("the carriageway where OSM puts its lanes off its line (G-825)", () => {
  const inputs = loadInputs();
  const lines = withoutReplaced(extractFeatures(inputs.osm)).lines.map((l) => correctedLine(l));
  const chunk = (id: string, minX: number, minZ: number, maxX: number, maxZ: number) => ({ id, district: DISTRICTS[0]!, rect: { minX, minZ, maxX, maxZ } });
  const chunks = [chunk("lwowska", 1095, 395, 1145, 455), chunk("solidarnosci", 500, 370, 560, 420), chunk("melgiewska", 2300, 295, 2370, 370), chunk("ruska", 1055, 415, 1095, 460)];
  const pieces = generate(inputs.osm, () => 190, chunks)
    .chunks.flatMap((c) => c.ground)
    .map((g) => ({ surface: g.surface, ring: Array.from({ length: g.outline.length / 2 }, (_, i) => ({ x: g.outline[2 * i]!, z: g.outline[2 * i + 1]! })) }));
  const ground = pieces.filter((g) => g.surface === "road" || g.surface === "crossing").map((g) => g.ring);
  const onRoad = (p: Pt) => ground.some((r) => pointInRing(p, r));
  /** How far the asphalt reaches from way `id`'s line at `s` m along it, to its left (1) or right (-1), to 0.1 m. */
  const reach = (id: string, s: number, side: 1 | -1): number => {
    const line = lines.find((l) => l.id === id)!.line;
    const [p, a, b] = [pointAlong(line, s), pointAlong(line, s - 0.5), pointAlong(line, s + 0.5)];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    const n = { x: (-(b.z - a.z) / l) * side, z: ((b.x - a.x) / l) * side };
    let d = 0;
    while (d < 20 && onRoad({ x: p.x + n.x * (d + 0.05), z: p.z + n.z * (d + 0.05) })) d += 0.05;
    return Math.round(d * 10) / 10;
  };
  const along = (id: string, from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, k) => from + k * step).filter((s) => s < lineLength(lines.find((l) => l.id === id)!.line));

  it("lays Lwowska's two lanes left of its line (placement=left_of:3) to its west kerb, 6.5 m off it", () => {
    // w139586648 runs north at x 1123-1125; the orthophoto's west kerb lies at x 1117.8-1118.1.
    const short = along("w139586648", 10, 45, 5).filter((s) => reach("w139586648", s, 1) < 6.3);
    expect(short).toEqual([]);
  });

  it("keeps Al. Solidarności's three through lanes the right three of the five before them, to the north kerb", () => {
    // w215609082 runs west from the node where the two left lanes turn off (w60149306); the
    // orthophoto's north kerb lies 6.25-6.35 m off its line there, the import's 4.8 m before.
    const short = along("w215609082", 2, 16, 2).filter((s) => reach("w215609082", s, -1) < 6.2);
    expect(short).toEqual([]);
  });

  it("keeps Al. Solidarności's through lanes off the lawn's tip by the node, the north kerb under 6.6 m off its line", () => {
    // The single way's line w762599273 runs 2 m north of its asphalt's middle at the node (the lawn's
    // tip narrows it there): the orthophoto's north kerb 6.25-6.35 m off w215609082 over its first 6 m,
    // the lanes laid from the single way's left edge 7.7 m (G-825 r2).
    const wide = along("w215609082", 0.5, 6, 0.5).filter((s) => reach("w215609082", s, -1) > 6.6);
    expect(wide).toEqual([]);
  });

  it("ends a link's lane joining a street inside it, its outer edge on the street's kerb (Ruska, Andersa)", () => {
    // Ruska's link w216655518 joins Lwowska w233334687, whose carriageway lies 0.9 m east of its line
    // (measured): the orthophoto's lawn west of x 1073.75-1074.2 at z 428-434; the lane's middle on
    // the kerb laid the asphalt to x 1072.2 (G-825 r2).
    const west = (z: number) => {
      let x = 1080;
      while (x > 1060 && onRoad({ x: x - 0.025, z })) x -= 0.05;
      return Math.round(x * 100) / 100;
    };
    expect([428, 429, 430, 431, 432, 433, 434].filter((z) => west(z) < 1073.65)).toEqual([]);
    // Andersa's link w40051729 joins Mełgiewska: no asphalt and no sidewalk laid past the lawn's edge,
    // z 316 at x 2317 to z 319 at x 2322 on the 2024 photograph.
    const lawn: [number, number][] = [[2317, 316], [2318, 316.5], [2319, 317], [2320, 318], [2321, 318.5], [2322, 319]];
    const laid = lawn.flatMap(([x, edge]) =>
      Array.from({ length: 12 }, (_, k) => ({ x, z: edge + 0.25 + k * 0.4 })).filter((p) => pieces.some((g) => (g.surface === "road" || g.surface === "sidewalk") && pointInRing(p, g.ring))),
    );
    expect(laid).toEqual([]);
    // Where it runs clear of Mełgiewska it stays on its line: 2.1 m out, as the orthophoto's 2.35-2.75.
    expect(along("w40051729", 40, 52, 4).filter((s) => reach("w40051729", s, -1) > 2.3)).toEqual([]);
  });
});
