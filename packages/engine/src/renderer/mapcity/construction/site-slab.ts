import type { MeshSink, Rgba } from "../../mesh-sink";
import { glow, paint } from "../prop-kit";
import { quadUv } from "../sink-ops";

/**
 * The building sites' kit (ADR-0087 stage 1) in a piece's own frame: local +x along the fence,
 * +z out of the site, y up, the foot at the origin. Its palette: the hoarding's graphite, the
 * hazard yellow, the neon of the LED strips and the developers' holograms (self-lit, ADR-0027).
 */

/** How far a piece reaches under the ground, so on a slope its low side meets it (m). */
export const SITE_SINK = 0.3;

export const GRAPHITE = paint("#2a2d33");
export const GRAPHITE_LIGHT = paint("#3c4048");
export const STEEL = paint("#5d636c");
export const HAZARD = paint("#d6ae2e");
export const HAZARD_DARK = paint("#1d1e21");

/** The LED strips' colours: cyan, magenta, amber, acid green. */
export const LEDS: readonly Rgba[] = ["#38e8ff", "#ff45e6", "#ffb447", "#a6ff4a"].map(glow);

/** The developers' holograms: a field and a band each. */
export const ADS: readonly (readonly [Rgba, Rgba])[] = [
  [glow("#1f8fd8"), glow("#7af2ff")],
  [glow("#b0247c"), glow("#ff8ad8")],
  [glow("#1b9e6a"), glow("#b8ff7a")],
  [glow("#7a3bd8"), glow("#ffd36b")],
];

const UV = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
] as const;

/**
 * A box `x0..x1` along the piece and `z0..z1` across it, from `from` over the ground (or
 * `SITE_SINK` under it, for 0) up to `top`; both follow the ground's `rise` over `length` along x.
 */
export const slab = (sink: MeshSink, s: { readonly rise: number; readonly length: number }, x0: number, x1: number, z0: number, z1: number, from: number, top: number, color: Rgba): void => {
  const y = (x: number, h: number) => (s.rise * x) / Math.max(s.length, 1e-6) + h;
  const lo = from <= 0 ? -SITE_SINK : from;
  const p = (x: number, z: number, h: number) => ({ x, y: y(x, h), z });
  quadUv(sink, [p(x0, z0, top), p(x1, z0, top), p(x1, z1, top), p(x0, z1, top)], { x: 0, y: 1, z: 0 }, color, UV);
  quadUv(sink, [p(x0, z1, lo), p(x1, z1, lo), p(x1, z1, top), p(x0, z1, top)], { x: 0, y: 0, z: 1 }, color, UV);
  quadUv(sink, [p(x0, z0, lo), p(x1, z0, lo), p(x1, z0, top), p(x0, z0, top)], { x: 0, y: 0, z: -1 }, color, UV);
  quadUv(sink, [p(x0, z0, lo), p(x0, z1, lo), p(x0, z1, top), p(x0, z0, top)], { x: -1, y: 0, z: 0 }, color, UV);
  quadUv(sink, [p(x1, z0, lo), p(x1, z1, lo), p(x1, z1, top), p(x1, z0, top)], { x: 1, y: 0, z: 0 }, color, UV);
};

/** A flat face on a piece's outer (+z) side at `z`, `x0..x1` along and `h0..h1` up, following the rise: a hologram, a sign. */
export const facing = (sink: MeshSink, s: { readonly rise: number; readonly length: number }, z: number, x0: number, x1: number, h0: number, h1: number, color: Rgba, dir: 1 | -1 = 1): void => {
  const y = (x: number, h: number) => (s.rise * x) / Math.max(s.length, 1e-6) + h;
  const p = (x: number, h: number) => ({ x, y: y(x, h), z });
  quadUv(sink, [p(x0, h0), p(x1, h0), p(x1, h1), p(x0, h1)], { x: 0, y: 0, z: dir }, color, UV);
};
