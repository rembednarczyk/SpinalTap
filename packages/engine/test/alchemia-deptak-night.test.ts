// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALCHEMIA_TIER_PIECES, DEPTAK_NIGHT_CABLES, DEPTAK_NIGHT_PIECES, DEPTAK_NIGHT_STRINGS, stringY } from "@seki/sim";
import { GeometrySink, parseCityKit } from "../src/renderer/city-kit-data";
import { deptakNightPiece, deptakNightStrings } from "../src/renderer/alchemia/deptak-night-geometry";

/**
 * The deptak's south end at night in the drawing (22.11): its pieces in Alchemia's tiers mesh (no mesh
 * or draw call of their own), the chōchin as barrels on hooks, the strings sagging between their ends.
 */
describe("the deptak's night in the drawing (22.11)", () => {
  const bytes = (readFileSync as (url: URL) => Uint8Array)(new URL("../../app/public/city/city-kit.glb", import.meta.url));
  const data = parseCityKit(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const ys = (s: GeometrySink): number[] => s.positions.filter((_, i) => i % 3 === 1);

  it("is among Alchemia's tiers, drawn with them", () => {
    const tiers = new Set(ALCHEMIA_TIER_PIECES);
    expect(DEPTAK_NIGHT_PIECES.every((p) => tiers.has(p))).toBe(true);
  });

  it("draws a chōchin within its box and its hook up to its string, and leaves the holo to Alchemia's part", () => {
    const lantern = DEPTAK_NIGHT_PIECES.find((p) => p.kind === "lantern" && p.box.y0 > 2.5)!;
    const s = new GeometrySink();
    expect(deptakNightPiece(s, data, lantern)).toBe(true);
    expect(Math.min(...ys(s))).toBeCloseTo(lantern.box.y0, 3);
    expect(Math.max(...ys(s))).toBeCloseTo(lantern.box.y1 + 0.22, 3);
    const holo = DEPTAK_NIGHT_PIECES.find((p) => p.kind === "holo")!;
    expect(deptakNightPiece(new GeometrySink(), data, holo)).toBe(false);
    expect(deptakNightPiece(new GeometrySink(), data, ALCHEMIA_TIER_PIECES[0]!)).toBe(false);
  });

  it("sags each string from its ends to its middle", () => {
    const s = new GeometrySink();
    deptakNightStrings(s, data);
    const all = [...DEPTAK_NIGHT_STRINGS, ...DEPTAK_NIGHT_CABLES];
    expect(s.vertexCount).toBeGreaterThan(0);
    const low = Math.min(...ys(s));
    const lowest = Math.min(...all.flatMap((q) => Array.from({ length: 101 }, (_, i) => stringY(q, q.a.x + ((q.b.x - q.a.x) * i) / 100))));
    expect(low).toBeGreaterThan(lowest - 0.02);
    expect(low).toBeLessThan(Math.min(...all.map((q) => Math.min(q.a.y, q.b.y))));
  });
});
