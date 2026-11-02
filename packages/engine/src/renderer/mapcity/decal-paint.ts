import { type GraffitiLayout, graffitiVariant } from "@seki/core";
import { prng } from "../city-kit-data";
import { MeshSink, type Rgba, type Vec } from "../mesh-sink";
import { PLINTH_BAND } from "./facade-frame";
import { face, vertex } from "./sink-ops";
import { paint } from "./prop-kit";

/**
 * Graffiti of Lublin 2077 (ADR-0058 stage 6), procedural, in the street furniture's vertex colours
 * (no texture, no draw call: baked into the block mesh). In a decal's own frame: x along the wall
 * (the piece's middle at 0), y up from the piece's foot, z out of the wall; the paint lies in three
 * layers `LAYER` off the wall, outlines under fills under highlights, all inside the layout's
 * rectangle from `lift` to `lift + height`. Eight designs, every one a pure function of the layout.
 */

/** How far the layers lie off the wall's face (m): far enough apart not to fight in the depth buffer. */
export const LAYER = { line: 0.014, fill: 0.022, top: 0.03 } as const;

const OUT: Vec = { x: 0, y: 0, z: 1 };
const INK = paint("#141418");
const CHALK = paint("#efeee6");
const SPRAY: readonly Rgba[] = ["#ff3fa4", "#2ee6ff", "#a6ff3c", "#ff8a1f", "#8a5cff", "#ffe23a", "#ff4d4d", "#3cffc8"].map(paint);

/** A flat triangle facing out at depth z. */
const tri = (sink: MeshSink, a: [number, number], b: [number, number], c: [number, number], z: number, color: Rgba): void => {
  const i = vertex(sink, { x: a[0], y: a[1], z }, OUT, color);
  const j = vertex(sink, { x: b[0], y: b[1], z }, OUT, color);
  const k = vertex(sink, { x: c[0], y: c[1], z }, OUT, color);
  face(sink, i, j, k, OUT);
};

/** A flat quad (any four corners in turn) facing out at depth z. */
const quad4 = (sink: MeshSink, p: readonly [number, number][], z: number, color: Rgba): void => {
  tri(sink, p[0]!, p[1]!, p[2]!, z, color);
  tri(sink, p[0]!, p[2]!, p[3]!, z, color);
};

const rect = (sink: MeshSink, x0: number, y0: number, x1: number, y1: number, z: number, color: Rgba): void =>
  quad4(
    sink,
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
    z,
    color,
  );

/** A straight stroke `t` thick from a to b. */
const stroke = (sink: MeshSink, a: [number, number], b: [number, number], t: number, z: number, color: Rgba): void => {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const nx = (-(b[1] - a[1]) / l) * (t / 2);
  const ny = ((b[0] - a[0]) / l) * (t / 2);
  quad4(
    sink,
    [
      [a[0] + nx, a[1] + ny],
      [a[0] - nx, a[1] - ny],
      [b[0] - nx, b[1] - ny],
      [b[0] + nx, b[1] + ny],
    ],
    z,
    color,
  );
};

const ellipse = (sink: MeshSink, cx: number, cy: number, rx: number, ry: number, z: number, color: Rgba, sides = 10): void => {
  for (let k = 0; k < sides; k++) {
    const a0 = (k / sides) * Math.PI * 2;
    const a1 = ((k + 1) / sides) * Math.PI * 2;
    tri(sink, [cx, cy], [cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry], [cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry], z, color);
  }
};

/** The paint's box: x from -w/2 to w/2, y from y0 to y1. */
interface Box {
  readonly w: number;
  readonly y0: number;
  readonly y1: number;
}

const pick = (rand: () => number): Rgba => SPRAY[Math.floor(rand() * SPRAY.length) % SPRAY.length]!;

/** 0: a throw-up, bubble letters outlined in ink with a chalk shine. */
const throwUp = (sink: MeshSink, b: Box, rand: () => number): void => {
  const h = b.y1 - b.y0;
  const n = Math.max(2, Math.min(5, Math.round(b.w / (h * 0.7))));
  const step = b.w / n;
  const fill = pick(rand);
  for (let k = 0; k < n; k++) {
    const cx = -b.w / 2 + step * (k + 0.5);
    const rx = step * 0.5;
    const ry = (h / 2) * (0.82 + rand() * 0.18);
    const cy = b.y0 + h / 2;
    ellipse(sink, cx, cy, rx, ry, LAYER.line, INK);
    ellipse(sink, cx, cy, rx * 0.84, ry * 0.84, LAYER.fill, fill);
    ellipse(sink, cx - rx * 0.3, cy + ry * 0.4, rx * 0.16, ry * 0.12, LAYER.top, CHALK, 6);
  }
};

/** 1: a tag, a running zigzag of thin strokes with a swoosh under it. */
const tag = (sink: MeshSink, b: Box, rand: () => number): void => {
  const color = pick(rand);
  const h = b.y1 - b.y0;
  const t = Math.min(0.05, h * 0.08);
  const pts: [number, number][] = [];
  const n = 6 + Math.floor(rand() * 4);
  for (let k = 0; k <= n; k++) pts.push([-b.w / 2 + t + ((b.w - 2 * t) * k) / n, b.y0 + h * (k % 2 === 0 ? 0.3 + rand() * 0.2 : 0.75 + rand() * 0.2) - t]);
  for (let k = 0; k + 1 < pts.length; k++) stroke(sink, pts[k]!, pts[k + 1]!, t, LAYER.fill, color);
  stroke(sink, [-b.w / 2 + t, b.y0 + t], [b.w / 2 - t, b.y0 + h * 0.18], t, LAYER.fill, color);
};

/** 2: a piece, slanted blocks of two colours on a dark ground. */
const piece = (sink: MeshSink, b: Box, rand: () => number): void => {
  const h = b.y1 - b.y0;
  rect(sink, -b.w / 2, b.y0, b.w / 2, b.y1, LAYER.line, paint("#2a1840"));
  const [c0, c1] = [pick(rand), pick(rand)];
  const n = Math.max(3, Math.min(6, Math.round(b.w / (h * 0.55))));
  const step = (b.w * 0.92) / n;
  const slant = step * 0.25;
  for (let k = 0; k < n; k++) {
    const x0 = -b.w * 0.46 + step * k;
    const y0 = b.y0 + h * (0.12 + rand() * 0.08);
    const y1 = b.y1 - h * (0.1 + rand() * 0.1);
    const body: [number, number][] = [
      [x0, y0],
      [x0 + step * 0.78, y0],
      [x0 + step * 0.78 + slant * 0.5, y1],
      [x0 + slant * 0.5, y1],
    ];
    quad4(sink, body, LAYER.fill, k % 2 === 0 ? c0 : c1);
    stroke(sink, [x0 + step * 0.2, y0 + (y1 - y0) * 0.55], [x0 + step * 0.6, y0 + (y1 - y0) * 0.55], (y1 - y0) * 0.12, LAYER.top, INK);
  }
};

/** 3: a stencil, a masked face in ink on a chalk square. */
const stencil = (sink: MeshSink, b: Box, rand: () => number): void => {
  const h = b.y1 - b.y0;
  const s = Math.min(b.w, h);
  const cy = b.y0 + h / 2;
  rect(sink, -s / 2, cy - s / 2, s / 2, cy + s / 2, LAYER.line, CHALK);
  ellipse(sink, 0, cy, s * 0.38, s * 0.42, LAYER.fill, INK, 12);
  const eye = pick(rand);
  for (const sx of [-1, 1]) rect(sink, sx * s * 0.2 - s * 0.08, cy + s * 0.04, sx * s * 0.2 + s * 0.08, cy + s * 0.14, LAYER.top, eye);
  for (let k = -2; k <= 2; k++) rect(sink, k * s * 0.07 - s * 0.02, cy - s * 0.3, k * s * 0.07 + s * 0.02, cy - s * 0.12, LAYER.top, CHALK);
};

/** 4: a band of colour with drips running down from it. */
const drips = (sink: MeshSink, b: Box, rand: () => number): void => {
  const h = b.y1 - b.y0;
  const color = pick(rand);
  rect(sink, -b.w / 2, b.y1 - h * 0.4, b.w / 2, b.y1, LAYER.fill, color);
  rect(sink, -b.w / 2, b.y1 - h * 0.4, b.w / 2, b.y1 - h * 0.34, LAYER.top, INK);
  const n = Math.max(3, Math.round(b.w / 0.25));
  for (let k = 0; k < n; k++) {
    const x = -b.w / 2 + (b.w * (k + 0.5)) / n;
    const len = h * (0.2 + rand() * 0.38);
    rect(sink, x - 0.012, b.y1 - h * 0.4 - len, x + 0.012, b.y1 - h * 0.4, LAYER.fill, color);
  }
};

/** 5: neo-kana, glyphs of bars in one colour outlined in ink. */
const kana = (sink: MeshSink, b: Box, rand: () => number): void => {
  const h = b.y1 - b.y0;
  const color = pick(rand);
  const n = Math.max(1, Math.min(4, Math.floor(b.w / (h * 0.8))));
  const cell = Math.min(b.w / n, h);
  const t = cell * 0.13;
  for (let k = 0; k < n; k++) {
    const cx = -b.w / 2 + (b.w * (k + 0.5)) / n;
    const cy = b.y0 + h / 2;
    const half = cell * 0.4;
    const bars: [[number, number], [number, number]][] = [
      [
        [cx - half, cy + half * 0.6],
        [cx + half, cy + half * 0.6],
      ],
      [
        [cx + half * (rand() - 0.5), cy + half],
        [cx + half * (rand() - 0.5), cy - half],
      ],
      [
        [cx - half * 0.8, cy - half * 0.2],
        [cx + half * 0.6, cy - half * 0.7],
      ],
    ];
    for (const [a, c] of bars) stroke(sink, a, c, t * 1.6, LAYER.line, INK);
    for (const [a, c] of bars) stroke(sink, a, c, t, LAYER.fill, color);
  }
};

/** 6: a mural, a sunset in bands with a sun and a skyline in ink. */
const mural = (sink: MeshSink, b: Box, rand: () => number): void => {
  const h = b.y1 - b.y0;
  const bands = ["#2a1840", "#6a1f6e", "#c2306f", "#ff5e5b", "#ff9f43"].map(paint);
  bands.forEach((c, k) => rect(sink, -b.w / 2, b.y1 - (h * (k + 1)) / bands.length, b.w / 2, b.y1 - (h * k) / bands.length, LAYER.line, c));
  const r = Math.min(b.w, h) * 0.28;
  ellipse(sink, (rand() - 0.5) * (b.w - 2 * r), b.y0 + h * 0.42, r, r, LAYER.fill, paint("#ffe23a"), 16);
  let x = -b.w / 2;
  while (x < b.w / 2 - 0.05) {
    const bw = Math.min(b.w / 2 - x, 0.15 + rand() * 0.5);
    rect(sink, x, b.y0, x + bw, b.y0 + h * (0.12 + rand() * 0.3), LAYER.top, INK);
    x += bw;
  }
};

/** 7: wildstyle arrows crossing. */
const arrows = (sink: MeshSink, b: Box, rand: () => number): void => {
  const h = b.y1 - b.y0;
  const t = Math.min(h * 0.16, 0.18);
  for (let k = 0; k < 2; k++) {
    const color = pick(rand);
    const up = k === 0;
    const a: [number, number] = [-b.w / 2 + t, up ? b.y0 + t : b.y1 - t];
    const c: [number, number] = [b.w / 2 - t * 2.2, up ? b.y1 - t * 1.4 : b.y0 + t * 1.4];
    stroke(sink, a, c, t * 1.4, LAYER.line, INK);
    stroke(sink, a, c, t, LAYER.fill, color);
    const head: [number, number] = [b.w / 2 - t * 0.2, up ? b.y1 - t * 0.3 : b.y0 + t * 0.3];
    tri(sink, [c[0], c[1] + (up ? t : -t)], [c[0], c[1] - (up ? t : -t)], head, LAYER.top, color);
  }
};

const DESIGNS = [throwUp, tag, piece, stencil, drips, kana, mural, arrows] as const;

/** A piece of graffiti in its own frame (see the module's doc); one on the plinth band lies on the band's face, `PLINTH_BAND.out` further out. */
export const graffitiModel = (g: GraffitiLayout): MeshSink => {
  const sink = new MeshSink();
  const rand = prng(graffitiVariant({ ...g, band: false }) ^ 0x6a5f1);
  DESIGNS[g.design % DESIGNS.length]!(sink, { w: g.width, y0: g.lift, y1: g.lift + g.height }, rand);
  if (g.band) for (let i = 2; i < sink.positions.length; i += 3) sink.positions[i] = sink.positions[i]! + PLINTH_BAND.out;
  return sink;
};
