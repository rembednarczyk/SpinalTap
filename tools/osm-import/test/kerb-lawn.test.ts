import { describe, expect, it } from "vitest";
import { DISTRICTS } from "../src/config.ts";
import { generate } from "../src/generate.ts";
import { type Pt, pointInRing } from "../src/geometry.ts";
import { loadInputs } from "../src/load.ts";

describe("a moved carriageway's strip to a lawn (G-825 r3-r5)", () => {
  const inputs = loadInputs();
  const chunk = (id: string, minX: number, minZ: number, maxX: number, maxZ: number) => ({ id, district: DISTRICTS[0]!, rect: { minX, minZ, maxX, maxZ } });
  // Lwowska's east kerb by Rondo Mohyły, Al. Tysiąclecia's north-east corner at Lwowska, and Lwowska's west kerb north of it.
  const chunks = [chunk("mohyly", 1080, 450, 1100, 480), chunk("tysiaclecia", 1105, 268, 1125, 282), chunk("lwowska", 1100, 330, 1130, 450), chunk("ruska", 1055, 425, 1080, 452)];
  const ground = generate(inputs.osm, () => 190, chunks, undefined, undefined, undefined, inputs.covers)
    .chunks.flatMap((c) => c.ground)
    .map((g) => ({ surface: g.surface, ring: Array.from({ length: g.outline.length / 2 }, (_, i) => ({ x: g.outline[2 * i]!, z: g.outline[2 * i + 1]! })) }));
  const on = (surface: string) => (p: Pt) => ground.some((g) => g.surface === surface && pointInRing(p, g.ring));
  const onGrass = on("grass");

  it("lays no lawn over the paving between Lwowska's moved kerb and the lawn by Rondo Mohyły", () => {
    // PZGiK 2024-06 and 2025-04: asphalt to x 1088.75-1089.4, 1-2 m of paving, the lawn from x 1091.0
    // (z 458), 1090.0 (z 462), 1090.3 (z 465), 1091.5 (z 469); the map's lawn w173071721 0.3-0.4 m short
    // of it. The strip laid as the lawn's from the kerb put grass from x 1088.9-1089.4.
    // Grass within a kerb's width of the asphalt is the kerb's (0.6 m), as everywhere in the game.
    const lawn: [number, number][] = [[458, 1091.0], [462, 1090.0], [465, 1090.3], [469, 1091.5]];
    const kerb = (z: number) => {
      let x = 1086;
      while (x < 1092 && !onGrass({ x, z }) && (on("road")({ x, z }) || x < 1088)) x += 0.05;
      return x;
    };
    const early = lawn.flatMap(([z, x]) => Array.from({ length: 8 }, (_, k) => ({ x: x - 0.5 - k * 0.25, z })).filter((p) => p.x > kerb(z) + 0.6 && onGrass(p)));
    expect(early).toEqual([]);
    expect(lawn.filter(([z, x]) => !onGrass({ x: x + 0.2, z }))).toEqual([]);
  });

  it("lays no lawn over the asphalt and the kerb of Al. Tysiąclecia's north-east corner", () => {
    // PZGiK 2024-06: asphalt to z 275.0-275.1, the kerb 275.1-275.6, the lawn from 275.6 (x 1117) and
    // 275.9 (x 1114); the carriageway laid to z 274.35-274.75, and the strip from it was grass.
    const laid = [1111, 1112, 1113, 1114, 1115, 1116, 1117, 1118].flatMap((x) => Array.from({ length: 6 }, (_, k) => ({ x, z: 274.9 + k * 0.1 })).filter(onGrass));
    expect(laid).toEqual([]);
  });

  // The ground 0.3 m short of the first carriageway met at z walking from x `from` by `dx`, from the lawn's side.
  const pastKerb = (z: number, from: number, dx: number) => {
    let x = from;
    while (Math.abs(x - from) < 15 && !on("road")({ x, z })) x += dx;
    const p = { x: x - Math.sign(dx) * 0.3, z };
    return ground.find((g) => (g.surface === "grass" || g.surface === "square") && pointInRing(p, g.ring))?.surface ?? "other";
  };
  const along = (z0: number, z1: number) => Array.from({ length: Math.floor((z1 - z0) / 0.5) + 1 }, (_, k) => z0 + k * 0.5);

  it("lays one surface along the strip by Lwowska's moved kerbs, not grass and square by turns", () => {
    // PZGiK 2023-09 and 2024-06: one lawn behind one light kerb 0.5-1 m wide along Lwowska's west
    // kerb (z 337.8-365 but the zebra and footway at 348-354, 392-442) and its east kerb by Rondo Mohyły (z 455-472). Chosen sample by
    // sample the strip flipped between square and grass every 1-3 m (13 runs on the west kerb), and
    // by Rondo Mohyły the lawn met the asphalt for 2 m (z 462.5-464.4).
    const west = [...along(338.5, 347.5), ...along(354.5, 364.5), ...along(392.5, 441)].filter((z) => pastKerb(z, 1105, 0.05) !== "square");
    const east = along(455.5, 471.5).filter((z) => pastKerb(z, 1095, -0.05) !== "square");
    expect({ west, east }).toEqual({ west: [], east: [] });
  });

  it("lays the lawn of Ruska's link from its kerb, and a square only by its zebra", () => {
    // PZGiK 2023-09, 2024-06 and 2025-04: the lawn from the link's edge (z 432-444); paving only by
    // the zebra at its north end (z 444-447.5). The stretch went a square 1.0-1.8 m wide for its five
    // samples of paving, four of them by the zebra.
    expect({ lawn: on("grass")({ x: 1070.5, z: 438.5 }), zebra: on("square")({ x: 1063.5, z: 446 }) }).toEqual({ lawn: true, zebra: true });
  });
});
