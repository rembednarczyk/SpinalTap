import { describe, expect, it } from "vitest";
import { type StreetPropItem, barrierVariant } from "../../../packages/core/src";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types";
import { keysOf } from "../src/scan-keys.ts";
import { barrierCoverChecks } from "./barrier-cover";

/** The glitch scan's check `city-wall-kept` on a city wall along z = 5 from x 0 to 100, kept by 0.25 m pieces but where it is left out. */

const wall = { id: "w1", kind: "city-wall", line: [0, 5, 100, 5] };
const chunk = { barriers: [wall] } as unknown as LublinChunkData;
const variant = barrierVariant({ kind: "city-wall", length: 0.25, height: 3, rise: 0, material: "plain" });
type Gaps = readonly (readonly [number, number])[];
/** The wall's pieces, those in `gaps` left out. */
const kept = (gaps: Gaps): StreetPropItem[] =>
  Array.from({ length: 400 }, (_, k) => k * 0.25 + 0.125)
    .filter((x) => !gaps.some(([a, b]) => x > a && x < b))
    .map((x) => ({ prop: "barrier", x, y: 0, z: 5, yaw: Math.PI / 2, variant }));
const found = (gaps: Gaps) => barrierCoverChecks([chunk], kept(gaps), [], () => false)["city-wall-kept"]!();
const keys = (gaps: Gaps) => [...keysOf("city-wall-kept", found(gaps), [{ id: "c", bounds: { minX: -100, maxX: 200, minZ: -100, maxZ: 100 } }]).keys()];

describe("city-wall-kept (G-756)", () => {
  it("finds a metre a metre left out, rounded in each 10 m square", () => {
    expect(found([])).toEqual([]);
    expect(found([[21, 23]])).toHaveLength(2);
    // 2 m and 1.5 m left out, in two squares: 2 and 2.
    expect(found([[21, 23], [71, 72.5]])).toHaveLength(4);
  });

  it("keys the squares of a stretch left out whatever the wall's other stretches", () => {
    // Left out: 3 m at x 11..14, a metre at x 69..70, half of it in the square 60..70 and half in 70..80 (by its place rounded to the metre), and a stretch at x 91 that grows.
    const middle = (tail: number) => keys([[11, 14], [69, 70], [91, 91 + tail]]).filter((k) => k === "c 60,0" || k === "c 70,0");
    const tails = Array.from({ length: 11 }, (_, k) => 0.5 + k * 0.25);
    expect(new Set(tails.map((t) => middle(t).join(" | ")))).toEqual(new Set(["c 60,0 | c 70,0"]));
  });
});
