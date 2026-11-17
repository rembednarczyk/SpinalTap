import { describe, expect, it } from "vitest";
import { segmentDistance } from "../../../packages/core/src/math/geometry2d.ts";
import { FILL } from "../src/bare-cover.ts";
import { FRONT, frontages } from "../src/bare-fronts.ts";
import { withoutReplaced } from "../src/corrections-alchemia.ts";
import { correctedLine } from "../src/corrections.ts";
import { extractFeatures } from "../src/features.ts";
import { type Pt, type Rect, pointInRing } from "../src/geometry.ts";
import { loadInputs } from "../src/load.ts";
import { generatedAround } from "./city.ts";

describe("a pedestrian street's frontage stops by its reach (G-889)", () => {
  it("joins no strip to the frontage past its reach, its margin and a strip's width: the scrub behind Karmelicka stays unpaved", () => {
    // The strip of scrub between the path and the car park behind Karmelicka, 12-37 m off its axis:
    // the orthophoto of 2024-06 shows it green. Joined to the frontage whole (`joinLoose`, a mean
    // width under 3 m), it got 31.5 m² of setts in the box, 29.5 m² of the frontage's pieces past 14 m.
    const box: Rect = { minX: 344, minZ: 58, maxX: 351, maxZ: 88 };
    const fronts = frontages(withoutReplaced(extractFeatures(loadInputs().osm)).lines.map((l) => correctedLine(l)));
    // How far past its reach a cell is from the nearest frontage's axis (m): Karmelicka's, 8 m.
    const past = (p: Pt) =>
      Math.min(...fronts.flatMap((f) => f.line.slice(1).map((b, k) => segmentDistance(p.x, p.z, f.line[k]!.x, f.line[k]!.z, b.x, b.z) - f.reach)));
    const pieces = generatedAround([{ x: 347, z: 73 }])
      .chunks.flatMap((c) => c.ground)
      .filter((g) => g.front)
      .map((g) => ({ surface: g.surface, ring: Array.from({ length: g.outline.length / 2 }, (_, k) => ({ x: g.outline[2 * k]!, z: g.outline[2 * k + 1]! })) }));
    const cells: { past: number; surface: string }[] = [];
    for (let x = box.minX + 0.25; x < box.maxX; x += 0.5)
      for (let z = box.minZ + 0.25; z < box.maxZ; z += 0.5) {
        const g = pieces.find((q) => pointInRing({ x, z }, q.ring));
        if (g) cells.push({ past: past({ x, z }), surface: g.surface });
      }
    // A cell's centre within the limit; its piece traced up to half a cell past it.
    const far = cells.filter((c) => c.past > FILL.zoneMargin + FRONT.strip + 0.25).length * 0.25;
    // The strip begins past the frontage proper (reach and margin, 11 m): within it, west of the
    // path at the box's north end, 2.75 m² of Karmelicka's frontage stay laid as anywhere.
    const setts = cells.filter((c) => c.past > FILL.zoneMargin && c.surface === "square").length * 0.25;
    expect({ far, setts: setts < 5 }, `${setts} m² of setts on the strip`).toEqual({ far: 0, setts: true });
  });
});
