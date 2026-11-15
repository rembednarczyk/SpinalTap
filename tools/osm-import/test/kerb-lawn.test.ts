import { describe, expect, it } from "vitest";
import { DISTRICTS } from "../src/config.ts";
import { generate } from "../src/generate.ts";
import { type Pt, pointInRing } from "../src/geometry.ts";
import { loadInputs } from "../src/load.ts";

describe("a moved carriageway's strip to a lawn (G-825 r3)", () => {
  const inputs = loadInputs();
  const chunk = (id: string, minX: number, minZ: number, maxX: number, maxZ: number) => ({ id, district: DISTRICTS[0]!, rect: { minX, minZ, maxX, maxZ } });
  // Lwowska's east kerb by Rondo Mohyły, and Al. Tysiąclecia's north-east corner at Lwowska.
  const chunks = [chunk("mohyly", 1080, 450, 1100, 480), chunk("tysiaclecia", 1105, 268, 1125, 282)];
  const grass = generate(inputs.osm, () => 190, chunks)
    .chunks.flatMap((c) => c.ground)
    .filter((g) => g.surface === "grass")
    .map((g) => Array.from({ length: g.outline.length / 2 }, (_, i) => ({ x: g.outline[2 * i]!, z: g.outline[2 * i + 1]! })));
  const onGrass = (p: Pt) => grass.some((r) => pointInRing(p, r));

  it("lays no lawn over the paving between Lwowska's moved kerb and the lawn by Rondo Mohyły", () => {
    // PZGiK 2024-06 and 2025-04: asphalt to x 1088.75-1089.4, 1-2 m of paving, the lawn from x 1091.0
    // (z 458), 1090.0 (z 462), 1090.3 (z 465), 1091.5 (z 469); the map's lawn w173071721 0.3-0.4 m short
    // of it. The strip laid as the lawn's from the kerb put grass from x 1088.9-1089.4.
    const lawn: [number, number][] = [[458, 1091.0], [462, 1090.0], [465, 1090.3], [469, 1091.5]];
    const early = lawn.flatMap(([z, x]) => Array.from({ length: 8 }, (_, k) => ({ x: x - 0.5 - k * 0.25, z })).filter(onGrass));
    expect(early).toEqual([]);
    expect(lawn.filter(([z, x]) => !onGrass({ x: x + 0.2, z }))).toEqual([]);
  });

  it("lays no lawn over the asphalt and the kerb of Al. Tysiąclecia's north-east corner", () => {
    // PZGiK 2024-06: asphalt to z 275.0-275.1, the kerb 275.1-275.6, the lawn from 275.6 (x 1117) and
    // 275.9 (x 1114); the carriageway laid to z 274.35-274.75, and the strip from it was grass.
    const laid = [1111, 1112, 1113, 1114, 1115, 1116, 1117, 1118].flatMap((x) => Array.from({ length: 6 }, (_, k) => ({ x, z: 274.9 + k * 0.1 })).filter(onGrass));
    expect(laid).toEqual([]);
  });
});
