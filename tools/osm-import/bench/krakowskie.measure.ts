/**
 * ADR-0078 measurement: Krakowskie Przedmieście's ground as the importer lays it now and as the
 * Clipper2 prototype (`clipper-ground.ts`) lays it from the same bands. `chunkGround` is wrapped
 * to catch its bands; the production code runs unchanged. Prints the numbers (JSON, also to
 * `$MEASURE_OUT`); no assertions on them.
 */
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { FillRule, areaPaths, intersect, isPositive } from "clipper2-ts";
import { expect, it, vi } from "vitest";
import type * as GroundModule from "../src/ground.ts";
import { type Band } from "../src/ground.ts";
import { type Rect, signedArea } from "../src/geometry.ts";
import { type GroundOut } from "../src/model.ts";
import { DISTRICTS, chunksOf } from "../src/config.ts";
import { generate } from "../src/generate.ts";
import { loadInputs } from "../src/load.ts";
import { type ProtoOptions, SCALE, clipperChunk, timings, toPts } from "./clipper-ground.ts";
import { type GroundMeasure, type Piece, difference, measure, rasterize } from "./ground-metrics.ts";

type Call = { bands: readonly Band[]; rect: Rect; out: readonly GroundOut[]; ms: number };
const calls = vi.hoisted(() => [] as Call[]);

vi.mock("../src/ground.ts", async (importOriginal) => {
  const orig = await importOriginal<typeof GroundModule>();
  return {
    ...orig,
    chunkGround: (bands: readonly Band[], rect: Rect) => {
      const t = performance.now();
      const out = orig.chunkGround(bands, rect);
      calls.push({ bands, rect, out, ms: performance.now() - t });
      return out;
    },
  };
});

const sum = (ms: readonly GroundMeasure[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const m of ms) for (const [k, v] of Object.entries(m)) out[k] = Math.round(((out[k] ?? 0) + v) * 100) / 100;
  return out;
};

const currentPieces = (c: Call): Piece[] =>
  c.out.filter((g) => !g.bridge).map((g) => [Array.from({ length: g.outline.length / 2 }, (_, i) => ({ x: g.outline[2 * i]!, z: g.outline[2 * i + 1]! }))]);

const current = () => {
  const ms: GroundMeasure[] = [];
  for (const c of calls) ms.push(measure(currentPieces(c), c.rect, 0));
  return sum(ms);
};

const prototype = (opts: ProtoOptions) => {
  const ms: GroundMeasure[] = [];
  const cover = { onlyNow: 0, onlyClipper2: 0 };
  let [outers, slivers, clipperMs, exactOverlap] = [0, 0, 0, 0];
  for (const k of Object.keys(timings) as (keyof typeof timings)[]) timings[k] = 0;
  for (const c of calls) {
    const t = performance.now();
    const layers = clipperChunk(c.bands, c.rect, opts).filter((l) => !l.bridge);
    clipperMs += performance.now() - t;
    let holes = 0;
    // Exact overlap of the surfaces, not the raster's: what the integer rounding of the cuts leaves.
    layers.forEach((l, i) => layers.slice(i + 1).forEach((m) => (exactOverlap += Math.abs(areaPaths(intersect(l.paths, m.paths, FillRule.NonZero))) / (SCALE * SCALE))));
    for (const l of layers) {
      const outer = l.paths.filter((p) => isPositive(p));
      holes += l.paths.length - outer.length;
      outers += outer.length;
      slivers += outer.filter((p) => Math.abs(signedArea(toPts(p))) < 0.05).length;
    }
    const pieces: Piece[] = layers.map((l) => l.paths.map(toPts));
    ms.push(measure(pieces, c.rect, holes));
    const d = difference(rasterize(currentPieces(c), c.rect), rasterize(pieces, c.rect));
    cover.onlyNow += d.onlyA;
    cover.onlyClipper2 += d.onlyB;
  }
  const steps = Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, Math.round(v)]));
  return { opts, ...sum(ms), outlines: outers, slivers, exactOverlap: Math.round(exactOverlap * 1000) / 1000, scale: SCALE, clipperMs: Math.round(clipperMs), steps, ...cover };
};

it("measures Krakowskie's ground, current and Clipper2", () => {
  const inputs = loadInputs();
  const chunks = chunksOf(DISTRICTS.find((d) => d.slug === "krakowskie")!);
  const run = () => {
    calls.length = 0;
    const t = performance.now();
    generate(inputs.osm, inputs.src, chunks, undefined, inputs.lod1);
    return performance.now() - t;
  };
  run();
  const generateMs = Math.min(run(), run());
  // Warm-up of the prototype's code paths before it is timed.
  prototype({ arc: 0.05, close: 0 });
  const result = {
    chunks: calls.length,
    bands: calls.reduce((n, c) => n + c.bands.length, 0),
    generateMs: Math.round(generateMs),
    chunkGroundMs: Math.round(calls.reduce((n, c) => n + c.ms, 0)),
    now: current(),
    clipper2: [
      prototype({ arc: 0.05, close: 0 }),
      prototype({ arc: 0.1, close: 0, simplify: 0.1 }),
      prototype({ arc: 0.1, close: 0, simplify: 0.3 }),
      prototype({ arc: 0.1, close: 0.3, simplify: 0.1 }),
      prototype({ arc: 0.1, close: 0.6, simplify: 0.1 }),
    ],
  };
  const text = JSON.stringify(result, null, 2);
  if (process.env.MEASURE_OUT) writeFileSync(process.env.MEASURE_OUT, text);
  console.log(text);
  expect(calls.length).toBe(chunks.length);
});
