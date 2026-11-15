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
    // Driving -x: left is -z, where the two lanes turn off; the three keep the right ones.
    expect(places.get("w2")?.start).toEqual({ kind: "ramp", centre: -3.25 });
    expect(places.get("w3")?.start).toMatchObject({ kind: "beside", centre: 4.875 });
    expect(places.has("w1")).toBe(false);
  });

  it("lays a link's lane joining two at the edge of the two, and none where a way turns off square", () => {
    const main = way("w1", [{ x: 100, z: 0 }, node, { x: -100, z: 0 }], 2);
    const link = way("w2", [{ x: 60, z: 20 }, node], 1, "primary_link");
    expect(lanePlaces([main, link], () => 0).get("w2")?.end).toMatchObject({ kind: "beside", centre: -3.25 });
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
  const chunks = [chunk("lwowska", 1095, 395, 1145, 455), chunk("solidarnosci", 500, 370, 560, 420), chunk("melgiewska", 2300, 295, 2370, 370)];
  const ground = generate(inputs.osm, () => 190, chunks)
    .chunks.flatMap((c) => c.ground)
    .filter((g) => g.surface === "road" || g.surface === "crossing")
    .map((g) => Array.from({ length: g.outline.length / 2 }, (_, i) => ({ x: g.outline[2 * i]!, z: g.outline[2 * i + 1]! })));
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

  it("runs the link from Andersa beside Mełgiewska's two lanes up to where it joins them, not over them", () => {
    // w40051729's last 8 m: the orthophoto's asphalt 3.75-4.25 m out (right) of its line, the import's 2.1 m before.
    const short = along("w40051729", 62, 66, 2).filter((s) => reach("w40051729", s, -1) < 4);
    expect(short).toEqual([]);
    // Where it runs clear of Mełgiewska it stays on its line: 2.1 m out, as the orthophoto's 2.35-2.75.
    expect(along("w40051729", 40, 52, 4).filter((s) => reach("w40051729", s, -1) > 2.3)).toEqual([]);
  });
});
