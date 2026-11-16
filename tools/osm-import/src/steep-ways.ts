/**
 * The stretches of the ways walked on foot that the game's terrain makes too steep to walk
 * (G-755): the map draws no steps there, but the NMT falls faster than a walker climbs, as down
 * the bank behind Grodzka's houses to Kowalska (w179264855, 9 m over 10 m). Each such stretch,
 * grown along its way until one even grade gets up it, is laid at that grade by the game where
 * its ground is still too steep (`packages/sim/src/content/lublin/steep-ways.ts`).
 */
import { type Line } from "./features.ts";
import { type Pt, type Rect, clipLineToRect, lineLength, pointAlong, r1, sliceLine } from "./geometry.ts";
import { type SteepWayOut } from "./model.ts";

/** The ways walked on foot only: a street's bank is its carriageway's, not a walker's stretch. */
const FOOT = new Set(["pedestrian", "footway", "path", "cycleway", "bridleway"]);

/** On the terrain: not an area, not on a bridge's deck, not under the ground. */
const onTerrain = (t: Line["tags"]): boolean =>
  FOOT.has(t.highway ?? "") && t.area !== "yes" && (t.bridge ?? "no") === "no" && (t.tunnel ?? "no") === "no" && t.indoor !== "yes" && Number(t.layer ?? 0) >= 0;

/** The steepest grade a walker climbs (the game's `MAX_WALK_SLOPE`, tg 35°, ADR-0043). */
export const WALK_GRADE = Math.tan((35 * Math.PI) / 180);
/**
 * The even grade a steep stretch is grown to (tg 30°): under `WALK_GRADE` by what the terrain's
 * grid between its points and the ramp's blend put back on it.
 */
export const EVEN_GRADE = Math.tan((30 * Math.PI) / 180);
/** The run the axis's grade is taken over (m), as the glitch scan's `walk-blocked` does. */
const RUN = 2;
/** The axis's samples (m). */
const STEP = 0.5;

/** The stretches [from, to] (m along the way) steeper than `WALK_GRADE` over `RUN`, those within a run of each other joined. */
const steepRuns = (ys: readonly number[]): [number, number][] => {
  const runs: [number, number][] = [];
  const k = Math.round(RUN / STEP);
  for (let i = 0; i + k < ys.length; i++) {
    if (Math.abs(ys[i + k]! - ys[i]!) / RUN <= WALK_GRADE) continue;
    const last = runs[runs.length - 1];
    if (last && i * STEP <= last[1] + RUN) last[1] = (i + k) * STEP;
    else runs.push([i * STEP, (i + k) * STEP]);
  }
  return runs;
};

/** The stretch grown at both ends, within the way's `length`, until its ends are at most `EVEN_GRADE` apart. */
const grown = (run: [number, number], length: number, y: (s: number) => number): [number, number] => {
  let [a, b] = run;
  while (Math.abs(y(b) - y(a)) / (b - a) > EVEN_GRADE && (a > 0 || b < length)) [a, b] = [Math.max(0, a - STEP), Math.min(length, b + STEP)];
  return [a, b];
};

/** Every way's steep stretches over the terrain `height`, foot first, ids `<way>/<k>` (a way may come in several pieces). */
export const steepWays = (lines: readonly Line[], height: (p: Pt) => number): SteepWayOut[] => {
  const out: SteepWayOut[] = [];
  const count = new Map<string, number>();
  for (const l of lines) {
    if (!onTerrain(l.tags)) continue;
    const length = lineLength(l.line);
    const y = (s: number) => height(pointAlong(l.line, s));
    const ys: number[] = [];
    for (let s = 0; s <= length; s += STEP) ys.push(y(s));
    // Two stretches grown into each other are one, grown again.
    const spans: [number, number][] = [];
    for (const run of steepRuns(ys)) {
      let span = grown(run, length, y);
      while (spans.length > 0 && spans[spans.length - 1]![1] >= span[0]) span = grown([spans.pop()![0], span[1]], length, y);
      spans.push(span);
    }
    for (const [a, b] of spans) {
      const piece = sliceLine(l.line, a, b);
      const line = y(a) <= y(b) ? piece : [...piece].reverse();
      const k = count.get(l.id) ?? 0;
      count.set(l.id, k + 1);
      out.push({ id: `${l.id}/${k}`, line: line.flatMap((p) => [r1(p.x), r1(p.z)]) });
    }
  }
  return out;
};

/** The steep stretches reaching into the chunk, whole. */
export const chunkSteepWays = (ways: readonly SteepWayOut[], rect: Rect): SteepWayOut[] =>
  ways.filter((w) => {
    const pts: Pt[] = [];
    for (let i = 0; i + 1 < w.line.length; i += 2) pts.push({ x: w.line[i]!, z: w.line[i + 1]! });
    return clipLineToRect(pts, rect).length > 0;
  });
