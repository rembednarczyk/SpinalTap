import type { RoadMarkingKind } from "@seki/core";
import { DRESS_FLAG, type MeshSink, type Rgba, hexColor } from "../mesh-sink";
import { type HeightAt, SURFACE_CODE, drape } from "./ground-plan";
import type { P2 } from "./polygon";

/**
 * Road markings of Lublin 2077 (ADR-0052): the Polish lines, laid in self-lit neon paint that
 * glows on the wet asphalt at night. The centre line between the directions is hot pink, the
 * lines between lanes of one direction cyan, the edge lines a cold white, the stop lines a
 * bright white bar; cycle lanes are violet, bus lanes amber, both with a brighter border.
 */
interface Stroke {
  /** Width of one line (m). */
  readonly width: number;
  /** Painted and empty lengths along the line (m); 0 gap: solid. */
  readonly dash: number;
  readonly gap: number;
  readonly color: Rgba;
  /** Two lines this far apart, centre to centre (the double solid). */
  readonly double?: number;
}

const lit = (hex: string): Rgba => hexColor(hex, DRESS_FLAG.lit);

/** Line styles per kind; the lanes of their own get a band under their border lines. */
const STROKES: Readonly<Record<RoadMarkingKind, Stroke>> = {
  "centre-dash": { width: 0.12, dash: 3, gap: 5, color: lit("#c8327a") },
  "centre-double": { width: 0.12, dash: 1, gap: 0, color: lit("#c8327a"), double: 0.24 },
  "lane-dash": { width: 0.12, dash: 2, gap: 4, color: lit("#2aa6c4") },
  edge: { width: 0.15, dash: 1, gap: 0, color: lit("#9fb2c8") },
  stop: { width: 0.45, dash: 1, gap: 0, color: lit("#d8e6f2") },
  "cycle-lane": { width: 0.12, dash: 1, gap: 0, color: lit("#9a5cff"), double: 1.38 },
  "bus-lane": { width: 0.12, dash: 1, gap: 0, color: lit("#ffb000"), double: 1.38 },
};

/** The lanes' own bands: a dim fill between their border lines. */
const BANDS: Partial<Record<RoadMarkingKind, { readonly width: number; readonly color: Rgba }>> = {
  "cycle-lane": { width: 1.5, color: hexColor("#3a2466", DRESS_FLAG.wet) },
  "bus-lane": { width: 1.5, color: hexColor("#5a3d12", DRESS_FLAG.wet) },
};

/** Lift of the lines and of the lanes' bands above the terrain (m): over the road's 0.10, under the sidewalks. */
export const MARKING_LIFT = 0.13;
const BAND_LIFT = 0.12;

const META = [SURFACE_CODE.road, 0] as const;

/** The pieces of `line` that are painted: [from, to] arc lengths of each dash. */
export const dashes = (length: number, dash: number, gap: number): [number, number][] => {
  if (gap <= 0) return length > 0 ? [[0, length]] : [];
  const out: [number, number][] = [];
  // Centred, so the pattern is the same from either end of the line.
  const period = dash + gap;
  const count = Math.max(1, Math.floor((length + gap) / period));
  const start = (length - (count * period - gap)) / 2;
  for (let k = 0; k < count; k++) {
    const a = start + k * period;
    if (a + dash > 0 && a < length) out.push([Math.max(0, a), Math.min(length, a + dash)]);
  }
  return out;
};

/** A strip `width` wide centred `offset` metres left of `line` between arc lengths `from` and `to`, draped. */
const strip = (sink: MeshSink, line: readonly P2[], from: number, to: number, offset: number, width: number, color: Rgba, h: HeightAt, lift: number): void => {
  let s = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i] as P2;
    const b = line[i + 1] as P2;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const s0 = Math.max(from, s);
    const s1 = Math.min(to, s + len);
    s += len;
    if (len < 1e-6 || s1 - s0 < 0.02) continue;
    const tx = (b.x - a.x) / len;
    const tz = (b.z - a.z) / len;
    // Left of the direction is (-tz, tx).
    const at = (d: number, o: number): P2 => ({ x: a.x + tx * d - tz * o, z: a.z + tz * d + tx * o });
    const d0 = s0 - (s - len);
    const d1 = s1 - (s - len);
    const l = offset + width / 2;
    const r = offset - width / 2;
    drape(sink, [at(d0, r), at(d1, r), at(d1, l), at(d0, l)], h, lift, color, (p) => [p.x, p.z], META);
  }
};

const lengthOf = (line: readonly P2[]): number => {
  let s = 0;
  for (let i = 0; i + 1 < line.length; i++) s += Math.hypot((line[i + 1] as P2).x - (line[i] as P2).x, (line[i + 1] as P2).z - (line[i] as P2).z);
  return s;
};

/** One line of road markings, painted on the road in its kind's dashes and colours. */
export const planMarking = (sink: MeshSink, kind: RoadMarkingKind, line: readonly P2[], h: HeightAt): void => {
  if (line.length < 2) return;
  const length = lengthOf(line);
  const st = STROKES[kind];
  const band = BANDS[kind];
  if (band) strip(sink, line, 0, length, 0, band.width, band.color, h, BAND_LIFT);
  const offsets = st.double ? [st.double / 2, -st.double / 2] : [0];
  for (const [a, b] of dashes(length, st.dash, st.gap)) for (const o of offsets) strip(sink, line, a, b, o, st.width, st.color, h, MARKING_LIFT);
};
