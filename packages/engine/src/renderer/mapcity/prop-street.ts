import { BOLLARD } from "@seki/sim";
import { MeshSink } from "../mesh-sink";
import type { Vec } from "../mesh-sink";
import { blob, block, glow, norm, paint, path, pyramid, tube, v3 } from "./prop-kit";
import { face, vertex } from "./sink-ops";

/**
 * Small street furniture (ADR-0047), front +z: the slatted benches of Plac Litewski, cast-iron
 * bollards with a chain, bins, bike racks and the city bike totem, advertising columns, boards,
 * street name plates, cabinets, manholes, granite seats, flagpoles with the red city banners,
 * signals, cameras and the trolleybus poles with their hangers.
 */

const WOOD = paint("#8a5a36");
const WOOD_DARK = paint("#6d4527");
const GRANITE = paint("#8e8d88");
const GRANITE_DARK = paint("#6f6e6a");
const STEEL = paint("#5f656d");
const DARK = paint("#24272d");
const HOLO = glow("#38e4ff");
const RED = glow("#ff2a3a");

/** Shape 0: a long slatted bench without a back (ławy of the squares), 1: with a back. */
export const bench = (shape: number): MeshSink => {
  const sink = new MeshSink();
  const w = shape === 0 ? 2.2 : 1.8;
  for (const sx of [-1, 1]) block(sink, sx * (w / 2 - 0.25), -0.15, 0, 0.12, 0.55, 0.5, GRANITE_DARK);
  for (let i = 0; i < 5; i++) sink.box(v3(0, 0.43, -0.2 + i * 0.1), w, 0.04, 0.075, i % 2 ? WOOD : WOOD_DARK);
  // 2077: a neon strip under the seat.
  sink.box(v3(0, 0.37, 0.2), w - 0.3, 0.02, 0.02, HOLO);
  if (shape === 1) {
    for (const sx of [-1, 1]) sink.box(v3(sx * (w / 2 - 0.25), 0.7, -0.26), 0.1, 0.6, 0.06, DARK, { tilt: 0 });
    for (let i = 0; i < 3; i++) sink.box(v3(0, 0.62 + i * 0.13, -0.27 - i * 0.02), w, 0.08, 0.03, WOOD);
  }
  return sink;
};

const IRON = paint("#1b1d21");
/** Sides of a bollard's round parts. */
const ROUND = 10;

/**
 * A black cast-iron post of Lublin's centre (G-032, G-819; Plac Łokietka, Plac Wolności), as
 * `BOLLARD` sizes it: a round shaft sunk 0.2 m into the ground in a wider foot with a flared top,
 * a collar with the chain's eye, a neck, the ball and a small finial; for 2077, a ring of LED
 * round the shaft. Its chain is drawn apart (`bollardChain`).
 */
export const bollard = (): MeshSink => {
  const sink = new MeshSink();
  const { shaft, foot, footHeight, ball, height, chainY } = BOLLARD;
  const ballY = height - 0.03 - ball;
  sink.prism(v3(0, -0.2, 0), foot, 0.2 + footHeight - 0.04, ROUND, IRON, false);
  sink.prism(v3(0, footHeight - 0.04, 0), foot, 0.04, ROUND, IRON, false, shaft);
  sink.prism(v3(0, footHeight, 0), shaft, ballY - ball - footHeight + 0.01, ROUND, IRON, false);
  sink.prism(v3(0, chainY - 0.025, 0), shaft + 0.012, 0.05, ROUND, IRON);
  sink.prism(v3(0, 0.5, 0), shaft + 0.006, 0.03, ROUND, glow("#ff3355"));
  blob(sink, v3(0, ballY, 0), ball, ball, ball, IRON, ROUND, 5);
  sink.prism(v3(0, ballY + ball - 0.01, 0), 0.018, height - ballY - ball + 0.01, 6, IRON, true, 0.006);
  return sink;
};

/** A chain's links: their pitch along it, their length (they overlap) and their wire's thickness (m). */
const LINK = { pitch: 0.065, length: 0.085, wire: 0.012 } as const;

/** A flat link from `a` to `b`, `BOLLARD.chain` half wide across its run: upright, or lying (turned a quarter). */
const link = (sink: MeshSink, a: Vec, b: Vec, lying: boolean): void => {
  const run = norm(v3(b.x - a.x, b.y - a.y, b.z - a.z));
  const side = norm(v3(-run.z, 0, run.x));
  const up = v3(side.y * run.z - side.z * run.y, side.z * run.x - side.x * run.z, side.x * run.y - side.y * run.x);
  const [wide, thin] = lying ? [side, up] : [up, side];
  const c = v3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  const at = (l: number, w: number, t: number): Vec => ({
    x: c.x + run.x * l + wide.x * w + thin.x * t,
    y: c.y + run.y * l + wide.y * w + thin.y * t,
    z: c.z + run.z * l + wide.z * w + thin.z * t,
  });
  const l = LINK.length / 2;
  const w = BOLLARD.chain;
  const t = LINK.wire / 2;
  const neg = (n: Vec): Vec => v3(-n.x, -n.y, -n.z);
  sink.quad([at(-l, -w, t), at(l, -w, t), at(l, w, t), at(-l, w, t)], thin, IRON);
  sink.quad([at(-l, -w, -t), at(-l, w, -t), at(l, w, -t), at(l, -w, -t)], neg(thin), IRON);
  sink.quad([at(-l, w, -t), at(-l, w, t), at(l, w, t), at(l, w, -t)], wide, IRON);
  sink.quad([at(-l, -w, -t), at(l, -w, -t), at(l, -w, t), at(-l, -w, t)], neg(wide), IRON);
};

/**
 * A bollard's chain from its shaft along its +x to `end` metres from its centre: the next post's
 * shaft or a lamp's (G-032; the piece is turned along the chain). Flat links, upright and lying
 * by turns, a band `2 * BOLLARD.chain` wide that reads as a chain from afar (G-819), sagging by
 * `BOLLARD.sag` of its span.
 */
export const bollardChain = (end: number): MeshSink => {
  const sink = new MeshSink();
  const a = BOLLARD.shaft;
  const span = end - a;
  const sag = BOLLARD.sag * span;
  const n = Math.max(2, Math.round(span / LINK.pitch));
  const at = (t: number): Vec => v3(a + span * t, BOLLARD.chainY - sag * 4 * t * (1 - t), 0);
  for (let k = 0; k < n; k++) link(sink, at(k / n), at((k + 1) / n), k % 2 === 1);
  return sink;
};

/** Sides of a phone's bollard (`bollardLow`). */
const ROUND_LOW = 6;

/**
 * The phones' bollard (quality `low`): the same post in some 130 vertices, not about 390. A
 * six-sided foot, flare and shaft, the red LED ring, the ball six by four (three rings miss its
 * equator, and it shrinks into the shaft); no collar nor finial, which a phone's screen does not
 * show at the distances it draws furniture from.
 */
export const bollardLow = (): MeshSink => {
  const sink = new MeshSink();
  const { shaft, foot, footHeight, ball, height } = BOLLARD;
  const ballY = height - ball;
  sink.prism(v3(0, -0.2, 0), foot, 0.2 + footHeight - 0.04, ROUND_LOW, IRON, false);
  sink.prism(v3(0, footHeight - 0.04, 0), foot, 0.04, ROUND_LOW, IRON, false, shaft);
  sink.prism(v3(0, footHeight, 0), shaft, ballY - footHeight, ROUND_LOW, IRON, false);
  // The red LED ring of the 2077 layer, its sides only: the accent a phone sees down a row.
  sink.prism(v3(0, 0.5, 0), shaft + 0.006, 0.03, ROUND_LOW, glow("#ff3355"), false);
  blob(sink, v3(0, ballY, 0), ball, ball, ball, IRON, ROUND_LOW, 4);
  return sink;
};

/** Both faces of a sagging strip through `pts`, `off(k)` half wide at each point and facing ±`n(k)`. */
const strip = (sink: MeshSink, pts: readonly Vec[], off: (k: number) => Vec, n: (k: number) => Vec): void => {
  for (const s of [1, -1]) {
    const ids = pts.flatMap((c, k) => {
      const o = off(k);
      const nk = n(k);
      const ns = v3(nk.x * s, nk.y * s, nk.z * s);
      return [vertex(sink, v3(c.x + o.x, c.y + o.y, c.z + o.z), ns, IRON), vertex(sink, v3(c.x - o.x, c.y - o.y, c.z - o.z), ns, IRON)];
    });
    for (let k = 0; k + 1 < pts.length; k++) {
      const nk = n(k);
      const ns = v3(nk.x * s, nk.y * s, nk.z * s);
      face(sink, ids[2 * k]!, ids[2 * k + 2]!, ids[2 * k + 3]!, ns);
      face(sink, ids[2 * k]!, ids[2 * k + 3]!, ids[2 * k + 1]!, ns);
    }
  }
};

/**
 * The phones' chain (quality `low`), along the same sagging line as `bollardChain`: two strips
 * crossed along it, `2 * BOLLARD.chain` wide, upright and lying as the links take turns, of four to
 * six quads each. About 50 vertices a span instead of 16 a link (600 on a 2.5 m span); from the
 * distances a phone draws it from, it reads as the same band of links.
 */
export const bollardChainLow = (end: number): MeshSink => {
  const sink = new MeshSink();
  const a = BOLLARD.shaft;
  const span = end - a;
  const sag = BOLLARD.sag * span;
  const n = Math.min(6, Math.max(4, Math.round(span / 0.5)));
  const y = (t: number): number => BOLLARD.chainY - sag * 4 * t * (1 - t);
  const pts = Array.from({ length: n + 1 }, (_, k) => v3(a + (span * k) / n, y(k / n), 0));
  // Across the line in its upright plane: the slope of the sag at each point turned a quarter.
  const up = (k: number): Vec => norm(v3((sag * 4 * (1 - (2 * k) / n)) / span, 1, 0));
  const w = BOLLARD.chain;
  const side = v3(0, 0, 1);
  strip(sink, pts, (k) => v3(up(k).x * w, up(k).y * w, 0), () => side);
  strip(sink, pts, () => v3(0, 0, w), up);
  return sink;
};

/** Shape 0 graphite, 1 the old green; a small screen for the 2077 deposit. */
export const wasteBin = (shape: number): MeshSink => {
  const sink = new MeshSink();
  const body = paint(shape === 0 ? "#3a3f46" : "#2f4a37");
  sink.prism(v3(0, -0.1, 0), 0.24, 0.95, 8, body, true, 0.26);
  sink.prism(v3(0, 0.85, 0), 0.28, 0.06, 8, DARK);
  sink.box(v3(0, 0.55, 0.255), 0.14, 0.08, 0.01, glow("#5cffb0"));
  return sink;
};

export const bikeRack = (): MeshSink => {
  const sink = new MeshSink();
  for (const x of [-0.8, 0, 0.8]) path(sink, [v3(x, -0.1, -0.3), v3(x, 0.75, -0.3), v3(x, 0.85, -0.15), v3(x, 0.85, 0.15), v3(x, 0.75, 0.3), v3(x, -0.1, 0.3)], 0.025, STEEL, 5);
  return sink;
};

/** The city bike totem with its screen and four hoops. */
export const bikeStation = (): MeshSink => {
  const sink = bikeRack();
  block(sink, -1.6, -0.1, 0, 0.42, 2.3, 0.3, paint("#2b6e4a"));
  sink.box(v3(-1.6, 1.5, 0.155), 0.3, 0.42, 0.01, glow("#9ff7c8"));
  return sink;
};

/** Shape 0 graphite with posters, 1 the yellow column with a dome (Plac Zamkowy); 2077: a screen ring. */
export const advertisingColumn = (shape: number): MeshSink => {
  const sink = new MeshSink();
  const base = paint(shape === 1 ? "#d8b23a" : "#3b4048");
  sink.prism(v3(0, -0.2, 0), 0.68, 0.5, 12, DARK);
  sink.prism(v3(0, 0.3, 0), 0.6, 0.9, 12, paint("#c9c2b0"));
  sink.prism(v3(0, 1.2, 0), 0.6, 0.55, 12, paint("#a8483d"));
  // 2077: a ring of screen between the posters.
  sink.prism(v3(0, 1.75, 0), 0.61, 0.45, 12, glow("#4fd2ff"));
  sink.prism(v3(0, 2.2, 0), 0.6, 0.45, 12, paint("#d9cfb4"));
  sink.prism(v3(0, 2.65, 0), 0.7, 0.12, 12, base);
  if (shape === 1) blob(sink, v3(0, 2.8, 0), 0.62, 0.45, 0.62, base, 10, 4);
  else sink.prism(v3(0, 2.77, 0), 0.62, 0.25, 12, base, true, 0.2);
  pyramid(sink, v3(0, shape === 1 ? 3.2 : 3.0, 0), 0.12, 0.12, 0.3, DARK);
  return sink;
};

export const aFrameSign = (): MeshSink => {
  const sink = new MeshSink();
  sink.box(v3(0, 0.45, 0.12), 0.55, 0.9, 0.03, DARK, { tilt: 0 });
  sink.box(v3(0, 0.45, -0.12), 0.55, 0.9, 0.03, DARK);
  sink.box(v3(0, 0.5, 0.14), 0.45, 0.6, 0.01, glow("#f2f0e6"));
  return sink;
};

/** A post with Lublin's blue name plate (also the info boards). */
export const streetPlate = (): MeshSink => {
  const sink = new MeshSink();
  sink.prism(v3(0, -0.1, 0), 0.04, 2.8, 6, STEEL);
  sink.box(v3(0, 2.55, 0), 0.75, 0.24, 0.04, paint("#1f4f9a"));
  sink.box(v3(0, 2.55, 0.022), 0.62, 0.08, 0.005, glow("#e8f2ff"));
  return sink;
};

export const streetCabinet = (): MeshSink => {
  const sink = new MeshSink();
  block(sink, 0, -0.1, 0, 0.8, 1.25, 0.36, paint("#7d827f"));
  sink.box(v3(0, 1.17, 0), 0.86, 0.04, 0.42, paint("#5d625f"));
  sink.box(v3(0.25, 0.9, 0.185), 0.08, 0.04, 0.01, glow("#ffb000"));
  return sink;
};

/** A cast-iron cover lying 2 cm above the carriageway's surface (which sits 6 cm above the terrain). */
export const manhole = (): MeshSink => {
  const sink = new MeshSink();
  sink.disc(v3(0, 0.085, 0), 0.34, 0.34, 10, paint("#2b2b2c"));
  sink.disc(v3(0, 0.087, 0), 0.24, 0.24, 10, paint("#3a3936"));
  return sink;
};

/** The granite cube seats of Plac Litewski; 2077: a light panel on top. */
export const graniteBlock = (): MeshSink => {
  const sink = new MeshSink();
  block(sink, 0, -0.15, 0, 0.55, 0.6, 0.55, GRANITE);
  sink.box(v3(0, 0.455, 0), 0.3, 0.01, 0.3, glow("#7fe9ff"));
  return sink;
};

/** Shape 0: an 8 m mast with a long red city banner; 1: the 35 m Maszt Niepodległości with an aviation light. */
export const flagpole = (shape: number): MeshSink => {
  const sink = new MeshSink();
  const h = shape === 1 ? 35 : 8.5;
  sink.prism(v3(0, -0.2, 0), shape === 1 ? 0.35 : 0.1, h + 0.2, 8, paint("#c9ccd0"), true, shape === 1 ? 0.12 : 0.05);
  const flagH = shape === 1 ? 6 : 4.2;
  const flagW = shape === 1 ? 10 : 0.9;
  sink.box(v3(flagW / 2 + 0.08, h - 0.3 - flagH / 2, 0), flagW, flagH, 0.03, paint("#c8102e"));
  if (shape === 1) sink.box(v3(flagW / 2 + 0.08, h - 0.3 - flagH * 0.25, 0), flagW, flagH / 2, 0.035, paint("#f2f2f2"));
  else sink.box(v3(0.08 + flagW, h - 0.3 - flagH / 2, 0), 0.03, flagH, 0.035, glow("#ff4060"));
  blob(sink, v3(0, h + 0.05, 0), 0.08, 0.08, 0.08, shape === 1 ? RED : paint("#d8c070"), 5, 3);
  return sink;
};

export const trafficSignal = (): MeshSink => {
  const sink = new MeshSink();
  sink.prism(v3(0, -0.1, 0), 0.07, 3.4, 8, DARK);
  sink.box(v3(0, 2.75, 0.12), 0.3, 0.9, 0.22, DARK);
  ["#ff2a2a", "#ffb000", "#28ff7a"].forEach((c, i) => sink.box(v3(0, 3.03 - i * 0.28, 0.235), 0.17, 0.17, 0.01, glow(c)));
  sink.box(v3(0, 1.25, 0.09), 0.18, 0.22, 0.12, DARK);
  sink.box(v3(0, 1.25, 0.152), 0.1, 0.1, 0.005, glow("#ffffff"));
  return sink;
};

export const cctv = (): MeshSink => {
  const sink = new MeshSink();
  sink.prism(v3(0, -0.1, 0), 0.06, 4.3, 6, DARK);
  tube(sink, v3(0, 4.1, 0), v3(0, 4.1, 0.45), 0.025, DARK, 4);
  sink.box(v3(0, 4.0, 0.5), 0.16, 0.16, 0.34, paint("#d9dbdc"), { tilt: 0 });
  sink.box(v3(0, 4.0, 0.675), 0.07, 0.07, 0.01, RED);
  return sink;
};

/**
 * A trolleybus pole: steel mast, a bracket over the road towards +z with a hanger, and stubs of
 * the two contact wires along the street (x), lit by sparks of neon markers in 2077.
 */
export const trolleyPole = (): MeshSink => {
  const sink = new MeshSink();
  sink.prism(v3(0, -0.2, 0), 0.14, 8.0, 8, STEEL, true, 0.1);
  tube(sink, v3(0, 7.2, 0), v3(0, 6.9, 4.2), 0.04, STEEL, 5);
  tube(sink, v3(0, 7.8, 0), v3(0, 6.95, 3.4), 0.02, STEEL, 4);
  const wire = paint("#1a1a1c");
  for (const z of [3.9, 4.5]) {
    tube(sink, v3(0, 6.9, z - 0.3), v3(0, 6.55, z), 0.01, wire, 3);
    sink.box(v3(0, 6.5, z), 14, 0.025, 0.025, wire);
  }
  sink.box(v3(0, 6.85, 4.2), 0.08, 0.08, 0.08, glow("#3cf0ff"));
  return sink;
};
