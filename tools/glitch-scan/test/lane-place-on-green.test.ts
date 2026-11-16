import { describe, expect, it } from "vitest";
import { COVER } from "../../orto/src/classify.ts";
import { type Cover } from "../../orto/src/cover.ts";
import { THRESHOLDS } from "../../orto/src/thresholds.ts";
import { type Line } from "../../osm-import/src/features.ts";
import { lanePlaceOnGreen, laneNodes } from "./lane-place-on-green";

/** A 40 m square's cover round the node (0, 0), all of it `cls`. */
const cover = (cls: number): Cover => ({
  header: { district: "t", x0: -20, z1: 20, step: 0.5, width: 80, height: 80, classes: [], source: "", tiles: [], thresholds: THRESHOLDS },
  cls: new Uint8Array(80 * 80).fill(cls),
});
const way = (id: string, line: [number, number][], lanes: number, highway: string): Line => ({ id, osmId: 1, tags: { highway, name: "Aleja", oneway: "yes", lanes: String(lanes) }, line: line.map(([x, z]) => ({ x, z })) });
const square = (x0: number, z0: number, x1: number, z1: number) => [x0, z0, x1, z0, x1, z1, x0, z1];

describe("a lane laid onto a lawn by a node of a split or join (lane-place-on-green, G-825)", () => {
  // A link's lane joining two lanes of the street at the node (0, 0), from the north-east.
  const lines = [way("w1", [[100, 0], [0, 0], [-100, 0]], 2, "primary"), way("w2", [[60, 20], [0, 0]], 1, "primary_link")];
  const ground = [
    // Asphalt 5 m north of the street's line, past its band (3.25 m) and the link's: a lane on the lawn.
    { surface: "road", outline: square(-2, 4.5, -1, 5) },
    // A pavement inside the street's band, and a lawn past it: no lane of the map's laid there.
    { surface: "sidewalk", outline: square(-6, 1, -5, 2) },
    { surface: "grass", outline: square(-6, 6, -5, 7) },
  ];

  it("finds the node of the join", () => {
    expect(laneNodes(lines).map((n) => [n.node, n.ways.map((l) => l.id)])).toEqual([[{ x: 0, z: 0 }, ["w2"]]]);
  });

  it("names each sample of green under asphalt or a pavement past the bands, and none on paving or under a lawn", () => {
    expect(lanePlaceOnGreen(lines, [{ ground }], [cover(COVER.green)]).map((f) => f.what)).toEqual([
      "road on green -1.75,4.75 by the lanes' node 0.0,0.0",
      "road on green -1.25,4.75 by the lanes' node 0.0,0.0",
    ]);
    expect(lanePlaceOnGreen(lines, [{ ground }], [cover(COVER.asphalt)])).toEqual([]);
  });

  it("finds none by a node no way splits or joins at", () => {
    const turn = [lines[0]!, way("w3", [[0, 60], [0, 0]], 1, "primary")];
    expect(lanePlaceOnGreen(turn, [{ ground }], [cover(COVER.green)])).toEqual([]);
  });
});
