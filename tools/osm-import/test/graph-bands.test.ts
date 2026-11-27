import { describe, expect, it } from "vitest";
import { COVER } from "../../orto/src/classify.ts";
import { type Line } from "../src/features.ts";
import { type Pt, pointInRing, ringBounds } from "../src/geometry.ts";
import { type Band } from "../src/ground.ts";
import { graphBands } from "../src/streets/graph-bands.ts";
import { bdotMatch } from "../src/streets/widths.ts";

/** ADR-0104 E2/E3: a side's section between the kerb and a mapped sidewalk past a gap. */

const rect = (minX: number, maxX: number, minZ: number, maxZ: number): Pt[] => [{ x: minX, z: minZ }, { x: maxX, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ }];
const boxed = (b: Band) => ({ ...b, box: ringBounds(b.ring) });
// A street in Krakowskie Przedmieście's chunks where BDOT10k has no carriageway, its kerb 3 m off
// its axis, and a sidewalk mapped on its own 5 m past the kerb, 2 m wide.
const [X0, X1, Z] = [-20, 40, 10];
const axis = [{ x: X0, z: Z }, { x: X1, z: Z }];
const lines: Line[] = [
  { id: "w1", osmId: 1, tags: { highway: "residential" }, line: axis },
  { id: "w2", osmId: 2, tags: { highway: "footway", footway: "sidewalk" }, line: [{ x: X0, z: Z + 9 }, { x: X1, z: Z + 9 }] },
];
const bands = [
  boxed({ surface: "road", ring: rect(X0, X1, Z - 3, Z + 3), bridge: false, source: "w1", carriageway: true, kerb: { line: axis, half: 3 } }),
  boxed({ surface: "sidewalk", ring: rect(X0, X1, Z + 8, Z + 10), bridge: false, source: "w2" }),
];
const surfaceAt = (out: readonly Band[], p: Pt) => out.filter((b) => pointInRing(p, b.ring)).map((b) => b.surface);

describe("the gap between a kerb and a mapped sidewalk (ADR-0104)", () => {
  it("is the sidewalk where the orthophoto shows paving, a verge left bare where it shows green", () => {
    expect(bdotMatch(axis)).toBeNull();
    const gap = { x: (X0 + X1) / 2, z: Z + 5.5 };
    const paved = graphBands(bands, lines, [], () => false, () => COVER.paving, new Set(["krakowskie"]));
    expect(surfaceAt(paved, gap)).toContain("sidewalk");
    const green = graphBands(bands, lines, [], () => false, () => COVER.green, new Set(["krakowskie"]));
    expect(surfaceAt(green, gap)).not.toContain("sidewalk");
  });
});

describe("a lawn the map draws in a square beside a street (ADR-0104, grass-under-paving)", () => {
  // A square from 2 m past the kerb, a lawn 4 by 2 m in it (a hole in its paving, as Plac Litewski's):
  // the gaps' closing fills the lawn as one, and the sidewalk laid over it hid the lawn.
  const square = (ring: Pt[], k: number) => boxed({ surface: "square", ring, bridge: false, source: `r${k}` });
  const placed = [
    bands[0]!,
    square(rect(X0, X1, Z + 5, Z + 8), 1),
    square(rect(X0, X1, Z + 10, Z + 14), 2),
    square(rect(X0, 8, Z + 8, Z + 10), 3),
    square(rect(12, X1, Z + 8, Z + 10), 4),
    boxed({ surface: "grass", ring: rect(8, 12, Z + 8, Z + 10), bridge: false, source: "w9" }),
  ];
  it("lays no sidewalk over it", () => {
    const out = graphBands(placed, lines.slice(0, 1), [], () => false, () => COVER.paving, new Set(["krakowskie"]));
    expect(surfaceAt(out, { x: 10, z: Z + 9 })).toEqual(["grass"]);
  });
});
